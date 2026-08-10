-- ============================================================================
-- MIGRACAO 013: SIMPLIFICAR CADASTRO AUXILIAR DE SETORES
-- Torna local_id opcional, substitui unique por nome apenas, garante
-- sigla e auditoria automaticas (como nos demais cadastros auxiliares).
--
-- Verificado: nenhuma tabela referencia setores.local_id via FK.
-- O vinculo entre local e setor ocorre via vinculo_locais.setor_id.
-- local_id permanece como coluna (nullable) para compatibilidade
-- com fetchSetoresByLocal e checkLocalDependencies existentes.
-- ============================================================================
begin;

-- 1. Tornar local_id e aplicacao opcionais (nao impedem mais cadastro simples)
ALTER TABLE public.setores ALTER COLUMN local_id DROP NOT NULL;
ALTER TABLE public.setores ALTER COLUMN aplicacao DROP NOT NULL;

-- 2. Remover constraint e indice antigos que dependem de local_id
--    (UNIQUE(local_id, nome) e indice com local_id::text impedem o cadastro
--    simples, exigindo sempre um local)
ALTER TABLE public.setores DROP CONSTRAINT IF EXISTS setores_local_id_nome_unique;
DROP INDEX IF EXISTS idx_setores_nome_unique;

-- 3. Novo indice unico apenas por nome (como profissoes, disciplinas, locais)
CREATE UNIQUE INDEX IF NOT EXISTS idx_setores_nome_unique ON public.setores (lower(trim(nome)));

-- 4. Garantir trigger de sigla (gera sigla automaticamente no INSERT)
DROP TRIGGER IF EXISTS trg_setores_sigla ON public.setores;
CREATE TRIGGER trg_setores_sigla
  BEFORE INSERT ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_sigla();

-- 5. Garantir trigger de auditoria (como nos demais cadastros auxiliares)
DROP TRIGGER IF EXISTS trg_setores_audit ON public.setores;
CREATE TRIGGER trg_setores_audit
  AFTER INSERT OR DELETE OR UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 6. Gerar siglas para setores existentes sem sigla
UPDATE public.setores SET sigla = public.generate_sigla('setores', nome)
WHERE sigla IS NULL OR sigla = '';

commit;
