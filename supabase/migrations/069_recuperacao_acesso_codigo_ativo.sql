-- ==============================================================================
-- Migração 069: Recuperação de Acesso - Código Ativo e Limpeza de Histórico Concluído
-- Permite que o administrador consulte o código de primeiro acesso a qualquer
-- momento até a troca de senha pelo usuário. Quando a senha for trocada e o
-- acesso concluído, a solicitação deixa de aparecer na lista de recuperações.
-- ==============================================================================

-- 1. Colunas adicionais para armazenar código temporário ativo e data de conclusão
ALTER TABLE public.recuperacao_acesso_solicitacoes
  ADD COLUMN IF NOT EXISTS codigo_temporario text,
  ADD COLUMN IF NOT EXISTS senha_trocada_em timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS codigo_temporario_acesso text;

-- Ajustar constraint de situação para incluir 'aguardando_troca' e 'concluida'
ALTER TABLE public.recuperacao_acesso_solicitacoes
  DROP CONSTRAINT IF EXISTS recuperacao_acesso_solicitacoes_situacao_check;

ALTER TABLE public.recuperacao_acesso_solicitacoes
  ADD CONSTRAINT recuperacao_acesso_solicitacoes_situacao_check
  CHECK (situacao IN ('pendente', 'resolvida', 'aguardando_troca', 'concluida', 'cancelada'));

-- 2. Atualizar solicitações existentes cujos usuários já concluíram o primeiro acesso
UPDATE public.recuperacao_acesso_solicitacoes s
SET situacao = 'concluida',
    senha_trocada_em = COALESCE(p.data_troca_senha, now()),
    codigo_temporario = NULL
FROM public.profiles p
WHERE p.id = s.profile_id
  AND (p.primeiro_acesso_pendente IS FALSE OR p.primeiro_acesso_pendente IS NULL);

-- 3. Atualizar a RPC marcar_primeiro_acesso_concluido
CREATE OR REPLACE FUNCTION public.marcar_primeiro_acesso_concluido(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  v_caller_id uuid;
BEGIN
  SELECT id INTO v_caller_id FROM profiles WHERE user_id = auth.uid();

  UPDATE profiles SET 
    primeiro_acesso_pendente = false,
    data_troca_senha = now(),
    codigo_temporario_acesso = NULL,
    responsavel_ultima_alteracao = (SELECT email FROM auth.users WHERE id = auth.uid()),
    updated_at = now() 
  WHERE id = p_profile_id;

  -- Marca como concluída e limpa o código temporário em solicitações ativas
  UPDATE public.recuperacao_acesso_solicitacoes SET
    situacao = 'concluida',
    codigo_temporario = NULL,
    senha_trocada_em = now(),
    updated_at = now()
  WHERE profile_id = p_profile_id
    AND situacao IN ('pendente', 'resolvida', 'aguardando_troca');

  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_novos, profile_id)
  VALUES ('profiles', p_profile_id, 'PRIMEIRO_ACESSO_CONCLUIDO',
    jsonb_build_object('primeiro_acesso_pendente', false, 'data_troca_senha', now()), v_caller_id);

  RETURN jsonb_build_object('success', true, 'profile_id', p_profile_id);
END;
$$;

-- 4. Atualizar a RPC listar_solicitacoes_recuperacao_acesso
DROP FUNCTION IF EXISTS public.listar_solicitacoes_recuperacao_acesso();

CREATE OR REPLACE FUNCTION public.listar_solicitacoes_recuperacao_acesso()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  profile_id uuid,
  nome_usuario text,
  email text,
  perfil text,
  unidades jsonb,
  situacao text,
  tentativas integer,
  solicitada_em timestamptz,
  ultima_tentativa_em timestamptz,
  resolvida_em timestamptz,
  resolvida_por_nome text,
  codigo_temporario text,
  primeiro_acesso_pendente boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem visualizar as recuperações de acesso.' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.profile_id,
    COALESCE(p.nome_completo, s.email) AS nome_usuario,
    s.email,
    s.perfil,
    s.unidades,
    s.situacao,
    s.tentativas,
    s.solicitada_em,
    s.ultima_tentativa_em,
    s.resolvida_em,
    rp.nome_completo AS resolvida_por_nome,
    COALESCE(s.codigo_temporario, p.codigo_temporario_acesso) AS codigo_temporario,
    COALESCE(p.primeiro_acesso_pendente, false) AS primeiro_acesso_pendente
  FROM public.recuperacao_acesso_solicitacoes s
  LEFT JOIN public.profiles p ON p.id = s.profile_id
  LEFT JOIN public.profiles rp ON rp.id = s.resolvida_por
  WHERE s.situacao NOT IN ('concluida', 'cancelada')
    AND (p.primeiro_acesso_pendente IS TRUE OR s.situacao = 'pendente')
  ORDER BY 
    CASE WHEN s.situacao = 'pendente' THEN 0 ELSE 1 END,
    s.ultima_tentativa_em DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_solicitacoes_recuperacao_acesso() TO authenticated;
