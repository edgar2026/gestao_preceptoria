-- 008a: Self-role-change guard trigger
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid() AND ativo = true;

  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id = v_profile_id THEN
    RAISE EXCEPTION 'Voce nao pode alterar suas proprias permissoes.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON user_roles;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_role_change();
