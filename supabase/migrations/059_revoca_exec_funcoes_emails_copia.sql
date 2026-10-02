-- ============================================================
-- Migration 059: revoga EXECUTE das funções dos e-mails cópia
-- ============================================================
-- Etapa EMAILS-ADICIONAIS-CADASTRO
--
-- As funções criadas na migração 058 são funções de TRIGGER
-- (SECURITY DEFINER). A execução de trigger não depende de
-- EXECUTE no momento da disparada, mas, por serem expostas no
-- schema public, PostgREST as tornaria chamáveis via
-- /rest/v1/rpc/... para anon e authenticated.
--
-- Esta migração apenas remove esse acesso indevido; nenhuma
-- regra de negócio, tabela ou interface é alterada.
-- ============================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_preceptor_emails_copia_validar() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_preceptor_emails_copia_validar() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_preceptor_emails_copia_validar() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_preceptores_email_principal_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_preceptores_email_principal_guard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_preceptores_email_principal_guard() FROM authenticated;

COMMIT;
