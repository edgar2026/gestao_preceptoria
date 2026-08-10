-- ============================================================================
-- MIGRACAO 003: CORRECAO DE INTEGRIDADE E CONSISTENCIA
--
-- Objetivo:
-- 1. Corrigir UNIQUE constraint em presencas para usar escala_id (nao local+tipo)
-- 2. Recriar registrar_presenca com verificacao de duplicidade e retorno jsonb
-- 3. Adicionar unicidade em vinculo_locais
-- 4. Garantir que todas as tabelas, funcoes e politicas estejam completas
--
-- Seguranca:
-- - Nenhum DROP TABLE, TRUNCATE ou DELETE de dados existentes
-- - Todas as operacoes usam IF NOT EXISTS / IF EXISTS / CREATE OR REPLACE
-- - Mantem todas as estruturas e dados existentes
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. CORRIGIR UNIQUE CONSTRAINT EM PRESENCAS
--    Remove a constraint antiga e cria indice unico correto por escala.
-- --------------------------------------------------------------------------
DO $$
BEGIN
  -- Remover constraint antiga se existir (preceptor+data+turno+local+tipo)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'presencas_preceptor_id_data_presenca_turno_local_id_tipo_atuacao_key'
  ) THEN
    ALTER TABLE public.presencas
      DROP CONSTRAINT presencas_preceptor_id_data_presenca_turno_local_id_tipo_atuacao_key;
  END IF;
END $$;

-- Criar indice unico correto: preceptor + escala + data + turno
CREATE UNIQUE INDEX IF NOT EXISTS idx_presencas_unica
  ON public.presencas(preceptor_id, escala_id, data_presenca, turno);

-- --------------------------------------------------------------------------
-- 2. RECRIAR REGISTRAR_PRESENCA COM VERIFICACAO E JSONB
--    Necessario DROP porque o tipo de retorno muda de uuid para jsonb.
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_presenca(uuid, public.turno);

CREATE OR REPLACE FUNCTION public.registrar_presenca(
  p_escala_id uuid,
  p_turno public.turno
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_profile public.profiles;
  v_preceptor public.preceptores;
  v_escala public.escalas;
  v_local public.vinculo_locais;
  v_id uuid;
BEGIN
  -- Perfil ativo
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid() AND ativo = true;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario sem perfil ativo.');
  END IF;

  -- Preceptor ativo vinculado ao perfil
  SELECT * INTO v_preceptor FROM public.preceptores WHERE profile_id = v_profile.id AND status = 'ativo';
  IF v_preceptor.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario nao esta vinculado a um preceptor ativo.');
  END IF;

  -- Escala ativa
  SELECT * INTO v_escala FROM public.escalas WHERE id = p_escala_id AND status = 'ativo';
  IF v_escala.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala invalida ou inativa.');
  END IF;

  -- Turno corresponde
  IF v_escala.turno <> p_turno THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Turno diferente da escala.');
  END IF;

  -- Dia da semana
  IF extract(dow from current_date)::smallint <> v_escala.dia_semana THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
  END IF;

  -- Vigencia
  IF current_date NOT BETWEEN v_escala.data_inicio AND v_escala.data_fim THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  END IF;

  -- Pertence ao preceptor?
  IF v_escala.tipo_atuacao = 'adm' AND NOT EXISTS(
    SELECT 1 FROM public.vinculos_adm v WHERE v.id = v_escala.vinculo_adm_id AND v.preceptor_id = v_preceptor.id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  IF v_escala.tipo_atuacao = 'internato' AND NOT EXISTS(
    SELECT 1 FROM public.vinculos_internato v WHERE v.id = v_escala.vinculo_internato_id AND v.preceptor_id = v_preceptor.id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  -- Duplicidade: mesmo vinculo (escala) + data + turno
  IF EXISTS(
    SELECT 1 FROM public.presencas
    WHERE preceptor_id = v_preceptor.id
      AND escala_id = p_escala_id
      AND data_presenca = current_date
      AND turno = p_turno
      AND status IN ('confirmada','ajustada')
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno hoje.');
  END IF;

  -- Local da escala
  SELECT * INTO v_local FROM public.vinculo_locais WHERE id = v_escala.vinculo_local_id;

  -- Inserir presenca
  INSERT INTO public.presencas(
    preceptor_id, escala_id, tipo_atuacao,
    vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id,
    data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao,
    v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, v_local.setor_id,
    current_date, p_turno, 'confirmada', 'preceptor', v_profile.id
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$$;

-- Atualizar grants
REVOKE ALL ON FUNCTION public.registrar_presenca(uuid, public.turno) FROM public;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(uuid, public.turno) TO authenticated;

-- --------------------------------------------------------------------------
-- 3. UNICIDADE EM VINCULO_LOCAIS
--    Impede que o mesmo vinculo+local+setor seja cadastrado duas vezes.
-- --------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_locais_unica
  ON public.vinculo_locais(
    tipo_atuacao,
    COALESCE(vinculo_adm_id::text, '00000000-0000-0000-0000-000000000000'),
    COALESCE(vinculo_internato_id::text, '00000000-0000-0000-0000-000000000000'),
    local_id,
    COALESCE(setor_id::text, '00000000-0000-0000-0000-000000000000')
  );

-- --------------------------------------------------------------------------
-- 4. GARANTIR QUE TODAS AS FUNCOES EXISTEM (CREATE OR REPLACE)
--    Recria funcoes do 001 e 002 que podem ter assinatura antiga.
-- --------------------------------------------------------------------------

-- Funcao utilitaria updated_at (ja existe, refresca)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- current_profile_id (ja existe)
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.ativo = true LIMIT 1;
$$;

-- has_role (ja existe)
CREATE OR REPLACE FUNCTION public.has_role(roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid() AND p.ativo = true AND ur.ativo = true AND ur.role = any(roles)
  );
$$;

-- Funcoes do 002 (acesso por token)
CREATE OR REPLACE FUNCTION public.gerar_acesso_presenca(p_preceptor_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw text;
  v_hash text;
  v_profile_id uuid;
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN
    raise exception 'Acesso negado';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.preceptores WHERE id=p_preceptor_id AND status='ativo') THEN
    raise exception 'Preceptor nao encontrado ou inativo';
  END IF;

  UPDATE public.preceptor_acesso_presenca
  SET revogado=true, revogado_em=now(), ativo=false
  WHERE preceptor_id=p_preceptor_id AND ativo=true AND NOT revogado;

  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_raw::bytea), 'hex');
  v_profile_id := public.current_profile_id();

  INSERT INTO public.preceptor_acesso_presenca(preceptor_id, token_hash, created_by)
  VALUES(p_preceptor_id, v_hash, v_profile_id);

  RETURN v_raw;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_acesso_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE token_hash = v_hash;

  IF v_acesso.id IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Link invalido ou inexistente.');
  END IF;

  IF v_acesso.revogado THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Este acesso foi revogado. Solicite um novo link ao administrador.');
  END IF;

  IF v_acesso.bloqueado THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Este acesso foi bloqueado pelo administrador.');
  END IF;

  IF NOT v_acesso.ativo THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Este acesso esta inativo.');
  END IF;

  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Este acesso expirou. Solicite um novo link ao administrador.');
  END IF;

  SELECT * INTO v_preceptor
  FROM public.preceptores
  WHERE id = v_acesso.preceptor_id AND status='ativo';

  IF v_preceptor.id IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Preceptor nao encontrado ou inativo.');
  END IF;

  UPDATE public.preceptor_acesso_presenca
  SET ultimo_acesso_em = now()
  WHERE id = v_acesso.id;

  RETURN jsonb_build_object(
    'valido', true,
    'preceptor_id', v_preceptor.id,
    'nome', v_preceptor.nome_completo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buscar_escalas_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_rec record;
  v_dow smallint;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE token_hash = v_hash AND ativo=true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN
    RETURN v_result;
  END IF;

  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN
    RETURN v_result;
  END IF;

  v_dow := extract(dow from current_date)::smallint;

  FOR v_rec IN
    SELECT
      e.id as escala_id,
      e.tipo_atuacao,
      e.turno,
      e.hora_inicio,
      e.hora_fim,
      CASE WHEN e.tipo_atuacao='adm' THEN d.nome ELSE i.nome END as atividade_nome,
      l.nome as local_nome,
      coalesce(s.nome, '-') as setor_nome,
      CASE WHEN e.tipo_atuacao='adm' THEN e.vinculo_adm_id ELSE e.vinculo_internato_id END as vinculo_id,
      vl.local_id,
      vl.setor_id
    FROM public.escalas e
    LEFT JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
    LEFT JOIN public.locais l ON l.id = vl.local_id
    LEFT JOIN public.setores s ON s.id = vl.setor_id
    LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
    LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
    LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
    LEFT JOIN public.internatos i ON i.id = vi.internato_id
    WHERE e.status = 'ativo'
      AND e.dia_semana = v_dow
      AND current_date BETWEEN e.data_inicio AND e.data_fim
      AND (
        (e.tipo_atuacao='adm' AND va.preceptor_id = v_acesso.preceptor_id)
        OR
        (e.tipo_atuacao='internato' AND vi.preceptor_id = v_acesso.preceptor_id)
      )
  LOOP
    v_row := jsonb_build_object(
      'escala_id', v_rec.escala_id,
      'tipo_atuacao', v_rec.tipo_atuacao,
      'turno', v_rec.turno,
      'atividade', v_rec.atividade_nome,
      'local', v_rec.local_nome,
      'setor', v_rec.setor_nome,
      'local_id', v_rec.local_id,
      'hora_inicio', to_char(v_rec.hora_inicio, 'HH24:MI'),
      'hora_fim', to_char(v_rec.hora_fim, 'HH24:MI'),
      'ja_registrada', EXISTS(
        SELECT 1 FROM public.presencas p
        WHERE p.escala_id = v_rec.escala_id
          AND p.turno = v_rec.turno
          AND p.data_presenca = current_date
          AND p.status IN ('confirmada','ajustada')
      )
    );
    v_result := v_result || v_row;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_presenca_token(
  p_token text,
  p_escala_id uuid,
  p_turno public.turno
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
  v_escala public.escalas%rowtype;
  v_local public.vinculo_locais%rowtype;
  v_id uuid;
  v_registrado_por uuid;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE token_hash = v_hash AND ativo=true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso invalido.');
  END IF;

  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso expirado.');
  END IF;

  SELECT * INTO v_preceptor
  FROM public.preceptores
  WHERE id = v_acesso.preceptor_id AND status='ativo';

  IF v_preceptor.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Preceptor inativo.');
  END IF;

  SELECT * INTO v_escala
  FROM public.escalas
  WHERE id = p_escala_id AND status='ativo';

  IF v_escala.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala invalida.');
  END IF;

  IF v_escala.turno <> p_turno THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Turno nao corresponde a escala.');
  END IF;

  IF extract(dow from current_date)::smallint <> v_escala.dia_semana THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
  END IF;

  IF current_date NOT BETWEEN v_escala.data_inicio AND v_escala.data_fim THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  END IF;

  IF v_escala.tipo_atuacao='adm' AND NOT EXISTS(
    SELECT 1 FROM public.vinculos_adm v
    WHERE v.id=v_escala.vinculo_adm_id AND v.preceptor_id=v_preceptor.id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  IF v_escala.tipo_atuacao='internato' AND NOT EXISTS(
    SELECT 1 FROM public.vinculos_internato v
    WHERE v.id=v_escala.vinculo_internato_id AND v.preceptor_id=v_preceptor.id
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  -- Verificar duplicidade (mesma escala + turno + data)
  IF EXISTS(
    SELECT 1 FROM public.presencas
    WHERE preceptor_id=v_preceptor.id
      AND data_presenca=current_date
      AND turno=p_turno
      AND escala_id=p_escala_id
      AND status IN ('confirmada','ajustada')
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno hoje.');
  END IF;

  SELECT * INTO v_local FROM public.vinculo_locais WHERE id=v_escala.vinculo_local_id;

  v_registrado_por := v_acesso.created_by;
  IF v_registrado_por IS NULL THEN
    SELECT p.id INTO v_registrado_por
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.profile_id=p.id
    WHERE ur.role='administrador' AND p.ativo=true
    LIMIT 1;
  END IF;

  INSERT INTO public.presencas(
    preceptor_id, escala_id, tipo_atuacao,
    vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id,
    data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao,
    v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, v_local.setor_id,
    current_date, p_turno, 'confirmada', 'preceptor',
    v_registrado_por
  )
  RETURNING id INTO v_id;

  UPDATE public.preceptor_acesso_presenca
  SET ultimo_acesso_em = now()
  WHERE id = v_acesso.id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.bloquear_acesso_preceptor(p_preceptor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN
    raise exception 'Acesso negado';
  END IF;

  UPDATE public.preceptor_acesso_presenca
  SET bloqueado=true, bloqueado_em=now(), ativo=false
  WHERE preceptor_id=p_preceptor_id AND ativo=true AND NOT revogado;
END;
$$;

CREATE OR REPLACE FUNCTION public.revogar_acesso_preceptor(p_preceptor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN
    raise exception 'Acesso negado';
  END IF;

  UPDATE public.preceptor_acesso_presenca
  SET revogado=true, revogado_em=now(), ativo=false
  WHERE preceptor_id=p_preceptor_id AND ativo=true;
END;
$$;

CREATE OR REPLACE FUNCTION public.renovar_acesso_preceptor(p_preceptor_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw text;
  v_hash text;
  v_profile_id uuid;
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN
    raise exception 'Acesso negado';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.preceptores WHERE id=p_preceptor_id AND status='ativo') THEN
    raise exception 'Preceptor nao encontrado ou inativo';
  END IF;

  UPDATE public.preceptor_acesso_presenca
  SET revogado=true, revogado_em=now(), ativo=false
  WHERE preceptor_id=p_preceptor_id AND ativo=true AND NOT revogado;

  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_raw::bytea), 'hex');
  v_profile_id := public.current_profile_id();

  INSERT INTO public.preceptor_acesso_presenca(preceptor_id, token_hash, created_by)
  VALUES(p_preceptor_id, v_hash, v_profile_id);

  RETURN v_raw;
END;
$$;

CREATE OR REPLACE FUNCTION public.consultar_acesso_preceptor(p_preceptor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acesso public.preceptor_acesso_presenca%rowtype;
BEGIN
  IF NOT public.has_role(array['administrador','academico','coordenador']::public.app_role[]) THEN
    raise exception 'Acesso negado';
  END IF;

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE preceptor_id=p_preceptor_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_acesso.id IS NULL THEN
    RETURN jsonb_build_object('existe', false);
  END IF;

  RETURN jsonb_build_object(
    'existe', true,
    'id', v_acesso.id,
    'ativo', v_acesso.ativo,
    'bloqueado', v_acesso.bloqueado,
    'revogado', v_acesso.revogado,
    'created_at', v_acesso.created_at,
    'expira_em', v_acesso.expira_em,
    'ultimo_acesso_em', v_acesso.ultimo_acesso_em,
    'bloqueado_em', v_acesso.bloqueado_em,
    'revogado_em', v_acesso.revogado_em
  );
END;
$$;

-- --------------------------------------------------------------------------
-- 5. RECRIAR RECALCULAR_COMPETENCIA
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_competencia(p_competencia_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comp public.competencias;
  v_preceptor record;
  v_calculo_id uuid;
  v_count integer := 0;
BEGIN
  IF NOT public.has_role(array['administrador','financeiro']::public.app_role[]) THEN raise exception 'Acesso negado'; END IF;
  SELECT * INTO v_comp FROM public.competencias WHERE id=p_competencia_id FOR UPDATE;
  IF v_comp.id IS NULL THEN raise exception 'Competencia nao encontrada'; END IF;
  IF v_comp.status NOT IN ('aberta','reaberta','em_conferencia') THEN raise exception 'Competencia nao permite recalculo'; END IF;

  FOR v_preceptor IN
    SELECT DISTINCT p.preceptor_id
    FROM public.presencas p
    WHERE p.data_presenca BETWEEN v_comp.data_inicio AND v_comp.data_fim AND p.status IN ('confirmada','ajustada')
    UNION
    SELECT DISTINCT rp.preceptor_id
    FROM public.regra_preceptores rp JOIN public.regras_financeiras r ON r.id=rp.regra_id
    WHERE r.exige_presenca=false AND r.status='ativo' AND r.data_inicio<=v_comp.data_fim AND coalesce(r.data_fim,v_comp.data_fim)>=v_comp.data_inicio
  LOOP
    INSERT INTO public.calculos(competencia_id,preceptor_id,status,calculado_em,calculado_por)
    VALUES(v_comp.id,v_preceptor.preceptor_id,'calculado',now(),public.current_profile_id())
    ON CONFLICT(competencia_id,preceptor_id,versao) DO UPDATE SET status='calculado',calculado_em=now(),calculado_por=public.current_profile_id(),updated_at=now()
    RETURNING id INTO v_calculo_id;

    DELETE FROM public.calculo_itens WHERE calculo_id=v_calculo_id;

    INSERT INTO public.calculo_itens(calculo_id,tipo,regra_id,presenca_id,descricao,quantidade,valor_unitario,referencia)
    SELECT v_calculo_id,'presenca',r.id,p.id,r.nome,1,r.valor,jsonb_build_object('data',p.data_presenca,'turno',p.turno,'local_id',p.local_id)
    FROM public.presencas p
    JOIN LATERAL (
      SELECT rf.* FROM public.regras_financeiras rf
      LEFT JOIN public.regra_preceptores rp ON rp.regra_id=rf.id
      WHERE rf.status='ativo' AND rf.exige_presenca=true
        AND p.data_presenca BETWEEN rf.data_inicio AND coalesce(rf.data_fim,p.data_presenca)
        AND (rf.tipo_atuacao IS NULL OR rf.tipo_atuacao=p.tipo_atuacao)
        AND (rf.local_id IS NULL OR rf.local_id=p.local_id)
        AND (rf.setor_id IS NULL OR rf.setor_id=p.setor_id)
        AND (rp.preceptor_id IS NULL OR rp.preceptor_id=p.preceptor_id)
        AND rf.forma_calculo IN ('por_turno','por_hora','por_grupo')
      ORDER BY rf.prioridade ASC, rf.created_at DESC LIMIT 1
    ) r ON TRUE
    WHERE p.preceptor_id=v_preceptor.preceptor_id AND p.data_presenca BETWEEN v_comp.data_inicio AND v_comp.data_fim AND p.status IN ('confirmada','ajustada');

    INSERT INTO public.calculo_itens(calculo_id,tipo,regra_id,descricao,quantidade,valor_unitario,referencia)
    SELECT v_calculo_id,
      CASE r.forma_calculo WHEN 'mensal_fixo' THEN 'fixo'::public.tipo_item_calculo WHEN 'rateio' THEN 'rateio'::public.tipo_item_calculo WHEN 'adicional' THEN 'adicional'::public.tipo_item_calculo WHEN 'desconto' THEN 'desconto'::public.tipo_item_calculo ELSE 'ajuste'::public.tipo_item_calculo END,
      r.id,r.nome,r.quantidade_base,r.valor,jsonb_build_object('forma_calculo',r.forma_calculo)
    FROM public.regras_financeiras r
    JOIN public.regra_preceptores rp ON rp.regra_id=r.id AND rp.preceptor_id=v_preceptor.preceptor_id
    WHERE r.status='ativo' AND r.exige_presenca=false AND r.data_inicio<=v_comp.data_fim AND coalesce(r.data_fim,v_comp.data_fim)>=v_comp.data_inicio;

    UPDATE public.calculos c SET
      total_bruto=coalesce((SELECT sum(i.valor_total) FROM public.calculo_itens i WHERE i.calculo_id=c.id AND i.tipo NOT IN ('desconto','estorno')),0),
      total_descontos=abs(coalesce((SELECT sum(i.valor_total) FROM public.calculo_itens i WHERE i.calculo_id=c.id AND i.tipo IN ('desconto','estorno')),0)),
      updated_at=now()
    WHERE c.id=v_calculo_id;
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- --------------------------------------------------------------------------
-- 6. GARANTIR RLS EM TABELAS QUE POSSAM TER SIDO CRIADAS SEM
-- --------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','user_roles','preceptores','preceptor_documentos','ies','cursos','semestres','periodos','disciplinas','internatos','locais','setores','feriados','favorecidos','preceptor_favorecidos','vinculos_adm','vinculos_internato','vinculo_locais','escalas','presencas','ajustes_presenca','regras_financeiras','regra_preceptores','rateios_financeiros','competencias','calculos','calculo_itens','aprovacoes','saldos_autorizados','saldo_movimentos','processos_pagamento','processo_calculos','pagamentos','notificacoes','configuracoes','audit_logs','preceptor_acesso_presenca'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 7. GARANTIR GRANTS
-- --------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(uuid, public.turno) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_competencia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_acesso_presenca(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bloquear_acesso_preceptor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revogar_acesso_preceptor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renovar_acesso_preceptor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_acesso_preceptor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_acesso_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.buscar_escalas_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_presenca_token(text, uuid, public.turno) TO anon;

-- Grant presencas for SECURITY DEFINER functions
GRANT SELECT, INSERT ON public.presencas TO anon;

-- --------------------------------------------------------------------------
-- 8. GARANTIR TRIGGERS
-- --------------------------------------------------------------------------

-- Updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','preceptores','ies','cursos','semestres','disciplinas','internatos','locais','setores','favorecidos','preceptor_favorecidos','vinculos_adm','vinculos_internato','escalas','presencas','regras_financeiras','competencias','calculos','saldos_autorizados','processos_pagamento','pagamentos','preceptor_acesso_presenca'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- Audit triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['preceptores','favorecidos','vinculos_adm','vinculos_internato','escalas','presencas','ajustes_presenca','regras_financeiras','competencias','calculos','calculo_itens','saldos_autorizados','saldo_movimentos','processos_pagamento','pagamentos','configuracoes','preceptor_acesso_presenca'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 9. GARANTIR INDICES ESSENCIAIS
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_preceptores_status ON public.preceptores(status);
CREATE INDEX IF NOT EXISTS idx_preceptores_profile ON public.preceptores(profile_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_adm_preceptor ON public.vinculos_adm(preceptor_id, semestre_id, status);
CREATE INDEX IF NOT EXISTS idx_vinculos_internato_preceptor ON public.vinculos_internato(preceptor_id, semestre_id, status);
CREATE INDEX IF NOT EXISTS idx_escalas_dia ON public.escalas(dia_semana, turno, status, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_presencas_data ON public.presencas(data_presenca, preceptor_id, status);
CREATE INDEX IF NOT EXISTS idx_regras_vigencia ON public.regras_financeiras(status, data_inicio, data_fim, prioridade);
CREATE INDEX IF NOT EXISTS idx_calculos_competencia ON public.calculos(competencia_id, status);
CREATE INDEX IF NOT EXISTS idx_calculo_itens_calculo ON public.calculo_itens(calculo_id, tipo);
CREATE INDEX IF NOT EXISTS idx_processos_competencia ON public.processos_pagamento(competencia_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos(status, data_pagamento);
CREATE INDEX IF NOT EXISTS idx_audit_tabela_registro ON public.audit_logs(tabela, registro_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_profile ON public.notificacoes(profile_id, lida_em, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acesso_preceptor ON public.preceptor_acesso_presenca(preceptor_id, ativo);
CREATE INDEX IF NOT EXISTS idx_acesso_hash ON public.preceptor_acesso_presenca(token_hash);

commit;
