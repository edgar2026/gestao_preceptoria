-- 041_fix_vinculo_unique_constraint.sql
-- Ajusta constraint única da tabela calculos para suportar múltiplos vínculos.
--
-- PROBLEMA:
--   A constraint UNIQUE (competencia_id, preceptor_id, versao) impedia
--   que dois vínculos do mesmo preceptor fossem processados na mesma
--   competência (ambos começariam na versão 1).
--
-- SOLUÇÃO:
--   1. Remove constraint antiga
--   2. Adiciona constraint que inclui tipo_atuacao e vinculos
--      UNIQUE (competencia_id, preceptor_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id)
--   3. Permite mesma versão para vínculos diferentes

-- 1. Remover constraint antiga
ALTER TABLE public.calculos
  DROP CONSTRAINT IF EXISTS calculos_competencia_id_preceptor_id_versao_key;

-- 2. Adicionar constraint que impede duplicidade real (mesmo vínculo)
--    Permite que dois vínculos diferentes do mesmo preceptor existam
ALTER TABLE public.calculos
  ADD CONSTRAINT calculos_competencia_vinculo_uniq
  UNIQUE (competencia_id, preceptor_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id);
