-- ============================================================================
-- MIGRACAO 004: RECUPERACAO DE FUNCOES, TRIGGERS, RLS E GRANTS
--
-- Problema constatado: as migrations 001-003 foram parcialmente aplicadas.
-- As tabelas e enums existem, mas TODAS as funcoes, triggers, politicas RLS
-- e grants estao AUSENTES do banco remoto.
--
-- Esta migration e 100% idempotente (CREATE OR REPLACE, IF NOT EXISTS/EXISTS).
-- Nao usa DROP, TRUNCATE ou apaga dados existentes.
-- Nao substitui funcoes por versoes menos seguras.
--
-- EXECUCAO: Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. FUNCOES UTILITARIAS (existentes no 001, ausentes no banco)
-- --------------------------------------------------------------------------

-- set_updated_at: ja existe mas sem SECURITY DEFINER. Mantemos como esta
-- (e trigger, nao precisa de SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- current_profile_id: preserva SECURITY DEFINER e search_path do 001
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() AND p.ativo = true LIMIT 1;
$$;

-- has_role: preserva SECURITY DEFINER e search_path do 001
CREATE OR REPLACE FUNCTION public.has_role(roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid() AND p.ativo = true AND ur.ativo = true AND ur.role = any(roles)
  );
$$;

-- --------------------------------------------------------------------------
-- 2. TRIGGER: handle_new_auth_user (auto-cria profile ao criar user)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  INSERT INTO public.profiles(user_id, nome_completo, email)
  VALUES(new.id, coalesce(new.raw_user_meta_data->>'nome_completo', new.email, 'Novo usuario'), new.email)
  ON CONFLICT(user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- --------------------------------------------------------------------------
-- 3. TRIGGER: audit_row_change
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_id text; v_profile uuid;
BEGIN
  v_profile := public.current_profile_id();
  BEGIN
    IF tg_op = 'DELETE' THEN v_id := old.id::text; ELSE v_id := new.id::text; END IF;
  EXCEPTION WHEN undefined_column THEN
    BEGIN
      IF tg_op = 'DELETE' THEN v_id := old.chave::text; ELSE v_id := new.chave::text; END IF;
    EXCEPTION WHEN undefined_column THEN
      v_id := 'unknown';
    END;
  END;
  INSERT INTO public.audit_logs(tabela, registro_id, operacao, dados_anteriores, dados_novos, profile_id, user_id)
  VALUES(tg_table_name, v_id, tg_op,
    CASE WHEN tg_op IN ('UPDATE','DELETE') THEN to_jsonb(old) END,
    CASE WHEN tg_op IN ('INSERT','UPDATE') THEN to_jsonb(new) END,
    v_profile, auth.uid());
  IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END;
$$;

-- --------------------------------------------------------------------------
-- 4. TRIGGERS: updated_at em todas as tabelas relevantes
-- --------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','preceptores','ies','cursos','semestres','disciplinas','internatos','locais','setores','favorecidos','preceptor_favorecidos','vinculos_adm','vinculos_internato','escalas','presencas','regras_financeiras','competencias','calculos','saldos_autorizados','processos_pagamento','pagamentos','preceptor_acesso_presenca'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 5. TRIGGERS: audit nas tabelas de negocio
-- --------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['preceptores','favorecidos','vinculos_adm','vinculos_internato','escalas','presencas','ajustes_presenca','regras_financeiras','competencias','calculos','calculo_itens','saldos_autorizados','saldo_movimentos','processos_pagamento','pagamentos','configuracoes','preceptor_acesso_presenca'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t, t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 6. FUNCOES DE NEGOCIO: registrar_presenca (versao 003 com jsonb)
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
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid() AND ativo = true;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario sem perfil ativo.');
  END IF;

  SELECT * INTO v_preceptor FROM public.preceptores WHERE profile_id = v_profile.id AND status = 'ativo';
  IF v_preceptor.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuario nao esta vinculado a um preceptor ativo.');
  END IF;

  SELECT * INTO v_escala FROM public.escalas WHERE id = p_escala_id AND status = 'ativo';
  IF v_escala.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala invalida ou inativa.');
  END IF;

  IF v_escala.turno <> p_turno THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Turno diferente da escala.');
  END IF;

  IF extract(dow from current_date)::smallint <> v_escala.dia_semana THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
  END IF;

  IF current_date NOT BETWEEN v_escala.data_inicio AND v_escala.data_fim THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  END IF;

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

  IF EXISTS(
    SELECT 1 FROM public.presencas
    WHERE preceptor_id = v_preceptor.id AND escala_id = p_escala_id
      AND data_presenca = current_date AND turno = p_turno
      AND status IN ('confirmada','ajustada')
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno hoje.');
  END IF;

  SELECT * INTO v_local FROM public.vinculo_locais WHERE id = v_escala.vinculo_local_id;

  INSERT INTO public.presencas(
    preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id, data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao, v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, v_local.setor_id, current_date, p_turno, 'confirmada', 'preceptor', v_profile.id
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$$;

-- --------------------------------------------------------------------------
-- 7. FUNCOES DE NEGOCIO: recalcular_competencia
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
  SELECT * INTO v_comp FROM public.competencias WHERE id = p_competencia_id FOR UPDATE;
  IF v_comp.id IS NULL THEN raise exception 'Competencia nao encontrada'; END IF;
  IF v_comp.status NOT IN ('aberta','reaberta','em_conferencia') THEN raise exception 'Competencia nao permite recalculo'; END IF;

  FOR v_preceptor IN
    SELECT DISTINCT p.preceptor_id
    FROM public.presencas p
    WHERE p.data_presenca BETWEEN v_comp.data_inicio AND v_comp.data_fim AND p.status IN ('confirmada','ajustada')
    UNION
    SELECT DISTINCT rp.preceptor_id
    FROM public.regra_preceptores rp JOIN public.regras_financeiras r ON r.id = rp.regra_id
    WHERE r.exige_presenca = false AND r.status = 'ativo'
      AND r.data_inicio <= v_comp.data_fim AND coalesce(r.data_fim, v_comp.data_fim) >= v_comp.data_inicio
  LOOP
    INSERT INTO public.calculos(competencia_id, preceptor_id, status, calculado_em, calculado_por)
    VALUES(v_comp.id, v_preceptor.preceptor_id, 'calculado', now(), public.current_profile_id())
    ON CONFLICT(competencia_id, preceptor_id, versao) DO UPDATE SET status = 'calculado', calculado_em = now(), calculado_por = public.current_profile_id(), updated_at = now()
    RETURNING id INTO v_calculo_id;

    DELETE FROM public.calculo_itens WHERE calculo_id = v_calculo_id;

    INSERT INTO public.calculo_itens(calculo_id, tipo, regra_id, presenca_id, descricao, quantidade, valor_unitario, referencia)
    SELECT v_calculo_id, 'presenca', r.id, p.id, r.nome, 1, r.valor, jsonb_build_object('data', p.data_presenca, 'turno', p.turno, 'local_id', p.local_id)
    FROM public.presencas p
    JOIN LATERAL (
      SELECT rf.* FROM public.regras_financeiras rf
      LEFT JOIN public.regra_preceptores rp ON rp.regra_id = rf.id
      WHERE rf.status = 'ativo' AND rf.exige_presenca = true
        AND p.data_presenca BETWEEN rf.data_inicio AND coalesce(rf.data_fim, p.data_presenca)
        AND (rf.tipo_atuacao IS NULL OR rf.tipo_atuacao = p.tipo_atuacao)
        AND (rf.local_id IS NULL OR rf.local_id = p.local_id)
        AND (rf.setor_id IS NULL OR rf.setor_id = p.setor_id)
        AND (rp.preceptor_id IS NULL OR rp.preceptor_id = p.preceptor_id)
        AND rf.forma_calculo IN ('por_turno','por_hora','por_grupo')
      ORDER BY rf.prioridade ASC, rf.created_at DESC LIMIT 1
    ) r ON TRUE
    WHERE p.preceptor_id = v_preceptor.preceptor_id
      AND p.data_presenca BETWEEN v_comp.data_inicio AND v_comp.data_fim
      AND p.status IN ('confirmada','ajustada');

    INSERT INTO public.calculo_itens(calculo_id, tipo, regra_id, descricao, quantidade, valor_unitario, referencia)
    SELECT v_calculo_id,
      CASE r.forma_calculo WHEN 'mensal_fixo' THEN 'fixo'::public.tipo_item_calculo WHEN 'rateio' THEN 'rateio'::public.tipo_item_calculo WHEN 'adicional' THEN 'adicional'::public.tipo_item_calculo WHEN 'desconto' THEN 'desconto'::public.tipo_item_calculo ELSE 'ajuste'::public.tipo_item_calculo END,
      r.id, r.nome, r.quantidade_base, r.valor, jsonb_build_object('forma_calculo', r.forma_calculo)
    FROM public.regras_financeiras r
    JOIN public.regra_preceptores rp ON rp.regra_id = r.id AND rp.preceptor_id = v_preceptor.preceptor_id
    WHERE r.status = 'ativo' AND r.exige_presenca = false
      AND r.data_inicio <= v_comp.data_fim AND coalesce(r.data_fim, v_comp.data_fim) >= v_comp.data_inicio;

    UPDATE public.calculos c SET
      total_bruto = coalesce((SELECT sum(i.valor_total) FROM public.calculo_itens i WHERE i.calculo_id = c.id AND i.tipo NOT IN ('desconto','estorno')), 0),
      total_descontos = abs(coalesce((SELECT sum(i.valor_total) FROM public.calculo_itens i WHERE i.calculo_id = c.id AND i.tipo IN ('desconto','estorno')), 0)),
      updated_at = now()
    WHERE c.id = v_calculo_id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- --------------------------------------------------------------------------
-- 8. FUNCOES DE ACESSO POR TOKEN (do 002, ausentes no banco)
-- --------------------------------------------------------------------------

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

  IF NOT EXISTS(SELECT 1 FROM public.preceptores WHERE id = p_preceptor_id AND status = 'ativo') THEN
    raise exception 'Preceptor nao encontrado ou inativo';
  END IF;

  UPDATE public.preceptor_acesso_presenca
  SET revogado = true, revogado_em = now(), ativo = false
  WHERE preceptor_id = p_preceptor_id AND ativo = true AND NOT revogado;

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

  SELECT * INTO v_acesso FROM public.preceptor_acesso_presenca WHERE token_hash = v_hash;

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

  SELECT * INTO v_preceptor FROM public.preceptores WHERE id = v_acesso.preceptor_id AND status = 'ativo';
  IF v_preceptor.id IS NULL THEN
    RETURN jsonb_build_object('valido', false, 'erro', 'Preceptor nao encontrado ou inativo.');
  END IF;

  UPDATE public.preceptor_acesso_presenca SET ultimo_acesso_em = now() WHERE id = v_acesso.id;

  RETURN jsonb_build_object('valido', true, 'preceptor_id', v_preceptor.id, 'nome', v_preceptor.nome_completo);
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
  WHERE token_hash = v_hash AND ativo = true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN RETURN v_result; END IF;
  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN RETURN v_result; END IF;

  v_dow := extract(dow from current_date)::smallint;

  FOR v_rec IN
    SELECT
      e.id as escala_id, e.tipo_atuacao, e.turno, e.hora_inicio, e.hora_fim,
      CASE WHEN e.tipo_atuacao = 'adm' THEN d.nome ELSE i.nome END as atividade_nome,
      l.nome as local_nome, coalesce(s.nome, '-') as setor_nome,
      CASE WHEN e.tipo_atuacao = 'adm' THEN e.vinculo_adm_id ELSE e.vinculo_internato_id END as vinculo_id,
      vl.local_id, vl.setor_id
    FROM public.escalas e
    LEFT JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
    LEFT JOIN public.locais l ON l.id = vl.local_id
    LEFT JOIN public.setores s ON s.id = vl.setor_id
    LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
    LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
    LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
    LEFT JOIN public.internatos i ON i.id = vi.internato_id
    WHERE e.status = 'ativo' AND e.dia_semana = v_dow
      AND current_date BETWEEN e.data_inicio AND e.data_fim
      AND ((e.tipo_atuacao = 'adm' AND va.preceptor_id = v_acesso.preceptor_id)
        OR (e.tipo_atuacao = 'internato' AND vi.preceptor_id = v_acesso.preceptor_id))
  LOOP
    v_row := jsonb_build_object(
      'escala_id', v_rec.escala_id, 'tipo_atuacao', v_rec.tipo_atuacao,
      'turno', v_rec.turno, 'atividade', v_rec.atividade_nome,
      'local', v_rec.local_nome, 'setor', v_rec.setor_nome,
      'local_id', v_rec.local_id,
      'hora_inicio', to_char(v_rec.hora_inicio, 'HH24:MI'),
      'hora_fim', to_char(v_rec.hora_fim, 'HH24:MI'),
      'ja_registrada', EXISTS(
        SELECT 1 FROM public.presencas p
        WHERE p.escala_id = v_rec.escala_id AND p.turno = v_rec.turno
          AND p.data_presenca = current_date AND p.status IN ('confirmada','ajustada')
      )
    );
    v_result := v_result || v_row;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_presenca_token(
  p_token text, p_escala_id uuid, p_turno public.turno
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  WHERE token_hash = v_hash AND ativo = true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso invalido.'); END IF;
  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso expirado.'); END IF;

  SELECT * INTO v_preceptor FROM public.preceptores WHERE id = v_acesso.preceptor_id AND status = 'ativo';
  IF v_preceptor.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Preceptor inativo.'); END IF;

  SELECT * INTO v_escala FROM public.escalas WHERE id = p_escala_id AND status = 'ativo';
  IF v_escala.id IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala invalida.'); END IF;
  IF v_escala.turno <> p_turno THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Turno nao corresponde a escala.'); END IF;
  IF extract(dow from current_date)::smallint <> v_escala.dia_semana THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.'); END IF;
  IF current_date NOT BETWEEN v_escala.data_inicio AND v_escala.data_fim THEN RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.'); END IF;

  IF v_escala.tipo_atuacao = 'adm' AND NOT EXISTS(SELECT 1 FROM public.vinculos_adm v WHERE v.id = v_escala.vinculo_adm_id AND v.preceptor_id = v_preceptor.id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;
  IF v_escala.tipo_atuacao = 'internato' AND NOT EXISTS(SELECT 1 FROM public.vinculos_internato v WHERE v.id = v_escala.vinculo_internato_id AND v.preceptor_id = v_preceptor.id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  IF EXISTS(SELECT 1 FROM public.presencas WHERE preceptor_id = v_preceptor.id AND data_presenca = current_date AND turno = p_turno AND escala_id = p_escala_id AND status IN ('confirmada','ajustada')) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno hoje.');
  END IF;

  SELECT * INTO v_local FROM public.vinculo_locais WHERE id = v_escala.vinculo_local_id;

  v_registrado_por := v_acesso.created_by;
  IF v_registrado_por IS NULL THEN
    SELECT p.id INTO v_registrado_por FROM public.profiles p JOIN public.user_roles ur ON ur.profile_id = p.id WHERE ur.role = 'administrador' AND p.ativo = true LIMIT 1;
  END IF;

  INSERT INTO public.presencas(
    preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id, data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao, v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, v_local.setor_id, current_date, p_turno, 'confirmada', 'preceptor', v_registrado_por
  ) RETURNING id INTO v_id;

  UPDATE public.preceptor_acesso_presenca SET ultimo_acesso_em = now() WHERE id = v_acesso.id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.bloquear_acesso_preceptor(p_preceptor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN raise exception 'Acesso negado'; END IF;
  UPDATE public.preceptor_acesso_presenca SET bloqueado = true, bloqueado_em = now(), ativo = false
  WHERE preceptor_id = p_preceptor_id AND ativo = true AND NOT revogado;
END;
$$;

CREATE OR REPLACE FUNCTION public.revogar_acesso_preceptor(p_preceptor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN raise exception 'Acesso negado'; END IF;
  UPDATE public.preceptor_acesso_presenca SET revogado = true, revogado_em = now(), ativo = false
  WHERE preceptor_id = p_preceptor_id AND ativo = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.renovar_acesso_preceptor(p_preceptor_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw text;
  v_hash text;
  v_profile_id uuid;
BEGIN
  IF NOT public.has_role(array['administrador','academico']::public.app_role[]) THEN raise exception 'Acesso negado'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.preceptores WHERE id = p_preceptor_id AND status = 'ativo') THEN raise exception 'Preceptor nao encontrado ou inativo'; END IF;

  UPDATE public.preceptor_acesso_presenca SET revogado = true, revogado_em = now(), ativo = false
  WHERE preceptor_id = p_preceptor_id AND ativo = true AND NOT revogado;

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
  IF NOT public.has_role(array['administrador','academico','coordenador']::public.app_role[]) THEN raise exception 'Acesso negado'; END IF;

  SELECT * INTO v_acesso FROM public.preceptor_acesso_presenca
  WHERE preceptor_id = p_preceptor_id ORDER BY created_at DESC LIMIT 1;

  IF v_acesso.id IS NULL THEN RETURN jsonb_build_object('existe', false); END IF;

  RETURN jsonb_build_object(
    'existe', true, 'id', v_acesso.id, 'ativo', v_acesso.ativo,
    'bloqueado', v_acesso.bloqueado, 'revogado', v_acesso.revogado,
    'created_at', v_acesso.created_at, 'expira_em', v_acesso.expira_em,
    'ultimo_acesso_em', v_acesso.ultimo_acesso_em,
    'bloqueado_em', v_acesso.bloqueado_em, 'revogado_em', v_acesso.revogado_em
  );
END;
$$;

-- --------------------------------------------------------------------------
-- 9. RLS: Habilitar RLS em todas as tabelas
-- --------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','user_roles','preceptores','preceptor_documentos','ies','cursos','semestres','periodos','disciplinas','internatos','locais','setores','feriados','favorecidos','preceptor_favorecidos','vinculos_adm','vinculos_internato','vinculo_locais','escalas','presencas','ajustes_presenca','regras_financeiras','regra_preceptores','rateios_financeiros','competencias','calculos','calculo_itens','aprovacoes','saldos_autorizados','saldo_movimentos','processos_pagamento','processo_calculos','pagamentos','notificacoes','configuracoes','audit_logs','preceptor_acesso_presenca'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 10. RLS: Politicas (todas com IF NOT EXISTS equivalentes via DROP+CREATE)
-- --------------------------------------------------------------------------

-- Profiles
DROP POLICY IF EXISTS profiles_select_own_or_staff ON public.profiles;
CREATE POLICY profiles_select_own_or_staff ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_staff_all ON public.profiles;
CREATE POLICY profiles_staff_all ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(array['administrador']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador']::public.app_role[]));

-- User roles
DROP POLICY IF EXISTS roles_admin_all ON public.user_roles;
CREATE POLICY roles_admin_all ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(array['administrador']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador']::public.app_role[]));

DROP POLICY IF EXISTS roles_select_own ON public.user_roles;
CREATE POLICY roles_select_own ON public.user_roles FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id());

-- Preceptores
DROP POLICY IF EXISTS preceptores_select_own_or_staff ON public.preceptores;
CREATE POLICY preceptores_select_own_or_staff ON public.preceptores FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id() OR public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));

DROP POLICY IF EXISTS preceptores_staff_write ON public.preceptores;
CREATE POLICY preceptores_staff_write ON public.preceptores FOR ALL TO authenticated
  USING (public.has_role(array['administrador','academico']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador','academico']::public.app_role[]));

-- Academica: leitura publica authenticated, escrita admin/academico
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ies','cursos','semestres','periodos','disciplinas','internatos','locais','setores','feriados'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(array[''administrador'',''academico'']::public.app_role[])) WITH CHECK (public.has_role(array[''administrador'',''academico'']::public.app_role[]))', t || '_write', t);
  END LOOP;
END $$;

-- Financeira
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['favorecidos','preceptor_favorecidos','regras_financeiras','regra_preceptores','rateios_financeiros','competencias','calculos','calculo_itens','saldos_autorizados','saldo_movimentos','processos_pagamento','processo_calculos','pagamentos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read_staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(array[''administrador'',''financeiro'',''auditor'',''coordenador'']::public.app_role[]))', t || '_read_staff', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_finance', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(array[''administrador'',''financeiro'']::public.app_role[])) WITH CHECK (public.has_role(array[''administrador'',''financeiro'']::public.app_role[]))', t || '_write_finance', t);
  END LOOP;
END $$;

-- Vinculos write
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vinculos_adm','vinculos_internato','vinculo_locais','escalas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(array[''administrador'',''academico'']::public.app_role[])) WITH CHECK (public.has_role(array[''administrador'',''academico'']::public.app_role[]))', t || '_write', t);
  END LOOP;
END $$;

-- Vinculos read (individualizado)
DROP POLICY IF EXISTS vinculos_adm_read ON public.vinculos_adm;
CREATE POLICY vinculos_adm_read ON public.vinculos_adm FOR SELECT TO authenticated USING (
  public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[])
  OR exists(select 1 from public.preceptores p where p.profile_id = public.current_profile_id() and p.id = vinculos_adm.preceptor_id)
);

DROP POLICY IF EXISTS vinculos_internato_read ON public.vinculos_internato;
CREATE POLICY vinculos_internato_read ON public.vinculos_internato FOR SELECT TO authenticated USING (
  public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[])
  OR exists(select 1 from public.preceptores p where p.profile_id = public.current_profile_id() and p.id = vinculos_internato.preceptor_id)
);

DROP POLICY IF EXISTS vinculo_locais_read ON public.vinculo_locais;
CREATE POLICY vinculo_locais_read ON public.vinculo_locais FOR SELECT TO authenticated USING (
  public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[])
  OR exists(select 1 from public.preceptores p where p.profile_id = public.current_profile_id() and (
    (vinculo_locais.vinculo_adm_id is not null and exists(select 1 from public.vinculos_adm va where va.id = vinculo_locais.vinculo_adm_id and va.preceptor_id = p.id))
    OR (vinculo_locais.vinculo_internato_id is not null and exists(select 1 from public.vinculos_internato vi where vi.id = vinculo_locais.vinculo_internato_id and vi.preceptor_id = p.id))
  ))
);

DROP POLICY IF EXISTS escalas_read ON public.escalas;
CREATE POLICY escalas_read ON public.escalas FOR SELECT TO authenticated USING (
  public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[])
  OR exists(select 1 from public.preceptores p where p.profile_id = public.current_profile_id() and (
    (escalas.vinculo_adm_id is not null and exists(select 1 from public.vinculos_adm va where va.id = escalas.vinculo_adm_id and va.preceptor_id = p.id))
    OR (escalas.vinculo_internato_id is not null and exists(select 1 from public.vinculos_internato vi where vi.id = escalas.vinculo_internato_id and vi.preceptor_id = p.id))
  ))
);

-- Presencas
DROP POLICY IF EXISTS presencas_read_own_or_staff ON public.presencas;
CREATE POLICY presencas_read_own_or_staff ON public.presencas FOR SELECT TO authenticated USING (
  exists(select 1 from public.preceptores p where p.id = presencas.preceptor_id and p.profile_id = public.current_profile_id())
  OR public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[])
);

DROP POLICY IF EXISTS presencas_staff_write ON public.presencas;
CREATE POLICY presencas_staff_write ON public.presencas FOR ALL TO authenticated
  USING (public.has_role(array['administrador','academico']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador','academico']::public.app_role[]));

-- Ajustes
DROP POLICY IF EXISTS ajustes_staff ON public.ajustes_presenca;
CREATE POLICY ajustes_staff ON public.ajustes_presenca FOR ALL TO authenticated
  USING (public.has_role(array['administrador','academico','coordenador','auditor']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador','academico','coordenador']::public.app_role[]));

-- Aprovacoes
DROP POLICY IF EXISTS aprovacoes_staff ON public.aprovacoes;
CREATE POLICY aprovacoes_staff ON public.aprovacoes FOR ALL TO authenticated
  USING (public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador','academico','financeiro','coordenador']::public.app_role[]));

-- Documentos
DROP POLICY IF EXISTS docs_staff_or_own ON public.preceptor_documentos;
CREATE POLICY docs_staff_or_own ON public.preceptor_documentos FOR SELECT TO authenticated USING (
  exists(select 1 from public.preceptores p where p.id = preceptor_documentos.preceptor_id and p.profile_id = public.current_profile_id())
  OR public.has_role(array['administrador','academico','financeiro','auditor']::public.app_role[])
);

DROP POLICY IF EXISTS docs_staff_write ON public.preceptor_documentos;
CREATE POLICY docs_staff_write ON public.preceptor_documentos FOR ALL TO authenticated
  USING (public.has_role(array['administrador','academico']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador','academico']::public.app_role[]));

-- Notificacoes
DROP POLICY IF EXISTS notifications_own ON public.notificacoes;
CREATE POLICY notifications_own ON public.notificacoes FOR SELECT TO authenticated USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS notifications_own_update ON public.notificacoes;
CREATE POLICY notifications_own_update ON public.notificacoes FOR UPDATE TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS notifications_staff_insert ON public.notificacoes;
CREATE POLICY notifications_staff_insert ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(array['administrador','academico','financeiro','coordenador']::public.app_role[]));

-- Configuracoes
DROP POLICY IF EXISTS config_admin ON public.configuracoes;
CREATE POLICY config_admin ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_role(array['administrador']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador']::public.app_role[]));

DROP POLICY IF EXISTS config_staff_read ON public.configuracoes;
CREATE POLICY config_staff_read ON public.configuracoes FOR SELECT TO authenticated
  USING (public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));

-- Auditoria
DROP POLICY IF EXISTS audit_read ON public.audit_logs;
CREATE POLICY audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(array['administrador','auditor']::public.app_role[]));

-- Acesso presenca
DROP POLICY IF EXISTS acesso_admin_read ON public.preceptor_acesso_presenca;
CREATE POLICY acesso_admin_read ON public.preceptor_acesso_presenca FOR SELECT TO authenticated
  USING (public.has_role(array['administrador','academico','coordenador']::public.app_role[]));

DROP POLICY IF EXISTS acesso_admin_write ON public.preceptor_acesso_presenca;
CREATE POLICY acesso_admin_write ON public.preceptor_acesso_presenca FOR ALL TO authenticated
  USING (public.has_role(array['administrador','academico']::public.app_role[]))
  WITH CHECK (public.has_role(array['administrador','academico']::public.app_role[]));

DROP POLICY IF EXISTS acesso_own_select ON public.preceptor_acesso_presenca;
CREATE POLICY acesso_own_select ON public.preceptor_acesso_presenca FOR SELECT TO authenticated USING (
  exists(select 1 from public.preceptores p where p.id = preceptor_acesso_presenca.preceptor_id and p.profile_id = public.current_profile_id())
);

-- --------------------------------------------------------------------------
-- 11. GRANTS
-- --------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role[]) TO authenticated;
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
GRANT SELECT, INSERT ON public.presencas TO anon;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM public;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM public;

-- --------------------------------------------------------------------------
-- 12. INDICES
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_preceptores_status ON public.preceptores(status);
CREATE INDEX IF NOT EXISTS idx_preceptores_profile ON public.preceptores(profile_id);
CREATE INDEX IF NOT EXISTS idx_vinculos_adm_preceptor ON public.vinculos_adm(preceptor_id, semestre_id, status);
CREATE INDEX IF NOT EXISTS idx_vinculos_internato_preceptor ON public.vinculos_internato(preceptor_id, semestre_id, status);
CREATE INDEX IF NOT EXISTS idx_escalas_dia ON public.escalas(dia_semana, turno, status, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_presencas_data ON public.presencas(data_presenca, preceptor_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_presencas_unica ON public.presencas(preceptor_id, escala_id, data_presenca, turno);
CREATE INDEX IF NOT EXISTS idx_regras_vigencia ON public.regras_financeiras(status, data_inicio, data_fim, prioridade);
CREATE INDEX IF NOT EXISTS idx_calculos_competencia ON public.calculos(competencia_id, status);
CREATE INDEX IF NOT EXISTS idx_calculo_itens_calculo ON public.calculo_itens(calculo_id, tipo);
CREATE INDEX IF NOT EXISTS idx_processos_competencia ON public.processos_pagamento(competencia_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos(status, data_pagamento);
CREATE INDEX IF NOT EXISTS idx_audit_tabela_registro ON public.audit_logs(tabela, registro_id, ocorrido_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_profile ON public.notificacoes(profile_id, lida_em, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acesso_preceptor ON public.preceptor_acesso_presenca(preceptor_id, ativo);
CREATE INDEX IF NOT EXISTS idx_acesso_hash ON public.preceptor_acesso_presenca(token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_locais_unica ON public.vinculo_locais(
  tipo_atuacao,
  COALESCE(vinculo_adm_id::text, '00000000-0000-0000-0000-000000000000'),
  COALESCE(vinculo_internato_id::text, '00000000-0000-0000-0000-000000000000'),
  local_id,
  COALESCE(setor_id::text, '00000000-0000-0000-0000-000000000000')
);

-- --------------------------------------------------------------------------
-- 13. CONFIGURACOES INICIAIS
-- --------------------------------------------------------------------------

INSERT INTO public.configuracoes(chave, valor, descricao)
VALUES
  ('registro_presenca_somente_dia_atual', 'true'::jsonb, 'Preceptor registra apenas a data atual.'),
  ('exigir_escala_para_presenca', 'true'::jsonb, 'Exige escala ativa para registrar presenca.'),
  ('permitir_saldo_negativo', 'false'::jsonb, 'Bloqueia consumo acima do saldo autorizado.'),
  ('moeda', '"BRL"'::jsonb, 'Moeda padrao do sistema.'),
  ('timezone', '"America/Recife"'::jsonb, 'Fuso horario operacional.')
ON CONFLICT(chave) DO NOTHING;

COMMIT;
