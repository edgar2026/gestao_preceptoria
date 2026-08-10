-- ============================================================================
-- MIGRACAO 015: AJUSTES FINOS PARA FORMULARIOS DE PRECEPTORES
-- 1. Aumenta precisão de preceptores.valor_inicial de numeric(12,2) para numeric(14,2)
-- 2. Mantém possui_vinculo_clt nullable (migration 014) - sem default
-- ============================================================================
begin;

-- 1. Aumentar precisão de valor_inicial para suportar valores maiores
ALTER TABLE public.preceptores
  ALTER COLUMN valor_inicial TYPE numeric(14,2) USING valor_inicial::numeric(14,2);

commit;
