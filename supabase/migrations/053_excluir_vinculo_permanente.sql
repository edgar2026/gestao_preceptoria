-- ============================================================
-- Migration 053: Excluir vínculo permanentemente
-- ============================================================
-- Etapa EXCLUIR-VINCULO-PERMANENTEMENTE — Cadastro do Preceptor
--
-- Permite que somente o Administrador exclua permanentemente um
-- vínculo criado incorretamente, para cadastrá-lo novamente.
--
-- A exclusão:
--   - é permanente (não arquiva, não envia para Arquivados);
--   - não altera outros vínculos do preceptor;
--   - não exclui o preceptor;
--   - remove todos os dados dependentes do vínculo.
--
-- Escopo da remoção (somente do vínculo escolhido, todas as competências):
--   - escalas e itens da escala
--   - presenças e ajustes de presença
--   - cálculos e itens de cálculo
--   - revisões financeiras (aprovacoes)
--   - composição fiscal (itens/eventos/solicitações de NF do vínculo)
--   - pagamentos não concluídos e processos de pagamento do vínculo
--   - movimentos de saldo
--   - coordenadores, locais e regra financeira associados ao vínculo
--   - o próprio vínculo
--
-- Regras:
--   - Somente Administrador pode executar
--   - Pagamento concluído bloqueia a exclusão
--   - RPC transacional: qualquer falha gera rollback total
--   - Não executar DELETE direto pelo frontend
--   - Somente ação no cadastro administrativo do preceptor
-- ============================================================

BEGIN;

-- ============================================================
-- 1. RPC: previa_excluir_vinculo (prévia real, não altera nada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.previa_excluir_vinculo(
  p_vinculo_adm_id uuid DEFAULT NULL,
  p_vinculo_internato_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check boolean;
  v_vinculo_id uuid;
  v_preceptor_id uuid;
  v_preceptor_nome text;
  v_vinculo_status public.status_registro;
  v_local_nome text := '-';
  v_setor_nome text := '-';
  v_descricao text := '-';
  v_tipo text;
  v_vinculo_json jsonb;
  v_calc_ids uuid[];
  v_presenca_ids uuid[];
  v_escala_ids uuid[];
  v_sol_ids uuid[];
  v_bloqueio text;
  v_total_escalas int;
  v_total_escalas_itens int;
  v_total_presencas int;
  v_total_ajustes int;
  v_total_calculos int;
  v_total_calculo_itens int;
  v_total_aprovacoes int;
  v_total_solicitacoes int;
  v_total_solicitacoes_itens int;
  v_total_pagamentos int;
  v_total_saldo_movimentos int;
  v_total_coordenadores int;
  v_total_vinculo_locais int;
  v_total_vinculo_regras int;
BEGIN
  -- Somente Administrador
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role, 'admin_super'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente Administradores podem executar esta operação.';
  END IF;

  -- Exatamente um vínculo
  IF (p_vinculo_adm_id IS NULL AND p_vinculo_internato_id IS NULL)
     OR (p_vinculo_adm_id IS NOT NULL AND p_vinculo_internato_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Informe exatamente um vínculo (Prática ou Internato) para excluir.';
  END IF;

  -- Localizar o vínculo (somente leitura)
  IF p_vinculo_internato_id IS NOT NULL THEN
    v_tipo := 'internato';
    SELECT vi.id, vi.preceptor_id, pr.nome_completo, vi.status,
           COALESCE(l.nome, '-'), COALESCE(s.nome, '-'), COALESCE(it.nome, '-')
    INTO v_vinculo_id, v_preceptor_id, v_preceptor_nome, v_vinculo_status,
         v_local_nome, v_setor_nome, v_descricao
    FROM public.vinculos_internato vi
    JOIN public.preceptores pr ON pr.id = vi.preceptor_id
    LEFT JOIN public.locais l ON l.id = vi.local_id
    LEFT JOIN public.setores s ON s.id = vi.setor_id
    LEFT JOIN public.internatos it ON it.id = vi.internato_id
    WHERE vi.id = p_vinculo_internato_id;
  ELSE
    v_tipo := 'adm';
    SELECT va.id, va.preceptor_id, pr.nome_completo, va.status,
           COALESCE(l.nome, '-'), COALESCE(s.nome, '-'), COALESCE(d.nome, '-')
    INTO v_vinculo_id, v_preceptor_id, v_preceptor_nome, v_vinculo_status,
         v_local_nome, v_setor_nome, v_descricao
    FROM public.vinculos_adm va
    JOIN public.preceptores pr ON pr.id = va.preceptor_id
    LEFT JOIN public.locais l ON l.id = va.local_id
    LEFT JOIN public.setores s ON s.id = va.setor_id
    LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
    WHERE va.id = p_vinculo_adm_id;
  END IF;

  IF v_vinculo_id IS NULL THEN
    RAISE EXCEPTION 'Vínculo não encontrado.';
  END IF;

  v_vinculo_json := jsonb_build_object(
    'id', v_vinculo_id,
    'tipo', v_tipo,
    'preceptor_id', v_preceptor_id,
    'preceptor_nome', v_preceptor_nome,
    'status', v_vinculo_status,
    'local_nome', v_local_nome,
    'setor_nome', v_setor_nome,
    'descricao', v_descricao
  );

  -- IDs do escopo real do vínculo (todas as competências)
  SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[])
  INTO v_calc_ids
  FROM public.calculos c
  WHERE (p_vinculo_internato_id IS NOT NULL AND c.vinculo_internato_id = p_vinculo_internato_id)
     OR (p_vinculo_adm_id IS NOT NULL AND c.vinculo_adm_id = p_vinculo_adm_id);

  SELECT COALESCE(array_agg(pr.id), ARRAY[]::uuid[])
  INTO v_presenca_ids
  FROM public.presencas pr
  WHERE (p_vinculo_internato_id IS NOT NULL AND pr.vinculo_internato_id = p_vinculo_internato_id)
     OR (p_vinculo_adm_id IS NOT NULL AND pr.vinculo_adm_id = p_vinculo_adm_id);

  SELECT COALESCE(array_agg(e.id), ARRAY[]::uuid[])
  INTO v_escala_ids
  FROM public.escalas e
  WHERE (p_vinculo_internato_id IS NOT NULL AND e.vinculo_internato_id = p_vinculo_internato_id)
     OR (p_vinculo_adm_id IS NOT NULL AND e.vinculo_adm_id = p_vinculo_adm_id);

  -- Solicitações fiscais ligadas aos cálculos deste vínculo
  SELECT COALESCE(array_agg(DISTINCT s.id), ARRAY[]::uuid[])
  INTO v_sol_ids
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.calculo_id = ANY(v_calc_ids)
     OR EXISTS (
       SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
       WHERE i.solicitacao_id = s.id AND i.calculo_id = ANY(v_calc_ids)
     );

  -- Bloqueio por pagamento concluído (mesma regra do refazer vínculo)
  v_bloqueio := public.fn_refazer_vinculo_bloqueio(v_calc_ids);

  -- Contagens reais (zero dependentes não é erro)
  SELECT count(*) INTO v_total_escalas FROM public.escalas WHERE id = ANY(v_escala_ids);
  SELECT count(*) INTO v_total_escalas_itens FROM public.escalas_itens WHERE escala_id = ANY(v_escala_ids);
  SELECT count(*) INTO v_total_presencas FROM public.presencas WHERE id = ANY(v_presenca_ids);
  SELECT count(*) INTO v_total_ajustes FROM public.ajustes_presenca WHERE presenca_id = ANY(v_presenca_ids);
  SELECT count(*) INTO v_total_calculos FROM public.calculos WHERE id = ANY(v_calc_ids);
  SELECT count(*) INTO v_total_calculo_itens FROM public.calculo_itens WHERE calculo_id = ANY(v_calc_ids);
  SELECT count(*) INTO v_total_aprovacoes FROM public.aprovacoes
    WHERE calculo_id = ANY(v_calc_ids)
       OR ajuste_presenca_id IN (
         SELECT id FROM public.ajustes_presenca WHERE presenca_id = ANY(v_presenca_ids)
       );
  SELECT count(*) INTO v_total_solicitacoes FROM unnest(v_sol_ids);
  SELECT count(*) INTO v_total_solicitacoes_itens
  FROM public.solicitacao_nota_fiscal_itens WHERE calculo_id = ANY(v_calc_ids);
  SELECT count(*) INTO v_total_pagamentos
  FROM public.pagamentos pgto
  WHERE pgto.processo_id IN (
    SELECT pc.processo_id FROM public.processo_calculos pc WHERE pc.calculo_id = ANY(v_calc_ids)
  );
  SELECT count(*) INTO v_total_saldo_movimentos FROM public.saldo_movimentos WHERE calculo_id = ANY(v_calc_ids);

  IF p_vinculo_internato_id IS NOT NULL THEN
    SELECT count(*) INTO v_total_coordenadores
    FROM public.vinculo_coordenadores WHERE vinculo_internato_id = p_vinculo_internato_id;
    SELECT count(*) INTO v_total_vinculo_locais
    FROM public.vinculo_locais WHERE vinculo_internato_id = p_vinculo_internato_id;
    SELECT count(*) INTO v_total_vinculo_regras
    FROM public.vinculo_regras_financeiras WHERE vinculo_internato_id = p_vinculo_internato_id;
  ELSE
    v_total_coordenadores := 0;
    SELECT count(*) INTO v_total_vinculo_locais
    FROM public.vinculo_locais WHERE vinculo_adm_id = p_vinculo_adm_id;
    SELECT count(*) INTO v_total_vinculo_regras
    FROM public.vinculo_regras_financeiras WHERE vinculo_adm_id = p_vinculo_adm_id;
  END IF;

  RETURN jsonb_build_object(
    'vinculo', v_vinculo_json,
    'resumo', jsonb_build_object(
      'total_escalas', v_total_escalas,
      'total_escalas_itens', v_total_escalas_itens,
      'total_presencas', v_total_presencas,
      'total_ajustes_presenca', v_total_ajustes,
      'total_calculos', v_total_calculos,
      'total_calculo_itens', v_total_calculo_itens,
      'total_aprovacoes', v_total_aprovacoes,
      'total_solicitacoes', v_total_solicitacoes,
      'total_solicitacoes_itens', v_total_solicitacoes_itens,
      'total_pagamentos', v_total_pagamentos,
      'total_saldo_movimentos', v_total_saldo_movimentos,
      'total_coordenadores', v_total_coordenadores,
      'total_vinculo_locais', v_total_vinculo_locais,
      'total_vinculo_regras', v_total_vinculo_regras
    ),
    'bloqueado', v_bloqueio IS NOT NULL,
    'motivo_bloqueio', v_bloqueio
  );
END;
$$;

-- ============================================================
-- 2. RPC: excluir_vinculo (exclusão permanente transacional)
-- ============================================================
CREATE OR REPLACE FUNCTION public.excluir_vinculo(
  p_vinculo_adm_id uuid DEFAULT NULL,
  p_vinculo_internato_id uuid DEFAULT NULL,
  p_confirmar boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check boolean;
  v_vinculo_id uuid;
  v_preceptor_id uuid;
  v_preceptor_nome text;
  v_vinculo_status public.status_registro;
  v_local_nome text := '-';
  v_setor_nome text := '-';
  v_descricao text := '-';
  v_tipo text;
  v_vinculo_json jsonb;
  v_calc_ids uuid[];
  v_presenca_ids uuid[];
  v_escala_ids uuid[];
  v_ajuste_ids uuid[];
  v_sol_ids uuid[];
  v_sol_com_itens uuid[];
  v_proc_ids uuid[];
  v_bloqueio text;
  v_sol record;
  v_rest int;
  v_had boolean;
  v_n int;
  v_itens_sol_removidos int := 0;
  v_eventos_removidos int := 0;
  v_sol_removidas int := 0;
  v_sol_atualizadas int := 0;
  v_pagamentos_removidos int := 0;
  v_processo_calculos_removidos int := 0;
  v_processos_removidos int := 0;
  v_saldo_movimentos_removidos int := 0;
  v_aprovacoes_removidas int := 0;
  v_calculo_itens_removidos int := 0;
  v_calculos_removidos int := 0;
  v_ajustes_removidos int := 0;
  v_presencas_removidas int := 0;
  v_escalas_itens_removidos int := 0;
  v_escalas_removidas int := 0;
  v_coordenadores_removidos int := 0;
  v_locais_removidos int := 0;
  v_regras_removidas int := 0;
  v_vinculo_removido int := 0;
  v_resumo jsonb;
BEGIN
  -- Somente Administrador
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role, 'admin_super'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente Administradores podem executar esta operação.';
  END IF;

  -- Exatamente um vínculo
  IF (p_vinculo_adm_id IS NULL AND p_vinculo_internato_id IS NULL)
     OR (p_vinculo_adm_id IS NOT NULL AND p_vinculo_internato_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Informe exatamente um vínculo (Prática ou Internato) para excluir.';
  END IF;

  IF p_confirmar IS NOT TRUE THEN
    RAISE EXCEPTION 'Operação não confirmada. Exibir a prévia e passe p_confirmar = TRUE.';
  END IF;

  -- Localizar o vínculo (somente leitura — a exclusão ocorre no final)
  IF p_vinculo_internato_id IS NOT NULL THEN
    v_tipo := 'internato';
    SELECT vi.id, vi.preceptor_id, pr.nome_completo, vi.status,
           COALESCE(l.nome, '-'), COALESCE(s.nome, '-'), COALESCE(it.nome, '-')
    INTO v_vinculo_id, v_preceptor_id, v_preceptor_nome, v_vinculo_status,
         v_local_nome, v_setor_nome, v_descricao
    FROM public.vinculos_internato vi
    JOIN public.preceptores pr ON pr.id = vi.preceptor_id
    LEFT JOIN public.locais l ON l.id = vi.local_id
    LEFT JOIN public.setores s ON s.id = vi.setor_id
    LEFT JOIN public.internatos it ON it.id = vi.internato_id
    WHERE vi.id = p_vinculo_internato_id;
  ELSE
    v_tipo := 'adm';
    SELECT va.id, va.preceptor_id, pr.nome_completo, va.status,
           COALESCE(l.nome, '-'), COALESCE(s.nome, '-'), COALESCE(d.nome, '-')
    INTO v_vinculo_id, v_preceptor_id, v_preceptor_nome, v_vinculo_status,
         v_local_nome, v_setor_nome, v_descricao
    FROM public.vinculos_adm va
    JOIN public.preceptores pr ON pr.id = va.preceptor_id
    LEFT JOIN public.locais l ON l.id = va.local_id
    LEFT JOIN public.setores s ON s.id = va.setor_id
    LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
    WHERE va.id = p_vinculo_adm_id;
  END IF;

  IF v_vinculo_id IS NULL THEN
    RAISE EXCEPTION 'Vínculo não encontrado.';
  END IF;

  v_vinculo_json := jsonb_build_object(
    'id', v_vinculo_id,
    'tipo', v_tipo,
    'preceptor_id', v_preceptor_id,
    'preceptor_nome', v_preceptor_nome,
    'status', v_vinculo_status,
    'local_nome', v_local_nome,
    'setor_nome', v_setor_nome,
    'descricao', v_descricao
  );

  -- IDs do escopo real do vínculo
  SELECT COALESCE(array_agg(c.id), ARRAY[]::uuid[])
  INTO v_calc_ids
  FROM public.calculos c
  WHERE (p_vinculo_internato_id IS NOT NULL AND c.vinculo_internato_id = p_vinculo_internato_id)
     OR (p_vinculo_adm_id IS NOT NULL AND c.vinculo_adm_id = p_vinculo_adm_id);

  SELECT COALESCE(array_agg(pr.id), ARRAY[]::uuid[])
  INTO v_presenca_ids
  FROM public.presencas pr
  WHERE (p_vinculo_internato_id IS NOT NULL AND pr.vinculo_internato_id = p_vinculo_internato_id)
     OR (p_vinculo_adm_id IS NOT NULL AND pr.vinculo_adm_id = p_vinculo_adm_id);

  SELECT COALESCE(array_agg(e.id), ARRAY[]::uuid[])
  INTO v_escala_ids
  FROM public.escalas e
  WHERE (p_vinculo_internato_id IS NOT NULL AND e.vinculo_internato_id = p_vinculo_internato_id)
     OR (p_vinculo_adm_id IS NOT NULL AND e.vinculo_adm_id = p_vinculo_adm_id);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_ajuste_ids
  FROM public.ajustes_presenca
  WHERE presenca_id = ANY(v_presenca_ids);

  SELECT COALESCE(array_agg(DISTINCT s.id), ARRAY[]::uuid[])
  INTO v_sol_ids
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.calculo_id = ANY(v_calc_ids)
     OR EXISTS (
       SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
       WHERE i.solicitacao_id = s.id AND i.calculo_id = ANY(v_calc_ids)
     );

  SELECT COALESCE(array_agg(DISTINCT i.solicitacao_id), ARRAY[]::uuid[])
  INTO v_sol_com_itens
  FROM public.solicitacao_nota_fiscal_itens i
  WHERE i.calculo_id = ANY(v_calc_ids);

  SELECT COALESCE(array_agg(DISTINCT pp.id), ARRAY[]::uuid[])
  INTO v_proc_ids
  FROM public.processos_pagamento pp
  JOIN public.processo_calculos pc ON pc.processo_id = pp.id
  WHERE pc.calculo_id = ANY(v_calc_ids);

  -- Bloqueio por pagamento concluído (aborta a transação inteira)
  v_bloqueio := public.fn_refazer_vinculo_bloqueio(v_calc_ids);
  IF v_bloqueio IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bloqueio;
  END IF;

  -- ============================================================
  -- EXCLUSÃO TRANSACIONAL (qualquer falha → rollback total)
  -- ============================================================

  -- 1. Composição fiscal: itens da solicitação deste vínculo
  DELETE FROM public.solicitacao_nota_fiscal_itens i
  WHERE i.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_itens_sol_removidos = ROW_COUNT;

  -- 2. Eventos de NF atrelados aos cálculos deste vínculo
  DELETE FROM public.solicitacao_nota_fiscal_eventos e
  WHERE e.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_eventos_removidos = ROW_COUNT;

  -- 3. Solicitações inteiras (sem itens de outros vínculos) e
  --    desacoplamento/preparação nas compartilhadas
  FOR v_sol IN
    SELECT s.id, s.calculo_id
    FROM public.solicitacoes_nota_fiscal s
    WHERE s.id = ANY(v_sol_ids)
  LOOP
    SELECT count(*) INTO v_rest
    FROM public.solicitacao_nota_fiscal_itens i
    WHERE i.solicitacao_id = v_sol.id;

    IF v_rest = 0 THEN
      SELECT count(*) INTO v_n
      FROM public.solicitacao_nota_fiscal_eventos e
      WHERE e.solicitacao_id = v_sol.id;
      v_eventos_removidos := v_eventos_removidos + v_n;

      DELETE FROM public.solicitacoes_nota_fiscal s
      WHERE s.id = v_sol.id;
      v_sol_removidas := v_sol_removidas + 1;
    ELSE
      v_had := v_sol.id = ANY(v_sol_com_itens);

      -- Preserva a solicitação de outros vínculos, mas desacopla
      -- o cálculo legado deste vínculo (evita cascade indevido)
      IF v_sol.calculo_id = ANY(v_calc_ids) THEN
        UPDATE public.solicitacoes_nota_fiscal s
        SET calculo_id = (
              SELECT i.calculo_id
              FROM public.solicitacao_nota_fiscal_itens i
              WHERE i.solicitacao_id = v_sol.id
              ORDER BY i.id
              LIMIT 1
            ),
            updated_at = now()
        WHERE s.id = v_sol.id;
      END IF;

      IF v_had THEN
        -- Recalcula a composição restante e limpa preparação obsoleta
        UPDATE public.solicitacoes_nota_fiscal s
        SET valor_total_solicitado = COALESCE(
              (SELECT sum(i.valor_atuacao)
               FROM public.solicitacao_nota_fiscal_itens i
               WHERE i.solicitacao_id = v_sol.id), 0),
            qtd_atuacoes = (
              SELECT count(*)
              FROM public.solicitacao_nota_fiscal_itens i
              WHERE i.solicitacao_id = v_sol.id),
            assunto = NULL,
            corpo = NULL,
            demonstrativo_nome = NULL,
            preparado_por = NULL,
            preparado_em = NULL,
            updated_at = now()
        WHERE s.id = v_sol.id;
        v_sol_atualizadas := v_sol_atualizadas + 1;
      END IF;
    END IF;
  END LOOP;

  -- 4. Pagamentos ainda não concluídos do vínculo
  DELETE FROM public.pagamentos pgto
  WHERE pgto.processo_id = ANY(v_proc_ids)
    AND pgto.status <> 'pago';
  GET DIAGNOSTICS v_pagamentos_removidos = ROW_COUNT;

  -- 5. Alocações processo ↔ cálculo
  DELETE FROM public.processo_calculos pc
  WHERE pc.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_processo_calculos_removidos = ROW_COUNT;

  -- 6. Processos que ficaram vazios (somente os do vínculo)
  DELETE FROM public.processos_pagamento pp
  WHERE pp.id = ANY(v_proc_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.processo_calculos pc WHERE pc.processo_id = pp.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pagamentos pgto WHERE pgto.processo_id = pp.id
    );
  GET DIAGNOSTICS v_processos_removidos = ROW_COUNT;

  -- 7. Movimentos de saldo dos cálculos removidos
  DELETE FROM public.saldo_movimentos sm
  WHERE sm.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_saldo_movimentos_removidos = ROW_COUNT;

  -- 8. Revisões financeiras
  DELETE FROM public.aprovacoes a
  WHERE a.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_aprovacoes_removidas = ROW_COUNT;

  DELETE FROM public.aprovacoes a
  WHERE a.ajuste_presenca_id = ANY(v_ajuste_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_aprovacoes_removidas := v_aprovacoes_removidas + v_n;

  -- 9. Itens de cálculo
  DELETE FROM public.calculo_itens ci
  WHERE ci.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_calculo_itens_removidos = ROW_COUNT;

  -- 10. Cálculos
  DELETE FROM public.calculos c
  WHERE c.id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_calculos_removidos = ROW_COUNT;

  -- 11. Ajustes de presença
  DELETE FROM public.ajustes_presenca ap
  WHERE ap.id = ANY(v_ajuste_ids);
  GET DIAGNOSTICS v_ajustes_removidos = ROW_COUNT;

  -- 12. Presenças
  DELETE FROM public.presencas pr
  WHERE pr.id = ANY(v_presenca_ids);
  GET DIAGNOSTICS v_presencas_removidas = ROW_COUNT;

  -- 13. Escalas e itens da escala (cascata)
  SELECT count(*) INTO v_escalas_itens_removidos
  FROM public.escalas_itens ei
  WHERE ei.escala_id = ANY(v_escala_ids);

  DELETE FROM public.escalas e
  WHERE e.id = ANY(v_escala_ids);
  GET DIAGNOSTICS v_escalas_removidas = ROW_COUNT;

  -- 14. Coordenadores associados ao vínculo
  IF p_vinculo_internato_id IS NOT NULL THEN
    DELETE FROM public.vinculo_coordenadores vc
    WHERE vc.vinculo_internato_id = p_vinculo_internato_id;
    GET DIAGNOSTICS v_coordenadores_removidos = ROW_COUNT;
  END IF;

  -- 15. Locais do vínculo
  IF p_vinculo_internato_id IS NOT NULL THEN
    DELETE FROM public.vinculo_locais vl
    WHERE vl.vinculo_internato_id = p_vinculo_internato_id;
  ELSE
    DELETE FROM public.vinculo_locais vl
    WHERE vl.vinculo_adm_id = p_vinculo_adm_id;
  END IF;
  GET DIAGNOSTICS v_locais_removidos = ROW_COUNT;

  -- 16. Regra financeira do vínculo
  IF p_vinculo_internato_id IS NOT NULL THEN
    DELETE FROM public.vinculo_regras_financeiras vrf
    WHERE vrf.vinculo_internato_id = p_vinculo_internato_id;
  ELSE
    DELETE FROM public.vinculo_regras_financeiras vrf
    WHERE vrf.vinculo_adm_id = p_vinculo_adm_id;
  END IF;
  GET DIAGNOSTICS v_regras_removidas = ROW_COUNT;

  -- 17. O próprio vínculo (permanente — não é arquivamento)
  IF p_vinculo_internato_id IS NOT NULL THEN
    DELETE FROM public.vinculos_internato vi
    WHERE vi.id = p_vinculo_internato_id;
  ELSE
    DELETE FROM public.vinculos_adm va
    WHERE va.id = p_vinculo_adm_id;
  END IF;
  GET DIAGNOSTICS v_vinculo_removido = ROW_COUNT;

  v_resumo := jsonb_build_object(
    'escalas_removidas', v_escalas_removidas,
    'escalas_itens_removidos', v_escalas_itens_removidos,
    'presencas_removidas', v_presencas_removidas,
    'ajustes_presenca_removidos', v_ajustes_removidos,
    'calculos_removidos', v_calculos_removidos,
    'calculo_itens_removidos', v_calculo_itens_removidos,
    'aprovacoes_removidas', v_aprovacoes_removidas,
    'solicitacoes_itens_removidos', v_itens_sol_removidos,
    'solicitacoes_removidas', v_sol_removidas,
    'solicitacoes_atualizadas', v_sol_atualizadas,
    'eventos_nf_removidos', v_eventos_removidos,
    'pagamentos_removidos', v_pagamentos_removidos,
    'processo_calculos_removidos', v_processo_calculos_removidos,
    'processos_removidos', v_processos_removidos,
    'saldo_movimentos_removidos', v_saldo_movimentos_removidos,
    'coordenadores_removidos', v_coordenadores_removidos,
    'vinculo_locais_removidos', v_locais_removidos,
    'vinculo_regras_removidas', v_regras_removidas,
    'vinculo_removido', v_vinculo_removido
  );

  -- Registro de auditoria da operação (o cadastro do preceptor permanece)
  INSERT INTO public.audit_logs (
    tabela, registro_id, operacao, dados_anteriores, dados_novos,
    profile_id, user_id, ocorrido_em
  ) VALUES (
    CASE WHEN p_vinculo_internato_id IS NOT NULL THEN 'vinculos_internato' ELSE 'vinculos_adm' END,
    v_vinculo_id::text,
    'DELETE',
    v_vinculo_json,
    jsonb_build_object('acao', 'excluir_vinculo', 'vinculo', v_vinculo_json, 'resumo', v_resumo),
    public.current_profile_id(),
    auth.uid(),
    now()
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Vínculo excluído permanentemente.',
    'vinculo', v_vinculo_json,
    'resumo', v_resumo
  );
END;
$$;

-- ============================================================
-- Permissões: somente authenticated (admin check é interno)
-- ============================================================
REVOKE ALL ON FUNCTION public.previa_excluir_vinculo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.previa_excluir_vinculo(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_vinculo(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_vinculo(uuid, uuid, boolean) TO authenticated;

COMMIT;
