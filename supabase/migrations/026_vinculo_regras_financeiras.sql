-- Migration 026: Regra Financeira vinculada ao vínculo de Prática/Internato
-- + cadastro incompleto permitido também na Prática (badge vermelho).

-- 1. TABELA DE ASSOCIAÇÃO REGRA <-> VÍNCULO (histórico preservado, nunca apenas cadastro pessoal)
CREATE TABLE IF NOT EXISTS public.vinculo_regras_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_adm_id UUID REFERENCES public.vinculos_adm(id) ON DELETE CASCADE,
  vinculo_internato_id UUID REFERENCES public.vinculos_internato(id) ON DELETE CASCADE,
  regra_id UUID NOT NULL REFERENCES public.regras_financeiras(id),
  data_inicio DATE NOT NULL DEFAULT current_date,
  data_fim DATE,
  status PUBLIC.status_registro NOT NULL DEFAULT 'ativo'::PUBLIC.status_registro,
  justificativa TEXT,
  encerrado_justificativa TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vinculo_regras_financeiras_check CHECK (
    (vinculo_adm_id IS NOT NULL AND vinculo_internato_id IS NULL)
    OR (vinculo_adm_id IS NULL AND vinculo_internato_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS vinculo_regras_financeiras_vinculo_idx
  ON public.vinculo_regras_financeiras (vinculo_adm_id, vinculo_internato_id);
CREATE INDEX IF NOT EXISTS vinculo_regras_financeiras_regra_idx
  ON public.vinculo_regras_financeiras (regra_id);

DROP TRIGGER IF EXISTS trg_vinculo_regras_updated ON public.vinculo_regras_financeiras;
CREATE TRIGGER trg_vinculo_regras_updated
  BEFORE UPDATE ON public.vinculo_regras_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vinculo_regras_audit ON public.vinculo_regras_financeiras;
CREATE TRIGGER trg_vinculo_regras_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.vinculo_regras_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.vinculo_regras_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vinculo_regras_read ON public.vinculo_regras_financeiras;
CREATE POLICY vinculo_regras_read ON public.vinculo_regras_financeiras
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vinculo_regras_write ON public.vinculo_regras_financeiras;
CREATE POLICY vinculo_regras_write ON public.vinculo_regras_financeiras
  FOR ALL TO authenticated
  USING (has_role(ARRAY['admin'::public.app_role, 'super_admin'::public.app_role]))
  WITH CHECK (has_role(ARRAY['admin'::public.app_role, 'super_admin'::public.app_role]));

GRANT ALL ON public.vinculo_regras_financeiras TO authenticated;

-- 2. PRÁTICA: permitir cadastro incompleto (liberação para Escala exige campos obrigatórios)
ALTER TABLE public.vinculos_adm
  ALTER COLUMN semestre_id DROP NOT NULL,
  ALTER COLUMN disciplina_id DROP NOT NULL,
  ALTER COLUMN periodo_id DROP NOT NULL,
  ALTER COLUMN data_inicio DROP NOT NULL;
