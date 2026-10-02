-- ============================================================
-- Migration 058: E-mails adicionais (para cópia) do preceptor
-- ============================================================
-- Etapa EMAILS-ADICIONAIS-CADASTRO
--
-- O e-mail principal continua na tabela `preceptores.email`
-- (coluna preservada, sem migração de dados). Esta migração cria
-- a estrutura mínima de e-mails adicionais para cópia, que
-- pertencem ao CADASTRO PRINCIPAL do preceptor (não ao vínculo).
--
-- Regras:
--   - cada linha contem id, preceptor_id, email, ativo,
--     criado_em e atualizado_em;
--   - o mesmo e-mail adicional nao pode repetir no mesmo
--     preceptor (comparacao sem diferenciar maiusculas);
--   - o e-mail adicional nunca pode ser igual ao e-mail principal
--     (validado nos dois sentidos);
--   - remocao de uso = desativacao (historico preservado);
--   - somente Administrador le e grava (RLS);
--   - auditoria (audit_logs) e atualizado_em automaticos.
-- ============================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Tabela
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.preceptor_emails_copia (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preceptor_id  uuid NOT NULL REFERENCES public.preceptores(id) ON DELETE CASCADE,
  email         text NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preceptor_emails_copia_email_nao_vazio CHECK (btrim(email) <> '')
);

-- --------------------------------------------------------------------------
-- 2. Restricao: mesmo e-mail adicional duplicado no mesmo preceptor
--    (case-insensitive)
-- --------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS preceptor_emails_copia_preceptor_email_uniq
  ON public.preceptor_emails_copia (preceptor_id, lower(btrim(email)));

-- --------------------------------------------------------------------------
-- 3. Validacao + normalizacao + protecao do e-mail principal
--    Mensagens curtas e amigaveis (o frontend nunca expoe SQL/constraint).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_preceptor_emails_copia_validar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_principal text;
BEGIN
  NEW.email := btrim(coalesce(NEW.email, ''));

  IF NEW.email = '' THEN
    RAISE EXCEPTION 'email_vazio';
  END IF;

  IF NEW.email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' THEN
    RAISE EXCEPTION 'email_invalido';
  END IF;

  NEW.ativo := coalesce(NEW.ativo, true);

  SELECT lower(btrim(coalesce(p.email, '')))
    INTO v_principal
    FROM public.preceptores p
   WHERE p.id = NEW.preceptor_id;

  IF coalesce(v_principal, '') <> '' AND lower(NEW.email) = v_principal THEN
    RAISE EXCEPTION 'email_principal_repetido';
  END IF;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preceptor_emails_copia_validar ON public.preceptor_emails_copia;
CREATE TRIGGER trg_preceptor_emails_copia_validar
  BEFORE INSERT OR UPDATE ON public.preceptor_emails_copia
  FOR EACH ROW EXECUTE FUNCTION public.fn_preceptor_emails_copia_validar();

-- --------------------------------------------------------------------------
-- 4. E-mail principal nao pode passar a repetir um e-mail adicional ativo
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_preceptores_email_principal_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copia text;
BEGIN
  IF lower(btrim(coalesce(NEW.email, ''))) = lower(btrim(coalesce(OLD.email, ''))) THEN
    RETURN NEW;
  END IF;

  IF btrim(coalesce(NEW.email, '')) = '' THEN
    RETURN NEW;
  END IF;

  SELECT e.email
    INTO v_copia
    FROM public.preceptor_emails_copia e
   WHERE e.preceptor_id = NEW.id
     AND e.ativo = true
     AND lower(btrim(e.email)) = lower(btrim(NEW.email))
   LIMIT 1;

  IF v_copia IS NOT NULL THEN
    RAISE EXCEPTION 'email_principal_duplicado_copia';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preceptores_email_principal_guard ON public.preceptores;
CREATE TRIGGER trg_preceptores_email_principal_guard
  BEFORE UPDATE OF email ON public.preceptores
  FOR EACH ROW EXECUTE FUNCTION public.fn_preceptores_email_principal_guard();

-- --------------------------------------------------------------------------
-- 5. Auditoria
--    (atualizado_em ja e preenchido pela trigger de validacao)
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_preceptor_emails_copia_audit ON public.preceptor_emails_copia;
CREATE TRIGGER trg_preceptor_emails_copia_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.preceptor_emails_copia
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- --------------------------------------------------------------------------
-- 6. RLS: somente Administrador (Coordenador nao visualiza nem edita)
-- --------------------------------------------------------------------------
ALTER TABLE public.preceptor_emails_copia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preceptor_emails_copia_admin" ON public.preceptor_emails_copia;
CREATE POLICY "preceptor_emails_copia_admin"
  ON public.preceptor_emails_copia
  USING (public.has_role(ARRAY['admin'::public.app_role, 'super_admin'::public.app_role]))
  WITH CHECK (public.has_role(ARRAY['admin'::public.app_role, 'super_admin'::public.app_role]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preceptor_emails_copia TO authenticated;

COMMIT;
