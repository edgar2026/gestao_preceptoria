-- 030_presenca_real_e_ajustes.sql
-- PRESENÇA REAL
-- 1. registrar_presenca_coordenador: aceita Manhã, Tarde e Noite realmente trabalhados,
--    mesmo quando diferentes do turno previsto na escala. A escala é referência;
--    a presença confirmada é a fonte do cálculo.
-- 2. corrigir_presenca_administrativa: correção auditável de presença por Administrativo
--    ou Financeiro, com justificativa mínima de 10 caracteres, bloqueio de duplicidade,
--    gravação em ajustes_presenca (antes/depois), recalculo restrito às competências
--    afetadas e marcação de revisão financeira quando houver chamado aberto/processado.

-- =====================================================================
-- 1. REGISTRAR PRESENÇA PELO COORDENADOR (PRESENÇA REAL)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.registrar_presenca_coordenador(
  p_escala_id UUID,
  p_preceptor_id UUID,
  p_data DATE,
  p_turnos JSONB,
  p_registrado_por UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tipo_atuacao PUBLIC.tipo_atuacao;
  v_vinculo_adm_id UUID;
  v_vinculo_internato_id UUID;
  v_vinculo_local_id UUID;
  v_local_id UUID;
  v_setor_id UUID;
  v_registrado_por UUID;
  v_turno_text TEXT;
  v_turno PUBLIC.turno;
  v_vinculo_ok BOOLEAN;
  v_exists BOOLEAN;
  v_inseridos INT := 0;
  v_duplicados INT := 0;
BEGIN
  IF p_escala_id IS NULL OR p_preceptor_id IS NULL OR p_data IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Parametros obrigatorios ausentes.');
  END IF;

  IF jsonb_array_length(p_turnos) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Selecione pelo menos um turno.');
  END IF;

  -- Resolver perfil do usuario responsavel pelo registro
  SELECT id INTO v_registrado_por FROM public.profiles WHERE id = p_registrado_por LIMIT 1;
  IF v_registrado_por IS NULL THEN
    SELECT id INTO v_registrado_por FROM public.profiles LIMIT 1;
  END IF;

  -- Buscar dados da escala
  SELECT tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id
  INTO v_tipo_atuacao, v_vinculo_adm_id, v_vinculo_internato_id, v_vinculo_local_id
  FROM public.escalas
  WHERE id = p_escala_id;

  IF v_vinculo_local_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao encontrada.');
  END IF;

  -- Escala ativa e vigente na data (deve existir item de escala para a data informada)
  IF NOT EXISTS (
    SELECT 1 FROM public.escalas e
    WHERE e.id = p_escala_id
      AND e.status = 'ativo'
      AND EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id AND ei.data = p_data
      )
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala inativa ou sem vigencia na data informada.');
  END IF;

  -- Vínculo ativo e vigente na data (Prática ou Internato conforme a escala)
  v_vinculo_ok := false;
  IF v_tipo_atuacao = 'internato' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = v_vinculo_internato_id
        AND vi.status = 'ativo'
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
      WHERE va.id = v_vinculo_adm_id
        AND va.status = 'ativo'
        AND va.preceptor_id = p_preceptor_id
        AND coalesce(va.data_inicio, '1900-01-01'::date) <= p_data
        AND coalesce(va.data_fim, '9999-12-31'::date) >= p_data
    ) INTO v_vinculo_ok;
    IF NOT v_vinculo_ok THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo de Pratica inativo ou sem vigencia na data.');
    END IF;
  END IF;

  -- Local e setor do vinculo
  SELECT local_id, setor_id
  INTO v_local_id, v_setor_id
  FROM public.vinculo_locais
  WHERE id = v_vinculo_local_id;

  -- Iterar sobre os turnos realmente trabalhados.
  -- A escala é referência: o turno NÃO é restringido à previsão.
  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos)
  LOOP
    v_turno := v_turno_text::PUBLIC.turno;

    -- Bloquear duplicidade: mesmo preceptor, escala, data e turno
    SELECT EXISTS (
      SELECT 1 FROM public.presencas
      WHERE escala_id = p_escala_id
        AND preceptor_id = p_preceptor_id
        AND data_presenca = p_data
        AND turno = v_turno
        AND status != 'cancelada'
    ) INTO v_exists;

    IF v_exists THEN
      v_duplicados := v_duplicados + 1;
    ELSE
      INSERT INTO public.presencas (
        preceptor_id,
        escala_id,
        tipo_atuacao,
        vinculo_adm_id,
        vinculo_internato_id,
        local_id,
        setor_id,
        data_presenca,
        turno,
        status,
        origem,
        registrado_por,
        registrado_em
      ) VALUES (
        p_preceptor_id,
        p_escala_id,
        v_tipo_atuacao,
        v_vinculo_adm_id,
        v_vinculo_internato_id,
        v_local_id,
        v_setor_id,
        p_data,
        v_turno,
        'confirmada',
        'administrador',
        v_registrado_por,
        now()
      );
      v_inseridos := v_inseridos + 1;
    END IF;
  END LOOP;

  IF v_inseridos = 0 AND v_duplicados > 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada anteriormente para este(s) turno(s).');
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'inseridos', v_inseridos, 'duplicados', v_duplicados);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_presenca_coordenador(UUID, UUID, DATE, JSONB, UUID) TO authenticated;

-- =====================================================================
-- 2. CORRIGIR PRESENÇA ADMINISTRATIVA (AUDITÁVEL)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.corrigir_presenca_administrativa(
  p_presenca_id UUID,
  p_nova_data DATE,
  p_novo_turno PUBLIC.turno,
  p_justificativa TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_presenca public.presencas%ROWTYPE;
  v_profile_id UUID;
  v_ajuste_id UUID;
  v_competencia_antiga TEXT;
  v_competencia_nova TEXT;
  v_mes_antigo INT;
  v_ano_antigo INT;
  v_mes_novo INT;
  v_ano_novo INT;
  v_calculo_id UUID;
  v_msg TEXT;
  v_revisao BOOLEAN := false;
BEGIN
  -- Somente Administrativo (administrador/academico) ou Financeiro autorizado
  IF NOT public.has_role(array['administrador'::public.app_role, 'academico'::public.app_role, 'financeiro'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_presenca_id IS NULL OR p_nova_data IS NULL OR p_novo_turno IS NULL THEN
    RAISE EXCEPTION 'Parametros obrigatorios ausentes.';
  END IF;

  IF length(trim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Justificativa deve ter pelo menos 10 caracteres.';
  END IF;

  IF p_nova_data > current_date THEN
    RAISE EXCEPTION 'Nao e permitido corrigir presenca para data futura.';
  END IF;

  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao identificado.';
  END IF;

  -- Validar presença (transação única: tudo ou nada)
  SELECT * INTO v_presenca
  FROM public.presencas
  WHERE id = p_presenca_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presenca nao encontrada.';
  END IF;

  IF v_presenca.status = 'cancelada' THEN
    RAISE EXCEPTION 'Presenca cancelada nao pode ser corrigida.';
  END IF;

  -- Validar vínculo ativo e vigente na nova data
  IF v_presenca.tipo_atuacao = 'internato' THEN
    IF v_presenca.vinculo_internato_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = v_presenca.vinculo_internato_id
        AND vi.status = 'ativo'
        AND coalesce(vi.data_inicio, '1900-01-01'::date) <= p_nova_data
        AND coalesce(vi.data_fim, '9999-12-31'::date) >= p_nova_data
    ) THEN
      RAISE EXCEPTION 'Vinculo de Internato inativo ou sem vigencia na nova data.';
    END IF;
  ELSIF v_presenca.vinculo_adm_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vinculos_adm va
      WHERE va.id = v_presenca.vinculo_adm_id
        AND va.status = 'ativo'
        AND coalesce(va.data_inicio, '1900-01-01'::date) <= p_nova_data
        AND coalesce(va.data_fim, '9999-12-31'::date) >= p_nova_data
    ) THEN
      RAISE EXCEPTION 'Vinculo de Pratica inativo ou sem vigencia na nova data.';
    END IF;
  END IF;

  -- Bloquear duplicidade: mesmo vínculo/escala + preceptor + data + turno
  IF EXISTS (
    SELECT 1 FROM public.presencas p
    WHERE p.id <> p_presenca_id
      AND p.preceptor_id = v_presenca.preceptor_id
      AND p.data_presenca = p_nova_data
      AND p.turno = p_novo_turno
      AND p.status <> 'cancelada'
      AND (
        p.escala_id IS NOT DISTINCT FROM v_presenca.escala_id
        OR (p.local_id = v_presenca.local_id AND p.tipo_atuacao = v_presenca.tipo_atuacao)
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe presenca registrada para este preceptor, data e turno no mesmo vinculo.';
  END IF;

  -- Competências afetadas
  v_competencia_antiga := to_char(v_presenca.data_presenca, 'YYYY-MM');
  v_competencia_nova  := to_char(p_nova_data, 'YYYY-MM');
  v_mes_antigo := EXTRACT(MONTH FROM v_presenca.data_presenca)::INT;
  v_ano_antigo := EXTRACT(YEAR FROM v_presenca.data_presenca)::INT;
  v_mes_novo   := EXTRACT(MONTH FROM p_nova_data)::INT;
  v_ano_novo   := EXTRACT(YEAR FROM p_nova_data)::INT;

  -- Gravar ajuste com antes/depois, usuário e data (histórico nunca é apagado)
  INSERT INTO public.ajustes_presenca (
    presenca_id,
    preceptor_id,
    tipo_ajuste,
    dados_anteriores,
    dados_novos,
    justificativa,
    realizado_por,
    realizado_em
  ) VALUES (
    p_presenca_id,
    v_presenca.preceptor_id,
    'alteracao',
    jsonb_build_object(
      'data_presenca', v_presenca.data_presenca,
      'turno', v_presenca.turno,
      'status', v_presenca.status,
      'escala_id', v_presenca.escala_id,
      'tipo_atuacao', v_presenca.tipo_atuacao,
      'vinculo_adm_id', v_presenca.vinculo_adm_id,
      'vinculo_internato_id', v_presenca.vinculo_internato_id,
      'local_id', v_presenca.local_id,
      'setor_id', v_presenca.setor_id,
      'registrado_por', v_presenca.registrado_por
    ),
    jsonb_build_object(
      'data_presenca', p_nova_data,
      'turno', p_novo_turno,
      'status', 'confirmada',
      'escala_id', v_presenca.escala_id,
      'tipo_atuacao', v_presenca.tipo_atuacao,
      'vinculo_adm_id', v_presenca.vinculo_adm_id,
      'vinculo_internato_id', v_presenca.vinculo_internato_id,
      'local_id', v_presenca.local_id,
      'setor_id', v_presenca.setor_id,
      'registrado_por', v_presenca.registrado_por
    ),
    p_justificativa,
    v_profile_id,
    now()
  ) RETURNING id INTO v_ajuste_id;

  -- Atualizar a presença sem apagar o histórico (status permanece confirmada,
  -- pois a presença realmente trabalhada continua sendo fonte do cálculo)
  UPDATE public.presencas SET
    data_presenca = p_nova_data,
    turno = p_novo_turno,
    status = 'confirmada',
    observacoes = coalesce(
      observacoes,
      ''
    ) || coalesce(
      E'\n[Correcao ' || v_ajuste_id::text || '] ' || p_justificativa,
      ''
    ),
    updated_at = now()
  WHERE id = p_presenca_id;

  -- Chamado aberto/processado: preservar dados e marcar revisão financeira
  FOR v_calculo_id IN
    SELECT c.id
    FROM public.calculos c
    JOIN public.competencias co ON co.id = c.competencia_id
    WHERE c.preceptor_id = v_presenca.preceptor_id
      AND c.chamado_status IS DISTINCT FROM 'nao_aberto'
      AND to_char(make_date(co.ano, co.mes, 1), 'YYYY-MM') IN (v_competencia_antiga, v_competencia_nova)
      AND (
        (v_presenca.tipo_atuacao = 'adm' AND coalesce(c.vinculo_adm_id::text, '') = coalesce(v_presenca.vinculo_adm_id::text, ''))
        OR
        (v_presenca.tipo_atuacao = 'internato' AND coalesce(c.vinculo_internato_id::text, '') = coalesce(v_presenca.vinculo_internato_id::text, ''))
      )
  LOOP
    v_msg := 'Correcao administrativa de presenca (ajuste ' || v_ajuste_id::text || ') - revisao financeira necessaria.';
    v_revisao := true;

    -- Preserva os dados do chamado e anexa a observação de revisão
    UPDATE public.calculos SET
      chamado_observacao = CASE
        WHEN chamado_observacao IS NULL OR chamado_observacao = '' THEN v_msg
        ELSE chamado_observacao || E'\n' || v_msg
      END,
      chamado_updated_at = now(),
      chamado_updated_by = v_profile_id,
      updated_at = now()
    WHERE id = v_calculo_id;

    -- Marca revisão financeira na fila de validações
    IF EXISTS (
      SELECT 1 FROM public.aprovacoes a
      WHERE a.calculo_id = v_calculo_id AND a.tipo = 'financeira' AND a.status = 'pendente'
    ) THEN
      UPDATE public.aprovacoes SET
        comentario = v_msg,
        decidido_por = NULL,
        decidido_em = NULL,
        responsavel_profile_id = v_profile_id
      WHERE calculo_id = v_calculo_id AND tipo = 'financeira' AND status = 'pendente';
    ELSE
      INSERT INTO public.aprovacoes (
        calculo_id, tipo, ordem, status,
        responsavel_profile_id, comentario
      ) VALUES (
        v_calculo_id, 'financeira', 1, 'pendente',
        v_profile_id, v_msg
      );
    END IF;
  END LOOP;

  -- Recalcular somente o preceptor, vínculo e competências afetadas.
  -- Sempre recalcula a competência de origem; se o mês mudou, recalcula também a nova.
  PERFORM public.auto_apurar_preceptor_financeiro(
    v_mes_antigo, v_ano_antigo,
    v_presenca.preceptor_id,
    v_presenca.vinculo_adm_id,
    v_presenca.vinculo_internato_id
  );
  IF v_competencia_antiga <> v_competencia_nova THEN
    PERFORM public.auto_apurar_preceptor_financeiro(
      v_mes_novo, v_ano_novo,
      v_presenca.preceptor_id,
      v_presenca.vinculo_adm_id,
      v_presenca.vinculo_internato_id
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'presenca_id', p_presenca_id,
    'ajuste_id', v_ajuste_id,
    'revisao_financeira', v_revisao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.corrigir_presenca_administrativa(UUID, DATE, PUBLIC.turno, TEXT) TO authenticated;
