-- 038_fix_redefinir_acesso_e_arquivar_usuario.sql
-- Correcao dos fluxos "Redefinir Acesso" e "Excluir/Arquivar Usuario"
-- 1. Protecao contra arquivamento do ultimo administrador ativo
-- 2. Correcao do reativar para restaurar roles desativadas
-- 3. Registro de motivo de inativacao nulo ao reativar

CREATE OR REPLACE FUNCTION public.inativar_reativar_usuario(p_profile_id uuid, p_inativar boolean, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE 
  v_admin_role boolean; 
  v_target profiles%ROWTYPE;
  v_caller_id uuid;
  v_active_admin_count bigint;
BEGIN
  SELECT has_role(ARRAY['admin'::app_role]) INTO v_admin_role;
  IF NOT v_admin_role THEN RAISE EXCEPTION 'Apenas administradores podem inativar/reativar usuarios.'; END IF;
  SELECT * INTO v_target FROM profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario nao encontrado.'; END IF;
  IF v_target.user_id = auth.uid() THEN RAISE EXCEPTION 'Voce nao pode inativar seu proprio acesso.'; END IF;

  -- Protecao: nao permitir arquivar o ultimo administrador ativo
  IF p_inativar THEN
    SELECT count(*) INTO v_active_admin_count
    FROM profiles p
    JOIN user_roles ur ON ur.profile_id = p.id
    WHERE p.ativo = true
      AND ur.role = 'admin'
      AND ur.ativo = true
      AND p.id != p_profile_id;

    IF v_active_admin_count = 0 THEN
      RAISE EXCEPTION 'Nao e possivel arquivar o ultimo administrador ativo do sistema.';
    END IF;
  END IF;

  SELECT id INTO v_caller_id FROM profiles WHERE user_id = auth.uid();
  UPDATE profiles SET 
    ativo = NOT p_inativar, 
    status = CASE WHEN p_inativar THEN 'inativo' ELSE 'ativo' END,
    motivo_bloqueio_inativacao = CASE WHEN p_inativar THEN p_motivo ELSE NULL END,
    responsavel_ultima_alteracao = (SELECT email FROM auth.users WHERE id = auth.uid()),
    updated_at = now() 
  WHERE id = p_profile_id;
  IF p_inativar THEN UPDATE user_roles SET ativo = false WHERE profile_id = p_profile_id; END IF;
  IF NOT p_inativar THEN UPDATE user_roles SET ativo = true WHERE profile_id = p_profile_id; END IF;
  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_anteriores, dados_novos, profile_id)
  VALUES ('profiles', p_profile_id, CASE WHEN p_inativar THEN 'INATIVAR' ELSE 'REATIVAR' END,
    jsonb_build_object('ativo', v_target.ativo, 'status', v_target.status),
    jsonb_build_object('ativo', NOT p_inativar, 'status', CASE WHEN p_inativar THEN 'inativo' ELSE 'ativo' END, 'motivo', p_motivo),
    v_caller_id);
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id, 'ativo', NOT p_inativar);
END;
$function$;

-- Funcao redefinir_acesso_usuario (ja existente, registro para completude)
CREATE OR REPLACE FUNCTION public.redefinir_acesso_usuario(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE 
  v_admin_role boolean; 
  v_target profiles%ROWTYPE;
  v_caller_id uuid;
BEGIN
  SELECT has_role(ARRAY['admin'::app_role]) INTO v_admin_role;
  IF NOT v_admin_role THEN RAISE EXCEPTION 'Apenas administradores podem redefinir acesso.'; END IF;
  SELECT * INTO v_target FROM profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario nao encontrado.'; END IF;
  IF v_target.user_id = auth.uid() THEN RAISE EXCEPTION 'Voce nao pode redefinir seu proprio acesso.'; END IF;
  SELECT id INTO v_caller_id FROM profiles WHERE user_id = auth.uid();
  UPDATE profiles SET 
    primeiro_acesso_pendente = true,
    data_troca_senha = NULL,
    responsavel_ultima_alteracao = (SELECT email FROM auth.users WHERE id = auth.uid()),
    updated_at = now() 
  WHERE id = p_profile_id;
  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_novos, profile_id)
  VALUES ('profiles', p_profile_id, 'REDEFINIR_ACESSO',
    jsonb_build_object('primeiro_acesso_pendente', true, 'motivo', 'Redefinicao forcada pelo administrador'), v_caller_id);
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id, 'email', v_target.email);
END;
$function$;

-- Funcao marcar_primeiro_acesso_concluido (ja existente, registro para completude)
CREATE OR REPLACE FUNCTION public.marcar_primeiro_acesso_concluido(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_caller_id uuid;
BEGIN
  SELECT id INTO v_caller_id FROM profiles WHERE user_id = auth.uid();
  UPDATE profiles SET 
    primeiro_acesso_pendente = false,
    data_troca_senha = now(),
    responsavel_ultima_alteracao = (SELECT email FROM auth.users WHERE id = auth.uid()),
    updated_at = now() 
  WHERE id = p_profile_id;
  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_novos, profile_id)
  VALUES ('profiles', p_profile_id, 'PRIMEIRO_ACESSO_CONCLUIDO',
    jsonb_build_object('primeiro_acesso_pendente', false, 'data_troca_senha', now()), v_caller_id);
  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id);
END;
$function$;
