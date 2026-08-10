-- 037_fix_recalculo_universal.sql
-- 1) Reescreve auto_apurar_competencia_financeira com filtros opcionais
--    (substitui auto_apurar_preceptor_financeira — elimina sobrecarga ambígua).
-- 2) Reescreve registrar_presenca_coordenador para aceitar turno diferente
--    da previsão, bloqueando duplicidade por vinculo+data+turno.
-- 3) Dropa auto_apurar_preceptor_financeira (obsoleta).

-- ============================================================
-- 1. auto_apurar_competencia_financeira (única RPC, idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_apurar_competencia_financeira(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_preceptor_id uuid DEFAULT NULL,
  p_vinculo_adm_id uuid DEFAULT NULL,
  p_vinculo_internato_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resultado jsonb := '[]'::jsonb;
  v_row jsonb;
  v_presenca record;
  v_competencia_id uuid;
  v_curso_padrao uuid;
  v_calculo_id uuid;
  v_versao integer;
  v_total_bruto numeric(14,2);
  v_situacao text;
  v_item record;
  v_regra record;
  v_componente record;
  v_qtd integer;
  v_qtd_item integer;
  v_vlr_unit numeric(14,2);
  v_vlr_total numeric(14,2);
  v_itens jsonb := '[]'::jsonb;
  v_regra_nome text;
  v_unidade_nome text;
  v_disciplina_nome text;
  v_internato_nome text;
  v_local_nome text;
  v_regra_id uuid;
  v_item_tipo public.tipo_item_calculo;
BEGIN
  IF p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Mes e ano sao obrigatorios';
  END IF;

  IF NOT public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'academico'::public.app_role, 'auditor'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT id INTO v_curso_padrao FROM public.cursos LIMIT 1;

  FOR v_presenca IN
    SELECT DISTINCT ON (p.preceptor_id, p.tipo_atuacao, p.vinculo_adm_id, p.vinculo_internato_id)
      p.preceptor_id,
      p.tipo_atuacao,
      p.vinculo_adm_id,
      p.vinculo_internato_id
    FROM public.presencas p
    WHERE p.status = 'confirmada'
      AND EXTRACT(MONTH FROM p.data_presenca) = p_mes
      AND EXTRACT(YEAR FROM p.data_presenca) = p_ano
      AND (p_preceptor_id IS NULL OR p.preceptor_id = p_preceptor_id)
      AND (
        p_vinculo_adm_id IS NULL
        OR (p.tipo_atuacao = 'adm' AND p.vinculo_adm_id = p_vinculo_adm_id)
      )
      AND (
        p_vinculo_internato_id IS NULL
        OR (p.tipo_atuacao = 'internato' AND p.vinculo_internato_id = p_vinculo_internato_id)
      )
    ORDER BY p.preceptor_id, p.tipo_atuacao, p.vinculo_adm_id, p.vinculo_internato_id
  LOOP
    v_total_bruto := 0;
    v_situacao := 'Calculado';
    v_itens := '[]'::jsonb;
    v_regra_nome := NULL;
    v_unidade_nome := NULL;
    v_disciplina_nome := NULL;
    v_internato_nome := NULL;
    v_local_nome := NULL;

    IF v_presenca.tipo_atuacao IS NULL THEN
      RAISE WARNING 'Presenca de preceptor % nao possui tipo_atuacao — ignorando', v_presenca.preceptor_id;
      CONTINUE;
    END IF;

    IF v_presenca.vinculo_adm_id IS NULL AND v_presenca.vinculo_internato_id IS NULL THEN
      RAISE WARNING 'Presenca de preceptor % (%) nao possui vinculo — ignorando', v_presenca.preceptor_id, v_presenca.tipo_atuacao;
      CONTINUE;
    END IF;

    SELECT id INTO v_competencia_id
    FROM public.competencias
    WHERE ano = p_ano AND mes = p_mes
      AND (curso_id = v_curso_padrao OR curso_id IS NULL)
    LIMIT 1;

    IF v_competencia_id IS NULL THEN
      INSERT INTO public.competencias (curso_id, ano, mes, data_inicio, data_fim, status)
      VALUES (
        v_curso_padrao, p_ano, p_mes,
        (p_ano || '-' || LPAD(p_mes::text, 2, '0') || '-01')::date,
        (p_ano || '-' || LPAD(p_mes::text, 2, '0') || '-' ||
         EXTRACT(DAY FROM (MAKE_DATE(p_ano, p_mes + 1, 1) - INTERVAL '1 day'))::integer)::date,
        'aberta'
      )
      RETURNING id INTO v_competencia_id;
    END IF;

    SELECT COUNT(*)::integer INTO v_qtd
    FROM public.presencas p
    WHERE p.preceptor_id = v_presenca.preceptor_id
      AND p.tipo_atuacao = v_presenca.tipo_atuacao
      AND p.status = 'confirmada'
      AND EXTRACT(MONTH FROM p.data_presenca) = p_mes
      AND EXTRACT(YEAR FROM p.data_presenca) = p_ano
      AND (
        (v_presenca.tipo_atuacao = 'adm' AND p.vinculo_adm_id = v_presenca.vinculo_adm_id)
        OR
        (v_presenca.tipo_atuacao = 'internato' AND p.vinculo_internato_id = v_presenca.vinculo_internato_id)
      );

    IF v_presenca.tipo_atuacao = 'adm' AND v_presenca.vinculo_adm_id IS NOT NULL THEN
      SELECT u.nome, d.nome, l.nome
      INTO v_unidade_nome, v_disciplina_nome, v_local_nome
      FROM public.vinculos_adm va
      LEFT JOIN public.unidades u ON u.id = va.unidade_id
      LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
      LEFT JOIN public.locais l ON l.id = va.local_id
      WHERE va.id = v_presenca.vinculo_adm_id;
    ELSIF v_presenca.tipo_atuacao = 'internato' AND v_presenca.vinculo_internato_id IS NOT NULL THEN
      SELECT u.nome, i.nome, l.nome
      INTO v_unidade_nome, v_internato_nome, v_local_nome
      FROM public.vinculos_internato vi
      LEFT JOIN public.unidades u ON u.id = vi.unidade_id
      LEFT JOIN public.internatos i ON i.id = vi.internato_id
      LEFT JOIN public.locais l ON l.id = vi.local_id
      WHERE vi.id = v_presenca.vinculo_internato_id;
    END IF;

    v_regra_id := NULL;
    IF v_presenca.tipo_atuacao = 'adm' AND v_presenca.vinculo_adm_id IS NOT NULL THEN
      SELECT vr.regra_id INTO v_regra_id
      FROM public.vinculo_regras_financeiras vr
      WHERE vr.vinculo_adm_id = v_presenca.vinculo_adm_id AND vr.status = 'ativo'
      LIMIT 1;
    ELSIF v_presenca.tipo_atuacao = 'internato' AND v_presenca.vinculo_internato_id IS NOT NULL THEN
      SELECT vr.regra_id INTO v_regra_id
      FROM public.vinculo_regras_financeiras vr
      WHERE vr.vinculo_internato_id = v_presenca.vinculo_internato_id AND vr.status = 'ativo'
      LIMIT 1;
    END IF;

    IF v_regra_id IS NULL THEN
      v_situacao := 'Sem regra financeira';
      v_regra_nome := NULL;
    ELSE
      SELECT * INTO v_regra
      FROM public.regras_financeiras
      WHERE id = v_regra_id AND status = 'ativo';

      IF v_regra IS NULL THEN
        v_situacao := 'Sem regra financeira';
        v_regra_nome := NULL;
      ELSE
        v_regra_nome := v_regra.nome;

        FOR v_componente IN
          SELECT * FROM public.regra_componentes
          WHERE regra_id = v_regra_id AND status = 'ativo'
          ORDER BY ordem
        LOOP
          v_vlr_unit := COALESCE(v_componente.valor, 0);
          v_vlr_total := 0;
          v_qtd_item := 0;

          CASE v_componente.tipo
            WHEN 'por_turno' THEN
              v_item_tipo := 'presenca';
              v_qtd_item := v_qtd;
              v_vlr_total := v_qtd * v_vlr_unit;
            WHEN 'por_ocorrencia' THEN
              v_item_tipo := 'presenca';
              v_qtd_item := v_qtd;
              v_vlr_total := v_qtd * v_vlr_unit;
            WHEN 'fixo_mensal' THEN
              v_item_tipo := 'fixo';
              IF v_componente.exige_presenca AND v_componente.quantidade_minima IS NOT NULL
                 AND v_qtd < v_componente.quantidade_minima::integer THEN
                v_situacao := 'Regra requer configuracao';
                v_qtd_item := 0;
                v_vlr_total := 0;
              ELSE
                v_qtd_item := 1;
                v_vlr_total := v_vlr_unit;
              END IF;
            WHEN 'adicional_fixo' THEN
              v_item_tipo := 'adicional';
              v_qtd_item := 1;
              v_vlr_total := v_vlr_unit;
            WHEN 'por_turno_mais_fixo' THEN
              v_item_tipo := 'presenca';
              v_qtd_item := v_qtd;
              v_vlr_total := (v_qtd * v_vlr_unit) + COALESCE(v_componente.valor_extra, 0);
              IF v_componente.exige_presenca AND v_componente.quantidade_minima IS NOT NULL
                 AND v_qtd < v_componente.quantidade_minima::integer THEN
                v_vlr_total := v_qtd * v_vlr_unit;
              END IF;
            WHEN 'sem_pagamento' THEN
              v_item_tipo := 'presenca';
              v_qtd_item := 0;
              v_vlr_total := 0;
            WHEN 'desconto' THEN
              v_item_tipo := 'desconto';
              v_qtd_item := 1;
              v_vlr_total := v_vlr_unit * (-1);
            WHEN 'valor_dividido' THEN
              v_item_tipo := 'rateio';
              v_situacao := 'Regra requer configuracao';
              v_qtd_item := 0;
              v_vlr_total := 0;
            WHEN 'parcela_total' THEN
              v_item_tipo := 'fixo';
              v_situacao := 'Regra requer configuracao';
              v_qtd_item := 0;
              v_vlr_total := 0;
            ELSE
              v_item_tipo := 'ajuste';
              v_situacao := 'Regra requer configuracao';
              v_qtd_item := 0;
              v_vlr_total := 0;
          END CASE;

          v_total_bruto := v_total_bruto + v_vlr_total;

          IF v_qtd_item > 0 OR v_vlr_total <> 0 THEN
            v_itens := v_itens || jsonb_build_object(
              'tipo', v_item_tipo::text,
              'componente_tipo', v_componente.tipo,
              'regra_id', v_regra_id,
              'descricao', v_componente.descricao,
              'quantidade', v_qtd_item,
              'valor_unitario', v_vlr_unit
            );
          END IF;
        END LOOP;

        IF jsonb_array_length(v_itens) = 0 THEN
          v_situacao := 'Regra requer configuracao';
        END IF;
      END IF;
    END IF;

    -- Buscar cálculo existente (preserva chamado)
    SELECT id, versao INTO v_calculo_id, v_versao
    FROM public.calculos
    WHERE competencia_id = v_competencia_id
      AND preceptor_id = v_presenca.preceptor_id
      AND tipo_atuacao = v_presenca.tipo_atuacao
    ORDER BY versao DESC
    LIMIT 1;

    IF v_calculo_id IS NOT NULL THEN
      v_versao := v_versao + 1;
      DELETE FROM public.calculo_itens WHERE calculo_id = v_calculo_id;
      UPDATE public.calculos SET
        tipo_atuacao = v_presenca.tipo_atuacao,
        total_bruto = v_total_bruto,
        total_descontos = 0,
        total_liquido = v_total_bruto,
        status = CASE WHEN v_situacao = 'Calculado' THEN 'calculado'::status_calculo ELSE 'rascunho'::status_calculo END,
        versao = v_versao,
        calculado_em = now(),
        observacoes = v_situacao,
        quantidade_presencas = v_qtd,
        vinculo_adm_id = CASE WHEN v_presenca.tipo_atuacao = 'adm' THEN v_presenca.vinculo_adm_id ELSE NULL END,
        vinculo_internato_id = CASE WHEN v_presenca.tipo_atuacao = 'internato' THEN v_presenca.vinculo_internato_id ELSE NULL END,
        updated_at = now()
        -- chamado_numero, chamado_status, chamado_observacao PRESERVADOS (não atualizados)
      WHERE id = v_calculo_id;
    ELSE
      INSERT INTO public.calculos (
        competencia_id, preceptor_id, tipo_atuacao,
        vinculo_adm_id, vinculo_internato_id,
        total_bruto, total_descontos, total_liquido, status,
        calculado_em, observacoes, quantidade_presencas
      ) VALUES (
        v_competencia_id, v_presenca.preceptor_id, v_presenca.tipo_atuacao,
        CASE WHEN v_presenca.tipo_atuacao = 'adm' THEN v_presenca.vinculo_adm_id ELSE NULL END,
        CASE WHEN v_presenca.tipo_atuacao = 'internato' THEN v_presenca.vinculo_internato_id ELSE NULL END,
        v_total_bruto, 0, v_total_bruto,
        CASE WHEN v_situacao = 'Calculado' THEN 'calculado'::status_calculo ELSE 'rascunho'::status_calculo END,
        now(), v_situacao, v_qtd
      )
      RETURNING id INTO v_calculo_id;
      v_versao := 1;
    END IF;

    IF jsonb_array_length(v_itens) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_to_recordset(v_itens) AS x(
        tipo text, componente_tipo text, regra_id uuid, descricao text,
        quantidade integer, valor_unitario numeric(14,2)
      )
      LOOP
        INSERT INTO public.calculo_itens (
          calculo_id, tipo, regra_id, descricao, quantidade,
          valor_unitario, referencia
        ) VALUES (
          v_calculo_id,
          v_item.tipo::tipo_item_calculo,
          v_item.regra_id,
          v_item.descricao,
          v_item.quantidade,
          v_item.valor_unitario,
          jsonb_build_object(
            'competencia', p_ano || '/' || LPAD(p_mes::text, 2, '0'),
            'regra_nome', v_regra_nome,
            'preceptor_id', v_presenca.preceptor_id,
            'tipo_atuacao', v_presenca.tipo_atuacao,
            'componente_tipo', v_item.componente_tipo
          )
        );
      END LOOP;
    END IF;

    v_row := jsonb_build_object(
      'calculo_id', v_calculo_id,
      'preceptor_id', v_presenca.preceptor_id,
      'competencia_id', v_competencia_id,
      'mes', p_mes,
      'ano', p_ano,
      'tipo_atuacao', v_presenca.tipo_atuacao,
      'vinculo_adm_id', v_presenca.vinculo_adm_id,
      'vinculo_internato_id', v_presenca.vinculo_internato_id,
      'unidade_nome', COALESCE(v_unidade_nome, '-'),
      'disciplina_nome', COALESCE(v_disciplina_nome, '-'),
      'internato_nome', COALESCE(v_internato_nome, '-'),
      'local_nome', COALESCE(v_local_nome, '-'),
      'quantidade_presencas', v_qtd,
      'regra_nome', COALESCE(v_regra_nome, 'Regra financeira pendente'),
      'total_bruto', v_total_bruto,
      'situacao', v_situacao,
      'versao', v_versao
    );

    v_resultado := v_resultado || v_row;
  END LOOP;

  RETURN v_resultado;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_apurar_competencia_financeira(
  integer, integer, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_apurar_competencia_financeira(
  integer, integer, uuid, uuid, uuid) TO authenticated;

-- ============================================================
-- 2. Drop auto_apurar_preceptor_financeira (obsoleta)
-- ============================================================
DROP FUNCTION IF EXISTS public.auto_apurar_preceptor_financeiro(
  integer, integer, uuid, uuid, uuid);

-- ============================================================
-- 3. registrar_presenca_coordenador — aceita turno real
--    (mesmo que diferente da previsão), mantém vínculo e
--    escala vigente. Bloqueio por vinculo+data+turno.
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_presenca_coordenador(
  p_escala_id uuid,
  p_preceptor_id uuid,
  p_data date,
  p_turnos jsonb,
  p_registrado_por uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tipo_atuacao public.tipo_atuacao;
  v_vinculo_adm_id uuid;
  v_vinculo_internato_id uuid;
  v_vinculo_local_id uuid;
  v_local_id uuid;
  v_setor_id uuid;
  v_registrado_por uuid;
  v_turno_text text;
  v_turno public.turno;
  v_vinculo_ok boolean;
  v_exists boolean;
  v_inseridos int := 0;
  v_duplicados int := 0;
BEGIN
  IF p_escala_id IS NULL OR p_preceptor_id IS NULL OR p_data IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Parametros obrigatorios ausentes.');
  END IF;

  IF p_turnos IS NULL OR jsonb_array_length(p_turnos) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Selecione pelo menos um turno.');
  END IF;

  -- Resolver perfil do responsavel
  SELECT id INTO v_registrado_por FROM public.profiles WHERE id = p_registrado_por LIMIT 1;
  IF v_registrado_por IS NULL THEN
    SELECT id INTO v_registrado_por FROM public.profiles LIMIT 1;
  END IF;

  -- Dados da escala
  SELECT tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id
  INTO v_tipo_atuacao, v_vinculo_adm_id, v_vinculo_internato_id, v_vinculo_local_id
  FROM public.escalas
  WHERE id = p_escala_id;

  IF v_vinculo_local_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao encontrada.');
  END IF;

  -- Escala ativa e vigente na data
  IF NOT EXISTS (
    SELECT 1 FROM public.escalas e
    WHERE e.id = p_escala_id
      AND e.status = 'ativo'
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

  -- Vinculo ativo e vigente na data
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
  SELECT local_id, setor_id INTO v_local_id, v_setor_id
  FROM public.vinculo_locais
  WHERE id = v_vinculo_local_id;

  -- Iterar turnos realmente trabalhados (diferente da previsão é permitido)
  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos)
  LOOP
    v_turno := v_turno_text::public.turno;

    -- Bloquear duplicidade: mesmo preceptor, vinculo, data e turno
    -- (não apenas mesma escala — dois vínculos distintos na mesma data são permitidos)
    SELECT EXISTS (
      SELECT 1 FROM public.presencas
      WHERE preceptor_id = p_preceptor_id
        AND data_presenca = p_data
        AND turno = v_turno
        AND status != 'cancelada'
        AND (
          (v_tipo_atuacao = 'internato' AND vinculo_internato_id = v_vinculo_internato_id)
          OR
          (v_tipo_atuacao = 'adm' AND vinculo_adm_id = v_vinculo_adm_id)
        )
    ) INTO v_exists;

    IF v_exists THEN
      v_duplicados := v_duplicados + 1;
    ELSE
      INSERT INTO public.presencas (
        preceptor_id, escala_id, tipo_atuacao,
        vinculo_adm_id, vinculo_internato_id,
        local_id, setor_id,
        data_presenca, turno, status, origem,
        registrado_por, registrado_em
      ) VALUES (
        p_preceptor_id, p_escala_id, v_tipo_atuacao,
        v_vinculo_adm_id, v_vinculo_internato_id,
        v_local_id, v_setor_id,
        p_data, v_turno, 'confirmada', 'coordenador',
        v_registrado_por, now()
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

REVOKE EXECUTE ON FUNCTION public.registrar_presenca_coordenador(
  uuid, uuid, date, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_coordenador(
  uuid, uuid, date, jsonb, uuid) TO authenticated;
