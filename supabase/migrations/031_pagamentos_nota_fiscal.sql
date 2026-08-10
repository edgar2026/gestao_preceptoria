-- 031_pagamentos_nota_fiscal.sql
-- PAGAMENTOS E NOTA FISCAL
-- 1. Enum situacao_nota_fiscal (domínio controlado).
-- 2. Tabela solicitacoes_nota_fiscal (uma por cálculo, upsert sem duplicar).
-- 3. Tabela de eventos/auditoria solicitacao_nota_fiscal_eventos.
-- 4. RPC registrar_solicitacao_nota_fiscal: valida cálculo de Internato,
--    usuário autorizado e transições de estado. Nunca envia e-mail automaticamente.
-- 5. buscar_fila_financeira enriquecida para o painel de pagamentos:
--    somente Internato com chamado aberto/processado e com e-mail do cadastro,
--    preceptor, mês, ano, período, Internato, unidade, local, turnos, regra,
--    valor, chamado e situação da nota.

-- =====================================================================
-- 1. ENUM DE SITUAÇÃO DA NOTA FISCAL
-- =====================================================================
DO $$
BEGIN
  CREATE TYPE public.situacao_nota_fiscal AS ENUM (
    'nao_solicitada', 'preparada', 'solicitada',
    'nota_recebida', 'em_pagamento', 'pago', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- 2. TABELA SOLICITAÇÕES DE NOTA FISCAL
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.solicitacoes_nota_fiscal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id uuid NOT NULL UNIQUE REFERENCES public.calculos(id) ON DELETE CASCADE,
  preceptor_id uuid NOT NULL REFERENCES public.preceptores(id),
  competencia text NOT NULL,
  email_usado text,
  situacao public.situacao_nota_fiscal NOT NULL DEFAULT 'nao_solicitada',
  assunto text,
  corpo text,
  demonstrativo_nome text,
  preparado_por uuid REFERENCES public.profiles(id),
  preparado_em timestamptz,
  enviado_por uuid REFERENCES public.profiles(id),
  enviado_em timestamptz,
  nota_recebida_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_nota_calculo ON public.solicitacoes_nota_fiscal(calculo_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_nota_preceptor ON public.solicitacoes_nota_fiscal(preceptor_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_nota_situacao ON public.solicitacoes_nota_fiscal(situacao);

COMMENT ON TABLE public.solicitacoes_nota_fiscal IS 'Solicitação de nota fiscal por cálculo de Internato (uma linha por cálculo).';
COMMENT ON COLUMN public.solicitacoes_nota_fiscal.calculo_id IS 'Cálculo de Internato associado (único).';
COMMENT ON COLUMN public.solicitacoes_nota_fiscal.competencia IS 'Competência financeira no formato AAAA-MM.';
COMMENT ON COLUMN public.solicitacoes_nota_fiscal.email_usado IS 'E-mail do cadastro do preceptor usado na solicitação.';
COMMENT ON COLUMN public.solicitacoes_nota_fiscal.situacao IS 'Situação da nota: nao_solicitada, preparada, solicitada, nota_recebida, em_pagamento, pago, cancelado.';

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_solicitacoes_nota_updated ON public.solicitacoes_nota_fiscal;
CREATE TRIGGER trg_solicitacoes_nota_updated
  BEFORE UPDATE ON public.solicitacoes_nota_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria genérica (audit_logs)
DROP TRIGGER IF EXISTS trg_solicitacoes_nota_audit ON public.solicitacoes_nota_fiscal;
CREATE TRIGGER trg_solicitacoes_nota_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.solicitacoes_nota_fiscal
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- =====================================================================
-- 3. TABELA DE EVENTOS/AUDITORIA DA SOLICITAÇÃO
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.solicitacao_nota_fiscal_eventos (
  id bigserial PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_nota_fiscal(id) ON DELETE CASCADE,
  calculo_id uuid REFERENCES public.calculos(id) ON DELETE CASCADE,
  situacao_anterior public.situacao_nota_fiscal,
  situacao_nova public.situacao_nota_fiscal NOT NULL,
  realizado_por uuid REFERENCES public.profiles(id),
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_nota_eventos_solicitacao ON public.solicitacao_nota_fiscal_eventos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_nota_eventos_calculo ON public.solicitacao_nota_fiscal_eventos(calculo_id);

COMMENT ON TABLE public.solicitacao_nota_fiscal_eventos IS 'Histórico de transições de situação da solicitação de nota fiscal.';

-- Auditoria genérica (audit_logs)
DROP TRIGGER IF EXISTS trg_solicitacao_nota_eventos_audit ON public.solicitacao_nota_fiscal_eventos;
CREATE TRIGGER trg_solicitacao_nota_eventos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.solicitacao_nota_fiscal_eventos
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- =====================================================================
-- 4. RPC REGISTRAR_SOLICITACAO_NOTA_FISCAL
-- =====================================================================
CREATE OR REPLACE FUNCTION public.registrar_solicitacao_nota_fiscal(
  p_calculo_id UUID,
  p_situacao TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_calculo public.calculos%ROWTYPE;
  v_competencia_ano INT;
  v_competencia_mes INT;
  v_preceptor_nome TEXT;
  v_preceptor_email TEXT;
  v_profile_id UUID;
  v_atual public.situacao_nota_fiscal;
  v_nova public.situacao_nota_fiscal;
  v_ok BOOLEAN;
  v_solicitacao_id UUID;
  v_competencia_label TEXT;
  v_assunto TEXT;
  v_corpo TEXT;
  v_demonstrativo TEXT;
BEGIN
  -- Somente Administrativo ou Financeiro autorizado
  IF NOT public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_calculo_id IS NULL OR p_situacao IS NULL OR trim(p_situacao) = '' THEN
    RAISE EXCEPTION 'Parametros obrigatorios ausentes.';
  END IF;

  BEGIN
    v_nova := p_situacao::public.situacao_nota_fiscal;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Situacao de nota fiscal invalida.';
  END;

  v_profile_id := public.current_profile_id();

  -- Validar cálculo de Internato
  SELECT c.* INTO v_calculo
  FROM public.calculos c
  WHERE c.id = p_calculo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calculo nao encontrado.';
  END IF;

  IF v_calculo.tipo_atuacao IS DISTINCT FROM 'internato' THEN
    RAISE EXCEPTION 'Solicitacao de nota fiscal somente para calculos de Internato.';
  END IF;

  SELECT co.ano, co.mes INTO v_competencia_ano, v_competencia_mes
  FROM public.competencias co
  WHERE co.id = v_calculo.competencia_id;

  SELECT p.nome_completo, p.email INTO v_preceptor_nome, v_preceptor_email
  FROM public.preceptores p
  WHERE p.id = v_calculo.preceptor_id;

  -- Situação atual (pode não existir ainda)
  SELECT s.situacao, s.id INTO v_atual, v_solicitacao_id
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.calculo_id = p_calculo_id;

  IF NOT FOUND THEN
    v_atual := 'nao_solicitada';
  END IF;

  -- Mesma situação: operação idempotente (upsert sem duplicar por cálculo)
  IF v_atual = v_nova THEN
    RETURN jsonb_build_object('sucesso', true, 'id', v_solicitacao_id, 'calculo_id', p_calculo_id, 'situacao', v_nova, 'alterado', false);
  END IF;

  -- Validação de transições de estado
  v_ok := false;
  CASE v_atual
    WHEN 'nao_solicitada' THEN v_ok := v_nova IN ('preparada', 'solicitada', 'cancelado');
    WHEN 'preparada'     THEN v_ok := v_nova IN ('solicitada', 'cancelado');
    WHEN 'solicitada'    THEN v_ok := v_nova IN ('nota_recebida', 'cancelado');
    WHEN 'nota_recebida' THEN v_ok := v_nova IN ('em_pagamento', 'pago', 'cancelado');
    WHEN 'em_pagamento'  THEN v_ok := v_nova IN ('pago', 'cancelado');
    ELSE v_ok := false;
  END CASE;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transicao de situacao invalida: % -> %', v_atual, v_nova;
  END IF;

  v_competencia_label := to_char(make_date(v_competencia_ano, v_competencia_mes, 1), 'YYYY-MM');
  v_assunto := 'Solicitacao de nota fiscal - ' || coalesce(v_preceptor_nome, 'Preceptor') || ' - ' || v_competencia_label;
  v_corpo := 'Ola, ' || coalesce(v_preceptor_nome, 'Preceptor') || '.' || E'\n\n'
          || 'Solicitamos o envio da nota fiscal referente aos servicos de preceptoria prestados na competencia ' || v_competencia_label || '.' || E'\n\n'
          || 'O demonstrativo detalhado foi anexado. Por favor, encaminhe a nota fiscal conforme as orientacoes institucionais.' || E'\n\nAtenciosamente,';
  v_demonstrativo := 'demonstrativo-' || lower(regexp_replace(coalesce(v_preceptor_nome, 'preceptor'), '\s+', '-', 'g')) || '-' || v_competencia_label || '.pdf';

  -- Upsert: nunca duplicar por cálculo. Nunca envia e-mail automaticamente.
  INSERT INTO public.solicitacoes_nota_fiscal (
    calculo_id, preceptor_id, competencia, email_usado, situacao,
    assunto, corpo, demonstrativo_nome,
    preparado_por, preparado_em,
    enviado_por, enviado_em,
    nota_recebida_em, observacao
  ) VALUES (
    p_calculo_id, v_calculo.preceptor_id, v_competencia_label, v_preceptor_email, v_nova,
    v_assunto, v_corpo, v_demonstrativo,
    CASE WHEN v_nova = 'preparada' THEN v_profile_id ELSE NULL END,
    CASE WHEN v_nova = 'preparada' THEN now() ELSE NULL END,
    CASE WHEN v_nova = 'solicitada' THEN v_profile_id ELSE NULL END,
    CASE WHEN v_nova = 'solicitada' THEN now() ELSE NULL END,
    CASE WHEN v_nova = 'nota_recebida' THEN now() ELSE NULL END,
    NULL
  )
  ON CONFLICT (calculo_id) DO UPDATE SET
    situacao = excluded.situacao,
    email_usado = excluded.email_usado,
    preparado_por = CASE WHEN excluded.situacao = 'preparada' AND solicitacoes_nota_fiscal.preparado_em IS NULL THEN excluded.preparado_por ELSE solicitacoes_nota_fiscal.preparado_por END,
    preparado_em = CASE WHEN excluded.situacao = 'preparada' AND solicitacoes_nota_fiscal.preparado_em IS NULL THEN excluded.preparado_em ELSE solicitacoes_nota_fiscal.preparado_em END,
    enviado_por = CASE WHEN excluded.situacao = 'solicitada' AND solicitacoes_nota_fiscal.enviado_em IS NULL THEN excluded.enviado_por ELSE solicitacoes_nota_fiscal.enviado_por END,
    enviado_em = CASE WHEN excluded.situacao = 'solicitada' AND solicitacoes_nota_fiscal.enviado_em IS NULL THEN excluded.enviado_em ELSE solicitacoes_nota_fiscal.enviado_em END,
    nota_recebida_em = CASE WHEN excluded.situacao = 'nota_recebida' AND solicitacoes_nota_fiscal.nota_recebida_em IS NULL THEN excluded.nota_recebida_em ELSE solicitacoes_nota_fiscal.nota_recebida_em END,
    updated_at = now()
  RETURNING id INTO v_solicitacao_id;

  -- Histórico de eventos/auditoria
  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, calculo_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, detalhes
  ) VALUES (
    v_solicitacao_id, p_calculo_id, v_atual, v_nova,
    v_profile_id, now(),
    jsonb_build_object(
      'preceptor_id', v_calculo.preceptor_id,
      'competencia', v_competencia_label,
      'email_usado', v_preceptor_email,
      'origem', 'rpc'
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', v_solicitacao_id,
    'calculo_id', p_calculo_id,
    'situacao', v_nova,
    'alterado', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_solicitacao_nota_fiscal(UUID, TEXT) TO authenticated;

-- =====================================================================
-- 5. RLS E GRANTS DAS NOVAS TABELAS
-- =====================================================================
ALTER TABLE public.solicitacoes_nota_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_nota_fiscal_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitacoes_nota_read ON public.solicitacoes_nota_fiscal;
CREATE POLICY solicitacoes_nota_read ON public.solicitacoes_nota_fiscal
  FOR SELECT TO authenticated
  USING (public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role, 'auditor'::public.app_role, 'coordenador'::public.app_role]));

DROP POLICY IF EXISTS solicitacoes_nota_write ON public.solicitacoes_nota_fiscal;
CREATE POLICY solicitacoes_nota_write ON public.solicitacoes_nota_fiscal
  FOR ALL TO authenticated
  USING (public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role]))
  WITH CHECK (public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role]));

DROP POLICY IF EXISTS solicitacao_nota_eventos_read ON public.solicitacao_nota_fiscal_eventos;
CREATE POLICY solicitacao_nota_eventos_read ON public.solicitacao_nota_fiscal_eventos
  FOR SELECT TO authenticated
  USING (public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role, 'auditor'::public.app_role, 'coordenador'::public.app_role]));

DROP POLICY IF EXISTS solicitacao_nota_eventos_write ON public.solicitacao_nota_fiscal_eventos;
CREATE POLICY solicitacao_nota_eventos_write ON public.solicitacao_nota_fiscal_eventos
  FOR ALL TO authenticated
  USING (public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role]))
  WITH CHECK (public.has_role(array['administrador'::public.app_role, 'financeiro'::public.app_role]));

GRANT ALL ON public.solicitacoes_nota_fiscal TO authenticated;
GRANT ALL ON public.solicitacao_nota_fiscal_eventos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.solicitacao_nota_fiscal_eventos_id_seq TO authenticated;

-- =====================================================================
-- 6. FILA FINANCEIRA ENRIQUECIDA PARA O PAINEL DE PAGAMENTOS
-- =====================================================================
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
AS $function$
DECLARE
  v_resultado jsonb := '[]'::jsonb;
  v_row jsonb;
  v_calc record;
  v_unidade_nome text;
  v_disciplina_nome text;
  v_internato_nome text;
  v_local_nome text;
  v_regra_nome text;
  v_mes_comp integer;
  v_ano_comp integer;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  FOR v_calc IN
    SELECT
      c.*,
      p.nome_completo AS preceptor_nome,
      p.email AS preceptor_email,
      co.data_inicio AS competencia_inicio,
      co.data_fim AS competencia_fim,
      s.situacao AS nota_situacao
    FROM public.calculos c
    JOIN public.preceptores p ON p.id = c.preceptor_id
    JOIN public.competencias co ON co.id = c.competencia_id
    LEFT JOIN public.solicitacoes_nota_fiscal s ON s.calculo_id = c.id
    WHERE (p_mes IS NULL OR co.mes = p_mes)
      AND (p_ano IS NULL OR co.ano = p_ano)
      AND (p_modalidade IS NULL OR c.tipo_atuacao::text = p_modalidade)
      AND (p_situacao IS NULL OR c.chamado_status = p_situacao)
      AND (p_search IS NULL OR p.nome_completo ILIKE '%' || p_search || '%')
    ORDER BY c.created_at DESC
  LOOP
    v_unidade_nome := NULL;
    v_disciplina_nome := NULL;
    v_internato_nome := NULL;
    v_local_nome := NULL;
    v_regra_nome := NULL;

    IF v_calc.tipo_atuacao = 'adm' AND v_calc.vinculo_adm_id IS NOT NULL THEN
      SELECT u.nome, d.nome, l.nome
      INTO v_unidade_nome, v_disciplina_nome, v_local_nome
      FROM public.vinculos_adm va
      LEFT JOIN public.unidades u ON u.id = va.unidade_id
      LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
      LEFT JOIN public.locais l ON l.id = va.local_id
      WHERE va.id = v_calc.vinculo_adm_id;
    ELSIF v_calc.tipo_atuacao = 'internato' AND v_calc.vinculo_internato_id IS NOT NULL THEN
      SELECT u.nome, i.nome, l.nome
      INTO v_unidade_nome, v_internato_nome, v_local_nome
      FROM public.vinculos_internato vi
      LEFT JOIN public.unidades u ON u.id = vi.unidade_id
      LEFT JOIN public.internatos i ON i.id = vi.internato_id
      LEFT JOIN public.locais l ON l.id = vi.local_id
      WHERE vi.id = v_calc.vinculo_internato_id;
    END IF;

    IF v_calc.tipo_atuacao = 'adm' AND v_calc.vinculo_adm_id IS NOT NULL THEN
      SELECT rf.nome INTO v_regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_adm_id = v_calc.vinculo_adm_id AND vrf.status = 'ativo'
      LIMIT 1;
    ELSIF v_calc.tipo_atuacao = 'internato' AND v_calc.vinculo_internato_id IS NOT NULL THEN
      SELECT rf.nome INTO v_regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_internato_id = v_calc.vinculo_internato_id AND vrf.status = 'ativo'
      LIMIT 1;
    END IF;

    v_mes_comp := EXTRACT(MONTH FROM v_calc.competencia_inicio)::integer;
    v_ano_comp := EXTRACT(YEAR FROM v_calc.competencia_inicio)::integer;
    v_data_inicio := v_calc.competencia_inicio;
    v_data_fim := v_calc.competencia_fim;

    v_row := jsonb_build_object(
      'id', v_calc.id,
      'preceptor_id', v_calc.preceptor_id,
      'preceptor_nome', v_calc.preceptor_nome,
      'preceptor_email', coalesce(v_calc.preceptor_email, ''),
      'mes', v_mes_comp,
      'ano', v_ano_comp,
      'tipo_atuacao', v_calc.tipo_atuacao,
      'modalidade', v_calc.tipo_atuacao::text,
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
      'calculado_em', v_calc.calculado_em,
      'data_inicio', v_data_inicio,
      'data_fim', v_data_fim,
      'situacao_nota', coalesce(v_calc.nota_situacao, 'nao_solicitada')
    );

    v_resultado := v_resultado || v_row;
  END LOOP;

  RETURN v_resultado;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buscar_fila_financeira(integer, integer, text, text, text) TO authenticated;
