-- Migration 024: Condição de liberação nos componentes de regras financeiras
--
-- Alterações aditivas (não destrutivas):
-- 1. valor_extra    -> parcela fixa do componente "Por turno mais valor fixo".
-- 2. contagem_tipo  -> base de contagem da quantidade mínima: turnos | dias | ocorrencias.

ALTER TABLE public.regra_componentes
  ADD COLUMN IF NOT EXISTS valor_extra NUMERIC(14,2);

ALTER TABLE public.regra_componentes
  ADD COLUMN IF NOT EXISTS contagem_tipo TEXT DEFAULT 'turnos';

COMMENT ON COLUMN public.regra_componentes.valor_extra IS 'Parcela fixa do componente por_turno_mais_fixo.';
COMMENT ON COLUMN public.regra_componentes.contagem_tipo IS 'Unidade da quantidade minima para liberacao: turnos, dias ou ocorrencias.';
