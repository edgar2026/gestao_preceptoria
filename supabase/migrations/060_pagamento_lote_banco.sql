-- 060_pagamento_lote_banco.sql
-- ETAPA: PAGAMENTO-LOTE-BANCO
--
-- Objetivo: operação TRANSACIONAL para marcar vários preceptores como PAGOS na
-- mesma competência. O pagamento (transferência) ocorre em OUTRO sistema; esta
-- operação apenas REGISTRA o pagamento já realizado.
--
-- RPCs criadas:
--   * public.previa_pagamento_lote(p_competencia_id, p_preceptor_ids)
--       -> resumo (selecionados/válidos/bloqueados/valor total válido) + lista
--          de bloqueios com motivo. NÃO altera nada.
--   * public.executar_pagamento_lote(p_competencia_id, p_preceptor_ids,
--                                    p_data_pagamento, p_observacao)
--       -> registro transacional do lote (tudo ou nada).
--   * public.fn_pagamento_lote_avaliar(p_competencia_id, p_preceptor_id)
--       -> função interna de elegibilidade, compartilhada pela prévia e pela
--          execução (mesma regra nos dois caminhos).
--
-- Regras de elegibilidade (todos os itens obrigatórios):
--   * mesmo competencia_id informado na chamada;
--   * cálculo válido: existe cálculo para o preceptor+competência, com status
--     'calculado'/'aprovado'/'fechado', valor > 0 e composição da solicitação
--     coerente com os cálculos atuais (mesmos cálculos e mesma soma);
--   * cálculo NÃO desatualizado (mesma regra de verificar_desatualizacao_competencia:
--     presença confirmada/ajustada da competência registrada após calculado_em);
--   * e-mail confirmado como enviado (situacao em 'solicitada' | 'nota_recebida'
--     | 'em_pagamento');
--   * ainda não pago (situacao <> 'pago').
--
-- Bloqueios (codigo -> motivo):
--   * ja_pago             -> registro já pago na competência;
--   * email_nao_enviado   -> e-mail não preparado/confirmado como enviado;
--   * calculo_desatualizado-> cálculo desatualizado em relação às presenças;
--   * competencia_diferente-> registros do preceptor em outra competência;
--   * registro_invalido   -> preceptor/cálculo/solicitação inexistente,
--                            cancelado, status não permitido ou composição
--                            divergente.
--
-- Garantias da execução:
--   * somente Administrador (revalidado no servidor);
--   * revalidação de TODOS os selecionados antes de qualquer escrita;
--   * impedimento de pagamento duplicado (linhas travadas com FOR UPDATE);
--   * situação 'pago', data do pagamento, valor pago, responsável (profiles.id
--     resolvido de auth.uid()) e observação opcional gravados por registro;
--   * histórico INDIVIDUAL por registro em solicitacao_nota_fiscal_eventos;
--   * composição por atuação (solicitacao_nota_fiscal_itens) preservada (somente
--     leitura, nenhum DELETE);
--   * baixa individual por atuação em saldo_movimentos (tipo 'consumo') quando
--     houver saldo autorizado compatível — se não houver, não é aplicável e
--     nenhum saldo é alterado (saldo geral do preceptor NUNCA é alterado);
--   * qualquer falha => RAISE EXCEPTION => rollback total (nenhum pagamento do
--     lote permanece parcialmente gravado);
--   * sem DELETE e sem nenhuma transferência bancária.

begin;

-- ---------------------------------------------------------------------------
-- 1) Função interna de avaliação de elegibilidade
-- ---------------------------------------------------------------------------
create or replace function public.fn_pagamento_lote_avaliar(
  p_competencia_id uuid,
  p_preceptor_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_comp public.competencias%rowtype;
  v_ref text;
  v_nome text;
  v_sol public.solicitacoes_nota_fiscal%rowtype;
  v_tem_sol boolean := false;
  v_calc record;
  v_bloqueio jsonb;
  v_qtd_calculos integer := 0;
  v_qtd_itens integer := 0;
  v_soma_calculos numeric := 0;
  v_soma_itens numeric := 0;
  v_calculo_ids uuid[] := '{}'::uuid[];
  v_item_ids uuid[] := '{}'::uuid[];
  v_status_ruim text := null;
  v_desatualizado boolean := false;
  v_outros text := null;
begin
  select nome_completo into v_nome
    from public.preceptores
   where id = p_preceptor_id;

  v_bloqueio := jsonb_build_object(
    'preceptor_id', p_preceptor_id,
    'preceptor_nome', v_nome,
    'bloqueado', true,
    'codigo', 'registro_invalido',
    'motivo', null,
    'solicitacao_id', null,
    'situacao_atual', null,
    'valor_pago', 0,
    'qtd_atuacoes', 0,
    'atuacoes', '[]'::jsonb
  );

  if v_nome is null then
    return v_bloqueio || jsonb_build_object(
      'motivo', 'Registro inválido: preceptor não encontrado.');
  end if;

  select * into v_comp
    from public.competencias
   where id = p_competencia_id;

  if not found then
    return v_bloqueio || jsonb_build_object(
      'motivo', 'Registro inválido: competência não encontrada.');
  end if;

  v_ref := lpad(v_comp.ano::text, 4, '0') || '-' || lpad(v_comp.mes::text, 2, '0');

  select * into v_sol
    from public.solicitacoes_nota_fiscal
   where preceptor_id = p_preceptor_id
     and competencia = v_ref
   order by id
   limit 1;
  v_tem_sol := found;

  for v_calc in
    select c.id, c.status, c.total_bruto, c.calculado_em,
           c.tipo_atuacao, c.vinculo_adm_id, c.vinculo_internato_id
      from public.calculos c
     where c.preceptor_id = p_preceptor_id
       and c.competencia_id = p_competencia_id
     order by c.id
  loop
    v_qtd_calculos := v_qtd_calculos + 1;
    v_calculo_ids := v_calculo_ids || v_calc.id;
    v_soma_calculos := v_soma_calculos + coalesce(v_calc.total_bruto, 0);

    if v_calc.status not in ('calculado', 'aprovado', 'fechado') and v_status_ruim is null then
      v_status_ruim := v_calc.status::text;
    end if;

    if not v_desatualizado then
      select exists (
        select 1
          from public.presencas pp
         where pp.status in ('confirmada', 'ajustada')
           and pp.preceptor_id = p_preceptor_id
           and pp.tipo_atuacao = v_calc.tipo_atuacao
           and (
                 (v_calc.tipo_atuacao = 'adm' and pp.vinculo_adm_id = v_calc.vinculo_adm_id)
              or (v_calc.tipo_atuacao = 'internato' and pp.vinculo_internato_id = v_calc.vinculo_internato_id)
               )
           and extract(month from pp.data_presenca) = v_comp.mes
           and extract(year from pp.data_presenca) = v_comp.ano
           and greatest(pp.registrado_em, pp.updated_at)
               > coalesce(v_calc.calculado_em, '-infinity'::timestamptz)
      ) into v_desatualizado;
    end if;
  end loop;

  -- 1) Já pago nesta competência?
  if v_tem_sol and v_sol.situacao = 'pago' then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'ja_pago',
      'motivo', 'Registro já pago nesta competência.',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  -- 2) Existe cálculo nesta competência?
  if v_qtd_calculos = 0 then
    select string_agg(distinct x, ', ' order by x) into v_outros
      from (
        select s2.competencia as x
          from public.solicitacoes_nota_fiscal s2
         where s2.preceptor_id = p_preceptor_id
        union
        select lpad(c3.ano::text, 4, '0') || '-' || lpad(c3.mes::text, 2, '0')
          from public.calculos c2
          join public.competencias c3 on c3.id = c2.competencia_id
         where c2.preceptor_id = p_preceptor_id
      ) u;

    if v_outros is not null then
      return v_bloqueio || jsonb_build_object(
        'codigo', 'competencia_diferente',
        'motivo', 'Registros deste preceptor pertencem a outra competência (' || v_outros || ').');
    end if;

    return v_bloqueio || jsonb_build_object(
      'motivo', 'Registro inválido: nenhum cálculo encontrado para esta competência.');
  end if;

  -- 3) E-mail confirmado como enviado?
  if not v_tem_sol then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'email_nao_enviado',
      'motivo', 'E-mail não confirmado como enviado: nenhuma solicitação preparada/enviada nesta competência.');
  end if;

  if v_sol.situacao = 'cancelado' then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'registro_invalido',
      'motivo', 'Registro inválido: solicitação fiscal cancelada.',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  if v_sol.situacao in ('nao_solicitada', 'preparada') then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'email_nao_enviado',
      'motivo', 'E-mail não confirmado como enviado (situação atual: ' || v_sol.situacao::text || ').',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  -- 4) Cálculo válido (status permitido)?
  if v_status_ruim is not null then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'registro_invalido',
      'motivo', 'Registro inválido: cálculo em situação não permitida (' || v_status_ruim || ').',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  -- 5) Cálculo desatualizado?
  if v_desatualizado then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'calculo_desatualizado',
      'motivo', 'Cálculo desatualizado em relação às presenças: recalcule a competência antes de pagar.',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  -- 6) Composição por atuação preservada e coerente com os cálculos atuais?
  select count(*),
         coalesce(sum(i.valor_atuacao), 0),
         coalesce(array_agg(i.calculo_id order by i.calculo_id), '{}'::uuid[])
    into v_qtd_itens, v_soma_itens, v_item_ids
    from public.solicitacao_nota_fiscal_itens i
   where i.solicitacao_id = v_sol.id;

  if coalesce(v_item_ids, '{}'::uuid[]) is distinct from coalesce(v_calculo_ids, '{}'::uuid[]) then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'registro_invalido',
      'motivo', 'Registro inválido: a composição da solicitação não corresponde aos cálculos atuais (reprepare o e-mail).',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  if abs(v_soma_itens - v_soma_calculos) > 0.01 then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'registro_invalido',
      'motivo', 'Registro inválido: composição da solicitação (R$ ' || v_soma_itens::text || ') diverge dos cálculos (R$ ' || v_soma_calculos::text || ').',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  if coalesce(v_sol.valor_total_solicitado, 0) <= 0 then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'registro_invalido',
      'motivo', 'Registro inválido: valor total não informado.',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  if abs(v_sol.valor_total_solicitado - v_soma_itens) > 0.01 then
    return v_bloqueio || jsonb_build_object(
      'codigo', 'registro_invalido',
      'motivo', 'Registro inválido: valor total (R$ ' || v_sol.valor_total_solicitado::text || ') diverge da composição por atuação (R$ ' || v_soma_itens::text || ').',
      'solicitacao_id', v_sol.id,
      'situacao_atual', v_sol.situacao::text);
  end if;

  -- Elegível
  return jsonb_build_object(
    'preceptor_id', p_preceptor_id,
    'preceptor_nome', v_nome,
    'bloqueado', false,
    'codigo', null,
    'motivo', null,
    'solicitacao_id', v_sol.id,
    'situacao_atual', v_sol.situacao::text,
    'valor_pago', round(v_sol.valor_total_solicitado, 2),
    'qtd_atuacoes', v_qtd_itens,
    'atuacoes', (
      select coalesce(jsonb_agg(
               jsonb_build_object('calculo_id', i.calculo_id, 'valor_atuacao', i.valor_atuacao)
               order by i.calculo_id), '[]'::jsonb)
        from public.solicitacao_nota_fiscal_itens i
       where i.solicitacao_id = v_sol.id
    )
  );
end;
$function$;

revoke all on function public.fn_pagamento_lote_avaliar(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_pagamento_lote_avaliar(uuid, uuid) to postgres;

-- ---------------------------------------------------------------------------
-- 2) RPC de PRÉVIA (somente leitura)
-- ---------------------------------------------------------------------------
create or replace function public.previa_pagamento_lote(
  p_competencia_id uuid,
  p_preceptor_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id uuid;
  v_comp public.competencias%rowtype;
  v_ref text;
  v_ids uuid[];
  v_av jsonb;
  v_preceptor_id uuid;
  v_validos jsonb := '[]'::jsonb;
  v_bloqueios jsonb := '[]'::jsonb;
  v_qtd_valida integer := 0;
  v_qtd_bloqueada integer := 0;
  v_valor_total numeric := 0;
begin
  if not public.has_role(array['admin', 'administrador', 'super_admin', 'admin_super']::public.app_role[]) then
    raise exception 'Acesso negado. Perfil não autorizado para consultar a prévia de pagamento em lote.';
  end if;

  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Perfil do usuário autenticado não encontrado.';
  end if;

  if p_competencia_id is null then
    raise exception 'Competência é obrigatória.';
  end if;

  select * into v_comp
    from public.competencias
   where id = p_competencia_id;

  if not found then
    raise exception 'Competência não encontrada (%).', p_competencia_id;
  end if;

  if coalesce(array_length(p_preceptor_ids, 1), 0) = 0 then
    raise exception 'Nenhum registro selecionado para a prévia.';
  end if;

  v_ref := lpad(v_comp.ano::text, 4, '0') || '-' || lpad(v_comp.mes::text, 2, '0');

  select coalesce(array_agg(distinct x), '{}'::uuid[])
    into v_ids
    from unnest(p_preceptor_ids) x;

  for v_preceptor_id in select x from unnest(v_ids) as x order by x loop
    select public.fn_pagamento_lote_avaliar(p_competencia_id, v_preceptor_id) into v_av;

    if (v_av->>'bloqueado')::boolean then
      v_bloqueios := v_bloqueios || jsonb_build_array(v_av);
      v_qtd_bloqueada := v_qtd_bloqueada + 1;
    else
      v_validos := v_validos || jsonb_build_array(v_av);
      v_qtd_valida := v_qtd_valida + 1;
      v_valor_total := v_valor_total + (v_av->>'valor_pago')::numeric;
    end if;
  end loop;

  select coalesce(jsonb_agg(e order by coalesce(e->>'preceptor_nome', '')), '[]'::jsonb)
    into v_validos
    from jsonb_array_elements(v_validos) e;

  select coalesce(jsonb_agg(e order by coalesce(e->>'preceptor_nome', '')), '[]'::jsonb)
    into v_bloqueios
    from jsonb_array_elements(v_bloqueios) e;

  return jsonb_build_object(
    'sucesso', true,
    'competencia', jsonb_build_object(
      'id', v_comp.id,
      'ano', v_comp.ano,
      'mes', v_comp.mes,
      'referencia', v_ref
    ),
    'resumo', jsonb_build_object(
      'qtd_selecionada', coalesce(array_length(v_ids, 1), 0),
      'qtd_valida', v_qtd_valida,
      'qtd_bloqueada', v_qtd_bloqueada,
      'valor_total_valido', round(v_valor_total, 2),
      'pode_executar', (v_qtd_bloqueada = 0 and v_qtd_valida > 0)
    ),
    'validos', v_validos,
    'bloqueios', v_bloqueios
  );
end;
$function$;

revoke all on function public.previa_pagamento_lote(uuid, uuid[]) from public, anon;
grant execute on function public.previa_pagamento_lote(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) RPC de EXECUÇÃO (transacional, tudo ou nada)
-- ---------------------------------------------------------------------------
create or replace function public.executar_pagamento_lote(
  p_competencia_id uuid,
  p_preceptor_ids uuid[],
  p_data_pagamento date default null,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id uuid;
  v_comp public.competencias%rowtype;
  v_ref text;
  v_ids uuid[];
  v_data date;
  v_obs text;
  v_av jsonb;
  v_bloqueios jsonb := '[]'::jsonb;
  v_preceptor_id uuid;
  v_sol public.solicitacoes_nota_fiscal%rowtype;
  v_situacao_anterior public.situacao_nota_fiscal;
  v_atuacoes jsonb;
  v_qtd_itens integer;
  v_pagos jsonb := '[]'::jsonb;
  v_qtd_pago integer := 0;
  v_valor_pago_total numeric := 0;
  v_movimentos integer := 0;
  v_calc record;
  v_saldo_id uuid;
begin
  -- 1) Somente Administrador
  if not public.has_role(array['admin', 'administrador', 'super_admin', 'admin_super']::public.app_role[]) then
    raise exception 'Acesso negado. Perfil não autorizado para registrar pagamento em lote.';
  end if;

  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Perfil do usuário autenticado não encontrado.';
  end if;

  -- 2) Parâmetros
  if p_competencia_id is null then
    raise exception 'Competência é obrigatória.';
  end if;

  select * into v_comp
    from public.competencias
   where id = p_competencia_id;

  if not found then
    raise exception 'Competência não encontrada (%).', p_competencia_id;
  end if;

  if coalesce(array_length(p_preceptor_ids, 1), 0) = 0 then
    raise exception 'Nenhum registro selecionado para pagamento.';
  end if;

  v_ref := lpad(v_comp.ano::text, 4, '0') || '-' || lpad(v_comp.mes::text, 2, '0');
  v_data := coalesce(p_data_pagamento, current_date);
  v_obs := nullif(btrim(coalesce(p_observacao, '')), '');

  if v_data > current_date then
    raise exception 'Data do pagamento (%) não pode ser futura.', v_data;
  end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[])
    into v_ids
    from unnest(p_preceptor_ids) as x;

  -- 3) Travar as linhas envolvidas (evita corrida e pagamento duplicado)
  perform 1
    from public.solicitacoes_nota_fiscal s
   where s.preceptor_id = any (v_ids)
     and s.competencia = v_ref
   order by s.id
      for update;

  -- 4) Revalidar TODOS os selecionados antes de qualquer escrita
  for v_preceptor_id in select x from unnest(v_ids) as x order by x loop
    select public.fn_pagamento_lote_avaliar(p_competencia_id, v_preceptor_id) into v_av;

    if (v_av->>'bloqueado')::boolean then
      v_bloqueios := v_bloqueios || jsonb_build_array(v_av);
    end if;
  end loop;

  if jsonb_array_length(v_bloqueios) > 0 then
    raise exception 'Pagamento em lote bloqueado: % registro(s) não elegível(is) — nenhum pagamento foi registrado. Detalhes: %',
      jsonb_array_length(v_bloqueios), v_bloqueios::text;
  end if;

  -- 5) Registrar pagamentos (tudo ou nada)
  for v_preceptor_id in select x from unnest(v_ids) as x order by x loop
    select * into v_sol
      from public.solicitacoes_nota_fiscal s
     where s.preceptor_id = v_preceptor_id
       and s.competencia = v_ref
     order by s.id
        for update;

    if not found then
      raise exception 'Registro inválido: solicitação fiscal não encontrada para o preceptor % na competência %.',
        v_preceptor_id, v_ref;
    end if;

    if v_sol.situacao = 'pago' then
      raise exception 'Pagamento duplicado impedido: registro do preceptor % já está pago.', v_preceptor_id;
    end if;

    v_situacao_anterior := v_sol.situacao;

    -- 5.1) Transição interna solicitada -> nota_recebida (sem etapa de nota fiscal
    --      na interface), preservando a máquina de estados documentada.
    if v_sol.situacao = 'solicitada' then
      update public.solicitacoes_nota_fiscal
         set situacao = 'nota_recebida',
             nota_recebida_em = coalesce(nota_recebida_em, now()),
             updated_at = now()
       where id = v_sol.id;

      insert into public.solicitacao_nota_fiscal_eventos (
        solicitacao_id, situacao_anterior, situacao_nova,
        realizado_por, ocorrido_em, motivo, detalhes
      ) values (
        v_sol.id, 'solicitada', 'nota_recebida',
        v_profile_id, now(),
        'Transição interna automática (pagamento em lote)',
        jsonb_build_object(
          'acao', 'transicao_interna_pagamento_lote',
          'lote', true,
          'competencia', v_ref
        )
      );

      v_situacao_anterior := 'nota_recebida';
    end if;

    -- 5.2) Composição por atuação preservada (somente leitura)
    select count(*),
           coalesce(jsonb_agg(
             jsonb_build_object('calculo_id', i.calculo_id, 'valor_atuacao', i.valor_atuacao)
             order by i.calculo_id), '[]'::jsonb)
      into v_qtd_itens, v_atuacoes
      from public.solicitacao_nota_fiscal_itens i
     where i.solicitacao_id = v_sol.id;

    -- 5.3) Registrar situação Pago + data + valor + responsável + observação
    update public.solicitacoes_nota_fiscal
       set situacao = 'pago',
           updated_at = now()
     where id = v_sol.id;

    -- 5.4) Histórico individual do registro
    insert into public.solicitacao_nota_fiscal_eventos (
      solicitacao_id, situacao_anterior, situacao_nova,
      realizado_por, ocorrido_em, motivo, detalhes
    ) values (
      v_sol.id, v_situacao_anterior, 'pago',
      v_profile_id, now(), v_obs,
      jsonb_build_object(
        'acao', 'pagamento_lote',
        'lote', true,
        'competencia_id', p_competencia_id,
        'competencia', v_ref,
        'data_pagamento', to_char(v_data, 'YYYY-MM-DD'),
        'valor_pago', round(v_sol.valor_total_solicitado, 2),
        'valor_solicitado', round(v_sol.valor_total_solicitado, 2),
        'observacao', v_obs,
        'qtd_atuacoes', v_qtd_itens,
        'atuacoes', v_atuacoes
      )
    );

    -- 5.5) Baixa individual por atuação quando houver saldo autorizado
    --      (se não houver saldo compatível, não é aplicável: nenhum saldo é
    --       alterado e o saldo geral do preceptor permanece intacto)
    for v_calc in
      select c.id, c.total_bruto, c.favorecido_id
        from public.calculos c
       where c.preceptor_id = v_preceptor_id
         and c.competencia_id = p_competencia_id
       order by c.id
    loop
      if v_calc.favorecido_id is not null then
        select s.id into v_saldo_id
          from public.saldos_autorizados s
         where s.favorecido_id = v_calc.favorecido_id
           and s.status = 'ativo'
           and s.data_inicio <= v_comp.data_inicio
           and (s.data_fim is null or s.data_fim >= v_comp.data_fim)
         order by s.data_inicio desc
         limit 1;

        if v_saldo_id is not null then
          insert into public.saldo_movimentos (
            saldo_id, calculo_id, tipo, valor, descricao, realizado_por, created_at
          ) values (
            v_saldo_id, v_calc.id, 'consumo',
            coalesce(v_calc.total_bruto, 0),
            'Baixa de saldo por atuação — pagamento em lote registrado em ' || to_char(v_data, 'YYYY-MM-DD'),
            v_profile_id, now()
          );
          v_movimentos := v_movimentos + 1;
        end if;
      end if;
    end loop;

    v_qtd_pago := v_qtd_pago + 1;
    v_valor_pago_total := v_valor_pago_total + coalesce(v_sol.valor_total_solicitado, 0);

    v_pagos := v_pagos || jsonb_build_array(jsonb_build_object(
      'preceptor_id', v_preceptor_id,
      'preceptor_nome', (
        select nome_completo from public.preceptores where id = v_preceptor_id
      ),
      'solicitacao_id', v_sol.id,
      'situacao_anterior', v_situacao_anterior::text,
      'situacao_nova', 'pago',
      'valor_pago', round(v_sol.valor_total_solicitado, 2),
      'qtd_atuacoes', v_qtd_itens,
      'atuacoes', v_atuacoes
    ));
  end loop;

  return jsonb_build_object(
    'sucesso', true,
    'competencia', jsonb_build_object(
      'id', v_comp.id,
      'ano', v_comp.ano,
      'mes', v_comp.mes,
      'referencia', v_ref
    ),
    'data_pagamento', to_char(v_data, 'YYYY-MM-DD'),
    'responsavel_profile_id', v_profile_id,
    'observacao', v_obs,
    'qtd_processada', v_qtd_pago,
    'valor_total_pago', round(v_valor_pago_total, 2),
    'saldo_movimentos_registrados', v_movimentos,
    'pagos', v_pagos
  );
end;
$function$;

revoke all on function public.executar_pagamento_lote(uuid, uuid[], date, text) from public, anon;
grant execute on function public.executar_pagamento_lote(uuid, uuid[], date, text) to authenticated;

commit;
