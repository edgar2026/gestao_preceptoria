-- ============================================================================
-- MIGRACAO 019: dia_semana automatico em escalas_itens
--
-- A RPC salvar_escala_completa grava escalas_itens (escala_id, data, turno)
-- sem informar dia_semana, mas a coluna e NOT NULL e nao possui default.
-- Este trigger deriva dia_semana a partir de data em qualquer insert/update.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_escalas_itens_dia_semana()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data IS NOT NULL THEN
    NEW.dia_semana := extract(dow from NEW.data)::smallint;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_escalas_itens_dia_semana ON public.escalas_itens;
CREATE TRIGGER trg_escalas_itens_dia_semana
BEFORE INSERT OR UPDATE OF data ON public.escalas_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_escalas_itens_dia_semana();
