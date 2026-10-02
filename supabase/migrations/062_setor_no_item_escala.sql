-- Etapa SETOR-NO-ITEM-DA-ESCALA
-- Objetivo: o setor passa a pertencer ao ITEM da escala (data/dia + turno),
-- permitindo setores diferentes conforme data, dia e turno.
--
-- Regras preservadas nesta migração:
--   * O setor do vínculo (vinculo_locais.setor_id / vinculos_*.setor_id) NÃO é removido:
--     continua existindo como setor LEGADO/OPCIONAL do vínculo.
--   * Nenhum setor é copiado automaticamente para os itens existentes (fica NULL;
--     a leitura usa o setor legado do vínculo como fallback).
--   * Local continua pertencendo ao vínculo (vinculo_locais.local_id inalterado).
--   * Setor não altera valor financeiro, não cria presença nem pagamento extra.
--   * RLS, triggers, cálculos, presenças e pagamentos inalterados.
--   * Somente setores já cadastrados em `setores` podem ser usados (FK).

-- 1) Estrutura mínima: setor próprio no item da escala (opcional/nullable).
ALTER TABLE public.escalas_itens
  ADD COLUMN IF NOT EXISTS setor_id uuid;

-- 2) Relacionar ao cadastro auxiliar existente (setores cadastrados).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'escalas_itens_setor_id_fkey'
      AND conrelid = 'public.escalas_itens'::regclass
  ) THEN
    ALTER TABLE public.escalas_itens
      ADD CONSTRAINT escalas_itens_setor_id_fkey
      FOREIGN KEY (setor_id) REFERENCES public.setores(id);
  END IF;
END $$;

COMMENT ON COLUMN public.escalas_itens.setor_id IS
  'Setor do item da escala (varia por data/dia e turno). NULL = item legado: '
  'usar como fallback de leitura o setor legado do vínculo (vinculo_locais.setor_id). '
  'Somente setores cadastrados. Nao altera valor financeiro nem gera presença/pagamento extra.';

-- 3) Índice para a nova FK (leitura por setor / junções).
CREATE INDEX IF NOT EXISTS escalas_itens_setor_id_idx
  ON public.escalas_itens (setor_id);

-- 4) RPC salvar_escala_completa: passa a aceitar setor_id OPCIONAL por item.
--    Itens sem setor_id ficam com setor NULL (item legado → fallback de leitura).
--    Nenhum setor é copiado automaticamente do vínculo.
--    Nenhuma alteração em cálculo, conflito, presença ou financeiro.
CREATE OR REPLACE FUNCTION public.salvar_escala_completa(
  p_tipo_atuacao tipo_atuacao,
  p_vinculo_local_id uuid,
  p_data_inicio date,
  p_itens jsonb,
  p_escala_id uuid DEFAULT NULL::uuid,
  p_vinculo_adm_id uuid DEFAULT NULL::uuid,
  p_vinculo_internato_id uuid DEFAULT NULL::uuid,
  p_data_fim date DEFAULT NULL::date,
  p_status status_registro DEFAULT 'ativo'::status_registro
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_escala_id UUID;
  v_item JSONB;
  v_data DATE;
  v_preceptor UUID;
  v_conflito JSONB;
  v_setor_id UUID;
BEGIN
  IF jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Adicione pelo menos um dia e turno.');
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

  -- Validar vigencia do vinculo pratica
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

  -- Validar vigencia do vinculo internato
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

  -- Validar regra pratica: sem sabados ou domingos e datas dentro da vigencia
  IF p_tipo_atuacao = 'adm' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
      v_data := (v_item->>'data')::date;
      IF extract(dow from v_data) IN (0, 6) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala pratica nao pode incluir sabados ou domingos.');
      END IF;
    END LOOP;
  END IF;

  v_preceptor := coalesce(
    (SELECT va.preceptor_id FROM public.vinculos_adm va WHERE va.id = p_vinculo_adm_id),
    (SELECT vi.preceptor_id FROM public.vinculos_internato vi WHERE vi.id = p_vinculo_internato_id)
  );

  -- Validar vigencia dos itens, CONFLITO POR PRECEPTOR e setor próprio (se informado).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_data := (v_item->>'data')::date;
    IF v_data < p_data_inicio OR (p_data_fim IS NOT NULL AND v_data > p_data_fim) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Item de escala fora da vigencia informada.');
    END IF;

    -- Setor do item: somente setores já cadastrados (nunca criar por texto livre).
    v_setor_id := NULL;
    IF nullif(btrim(coalesce(v_item->>'setor_id', '')), '') IS NOT NULL THEN
      BEGIN
        v_setor_id := (v_item->>'setor_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Setor invalido. Selecione um setor cadastrado.');
      END;
      IF NOT EXISTS (SELECT 1 FROM public.setores s WHERE s.id = v_setor_id) THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'Setor nao encontrado no cadastro. Selecione um setor cadastrado.');
      END IF;
    END IF;

    IF p_status = 'ativo' THEN
      v_conflito := public.fn_avaliar_conflito_escala(
        v_preceptor, p_escala_id, v_data, (v_item->>'turno')::public.turno, 1);
      IF v_conflito IS NOT NULL THEN
        RETURN jsonb_build_object(
          'sucesso', false,
          'conflito', true,
          'erro', public.fn_mensagem_conflito_escala(
                    v_conflito,
                    'Conflito de horário',
                    'Escolha outra data, outro turno ou outro preceptor.')
        );
      END IF;
    END IF;
  END LOOP;

  -- Inserir ou atualizar escala pai.
  -- Os itens são removidos ANTES da atualização para que a trigger
  -- de reativação valide os itens novos (e não os antigos).
  IF p_escala_id IS NOT NULL THEN
    v_escala_id := p_escala_id;
    DELETE FROM public.escalas_itens WHERE escala_id = v_escala_id;
    UPDATE public.escalas SET
      tipo_atuacao = p_tipo_atuacao,
      vinculo_adm_id = p_vinculo_adm_id,
      vinculo_internato_id = p_vinculo_internato_id,
      vinculo_local_id = p_vinculo_local_id,
      data_inicio = p_data_inicio,
      data_fim = p_data_fim,
      status = p_status,
      updated_at = now()
    WHERE id = v_escala_id;
  ELSE
    INSERT INTO public.escalas (
      tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id,
      data_inicio, data_fim, status
    ) VALUES (
      p_tipo_atuacao, p_vinculo_adm_id, p_vinculo_internato_id, p_vinculo_local_id,
      p_data_inicio, p_data_fim, p_status
    ) RETURNING id INTO v_escala_id;
  END IF;

  -- Inserir itens (data + turno + setor opcional próprio)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_setor_id := NULL;
    IF nullif(btrim(coalesce(v_item->>'setor_id', '')), '') IS NOT NULL THEN
      v_setor_id := (v_item->>'setor_id')::uuid;
    END IF;

    INSERT INTO public.escalas_itens (escala_id, data, turno, setor_id)
    VALUES (
      v_escala_id,
      (v_item->>'data')::date,
      (v_item->>'turno')::public.turno,
      v_setor_id
    );
  END LOOP;

  RETURN jsonb_build_object('sucesso', true, 'escala_id', v_escala_id);
END;
$function$;
