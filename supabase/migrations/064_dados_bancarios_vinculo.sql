-- 064_dados_bancarios_vinculo.sql
-- Etapa: ADICIONAR-DADOS-BANCARIOS-AO-VINCULO
-- Adiciona Agência e Conta ao vínculo (não ao cadastro principal do preceptor).
-- Campos opcionais (NULL permitido), exibidos no formulário quando a modalidade
-- do vínculo for NFS ou RPA e apresentados no e-mail final somente quando preenchidos.
-- Sem validação matemática de dígito; aceita números, hífen e demais caracteres
-- usados em contas bancárias. Nenhum outro campo, tabela, RPC ou regra é alterado.

ALTER TABLE public.vinculos_internato ADD COLUMN IF NOT EXISTS agencia text;
ALTER TABLE public.vinculos_internato ADD COLUMN IF NOT EXISTS conta text;
ALTER TABLE public.vinculos_adm ADD COLUMN IF NOT EXISTS agencia text;
ALTER TABLE public.vinculos_adm ADD COLUMN IF NOT EXISTS conta text;

COMMENT ON COLUMN public.vinculos_internato.agencia IS 'Agência bancária do vínculo (opcional; modalidades NFS/RPA).';
COMMENT ON COLUMN public.vinculos_internato.conta IS 'Conta bancária do vínculo (opcional; modalidades NFS/RPA).';
COMMENT ON COLUMN public.vinculos_adm.agencia IS 'Agência bancária do vínculo (opcional; modalidades NFS/RPA).';
COMMENT ON COLUMN public.vinculos_adm.conta IS 'Conta bancária do vínculo (opcional; modalidades NFS/RPA).';
