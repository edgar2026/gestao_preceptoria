-- Etapa ESCALA-COM-SETOR-VARIAVEL
-- Objetivo: o setor da escala varia por item (data + turno) e a PRESENCA
-- recupera o setor automaticamente da escala correspondente.
--
-- Regras preservadas:
--   * Local continua pertencendo ao vinculo (vinculo_locais.local_id).
--   * Setor do vinculo (vinculo_locais.setor_id) permanece como FALLBACK legado
--     para itens de escalas antigas sem setor proprio (setor_id NULL).
--   * Nenhum valor financeiro, saldo, calculo, memoria, PDF, e-mail ou
--     pagamento e alterado. regras_financeiras.setor_id permanece sem uso
--     (nenhuma regra ativa possui setor), portanto a troca de origem do
--     setor da presenca nao afeta calculos.
--   * Ausencia de duplicidade: presencas continuam unicas por preceptor +
--     vinculo + data + turno; nada e duplicado por setor.
--   * RLS, triggers e auditoria inalterados.
--
-- Alteracoes:
--   1) salvar_escala_completa: nova escala exige setor em todo item;
--      edicao so permite setor ausente se o item (data,turno) ja existia
--      sem setor (preserva itens legados nao modificados).
--   2) registrar_presenca_coordenador: setor vem do item da escala
--      (escala_id + data + turno), com fallback para o setor legado.
--   3) registrar_presenca_token: localiza o item por data = current_date
--      (alinhado a buscar_escalas_token) e grava setor do item com fallback.
--   4) fetch_preceptores_com_escala_no_dia: setor exibido vem dos itens da
--      data (agregado), com fallback para o setor legado do vinculo.
--   5) buscar_escalas_token: setor exibido vem do item, com fallback legado.

-- ------------------------------------------------------------
-- 1) salvar_escala_completa: exigencia de setor por item
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_escala_completa(
  p_tipo_atuacao tipo_atuacao,
  p_vinculo_local_id uuid,
  p_data_inicio date,
  p_itens jsonb,
  p_escala_id uuid DEFAULT NULL::uuid,
  p_vinculo_adm_id uuid DEFAULT NULL::uuid,
  p_vinculo_internato_id uuid DEFAULT NULL::uuid,
  p_data_fim date DEFAULT NULL::date,
  p_status status_registro DEFAULT 'ativo'::status_registro
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escala_id UUID;
  v_item JSONB;
  v_data DATE;
  v_preceptor UUID;
  v_conflito JSONB;
  v_setor_id UUID;
BEGIN
  IF jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Adicione pelo menos um dia e turno.');
  END IF;

  IF p_tipo_atuacao = 'adm' AND (p_vinculo_adm_id IS NULL OR p_vinculo_internato_id IS NOT NULL) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo pratica invalido.');
  END IF;
  IF p_tipo_atuacao = 'internato' AND (p_vinculo_internato_id IS NULL OR p_vinculo_adm_id IS NOT NULL) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo internato invalido.');
  END IF;

  IF p_data_fim IS NOT NULL AND p_data_fim < p_data_inicio THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Data final deve ser posterior ou igual a data inicial.');
  END IF;

  -- Validar vigencia do vinculo pratica
  IF p_tipo_atuacao = 'adm' AND p_vinculo_adm_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vinculos_adm va
      WHERE va.id = p_vinculo_adm_id AND va.status = 'ativo'
        AND va.data_inicio <= p_data_inicio
        AND (va.data_fim IS NULL OR va.data_fim >= p_data_inicio)
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo pratica fora da vigencia ou inativo.');
    END IF;
  END IF;

  -- Validar vigencia do vinculo internato
  IF p_tipo_atuacao = 'internato' AND p_vinculo_internato_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = p_vinculo_internato_id AND vi.status = 'ativo'
        AND vi.data_inicio <= p_data_inicio
        AND (vi.data_fim IS NULL OR vi.data_fim >= p_data_inicio)
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo internato fora da vigencia ou inativo.');
    END IF;
  END IF;

  -- Validar regra pratica: sem sabados ou domingos e datas dentro da vigencia
  IF p_tipo_atuacao = 'adm' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_data := (v_item->>'data')::date;
      IF extract(dow from v_data) IN (0, 6) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala pratica nao pode incluir sabados ou domingos.');
      END IF;
    END LOOP;
  END IF;

  v_preceptor := coalesce(
    (SELECT va.preceptor_id FROM public.vinculos_adm va WHERE va.id = p_vinculo_adm_id),
    (SELECT vi.preceptor_id FROM public.vinculos_internato vi WHERE vi.id = p_vinculo_internato_id)
  );

  -- Validar vigencia dos itens, CONFLITO POR PRECEPTOR, setor obrigatorio
  -- em escala nova e setor do cadastro (nunca texto livre).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_data := (v_item->>'data')::date;
    IF v_data < p_data_inicio OR (p_data_fim IS NOT NULL AND v_data > p_data_fim) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Item de escala fora da vigencia informada.');
    END IF;

    -- Setor do item: somente setores já cadastrados (nunca criar por texto livre).
    v_setor_id := NULL;
    IF nullif(btrim(coalesce(v_item->>'setor_id', '')), '') IS NOT NULL THEN
      BEGIN
        v_setor_id := (v_item->>'setor_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Setor invalido. Selecione um setor cadastrado.');
      END;
      IF NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = v_setor_id) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Setor nao encontrado no cadastro. Selecione um setor cadastrado.');
      END IF;
    END IF;

    -- Regra da etapa: NOVA escala exige setor em todo item.
    IF p_escala_id IS NULL AND v_setor_id IS NULL THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Toda nova escala exige o setor em cada item.');
    END IF;

    -- EDICAO: so permite item sem setor se ele ja existia antes sem setor
    -- (item legado preservado). Item novo sem setor e bloqueado.
    IF p_escala_id IS NOT NULL AND v_setor_id IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        WHERE ei.escala_id = p_escala_id
          AND ei.data = v_data
          AND ei.turno = (v_item->>'turno')::public.turno
          AND ei.setor_id IS NULL
      ) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Selecione o setor para todos os itens da escala.');
      END IF;
    END IF;

    IF p_status = 'ativo' THEN
      v_conflito := public.fn_avaliar_conflito_escala(
        v_preceptor, p_escala_id, v_data, (v_item->>'turno')::public.turno, 1);
      IF v_conflito IS NOT NULL THEN
        RETURN jsonb_build_object(
          'sucesso', false,
          'conflito', true,
          'erro', public.fn_mensagem_conflito_escala(
                    v_conflito,
                    'Conflito de horário',
                    'Escolha outra data, outro turno ou outro preceptor.')
        );
      END IF;
    END IF;
  END LOOP;

  -- Inserir ou atualizar escala pai.
  -- Os itens são removidos ANTES da atualização para que a trigger
  -- de reativação valide os itens novos (e não os antigos).
  IF p_escala_id IS NOT NULL THEN
    v_escala_id := p_escala_id;
    DELETE FROM public.escalas_itens WHERE escala_id = v_escala_id;
    UPDATE public.escalas SET
      tipo_atuacao = p_tipo_atuacao,
      vinculo_adm_id = p_vinculo_adm_id,
      vinculo_internato_id = p_vinculo_internato_id,
      vinculo_local_id = p_vinculo_local_id,
      data_inicio = p_data_inicio,
      data_fim = p_data_fim,
      status = p_status,
      updated_at = now()
    WHERE id = v_escala_id;
  ELSE
    INSERT INTO public.escalas (
      tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id,
      data_inicio, data_fim, status
    ) VALUES (
      p_tipo_atuacao, p_vinculo_adm_id, p_vinculo_internato_id, p_vinculo_local_id,
      p_data_inicio, p_data_fim, p_status
    ) RETURNING id INTO v_escala_id;
  END IF;

  -- Inserir itens (data + turno + setor proprio)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_setor_id := NULL;
    IF nullif(btrim(coalesce(v_item->>'setor_id', '')), '') IS NOT NULL THEN
      v_setor_id := (v_item->>'setor_id')::uuid;
    END IF;

    INSERT INTO public.escalas_itens (escala_id, data, turno, setor_id)
    VALUES (
      v_escala_id,
      (v_item->>'data')::date,
      (v_item->>'turno')::public.turno,
      v_setor_id
    );
  END LOOP;

  RETURN jsonb_build_object('sucesso', true, 'escala_id', v_escala_id);
END;
$function$;

-- ------------------------------------------------------------
-- 2) registrar_presenca_coordenador: setor automatico da escala
--    (item escala_id + data + turno), fallback setor legado do vinculo.
--    Local continua do vinculo. Nenhuma alteracao de duplicidade,
--    conflito ou financeiro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_presenca_coordenador(
  p_escala_id uuid,
  p_preceptor_id uuid,
  p_data date,
  p_turnos jsonb,
  p_registrado_por uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tipo_atuacao public.tipo_atuacao;
  v_vinculo_adm_id uuid;
  v_vinculo_internato_id uuid;
  v_vinculo_local_id uuid;
  v_local_id uuid;
  v_setor_id uuid;
  v_setor_item uuid;
  v_registrado_por uuid;
  v_turno_text text;
  v_turno public.turno;
  v_vinculo_ok boolean;
  v_exists boolean;
  v_inseridos int := 0;
  v_duplicados int := 0;
  v_conflito jsonb;
BEGIN
  IF p_escala_id IS NULL OR p_preceptor_id IS NULL OR p_data IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Parametros obrigatorios ausentes.');
  END IF;

  IF p_turnos IS NULL OR jsonb_array_length(p_turnos) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Selecione pelo menos um turno.');
  END IF;

  SELECT id INTO v_registrado_por FROM public.profiles WHERE id = p_registrado_por LIMIT 1;
  IF v_registrado_por IS NULL THEN
    SELECT id INTO v_registrado_por FROM public.profiles LIMIT 1;
  END IF;

  SELECT tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id
  INTO v_tipo_atuacao, v_vinculo_adm_id, v_vinculo_internato_id, v_vinculo_local_id
  FROM public.escalas WHERE id = p_escala_id;

  IF v_vinculo_local_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao encontrada.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.escalas e
    WHERE e.id = p_escala_id AND e.status = 'ativo'
      AND e.data_inicio <= p_data
      AND coalesce(e.data_fim, '9999-12-31'::date) >= p_data
      AND EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id
          AND (ei.data = p_data OR ei.dia_semana = EXTRACT(DOW FROM p_data)::smallint)
      )
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala inativa ou sem vigencia na data informada.');
  END IF;

  v_vinculo_ok := false;
  IF v_tipo_atuacao = 'internato' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = v_vinculo_internato_id AND vi.status = 'ativo'
        AND vi.preceptor_id = p_preceptor_id
        AND coalesce(vi.data_inicio, '1900-01-01'::date) <= p_data
        AND coalesce(vi.data_fim, '9999-12-31'::date) >= p_data
    ) INTO v_vinculo_ok;
    IF NOT v_vinculo_ok THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo de Internato inativo ou sem vigencia na data.');
    END IF;
  ELSIF v_tipo_atuacao = 'adm' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vinculos_adm va
      WHERE va.id = v_vinculo_adm_id AND va.status = 'ativo'
        AND va.preceptor_id = p_preceptor_id
        AND coalesce(va.data_inicio, '1900-01-01'::date) <= p_data
        AND coalesce(va.data_fim, '9999-12-31'::date) >= p_data
    ) INTO v_vinculo_ok;
    IF NOT v_vinculo_ok THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo de Pratica inativo ou sem vigencia na data.');
    END IF;
  END IF;

  -- Segurança: presença não é confirmada quando existem escalas
  -- conflitantes para o mesmo preceptor, data e turno.
  -- Todos os turnos são validados ANTES de gravar qualquer linha.
  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos) LOOP
    v_turno := v_turno_text::public.turno;
    v_conflito := public.fn_avaliar_conflito_escala(p_preceptor_id, p_escala_id, p_data, v_turno, 1);
    IF v_conflito IS NOT NULL THEN
      RETURN jsonb_build_object(
        'sucesso', false,
        'conflito_escala', true,
        'erro', public.fn_mensagem_conflito_escala(
                  v_conflito,
                  'Conflito de escala',
                  'Não foi possível registrar a presença. Procure o Administrador para corrigir o vínculo incorreto.')
      );
    END IF;
  END LOOP;

  -- Local pertence ao vinculo; setor legado do vinculo e so fallback.
  SELECT local_id, setor_id INTO v_local_id, v_setor_id
  FROM public.vinculo_locais WHERE id = v_vinculo_local_id;

  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos) LOOP
    v_turno := v_turno_text::public.turno;

    -- Setor da presenca vem do ITEM da escala (data + turno),
    -- com fallback para o setor legado do vinculo.
    SELECT ei.setor_id INTO v_setor_item
    FROM public.escalas_itens ei
    WHERE ei.escala_id = p_escala_id
      AND ei.data = p_data
      AND ei.turno = v_turno
    LIMIT 1;

    -- Bloqueio por vinculo+data+turno (nao por escala)
    SELECT EXISTS (
      SELECT 1 FROM public.presencas
      WHERE preceptor_id = p_preceptor_id
        AND data_presenca = p_data AND turno = v_turno
        AND status != 'cancelada'
        AND (
          (v_tipo_atuacao = 'internato' AND vinculo_internato_id = v_vinculo_internato_id)
          OR (v_tipo_atuacao = 'adm' AND vinculo_adm_id = v_vinculo_adm_id)
        )
    ) INTO v_exists;

    IF v_exists THEN
      v_duplicados := v_duplicados + 1;
    ELSE
      INSERT INTO public.presencas (
        preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
        local_id, setor_id, data_presenca, turno, status, origem, registrado_por, registrado_em
      ) VALUES (
        p_preceptor_id, p_escala_id, v_tipo_atuacao, v_vinculo_adm_id, v_vinculo_internato_id,
        v_local_id, coalesce(v_setor_item, v_setor_id), p_data, v_turno, 'confirmada', 'coordenador', v_registrado_por, now()
      );
      v_inseridos := v_inseridos + 1;
    END IF;
  END LOOP;

  IF v_inseridos = 0 AND v_duplicados > 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada anteriormente para este(s) turno(s).');
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'inseridos', v_inseridos, 'duplicados', v_duplicados);
END;
$fn$;

-- ------------------------------------------------------------
-- 3) registrar_presenca_token (rota /p/:token)
--    Localiza o item por data = current_date (mesmo criterio de
--    buscar_escalas_token) e grava o setor do item com fallback legado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_presenca_token(
  p_token text,
  p_escala_id uuid,
  p_turno turno
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
  v_escala public.escalas%rowtype;
  v_escala_item public.escalas_itens%rowtype;
  v_local public.vinculo_locais%rowtype;
  v_id uuid;
  v_registrado_por uuid;
  v_conflito jsonb;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE token_hash = v_hash AND ativo = true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso invalido.'); END IF;
  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso expirado.'); END IF;

  SELECT * INTO v_preceptor FROM public.preceptores WHERE id = v_acesso.preceptor_id AND status = 'ativo';
  IF v_preceptor.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Preceptor inativo.'); END IF;

  SELECT * INTO v_escala FROM public.escalas WHERE id = p_escala_id AND status = 'ativo';
  IF v_escala.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala invalida.'); END IF;

  SELECT * INTO v_escala_item
  FROM public.escalas_itens
  WHERE escala_id = p_escala_id AND turno = p_turno AND data = current_date;

  IF v_escala_item.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao possui turno para o dia atual.');
  END IF;

  IF extract(dow from current_date)::smallint <> v_escala_item.dia_semana THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
  END IF;
  IF current_date NOT BETWEEN v_escala.data_inicio AND coalesce(v_escala.data_fim, current_date) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  END IF;

  IF v_escala.tipo_atuacao = 'adm' AND NOT EXISTS(SELECT 1 FROM public.vinculos_adm v WHERE v.id = v_escala.vinculo_adm_id AND v.preceptor_id = v_preceptor.id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;
  IF v_escala.tipo_atuacao = 'internato' AND NOT EXISTS(SELECT 1 FROM public.vinculos_internato v WHERE v.id = v_escala.vinculo_internato_id AND v.preceptor_id = v_preceptor.id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  SELECT * INTO v_local FROM public.vinculo_locais WHERE id = v_escala.vinculo_local_id;
  IF v_local.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Local da escala invalido.');
  END IF;

  -- Segurança: presença não confirmada com escalas conflitantes
  v_conflito := public.fn_avaliar_conflito_escala(v_preceptor.id, v_escala.id, current_date, p_turno, 1);
  IF v_conflito IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'conflito_escala', true,
      'erro', public.fn_mensagem_conflito_escala(
                v_conflito,
                'Conflito de escala',
                'Não foi possível registrar a presença. Procure o Administrador para corrigir o vínculo incorreto.')
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.presencas p
    WHERE p.preceptor_id = v_preceptor.id
      AND p.escala_id = v_escala.id
      AND p.turno = p_turno
      AND p.data_presenca = current_date
      AND p.status IN ('confirmada','ajustada')
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno.');
  END IF;

  -- Correcao de bug pre-existente (017/061): preceptor_acesso_presenca
  -- nao possui coluna profile_id, o SELECT anterior falhava em runtime.
  v_registrado_por := v_preceptor.profile_id;

  -- Setor vem do item da escala; local continua do vinculo.
  INSERT INTO public.presencas (
    preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id, data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao,
    v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, coalesce(v_escala_item.setor_id, v_local.setor_id),
    current_date, p_turno, 'confirmada', 'preceptor',
    v_registrado_por
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$fn$;

-- ------------------------------------------------------------
-- 4) fetch_preceptores_com_escala_no_dia: setor exibido vem dos itens
--    da data (agregado distinct), com fallback para o setor legado.
--    Escopo do coordenador (get_coordinator_vinculo_ids) inalterado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_preceptores_com_escala_no_dia(p_data date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resultado JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'escala_id', sub.escala_id,
      'preceptor_id', sub.preceptor_id,
      'preceptor_nome', sub.preceptor_nome,
      'tipo_atuacao', sub.tipo_atuacao,
      'modalidade_label', CASE WHEN sub.tipo_atuacao = 'adm' THEN 'Prática' ELSE 'Internato' END,
      'vinculo_adm_id', sub.vinculo_adm_id,
      'vinculo_internato_id', sub.vinculo_internato_id,
      'local_id', sub.local_id,
      'setor_id', sub.setor_id,
      'local_nome', sub.local_nome,
      'setor_nome', sub.setor_nome,
      'turnos_previstos', sub.turnos_previstos,
      'turnos_ja_registrados', sub.turnos_ja_registrados
    )
  ) INTO v_resultado
  FROM (
    SELECT
      e.id AS escala_id,
      p.id AS preceptor_id,
      p.nome_completo AS preceptor_nome,
      e.tipo_atuacao,
      e.vinculo_adm_id,
      e.vinculo_internato_id,
      vl.local_id,
      coalesce(
        (
          SELECT ei.setor_id FROM public.escalas_itens ei
          WHERE ei.escala_id = e.id AND ei.data = p_data AND ei.setor_id IS NOT NULL
          ORDER BY ei.turno
          LIMIT 1
        ),
        vl.setor_id
      ) AS setor_id,
      coalesce(loc.nome, '-') AS local_nome,
      coalesce(
        (
          SELECT string_agg(DISTINCT s_item.nome, ', ' ORDER BY s_item.nome)
          FROM public.escalas_itens ei2
          JOIN public.setores s_item ON s_item.id = ei2.setor_id
          WHERE ei2.escala_id = e.id AND ei2.data = p_data
        ),
        coalesce(set.nome, '-')
      ) AS setor_nome,
      (
        SELECT jsonb_agg(DISTINCT ei.turno)
        FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id AND ei.data = p_data
      ) AS turnos_previstos,
      (
        SELECT coalesce(jsonb_agg(DISTINCT pr.turno), '[]'::jsonb)
        FROM public.presencas pr
        WHERE pr.escala_id = e.id AND pr.preceptor_id = p.id AND pr.data_presenca = p_data AND pr.status != 'cancelada'
      ) AS turnos_ja_registrados
    FROM public.escalas e
    JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
    LEFT JOIN public.locais loc ON loc.id = vl.local_id
    LEFT JOIN public.setores set ON set.id = vl.setor_id
    LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
    LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
    LEFT JOIN public.preceptores p ON p.id = coalesce(va.preceptor_id, vi.preceptor_id)
    WHERE e.status = 'ativo'
      AND EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id AND ei.data = p_data
      )
      AND (
        public.has_role(ARRAY['admin','coordenacao']::public.app_role[])
        OR NOT public.has_role(ARRAY['coordenador']::public.app_role[])
        OR e.vinculo_internato_id = ANY (public.get_coordinator_vinculo_ids())
      )
    ORDER BY p.nome_completo
  ) sub;

  RETURN coalesce(v_resultado, '[]'::jsonb);
END;
$function$;

-- ------------------------------------------------------------
-- 5) buscar_escalas_token: setor exibido vem do item (data = hoje),
--    com fallback para o setor legado do vinculo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_escalas_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_rec record;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE token_hash = v_hash AND ativo = true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN RETURN v_result; END IF;
  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN RETURN v_result; END IF;

  FOR v_rec IN
    SELECT
      e.id as escala_id, ei.id as escala_item_id,
      e.tipo_atuacao, ei.turno, e.hora_inicio, e.hora_fim, ei.data,
      CASE WHEN e.tipo_atuacao = 'adm' THEN d.nome ELSE i.nome END as atividade_nome,
      l.nome as local_nome, coalesce(s_item.nome, s.nome, '-') as setor_nome,
      CASE WHEN e.tipo_atuacao = 'adm' THEN e.vinculo_adm_id ELSE e.vinculo_internato_id END as vinculo_id,
      vl.local_id, coalesce(ei.setor_id, vl.setor_id) as setor_id
    FROM public.escalas_itens ei
    JOIN public.escalas e ON e.id = ei.escala_id
    LEFT JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
    LEFT JOIN public.locais l ON l.id = vl.local_id
    LEFT JOIN public.setores s ON s.id = vl.setor_id
    LEFT JOIN public.setores s_item ON s_item.id = ei.setor_id
    LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
    LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
    LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
    LEFT JOIN public.internatos i ON i.id = vi.internato_id
    WHERE e.status = 'ativo'
      AND ei.data = current_date
      AND current_date BETWEEN e.data_inicio AND coalesce(e.data_fim, current_date)
      AND ((e.tipo_atuacao = 'adm' AND va.preceptor_id = v_acesso.preceptor_id)
        OR (e.tipo_atuacao = 'internato' AND vi.preceptor_id = v_acesso.preceptor_id))
  LOOP
    v_row := jsonb_build_object(
      'escala_id', v_rec.escala_id, 'escala_item_id', v_rec.escala_item_id,
      'tipo_atuacao', v_rec.tipo_atuacao,
      'turno', v_rec.turno, 'atividade', v_rec.atividade_nome,
      'local', v_rec.local_nome, 'setor', v_rec.setor_nome,
      'local_id', v_rec.local_id,
      'setor_id', v_rec.setor_id,
      'hora_inicio', to_char(v_rec.hora_inicio, 'HH24:MI'),
      'hora_fim', to_char(v_rec.hora_fim, 'HH24:MI'),
      'ja_registrada', EXISTS(
        SELECT 1 FROM public.presencas p
        WHERE p.escala_id = v_rec.escala_id AND p.turno = v_rec.turno
          AND p.data_presenca = current_date AND p.status IN ('confirmada','ajustada')
      )
    );
    v_result := v_result || v_row;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- 6) registrar_presenca (RPC autenticada legada da rota mobile):
--    mesmo criterio: setor vem do item da escala com fallback legado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_presenca(
  p_escala_id uuid,
  p_turno public.turno
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_profile public.profiles;
  v_preceptor public.preceptores;
  v_escala public.escalas;
  v_local public.vinculo_locais;
  v_setor_item uuid;
  v_id uuid;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid() AND ativo = true;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario sem perfil ativo.');
  END IF;

  SELECT * INTO v_preceptor FROM public.preceptores WHERE profile_id = v_profile.id AND status = 'ativo';
  IF v_preceptor.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario nao esta vinculado a um preceptor ativo.');
  END IF;

  SELECT * INTO v_escala FROM public.escalas WHERE id = p_escala_id AND status = 'ativo';
  IF v_escala.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala invalida ou inativa.');
  END IF;

  IF v_escala.turno IS NOT NULL AND v_escala.turno <> p_turno THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Turno diferente da escala.');
  END IF;

  IF v_escala.dia_semana IS NOT NULL AND extract(dow from current_date)::smallint <> v_escala.dia_semana THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
  END IF;

  IF current_date NOT BETWEEN v_escala.data_inicio AND v_escala.data_fim THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  END IF;

  IF v_escala.tipo_atuacao = 'adm' AND NOT EXISTS(
    SELECT 1 FROM public.vinculos_adm v WHERE v.id = v_escala.vinculo_adm_id AND v.preceptor_id = v_preceptor.id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  IF v_escala.tipo_atuacao = 'internato' AND NOT EXISTS(
    SELECT 1 FROM public.vinculos_internato v WHERE v.id = v_escala.vinculo_internato_id AND v.preceptor_id = v_preceptor.id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.presencas
    WHERE preceptor_id = v_preceptor.id AND escala_id = p_escala_id
      AND data_presenca = current_date AND turno = p_turno
      AND status IN ('confirmada','ajustada')
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno hoje.');
  END IF;

  SELECT * INTO v_local FROM public.vinculo_locais WHERE id = v_escala.vinculo_local_id;

  SELECT ei.setor_id INTO v_setor_item
  FROM public.escalas_itens ei
  WHERE ei.escala_id = p_escala_id AND ei.data = current_date AND ei.turno = p_turno
  LIMIT 1;

  INSERT INTO public.presencas(
    preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id, data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao, v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, coalesce(v_setor_item, v_local.setor_id), current_date, p_turno, 'confirmada', 'preceptor', v_profile.id
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$$;

-- ------------------------------------------------------------
-- 7) Privilegios (mesmos da versao anterior; reafirmados).
--    Nenhuma policy/RLS alterada.
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.salvar_escala_completa(
  PUBLIC.tipo_atuacao, uuid, date, jsonb, uuid, uuid, uuid, date, PUBLIC.status_registro
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_coordenador(uuid, uuid, date, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_preceptores_com_escala_no_dia(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_escalas_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_token(text, uuid, PUBLIC.turno) TO anon;
