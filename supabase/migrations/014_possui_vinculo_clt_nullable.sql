-- ============================================================================
-- MIGRACAO 014: TORNAR possui_vinculo_clt NULLABLE NA TABELA preceptores
-- Permite que o campo "Vínculo CLT?" fique como null quando a opção
-- "Selecione" (não informado) for escolhida no formulário.
-- Valores existentes (false) são preservados.
-- ============================================================================
begin;

ALTER TABLE public.preceptores
  ALTER COLUMN possui_vinculo_clt DROP NOT NULL,
  ALTER COLUMN possui_vinculo_clt DROP DEFAULT;

commit;
