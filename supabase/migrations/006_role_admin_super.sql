-- ============================================================================
-- MIGRACAO 006: ROLE admin_super + TABELA DE USUARIOS
--
-- Adiciona a role 'admin_super' ao enum app_role e prepara o banco
-- para a tela de gerenciamento de usuarios.
--
-- NOTA: Usuarios devem ser criados manualmente no Supabase Dashboard
-- (Authentication > Users). Esta migracao apenas gerencia perfis e roles.
--
-- EXECUCAO: Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Adicionar 'admin_super' ao enum app_role
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'admin_super'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin_super' AFTER 'administrador';
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 2. Funcao para listar usuarios com seus roles (usada pela tela admin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.listar_usuarios_staff()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_rec record;
  v_roles jsonb;
  v_user RECORD;
BEGIN
  IF NOT public.has_role(array['admin_super']::public.app_role[]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR v_rec IN
    SELECT
      p.id as profile_id,
      p.user_id,
      p.nome_completo,
      p.email,
      p.telefone,
      p.ativo,
      p.created_at,
      (
        SELECT jsonb_agg(ur.role::text)
        FROM public.user_roles ur
        WHERE ur.profile_id = p.id AND ur.ativo = true
      ) as roles,
      au.last_sign_in_at,
      au.confirmed_at
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.user_id
    ORDER BY p.nome_completo
  LOOP
    v_row := jsonb_build_object(
      'profile_id', v_rec.profile_id,
      'user_id', v_rec.user_id,
      'nome_completo', v_rec.nome_completo,
      'email', v_rec.email,
      'telefone', v_rec.telefone,
      'ativo', v_rec.ativo,
      'created_at', v_rec.created_at,
      'roles', coalesce(v_rec.roles, '[]'::jsonb),
      'ultimo_acesso', v_rec.last_sign_in_at,
      'confirmado_em', v_rec.confirmed_at
    );
    v_result := v_result || v_row;
  END LOOP;

  RETURN v_result;
END;
$$;

-- --------------------------------------------------------------------------
-- 3. Funcao para atualizar usuario (apenas admin_super)
--    NOTA: Nao insere em auth.users. Apenas gerencia profiles e roles.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.atualizar_usuario_staff(
  p_profile_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_roles text[],
  p_ativo boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT public.has_role(array['admin_super']::public.app_role[]) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles SET
    nome_completo = COALESCE(p_nome, nome_completo),
    email = COALESCE(p_email, email),
    telefone = p_telefone,
    ativo = COALESCE(p_ativo, ativo),
    updated_at = now()
  WHERE id = p_profile_id;

  -- Atualizar roles se fornecidas
  IF p_roles IS NOT NULL THEN
    -- Desativar todas as roles atuais
    UPDATE public.user_roles SET ativo = false WHERE profile_id = p_profile_id;

    -- Reativar/criar as roles fornecidas
    FOREACH v_role IN ARRAY p_roles LOOP
      INSERT INTO public.user_roles (profile_id, role)
      VALUES (p_profile_id, v_role::public.app_role)
      ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

-- --------------------------------------------------------------------------
-- 4. GRANTs para as novas funcoes
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.listar_usuarios_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_usuario_staff(uuid, text, text, text, text[], boolean) TO authenticated;

-- --------------------------------------------------------------------------
-- 5. Policies RLS para admin_super (se necessario)
-- ---------------------------------------------------------------------------

-- A tabela user_roles ja tem policies que usam has_role()
-- As funcoes acima ja validam has_role(array['admin_super'])

COMMIT;
