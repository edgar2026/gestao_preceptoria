-- Migration 022: Novo Fluxo de Presencas do Coordenador e Consolidação Dinâmica
--
-- 1. Enum origem_presenca: adiciona 'coordenador' se nao existir.
-- 2. RPC fetch_preceptores_com_escala_no_dia: lista preceptores e turnos previstos para uma data especifica.
-- 3. RPC registrar_presenca_coordenador: registra presencas individuais para cada turno com validacao de duplicidade.
-- 4. RPC fetch_presencas_consolidadas: consolida dinamicamente as presencas por preceptor e competencia.

ALTER TYPE public.origem_presenca ADD VALUE IF NOT EXISTS 'coordenador';

-- 1. BUSCAR PRECEPTORES COM ESCALA NO DIA
CREATE OR REPLACE FUNCTION public.fetch_preceptores_com_escala_no_dia(p_data DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
      vl.setor_id,
      coalesce(loc.nome, '-') AS local_nome,
      coalesce(set.nome, '-') AS setor_nome,
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
    ORDER BY p.nome_completo
  ) sub;

  RETURN coalesce(v_resultado, '[]'::jsonb);
END;
$$;

-- 2. REGISTRAR PRESENÇA PELO COORDENADOR
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

  -- Buscar local e setor do vinculo
  SELECT local_id, setor_id
  INTO v_local_id, v_setor_id
  FROM public.vinculo_locais
  WHERE id = v_vinculo_local_id;

  -- Iterar sobre os turnos selecionados
  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos)
  LOOP
    v_turno := v_turno_text::PUBLIC.turno;

    -- Validar se ja existe presenca ativa para mesmo preceptor, escala, data e turno
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

-- 3. CONSOLIDAÇÃO DINÂMICA DE PRESENÇAS POR PRECEPTOR E COMPETÊNCIA
CREATE OR REPLACE FUNCTION public.fetch_presencas_consolidadas()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'preceptor_id', sub.preceptor_id,
      'preceptor_nome', sub.preceptor_nome,
      'tipo_atuacao', sub.tipo_atuacao,
      'modalidade_label', CASE WHEN sub.tipo_atuacao = 'adm' THEN 'Prática' ELSE 'Internato' END,
      'competencia', sub.competencia,
      'competencia_label', sub.competencia,
      'total_turnos', sub.total_turnos,
      'status', 'confirmada',
      'itens', sub.itens
    )
  ) INTO v_resultado
  FROM (
    SELECT
      pr.preceptor_id,
      p.nome_completo AS preceptor_nome,
      pr.tipo_atuacao,
      to_char(pr.data_presenca, 'YYYY-MM') AS competencia,
      COUNT(pr.id) AS total_turnos,
      jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'data_presenca', pr.data_presenca,
          'turno', pr.turno,
          'status', pr.status,
          'origem', pr.origem,
          'local_nome', coalesce(loc.nome, '-'),
          'registrado_em', pr.registrado_em
        ) ORDER BY pr.data_presenca ASC, pr.turno ASC
      ) AS itens
    FROM public.presencas pr
    JOIN public.preceptores p ON p.id = pr.preceptor_id
    LEFT JOIN public.locais loc ON loc.id = pr.local_id
    WHERE pr.status != 'cancelada'
    GROUP BY pr.preceptor_id, p.nome_completo, pr.tipo_atuacao, to_char(pr.data_presenca, 'YYYY-MM')
    ORDER BY competencia DESC, p.nome_completo ASC
  ) sub;

  RETURN coalesce(v_resultado, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_preceptores_com_escala_no_dia(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_coordenador(UUID, UUID, DATE, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_presencas_consolidadas() TO authenticated;
