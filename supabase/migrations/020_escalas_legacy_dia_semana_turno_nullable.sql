-- ============================================================================
-- MIGRACAO 020: tornar escalas.dia_semana e escalas.turno opcionais
--
-- Colunas legadas do modelo pre-relacional. O dado real de data/turno agora
-- vive em escalas_itens (data, turno). A RPC salvar_escala_completa nao
-- preenche estas colunas e a insercao falhava por NOT NULL sem default.
-- ============================================================================

ALTER TABLE public.escalas
  ALTER COLUMN dia_semana DROP NOT NULL,
  ALTER COLUMN turno DROP NOT NULL;
