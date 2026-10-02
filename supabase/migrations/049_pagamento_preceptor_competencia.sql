-- 049_pagamento_preceptor_competencia.sql
-- PARTE 12A: ESTRUTURA DO PAGAMENTO POR PRECEPTOR E COMPETÊNCIA E RPCS TRANSACIONAIS

BEGIN;

-- 1. ADEQUAÇÃO DA TABELA PUBLIC.PAGAMENTOS
-- Tornar colunas legadas do schema inicial como NULLABLE para permitir o novo modelo de pagamento unificado por solicitação fiscal
ALTER TABLE public.pagamentos
  ALTER COLUMN processo_id DROP NOT NULL,
  ALTER COLUMN favorecido_id DROP NOT NULL,
  ALTER COLUMN modalidade DROP NOT NULL,
  ALTER COLUMN valor_bruto DROP NOT NULL;

-- Adicionar colunas necessárias para o pagamento por solicitação única
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid REFERENCES public.solicitacoes_nota_fiscal(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS preceptor_id uuid REFERENCES public.preceptores(id),
  ADD COLUMN IF NOT EXISTS competencia_id uuid REFERENCES public.competencias(id),
  ADD COLUMN IF NOT EXISTS valor_solicitado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_nota numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS iniciado_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS divergencia_autorizada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_divergencia text;

-- Restrição CHECK para situacao (permitindo apenas: pendente, em_pagamento, pago, cancelado)
ALTER TABLE public.pagamentos DROP CONSTRAINT IF EXISTS pagamentos_situacao_check;
ALTER TABLE public.pagamentos ADD CONSTRAINT pagamentos_situacao_check CHECK (situacao IN ('pendente', 'em_pagamento', 'pago', 'cancelado'));

-- Garantir unicidade de pagamento por solicitação fiscal
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_solicitacao_id_uniq ON public.pagamentos(solicitacao_id) WHERE solicitacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagamentos_preceptor_id ON public.pagamentos(preceptor_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_competencia_id ON public.pagamentos(competencia_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_situacao ON public.pagamentos(situacao);

-- 2. TABELA DE COMPOSIÇÃO DE ITENS DO PAGAMENTO (ATUAÇÕES / CÁLCULOS)
CREATE TABLE IF NOT EXISTS public.pagamento_itens (
  id bigserial PRIMARY KEY,
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  calculo_id uuid NOT NULL REFERENCES public.calculos(id),
  vinculo_adm_id uuid REFERENCES public.vinculos_adm(id),
  vinculo_internato_id uuid REFERENCES public.vinculos_internato(id),
  tipo_atuacao public.tipo_atuacao,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagamento_itens_uniq UNIQUE (pagamento_id, calculo_id)
);

CREATE INDEX IF NOT EXISTS idx_pagamento_itens_pagamento ON public.pagamento_itens(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_pagamento_itens_calculo ON public.pagamento_itens(calculo_id);

-- 3. ADEQUAÇÃO DA TABELA SALDO_MOVIMENTOS
ALTER TABLE public.saldo_movimentos
  ALTER COLUMN saldo_id DROP NOT NULL;

ALTER TABLE public.saldo_movimentos
  ADD COLUMN IF NOT EXISTS pagamento_id uuid REFERENCES public.pagamentos(id),
  ADD COLUMN IF NOT EXISTS vinculo_internato_id uuid REFERENCES public.vinculos_internato(id),
  ADD COLUMN IF NOT EXISTS vinculo_adm_id uuid REFERENCES public.vinculos_adm(id),
  ADD COLUMN IF NOT EXISTS tipo_atuacao public.tipo_atuacao;

-- 4. RPC PARA INICIAR PAGAMENTO (TRANSAÇÃO E VALIDAÇÕES DE PRÉ-CONDIÇÕES)
CREATE OR REPLACE FUNCTION public.iniciar_pagamento(
  p_solicitacao_id UUID,
  p_divergencia_autorizada BOOLEAN DEFAULT FALSE,
  p_motivo_divergencia TEXT DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_sol RECORD;
  v_pag_id UUID;
  v_pag_situacao TEXT;
  v_comp_id UUID;
  v_item RECORD;
  v_has_divergence BOOLEAN := FALSE;
  v_item_count INT := 0;
  v_calc_revisado BOOLEAN;
  v_valor_final_pago NUMERIC(14,2);
BEGIN
  -- Permissões: Admin, Financeiro, Super Admin
  IF NOT public.has_role(ARRAY['administrador'::app_role, 'financeiro'::app_role, 'super_admin'::app_role, 'admin_super'::app_role, 'admin'::app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Perfil não autorizado a iniciar pagamentos.';
  END IF;

  v_profile_id := public.current_profile_id();

  -- Buscar solicitação fiscal FOR UPDATE
  SELECT * INTO v_sol
  FROM public.solicitacoes_nota_fiscal
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação fiscal não encontrada.';
  END IF;

  -- Pré-condição 1: Solicitação não pode estar cancelada ou paga
  IF v_sol.situacao = 'pago' THEN
    RAISE EXCEPTION 'Solicitação fiscal já está marcada como "pago". Pagamento duplicado impedido.';
  END IF;

  IF v_sol.situacao = 'cancelado' THEN
    RAISE EXCEPTION 'Solicitação fiscal está cancelada. Não é possível iniciar pagamento.';
  END IF;

  -- Pré-condição 2: Solicitação deve estar em nota_recebida ou em_pagamento
  IF v_sol.situacao NOT IN ('nota_recebida', 'em_pagamento') THEN
    RAISE EXCEPTION 'Somente é possível iniciar pagamento quando a solicitação estiver em "nota_recebida". Situação atual: %', v_sol.situacao;
  END IF;

  -- Pré-condição 3: Nota fiscal precisa ter sido registrada (numero_nota)
  IF v_sol.numero_nota IS NULL OR length(trim(v_sol.numero_nota)) = 0 THEN
    RAISE EXCEPTION 'Nota fiscal ainda não foi registrada nesta solicitação.';
  END IF;

  -- Pré-condição 4: Valor da nota precisa ter sido informado/conferido
  IF v_sol.valor_nota_informado IS NULL OR v_sol.valor_nota_informado <= 0 THEN
    RAISE EXCEPTION 'Valor da nota fiscal não foi conferido/informado.';
  END IF;

  -- Pré-condição 5: Verificar divergência de valor
  v_has_divergence := (v_sol.divergencia_valor = TRUE) OR (v_sol.valor_nota_informado <> v_sol.valor_total_solicitado);

  IF v_has_divergence THEN
    IF p_divergencia_autorizada IS NOT TRUE OR p_motivo_divergencia IS NULL OR length(trim(p_motivo_divergencia)) < 3 THEN
      RAISE EXCEPTION 'Pagamento bloqueado por divergência entre o valor da nota (R$ %) e o valor solicitado (R$ %). É necessária autorização explicita de Administrador com motivo obrigatório.', v_sol.valor_nota_informado, v_sol.valor_total_solicitado;
    END IF;
  END IF;

  -- Pré-condição 6: Validar cálculos vinculados (revisados e não desatualizados)
  FOR v_item IN
    SELECT sni.calculo_id, c.preceptor_id, c.competencia_id, c.total_bruto, c.total_descontos, c.total_liquido, c.tipo_atuacao, c.vinculo_adm_id, c.vinculo_internato_id, c.calculado_em, c.desatualizado, c.status AS calculo_status
    FROM public.solicitacao_nota_fiscal_itens sni
    JOIN public.calculos c ON c.id = sni.calculo_id
    WHERE sni.solicitacao_id = p_solicitacao_id
  LOOP
    v_item_count := v_item_count + 1;
    v_comp_id := v_item.competencia_id;

    -- Verificar se cálculo está desatualizado
    IF v_item.desatualizado = TRUE THEN
      RAISE EXCEPTION 'Pagamento bloqueado: o cálculo da atuação encontra-se desatualizado por alterações de presenças posteriores.';
    END IF;

    -- Verificar se possui revisão financeira válida e ativa
    SELECT EXISTS (
      SELECT 1 FROM public.aprovacoes a
      WHERE a.calculo_id = v_item.calculo_id
        AND a.tipo = 'financeira'
        AND a.status = 'aprovado'
        AND a.decidido_em >= v_item.calculado_em
    ) INTO v_calc_revisado;

    IF NOT v_calc_revisado THEN
      RAISE EXCEPTION 'Pagamento bloqueado: existem atuações sem revisão financeira válida.';
    END IF;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Nenhum cálculo vinculado encontrado nesta solicitação fiscal.';
  END IF;

  -- Se competencia_id não foi derivado dos cálculos, buscar na tabela competencias
  IF v_comp_id IS NULL THEN
    SELECT id INTO v_comp_id FROM public.competencias LIMIT 1;
  END IF;

  -- Valor a ser pago: valor da nota se divergência autorizada ou valor solicitado
  v_valor_final_pago := CASE WHEN v_has_divergence AND p_divergencia_autorizada THEN v_sol.valor_nota_informado ELSE v_sol.valor_total_solicitado END;

  -- Verificar se já existe pagamento para esta solicitação
  SELECT id, situacao INTO v_pag_id, v_pag_situacao
  FROM public.pagamentos
  WHERE solicitacao_id = p_solicitacao_id;

  IF v_pag_id IS NOT NULL THEN
    IF v_pag_situacao = 'pago' THEN
      RAISE EXCEPTION 'Pagamento já foi concluído e marcado como pago.';
    END IF;

    -- Atualizar pagamento existente
    UPDATE public.pagamentos
    SET situacao = 'em_pagamento',
        valor_solicitado = v_sol.valor_total_solicitado,
        valor_nota = v_sol.valor_nota_informado,
        valor_pago = v_valor_final_pago,
        divergencia_autorizada = p_divergencia_autorizada,
        motivo_divergencia = CASE WHEN p_divergencia_autorizada THEN p_motivo_divergencia ELSE NULL END,
        observacao = COALESCE(p_observacao, observacao),
        updated_at = now()
    WHERE id = v_pag_id;
  ELSE
    -- Inserir novo registro de pagamento
    INSERT INTO public.pagamentos (
      solicitacao_id, preceptor_id, competencia_id,
      valor_solicitado, valor_nota, valor_pago,
      situacao, iniciado_em, iniciado_por,
      divergencia_autorizada, motivo_divergencia, observacao
    ) VALUES (
      p_solicitacao_id, v_sol.preceptor_id, v_comp_id,
      v_sol.valor_total_solicitado, v_sol.valor_nota_informado, v_valor_final_pago,
      'em_pagamento', now(), v_profile_id,
      p_divergencia_autorizada, CASE WHEN p_divergencia_autorizada THEN p_motivo_divergencia ELSE NULL END, p_observacao
    ) RETURNING id INTO v_pag_id;
  END IF;

  -- Atualizar solicitação fiscal para em_pagamento
  UPDATE public.solicitacoes_nota_fiscal
  SET situacao = 'em_pagamento',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  -- Popular composição em pagamento_itens
  DELETE FROM public.pagamento_itens WHERE pagamento_id = v_pag_id;

  INSERT INTO public.pagamento_itens (pagamento_id, calculo_id, vinculo_adm_id, vinculo_internato_id, tipo_atuacao, subtotal)
  SELECT
    v_pag_id,
    sni.calculo_id,
    c.vinculo_adm_id,
    c.vinculo_internato_id,
    c.tipo_atuacao,
    c.total_liquido
  FROM public.solicitacao_nota_fiscal_itens sni
  JOIN public.calculos c ON c.id = sni.calculo_id
  WHERE sni.solicitacao_id = p_solicitacao_id;

  -- Registrar evento na solicitação
  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova, realizado_por, ocorrido_em, detalhes, motivo
  ) VALUES (
    p_solicitacao_id, v_sol.situacao, 'em_pagamento', v_profile_id, now(),
    jsonb_build_object(
      'pagamento_id', v_pag_id,
      'divergencia_autorizada', p_divergencia_autorizada,
      'motivo_divergencia', p_motivo_divergencia,
      'valor_pago', v_valor_final_pago
    ),
    'Início do processamento do pagamento'
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'pagamento_id', v_pag_id,
    'solicitacao_id', p_solicitacao_id,
    'situacao', 'em_pagamento',
    'valor_solicitado', v_sol.valor_total_solicitado,
    'valor_nota', v_sol.valor_nota_informado,
    'valor_pago', v_valor_final_pago,
    'qtd_atuacoes', v_item_count
  );
END;
$$;

-- 5. RPC PARA CONCLUIR PAGAMENTO (TRANSAÇÃO COMPLETA DE BAIXA)
CREATE OR REPLACE FUNCTION public.concluir_pagamento(
  p_pagamento_id UUID,
  p_valor_pago NUMERIC DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_pag RECORD;
  v_sol RECORD;
  v_item RECORD;
  v_valor_final NUMERIC(14,2);
  v_movimentos_count INT := 0;
BEGIN
  -- Permissões: Admin, Financeiro, Super Admin
  IF NOT public.has_role(ARRAY['administrador'::app_role, 'financeiro'::app_role, 'super_admin'::app_role, 'admin_super'::app_role, 'admin'::app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Perfil não autorizado a concluir pagamentos.';
  END IF;

  v_profile_id := public.current_profile_id();

  -- Buscar pagamento FOR UPDATE
  SELECT * INTO v_pag
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de pagamento não encontrado: %', p_pagamento_id;
  END IF;

  -- Proteção: se já estiver pago, bloquear nova conclusão
  IF v_pag.situacao = 'pago' THEN
    RAISE EXCEPTION 'Pagamento já concluído e marcado como "pago". Bloqueio de duplicidade ativado.';
  END IF;

  IF v_pag.situacao = 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível concluir um pagamento cancelado.';
  END IF;

  -- Buscar solicitação fiscal FOR UPDATE
  SELECT * INTO v_sol
  FROM public.solicitacoes_nota_fiscal
  WHERE id = v_pag.solicitacao_id
  FOR UPDATE;

  IF v_sol.situacao = 'pago' THEN
    RAISE EXCEPTION 'Solicitação fiscal associada já está paga.';
  END IF;

  -- Definir valor final pago
  v_valor_final := COALESCE(p_valor_pago, v_pag.valor_pago, v_sol.valor_nota_informado, v_sol.valor_total_solicitado);

  IF v_valor_final <= 0 THEN
    RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero.';
  END IF;

  -- 1. Marcar pagamento como 'pago'
  UPDATE public.pagamentos
  SET situacao = 'pago',
      valor_pago = v_valor_final,
      concluido_em = now(),
      concluido_por = v_profile_id,
      observacao = COALESCE(p_observacao, observacao),
      updated_at = now()
  WHERE id = p_pagamento_id;

  -- 2. Atualizar solicitação fiscal para 'pago'
  UPDATE public.solicitacoes_nota_fiscal
  SET situacao = 'pago',
      updated_at = now()
  WHERE id = v_pag.solicitacao_id;

  -- 3. Atualizar status dos cálculos envolvidos para 'pago'
  UPDATE public.calculos
  SET status = 'pago',
      updated_at = now()
  WHERE id IN (
    SELECT calculo_id FROM public.pagamento_itens WHERE pagamento_id = p_pagamento_id
  );

  -- 4. Registrar baixa nos movimentos de saldo POR ATUAÇÃO (sem alterar preceptores.valor_inicial)
  FOR v_item IN
    SELECT pi.calculo_id, pi.vinculo_adm_id, pi.vinculo_internato_id, pi.tipo_atuacao, pi.subtotal
    FROM public.pagamento_itens pi
    WHERE pi.pagamento_id = p_pagamento_id
  LOOP
    INSERT INTO public.saldo_movimentos (
      pagamento_id, calculo_id, vinculo_internato_id, vinculo_adm_id,
      tipo_atuacao, tipo, valor, descricao, realizado_por, created_at
    ) VALUES (
      p_pagamento_id, v_item.calculo_id, v_item.vinculo_internato_id, v_item.vinculo_adm_id,
      v_item.tipo_atuacao, 'consumo', v_item.subtotal,
      'Baixa de saldo por conclusão de pagamento da atuação', v_profile_id, now()
    );
    v_movimentos_count := v_movimentos_count + 1;
  END LOOP;

  -- 5. Registrar evento no histórico
  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova, realizado_por, ocorrido_em, detalhes, motivo
  ) VALUES (
    v_pag.solicitacao_id, v_sol.situacao, 'pago', v_profile_id, now(),
    jsonb_build_object(
      'pagamento_id', p_pagamento_id,
      'valor_pago', v_valor_final,
      'movimentos_saldo', v_movimentos_count
    ),
    'Conclusão do pagamento e liquidação fiscal'
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'pagamento_id', p_pagamento_id,
    'solicitacao_id', v_pag.solicitacao_id,
    'situacao', 'pago',
    'valor_pago', v_valor_final,
    'movimentos_saldo_registrados', v_movimentos_count
  );
END;
$$;

-- 6. RPC PARA CANCELAR PAGAMENTO (ANTES DA CONCLUSÃO)
CREATE OR REPLACE FUNCTION public.cancelar_pagamento(
  p_pagamento_id UUID,
  p_motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_pag RECORD;
  v_sol RECORD;
BEGIN
  IF NOT public.has_role(ARRAY['administrador'::app_role, 'financeiro'::app_role, 'super_admin'::app_role, 'admin_super'::app_role, 'admin'::app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Perfil não autorizado a cancelar pagamentos.';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório e deve ter no mínimo 5 caracteres.';
  END IF;

  v_profile_id := public.current_profile_id();

  SELECT * INTO v_pag
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro de pagamento não encontrado.';
  END IF;

  -- Bloquear cancelamento se já estiver pago
  IF v_pag.situacao = 'pago' THEN
    RAISE EXCEPTION 'Pagamento já concluído e pago. Não é possível cancelar um pagamento pago.';
  END IF;

  SELECT * INTO v_sol
  FROM public.solicitacoes_nota_fiscal
  WHERE id = v_pag.solicitacao_id
  FOR UPDATE;

  -- Atualizar pagamento para cancelado
  UPDATE public.pagamentos
  SET situacao = 'cancelado',
      cancelado_em = now(),
      cancelado_por = v_profile_id,
      motivo_cancelamento = p_motivo,
      updated_at = now()
  WHERE id = p_pagamento_id;

  -- Reverter situação da solicitação fiscal para nota_recebida
  UPDATE public.solicitacoes_nota_fiscal
  SET situacao = 'nota_recebida',
      updated_at = now()
  WHERE id = v_pag.solicitacao_id;

  -- Registrar evento
  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova, realizado_por, ocorrido_em, detalhes, motivo
  ) VALUES (
    v_pag.solicitacao_id, v_sol.situacao, 'nota_recebida', v_profile_id, now(),
    jsonb_build_object('pagamento_id', p_pagamento_id, 'motivo_cancelamento', p_motivo),
    'Cancelamento do processo de pagamento'
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'pagamento_id', p_pagamento_id,
    'solicitacao_id', v_pag.solicitacao_id,
    'situacao', 'cancelado'
  );
END;
$$;

-- 7. REFORÇAR PROTEÇÃO CONTRA REFAZER FLUXO QUANDO EXISTIR PAGAMENTO OU SOLICITAÇÃO "PAGO"
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
  v_calculos RECORD;
  v_calculo_ids UUID[] := ARRAY[]::UUID[];
  v_total_calculos INT := 0;
  v_total_itens INT := 0;
  v_total_solicitacoes INT := 0;
  v_total_eventos INT := 0;
  v_total_aprovacoes INT := 0;
  v_total_saldo_movimentos INT := 0;
  v_total_processo_calculos INT := 0;
  v_total_presencas INT := 0;
  v_total_escalas_removidas INT := 0;
  v_total_escalas_preservadas INT := 0;
  v_blocked BOOLEAN := FALSE;
  v_block_reason TEXT := '';
  v_calculos_detalhes JSONB := '[]'::jsonb;
  v_escalas_afetadas JSONB := '[]'::jsonb;
  v_escala RECORD;
  v_resultado JSONB;
BEGIN
  v_admin_check := public.has_role(ARRAY['admin'::app_role, 'administrador'::app_role, 'super_admin'::app_role]);
  IF NOT v_admin_check THEN
    RAISE EXCEPTION 'Acesso negado. Somente administradores podem visualizar a prévia do refazer fluxo.';
  END IF;

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

    SELECT COUNT(*) INTO v_total_itens
    FROM public.calculo_itens ci
    WHERE ci.calculo_id = v_calculos.calculo_id;

    SELECT COUNT(*) INTO v_total_solicitacoes
    FROM public.solicitacoes_nota_fiscal snf
    WHERE snf.calculo_id = v_calculos.calculo_id OR snf.preceptor_id = v_calculos.preceptor_id;

    -- Bloqueio por pagamento ou situação paga
    IF v_calculos.calculo_status = 'pago' THEN
      v_blocked := TRUE;
      v_block_reason := 'Existe cálculo com situação "pago" para o preceptor ' || v_calculos.preceptor_nome || '. Não é possível refazer o fluxo.';
    END IF;

    -- Verificar na tabela de solicitações unificadas
    IF EXISTS (
      SELECT 1 FROM public.solicitacoes_nota_fiscal snf
      WHERE snf.preceptor_id = v_calculos.preceptor_id AND snf.situacao = 'pago'
    ) THEN
      v_blocked := TRUE;
      v_block_reason := 'Existe solicitação de nota fiscal com situação "pago" para o preceptor ' || v_calculos.preceptor_nome || '. Refazer fluxo bloqueado.';
    END IF;

    -- Verificar na tabela de pagamentos
    IF EXISTS (
      SELECT 1 FROM public.pagamentos pag
      WHERE pag.preceptor_id = v_calculos.preceptor_id AND pag.situacao = 'pago'
    ) THEN
      v_blocked := TRUE;
      v_block_reason := 'Existe pagamento concluído (pago) para o preceptor ' || v_calculos.preceptor_nome || '. Refazer fluxo bloqueado.';
    END IF;

    v_calculos_detalhes := v_calculos_detalhes || jsonb_build_object(
      'calculo_id', v_calculos.calculo_id,
      'preceptor_id', v_calculos.preceptor_id,
      'preceptor_nome', v_calculos.preceptor_nome,
      'tipo_atuacao', v_calculos.tipo_atuacao,
      'vinculo_adm_id', v_calculos.vinculo_adm_id,
      'vinculo_internato_id', v_calculos.vinculo_internato_id,
      'local_nome', COALESCE(v_calculos.local_nome, 'N/I'),
      'total_bruto', v_calculos.total_bruto,
      'total_descontos', v_calculos.total_descontos,
      'total_liquido', v_calculos.total_liquido,
      'calculo_status', v_calculos.calculo_status,
      'versao', v_calculos.versao
    );
  END LOOP;

  IF array_length(v_calculo_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_total_eventos
    FROM public.solicitacao_nota_fiscal_eventos e
    JOIN public.solicitacoes_nota_fiscal s ON s.id = e.solicitacao_id
    WHERE s.preceptor_id = ANY(SELECT preceptor_id FROM public.calculos WHERE id = ANY(v_calculo_ids));

    SELECT COUNT(*) INTO v_total_aprovacoes
    FROM public.aprovacoes a
    WHERE a.calculo_id = ANY(v_calculo_ids);

    SELECT COUNT(*) INTO v_total_saldo_movimentos
    FROM public.saldo_movimentos sm
    WHERE sm.calculo_id = ANY(v_calculo_ids);

    SELECT COUNT(*) INTO v_total_presencas
    FROM public.presencas p
    WHERE p.data_presenca BETWEEN v_competencia.data_inicio AND v_competencia.data_fim
      AND (p_preceptor_id IS NULL OR p.preceptor_id = p_preceptor_id)
      AND (p_tipo_atuacao IS NULL OR p.tipo_atuacao::text = p_tipo_atuacao)
      AND (p_vinculo_adm_id IS NULL OR p.vinculo_adm_id = p_vinculo_adm_id)
      AND (p_vinculo_internato_id IS NULL OR p.vinculo_internato_id = p_vinculo_internato_id);
  END IF;

  v_resultado := jsonb_build_object(
    'competencia', jsonb_build_object(
      'id', v_competencia.id,
      'ano', v_competencia.ano,
      'mes', v_competencia.mes
    ),
    'resumo', jsonb_build_object(
      'total_calculos', v_total_calculos,
      'total_presencas', v_total_presencas
    ),
    'bloqueado', v_blocked,
    'motivo_bloqueio', v_block_reason,
    'calculos', v_calculos_detalhes
  );

  RETURN v_resultado;
END;
$$;

COMMIT;
