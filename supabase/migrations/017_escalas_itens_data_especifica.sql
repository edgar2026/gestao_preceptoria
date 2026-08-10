-- ============================================================================
-- MIGRACAO 017: ESCALAS POR DATA ESPECIFICA
--
-- 1. Adiciona coluna data (DATE) a escalas_itens
-- 2. Atualiza unique constraint para (escala_id, data, turno)
-- 3. Atualiza RPC salvar_escala_completa para aceitar data nos itens
-- 4. Atualiza buscar_escalas_token e registrar_presenca_token
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. ADICIONAR COLUNA data A escalas_itens
-- --------------------------------------------------------------------------
ALTER TABLE public.escalas_itens
  ADD COLUMN IF NOT EXISTS data DATE;

-- Preencher data a partir de dia_semana + data_inicio da escala pai (para dados legados)
UPDATE public.escalas_itens ei
SET data = (
  SELECT (e.data_inicio + ((ei.dia_semana - extract(dow from e.data_inicio)::smallint + 7) % 7)::int)
  FROM public.escalas e WHERE e.id = ei.escala_id
)
WHERE ei.data IS NULL;

-- --------------------------------------------------------------------------
-- 2. ATUALIZAR UNIQUE CONSTRAINT
-- --------------------------------------------------------------------------
ALTER TABLE public.escalas_itens
  DROP CONSTRAINT IF EXISTS escalas_itens_escala_id_dia_semana_turno_key;

ALTER TABLE public.escalas_itens
  ADD CONSTRAINT escalas_itens_escala_id_data_turno_key
  UNIQUE (escala_id, data, turno);

-- Tornar data NOT NULL apos popular dados legados
ALTER TABLE public.escalas_itens
  ALTER COLUMN data SET NOT NULL;

-- --------------------------------------------------------------------------
-- 3. ATUALIZAR RPC salvar_escala_completa
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_escala_completa(
  p_escala_id UUID DEFAULT NULL,
  p_tipo_atuacao PUBLIC.tipo_atuacao,
  p_vinculo_adm_id UUID DEFAULT NULL,
  p_vinculo_internato_id UUID DEFAULT NULL,
  p_vinculo_local_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE DEFAULT NULL,
  p_status PUBLIC.status_registro DEFAULT 'ativo',
  p_itens JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_escala_id UUID;
  v_item JSONB;
  v_exists BOOLEAN;
  v_item_data DATE;
  v_item_turno PUBLIC.turno;
  v_item_dia_semana SMALLINT;
BEGIN
  IF jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Adicione pelo menos uma data e turno.');
  END IF;

  IF p_tipo_atuacao = 'adm' AND (p_vinculo_adm_id IS NULL OR p_vinculo_internato_id IS NOT NULL) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo pratica invalido.');
  END IF;
  IF p_tipo_atuacao = 'internato' AND (p_vinculo_internato_id IS NULL OR p_vinculo_adm_id IS NOT NULL) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo internato invalido.');
  END IF;

  IF p_data_fim IS NOT NULL AND p_data_fim < p_data_inicio THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Data final deve ser posterior ou igual a data inicial.');
  END IF;

  -- Validar vigencia do vinculo
  IF p_tipo_atuacao = 'adm' AND p_vinculo_adm_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vinculos_adm va
      WHERE va.id = p_vinculo_adm_id AND va.status = 'ativo'
        AND va.data_inicio <= p_data_inicio
        AND (va.data_fim IS NULL OR va.data_fim >= p_data_inicio)
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo pratica fora da vigencia ou inativo.');
    END IF;
  END IF;

  IF p_tipo_atuacao = 'internato' AND p_vinculo_internato_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = p_vinculo_internato_id AND vi.status = 'ativo'
        AND vi.data_inicio <= p_data_inicio
        AND (vi.data_fim IS NULL OR vi.data_fim >= p_data_inicio)
    ) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo internato fora da vigencia ou inativo.');
    END IF;
  END IF;

  -- Validar regra pratica: sem sabados, domingos ou feriados
  IF p_tipo_atuacao = 'adm' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_item_data := (v_item->>'data')::date;
      v_item_dia_semana := extract(dow from v_item_data)::smallint;
      IF v_item_dia_semana IN (0, 6) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala pratica nao pode incluir sabados ou domingos.');
      END IF;
    END LOOP;
  END IF;

  -- Validar conflito: mesmo preceptor, mesma data, mesmo turno
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_data := (v_item->>'data')::date;
    v_item_turno := (v_item->>'turno')::PUBLIC.turno;

    IF p_tipo_atuacao = 'adm' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.escalas ei
        JOIN public.escalas e ON e.id = ei.escala_id
        WHERE e.vinculo_adm_id = p_vinculo_adm_id
          AND e.status = 'ativo'
          AND ei.data = v_item_data
          AND ei.turno = v_item_turno
          AND (p_escala_id IS NULL OR e.id <> p_escala_id)
      ) INTO v_exists;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.escalas ei
        JOIN public.escalas e ON e.id = ei.escala_id
        WHERE e.vinculo_internato_id = p_vinculo_internato_id
          AND e.status = 'ativo'
          AND ei.data = v_item_data
          AND ei.turno = v_item_turno
          AND (p_escala_id IS NULL OR e.id <> p_escala_id)
      ) INTO v_exists;
    END IF;

    IF v_exists THEN
      RETURN jsonb_build_object(
        'sucesso', false, 'erro',
        'Conflito: este preceptor ja possui escala para esta data/turno.'
      );
    END IF;
  END LOOP;

  -- Inserir ou atualizar escala pai
  IF p_escala_id IS NOT NULL THEN
    UPDATE public.escalas SET
      tipo_atuacao = p_tipo_atuacao,
      vinculo_adm_id = p_vinculo_adm_id,
      vinculo_internato_id = p_vinculo_internato_id,
      vinculo_local_id = p_vinculo_local_id,
      data_inicio = p_data_inicio,
      data_fim = p_data_fim,
      status = p_status,
      updated_at = now()
    WHERE id = p_escala_id;
    v_escala_id := p_escala_id;
    DELETE FROM public.escalas_itens WHERE escala_id = v_escala_id;
  ELSE
    INSERT INTO public.escalas (
      tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id,
      data_inicio, data_fim, status
    ) VALUES (
      p_tipo_atuacao, p_vinculo_adm_id, p_vinculo_internato_id, p_vinculo_local_id,
      p_data_inicio, p_data_fim, p_status
    ) RETURNING id INTO v_escala_id;
  END IF;

  -- Inserir itens (data + turno + dia_semana derivado)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_data := (v_item->>'data')::date;
    v_item_turno := (v_item->>'turno')::PUBLIC.turno;
    v_item_dia_semana := extract(dow from v_item_data)::smallint;

    INSERT INTO public.escalas_itens (escala_id, data, dia_semana, turno, hora_inicio, hora_fim)
    VALUES (
      v_escala_id,
      v_item_data,
      v_item_dia_semana,
      v_item_turno,
      CASE WHEN v_item->>'hora_inicio' = '' THEN NULL ELSE (v_item->>'hora_inicio')::time END,
      CASE WHEN v_item->>'hora_fim' = '' THEN NULL ELSE (v_item->>'hora_fim')::time END
    );
  END LOOP;

  RETURN jsonb_build_object('sucesso', true, 'escala_id', v_escala_id);
END;
$$;

-- --------------------------------------------------------------------------
-- 4. ATUALIZAR buscar_escalas_token
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_escalas_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_rec record;
BEGIN
  v_hash := encode(sha256(p_token::bytea), 'hex');

  SELECT * INTO v_acesso
  FROM public.preceptor_acesso_presenca
  WHERE token_hash = v_hash AND ativo = true AND NOT bloqueado AND NOT revogado;

  IF v_acesso.id IS NULL THEN RETURN v_result; END IF;
  IF v_acesso.expira_em IS NOT NULL AND v_acesso.expira_em < now() THEN RETURN v_result; END IF;

  FOR v_rec IN
    SELECT
      e.id as escala_id, ei.id as escala_item_id,
      e.tipo_atuacao, ei.turno, ei.hora_inicio, ei.hora_fim, ei.data,
      CASE WHEN e.tipo_atuacao = 'adm' THEN d.nome ELSE i.nome END as atividade_nome,
      l.nome as local_nome, coalesce(s.nome, '-') as setor_nome,
      CASE WHEN e.tipo_atuacao = 'adm' THEN e.vinculo_adm_id ELSE e.vinculo_internato_id END as vinculo_id,
      vl.local_id, vl.setor_id
    FROM public.escalas_itens ei
    JOIN public.escalas e ON e.id = ei.escala_id
    LEFT JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
    LEFT JOIN public.locais l ON l.id = vl.local_id
    LEFT JOIN public.setores s ON s.id = vl.setor_id
    LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
    LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
    LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
    LEFT JOIN public.internatos i ON i.id = vi.internato_id
    WHERE e.status = 'ativo'
      AND ei.data = current_date
      AND current_date BETWEEN e.data_inicio AND coalesce(e.data_fim, current_date)
      AND ((e.tipo_atuacao = 'adm' AND va.preceptor_id = v_acesso.preceptor_id)
        OR (e.tipo_atuacao = 'internato' AND vi.preceptor_id = v_acesso.preceptor_id))
  LOOP
    v_row := jsonb_build_object(
      'escala_id', v_rec.escala_id, 'escala_item_id', v_rec.escala_item_id,
      'tipo_atuacao', v_rec.tipo_atuacao,
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

-- --------------------------------------------------------------------------
-- 5. ATUALIZAR registrar_presenca_token
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_presenca_token(
  p_token text, p_escala_id uuid, p_turno public.turno
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
  v_escala public.escalas%rowtype;
  v_escala_item public.escalas_itens%rowtype;
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

  -- Buscar item da escala para o turno e data atual
  SELECT * INTO v_escala_item
  FROM public.escalas_itens
  WHERE escala_id = p_escala_id AND turno = p_turno AND data = current_date;

  IF v_escala_item.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao possui turno para o dia atual.');
  END IF;

  IF current_date NOT BETWEEN v_escala.data_inicio AND coalesce(v_escala.data_fim, current_date) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  END IF;

  IF v_escala.tipo_atuacao = 'adm' AND NOT EXISTS(SELECT 1 FROM public.vinculos_adm v WHERE v.id = v_escala.vinculo_adm_id AND v.preceptor_id = v_preceptor.id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;
  IF v_escala.tipo_atuacao = 'internato' AND NOT EXISTS(SELECT 1 FROM public.vinculos_internato v WHERE v.id = v_escala.vinculo_internato_id AND v.preceptor_id = v_preceptor.id) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  END IF;

  SELECT * INTO v_local FROM public.vinculo_locais WHERE id = v_escala.vinculo_local_id;
  IF v_local.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Local da escala invalido.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.presencas p
    WHERE p.preceptor_id = v_preceptor.id
      AND p.escala_id = v_escala.id
      AND p.turno = p_turno
      AND p.data_presenca = current_date
      AND p.status IN ('confirmada','ajustada')
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno.');
  END IF;

  SELECT profile_id INTO v_registrado_por
  FROM public.preceptor_acesso_presenca
  WHERE id = v_acesso.id;

  INSERT INTO public.presencas (
    preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id, data_presenca, turno, status, origem, registrado_por
  ) VALUES (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao,
    v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, v_local.setor_id,
    current_date, p_turno, 'confirmada', 'preceptor',
    COALESCE(v_registrado_por, v_preceptor.profile_id)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('sucesso', true, 'presenca_id', v_id);
END;
$$;

-- --------------------------------------------------------------------------
-- 6. ATUALIZAR INDICES
-- --------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_escalas_itens_dia_turno;
CREATE INDEX IF NOT EXISTS idx_escalas_itens_data_turno ON public.escalas_itens(data, turno, escala_id);

COMMIT;
