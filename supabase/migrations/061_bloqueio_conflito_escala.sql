-- ============================================================
-- Migration 061: BLOQUEAR-CONFLITO-DE-ESCALA
-- ============================================================
-- REGRA DEFINITIVA:
--   Um preceptor não pode possuir duas escalas ATIVAS na mesma
--   DATA e no mesmo TURNO, mesmo que sejam diferentes vínculo,
--   Internato, disciplina, unidade, local, setor ou Coordenador.
--   Trabalhar na mesma data em TURNOS DIFERENTES é permitido.
--
-- Escala INATIVA não bloqueia; ao reativar, a validação roda
-- novamente e bloqueia se houver conflito.
--
-- Esta migração:
--   1) cria a função transacional de validação de conflito;
--   2) cria as RPCs consultáveis pelo frontend (criação/edição);
--   3) cria triggers que garantem a regra no banco (não confiar
--      no frontend), em escalas, itens de escala e presenças;
--   4) reforça salvar_escala_completa e as RPCs de presença;
--   5) NÃO altera RLS, policies, permissões de tabela, regras
--      financeiras, presenças antigas nem cálculos.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Mensagem amigável (sem SQL, UUID, constraint ou stack trace)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_mensagem_conflito_escala(
  p_detalhe jsonb,
  p_titulo text,
  p_encerramento text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF p_detalhe IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN coalesce(nullif(p_titulo, ''), 'Conflito de horário') || E'\n'
    || 'Este preceptor já possui escala em '
    || to_char((p_detalhe->>'data')::date, 'DD/MM/YYYY')
    || ', no turno ' || coalesce(p_detalhe->>'turno_label', p_detalhe->>'turno', '') || '.' || E'\n'
    || 'Internato ou disciplina: ' || coalesce(p_detalhe->>'atividade', 'Não informada') || E'\n'
    || 'Local: ' || coalesce(p_detalhe->>'local', 'Não informado') || E'\n'
    || 'Setor: ' || coalesce(p_detalhe->>'setor', 'Não informado') || E'\n'
    || coalesce(nullif(p_encerramento, ''), 'Escolha outra data, outro turno ou outro preceptor.');
END;
$fn$;

-- ------------------------------------------------------------
-- 2) Função transacional de validação de conflito
--    Retorna NULL quando não há conflito.
--    p_ignorar_escala_id: a própria escala em edição/criação
--    (ignora o item que está sendo alterado).
--    p_minimo_escalas: 1 = basta outra escala (criação/edição);
--    2 = exige duas escalas ativas (presença sem escala conhecida).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_avaliar_conflito_escala(
  p_preceptor_id uuid,
  p_ignorar_escala_id uuid,
  p_data date,
  p_turno turno,
  p_minimo_escalas integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_qtd integer;
  v_detalhe jsonb;
  v_minimo integer := coalesce(p_minimo_escalas, 1);
BEGIN
  IF p_preceptor_id IS NULL OR p_data IS NULL OR p_turno IS NULL OR v_minimo < 1 THEN
    RETURN NULL;
  END IF;

  SELECT count(DISTINCT e.id)
  INTO v_qtd
  FROM public.escalas e
  JOIN public.escalas_itens ei ON ei.escala_id = e.id
  WHERE e.status = 'ativo'
    AND ei.data = p_data
    AND ei.turno = p_turno
    AND (p_ignorar_escala_id IS NULL OR e.id <> p_ignorar_escala_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.vinculos_internato vi
        WHERE vi.id = e.vinculo_internato_id AND vi.preceptor_id = p_preceptor_id
      )
      OR EXISTS (
        SELECT 1 FROM public.vinculos_adm va
        WHERE va.id = e.vinculo_adm_id AND va.preceptor_id = p_preceptor_id
      )
    );

  IF coalesce(v_qtd, 0) < v_minimo THEN
    RETURN NULL;
  END IF;

  -- Detalhes para a mensagem (somente campos de exibição; sem UUID)
  SELECT jsonb_build_object(
    'data', ei.data,
    'turno', ei.turno::text,
    'turno_label', CASE ei.turno
                     WHEN 'manha' THEN 'Manhã'
                     WHEN 'tarde' THEN 'Tarde'
                     ELSE 'Noite'
                   END,
    'atividade', coalesce(it.nome, di.nome, 'Não informada'),
    'local', coalesce(lo.nome, 'Não informado'),
    'setor', coalesce(se.nome, 'Não informado')
  )
  INTO v_detalhe
  FROM public.escalas e
  JOIN public.escalas_itens ei ON ei.escala_id = e.id
  LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
  LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
  LEFT JOIN public.internatos it ON it.id = vi.internato_id
  LEFT JOIN public.disciplinas di ON di.id = va.disciplina_id
  LEFT JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
  LEFT JOIN public.locais lo ON lo.id = vl.local_id
  LEFT JOIN public.setores se ON se.id = vl.setor_id
  WHERE e.status = 'ativo'
    AND ei.data = p_data
    AND ei.turno = p_turno
    AND (p_ignorar_escala_id IS NULL OR e.id <> p_ignorar_escala_id)
    AND (
      EXISTS (
        SELECT 1 FROM public.vinculos_internato v2
        WHERE v2.id = e.vinculo_internato_id AND v2.preceptor_id = p_preceptor_id
      )
      OR EXISTS (
        SELECT 1 FROM public.vinculos_adm v2
        WHERE v2.id = e.vinculo_adm_id AND v2.preceptor_id = p_preceptor_id
      )
    )
  ORDER BY e.created_at
  LIMIT 1;

  RETURN v_detalhe;
END;
$fn$;

-- ------------------------------------------------------------
-- 3) RPC: validação de um item (preceptor, vínculo, data, turno,
--    escala atual) — consultada pelo frontend antes de salvar
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_conflito_escala(
  p_data date,
  p_turno turno,
  p_vinculo_adm_id uuid DEFAULT NULL,
  p_vinculo_internato_id uuid DEFAULT NULL,
  p_preceptor_id uuid DEFAULT NULL,
  p_escala_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_preceptor uuid;
  v_detalhe jsonb;
BEGIN
  v_preceptor := coalesce(
    p_preceptor_id,
    (SELECT va.preceptor_id FROM public.vinculos_adm va WHERE va.id = p_vinculo_adm_id),
    (SELECT vi.preceptor_id FROM public.vinculos_internato vi WHERE vi.id = p_vinculo_internato_id)
  );

  v_detalhe := public.fn_avaliar_conflito_escala(v_preceptor, p_escala_id, p_data, p_turno, 1);

  IF v_detalhe IS NULL THEN
    RETURN jsonb_build_object('conflito', false, 'mensagem', NULL);
  END IF;

  RETURN jsonb_build_object(
    'conflito', true,
    'data', v_detalhe->>'data',
    'turno', v_detalhe->>'turno',
    'turno_label', v_detalhe->>'turno_label',
    'internato_disciplina', v_detalhe->>'atividade',
    'local', v_detalhe->>'local',
    'setor', v_detalhe->>'setor',
    'mensagem', public.fn_mensagem_conflito_escala(
                  v_detalhe,
                  'Conflito de horário',
                  'Escolha outra data, outro turno ou outro preceptor.')
  );
END;
$fn$;

-- ------------------------------------------------------------
-- 4) RPC: validação em lote (turnos/datas múltiplos) — bloqueia
--    o salvamento completo e informa o turno conflitante
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_conflito_escala_itens(
  p_itens jsonb,
  p_vinculo_adm_id uuid DEFAULT NULL,
  p_vinculo_internato_id uuid DEFAULT NULL,
  p_preceptor_id uuid DEFAULT NULL,
  p_escala_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_preceptor uuid;
  v_item jsonb;
  v_data date;
  v_turno turno;
  v_detalhe jsonb;
  v_conflitos jsonb := '[]'::jsonb;
  v_mensagens text[] := ARRAY[]::text[];
  v_turnos jsonb := '[]'::jsonb;
BEGIN
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RETURN jsonb_build_object('conflito', false, 'conflitos', '[]'::jsonb, 'turnos_conflitantes', '[]'::jsonb, 'mensagem', NULL);
  END IF;

  v_preceptor := coalesce(
    p_preceptor_id,
    (SELECT va.preceptor_id FROM public.vinculos_adm va WHERE va.id = p_vinculo_adm_id),
    (SELECT vi.preceptor_id FROM public.vinculos_internato vi WHERE vi.id = p_vinculo_internato_id)
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    -- Itens malformados são ignorados aqui: a validação existente
    -- de salvar_escala_completa continua responsável por eles.
    IF v_item IS NULL
       OR v_item->>'data' IS NULL
       OR v_item->>'turno' IS NULL
       OR v_item->>'data' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR v_item->>'turno' NOT IN ('manha', 'tarde', 'noite') THEN
      CONTINUE;
    END IF;

    v_data := (v_item->>'data')::date;
    v_turno := (v_item->>'turno')::public.turno;

    v_detalhe := public.fn_avaliar_conflito_escala(v_preceptor, p_escala_id, v_data, v_turno, 1);

    IF v_detalhe IS NOT NULL THEN
      IF NOT (v_conflitos @> jsonb_build_array(v_detalhe)) THEN
        v_conflitos := v_conflitos || jsonb_build_array(v_detalhe);
        v_mensagens := v_mensagens || public.fn_mensagem_conflito_escala(
                          v_detalhe,
                          'Conflito de horário',
                          'Escolha outra data, outro turno ou outro preceptor.');
        IF NOT (v_turnos @> jsonb_build_array(to_jsonb(v_detalhe->>'turno'))) THEN
          v_turnos := v_turnos || jsonb_build_array(to_jsonb(v_detalhe->>'turno'));
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF cardinality(v_mensagens) = 0 THEN
    RETURN jsonb_build_object('conflito', false, 'conflitos', '[]'::jsonb, 'turnos_conflitantes', '[]'::jsonb, 'mensagem', NULL);
  END IF;

  RETURN jsonb_build_object(
    'conflito', true,
    'conflitos', v_conflitos,
    'turnos_conflitantes', v_turnos,
    'mensagem', array_to_string(v_mensagens, E'\n\n')
  );
END;
$fn$;

-- ------------------------------------------------------------
-- 5) Trigger: itens de escala (criação, edição, nova data,
--    mudança de turno) — escala inativa não bloqueia
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_bloquear_conflito_escala_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_preceptor uuid;
  v_ativa boolean;
  v_detalhe jsonb;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.escala_id IS NOT DISTINCT FROM OLD.escala_id
     AND NEW.data IS NOT DISTINCT FROM OLD.data
     AND NEW.turno IS NOT DISTINCT FROM OLD.turno THEN
    RETURN NEW;
  END IF;

  SELECT
    coalesce(va.preceptor_id, vi.preceptor_id),
    (e.status = 'ativo')
  INTO v_preceptor, v_ativa
  FROM public.escalas e
  LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
  LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
  WHERE e.id = NEW.escala_id;

  -- Escala inativa (ou inexistente) não bloqueia a inclusão do item
  IF v_preceptor IS NULL OR coalesce(v_ativa, false) = false THEN
    RETURN NEW;
  END IF;

  v_detalhe := public.fn_avaliar_conflito_escala(v_preceptor, NEW.escala_id, NEW.data, NEW.turno, 1);

  IF v_detalhe IS NOT NULL THEN
    RAISE EXCEPTION '%', public.fn_mensagem_conflito_escala(
                           v_detalhe,
                           'Conflito de horário',
                           'Escolha outra data, outro turno ou outro preceptor.');
  END IF;

  RETURN NEW;
END;
$fn$;

-- ------------------------------------------------------------
-- 6) Trigger: reativação de escala e troca de vínculo
--    (inativar/cancelar nunca é bloqueado)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_bloquear_conflito_escala_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_preceptor uuid;
  v_item record;
  v_detalhe jsonb;
BEGIN
  -- Somente interessa quando a escala vai ficar (ou continuar) ativa
  IF NEW.status IS DISTINCT FROM 'ativo' THEN
    RETURN NEW;
  END IF;

  -- Escala já ativa e vínculo inalterado: nada a validar
  IF OLD.status = 'ativo'
     AND NEW.vinculo_adm_id IS NOT DISTINCT FROM OLD.vinculo_adm_id
     AND NEW.vinculo_internato_id IS NOT DISTINCT FROM OLD.vinculo_internato_id THEN
    RETURN NEW;
  END IF;

  v_preceptor := coalesce(
    (SELECT va.preceptor_id FROM public.vinculos_adm va WHERE va.id = NEW.vinculo_adm_id),
    (SELECT vi.preceptor_id FROM public.vinculos_internato vi WHERE vi.id = NEW.vinculo_internato_id)
  );

  IF v_preceptor IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_item IN SELECT data, turno FROM public.escalas_itens WHERE escala_id = NEW.id LOOP
    v_detalhe := public.fn_avaliar_conflito_escala(v_preceptor, NEW.id, v_item.data, v_item.turno, 1);
    IF v_detalhe IS NOT NULL THEN
      RAISE EXCEPTION '%', public.fn_mensagem_conflito_escala(
                             v_detalhe,
                             'Conflito de horário',
                             'Escolha outra data, outro turno ou outro preceptor.');
    END IF;
  END LOOP;

  RETURN NEW;
END;
$fn$;

-- ------------------------------------------------------------
-- 7) Trigger: registro de presença — não confirma presença quando
--    existem escalas conflitantes (não altera presenças antigas)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_bloquear_conflito_presenca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_detalhe jsonb;
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  IF NEW.preceptor_id IS NULL OR NEW.data_presenca IS NULL OR NEW.turno IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.escala_id IS NOT NULL THEN
    -- Existe OUTRA escala ativa do mesmo preceptor na mesma data/turno?
    v_detalhe := public.fn_avaliar_conflito_escala(NEW.preceptor_id, NEW.escala_id, NEW.data_presenca, NEW.turno, 1);
  ELSE
    -- Sem escala vinculada: só há conflito com duas escalas ativas
    v_detalhe := public.fn_avaliar_conflito_escala(NEW.preceptor_id, NULL, NEW.data_presenca, NEW.turno, 2);
  END IF;

  IF v_detalhe IS NOT NULL THEN
    RAISE EXCEPTION '%', public.fn_mensagem_conflito_escala(
                           v_detalhe,
                           'Conflito de escala',
                           'Não foi possível registrar a presença. Procure o Administrador para corrigir o vínculo incorreto.');
  END IF;

  RETURN NEW;
END;
$fn$;

-- ------------------------------------------------------------
-- 8) Criação das triggers
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_escalas_itens_conflito ON public.escalas_itens;
CREATE TRIGGER trg_escalas_itens_conflito
  BEFORE INSERT OR UPDATE OF data, turno, escala_id
  ON public.escalas_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_conflito_escala_item();

DROP TRIGGER IF EXISTS trg_escalas_conflito ON public.escalas;
CREATE TRIGGER trg_escalas_conflito
  BEFORE UPDATE
  ON public.escalas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_conflito_escala_status();

DROP TRIGGER IF EXISTS trg_presencas_conflito ON public.presencas;
CREATE TRIGGER trg_presencas_conflito
  BEFORE INSERT
  ON public.presencas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bloquear_conflito_presenca();

-- ------------------------------------------------------------
-- 9) salvar_escala_completa: validação por PRECEPTOR antes de
--    gravar (cobertura Admin e Coordenador, com ou sem frontend)
-- ------------------------------------------------------------
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
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_escala_id UUID;
  v_item JSONB;
  v_data DATE;
  v_preceptor UUID;
  v_conflito JSONB;
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

  -- Validar vigencia dos itens e CONFLITO POR PRECEPTOR
  -- (mesma data + mesmo turno em outra escala ativa, qualquer
  --  vínculo/internato/disciplina/unidade/local/setor)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_data := (v_item->>'data')::date;
    IF v_data < p_data_inicio OR (p_data_fim IS NOT NULL AND v_data > p_data_fim) THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Item de escala fora da vigencia informada.');
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

  -- Inserir itens (data + turno)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    INSERT INTO public.escalas_itens (escala_id, data, turno)
    VALUES (
      v_escala_id,
      (v_item->>'data')::date,
      (v_item->>'turno')::public.turno
    );
  END LOOP;

  RETURN jsonb_build_object('sucesso', true, 'escala_id', v_escala_id);
END;
$fn$;

-- ------------------------------------------------------------
-- 10) registrar_presenca_coordenador: valida TODOS os turnos
--     antes de gravar qualquer presença (sem salvamento parcial)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_presenca_coordenador(
  p_escala_id uuid,
  p_preceptor_id uuid,
  p_data date,
  p_turnos jsonb,
  p_registrado_por uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tipo_atuacao public.tipo_atuacao;
  v_vinculo_adm_id uuid;
  v_vinculo_internato_id uuid;
  v_vinculo_local_id uuid;
  v_local_id uuid;
  v_setor_id uuid;
  v_registrado_por uuid;
  v_turno_text text;
  v_turno public.turno;
  v_vinculo_ok boolean;
  v_exists boolean;
  v_inseridos int := 0;
  v_duplicados int := 0;
  v_conflito jsonb;
BEGIN
  IF p_escala_id IS NULL OR p_preceptor_id IS NULL OR p_data IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Parametros obrigatorios ausentes.');
  END IF;

  IF p_turnos IS NULL OR jsonb_array_length(p_turnos) = 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Selecione pelo menos um turno.');
  END IF;

  SELECT id INTO v_registrado_por FROM public.profiles WHERE id = p_registrado_por LIMIT 1;
  IF v_registrado_por IS NULL THEN
    SELECT id INTO v_registrado_por FROM public.profiles LIMIT 1;
  END IF;

  SELECT tipo_atuacao, vinculo_adm_id, vinculo_internato_id, vinculo_local_id
  INTO v_tipo_atuacao, v_vinculo_adm_id, v_vinculo_internato_id, v_vinculo_local_id
  FROM public.escalas WHERE id = p_escala_id;

  IF v_vinculo_local_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao encontrada.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.escalas e
    WHERE e.id = p_escala_id AND e.status = 'ativo'
      AND e.data_inicio <= p_data
      AND coalesce(e.data_fim, '9999-12-31'::date) >= p_data
      AND EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id
          AND (ei.data = p_data OR ei.dia_semana = EXTRACT(DOW FROM p_data)::smallint)
      )
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala inativa ou sem vigencia na data informada.');
  END IF;

  v_vinculo_ok := false;
  IF v_tipo_atuacao = 'internato' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = v_vinculo_internato_id AND vi.status = 'ativo'
        AND vi.preceptor_id = p_preceptor_id
        AND coalesce(vi.data_inicio, '1900-01-01'::date) <= p_data
        AND coalesce(vi.data_fim, '9999-12-31'::date) >= p_data
    ) INTO v_vinculo_ok;
    IF NOT v_vinculo_ok THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo de Internato inativo ou sem vigencia na data.');
    END IF;
  ELSIF v_tipo_atuacao = 'adm' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.vinculos_adm va
      WHERE va.id = v_vinculo_adm_id AND va.status = 'ativo'
        AND va.preceptor_id = p_preceptor_id
        AND coalesce(va.data_inicio, '1900-01-01'::date) <= p_data
        AND coalesce(va.data_fim, '9999-12-31'::date) >= p_data
    ) INTO v_vinculo_ok;
    IF NOT v_vinculo_ok THEN
      RETURN jsonb_build_object('sucesso', false, 'erro', 'Vinculo de Pratica inativo ou sem vigencia na data.');
    END IF;
  END IF;

  -- Segurança: presença não é confirmada quando existem escalas
  -- conflitantes para o mesmo preceptor, data e turno.
  -- Todos os turnos são validados ANTES de gravar qualquer linha.
  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos) LOOP
    v_turno := v_turno_text::public.turno;
    v_conflito := public.fn_avaliar_conflito_escala(p_preceptor_id, p_escala_id, p_data, v_turno, 1);
    IF v_conflito IS NOT NULL THEN
      RETURN jsonb_build_object(
        'sucesso', false,
        'conflito_escala', true,
        'erro', public.fn_mensagem_conflito_escala(
                  v_conflito,
                  'Conflito de escala',
                  'Não foi possível registrar a presença. Procure o Administrador para corrigir o vínculo incorreto.')
      );
    END IF;
  END LOOP;

  SELECT local_id, setor_id INTO v_local_id, v_setor_id
  FROM public.vinculo_locais WHERE id = v_vinculo_local_id;

  FOR v_turno_text IN SELECT jsonb_array_elements_text(p_turnos) LOOP
    v_turno := v_turno_text::public.turno;

    -- Bloqueio por vinculo+data+turno (nao por escala)
    SELECT EXISTS (
      SELECT 1 FROM public.presencas
      WHERE preceptor_id = p_preceptor_id
        AND data_presenca = p_data AND turno = v_turno
        AND status != 'cancelada'
        AND (
          (v_tipo_atuacao = 'internato' AND vinculo_internato_id = v_vinculo_internato_id)
          OR (v_tipo_atuacao = 'adm' AND vinculo_adm_id = v_vinculo_adm_id)
        )
    ) INTO v_exists;

    IF v_exists THEN
      v_duplicados := v_duplicados + 1;
    ELSE
      INSERT INTO public.presencas (
        preceptor_id, escala_id, tipo_atuacao, vinculo_adm_id, vinculo_internato_id,
        local_id, setor_id, data_presenca, turno, status, origem, registrado_por, registrado_em
      ) VALUES (
        p_preceptor_id, p_escala_id, v_tipo_atuacao, v_vinculo_adm_id, v_vinculo_internato_id,
        v_local_id, v_setor_id, p_data, v_turno, 'confirmada', 'coordenador', v_registrado_por, now()
      );
      v_inseridos := v_inseridos + 1;
    END IF;
  END LOOP;

  IF v_inseridos = 0 AND v_duplicados > 0 THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada anteriormente para este(s) turno(s).');
  END IF;

  RETURN jsonb_build_object('sucesso', true, 'inseridos', v_inseridos, 'duplicados', v_duplicados);
END;
$fn$;

-- ------------------------------------------------------------
-- 11) registrar_presenca_token (rota legada /p/:token)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_presenca_token(
  p_token text,
  p_escala_id uuid,
  p_turno turno
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
  v_escala public.escalas%rowtype;
  v_escala_item public.escalas_itens%rowtype;
  v_local public.vinculo_locais%rowtype;
  v_id uuid;
  v_registrado_por uuid;
  v_conflito jsonb;
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

  SELECT * INTO v_escala_item
  FROM public.escalas_itens
  WHERE escala_id = p_escala_id AND turno = p_turno AND dia_semana = extract(dow from current_date)::smallint;

  IF v_escala_item.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao possui turno para o dia atual.');
  END IF;

  IF extract(dow from current_date)::smallint <> v_escala_item.dia_semana THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
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

  -- Segurança: presença não confirmada com escalas conflitantes
  v_conflito := public.fn_avaliar_conflito_escala(v_preceptor.id, v_escala.id, current_date, p_turno, 1);
  IF v_conflito IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'conflito_escala', true,
      'erro', public.fn_mensagem_conflito_escala(
                v_conflito,
                'Conflito de escala',
                'Não foi possível registrar a presença. Procure o Administrador para corrigir o vínculo incorreto.')
    );
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
$fn$;

-- ------------------------------------------------------------
-- 12) Privilégios
--     - Funções internas/trigger não ficam chamáveis via RPC;
--     - RPCs de validação ficam disponíveis para o app logado.
--     Nenhuma policy/RLS é alterada.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_mensagem_conflito_escala(jsonb, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_mensagem_conflito_escala(jsonb, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_mensagem_conflito_escala(jsonb, text, text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_avaliar_conflito_escala(uuid, uuid, date, turno, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_avaliar_conflito_escala(uuid, uuid, date, turno, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_avaliar_conflito_escala(uuid, uuid, date, turno, integer) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_escala_item() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_escala_item() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_escala_item() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_escala_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_escala_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_escala_status() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_presenca() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_presenca() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_bloquear_conflito_presenca() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.validar_conflito_escala(date, turno, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_conflito_escala(date, turno, uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validar_conflito_escala(date, turno, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_conflito_escala(date, turno, uuid, uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.validar_conflito_escala_itens(jsonb, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_conflito_escala_itens(jsonb, uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validar_conflito_escala_itens(jsonb, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_conflito_escala_itens(jsonb, uuid, uuid, uuid, uuid) TO service_role;

COMMIT;
