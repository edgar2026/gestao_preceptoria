-- Migration 021: Escala Unica por Vinculo (Pratica e Internato)
--
-- 1. Garante que cada vinculo possua no maximo 1 escala.
-- 2. Atualiza salvar_escala_completa para bloquear criacao de escala secundaria por vinculo.
-- 3. Cria indices unicos parciais se nao houver duplicidades pre-existentes.

CREATE OR REPLACE FUNCTION public.salvar_escala_completa(
  p_escala_id UUID DEFAULT NULL,
  p_tipo_atuacao PUBLIC.tipo_atuacao DEFAULT 'adm',
  p_vinculo_adm_id UUID DEFAULT NULL,
  p_vinculo_internato_id UUID DEFAULT NULL,
  p_vinculo_local_id UUID DEFAULT NULL,
  p_data_inicio DATE DEFAULT NULL,
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

  -- Validar se vinculo ja possui escala cadastrada (quando criando nova escala)
  IF p_escala_id IS NULL THEN
    IF p_tipo_atuacao = 'adm' AND p_vinculo_adm_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.escalas WHERE vinculo_adm_id = p_vinculo_adm_id) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Este vinculo ja possui uma escala. Edite a escala existente.');
      END IF;
    ELSIF p_tipo_atuacao = 'internato' AND p_vinculo_internato_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.escalas WHERE vinculo_internato_id = p_vinculo_internato_id) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Este vinculo ja possui uma escala. Edite a escala existente.');
      END IF;
    END IF;
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

  -- Validar regra pratica: sem sabados ou domingos
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

  -- Validar conflito: mesmo vinculo, mesma data, mesmo turno
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_data := (v_item->>'data')::date;
    v_item_turno := (v_item->>'turno')::PUBLIC.turno;

    IF p_tipo_atuacao = 'adm' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        JOIN public.escalas e ON e.id = ei.escala_id
        WHERE e.vinculo_adm_id = p_vinculo_adm_id
          AND e.status = 'ativo'
          AND ei.data = v_item_data
          AND ei.turno = v_item_turno
          AND (p_escala_id IS NULL OR e.id <> p_escala_id)
      ) INTO v_exists;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.escalas_itens ei
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
        'Conflito: este preceptor ja possui escala para a mesma data e turno.'
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

  -- Inserir itens
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

-- Tentar criar indices unicos caso nao existam duplicidades legadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT vinculo_adm_id FROM public.escalas WHERE vinculo_adm_id IS NOT NULL GROUP BY vinculo_adm_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_escalas_unica_adm ON public.escalas (vinculo_adm_id) WHERE vinculo_adm_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Duplicidades de escala encontradas em vinculos_adm. Indice unico nao aplicado.';
  END IF;

  IF NOT EXISTS (
    SELECT vinculo_internato_id FROM public.escalas WHERE vinculo_internato_id IS NOT NULL GROUP BY vinculo_internato_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_escalas_unica_internato ON public.escalas (vinculo_internato_id) WHERE vinculo_internato_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Duplicidades de escala encontradas em vinculos_internato. Indice unico nao aplicado.';
  END IF;
END $$;
