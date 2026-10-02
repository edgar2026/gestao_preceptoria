-- ============================================================
-- Migration 047: RPCs para Refazer Fluxo (Prévia + Limpeza)
-- ============================================================
-- Cria duas RPCs:
--   1. previa_refazer_fluxo  — Retorna preview sem excluir nada
--   2. refazer_fluxo_competencia — Executa limpeza transacional
--
-- Regras:
--   - Somente admin autorizado pode executar
--   - Bloqueia se existir pagamento com situacao 'pago'
--   - Escalas com datas fora da competência: preserva escala, remove apenas itens/presenças dentro do período
--   - Não executa recálculo automático
--   - Rollback completo se qualquer exclusão falhar
-- ============================================================

-- ============================================================
-- 1. RPC: previa_refazer_fluxo (preview sem excluir)
-- ============================================================
CREATE OR REPLACE FUNCTION public.previa_refazer_fluxo(
  p_competencia_id UUID,
  p_preceptor_id UUID DEFAULT NULL,
  p_tipo_atuacao TEXT DEFAULT NULL,
  p_vinculo_adm_id UUID DEFAULT NULL,
  p_vinculo_internato_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competencia RECORD;
  v_admin_check BOOLEAN;
  v_resultado JSONB;
  v_calculos RECORD;
  v_calculo_ids UUID[];
  v_blocked BOOLEAN := FALSE;
  v_block_reason TEXT := '';
  v_total_calculos INT := 0;
  v_total_itens INT := 0;
  v_total_solicitacoes INT := 0;
  v_total_eventos INT := 0;
  v_total_aprovacoes INT := 0;
  v_total_saldo_movimentos INT := 0;
  v_total_processo_calculos INT := 0;
  v_total_presencas INT := 0;
  v_total_escalas_itens INT := 0;
  v_total_escalas_removidas INT := 0;
  v_total_escalas_preservadas INT := 0;
  v_escalas_afetadas JSONB := '[]'::jsonb;
  v_calculos_detalhes JSONB := '[]'::jsonb;
BEGIN
  -- Verificar se é admin
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente administradores podem executar esta operação.';
  END IF;

  -- Validar competência
  SELECT * INTO v_competencia
  FROM public.competencias
  WHERE id = p_competencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competência não encontrada: %', p_competencia_id;
  END IF;

  -- Buscar cálculos que serão afetados
  FOR v_calculos IN
    SELECT
      c.id AS calculo_id,
      c.preceptor_id,
      c.tipo_atuacao,
      c.vinculo_adm_id,
      c.vinculo_internato_id,
      c.total_bruto,
      c.total_descontos,
      c.total_liquido,
      c.status AS calculo_status,
      c.versao,
      p.nome_completo AS preceptor_nome,
      CASE
        WHEN c.tipo_atuacao = 'internato' THEN vi_internato.local_id
        WHEN c.tipo_atuacao = 'adm' THEN vi_adm.local_id
      END AS local_id,
      CASE
        WHEN c.tipo_atuacao = 'internato' THEN l_internato.nome
        WHEN c.tipo_atuacao = 'adm' THEN l_adm.nome
      END AS local_nome
    FROM public.calculos c
    JOIN public.preceptores p ON p.id = c.preceptor_id
    LEFT JOIN public.vinculos_internato vi_internato ON vi_internato.id = c.vinculo_internato_id
    LEFT JOIN public.locais l_internato ON l_internato.id = vi_internato.local_id
    LEFT JOIN public.vinculos_adm vi_adm ON vi_adm.id = c.vinculo_adm_id
    LEFT JOIN public.locais l_adm ON l_adm.id = vi_adm.local_id
    WHERE c.competencia_id = p_competencia_id
      AND (p_preceptor_id IS NULL OR c.preceptor_id = p_preceptor_id)
      AND (p_tipo_atuacao IS NULL OR c.tipo_atuacao::text = p_tipo_atuacao)
      AND (p_vinculo_adm_id IS NULL OR c.vinculo_adm_id = p_vinculo_adm_id)
      AND (p_vinculo_internato_id IS NULL OR c.vinculo_internato_id = p_vinculo_internato_id)
    ORDER BY p.nome_completo, c.tipo_atuacao
  LOOP
    v_calculo_ids := array_append(v_calculo_ids, v_calculos.calculo_id);
    v_total_calculos := v_total_calculos + 1;

    -- Contar itens do cálculo
    SELECT COUNT(*) INTO v_total_itens
    FROM public.calculo_itens ci
    WHERE ci.calculo_id = v_calculos.calculo_id;

    -- Contar solicitações de NF
    SELECT COUNT(*) INTO v_total_solicitacoes
    FROM public.solicitacoes_nota_fiscal snf
    WHERE snf.calculo_id = v_calculos.calculo_id;

    -- Verificar bloqueio por pagamento
    IF v_calculos.calculo_status = 'pago' THEN
      v_blocked := TRUE;
      v_block_reason := 'Existe cálculo com situação "pago" para o preceptor ' || v_calculos.preceptor_nome || '. Não é possível refazer o fluxo.';
    END IF;

    -- Contar eventos de NF
    SELECT COUNT(*) INTO v_total_eventos
    FROM public.solicitacao_nota_fiscal_eventos snfe
    WHERE snfe.calculo_id = v_calculos.calculo_id;

    -- Contar aprovações
    SELECT COUNT(*) INTO v_total_aprovacoes
    FROM public.aprovacoes a
    WHERE a.calculo_id = v_calculos.calculo_id;

    -- Contar saldo_movimentos
    SELECT COUNT(*) INTO v_total_saldo_movimentos
    FROM public.saldo_movimentos sm
    WHERE sm.calculo_id = v_calculos.calculo_id;

    -- Contar processo_calculos
    SELECT COUNT(*) INTO v_total_processo_calculos
    FROM public.processo_calculos pc
    WHERE pc.calculo_id = v_calculos.calculo_id;

    -- Adicionar detalhe do cálculo
    v_calculos_detalhes := v_calculos_detalhes || jsonb_build_object(
      'calculo_id', v_calculos.calculo_id,
      'preceptor_id', v_calculos.preceptor_id,
      'preceptor_nome', v_calculos.preceptor_nome,
      'tipo_atuacao', v_calculos.tipo_atuacao,
      'vinculo_adm_id', v_calculos.vinculo_adm_id,
      'vinculo_internato_id', v_calculos.vinculo_internato_id,
      'local_nome', v_calculos.local_nome,
      'total_bruto', v_calculos.total_bruto,
      'total_descontos', v_calculos.total_descontos,
      'total_liquido', v_calculos.total_liquido,
      'calculo_status', v_calculos.calculo_status,
      'versao', v_calculos.versao,
      'itens_count', v_total_itens,
      'solicitacoes_count', v_total_solicitacoes,
      'eventos_count', v_total_eventos,
      'aprovacoes_count', v_total_aprovacoes,
      'saldo_movimentos_count', v_total_saldo_movimentos,
      'processo_calculos_count', v_total_processo_calculos
    );
  END LOOP;

  -- Contar presenças dentro da competência
  SELECT COUNT(*) INTO v_total_presencas
  FROM public.presencas pr
  WHERE pr.data_presenca >= v_competencia.data_inicio
    AND pr.data_presenca <= v_competencia.data_fim
    AND (p_preceptor_id IS NULL OR pr.preceptor_id = p_preceptor_id)
    AND (p_tipo_atuacao IS NULL OR pr.tipo_atuacao::text = p_tipo_atuacao)
    AND (p_vinculo_adm_id IS NULL OR pr.vinculo_adm_id = p_vinculo_adm_id)
    AND (p_vinculo_internato_id IS NULL OR pr.vinculo_internato_id = p_vinculo_internato_id);

  -- Analisar escalas afetadas
  FOR v_calculos IN
    SELECT DISTINCT
      e.id AS escala_id,
      e.data_inicio,
      e.data_fim,
      e.vinculo_internato_id,
      e.vinculo_adm_id,
      e.tipo_atuacao,
      p.nome_completo AS preceptor_nome,
      CASE
        WHEN e.tipo_atuacao = 'internato' THEN vi_internato.local_id
        WHEN e.tipo_atuacao = 'adm' THEN vi_adm.local_id
      END AS local_id,
      CASE
        WHEN e.tipo_atuacao = 'internato' THEN l_internato.nome
        WHEN e.tipo_atuacao = 'adm' THEN l_adm.nome
      END AS local_nome
    FROM public.escalas e
    JOIN public.preceptores p ON (
      (e.tipo_atuacao = 'internato' AND e.vinculo_internato_id IN (
        SELECT vi2.id FROM public.vinculos_internato vi2 WHERE vi2.preceptor_id = p.id
      ))
      OR
      (e.tipo_atuacao = 'adm' AND e.vinculo_adm_id IN (
        SELECT va2.id FROM public.vinculos_adm va2 WHERE va2.preceptor_id = p.id
      ))
    )
    LEFT JOIN public.vinculos_internato vi_internato ON vi_internato.id = e.vinculo_internato_id
    LEFT JOIN public.locais l_internato ON l_internato.id = vi_internato.local_id
    LEFT JOIN public.vinculos_adm vi_adm ON vi_adm.id = e.vinculo_adm_id
    LEFT JOIN public.locais l_adm ON l_adm.id = vi_adm.local_id
    WHERE e.status = 'ativo'
      AND e.data_inicio <= v_competencia.data_fim
      AND (e.data_fim IS NULL OR e.data_fim >= v_competencia.data_inicio)
      AND (p_preceptor_id IS NULL OR p.id = p_preceptor_id)
      AND (p_tipo_atuacao IS NULL OR e.tipo_atuacao::text = p_tipo_atuacao)
      AND (p_vinculo_adm_id IS NULL OR e.vinculo_adm_id = p_vinculo_adm_id)
      AND (p_vinculo_internato_id IS NULL OR e.vinculo_internato_id = p_vinculo_internato_id)
  LOOP
    -- Contar itens da escala dentro da competência
    SELECT COUNT(*) INTO v_total_escalas_itens
    FROM public.escalas_itens ei
    WHERE ei.escala_id = v_calculos.escala_id
      AND ei.data >= v_competencia.data_inicio
      AND ei.data <= v_competencia.data_fim;

    -- Verificar se a escala tem itens fora da competência
    IF v_calculos.data_inicio < v_competencia.data_inicio
       OR (v_calculos.data_fim IS NOT NULL AND v_calculos.data_fim > v_competencia.data_fim) THEN
      -- Escala preservada (tem datas fora da competência)
      v_total_escalas_preservadas := v_total_escalas_preservadas + 1;
      v_escalas_afetadas := v_escalas_afetadas || jsonb_build_object(
        'escala_id', v_calculos.escala_id,
        'preceptor_nome', v_calculos.preceptor_nome,
        'local_nome', v_calculos.local_nome,
        'tipo_atuacao', v_calculos.tipo_atuacao,
        'data_inicio', v_calculos.data_inicio,
        'data_fim', v_calculos.data_fim,
        'itens_dentro_competencia', v_total_escalas_itens,
        'preservada', TRUE,
        'motivo', 'Escala possui datas fora da competência'
      );
    ELSE
      -- Escala será removida (totalmente dentro da competência)
      v_total_escalas_removidas := v_total_escalas_removidas + 1;
      v_escalas_afetadas := v_escalas_afetadas || jsonb_build_object(
        'escala_id', v_calculos.escala_id,
        'preceptor_nome', v_calculos.preceptor_nome,
        'local_nome', v_calculos.local_nome,
        'tipo_atuacao', v_calculos.tipo_atuacao,
        'data_inicio', v_calculos.data_inicio,
        'data_fim', v_calculos.data_fim,
        'itens_dentro_competencia', v_total_escalas_itens,
        'preservada', FALSE,
        'motivo', 'Escala totalmente dentro da competência'
      );
    END IF;
  END LOOP;

  -- Montar resultado
  v_resultado := jsonb_build_object(
    'competencia', jsonb_build_object(
      'id', v_competencia.id,
      'ano', v_competencia.ano,
      'mes', v_competencia.mes,
      'data_inicio', v_competencia.data_inicio,
      'data_fim', v_competencia.data_fim,
      'status', v_competencia.status
    ),
    'filtros', jsonb_build_object(
      'preceptor_id', p_preceptor_id,
      'tipo_atuacao', p_tipo_atuacao,
      'vinculo_adm_id', p_vinculo_adm_id,
      'vinculo_internato_id', p_vinculo_internato_id
    ),
    'resumo', jsonb_build_object(
      'total_calculos', v_total_calculos,
      'total_itens', v_total_itens,
      'total_solicitacoes_nf', v_total_solicitacoes,
      'total_eventos_nf', v_total_eventos,
      'total_aprovacoes', v_total_aprovacoes,
      'total_saldo_movimentos', v_total_saldo_movimentos,
      'total_processo_calculos', v_total_processo_calculos,
      'total_presencas', v_total_presencas,
      'total_escalas_removidas', v_total_escalas_removidas,
      'total_escalas_preservadas', v_total_escalas_preservadas
    ),
    'bloqueado', v_blocked,
    'motivo_bloqueio', v_block_reason,
    'calculos', v_calculos_detalhes,
    'escalas', v_escalas_afetadas
  );

  RETURN v_resultado;
END;
$$;

-- ============================================================
-- 2. RPC: refazer_fluxo_competencia (limpeza transacional)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refazer_fluxo_competencia(
  p_competencia_id UUID,
  p_preceptor_id UUID DEFAULT NULL,
  p_tipo_atuacao TEXT DEFAULT NULL,
  p_vinculo_adm_id UUID DEFAULT NULL,
  p_vinculo_internato_id UUID DEFAULT NULL,
  p_confirmar BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competencia RECORD;
  v_admin_check BOOLEAN;
  v_calculo RECORD;
  v_calculo_ids UUID[];
  v_escala RECORD;
  v_blocked BOOLEAN := FALSE;
  v_block_reason TEXT := '';
  v_total_calculos_removidos INT := 0;
  v_total_itens_removidos INT := 0;
  v_total_solicitacoes_removidas INT := 0;
  v_total_eventos_removidos INT := 0;
  v_total_aprovacoes_removidas INT := 0;
  v_total_saldo_movimentos_removidos INT := 0;
  v_total_processo_calculos_removidos INT := 0;
  v_total_presencas_removidas INT := 0;
  v_total_escalas_itens_removidos INT := 0;
  v_total_escalas_removidas INT := 0;
  v_total_escalas_preservadas INT := 0;
  v_escalas_afetadas JSONB := '[]'::jsonb;
  v_erro TEXT;
BEGIN
  -- Verificar se é admin
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente administradores podem executar esta operação.';
  END IF;

  -- Validar competência
  SELECT * INTO v_competencia
  FROM public.competencias
  WHERE id = p_competencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competência não encontrada: %', p_competencia_id;
  END IF;

  -- Se não confirmou, retornar apenas aviso (deve chamar previa primeiro)
  IF p_confirmar IS NOT TRUE THEN
    RAISE EXCEPTION 'Operação não confirmada. Chame previa_refazer_fluxo primeiro e passe p_confirmar = TRUE.';
  END IF;

  -- Verificar bloqueio por pagamento
  FOR v_calculo IN
    SELECT c.id, c.status, p.nome_completo
    FROM public.calculos c
    JOIN public.preceptores p ON p.id = c.preceptor_id
    WHERE c.competencia_id = p_competencia_id
      AND (p_preceptor_id IS NULL OR c.preceptor_id = p_preceptor_id)
      AND (p_tipo_atuacao IS NULL OR c.tipo_atuacao::text = p_tipo_atuacao)
      AND (p_vinculo_adm_id IS NULL OR c.vinculo_adm_id = p_vinculo_adm_id)
      AND (p_vinculo_internato_id IS NULL OR c.vinculo_internato_id = p_vinculo_internato_id)
      AND c.status = 'pago'
  LOOP
    v_blocked := TRUE;
    v_block_reason := 'Existe cálculo com situação "pago" para o preceptor ' || v_calculo.nome_completo || '. Não é possível refazer o fluxo.';
    EXIT;
  END LOOP;

  IF v_blocked THEN
    RAISE EXCEPTION '%', v_block_reason;
  END IF;

  -- Coletar IDs dos cálculos a serem removidos
  SELECT array_agg(c.id) INTO v_calculo_ids
  FROM public.calculos c
  WHERE c.competencia_id = p_competencia_id
    AND (p_preceptor_id IS NULL OR c.preceptor_id = p_preceptor_id)
    AND (p_tipo_atuacao IS NULL OR c.tipo_atuacao::text = p_tipo_atuacao)
    AND (p_vinculo_adm_id IS NULL OR c.vinculo_adm_id = p_vinculo_adm_id)
    AND (p_vinculo_internato_id IS NULL OR c.vinculo_internato_id = p_vinculo_internato_id);

  IF v_calculo_ids IS NULL OR array_length(v_calculo_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Nenhum cálculo encontrado para os filtros informados.';
  END IF;

  -- ============================================================
  -- INÍCIO DA LIMPEZA TRANSACIONAL
  -- Ordem: saldo_movimentos -> processo_calculos -> aprovacoes
  --        -> eventos_nf -> solicitacoes_nf -> calculo_itens
  --        -> calculos -> presencas -> escalas_itens -> escalas
  -- ============================================================

  -- 1. Remover saldo_movimentos
  DELETE FROM public.saldo_movimentos sm
  WHERE sm.calculo_id = ANY(v_calculo_ids);
  GET DIAGNOSTICS v_total_saldo_movimentos_removidos = ROW_COUNT;

  -- 2. Remover processo_calculos
  DELETE FROM public.processo_calculos pc
  WHERE pc.calculo_id = ANY(v_calculo_ids);
  GET DIAGNOSTICS v_total_processo_calculos_removidos = ROW_COUNT;

  -- 3. Remover aprovações
  DELETE FROM public.aprovacoes a
  WHERE a.calculo_id = ANY(v_calculo_ids);
  GET DIAGNOSTICS v_total_aprovacoes_removidos = ROW_COUNT;

  -- 4. Remover eventos de NF (via solicitacao_id)
  DELETE FROM public.solicitacao_nota_fiscal_eventos snfe
  WHERE snfe.solicitacao_id IN (
    SELECT snf.id FROM public.solicitacoes_nota_fiscal snf
    WHERE snf.calculo_id = ANY(v_calculo_ids)
  );
  GET DIAGNOSTICS v_total_eventos_removidos = ROW_COUNT;

  -- 5. Remover solicitações de NF
  DELETE FROM public.solicitacoes_nota_fiscal snf
  WHERE snf.calculo_id = ANY(v_calculo_ids);
  GET DIAGNOSTICS v_total_solicitacoes_removidas = ROW_COUNT;

  -- 6. Remover itens de cálculo
  DELETE FROM public.calculo_itens ci
  WHERE ci.calculo_id = ANY(v_calculo_ids);
  GET DIAGNOSTICS v_total_itens_removidos = ROW_COUNT;

  -- 7. Remover cálculos
  DELETE FROM public.calculos c
  WHERE c.id = ANY(v_calculo_ids);
  GET DIAGNOSTICS v_total_calculos_removidos = ROW_COUNT;

  -- 8. Remover presenças dentro da competência
  DELETE FROM public.presencas pr
  WHERE pr.data_presenca >= v_competencia.data_inicio
    AND pr.data_presenca <= v_competencia.data_fim
    AND (p_preceptor_id IS NULL OR pr.preceptor_id = p_preceptor_id)
    AND (p_tipo_atuacao IS NULL OR pr.tipo_atuacao::text = p_tipo_atuacao)
    AND (p_vinculo_adm_id IS NULL OR pr.vinculo_adm_id = p_vinculo_adm_id)
    AND (p_vinculo_internato_id IS NULL OR pr.vinculo_internato_id = p_vinculo_internato_id);
  GET DIAGNOSTICS v_total_presencas_removidas = ROW_COUNT;

  -- 9. Processar escalas afetadas
  FOR v_escala IN
    SELECT DISTINCT
      e.id AS escala_id,
      e.data_inicio,
      e.data_fim,
      e.tipo_atuacao,
      p.nome_completo AS preceptor_nome,
      CASE
        WHEN e.tipo_atuacao = 'internato' THEN l_internato.nome
        WHEN e.tipo_atuacao = 'adm' THEN l_adm.nome
      END AS local_nome
    FROM public.escalas e
    JOIN public.preceptores p ON (
      (e.tipo_atuacao = 'internato' AND e.vinculo_internato_id IN (
        SELECT vi2.id FROM public.vinculos_internato vi2 WHERE vi2.preceptor_id = p.id
      ))
      OR
      (e.tipo_atuacao = 'adm' AND e.vinculo_adm_id IN (
        SELECT va2.id FROM public.vinculos_adm va2 WHERE va2.preceptor_id = p.id
      ))
    )
    LEFT JOIN public.vinculos_internato vi_internato ON vi_internato.id = e.vinculo_internato_id
    LEFT JOIN public.locais l_internato ON l_internato.id = vi_internato.local_id
    LEFT JOIN public.vinculos_adm vi_adm ON vi_adm.id = e.vinculo_adm_id
    LEFT JOIN public.locais l_adm ON l_adm.id = vi_adm.local_id
    WHERE e.status = 'ativo'
      AND e.data_inicio <= v_competencia.data_fim
      AND (e.data_fim IS NULL OR e.data_fim >= v_competencia.data_inicio)
      AND (p_preceptor_id IS NULL OR p.id = p_preceptor_id)
      AND (p_tipo_atuacao IS NULL OR e.tipo_atuacao::text = p_tipo_atuacao)
      AND (p_vinculo_adm_id IS NULL OR e.vinculo_adm_id = p_vinculo_adm_id)
      AND (p_vinculo_internato_id IS NULL OR e.vinculo_internato_id = p_vinculo_internato_id)
  LOOP
    -- Verificar se a escala tem itens fora da competência
    IF v_escala.data_inicio < v_competencia.data_inicio
       OR (v_escala.data_fim IS NOT NULL AND v_escala.data_fim > v_competencia.data_fim) THEN
      -- Escala preservada: remover apenas itens dentro da competência
      DELETE FROM public.escalas_itens ei
      WHERE ei.escala_id = v_escala.escala_id
        AND ei.data >= v_competencia.data_inicio
        AND ei.data <= v_competencia.data_fim;
      GET DIAGNOSTICS v_total_escalas_itens_removidos = ROW_COUNT;

      v_total_escalas_preservadas := v_total_escalas_preservadas + 1;
      v_escalas_afetadas := v_escalas_afetadas || jsonb_build_object(
        'escala_id', v_escala.escala_id,
        'preceptor_nome', v_escala.preceptor_nome,
        'local_nome', v_escala.local_nome,
        'tipo_atuacao', v_escala.tipo_atuacao,
        'preservada', TRUE,
        'itens_removidos', v_total_escalas_itens_removidos
      );
    ELSE
      -- Escala totalmente dentro da competência: remover tudo
      DELETE FROM public.escalas_itens ei
      WHERE ei.escala_id = v_escala.escala_id;
      GET DIAGNOSTICS v_total_escalas_itens_removidos = ROW_COUNT;

      DELETE FROM public.escalas e
      WHERE e.id = v_escala.escala_id;
      GET DIAGNOSTICS v_total_escalas_removidas = ROW_COUNT;

      v_escalas_afetadas := v_escalas_afetadas || jsonb_build_object(
        'escala_id', v_escala.escala_id,
        'preceptor_nome', v_escala.preceptor_nome,
        'local_nome', v_escala.local_nome,
        'tipo_atuacao', v_escala.tipo_atuacao,
        'preservada', FALSE,
        'itens_removidos', v_total_escalas_itens_removidos,
        'escala_removida', TRUE
      );
    END IF;
  END LOOP;

  -- Montar resultado
  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'mensagem', 'Fluxo refazido com sucesso. Execute auto_apurar_competencia_financeira para recalcular.',
    'competencia', jsonb_build_object(
      'id', v_competencia.id,
      'ano', v_competencia.ano,
      'mes', v_competencia.mes
    ),
    'resumo', jsonb_build_object(
      'calculos_removidos', v_total_calculos_removidos,
      'itens_removidos', v_total_itens_removidos,
      'solicitacoes_nf_removidas', v_total_solicitacoes_removidas,
      'eventos_nf_removidos', v_total_eventos_removidos,
      'aprovacoes_removidas', v_total_aprovacoes_removidos,
      'saldo_movimentos_removidos', v_total_saldo_movimentos_removidos,
      'processo_calculos_removidos', v_total_processo_calculos_removidos,
      'presencas_removidas', v_total_presencas_removidas,
      'escalas_itens_removidos', v_total_escalas_itens_removidos,
      'escalas_removidas', v_total_escalas_removidas,
      'escalas_preservadas', v_total_escalas_preservadas
    ),
    'escalas', v_escalas_afetadas
  );
END;
$$;

-- ============================================================
-- Permissões: somente authenticated pode executar
-- ============================================================
REVOKE ALL ON FUNCTION public.previa_refazer_fluxo(UUID, UUID, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.previa_refazer_fluxo(UUID, UUID, TEXT, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.refazer_fluxo_competencia(UUID, UUID, TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refazer_fluxo_competencia(UUID, UUID, TEXT, UUID, UUID, BOOLEAN) TO authenticated;
