-- 048_solicitacao_nota_fiscal_unificada.sql
-- NOTA FISCAL UNIFICADA POR PRECEPTOR E COMPETÊNCIA (PARTE 11B)

BEGIN;

-- 1. ADICIONAR COLUNAS À TABELA SOLICITACOES_NOTA_FISCAL
ALTER TABLE public.solicitacoes_nota_fiscal
  ADD COLUMN IF NOT EXISTS numero_nota text,
  ADD COLUMN IF NOT EXISTS data_emissao_nota date,
  ADD COLUMN IF NOT EXISTS valor_nota_informado numeric(14,2),
  ADD COLUMN IF NOT EXISTS divergencia_valor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_divergencia text,
  ADD COLUMN IF NOT EXISTS valor_total_solicitado numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qtd_atuacoes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identificacao_fiscal jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Remover restrição UNIQUE de calculo_id para permitir solicitações unificadas por preceptor+competência,
-- preservando os registros históricos legados.
ALTER TABLE public.solicitacoes_nota_fiscal DROP CONSTRAINT IF EXISTS solicitacoes_nota_fiscal_calculo_id_key;
ALTER TABLE public.solicitacoes_nota_fiscal ALTER COLUMN calculo_id DROP NOT NULL;

-- Criar índice de unicidade por (preceptor_id, competencia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitacoes_nota_preceptor_comp_uniq 
  ON public.solicitacoes_nota_fiscal(preceptor_id, competencia);

-- 2. TABELA DE ITENS DA SOLICITAÇÃO (CÁLCULOS INCLUÍDOS)
CREATE TABLE IF NOT EXISTS public.solicitacao_nota_fiscal_itens (
  id bigserial PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_nota_fiscal(id) ON DELETE CASCADE,
  calculo_id uuid NOT NULL REFERENCES public.calculos(id) ON DELETE CASCADE,
  valor_atuacao numeric(14,2) NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(solicitacao_id, calculo_id)
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_nota_itens_solicitacao ON public.solicitacao_nota_fiscal_itens(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_nota_itens_calculo ON public.solicitacao_nota_fiscal_itens(calculo_id);

-- 3. ADICIONAR COLUNA MOTIVO À TABELA DE EVENTOS
ALTER TABLE public.solicitacao_nota_fiscal_eventos
  ADD COLUMN IF NOT EXISTS motivo text;

-- 4. RPC PARA REGISTRAR/PREPARAR SOLICITAÇÃO UNIFICADA
CREATE OR REPLACE FUNCTION public.preparar_ou_atualizar_solicitacao_nota(
  p_preceptor_id UUID,
  p_competencia TEXT,
  p_calculo_ids UUID[],
  p_valor_total NUMERIC,
  p_situacao TEXT,
  p_identificacao_fiscal JSONB,
  p_email_usado TEXT,
  p_assunto TEXT DEFAULT NULL,
  p_corpo TEXT DEFAULT NULL,
  p_demonstrativo_nome TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile_id UUID;
  v_solicitacao_id UUID;
  v_atual public.situacao_nota_fiscal;
  v_nova public.situacao_nota_fiscal;
  v_cid UUID;
  v_valor_calc NUMERIC;
BEGIN
  IF NOT public.has_role(ARRAY['administrador'::public.app_role, 'financeiro'::public.app_role, 'super_admin'::public.app_role, 'admin_super'::public.app_role, 'admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Perfil não autorizado.';
  END IF;

  IF p_preceptor_id IS NULL OR p_competencia IS NULL OR p_calculo_ids IS NULL OR array_length(p_calculo_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes para solicitação fiscal.';
  END IF;

  BEGIN
    v_nova := p_situacao::public.situacao_nota_fiscal;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Situação de nota fiscal inválida: %', p_situacao;
  END;

  v_profile_id := public.current_profile_id();

  -- Buscar situação atual
  SELECT id, situacao INTO v_solicitacao_id, v_atual
  FROM public.solicitacoes_nota_fiscal
  WHERE preceptor_id = p_preceptor_id AND competencia = p_competencia;

  IF v_solicitacao_id IS NULL THEN
    -- Inserir nova solicitação unificada
    INSERT INTO public.solicitacoes_nota_fiscal (
      preceptor_id, competencia, email_usado, situacao,
      assunto, corpo, demonstrativo_nome,
      valor_total_solicitado, qtd_atuacoes, identificacao_fiscal,
      preparado_por, preparado_em
    ) VALUES (
      p_preceptor_id, p_competencia, p_email_usado, v_nova,
      p_assunto, p_corpo, p_demonstrativo_nome,
      COALESCE(p_valor_total, 0), array_length(p_calculo_ids, 1), COALESCE(p_identificacao_fiscal, '{}'::jsonb),
      CASE WHEN v_nova = 'preparada' THEN v_profile_id ELSE NULL END,
      CASE WHEN v_nova = 'preparada' THEN now() ELSE NULL END
    ) RETURNING id INTO v_solicitacao_id;
  ELSE
    -- Atualizar solicitação existente preservando transições
    UPDATE public.solicitacoes_nota_fiscal SET
      situacao = v_nova,
      email_usado = COALESCE(p_email_usado, email_usado),
      assunto = COALESCE(p_assunto, assunto),
      corpo = COALESCE(p_corpo, corpo),
      demonstrativo_nome = COALESCE(p_demonstrativo_nome, demonstrativo_nome),
      valor_total_solicitado = COALESCE(p_valor_total, valor_total_solicitado),
      qtd_atuacoes = array_length(p_calculo_ids, 1),
      identificacao_fiscal = COALESCE(p_identificacao_fiscal, identificacao_fiscal),
      preparado_por = CASE WHEN v_nova = 'preparada' AND preparado_em IS NULL THEN v_profile_id ELSE preparado_por END,
      preparado_em = CASE WHEN v_nova = 'preparada' AND preparado_em IS NULL THEN now() ELSE preparado_em END,
      updated_at = now()
    WHERE id = v_solicitacao_id;
  END IF;

  -- Vincular os cálculos da solicitação na tabela ponte
  FOREACH v_cid IN ARRAY p_calculo_ids LOOP
    SELECT total_bruto INTO v_valor_calc FROM public.calculos WHERE id = v_cid;
    INSERT INTO public.solicitacao_nota_fiscal_itens (solicitacao_id, calculo_id, valor_atuacao)
    VALUES (v_solicitacao_id, v_cid, COALESCE(v_valor_calc, 0))
    ON CONFLICT (solicitacao_id, calculo_id) DO UPDATE SET valor_atuacao = EXCLUDED.valor_atuacao;
  END LOOP;

  -- Registrar evento
  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, calculo_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, detalhes
  ) VALUES (
    v_solicitacao_id, p_calculo_ids[1], v_atual, v_nova,
    v_profile_id, now(),
    jsonb_build_object(
      'preceptor_id', p_preceptor_id,
      'competencia', p_competencia,
      'qtd_atuacoes', array_length(p_calculo_ids, 1),
      'valor_total', p_valor_total,
      'origem', 'preparar_email_outlook'
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', v_solicitacao_id,
    'preceptor_id', p_preceptor_id,
    'competencia', p_competencia,
    'situacao', v_nova,
    'valor_total', p_valor_total,
    'qtd_atuacoes', array_length(p_calculo_ids, 1)
  );
END;
$$;

-- 5. RPC CONFIRMAR ENVIO DA SOLICITAÇÃO DE NOTA FISCAL
CREATE OR REPLACE FUNCTION public.confirmar_envio_solicitacao_nota(
  p_solicitacao_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile_id UUID;
  v_sol public.solicitacoes_nota_fiscal%ROWTYPE;
BEGIN
  IF NOT public.has_role(ARRAY['administrador'::public.app_role, 'financeiro'::public.app_role, 'super_admin'::public.app_role, 'admin_super'::public.app_role, 'admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Perfil não autorizado para confirmar envio.';
  END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_nota_fiscal WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de nota fiscal não encontrada.';
  END IF;

  IF v_sol.situacao IS DISTINCT FROM 'preparada' THEN
    RAISE EXCEPTION 'Somente solicitações em estado "preparada" podem ter o envio confirmado. Estado atual: %', v_sol.situacao;
  END IF;

  v_profile_id := public.current_profile_id();

  UPDATE public.solicitacoes_nota_fiscal SET
    situacao = 'solicitada',
    enviado_por = v_profile_id,
    enviado_em = now(),
    updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, detalhes
  ) VALUES (
    p_solicitacao_id, 'preparada', 'solicitada',
    v_profile_id, now(),
    jsonb_build_object(
      'acao', 'confirmar_envio_humano',
      'preceptor_id', v_sol.preceptor_id,
      'competencia', v_sol.competencia,
      'valor_total', v_sol.valor_total_solicitado
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_solicitacao_id,
    'situacao', 'solicitada',
    'enviado_em', now()
  );
END;
$$;

-- 6. RPC CORRIGIR CONFIRMAÇÃO DE ENVIO DE NOTA
CREATE OR REPLACE FUNCTION public.corrigir_confirmacao_envio_nota(
  p_solicitacao_id UUID,
  p_motivo TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile_id UUID;
  v_sol public.solicitacoes_nota_fiscal%ROWTYPE;
BEGIN
  IF NOT public.has_role(ARRAY['administrador'::public.app_role, 'super_admin'::public.app_role, 'admin_super'::public.app_role, 'admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Somente Administradores podem corrigir confirmações.';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'Por favor, informe um motivo válido para a correção da confirmação.';
  END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_nota_fiscal WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de nota fiscal não encontrada.';
  END IF;

  IF v_sol.situacao IS DISTINCT FROM 'solicitada' THEN
    RAISE EXCEPTION 'Não é possível corrigir confirmação. A solicitação não está no estado "solicitada". Estado atual: %', v_sol.situacao;
  END IF;

  v_profile_id := public.current_profile_id();

  UPDATE public.solicitacoes_nota_fiscal SET
    situacao = 'preparada',
    updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, motivo, detalhes
  ) VALUES (
    p_solicitacao_id, 'solicitada', 'preparada',
    v_profile_id, now(), trim(p_motivo),
    jsonb_build_object(
      'acao', 'corrigir_confirmacao_envio',
      'motivo', trim(p_motivo),
      'preparado_em_preservado', v_sol.preparado_em,
      'enviado_em_preservado', v_sol.enviado_em
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_solicitacao_id,
    'situacao', 'preparada',
    'motivo', trim(p_motivo)
  );
END;
$$;

-- 7. RPC REGISTRAR RECEBIMENTO DE NOTA FISCAL
CREATE OR REPLACE FUNCTION public.registrar_recebimento_nota_fiscal(
  p_solicitacao_id UUID,
  p_numero_nota TEXT,
  p_data_emissao DATE,
  p_data_recebimento TIMESTAMPTZ,
  p_valor_informado NUMERIC,
  p_observacao TEXT,
  p_registrar_divergencia BOOLEAN DEFAULT false,
  p_motivo_divergencia TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile_id UUID;
  v_sol public.solicitacoes_nota_fiscal%ROWTYPE;
  v_tem_divergencia BOOLEAN := false;
  v_data_rec TIMESTAMPTZ;
BEGIN
  IF NOT public.has_role(ARRAY['administrador'::public.app_role, 'financeiro'::public.app_role, 'super_admin'::public.app_role, 'admin_super'::public.app_role, 'admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado. Perfil não autorizado para registrar recebimento de nota.';
  END IF;

  SELECT * INTO v_sol FROM public.solicitacoes_nota_fiscal WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de nota fiscal não encontrada.';
  END IF;

  IF v_sol.situacao IS DISTINCT FROM 'solicitada' THEN
    RAISE EXCEPTION 'Somente solicitações em estado "enviada/solicitada" podem ser registradas como recebidas. Estado atual: %', v_sol.situacao;
  END IF;

  IF p_valor_informado IS NULL OR p_valor_informado <= 0 THEN
    RAISE EXCEPTION 'Por favor, informe o valor da nota fiscal recebida.';
  END IF;

  -- Checar divergência de valor
  IF p_valor_informado <> v_sol.valor_total_solicitado THEN
    v_tem_divergencia := true;
    IF NOT COALESCE(p_registrar_divergencia, false) THEN
      RAISE EXCEPTION 'O valor informado (R$ %) difere do valor solicitado (R$ %). Confirmação de divergência necessária.', p_valor_informado, v_sol.valor_total_solicitado;
    END IF;
    IF p_motivo_divergencia IS NULL OR length(trim(p_motivo_divergencia)) < 3 THEN
      RAISE EXCEPTION 'Motivo da divergência é obrigatório para valores diferentes do solicitado.';
    END IF;
  END IF;

  v_profile_id := public.current_profile_id();
  v_data_rec := COALESCE(p_data_recebimento, now());

  UPDATE public.solicitacoes_nota_fiscal SET
    situacao = 'nota_recebida',
    numero_nota = trim(p_numero_nota),
    data_emissao_nota = p_data_emissao,
    nota_recebida_em = v_data_rec,
    valor_nota_informado = p_valor_informado,
    observacao = trim(p_observacao),
    divergencia_valor = v_tem_divergencia,
    motivo_divergencia = CASE WHEN v_tem_divergencia THEN trim(p_motivo_divergencia) ELSE NULL END,
    updated_at = now()
  WHERE id = p_solicitacao_id;

  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, motivo, detalhes
  ) VALUES (
    p_solicitacao_id, 'solicitada', 'nota_recebida',
    v_profile_id, v_data_rec, CASE WHEN v_tem_divergencia THEN trim(p_motivo_divergencia) ELSE NULL END,
    jsonb_build_object(
      'acao', 'registrar_nota_recebida',
      'numero_nota', p_numero_nota,
      'data_emissao', p_data_emissao,
      'valor_solicitado', v_sol.valor_total_solicitado,
      'valor_informado', p_valor_informado,
      'divergencia', v_tem_divergencia,
      'motivo_divergencia', p_motivo_divergencia
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', p_solicitacao_id,
    'situacao', 'nota_recebida',
    'divergencia', v_tem_divergencia,
    'valor_informado', p_valor_informado
  );
END;
$$;

-- 8. RPC HISTÓRICO DE EVENTOS DA SOLICITAÇÃO
CREATE OR REPLACE FUNCTION public.buscar_historico_solicitacao_nota(
  p_solicitacao_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_events JSONB;
BEGIN
  IF NOT public.has_role(ARRAY['administrador'::public.app_role, 'financeiro'::public.app_role, 'auditor'::public.app_role, 'coordenador'::public.app_role, 'super_admin'::public.app_role, 'admin_super'::public.app_role, 'admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'situacao_anterior', e.situacao_anterior,
      'situacao_nova', e.situacao_nova,
      'ocorrido_em', e.ocorrido_em,
      'motivo', e.motivo,
      'realizado_por_nome', COALESCE(p.nome_completo, 'Sistema/Usuário'),
      'detalhes', e.detalhes
    ) ORDER BY e.id ASC
  ) INTO v_events
  FROM public.solicitacao_nota_fiscal_eventos e
  LEFT JOIN public.profiles p ON p.id = e.realizado_por
  WHERE e.solicitacao_id = p_solicitacao_id;

  RETURN COALESCE(v_events, '[]'::jsonb);
END;
$$;

-- 9. PERMISSÕES RLS E GRANTS
ALTER TABLE public.solicitacoes_nota_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_nota_fiscal_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_nota_fiscal_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitacoes_nota_itens_read ON public.solicitacao_nota_fiscal_itens;
CREATE POLICY solicitacoes_nota_itens_read ON public.solicitacao_nota_fiscal_itens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS solicitacoes_nota_itens_write ON public.solicitacao_nota_fiscal_itens;
CREATE POLICY solicitacoes_nota_itens_write ON public.solicitacao_nota_fiscal_itens
  FOR ALL TO authenticated USING (true);

GRANT EXECUTE ON FUNCTION public.preparar_ou_atualizar_solicitacao_nota TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_envio_solicitacao_nota TO authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_confirmacao_envio_nota TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_nota_fiscal TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_historico_solicitacao_nota TO authenticated;

COMMIT;
