-- 027_apuracao_mensal_fila_financeira.sql
-- Adiciona campos de chamado e contexto do vinculo na tabela calculos.
-- Cria RPCs para fila financeira automatica baseada em presencas confirmadas.

-- 1. Colunas de chamado na tabela calculos
ALTER TABLE public.calculos
  ADD COLUMN IF NOT EXISTS chamado_numero text,
  ADD COLUMN IF NOT EXISTS chamado_status text NOT NULL DEFAULT 'nao_aberto',
  ADD COLUMN IF NOT EXISTS chamado_observacao text,
  ADD COLUMN IF NOT EXISTS chamado_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS chamado_updated_by uuid REFERENCES public.profiles(id);

-- 2. Colunas de contexto do vinculo na tabela calculos
ALTER TABLE public.calculos
  ADD COLUMN IF NOT EXISTS vinculo_adm_id uuid REFERENCES public.vinculos_adm(id),
  ADD COLUMN IF NOT EXISTS vinculo_internato_id uuid REFERENCES public.vinculos_internato(id),
  ADD COLUMN IF NOT EXISTS quantidade_presencas integer NOT NULL DEFAULT 0;

-- 3. Indices para performance da fila
CREATE INDEX IF NOT EXISTS idx_calculos_vinculo_adm ON public.calculos(vinculo_adm_id) WHERE vinculo_adm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calculos_vinculo_internato ON public.calculos(vinculo_internato_id) WHERE vinculo_internato_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calculos_chamado_status ON public.calculos(chamado_status);

-- 4. Comentarios das colunas
COMMENT ON COLUMN public.calculos.chamado_numero IS 'Numero do chamado mensal (texto livre)';
COMMENT ON COLUMN public.calculos.chamado_status IS 'Status do chamado: nao_aberto, aberto, em_analise, deferido, indeferido, concluido';
COMMENT ON COLUMN public.calculos.chamado_observacao IS 'Observacao do acompanhamento do chamado';
COMMENT ON COLUMN public.calculos.vinculo_adm_id IS 'Vinculo de Pratica associado ao calculo';
COMMENT ON COLUMN public.calculos.vinculo_internato_id IS 'Vinculo de Internato associado ao calculo';
COMMENT ON COLUMN public.calculos.quantidade_presencas IS 'Quantidade de presencas confirmadas consideradas no calculo';

-- 5. RPC: auto_apurar_fila_financeira
-- Gatilho automatico: processa presencas confirmadas e cria/atualiza linhas na fila financeira.
-- Agrupa por preceptor + vinculo + mes/ano.
-- Retorna as linhas da fila para exibicao.

CREATE OR REPLACE FUNCTION public.auto_apurar_fila_financeira(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  v_vlr_unit numeric(14,2);
  v_vlr_total numeric(14,2);
  v_itens jsonb := '[]'::jsonb;
  v_regra_nome text;
  v_regra_situacao text;
  v_unidade_nome text;
  v_disciplina_nome text;
  v_internato_nome text;
  v_local_nome text;
  v_regra_id uuid;
BEGIN
  SELECT id INTO v_curso_padrao FROM public.cursos LIMIT 1;

  FOR v_presenca IN
    SELECT DISTINCT ON (p.preceptor_id, p.tipo_atuacao, p.vinculo_adm_id, p.vinculo_internato_id,
                        EXTRACT(MONTH FROM p.data_presenca), EXTRACT(YEAR FROM p.data_presenca))
      p.preceptor_id,
      p.tipo_atuacao,
      p.vinculo_adm_id,
      p.vinculo_internato_id,
      EXTRACT(MONTH FROM p.data_presenca)::integer AS mes,
      EXTRACT(YEAR FROM p.data_presenca)::integer AS ano
    FROM public.presencas p
    WHERE p.status = 'confirmada'
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM p.data_presenca) = p_mes)
      AND (p_ano IS NULL OR EXTRACT(YEAR FROM p.data_presenca) = p_ano)
    ORDER BY p.preceptor_id, p.tipo_atuacao, p.vinculo_adm_id, p.vinculo_internato_id,
             EXTRACT(MONTH FROM p.data_presenca), EXTRACT(YEAR FROM p.data_presenca)
  LOOP
    v_total_bruto := 0;
    v_situacao := 'Calculado';
    v_itens := '[]'::jsonb;
    v_regra_nome := NULL;
    v_regra_situacao := NULL;
    v_unidade_nome := NULL;
    v_disciplina_nome := NULL;
    v_internato_nome := NULL;
    v_local_nome := NULL;

    -- Localiza ou cria competencia
    SELECT id INTO v_competencia_id
    FROM public.competencias
    WHERE ano = v_presenca.ano AND mes = v_presenca.mes
      AND (curso_id = v_curso_padrao OR curso_id IS NULL)
    LIMIT 1;

    IF v_competencia_id IS NULL THEN
      INSERT INTO public.competencias (curso_id, ano, mes, data_inicio, data_fim, status)
      VALUES (
        v_curso_padrao,
        v_presenca.ano,
        v_presenca.mes,
        (v_presenca.ano || '-' || LPAD(v_presenca.mes::text, 2, '0') || '-01')::date,
        (v_presenca.ano || '-' || LPAD(v_presenca.mes::text, 2, '0') || '-' ||
         EXTRACT(DAY FROM (MAKE_DATE(v_presenca.ano, v_presenca.mes + 1, 1) - INTERVAL '1 day'))::integer)::date,
        'aberta'
      )
      RETURNING id INTO v_competencia_id;
    END IF;

    -- Conta presencas confirmadas deste grupo no mes
    SELECT COUNT(*)::integer INTO v_qtd
    FROM public.presencas p
    WHERE p.preceptor_id = v_presenca.preceptor_id
      AND p.tipo_atuacao = v_presenca.tipo_atuacao
      AND p.status = 'confirmada'
      AND EXTRACT(MONTH FROM p.data_presenca) = v_presenca.mes
      AND EXTRACT(YEAR FROM p.data_presenca) = v_presenca.ano
      AND (
        (v_presenca.tipo_atuacao = 'adm' AND p.vinculo_adm_id = v_presenca.vinculo_adm_id)
        OR
        (v_presenca.tipo_atuacao = 'internato' AND p.vinculo_internato_id = v_presenca.vinculo_internato_id)
      );

    -- Busca dados do vinculo para contexto
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

    -- Busca regra financeira vinculada ao vinculo
    v_regra_id := NULL;
    IF v_presenca.tipo_atuacao = 'adm' AND v_presenca.vinculo_adm_id IS NOT NULL THEN
      SELECT vr.regra_id INTO v_regra_id
      FROM public.vinculo_regras_financeiras vr
      WHERE vr.vinculo_adm_id = v_presenca.vinculo_adm_id
        AND vr.status = 'ativo'
      LIMIT 1;
    ELSIF v_presenca.tipo_atuacao = 'internato' AND v_presenca.vinculo_internato_id IS NOT NULL THEN
      SELECT vr.regra_id INTO v_regra_id
      FROM public.vinculo_regras_financeiras vr
      WHERE vr.vinculo_internato_id = v_presenca.vinculo_internato_id
        AND vr.status = 'ativo'
      LIMIT 1;
    END IF;

    IF v_regra_id IS NULL THEN
      v_situacao := 'Sem regra financeira';
      v_regra_situacao := 'Regra financeira pendente';
      v_regra_nome := NULL;
    ELSE
      SELECT * INTO v_regra
      FROM public.regras_financeiras
      WHERE id = v_regra_id AND status = 'ativo';

      IF v_regra IS NULL THEN
        v_situacao := 'Sem regra financeira';
        v_regra_situacao := 'Regra financeira pendente';
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

          CASE v_componente.tipo
            WHEN 'por_turno' THEN
              v_vlr_total := v_qtd * v_vlr_unit;
            WHEN 'fixo_mensal' THEN
              IF v_componente.exige_presenca AND v_componente.quantidade_minima IS NOT NULL
                 AND v_qtd < v_componente.quantidade_minima::integer THEN
                v_situacao := 'Regra requer configuracao';
                v_vlr_total := 0;
              ELSE
                v_vlr_total := v_vlr_unit;
              END IF;
            WHEN 'por_ocorrencia' THEN
              v_vlr_total := v_qtd * v_vlr_unit;
            WHEN 'adicional_fixo' THEN
              v_vlr_total := v_vlr_unit;
            WHEN 'por_turno_mais_fixo' THEN
              v_vlr_total := (v_qtd * v_vlr_unit) + COALESCE(v_componente.valor_extra, 0);
              IF v_componente.exige_presenca AND v_componente.quantidade_minima IS NOT NULL
                 AND v_qtd < v_componente.quantidade_minima::integer THEN
                v_vlr_total := v_qtd * v_vlr_unit;
              END IF;
            WHEN 'sem_pagamento' THEN
              v_vlr_total := 0;
            WHEN 'valor_dividido', 'parcela_total' THEN
              v_situacao := 'Regra requer configuracao';
              v_vlr_total := 0;
            ELSE
              v_situacao := 'Regra requer configuracao';
              v_vlr_total := 0;
          END CASE;

          v_total_bruto := v_total_bruto + v_vlr_total;

          v_itens := v_itens || jsonb_build_object(
            'tipo', v_componente.tipo,
            'regra_id', v_regra_id,
            'descricao', v_componente.descricao,
            'quantidade', v_qtd,
            'valor_unitario', v_vlr_unit,
            'valor_total', v_vlr_total
          );
        END LOOP;

        IF jsonb_array_length(v_itens) = 0 THEN
          v_situacao := 'Regra requer configuracao';
        END IF;
      END IF;
    END IF;

    -- Busca ou cria calculo
    SELECT id, versao INTO v_calculo_id, v_versao
    FROM public.calculos
    WHERE competencia_id = v_competencia_id
      AND preceptor_id = v_presenca.preceptor_id
      AND (
        (v_presenca.tipo_atuacao = 'adm' AND vinculo_adm_id = v_presenca.vinculo_adm_id)
        OR
        (v_presenca.tipo_atuacao = 'internato' AND vinculo_internato_id = v_presenca.vinculo_internato_id)
      )
    ORDER BY versao DESC
    LIMIT 1;

    IF v_calculo_id IS NOT NULL THEN
      v_versao := v_versao + 1;
      DELETE FROM public.calculo_itens WHERE calculo_id = v_calculo_id;
      UPDATE public.calculos SET
        modalidade = v_presenca.tipo_atuacao,
        total_bruto = v_total_bruto,
        total_descontos = 0,
        status = CASE WHEN v_situacao = 'Calculado' THEN 'calculado'::status_calculo ELSE 'rascunho'::status_calculo END,
        versao = v_versao,
        calculado_em = now(),
        observacoes = v_situacao,
        quantidade_presencas = v_qtd,
        updated_at = now()
      WHERE id = v_calculo_id;
    ELSE
      INSERT INTO public.calculos (
        competencia_id, preceptor_id, modalidade,
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

    -- Insere itens do calculo
    IF jsonb_array_length(v_itens) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_to_recordset(v_itens) AS x(
        tipo text, regra_id uuid, descricao text, quantidade integer,
        valor_unitario numeric(14,2), valor_total numeric(14,2)
      )
      LOOP
        INSERT INTO public.calculo_itens (
          calculo_id, tipo, regra_id, descricao, quantidade,
          valor_unitario, referencia
        ) VALUES (
          v_calculo_id, v_item.tipo::tipo_item_calculo, v_item.regra_id,
          v_item.descricao, v_item.quantidade, v_item.valor_unitario,
          jsonb_build_object(
            'competencia', v_presenca.ano || '/' || LPAD(v_presenca.mes::text, 2, '0'),
            'regra_nome', v_regra_nome,
            'preceptor_id', v_presenca.preceptor_id,
            'tipo_atuacao', v_presenca.tipo_atuacao
          )
        );
      END LOOP;
    END IF;

    -- Monta linha da fila
    v_row := jsonb_build_object(
      'calculo_id', v_calculo_id,
      'preceptor_id', v_presenca.preceptor_id,
      'competencia_id', v_competencia_id,
      'mes', v_presenca.mes,
      'ano', v_presenca.ano,
      'tipo_atuacao', v_presenca.tipo_atuacao,
      'vinculo_adm_id', v_presenca.vinculo_adm_id,
      'vinculo_internato_id', v_presenca.vinculo_internato_id,
      'unidade_nome', COALESCE(v_unidade_nome, '-'),
      'disciplina_nome', COALESCE(v_disciplina_nome, '-'),
      'internato_nome', COALESCE(v_internato_nome, '-'),
      'local_nome', COALESCE(v_local_nome, '-'),
      'quantidade_presencas', v_qtd,
      'regra_nome', COALESCE(v_regra_nome, 'Regra financeira pendente'),
      'regra_situacao', v_regra_situacao,
      'total_bruto', v_total_bruto,
      'situacao', v_situacao,
      'versao', v_versao
    );

    v_resultado := v_resultado || v_row;
  END LOOP;

  RETURN v_resultado;
END;
$$;

-- 6. RPC: atualizar_chamado
-- Atualiza campos do chamado sem modificar o calculo.

CREATE OR REPLACE FUNCTION public.atualizar_chamado(
  p_calculo_id uuid,
  p_chamado_numero text DEFAULT NULL,
  p_chamado_status text DEFAULT NULL,
  p_chamado_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.calculos WHERE id = p_calculo_id) THEN
    RETURN jsonb_build_object('erro', 'Calculo nao encontrado.');
  END IF;

  UPDATE public.calculos SET
    chamado_numero = COALESCE(p_chamado_numero, chamado_numero),
    chamado_status = COALESCE(p_chamado_status, chamado_status),
    chamado_observacao = COALESCE(p_chamado_observacao, chamado_observacao),
    chamado_updated_at = now(),
    chamado_updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_calculo_id;

  RETURN jsonb_build_object('ok', true, 'calculo_id', p_calculo_id);
END;
$$;

-- 7. RPC: buscar_fila_financeira
-- Busca a fila financeira com dados completos para exibicao.

CREATE OR REPLACE FUNCTION public.buscar_fila_financeira(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_modalidade text DEFAULT NULL,
  p_situacao text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resultado jsonb := '[]'::jsonb;
  v_row jsonb;
  v_calc record;
  v_preceptor_nome text;
  v_unidade_nome text;
  v_disciplina_nome text;
  v_internato_nome text;
  v_local_nome text;
  v_regra_nome text;
  v_mes_comp integer;
  v_ano_comp integer;
BEGIN
  FOR v_calc IN
    SELECT c.*, p.nome_completo AS preceptor_nome
    FROM public.calculos c
    JOIN public.preceptores p ON p.id = c.preceptor_id
    WHERE c.competencia_id IS NOT NULL
      AND (p_mes IS NULL OR EXISTS (
        SELECT 1 FROM public.competencias co WHERE co.id = c.competencia_id AND co.mes = p_mes
      ))
      AND (p_ano IS NULL OR EXISTS (
        SELECT 1 FROM public.competencias co WHERE co.id = c.competencia_id AND co.ano = p_ano
      ))
      AND (p_modalidade IS NULL OR c.modalidade = p_modalidade)
      AND (p_situacao IS NULL OR c.chamado_status = p_situacao)
      AND (p_search IS NULL OR p.nome_completo ILIKE '%' || p_search || '%')
    ORDER BY c.created_at DESC
  LOOP
    v_unidade_nome := NULL;
    v_disciplina_nome := NULL;
    v_internato_nome := NULL;
    v_local_nome := NULL;
    v_regra_nome := NULL;

    -- Busca contexto do vinculo
    IF v_calc.modalidade = 'adm' AND v_calc.vinculo_adm_id IS NOT NULL THEN
      SELECT u.nome, d.nome, l.nome
      INTO v_unidade_nome, v_disciplina_nome, v_local_nome
      FROM public.vinculos_adm va
      LEFT JOIN public.unidades u ON u.id = va.unidade_id
      LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
      LEFT JOIN public.locais l ON l.id = va.local_id
      WHERE va.id = v_calc.vinculo_adm_id;
    ELSIF v_calc.modalidade = 'internato' AND v_calc.vinculo_internato_id IS NOT NULL THEN
      SELECT u.nome, i.nome, l.nome
      INTO v_unidade_nome, v_internato_nome, v_local_nome
      FROM public.vinculos_internato vi
      LEFT JOIN public.unidades u ON u.id = vi.unidade_id
      LEFT JOIN public.internatos i ON i.id = vi.internato_id
      LEFT JOIN public.locais l ON l.id = vi.local_id
      WHERE vi.id = v_calc.vinculo_internato_id;
    END IF;

    -- Busca regra
    IF v_calc.modalidade = 'adm' AND v_calc.vinculo_adm_id IS NOT NULL THEN
      SELECT rf.nome INTO v_regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_adm_id = v_calc.vinculo_adm_id AND vrf.status = 'ativo'
      LIMIT 1;
    ELSIF v_calc.modalidade = 'internato' AND v_calc.vinculo_internato_id IS NOT NULL THEN
      SELECT rf.nome INTO v_regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_internato_id = v_calc.vinculo_internato_id AND vrf.status = 'ativo'
      LIMIT 1;
    END IF;

    -- Busca competencia
    SELECT ano, mes INTO v_ano_comp, v_mes_comp
    FROM public.competencias WHERE id = v_calc.competencia_id;

    v_row := jsonb_build_object(
      'id', v_calc.id,
      'preceptor_id', v_calc.preceptor_id,
      'preceptor_nome', v_calc.preceptor_nome,
      'mes', v_mes_comp,
      'ano', v_ano_comp,
      'modalidade', v_calc.modalidade,
      'unidade_nome', COALESCE(v_unidade_nome, '-'),
      'disciplina_nome', COALESCE(v_disciplina_nome, '-'),
      'internato_nome', COALESCE(v_internato_nome, '-'),
      'local_nome', COALESCE(v_local_nome, '-'),
      'quantidade_presencas', v_calc.quantidade_presencas,
      'regra_nome', COALESCE(v_regra_nome, 'Regra financeira pendente'),
      'total_bruto', v_calc.total_bruto,
      'status', v_calc.status,
      'observacoes', v_calc.observacoes,
      'chamado_numero', v_calc.chamado_numero,
      'chamado_status', v_calc.chamado_status,
      'chamado_observacao', v_calc.chamado_observacao,
      'versao', v_calc.versao,
      'calculado_em', v_calc.calculado_em
    );

    v_resultado := v_resultado || v_row;
  END LOOP;

  RETURN v_resultado;
END;
$$;
