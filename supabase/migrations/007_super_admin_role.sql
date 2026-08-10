-- ============================================================
-- MIGRATION 007: super_admin role + Edgar Tavares setup
-- ============================================================
BEGIN;

-- 1. Clean up any test roles
DELETE FROM public.user_roles WHERE profile_id = '1e5e0024-7b59-4921-b30f-fb2cb27e5d5f';

-- 2. Add super_admin to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin' AFTER 'preceptor';
  END IF;
END $$;

-- 3. Also add admin_super if it doesn't exist (migration 006 may not have run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'admin_super'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin_super' BEFORE 'super_admin';
  END IF;
END $$;

-- 4. Recreate has_role to include super_admin checks
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

-- 5. Assign super_admin to Edgar Tavares
INSERT INTO public.user_roles (profile_id, role, ativo)
VALUES ('1e5e0024-7b59-4921-b30f-fb2cb27e5d5f', 'super_admin', true)
ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;

-- 6. Also assign admin_super for backwards compatibility
INSERT INTO public.user_roles (profile_id, role, ativo)
VALUES ('1e5e0024-7b59-4921-b30f-fb2cb27e5d5f', 'admin_super', true)
ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;

-- 7. Ensure profile is active
UPDATE public.profiles SET ativo = true, nome_completo = 'Edgar Tavares'
WHERE user_id = '43798776-8a30-408d-8f04-98031ca3e5c3';

-- 8. Verify
SELECT p.nome_completo, p.email, p.ativo, ur.role, ur.ativo as role_ativo
FROM public.profiles p
JOIN public.user_roles ur ON ur.profile_id = p.id
WHERE p.user_id = '43798776-8a30-408d-8f04-98031ca3e5c3';

COMMIT;
