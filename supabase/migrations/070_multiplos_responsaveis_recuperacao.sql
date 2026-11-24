-- ==============================================================================
-- Migração 070: Múltiplos Responsáveis Institucionais para Recuperação de Acesso
-- Permite cadastrar múltiplos contatos (nome do setor/responsável + e-mail)
-- para serem exibidos no modal de "Esqueci minha senha".
-- ==============================================================================

-- 1. Coluna de ordenação na tabela recuperacao_acesso_config
ALTER TABLE public.recuperacao_acesso_config
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

-- 2. RPC para obter todos os contatos ativos configurados
CREATE OR REPLACE FUNCTION public.obter_contato_recuperacao_acesso()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contatos jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nome', nome_responsavel,
      'email', email_contato,
      'ativo', ativo,
      'ordem', ordem
    ) ORDER BY ordem ASC, atualizado_em ASC
  )
  INTO v_contatos
  FROM public.recuperacao_acesso_config
  WHERE ativo = true;

  IF v_contatos IS NULL OR jsonb_array_length(v_contatos) = 0 THEN
    RETURN jsonb_build_object(
      'configurado', false,
      'nome', 'Administração do Sistema',
      'email', null,
      'contatos', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'configurado', true,
    'nome', v_contatos->0->>'nome',
    'email', v_contatos->0->>'email',
    'contatos', v_contatos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obter_contato_recuperacao_acesso() TO anon, authenticated;

-- 3. RPC para listar todos os contatos (inclusive inativos) para o Administrador
CREATE OR REPLACE FUNCTION public.listar_configs_responsaveis_recuperacao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contatos jsonb;
BEGIN
  IF NOT public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem gerenciar responsáveis.' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nome_responsavel', nome_responsavel,
      'email_responsavel', email_contato,
      'ativo', ativo,
      'ordem', ordem
    ) ORDER BY ordem ASC, atualizado_em ASC
  )
  INTO v_contatos
  FROM public.recuperacao_acesso_config;

  RETURN COALESCE(v_contatos, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_configs_responsaveis_recuperacao() TO authenticated;

-- 4. RPC para salvar múltiplos contatos de responsáveis institucionais
CREATE OR REPLACE FUNCTION public.salvar_configs_responsaveis_recuperacao(p_contatos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_item jsonb;
  v_ordem integer := 0;
  v_nome text;
  v_email text;
  v_ativo boolean;
  v_novos_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
BEGIN
  IF NOT public.has_role(ARRAY['admin'::public.app_role, 'administrador'::public.app_role, 'admin_super'::public.app_role, 'super_admin'::public.app_role]) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem configurar o responsável.' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF p_contatos IS NULL OR jsonb_array_length(p_contatos) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos um responsável institucional com nome e e-mail.' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_contatos)
  LOOP
    v_nome := trim(COALESCE(v_item->>'nome_responsavel', v_item->>'nome', ''));
    v_email := lower(trim(COALESCE(v_item->>'email_responsavel', v_item->>'email_contato', v_item->>'email', '')));
    v_ativo := COALESCE((v_item->>'ativo')::boolean, true);

    IF v_nome = '' OR v_email = '' THEN
      CONTINUE;
    END IF;

    IF v_item->>'id' IS NOT NULL AND (v_item->>'id')::text ~ '^[0-9a-fA-F-]{36}$' THEN
      v_id := (v_item->>'id')::uuid;
      UPDATE public.recuperacao_acesso_config
      SET nome_responsavel = v_nome,
          email_contato = v_email,
          ativo = v_ativo,
          ordem = v_ordem,
          atualizado_em = now(),
          atualizado_por = v_profile_id
      WHERE id = v_id;

      IF FOUND THEN
        v_novos_ids := array_append(v_novos_ids, v_id);
      ELSE
        INSERT INTO public.recuperacao_acesso_config (nome_responsavel, email_contato, ativo, ordem, atualizado_por)
        VALUES (v_nome, v_email, v_ativo, v_ordem, v_profile_id)
        RETURNING id INTO v_id;
        v_novos_ids := array_append(v_novos_ids, v_id);
      END IF;
    ELSE
      INSERT INTO public.recuperacao_acesso_config (nome_responsavel, email_contato, ativo, ordem, atualizado_por)
      VALUES (v_nome, v_email, v_ativo, v_ordem, v_profile_id)
      RETURNING id INTO v_id;
      v_novos_ids := array_append(v_novos_ids, v_id);
    END IF;

    v_ordem := v_ordem + 1;
  END LOOP;

  -- Remove os contatos que não vieram na lista salva
  IF array_length(v_novos_ids, 1) > 0 THEN
    DELETE FROM public.recuperacao_acesso_config
    WHERE NOT (id = ANY(v_novos_ids));
  END IF;

  INSERT INTO audit_logs (tabela, registro_id, operacao, dados_novos, profile_id)
  VALUES ('recuperacao_acesso_config', v_profile_id, 'CONFIGURAR_RESPONSAVEIS',
    jsonb_build_object('total_responsaveis', v_ordem, 'contatos', p_contatos), v_profile_id);

  RETURN jsonb_build_object(
    'sucesso', true,
    'total_salvos', v_ordem
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_configs_responsaveis_recuperacao(jsonb) TO authenticated;

-- 5. Atualizar solicitar_recuperacao_acesso para retornar a lista completa de responsáveis
CREATE OR REPLACE FUNCTION public.solicitar_recuperacao_acesso(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_email text;
  v_profile record;
  v_contatos_json jsonb;
  v_solic_existente record;
  v_ult_tentativa timestamptz;
  v_count_15m integer;
  v_unidades_json jsonb := '[]'::jsonb;
  v_roles_arr text[];
  v_perfil_str text;
BEGIN
  v_norm_email := lower(trim(p_email));
  IF v_norm_email IS NULL OR v_norm_email = '' THEN
    RAISE EXCEPTION 'E-mail é obrigatório.' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Validar se é preceptor sem usuário staff
  IF EXISTS (SELECT 1 FROM public.preceptores WHERE lower(trim(email)) = v_norm_email)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(trim(email)) = v_norm_email) THEN
    RAISE EXCEPTION 'Preceptores não possuem acesso ao painel de coordenação. O registro de presença é realizado pelo link de acesso individual.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Localizar profile e user_id
  SELECT id, user_id, nome_completo, ativo
  INTO v_profile
  FROM public.profiles
  WHERE lower(trim(email)) = v_norm_email
  LIMIT 1;

  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada para o e-mail informado. Verifique os dados digitados ou contate a administração.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_profile.ativo THEN
    RAISE EXCEPTION 'Esta conta de usuário está inativa ou bloqueada. Entre em contato diretamente com o responsável institucional.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Rate limiting: 60s mínimo e máx 3 tentativas a cada 15m
  SELECT ultima_tentativa_em
  INTO v_ult_tentativa
  FROM public.recuperacao_acesso_solicitacoes
  WHERE lower(trim(email)) = v_norm_email
  ORDER BY ultima_tentativa_em DESC
  LIMIT 1;

  IF v_ult_tentativa IS NOT NULL AND now() - v_ult_tentativa < interval '60 seconds' THEN
    RAISE EXCEPTION 'Aguarde 60 segundos antes de enviar nova solicitação.' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)
  INTO v_count_15m
  FROM public.recuperacao_acesso_solicitacoes
  WHERE lower(trim(email)) = v_norm_email
    AND ultima_tentativa_em >= now() - interval '15 minutes';

  IF v_count_15m >= 3 THEN
    RAISE EXCEPTION 'Limite de tentativas atingido. Aguarde alguns minutos ou entre em contato com o responsável.' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Obter contatos ativos de responsáveis
  SELECT jsonb_agg(
    jsonb_build_object(
      'nome', nome_responsavel,
      'email', email_contato
    ) ORDER BY ordem ASC, atualizado_em ASC
  )
  INTO v_contatos_json
  FROM public.recuperacao_acesso_config
  WHERE ativo = true;

  -- 5. Identificar perfil e unidades
  SELECT array_agg(ur.role::text)
  INTO v_roles_arr
  FROM public.user_roles ur
  WHERE ur.profile_id = v_profile.id AND ur.ativo = true;

  IF 'admin' = ANY(v_roles_arr) OR 'administrador' = ANY(v_roles_arr) THEN
    v_perfil_str := 'admin';
  ELSIF 'coordenador' = ANY(v_roles_arr) THEN
    v_perfil_str := 'coordenador';
  ELSE
    v_perfil_str := COALESCE(v_roles_arr[1], 'usuario');
  END IF;

  SELECT COALESCE(
    jsonb_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL),
    '[]'::jsonb
  ) INTO v_unidades_json
  FROM public.vinculo_coordenadores vc
  JOIN public.vinculos_internato vi ON vi.id = vc.vinculo_internato_id
  JOIN public.unidades u ON u.id = vi.unidade_id
  WHERE vc.profile_id = v_profile.id AND vc.status = 'ativo';

  IF v_unidades_json IS NULL OR jsonb_array_length(v_unidades_json) = 0 THEN
    IF 'admin' = ANY(v_roles_arr) OR 'administrador' = ANY(v_roles_arr) THEN
      v_unidades_json := '["Todas as unidades"]'::jsonb;
    ELSE
      v_unidades_json := '[]'::jsonb;
    END IF;
  END IF;

  -- 6. Registrar ou atualizar solicitação pendente
  SELECT id, tentativas
  INTO v_solic_existente
  FROM public.recuperacao_acesso_solicitacoes
  WHERE profile_id = v_profile.id AND situacao = 'pendente'
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.recuperacao_acesso_solicitacoes
    SET tentativas = v_solic_existente.tentativas + 1,
        ultima_tentativa_em = now(),
        responsavel_snapshot = COALESCE(v_contatos_json, '[]'::jsonb),
        updated_at = now()
    WHERE id = v_solic_existente.id;
  ELSE
    INSERT INTO public.recuperacao_acesso_solicitacoes (
      user_id,
      profile_id,
      email,
      perfil,
      unidades,
      situacao,
      tentativas,
      responsavel_snapshot,
      solicitada_em,
      ultima_tentativa_em
    ) VALUES (
      v_profile.user_id,
      v_profile.id,
      v_norm_email,
      v_perfil_str,
      v_unidades_json,
      'pendente',
      1,
      COALESCE(v_contatos_json, '[]'::jsonb),
      now(),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Solicitação de recuperação registrada',
    'responsavel_nome', COALESCE(v_contatos_json->0->>'nome', 'Administração do Sistema'),
    'responsavel_email', v_contatos_json->0->>'email',
    'responsavel_configurado', (v_contatos_json IS NOT NULL AND jsonb_array_length(v_contatos_json) > 0),
    'contatos', COALESCE(v_contatos_json, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_recuperacao_acesso(text) TO anon, authenticated;
