-- Migration 023: Suporte a Componentes de Regras Financeiras e Checagem de Conflito de Vigência
--

-- 1. ADICIONAR UNIDADE_ID E PRECEPTOR_ID EM REGRAS_FINANCEIRAS SE NÃO EXISTIREM
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'regras_financeiras' AND column_name = 'unidade_id') THEN
    ALTER TABLE public.regras_financeiras ADD COLUMN unidade_id UUID REFERENCES public.unidades(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'regras_financeiras' AND column_name = 'preceptor_id') THEN
    ALTER TABLE public.regras_financeiras ADD COLUMN preceptor_id UUID REFERENCES public.preceptores(id);
  END IF;
END $$;

-- Tornar forma_calculo e valor com valor padrao/opcional na regra pai
ALTER TABLE public.regras_financeiras ALTER COLUMN forma_calculo SET DEFAULT 'por_turno'::public.forma_calculo;
ALTER TABLE public.regras_financeiras ALTER COLUMN forma_calculo DROP NOT NULL;
ALTER TABLE public.regras_financeiras ALTER COLUMN valor SET DEFAULT 0;
ALTER TABLE public.regras_financeiras ALTER COLUMN valor DROP NOT NULL;

-- 2. CRIAR TABELA REGRA_COMPONENTES
CREATE TABLE IF NOT EXISTS public.regra_componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES public.regras_financeiras(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'por_turno', 'fixo_mensal', 'por_ocorrencia', 'valor_dividido', 'adicional_fixo', 'desconto', 'sem_pagamento'
  valor NUMERIC(14,2) DEFAULT NULL,
  ordem INTEGER DEFAULT 1,
  exige_presenca BOOLEAN DEFAULT TRUE,
  quantidade_minima NUMERIC(14,2) DEFAULT NULL,
  status PUBLIC.status_registro DEFAULT 'ativo'::PUBLIC.status_registro,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_regra_componentes_updated ON public.regra_componentes;
CREATE TRIGGER trg_regra_componentes_updated
  BEFORE UPDATE ON public.regra_componentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.regra_componentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regra_componentes_read_staff ON public.regra_componentes;
CREATE POLICY regra_componentes_read_staff ON public.regra_componentes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS regra_componentes_write_staff ON public.regra_componentes;
CREATE POLICY regra_componentes_write_staff ON public.regra_componentes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.regra_componentes TO authenticated;

-- 3. RPC PARA CHECAR SOBREPOSIÇÃO E CONFLITO DE REGRAS FINANCEIRAS
CREATE OR REPLACE FUNCTION public.checar_conflito_regra_financeira(
  p_regra_id UUID,
  p_tipo_atuacao PUBLIC.tipo_atuacao,
  p_unidade_id UUID,
  p_internato_id UUID,
  p_disciplina_id UUID,
  p_local_id UUID,
  p_setor_id UUID,
  p_preceptor_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conflitos JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'nome', r.nome,
      'data_inicio', r.data_inicio,
      'data_fim', r.data_fim
    )
  ) INTO v_conflitos
  FROM public.regras_financeiras r
  WHERE r.status = 'ativo'
    AND (p_regra_id IS NULL OR r.id != p_regra_id)
    AND coalesce(r.tipo_atuacao, 'adm') = coalesce(p_tipo_atuacao, 'adm')
    AND coalesce(r.unidade_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_unidade_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(r.internato_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_internato_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(r.disciplina_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_disciplina_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(r.local_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_local_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(r.setor_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_setor_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND coalesce(r.preceptor_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_preceptor_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (p_data_fim IS NULL OR r.data_inicio <= p_data_fim)
    AND (r.data_fim IS NULL OR r.data_fim >= p_data_inicio);

  IF v_conflitos IS NOT NULL AND jsonb_array_length(v_conflitos) > 0 THEN
    RETURN jsonb_build_object('conflito', true, 'regras', v_conflitos);
  END IF;

  RETURN jsonb_build_object('conflito', false, 'regras', '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.checar_conflito_regra_financeira TO authenticated;
