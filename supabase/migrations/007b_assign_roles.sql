-- STEP 2: Assign roles, update has_role, setup Edgar (after enum committed)
BEGIN;

-- Clean up test roles
DELETE FROM public.user_roles WHERE profile_id = '1e5e0024-7b59-4921-b30f-fb2cb27e5d5f';

-- Recreate has_role
CREATE OR REPLACE FUNCTION public.has_role(roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid()
      AND ur.role = ANY(roles)
      AND ur.ativo = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role[]) TO anon;

-- Assign super_admin to Edgar
INSERT INTO public.user_roles (profile_id, role, ativo)
VALUES ('1e5e0024-7b59-4921-b30f-fb2cb27e5d5f', 'super_admin', true)
ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;

-- Also assign admin_super for backwards compatibility
INSERT INTO public.user_roles (profile_id, role, ativo)
VALUES ('1e5e0024-7b59-4921-b30f-fb2cb27e5d5f', 'admin_super', true)
ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;

-- Ensure profile is active
UPDATE public.profiles SET ativo = true, nome_completo = 'Edgar Tavares'
WHERE user_id = '43798776-8a30-408d-8f04-98031ca3e5c3';

COMMIT;
