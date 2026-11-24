-- ============================================================
-- Migration 065: Excluir preceptor — pagamento concluído não bloqueia
-- ============================================================
-- Etapa EXCLUIR-PRECEPTOR-PERMANENTEMENTE (lista "Preceptores do Internato")
-- Project Ref: tdmrscavrdoekrzdlmpf (MCP supabase-preceptor)
--
-- Ajusta as RPCs criadas na migração 054:
--
--   1. Pagamento concluído NÃO bloqueia mais a exclusão administrativa.
--      A exclusão passa a funcionar em qualquer etapa do fluxo (vínculo,
--      escala, presença, cálculo, e-mail enviado, pagamento concluído).
--   2. A prévia passa a informar os e-mails adicionais e sinaliza
--      "pagamento concluído" apenas como informação (não é bloqueio).
--   3. A exclusão remove também pagamentos concluídos e suas composições
--      (itens de pagamento e movimentos de saldo ligados ao pagamento),
--      sem afetar processos/pagamentos de outros preceptores.
--   4. Regras financeiras NÃO são excluídas: somente as referências
--      pertencentes aos vínculos excluídos (vinculo_regras_financeiras)
--      são removidas e a propriedade da regra (preceptor_id) é
--      desvinculada — nenhuma linha de regras_financeiras é apagada.
--   5. Preserva usuários (auth.users / profiles / user_roles),
--      Administradores, Coordenadores, cadastros auxiliares,
--      demais preceptores e histórico de auditoria.
--
-- Regras mantidas:
--   - Somente Administrador pode executar (validação interna).
--   - RPC transacional: qualquer falha gera rollback total.
--   - O frontend não executa DELETE direto.
--   - Não é arquivamento: não existe status intermediário.
--   - Futuramente a ação será restrita ao Super Admin (não implementado).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. fn_excluir_preceptor_bloqueio — somente inexistência
--    (pagamento concluído deixou de bloquear)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_excluir_preceptor_bloqueio(p_preceptor_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT nome_completo INTO v_nome FROM public.preceptores WHERE id = p_preceptor_id;
  IF v_nome IS NULL THEN
    RETURN 'Preceptor não encontrado.';
  END IF;

  -- Pagamento concluído NÃO bloqueia a exclusão administrativa.
  RETURN NULL;
END;
$$;

-- ============================================================
-- 2. fn_excluir_preceptor_escopo — leitura única do escopo
--    (usada pela prévia e pela execução; sem escrita)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_excluir_preceptor_escopo(
  p_preceptor_id uuid,
  OUT vinc_adm_ids uuid[],
  OUT vinc_int_ids uuid[],
  OUT calc_ids uuid[],
  OUT presenca_ids uuid[],
  OUT escala_ids uuid[],
  OUT ajuste_ids uuid[],
  OUT sol_ids uuid[],
  OUT sol_removiveis_ids uuid[],
  OUT proc_ids uuid[],
  OUT proc_exclusivos_ids uuid[],
  OUT pag_ids uuid[],
  OUT regra_ids uuid[]
)
RETURNS record
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vazio constant uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), v_vazio) INTO vinc_adm_ids
  FROM public.vinculos_adm WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), v_vazio) INTO vinc_int_ids
  FROM public.vinculos_internato WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), v_vazio) INTO calc_ids
  FROM public.calculos WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(id), v_vazio) INTO presenca_ids
  FROM public.presencas WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(e.id), v_vazio) INTO escala_ids
  FROM public.escalas e
  WHERE (coalesce(array_length(vinc_int_ids, 1), 0) > 0 AND e.vinculo_internato_id = ANY(vinc_int_ids))
     OR (coalesce(array_length(vinc_adm_ids, 1), 0) > 0 AND e.vinculo_adm_id = ANY(vinc_adm_ids));

  SELECT COALESCE(array_agg(id), v_vazio) INTO ajuste_ids
  FROM public.ajustes_presenca WHERE preceptor_id = p_preceptor_id;

  SELECT COALESCE(array_agg(DISTINCT s.id), v_vazio) INTO sol_ids
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.preceptor_id = p_preceptor_id
     OR (coalesce(array_length(calc_ids, 1), 0) > 0 AND s.calculo_id = ANY(calc_ids))
     OR EXISTS (
       SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
       WHERE i.solicitacao_id = s.id
         AND coalesce(array_length(calc_ids, 1), 0) > 0
         AND i.calculo_id = ANY(calc_ids)
     );

  -- Solicitações que ficarão sem nenhum item após a exclusão → serão removidas
  SELECT COALESCE(array_agg(s.id), v_vazio) INTO sol_removiveis_ids
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.id = ANY(sol_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
      WHERE i.solicitacao_id = s.id
        AND NOT (coalesce(array_length(calc_ids, 1), 0) > 0 AND i.calculo_id = ANY(calc_ids))
    );

  SELECT COALESCE(array_agg(DISTINCT pp.id), v_vazio) INTO proc_ids
  FROM public.processos_pagamento pp
  JOIN public.processo_calculos pc ON pc.processo_id = pp.id
  WHERE coalesce(array_length(calc_ids, 1), 0) > 0
    AND pc.calculo_id = ANY(calc_ids);

  -- Processos que contêm SOMENTE cálculos deste preceptor
  -- (processos de outros preceptores nunca são tocados)
  SELECT COALESCE(array_agg(x.pid), v_vazio) INTO proc_exclusivos_ids
  FROM (
    SELECT pc.processo_id AS pid
    FROM public.processo_calculos pc
    WHERE pc.processo_id = ANY(proc_ids)
    GROUP BY pc.processo_id
    HAVING bool_and(pc.calculo_id = ANY(calc_ids))
  ) x;

  -- Pagamentos do escopo (todos os status, inclusive concluídos)
  SELECT COALESCE(array_agg(id), v_vazio) INTO pag_ids
  FROM public.pagamentos
  WHERE coalesce(array_length(proc_exclusivos_ids, 1), 0) > 0
    AND processo_id = ANY(proc_exclusivos_ids);

  -- Modelo por preceptor (coluna existe apenas em bancos com a migração 049)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'preceptor_id'
  ) THEN
    SELECT COALESCE(array_agg(DISTINCT id), pag_ids) INTO pag_ids
    FROM public.pagamentos
    WHERE preceptor_id = p_preceptor_id OR id = ANY(pag_ids);
  END IF;

  -- Modelo por solicitação fiscal (coluna existe apenas em bancos com a migração 049)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pagamentos' AND column_name = 'solicitacao_id'
  ) THEN
    SELECT COALESCE(array_agg(DISTINCT id), pag_ids) INTO pag_ids
    FROM public.pagamentos
    WHERE (coalesce(array_length(sol_removiveis_ids, 1), 0) > 0 AND solicitacao_id = ANY(sol_removiveis_ids))
       OR id = ANY(pag_ids);
  END IF;

  SELECT COALESCE(array_agg(id), v_vazio) INTO regra_ids
  FROM public.regras_financeiras WHERE preceptor_id = p_preceptor_id;
END;
$$;

-- ============================================================
-- 3. RPC: previa_excluir_preceptor (prévia real, não altera nada)
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
  v_esc record;
  v_bloqueio text;
  v_n int;
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
  v_total_pagamentos_concluidos int;
  v_total_processo_calculos int;
  v_total_pagamento_itens int;
  v_total_saldo_movimentos int;
  v_total_documentos int;
  v_total_favorecidos int;
  v_total_acesso int;
  v_total_rateios int;
  v_total_regra_preceptores int;
  v_total_regras_desvinculadas int;
  v_total_vinculo_locais int;
  v_total_vinculo_regras int;
  v_total_emails_copia int;
  v_total_arquivos_registros int;
  v_pagamento_concluido boolean;
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

  SELECT * INTO v_esc FROM public.fn_excluir_preceptor_escopo(p_preceptor_id);

  -- Contagens reais
  v_total_vinculos := coalesce(array_length(v_esc.vinc_adm_ids, 1), 0) + coalesce(array_length(v_esc.vinc_int_ids, 1), 0);

  SELECT count(*) INTO v_total_coordenadores
  FROM public.vinculo_coordenadores
  WHERE vinculo_internato_id = ANY(v_esc.vinc_int_ids);

  SELECT count(*) INTO v_total_escalas FROM public.escalas WHERE id = ANY(v_esc.escala_ids);
  SELECT count(*) INTO v_total_escalas_itens FROM public.escalas_itens WHERE escala_id = ANY(v_esc.escala_ids);
  SELECT count(*) INTO v_total_presencas FROM public.presencas WHERE id = ANY(v_esc.presenca_ids);
  SELECT count(*) INTO v_total_calculos FROM public.calculos WHERE id = ANY(v_esc.calc_ids);
  SELECT count(*) INTO v_total_calculo_itens FROM public.calculo_itens WHERE calculo_id = ANY(v_esc.calc_ids);

  SELECT count(*) INTO v_total_aprovacoes
  FROM public.aprovacoes
  WHERE calculo_id = ANY(v_esc.calc_ids)
     OR ajuste_presenca_id = ANY(v_esc.ajuste_ids);

  SELECT count(*) INTO v_total_solicitacoes FROM public.solicitacoes_nota_fiscal WHERE id = ANY(v_esc.sol_ids);
  SELECT count(*) INTO v_total_solicitacoes_itens
  FROM public.solicitacao_nota_fiscal_itens
  WHERE solicitacao_id = ANY(v_esc.sol_ids) OR calculo_id = ANY(v_esc.calc_ids);
  SELECT count(*) INTO v_total_solicitacoes_eventos
  FROM public.solicitacao_nota_fiscal_eventos
  WHERE solicitacao_id = ANY(v_esc.sol_ids) OR calculo_id = ANY(v_esc.calc_ids);

  SELECT count(*) INTO v_total_pagamentos FROM public.pagamentos WHERE id = ANY(v_esc.pag_ids);
  SELECT count(*) INTO v_total_pagamentos_concluidos
  FROM public.pagamentos WHERE id = ANY(v_esc.pag_ids) AND status = 'pago';

  SELECT count(*) INTO v_total_processo_calculos
  FROM public.processo_calculos WHERE calculo_id = ANY(v_esc.calc_ids);

  v_total_pagamento_itens := 0;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pagamento_itens'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.pagamento_itens WHERE calculo_id = ANY($1) OR pagamento_id = ANY($2)'
    INTO v_total_pagamento_itens USING v_esc.calc_ids, v_esc.pag_ids;
  END IF;

  SELECT count(*) INTO v_total_saldo_movimentos
  FROM public.saldo_movimentos WHERE calculo_id = ANY(v_esc.calc_ids);

  v_n := 0;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saldo_movimentos' AND column_name = 'pagamento_id'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.saldo_movimentos WHERE pagamento_id = ANY($1)'
    INTO v_n USING v_esc.pag_ids;
    v_total_saldo_movimentos := v_total_saldo_movimentos + v_n;
  END IF;

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
  SELECT count(*) INTO v_total_regras_desvinculadas
  FROM public.regras_financeiras WHERE id = ANY(v_esc.regra_ids);
  SELECT count(*) INTO v_total_vinculo_locais
  FROM public.vinculo_locais
  WHERE vinculo_internato_id = ANY(v_esc.vinc_int_ids) OR vinculo_adm_id = ANY(v_esc.vinc_adm_ids);
  SELECT count(*) INTO v_total_vinculo_regras
  FROM public.vinculo_regras_financeiras
  WHERE vinculo_internato_id = ANY(v_esc.vinc_int_ids) OR vinculo_adm_id = ANY(v_esc.vinc_adm_ids);
  SELECT count(*) INTO v_total_emails_copia
  FROM public.preceptor_emails_copia WHERE preceptor_id = p_preceptor_id;

  v_total_arquivos_registros :=
    v_total_documentos + v_total_favorecidos + v_total_acesso + v_total_rateios
    + v_total_regra_preceptores
    + v_total_vinculo_locais + v_total_vinculo_regras
    + v_total_emails_copia;

  -- Informação (não é bloqueio): existe fluxo com pagamento concluído
  v_pagamento_concluido :=
    v_total_pagamentos_concluidos > 0
    OR EXISTS (
      SELECT 1 FROM public.calculos c
      WHERE c.id = ANY(v_esc.calc_ids) AND c.status = 'pago'
    )
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_nota_fiscal s
      WHERE s.id = ANY(v_esc.sol_ids) AND s.situacao = 'pago'
    )
    OR EXISTS (
      SELECT 1 FROM public.processos_pagamento pp
      WHERE pp.id = ANY(v_esc.proc_ids) AND pp.status = 'concluido'
    );

  v_bloqueio := public.fn_excluir_preceptor_bloqueio(p_preceptor_id);

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
      'total_pagamentos_concluidos', v_total_pagamentos_concluidos,
      'total_processo_calculos', v_total_processo_calculos,
      'total_pagamento_itens', v_total_pagamento_itens,
      'total_saldo_movimentos', v_total_saldo_movimentos,
      'total_documentos', v_total_documentos,
      'total_favorecidos', v_total_favorecidos,
      'total_acesso_presenca', v_total_acesso,
      'total_rateios', v_total_rateios,
      'total_regra_preceptores', v_total_regra_preceptores,
      'total_regras_desvinculadas', v_total_regras_desvinculadas,
      'total_vinculo_locais', v_total_vinculo_locais,
      'total_vinculo_regras', v_total_vinculo_regras,
      'total_emails_copia', v_total_emails_copia,
      'total_arquivos_registros', v_total_arquivos_registros
    ),
    'pagamento_concluido', v_pagamento_concluido,
    'bloqueado', v_bloqueio IS NOT NULL,
    'motivo_bloqueio', v_bloqueio
  );
END;
$$;

-- ============================================================
-- 4. RPC: excluir_preceptor (exclusão permanente transacional)
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
  v_esc record;
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
  v_pagamento_itens_removidos int := 0;
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
  v_regras_desvinculadas int := 0;
  v_emails_copia_removidos int := 0;
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

  -- Pagamento concluído não bloqueia; somente inexistência bloqueia
  v_bloqueio := public.fn_excluir_preceptor_bloqueio(p_preceptor_id);
  IF v_bloqueio IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bloqueio;
  END IF;

  SELECT * INTO v_esc FROM public.fn_excluir_preceptor_escopo(p_preceptor_id);

  -- ============================================================
  -- EXCLUSÃO TRANSACIONAL (qualquer falha → rollback total)
  -- ============================================================

  -- 1. Movimentos de saldo dos cálculos (e dos pagamentos excluídos)
  DELETE FROM public.saldo_movimentos sm
  WHERE sm.calculo_id = ANY(v_esc.calc_ids);
  GET DIAGNOSTICS v_saldo_movimentos_removidos = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'saldo_movimentos' AND column_name = 'pagamento_id'
  ) THEN
    EXECUTE 'DELETE FROM public.saldo_movimentos WHERE pagamento_id = ANY($1)' USING v_esc.pag_ids;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_saldo_movimentos_removidos := v_saldo_movimentos_removidos + v_n;
  END IF;

  -- 2. Composição dos pagamentos (itens por atuação)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pagamento_itens'
  ) THEN
    EXECUTE 'DELETE FROM public.pagamento_itens WHERE pagamento_id = ANY($1) OR calculo_id = ANY($2)'
    USING v_esc.pag_ids, v_esc.calc_ids;
    GET DIAGNOSTICS v_pagamento_itens_removidos = ROW_COUNT;
  END IF;

  -- 3. Pagamentos do escopo (inclui os concluídos)
  DELETE FROM public.pagamentos pgto
  WHERE pgto.id = ANY(v_esc.pag_ids);
  GET DIAGNOSTICS v_pagamentos_removidos = ROW_COUNT;

  -- 4. Composição fiscal: itens das solicitações deste preceptor
  DELETE FROM public.solicitacao_nota_fiscal_itens i
  WHERE i.calculo_id = ANY(v_esc.calc_ids);
  GET DIAGNOSTICS v_itens_sol_removidos = ROW_COUNT;

  -- 5. Eventos fiscais dos cálculos deste preceptor
  DELETE FROM public.solicitacao_nota_fiscal_eventos e
  WHERE e.calculo_id = ANY(v_esc.calc_ids);
  GET DIAGNOSTICS v_eventos_removidos = ROW_COUNT;

  -- 6. Solicitações fiscais do preceptor (integras ou redesacopladas)
  FOR v_sol IN
    SELECT s.id, s.calculo_id
    FROM public.solicitacoes_nota_fiscal s
    WHERE s.id = ANY(v_esc.sol_ids)
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
      v_had := v_sol.id = ANY(v_esc.sol_ids) AND EXISTS (
        SELECT 1 FROM public.solicitacao_nota_fiscal_itens i
        WHERE i.solicitacao_id = v_sol.id AND i.calculo_id = ANY(v_esc.calc_ids)
      );

      IF v_sol.calculo_id = ANY(v_esc.calc_ids) THEN
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

  -- Nenhuma solicitação pode sobrar apontando para o preceptor excluído
  IF EXISTS (
    SELECT 1 FROM public.solicitacoes_nota_fiscal s
    WHERE s.preceptor_id = p_preceptor_id
  ) THEN
    RAISE EXCEPTION 'Não foi possível excluir o preceptor. Registros fiscais compartilhados impedem a remoção com segurança.';
  END IF;

  -- 7. Alocações processo ↔ cálculo
  DELETE FROM public.processo_calculos pc
  WHERE pc.calculo_id = ANY(v_esc.calc_ids);
  GET DIAGNOSTICS v_processo_calculos_removidos = ROW_COUNT;

  -- 8. Processos que ficaram sem cálculos e sem pagamentos
  DELETE FROM public.processos_pagamento pp
  WHERE pp.id = ANY(v_esc.proc_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.processo_calculos pc WHERE pc.processo_id = pp.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pagamentos pgto WHERE pgto.processo_id = pp.id
    );
  GET DIAGNOSTICS v_processos_removidos = ROW_COUNT;

  -- Nenhuma solicitação pode apontar para cálculo excluído
  IF EXISTS (
    SELECT 1 FROM public.solicitacoes_nota_fiscal s
    WHERE coalesce(array_length(v_esc.calc_ids, 1), 0) > 0
      AND s.calculo_id = ANY(v_esc.calc_ids)
  ) THEN
    RAISE EXCEPTION 'Não foi possível excluir o preceptor. Registros fiscais compartilhados impedem a remoção com segurança.';
  END IF;

  -- 9. Revisões financeiras
  DELETE FROM public.aprovacoes a
  WHERE a.calculo_id = ANY(v_esc.calc_ids);
  GET DIAGNOSTICS v_aprovacoes_removidas = ROW_COUNT;

  DELETE FROM public.aprovacoes a
  WHERE a.ajuste_presenca_id = ANY(v_esc.ajuste_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_aprovacoes_removidas := v_aprovacoes_removidas + v_n;

  -- 10. Itens de cálculo
  DELETE FROM public.calculo_itens ci
  WHERE ci.calculo_id = ANY(v_esc.calc_ids);
  GET DIAGNOSTICS v_calculo_itens_removidos = ROW_COUNT;

  -- 11. Cálculos
  DELETE FROM public.calculos c
  WHERE c.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_calculos_removidos = ROW_COUNT;

  -- 12. Ajustes de presença
  DELETE FROM public.ajustes_presenca ap
  WHERE ap.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_ajustes_removidos = ROW_COUNT;

  -- 13. Presenças
  DELETE FROM public.presencas pr
  WHERE pr.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_presencas_removidas = ROW_COUNT;

  -- 14. Escalas dos vínculos (itens via cascata)
  SELECT count(*) INTO v_escalas_itens_removidos
  FROM public.escalas_itens ei
  WHERE ei.escala_id = ANY(v_esc.escala_ids);

  DELETE FROM public.escalas e
  WHERE e.id = ANY(v_esc.escala_ids);
  GET DIAGNOSTICS v_escalas_removidas = ROW_COUNT;

  -- 15. Coordenadores associados aos vínculos de Internato
  DELETE FROM public.vinculo_coordenadores vc
  WHERE vc.vinculo_internato_id = ANY(v_esc.vinc_int_ids);
  GET DIAGNOSTICS v_coordenadores_removidos = ROW_COUNT;

  -- 16. Locais dos vínculos
  DELETE FROM public.vinculo_locais vl
  WHERE vl.vinculo_internato_id = ANY(v_esc.vinc_int_ids)
     OR vl.vinculo_adm_id = ANY(v_esc.vinc_adm_ids);
  GET DIAGNOSTICS v_vinculo_locais_removidos = ROW_COUNT;

  -- 17. Referências de regra financeira pertencentes aos vínculos excluídos
  DELETE FROM public.vinculo_regras_financeiras vrf
  WHERE vrf.vinculo_internato_id = ANY(v_esc.vinc_int_ids)
     OR vrf.vinculo_adm_id = ANY(v_esc.vinc_adm_ids);
  GET DIAGNOSTICS v_vinculo_regras_removidas = ROW_COUNT;

  -- 18. Vínculos de Prática
  DELETE FROM public.vinculos_adm va
  WHERE va.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_vinculos_adm_removidos = ROW_COUNT;

  -- 19. Vínculos de Internato
  DELETE FROM public.vinculos_internato vi
  WHERE vi.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_vinculos_int_removidos = ROW_COUNT;

  -- 20. Rateios do preceptor
  DELETE FROM public.rateios_financeiros rf
  WHERE rf.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_rateios_removidos = ROW_COUNT;

  -- 21. Associações regra ↔ preceptor (só a associação; a regra permanece)
  DELETE FROM public.regra_preceptores rp
  WHERE rp.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_regra_preceptores_removidos = ROW_COUNT;

  -- 22. Regras financeiras NÃO são excluídas: apenas a propriedade
  --     (preceptor_id) é desvinculada — regras gerais permanecem intactas
  UPDATE public.regras_financeiras r
  SET preceptor_id = NULL, updated_at = now()
  WHERE r.id = ANY(v_esc.regra_ids);
  GET DIAGNOSTICS v_regras_desvinculadas = ROW_COUNT;

  -- 23. Documentos/arquivos do preceptor
  DELETE FROM public.preceptor_documentos pd
  WHERE pd.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_documentos_removidos = ROW_COUNT;

  -- 24. Favorecidos do preceptor (associação; cadastro de favorecido preservado)
  DELETE FROM public.preceptor_favorecidos pf
  WHERE pf.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_favorecidos_removidos = ROW_COUNT;

  -- 25. Acesso por token de presença
  DELETE FROM public.preceptor_acesso_presenca pa
  WHERE pa.preceptor_id = p_preceptor_id;
  GET DIAGNOSTICS v_acesso_removidos = ROW_COUNT;

  -- 26. E-mails adicionais para cópia
  SELECT count(*) INTO v_emails_copia_removidos
  FROM public.preceptor_emails_copia WHERE preceptor_id = p_preceptor_id;

  DELETE FROM public.preceptor_emails_copia ec
  WHERE ec.preceptor_id = p_preceptor_id;

  -- 27. O próprio cadastro (permanente — não é arquivamento)
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
    'pagamento_itens_removidos', v_pagamento_itens_removidos,
    'processo_calculos_removidos', v_processo_calculos_removidos,
    'processos_removidos', v_processos_removidos,
    'saldo_movimentos_removidos', v_saldo_movimentos_removidos,
    'rateios_removidos', v_rateios_removidos,
    'regra_preceptores_removidos', v_regra_preceptores_removidos,
    'regras_desvinculadas', v_regras_desvinculadas,
    'regras_excluidas', 0,
    'emails_copia_removidos', v_emails_copia_removidos,
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
-- Permissões
-- ============================================================
REVOKE ALL ON FUNCTION public.fn_excluir_preceptor_bloqueio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_excluir_preceptor_bloqueio(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_excluir_preceptor_escopo(uuid) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.previa_excluir_preceptor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.previa_excluir_preceptor(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_preceptor(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_preceptor(uuid, boolean) TO authenticated;

COMMIT;
