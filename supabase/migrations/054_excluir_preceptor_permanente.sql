-- ============================================================
-- Migration 054: Excluir preceptor permanentemente
-- ============================================================
-- Etapa EXCLUIR-PRECEPTOR-PERMANENTEMENTE — Cadastro do Preceptor
--
-- Permite que somente o Administrador exclua permanentemente um
-- preceptor criado incorretamente, para cadastrá-lo novamente do zero.
--
-- A exclusão:
--   - é permanente (não arquiva, não envia para Arquivados);
--   - não afeta outros preceptores;
--   - remove todos os vínculos e dados dependentes.
--
-- Escopo da remoção (somente do preceptor escolhido):
--   - vínculos (Prática e Internato) e suas associações
--     (coordenadores, locais, regra financeira do vínculo)
--   - escalas e itens das escalas dos vínculos
--   - presenças e ajustes de presença
--   - cálculos e itens de cálculo
--   - revisões financeiras (aprovacoes)
--   - solicitações/eventos/itens fiscais do preceptor
--   - pagamentos não concluídos, processos e movimentos de saldo
--   - documentos/arquivos, favorecidos, acesso por token,
--     rateios, regras e vínculos de regra do preceptor
--   - o próprio cadastro do preceptor
--
-- Regras:
--   - Somente Administrador pode executar
--   - Pagamento concluído bloqueia a exclusão
--   - RPC transacional: qualquer falha gera rollback total
--   - Não executar DELETE direto pelo frontend
--   - Perfil/usuário (profiles/auth) não é excluído por aqui
-- ============================================================

BEGIN;

-- ============================================================
-- 1. fn_excluir_preceptor_bloqueio (pagamento concluído bloqueia)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_excluir_preceptor_bloqueio(p_preceptor_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motivo text;
  v_nome text;
BEGIN
  SELECT nome_completo INTO v_nome FROM public.preceptores WHERE id = p_preceptor_id;
  IF v_nome IS NULL THEN
    RETURN 'Preceptor não encontrado.';
  END IF;

  -- Cálculo já pago
  SELECT 'Existe cálculo com situação "pago" para ' || trim(v_nome) || '. Pagamento concluído bloqueia a exclusão permanente do preceptor.'
  INTO v_motivo
  FROM public.calculos c
  WHERE c.preceptor_id = p_preceptor_id AND c.status = 'pago'
  LIMIT 1;
  IF v_motivo IS NOT NULL THEN RETURN v_motivo; END IF;

  -- Solicitação de nota fiscal paga
  SELECT 'Existe solicitação de nota fiscal com situação "pago" para ' || trim(v_nome) || '. Pagamento concluído bloqueia a exclusão permanente do preceptor.'
  INTO v_motivo
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.preceptor_id = p_preceptor_id AND s.situacao = 'pago'
  LIMIT 1;
  IF v_motivo IS NOT NULL THEN RETURN v_motivo; END IF;

  -- Pagamento concluído (pago) dos cálculos do preceptor
  SELECT 'Existe pagamento concluído ("pago") para ' || trim(v_nome) || '. Pagamento concluído bloqueia a exclusão permanente do preceptor.'
  INTO v_motivo
  FROM public.pagamentos pgto
  JOIN public.processo_calculos pc ON pc.processo_id = pgto.processo_id
  JOIN public.calculos c ON c.id = pc.calculo_id
  WHERE pgto.status = 'pago' AND c.preceptor_id = p_preceptor_id
  LIMIT 1;
  IF v_motivo IS NOT NULL THEN RETURN v_motivo; END IF;

  -- Processo de pagamento concluído
  SELECT 'Existe processo de pagamento concluído para ' || trim(v_nome) || '. Pagamento concluído bloqueia a exclusão permanente do preceptor.'
  INTO v_motivo
  FROM public.processos_pagamento pp
  JOIN public.processo_calculos pc ON pc.processo_id = pp.id
  JOIN public.calculos c ON c.id = pc.calculo_id
  WHERE pp.status = 'concluido' AND c.preceptor_id = p_preceptor_id
  LIMIT 1;
  IF v_motivo IS NOT NULL THEN RETURN v_motivo; END IF;

  -- Baixa de saldo já realizada (consumo)
  SELECT 'Existe baixa de saldo (consumo) registrada para ' || trim(v_nome) || '. Pagamento concluído bloqueia a exclusão permanente do preceptor.'
  INTO v_motivo
  FROM public.saldo_movimentos sm
  JOIN public.calculos c ON c.id = sm.calculo_id
  WHERE sm.calculo_id IN (SELECT id FROM public.calculos WHERE preceptor_id = p_preceptor_id)
    AND sm.tipo = 'consumo'
  LIMIT 1;

  RETURN v_motivo;
END;
$$;

-- ============================================================
-- 2. RPC: previa_excluir_preceptor (prévia real, não altera nada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.previa_excluir_preceptor(
  p_preceptor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check boolean;
  v_preceptor record;
  v_vinc_adm_ids uuid[];
  v_vinc_int_ids uuid[];
  v_calc_ids uuid[];
  v_presenca_ids uuid[];
  v_escala_ids uuid[];
  v_ajuste_ids uuid[];
  v_sol_ids uuid[];
  v_proc_ids uuid[];
  v_bloqueio text;
  r jsonb;
  v_total_vinculos int;
  v_total_coordenadores int;
  v_total_escalas int;
  v_total_escalas_itens int;
  v_total_presencas int;
  v_total_calculos int;
  v_total_calculo_itens int;
  v_total_aprovacoes int;
  v_total_solicitacoes int;
  v_total_solicitacoes_itens int;
  v_total_solicitacoes_eventos int;
  v_total_pagamentos int;
  v_total_processo_calculos int;
  v_total_saldo_movimentos int;
  v_total_documentos int;
  v_total_favorecidos int;
  v_total_acesso int;
  v_total_rateios int;
  v_total_regra_preceptores int;
  v_total_regras_preceptor int;
  v_total_vinculo_locais int;
  v_total_vinculo_regras int;
  v_total_arquivos_registros int;
BEGIN
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role, 'admin_super'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente Administradores podem executar esta operação.';
  END IF;

  IF p_preceptor_id IS NULL THEN
    RAISE EXCEPTION 'Informe o preceptor a ser excluído.';
  END IF;

  SELECT id, nome_completo, cpf, email, status
  INTO v_preceptor
  FROM public.preceptores
  WHERE id = p_preceptor_id;

  IF v_preceptor.id IS NULL THEN
    RAISE EXCEPTION 'Preceptor não encontrado.';
  END IF;

  -- IDs do escopo real do preceptor
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_vinc_adm_ids
  FROM public.vinculos_adm WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_vinc_int_ids
  FROM public.vinculos_internato WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_calc_ids
  FROM public.calculos WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_presenca_ids
  FROM public.presencas WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(e.id), ARRAY[]::uuid[]) INTO v_escala_ids
  FROM public.escalas e
  WHERE (array_length(v_vinc_int_ids, 1) > 0 AND e.vinculo_internato_id = ANY(v_vinc_int_ids))
     OR (array_length(v_vinc_adm_ids, 1) > 0 AND e.vinculo_adm_id = ANY(v_vinc_adm_ids));

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ajuste_ids
  FROM public.ajustes_presenca WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(DISTINCT s.id), ARRAY[]::uuid[]) INTO v_sol_ids
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.preceptor_id = p_preceptor_id
     OR s.calculo_id = ANY(v_calc_ids)
     OR EXISTS (
       SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
       WHERE i.solicitacao_id = s.id AND i.calculo_id = ANY(v_calc_ids)
     );

  SELECT COALESCE(array_agg(DISTINCT pp.id), ARRAY[]::uuid[]) INTO v_proc_ids
  FROM public.processos_pagamento pp
  JOIN public.processo_calculos pc ON pc.processo_id = pp.id
  WHERE pc.calculo_id = ANY(v_calc_ids);

  v_bloqueio := public.fn_excluir_preceptor_bloqueio(p_preceptor_id);

  -- Contagens reais
  v_total_vinculos := coalesce(array_length(v_vinc_adm_ids, 1), 0) + coalesce(array_length(v_vinc_int_ids, 1), 0);

  SELECT count(*) INTO v_total_coordenadores
  FROM public.vinculo_coordenadores
  WHERE vinculo_internato_id = ANY(v_vinc_int_ids);

  SELECT count(*) INTO v_total_escalas FROM public.escalas WHERE id = ANY(v_escala_ids);
  SELECT count(*) INTO v_total_escalas_itens FROM public.escalas_itens WHERE escala_id = ANY(v_escala_ids);
  SELECT count(*) INTO v_total_presencas FROM public.presencas WHERE id = ANY(v_presenca_ids);
  SELECT count(*) INTO v_total_calculos FROM public.calculos WHERE id = ANY(v_calc_ids);
  SELECT count(*) INTO v_total_calculo_itens FROM public.calculo_itens WHERE calculo_id = ANY(v_calc_ids);

  SELECT count(*) INTO v_total_aprovacoes
  FROM public.aprovacoes
  WHERE calculo_id = ANY(v_calc_ids)
     OR ajuste_presenca_id = ANY(v_ajuste_ids);

  SELECT count(*) INTO v_total_solicitacoes FROM unnest(v_sol_ids);
  SELECT count(*) INTO v_total_solicitacoes_itens
  FROM public.solicitacao_nota_fiscal_itens
  WHERE solicitacao_id = ANY(v_sol_ids) OR calculo_id = ANY(v_calc_ids);
  SELECT count(*) INTO v_total_solicitacoes_eventos
  FROM public.solicitacao_nota_fiscal_eventos
  WHERE solicitacao_id = ANY(v_sol_ids) OR calculo_id = ANY(v_calc_ids);

  SELECT count(*) INTO v_total_pagamentos
  FROM public.pagamentos pgto WHERE pgto.processo_id = ANY(v_proc_ids);
  SELECT count(*) INTO v_total_processo_calculos
  FROM public.processo_calculos WHERE calculo_id = ANY(v_calc_ids);
  SELECT count(*) INTO v_total_saldo_movimentos
  FROM public.saldo_movimentos WHERE calculo_id = ANY(v_calc_ids);

  SELECT count(*) INTO v_total_documentos
  FROM public.preceptor_documentos WHERE preceptor_id = p_preceptor_id;
  SELECT count(*) INTO v_total_favorecidos
  FROM public.preceptor_favorecidos WHERE preceptor_id = p_preceptor_id;
  SELECT count(*) INTO v_total_acesso
  FROM public.preceptor_acesso_presenca WHERE preceptor_id = p_preceptor_id;
  SELECT count(*) INTO v_total_rateios
  FROM public.rateios_financeiros WHERE preceptor_id = p_preceptor_id;
  SELECT count(*) INTO v_total_regra_preceptores
  FROM public.regra_preceptores WHERE preceptor_id = p_preceptor_id;
  SELECT count(*) INTO v_total_regras_preceptor
  FROM public.regras_financeiras WHERE preceptor_id = p_preceptor_id;
  SELECT count(*) INTO v_total_vinculo_locais
  FROM public.vinculo_locais
  WHERE vinculo_internato_id = ANY(v_vinc_int_ids) OR vinculo_adm_id = ANY(v_vinc_adm_ids);
  SELECT count(*) INTO v_total_vinculo_regras
  FROM public.vinculo_regras_financeiras
  WHERE vinculo_internato_id = ANY(v_vinc_int_ids) OR vinculo_adm_id = ANY(v_vinc_adm_ids);

  v_total_arquivos_registros :=
    v_total_documentos + v_total_favorecidos + v_total_acesso + v_total_rateios
    + v_total_regra_preceptores + v_total_regras_preceptor
    + v_total_vinculo_locais + v_total_vinculo_regras;

  RETURN jsonb_build_object(
    'preceptor', jsonb_build_object(
      'id', v_preceptor.id,
      'nome', v_preceptor.nome_completo,
      'cpf', v_preceptor.cpf,
      'email', v_preceptor.email,
      'status', v_preceptor.status
    ),
    'resumo', jsonb_build_object(
      'total_vinculos', v_total_vinculos,
      'total_coordenadores', v_total_coordenadores,
      'total_escalas', v_total_escalas,
      'total_escalas_itens', v_total_escalas_itens,
      'total_presencas', v_total_presencas,
      'total_calculos', v_total_calculos,
      'total_calculo_itens', v_total_calculo_itens,
      'total_aprovacoes', v_total_aprovacoes,
      'total_solicitacoes', v_total_solicitacoes,
      'total_solicitacoes_itens', v_total_solicitacoes_itens,
      'total_solicitacoes_eventos', v_total_solicitacoes_eventos,
      'total_pagamentos', v_total_pagamentos,
      'total_processo_calculos', v_total_processo_calculos,
      'total_saldo_movimentos', v_total_saldo_movimentos,
      'total_documentos', v_total_documentos,
      'total_favorecidos', v_total_favorecidos,
      'total_acesso_presenca', v_total_acesso,
      'total_rateios', v_total_rateios,
      'total_regra_preceptores', v_total_regra_preceptores,
      'total_regras_preceptor', v_total_regras_preceptor,
      'total_vinculo_locais', v_total_vinculo_locais,
      'total_vinculo_regras', v_total_vinculo_regras,
      'total_arquivos_registros', v_total_arquivos_registros
    ),
    'bloqueado', v_bloqueio IS NOT NULL,
    'motivo_bloqueio', v_bloqueio
  );
END;
$$;

-- ============================================================
-- 3. RPC: excluir_preceptor (exclusão permanente transacional)
-- ============================================================
CREATE OR REPLACE FUNCTION public.excluir_preceptor(
  p_preceptor_id uuid,
  p_confirmar boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_check boolean;
  v_preceptor record;
  v_vinc_adm_ids uuid[];
  v_vinc_int_ids uuid[];
  v_calc_ids uuid[];
  v_presenca_ids uuid[];
  v_escala_ids uuid[];
  v_ajuste_ids uuid[];
  v_sol_ids uuid[];
  v_sol_com_itens uuid[];
  v_proc_ids uuid[];
  v_regra_ids uuid[];
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
  v_vinculo_locais_removidos int := 0;
  v_vinculo_regras_removidas int := 0;
  v_vinculos_adm_removidos int := 0;
  v_vinculos_int_removidos int := 0;
  v_rateios_removidos int := 0;
  v_regra_preceptores_removidos int := 0;
  v_regras_removidas int := 0;
  v_documentos_removidos int := 0;
  v_favorecidos_removidos int := 0;
  v_acesso_removidos int := 0;
  v_preceptor_removido int := 0;
  v_preceptor_json jsonb;
  v_resumo jsonb;
BEGIN
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role, 'admin_super'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente Administradores podem executar esta operação.';
  END IF;

  IF p_preceptor_id IS NULL THEN
    RAISE EXCEPTION 'Informe o preceptor a ser excluído.';
  END IF;

  IF p_confirmar IS NOT TRUE THEN
    RAISE EXCEPTION 'Operação não confirmada. Exibir a prévia e passe p_confirmar = TRUE.';
  END IF;

  SELECT id, nome_completo, cpf, email, status
  INTO v_preceptor
  FROM public.preceptores
  WHERE id = p_preceptor_id
  FOR UPDATE;

  IF v_preceptor.id IS NULL THEN
    RAISE EXCEPTION 'Preceptor não encontrado.';
  END IF;

  v_preceptor_json := jsonb_build_object(
    'id', v_preceptor.id,
    'nome', v_preceptor.nome_completo,
    'cpf', v_preceptor.cpf,
    'email', v_preceptor.email,
    'status', v_preceptor.status
  );

  -- IDs do escopo real do preceptor
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_vinc_adm_ids
  FROM public.vinculos_adm WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_vinc_int_ids
  FROM public.vinculos_internato WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_calc_ids
  FROM public.calculos WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_presenca_ids
  FROM public.presencas WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(e.id), ARRAY[]::uuid[]) INTO v_escala_ids
  FROM public.escalas e
  WHERE (array_length(v_vinc_int_ids, 1) > 0 AND e.vinculo_internato_id = ANY(v_vinc_int_ids))
     OR (array_length(v_vinc_adm_ids, 1) > 0 AND e.vinculo_adm_id = ANY(v_vinc_adm_ids));

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_ajuste_ids
  FROM public.ajustes_presenca WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(DISTINCT s.id), ARRAY[]::uuid[]) INTO v_sol_ids
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.preceptor_id = p_preceptor_id
     OR s.calculo_id = ANY(v_calc_ids)
     OR EXISTS (
       SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
       WHERE i.solicitacao_id = s.id AND i.calculo_id = ANY(v_calc_ids)
     );

  SELECT COALESCE(array_agg(DISTINCT i.solicitacao_id), ARRAY[]::uuid[])
  INTO v_sol_com_itens
  FROM public.solicitacao_nota_fiscal_itens i
  WHERE i.calculo_id = ANY(v_calc_ids);

  SELECT COALESCE(array_agg(DISTINCT pp.id), ARRAY[]::uuid[]) INTO v_proc_ids
  FROM public.processos_pagamento pp
  JOIN public.processo_calculos pc ON pc.processo_id = pp.id
  WHERE pc.calculo_id = ANY(v_calc_ids);

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_regra_ids
  FROM public.regras_financeiras WHERE preceptor_id = p_preceptor_id;

  v_bloqueio := public.fn_excluir_preceptor_bloqueio(p_preceptor_id);
  IF v_bloqueio IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bloqueio;
  END IF;

  -- ============================================================
  -- EXCLUSÃO TRANSACIONAL (qualquer falha → rollback total)
  -- ============================================================

  -- 1. Composição fiscal: itens das solicitações deste preceptor
  DELETE FROM public.solicitacao_nota_fiscal_itens i
  WHERE i.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_itens_sol_removidos = ROW_COUNT;

  -- 2. Eventos fiscais dos cálculos deste preceptor
  DELETE FROM public.solicitacao_nota_fiscal_eventos e
  WHERE e.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_eventos_removidos = ROW_COUNT;

  -- 3. Solicitações fiscais do preceptor (integras ou redesacopladas)
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

  -- 4. Pagamentos ainda não concluídos
  DELETE FROM public.pagamentos pgto
  WHERE pgto.processo_id = ANY(v_proc_ids)
    AND pgto.status <> 'pago';
  GET DIAGNOSTICS v_pagamentos_removidos = ROW_COUNT;

  -- 5. Alocações processo ↔ cálculo
  DELETE FROM public.processo_calculos pc
  WHERE pc.calculo_id = ANY(v_calc_ids);
  GET DIAGNOSTICS v_processo_calculos_removidos = ROW_COUNT;

  -- 6. Processos que ficaram vazios
  DELETE FROM public.processos_pagamento pp
  WHERE pp.id = ANY(v_proc_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.processo_calculos pc WHERE pc.processo_id = pp.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pagamentos pgto WHERE pgto.processo_id = pp.id
    );
  GET DIAGNOSTICS v_processos_removidos = ROW_COUNT;

  -- 7. Movimentos de saldo
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
  WHERE c.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_calculos_removidos = ROW_COUNT;

  -- 11. Ajustes de presença
  DELETE FROM public.ajustes_presenca ap
  WHERE ap.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_ajustes_removidos = ROW_COUNT;

  -- 12. Presenças
  DELETE FROM public.presencas pr
  WHERE pr.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_presencas_removidas = ROW_COUNT;

  -- 13. Escalas dos vínculos (itens via cascata)
  SELECT count(*) INTO v_escalas_itens_removidos
  FROM public.escalas_itens ei
  WHERE ei.escala_id = ANY(v_escala_ids);

  DELETE FROM public.escalas e
  WHERE e.id = ANY(v_escala_ids);
  GET DIAGNOSTICS v_escalas_removidas = ROW_COUNT;

  -- 14. Coordenadores associados aos vínculos
  DELETE FROM public.vinculo_coordenadores vc
  WHERE vc.vinculo_internato_id = ANY(v_vinc_int_ids);
  GET DIAGNOSTICS v_coordenadores_removidos = ROW_COUNT;

  -- 15. Locais dos vínculos
  DELETE FROM public.vinculo_locais vl
  WHERE vl.vinculo_internato_id = ANY(v_vinc_int_ids)
     OR vl.vinculo_adm_id = ANY(v_vinc_adm_ids);
  GET DIAGNOSTICS v_vinculo_locais_removidos = ROW_COUNT;

  -- 16. Regras financeiras dos vínculos
  DELETE FROM public.vinculo_regras_financeiras vrf
  WHERE vrf.vinculo_internato_id = ANY(v_vinc_int_ids)
     OR vrf.vinculo_adm_id = ANY(v_vinc_adm_ids);
  GET DIAGNOSTICS v_vinculo_regras_removidas = ROW_COUNT;

  -- 17. Vínculos de Prática
  DELETE FROM public.vinculos_adm va
  WHERE va.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_vinculos_adm_removidos = ROW_COUNT;

  -- 18. Vínculos de Internato
  DELETE FROM public.vinculos_internato vi
  WHERE vi.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_vinculos_int_removidos = ROW_COUNT;

  -- 19. Rateios do preceptor
  DELETE FROM public.rateios_financeiros rf
  WHERE rf.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_rateios_removidos = ROW_COUNT;

  -- 20. Associações regra ↔ preceptor
  DELETE FROM public.regra_preceptores rp
  WHERE rp.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_regra_preceptores_removidos = ROW_COUNT;

  -- 21. Regras financeiras próprias do preceptor (defensivo: remove
  --     vínculos de regra restantes que as referenciem)
  IF coalesce(array_length(v_regra_ids, 1), 0) > 0 THEN
    DELETE FROM public.vinculo_regras_financeiras vrf
    WHERE vrf.regra_id = ANY(v_regra_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_vinculo_regras_removidas := v_vinculo_regras_removidas + v_n;
  END IF;

  DELETE FROM public.regras_financeiras r
  WHERE r.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_regras_removidas = ROW_COUNT;

  -- 22. Documentos/arquivos do preceptor
  DELETE FROM public.preceptor_documentos pd
  WHERE pd.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_documentos_removidos = ROW_COUNT;

  -- 23. Favorecidos do preceptor
  DELETE FROM public.preceptor_favorecidos pf
  WHERE pf.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_favorecidos_removidos = ROW_COUNT;

  -- 24. Acesso por token de presença
  DELETE FROM public.preceptor_acesso_presenca pa
  WHERE pa.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_acesso_removidos = ROW_COUNT;

  -- 25. O próprio cadastro (permanente — não é arquivamento)
  DELETE FROM public.preceptores p
  WHERE p.id = p_preceptor_id;
  GET DIAGNOSTICS v_preceptor_removido = ROW_COUNT;

  v_resumo := jsonb_build_object(
    'vinculos_adm_removidos', v_vinculos_adm_removidos,
    'vinculos_internato_removidos', v_vinculos_int_removidos,
    'coordenadores_removidos', v_coordenadores_removidos,
    'vinculo_locais_removidos', v_vinculo_locais_removidos,
    'vinculo_regras_removidas', v_vinculo_regras_removidas,
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
    'rateios_removidos', v_rateios_removidos,
    'regra_preceptores_removidos', v_regra_preceptores_removidos,
    'regras_removidas', v_regras_removidas,
    'documentos_removidos', v_documentos_removidos,
    'favorecidos_removidos', v_favorecidos_removidos,
    'acesso_presenca_removidos', v_acesso_removidos,
    'preceptor_removido', v_preceptor_removido
  );

  -- Registro de auditoria da operação
  INSERT INTO public.audit_logs (
    tabela, registro_id, operacao, dados_anteriores, dados_novos,
    profile_id, user_id, ocorrido_em
  ) VALUES (
    'preceptores',
    p_preceptor_id::text,
    'DELETE',
    v_preceptor_json,
    jsonb_build_object('acao', 'excluir_preceptor', 'preceptor', v_preceptor_json, 'resumo', v_resumo),
    public.current_profile_id(),
    auth.uid(),
    now()
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Preceptor excluído permanentemente.',
    'preceptor', v_preceptor_json,
    'resumo', v_resumo
  );
END;
$$;

-- ============================================================
-- Permissões: somente authenticated (admin check é interno)
-- ============================================================
REVOKE ALL ON FUNCTION public.fn_excluir_preceptor_bloqueio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_excluir_preceptor_bloqueio(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.previa_excluir_preceptor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.previa_excluir_preceptor(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_preceptor(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_preceptor(uuid, boolean) TO authenticated;

COMMIT;
