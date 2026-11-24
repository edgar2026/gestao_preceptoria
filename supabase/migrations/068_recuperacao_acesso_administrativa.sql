-- Migration 068: Fluxo de Recuperação de Acesso Administrativa
-- Etapa: RECUPERACAO-DE-ACESSO-ADMINISTRATIVA
-- 1. Tabela recuperacao_acesso_config (configuração global do responsável pelo acesso)
-- 2. Tabela recuperacao_acesso_solicitacoes (histórico e solicitações pendentes)
-- 3. RPC solicitar_recuperacao_acesso (pública / anon para registrar solicitação com rate limit)
-- 4. RPCs de configuração e consulta do responsável
-- 5. RPC listar_solicitacoes_recuperacao_acesso (exclusiva para administradores)
-- 6. RPC resolver_solicitacao_recuperacao_acesso (auxiliar para registro da resolução)

-- 1. Tabela de configuração global do responsável
CREATE TABLE IF NOT EXISTS public.recuperacao_acesso_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_responsavel text NOT NULL,
  email_contato text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.profiles(id)
);

-- Inserir registro padrão se não existir nenhum
INSERT INTO public.recuperacao_acesso_config (nome_responsavel, email_contato, ativo)
SELECT 'Administração do Sistema', 'admin@uninassau.edu.br', true
WHERE NOT EXISTS (SELECT 1 FROM public.recuperacao_acesso_config);

-- RLS para recuperacao_acesso_config
ALTER TABLE public.recuperacao_acesso_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recuperacao_config_select_policy" ON public.recuperacao_acesso_config;
CREATE POLICY "recuperacao_config_select_policy" ON public.recuperacao_acesso_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "recuperacao_config_modify_policy" ON public.recuperacao_acesso_config;
CREATE POLICY "recuperacao_config_modify_policy" ON public.recuperacao_acesso_config
  FOR ALL USING (
    public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role])
  )
  WITH CHECK (
    public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role])
  );

-- 2. Tabela de solicitações de recuperação de acesso
CREATE TABLE IF NOT EXISTS public.recuperacao_acesso_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  perfil text,
  unidades jsonb NOT NULL DEFAULT '[]'::jsonb,
  situacao text NOT NULL DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'resolvida', 'cancelada')),
  tentativas integer NOT NULL DEFAULT 1,
  responsavel_snapshot jsonb,
  solicitada_em timestamptz NOT NULL DEFAULT now(),
  ultima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  resolvida_em timestamptz,
  resolvida_por uuid REFERENCES public.profiles(id),
  codigo_temporario_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recup_solic_email ON public.recuperacao_acesso_solicitacoes(email);
CREATE INDEX IF NOT EXISTS idx_recup_solic_situacao ON public.recuperacao_acesso_solicitacoes(situacao);
CREATE INDEX IF NOT EXISTS idx_recup_solic_solicitada_em ON public.recuperacao_acesso_solicitacoes(solicitada_em DESC);

ALTER TABLE public.recuperacao_acesso_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recuperacao_solicitacoes_admin_policy" ON public.recuperacao_acesso_solicitacoes;
CREATE POLICY "recuperacao_solicitacoes_admin_policy" ON public.recuperacao_acesso_solicitacoes
  FOR ALL USING (
    public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role])
  )
  WITH CHECK (
    public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role])
  );

-- 3. RPC pública para obter contato do responsável
CREATE OR REPLACE FUNCTION public.obter_contato_recuperacao_acesso()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resp record;
BEGIN
  SELECT nome_responsavel, email_contato, ativo
  INTO v_resp
  FROM public.recuperacao_acesso_config
  WHERE ativo = true
  ORDER BY atualizado_em DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'configurado', false,
      'nome', null,
      'email', null
    );
  END IF;

  RETURN jsonb_build_object(
    'configurado', true,
    'nome', v_resp.nome_responsavel,
    'email', v_resp.email_contato
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_contato_recuperacao_acesso() TO anon, authenticated;

-- 4. RPC para salvar a configuração do responsável (somente Administradores)
CREATE OR REPLACE FUNCTION public.salvar_config_responsavel_recuperacao(
  p_nome text,
  p_email text,
  p_ativo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_profile_id uuid;
  v_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    BEGIN
      v_caller_id := current_setting('request.jwt.claim.sub', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_id := NULL;
    END;
  END IF;

  SELECT p.id, EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.profile_id = p.id
      AND ur.role IN ('admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role)
      AND ur.ativo = true
  ) INTO v_profile_id, v_is_admin
  FROM public.profiles p
  WHERE p.user_id = v_caller_id OR p.id = v_caller_id
  LIMIT 1;

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem configurar o responsável.' USING ERRCODE = 'P0001';
  END IF;

  IF length(trim(coalesce(p_nome, ''))) < 2 THEN
    RAISE EXCEPTION 'Nome do responsável inválido.' USING ERRCODE = 'P0002';
  END IF;

  IF length(trim(coalesce(p_email, ''))) < 5 OR p_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'E-mail do responsável inválido.' USING ERRCODE = 'P0003';
  END IF;

  SELECT id INTO v_id FROM public.recuperacao_acesso_config LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.recuperacao_acesso_config
    SET nome_responsavel = trim(p_nome),
        email_contato = lower(trim(p_email)),
        ativo = COALESCE(p_ativo, true),
        atualizado_em = now(),
        atualizado_por = v_profile_id
    WHERE id = v_id;
  ELSE
    INSERT INTO public.recuperacao_acesso_config (nome_responsavel, email_contato, ativo, atualizado_por)
    VALUES (trim(p_nome), lower(trim(p_email)), COALESCE(p_ativo, true), v_profile_id)
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', v_id,
    'nome', trim(p_nome),
    'email', lower(trim(p_email))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_config_responsavel_recuperacao(text, text, boolean) TO authenticated;

-- 5. RPC para registrar solicitação de recuperação de acesso (pública / anon)
CREATE OR REPLACE FUNCTION public.solicitar_recuperacao_acesso(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_norm_email text;
  v_profile record;
  v_roles_arr text[];
  v_perfil_str text;
  v_unidades_json jsonb := '[]'::jsonb;
  v_resp_config record;
  v_solic_existente record;
  v_tentativas_15m integer;
  v_nova_solic_id uuid;
  v_is_preceptor_only boolean := false;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('sucesso', false, 'motivo', 'email_obrigatorio', 'mensagem', 'Informe seu e-mail.');
  END IF;

  v_norm_email := lower(trim(p_email));

  IF v_norm_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('sucesso', false, 'motivo', 'email_invalido', 'mensagem', 'Formato de e-mail inválido.');
  END IF;

  -- Verificar se existe conta ativa em profiles
  SELECT p.id, p.user_id, p.nome_completo, p.ativo, p.papel
  INTO v_profile
  FROM public.profiles p
  WHERE lower(p.email) = v_norm_email AND p.ativo = true
  LIMIT 1;

  -- Se não existir em profiles, verificar se é preceptor sem usuário
  IF NOT FOUND THEN
    SELECT EXISTS (
      SELECT 1 FROM public.preceptores pr WHERE lower(pr.email) = v_norm_email
    ) INTO v_is_preceptor_only;

    IF v_is_preceptor_only THEN
      RETURN jsonb_build_object(
        'sucesso', false,
        'motivo', 'preceptor_sem_login',
        'mensagem', 'Preceptores não possuem acesso com login e senha. Utilize o seu link individual de presença ou consulte a coordenação.'
      );
    END IF;

    RETURN jsonb_build_object(
      'sucesso', false,
      'motivo', 'conta_nao_encontrada',
      'mensagem', 'E-mail não encontrado entre os usuários ativos do sistema.'
    );
  END IF;

  -- Validar rate limits:
  -- 1) Intervalo mínimo de 60 segundos entre tentativas pelo mesmo e-mail
  IF EXISTS (
    SELECT 1 FROM public.recuperacao_acesso_solicitacoes
    WHERE email = v_norm_email
      AND ultima_tentativa_em > (now() - interval '60 seconds')
  ) THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'motivo', 'rate_limit_60s',
      'mensagem', 'Aguarde 60 segundos antes de realizar uma nova tentativa.'
    );
  END IF;

  -- 2) Máximo de 3 tentativas em 15 minutos pelo mesmo e-mail
  SELECT COALESCE(SUM(tentativas), 0) INTO v_tentativas_15m
  FROM public.recuperacao_acesso_solicitacoes
  WHERE email = v_norm_email
    AND ultima_tentativa_em > (now() - interval '15 minutes');

  IF v_tentativas_15m >= 3 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'motivo', 'rate_limit_15m',
      'mensagem', 'Limite de 3 tentativas em 15 minutos atingido para este e-mail. Tente novamente mais tarde.'
    );
  END IF;

  -- Obter dados do responsável configurado no momento
  SELECT nome_responsavel, email_contato, ativo
  INTO v_resp_config
  FROM public.recuperacao_acesso_config
  WHERE ativo = true
  ORDER BY atualizado_em DESC
  LIMIT 1;

  -- Se já existir solicitação pendente para o mesmo usuário/email, atualizar
  SELECT id, tentativas
  INTO v_solic_existente
  FROM public.recuperacao_acesso_solicitacoes
  WHERE profile_id = v_profile.id AND situacao = 'pendente'
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.recuperacao_acesso_solicitacoes
    SET tentativas = v_solic_existente.tentativas + 1,
        ultima_tentativa_em = now(),
        responsavel_snapshot = CASE 
          WHEN v_resp_config.nome_responsavel IS NOT NULL 
          THEN jsonb_build_object('nome', v_resp_config.nome_responsavel, 'email', v_resp_config.email_contato)
          ELSE responsavel_snapshot 
        END,
        updated_at = now()
    WHERE id = v_solic_existente.id;
  ELSE
    -- Buscar perfil(is)
    SELECT array_agg(ur.role::text) INTO v_roles_arr
    FROM public.user_roles ur
    WHERE ur.profile_id = v_profile.id AND ur.ativo = true;

    IF v_roles_arr IS NULL OR array_length(v_roles_arr, 1) = 0 THEN
      v_perfil_str := COALESCE(v_profile.papel, 'Usuário');
    ELSE
      v_perfil_str := array_to_string(v_roles_arr, ', ');
    END IF;

    -- Buscar unidades associadas (ex: via vinculo_coordenadores)
    SELECT COALESCE(
      jsonb_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL),
      '[]'::jsonb
    ) INTO v_unidades_json
    FROM public.vinculo_coordenadores vc
    JOIN public.vinculos_internato vi ON vi.id = vc.vinculo_internato_id
    JOIN public.unidades u ON u.id = vi.unidade_id
    WHERE vc.profile_id = v_profile.id AND vc.status = 'ativo';

    IF v_unidades_json IS NULL OR jsonb_array_length(v_unidades_json) = 0 THEN
      -- Se for admin, todas as unidades
      IF 'admin' = ANY(v_roles_arr) OR 'administrador' = ANY(v_roles_arr) THEN
        v_unidades_json := '["Todas as unidades"]'::jsonb;
      ELSE
        v_unidades_json := '[]'::jsonb;
      END IF;
    END IF;

    -- Inserir nova solicitação
    INSERT INTO public.recuperacao_acesso_solicitacoes (
      user_id, profile_id, email, perfil, unidades, situacao, tentativas,
      responsavel_snapshot, solicitada_em, ultima_tentativa_em
    ) VALUES (
      v_profile.user_id,
      v_profile.id,
      v_norm_email,
      v_perfil_str,
      v_unidades_json,
      'pendente',
      1,
      CASE 
        WHEN v_resp_config.nome_responsavel IS NOT NULL 
        THEN jsonb_build_object('nome', v_resp_config.nome_responsavel, 'email', v_resp_config.email_contato)
        ELSE NULL 
      END,
      now(),
      now()
    ) RETURNING id INTO v_nova_solic_id;
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Solicitação de recuperação registrada',
    'responsavel_configurado', (v_resp_config.nome_responsavel IS NOT NULL),
    'responsavel_nome', v_resp_config.nome_responsavel,
    'responsavel_email', v_resp_config.email_contato
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_recuperacao_acesso(text) TO anon, authenticated;

-- 6. RPC para listar as solicitações de recuperação (somente Administradores)
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
  resolvida_por_nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    rp.nome_completo AS resolvida_por_nome
  FROM public.recuperacao_acesso_solicitacoes s
  LEFT JOIN public.profiles p ON p.id = s.profile_id
  LEFT JOIN public.profiles rp ON rp.id = s.resolvida_por
  ORDER BY 
    CASE WHEN s.situacao = 'pendente' THEN 0 ELSE 1 END,
    s.ultima_tentativa_em DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_solicitacoes_recuperacao_acesso() TO authenticated;
