-- =============================================================
-- Migração 028: Renomear RPCs de apuração financeira
-- =============================================================
-- Problema: PostgREST não consegue desambiguar duas funções
-- sobrecarregadas com o mesmo nome e parâmetros iniciais iguais.
--
-- Solução:
--   auto_apurar_fila_financeira(p_mes, p_ano)
--     → auto_apurar_competencia_financeira(p_mes, p_ano)
--     (recálculo universal — botão "Recalcular competência")
--
--   auto_apurar_fila_financeira(p_mes, p_ano, p_preceptor_id, p_vinculo_adm_id, p_vinculo_internato_id)
--     → auto_apurar_preceptor_financeiro(p_mes, p_ano, p_preceptor_id, p_vinculo_adm_id, p_vinculo_internato_id)
--     (recálculo individual — Realtime de presença)
-- =============================================================

-- 1. Remover as duas versões sobrecarregadas existentes
DROP FUNCTION IF EXISTS public.auto_apurar_fila_financeira(integer, integer);
DROP FUNCTION IF EXISTS public.auto_apurar_fila_financeira(integer, integer, uuid, uuid, uuid);

-- 2. Criar a função universal (botão "Recalcular competência")
CREATE OR REPLACE FUNCTION public.auto_apurar_competencia_financeira(
  p_mes integer DEFAULT NULL::integer,
  p_ano integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
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
        status = CASE WHEN v_situacao = 'Calculado' THEN 'calculado'::status_calculo ELSE 'rascunho'::status_calculo END,
        versao = v_versao,
        calculado_em = now(),
        observacoes = v_situacao,
        quantidade_presencas = v_qtd,
        vinculo_adm_id = CASE WHEN v_presenca.tipo_atuacao = 'adm' THEN v_presenca.vinculo_adm_id ELSE NULL END,
        vinculo_internato_id = CASE WHEN v_presenca.tipo_atuacao = 'internato' THEN v_presenca.vinculo_internato_id ELSE NULL END,
        updated_at = now()
      WHERE id = v_calculo_id;
    ELSE
      INSERT INTO public.calculos (
        competencia_id, preceptor_id, tipo_atuacao,
        vinculo_adm_id, vinculo_internato_id,
        total_bruto, total_descontos, status,
        calculado_em, observacoes, quantidade_presencas
      ) VALUES (
        v_competencia_id, v_presenca.preceptor_id, v_presenca.tipo_atuacao,
        CASE WHEN v_presenca.tipo_atuacao = 'adm' THEN v_presenca.vinculo_adm_id ELSE NULL END,
        CASE WHEN v_presenca.tipo_atuacao = 'internato' THEN v_presenca.vinculo_internato_id ELSE NULL END,
        v_total_bruto, 0,
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
$function$;

-- 3. Criar a função individual (Realtime de presença)
CREATE OR REPLACE FUNCTION public.auto_apurar_preceptor_financeiro(
  p_mes integer DEFAULT NULL::integer,
  p_ano integer DEFAULT NULL::integer,
  p_preceptor_id uuid DEFAULT NULL::uuid,
  p_vinculo_adm_id uuid DEFAULT NULL::uuid,
  p_vinculo_internato_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
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
    ELSIF v_presenca.tipo_atuacao = 'internato' AND v_presenca.vinculo_internato_id IS NULL THEN
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
        status = CASE WHEN v_situacao = 'Calculado' THEN 'calculado'::status_calculo ELSE 'rascunho'::status_calculo END,
        versao = v_versao,
        calculado_em = now(),
        observacoes = v_situacao,
        quantidade_presencas = v_qtd,
        vinculo_adm_id = CASE WHEN v_presenca.tipo_atuacao = 'adm' THEN v_presenca.vinculo_adm_id ELSE NULL END,
        vinculo_internato_id = CASE WHEN v_presenca.tipo_atuacao = 'internato' THEN v_presenca.vinculo_internato_id ELSE NULL END,
        updated_at = now()
      WHERE id = v_calculo_id;
    ELSE
      INSERT INTO public.calculos (
        competencia_id, preceptor_id, tipo_atuacao,
        vinculo_adm_id, vinculo_internato_id,
        total_bruto, total_descontos, status,
        calculado_em, observacoes, quantidade_presencas
      ) VALUES (
        v_competencia_id, v_presenca.preceptor_id, v_presenca.tipo_atuacao,
        CASE WHEN v_presenca.tipo_atuacao = 'adm' THEN v_presenca.vinculo_adm_id ELSE NULL END,
        CASE WHEN v_presenca.tipo_atuacao = 'internato' THEN v_presenca.vinculo_internato_id ELSE NULL END,
        v_total_bruto, 0,
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
$function$;

-- Garantir que as duas funções são chamáveis via anon/authenticated
GRANT EXECUTE ON FUNCTION public.auto_apurar_competencia_financeira(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_apurar_preceptor_financeiro(integer, integer, uuid, uuid, uuid) TO authenticated;
