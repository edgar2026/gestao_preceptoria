-- Migration 008: RLS anti-elevacao, auditoria de gestao de usuarios, RPCs de senha
-- Requer: 004_auth_setup.sql, 006_role_admin_super.sql, 007a/007b

-- ============================================================
-- 1. Funcao auxiliar: impedir que usuario mude sua propria role
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile_id uuid;
  v_user_roles text[];
BEGIN
  -- Obter o profile_id do usuario autenticado
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid() AND ativo = true;

  -- Se nao encontrou profile, permitir (service_role ou trigger)
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se o usuario esta tentando alterar sua propria role, bloquear
  IF NEW.profile_id = v_profile_id THEN
    RAISE EXCEPTION 'Voce nao pode alterar suas proprias permissoes.';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger para bloquear auto-elevacao em user_roles
DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON user_roles;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_role_change();

-- ============================================================
-- 2. Funcao para redefinir senha de usuario (Admin API via SQL logica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.redefinir_senha_usuario(
  p_user_id uuid,
  p_nova_senha text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_role boolean;
  v_target_profile profiles%ROWTYPE;
BEGIN
  -- Verificar se o chamador e admin_super
  SELECT has_role(ARRAY['admin_super'::app_role]) INTO v_admin_role;
  IF NOT v_admin_role THEN
    RAISE EXCEPTION 'Apenas super_admin pode redefinir senhas.';
  END IF;

  -- Validar senha
  IF length(p_nova_senha) < 8 THEN
    RAISE EXCEPTION 'Senha deve ter pelo menos 8 caracteres.';
  END IF;

  -- Buscar profile do alvo
  SELECT * INTO v_target_profile
  FROM profiles
  WHERE user_id = p_user_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado ou inativo.';
  END IF;

  -- Log da operacao
  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_novos, user_id)
  VALUES ('auth.users', p_user_id, 'PASSWORD_RESET',
    jsonb_build_object('profile_id', v_target_profile.id, 'email', v_target_profile.email),
    auth.uid());

  -- Nota: A redefinicao real e feita via GoTrue Admin API (Edge Function)
  -- Esta funcao apenas regista a auditoria e valida permissoes
  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_target_profile.id,
    'email', v_target_profile.email,
    'message', 'Auditoria registada. Use a Edge Function para aplicar a mudanca.'
  );
END;
$$;

-- ============================================================
-- 3. Funcao para bloquear/desbloquear usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.bloquear_usuario(
  p_profile_id uuid,
  p_bloquear boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_role boolean;
  v_target profiles%ROWTYPE;
BEGIN
  SELECT has_role(ARRAY['admin_super'::app_role]) INTO v_admin_role;
  IF NOT v_admin_role THEN
    RAISE EXCEPTION 'Apenas super_admin pode bloquear/desbloquear usuarios.';
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  -- Nao permitir bloquear a si mesmo
  IF v_target.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Voce nao pode bloquear seu proprio acesso.';
  END IF;

  -- Atualizar status
  UPDATE profiles SET ativo = NOT p_bloquear, updated_at = now() WHERE id = p_profile_id;

  -- Desativar todas as roles se bloqueando
  IF p_bloquear THEN
    UPDATE user_roles SET ativo = false WHERE profile_id = p_profile_id;
  END IF;

  -- Auditoria
  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_anteriores, dados_novos, user_id)
  VALUES ('profiles', p_profile_id,
    CASE WHEN p_bloquear THEN 'BLOCK' ELSE 'UNBLOCK' END,
    jsonb_build_object('ativo', v_target.ativo),
    jsonb_build_object('ativo', NOT p_bloquear),
    auth.uid());

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'ativo', NOT p_bloquear
  );
END;
$$;

-- ============================================================
-- 4. Funcao para atualizar dados basicos (nome, telefone)
-- ============================================================
CREATE OR REPLACE FUNCTION public.atualizar_dados_usuario(
  p_profile_id uuid,
  p_nome text,
  p_email text,
  p_telefone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_role boolean;
  v_target profiles%ROWTYPE;
  v_dados_anteriores jsonb;
BEGIN
  SELECT has_role(ARRAY['admin_super'::app_role]) INTO v_admin_role;
  IF NOT v_admin_role THEN
    RAISE EXCEPTION 'Apenas super_admin pode atualizar dados de usuarios.';
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado.';
  END IF;

  v_dados_anteriores := to_jsonb(v_target);

  UPDATE profiles SET
    nome_completo = COALESCE(p_nome, nome_completo),
    email = COALESCE(p_email, email),
    telefone = p_telefone,
    updated_at = now()
  WHERE id = p_profile_id;

  -- Auditoria
  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_anteriores, dados_novos, user_id)
  VALUES ('profiles', p_profile_id, 'UPDATE',
    v_dados_anteriores,
    jsonb_build_object('nome_completo', p_nome, 'email', p_email, 'telefone', p_telefone),
    auth.uid());

  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id);
END;
$$;

-- ============================================================
-- 5. Grants para as novas funcoes
-- ============================================================
GRANT EXECUTE ON FUNCTION public.redefinir_senha_usuario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bloquear_usuario(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_dados_usuario(uuid, text, text, text) TO authenticated;

-- ============================================================
-- 6. RLS adicional: profiles_select_own_or_staff inclui admin_super
-- ============================================================
-- A policy existente profiles_select_own_or_staff ja inclui 'administrador'
-- Precisamos adicionar 'admin_super' e 'super_admin' a lista de roles que podem ver todos
DROP POLICY IF EXISTS profiles_select_own_or_staff ON profiles;
CREATE POLICY profiles_select_own_or_staff ON profiles
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.has_role(ARRAY['administrador'::app_role, 'admin_super'::app_role, 'super_admin'::app_role])
  );

-- ============================================================
-- 7. Policy para user_roles: admin_super e super_admin podem gerir
-- ============================================================
DROP POLICY IF EXISTS roles_admin_all ON user_roles;
CREATE POLICY roles_admin_all ON user_roles
  FOR ALL
  USING (
    public.has_role(ARRAY['administrador'::app_role, 'admin_super'::app_role, 'super_admin'::app_role])
  );
