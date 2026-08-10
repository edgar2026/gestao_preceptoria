-- 033_dashboard_preceptoria_internato.sql
-- DASHBOARD E RELATÓRIOS (Internato) + ajuste de papéis administrativos
-- 1. Amplia a lista de papéis administrativos nas RPCs criadas nas migrações 030/031
--    e nas políticas RLS das tabelas de nota fiscal, incluindo as variantes de
--    administrador existentes (admin_super, super_admin, admin).
-- 2. Cria a RPC segura dashboard_preceptoria_internato com filtros opcionais por
--    competência, período, unidade, Internato, local, setor, preceptor, status do
--    chamado, situação da nota e pagamento.
-- 3. Retorna dados consolidados e detalhados, sem dados de Prática.

-- =====================================================================
-- 1. PAPÉIS ADMINISTRATIVOS: has_role ampliado nas RPCs 030/031
-- =====================================================================
CREATE OR REPLACE FUNCTION public.corrigir_presenca_administrativa(
  p_presenca_id UUID,
  p_nova_data DATE,
  p_novo_turno PUBLIC.turno,
  p_justificativa TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_presenca public.presencas%ROWTYPE;
  v_profile_id UUID;
  v_ajuste_id UUID;
  v_competencia_antiga TEXT;
  v_competencia_nova TEXT;
  v_mes_antigo INT;
  v_ano_antigo INT;
  v_mes_novo INT;
  v_ano_novo INT;
  v_calculo_id UUID;
  v_msg TEXT;
  v_revisao BOOLEAN := false;
BEGIN
  -- Somente Administrativo (administrador/academico) ou Financeiro autorizado
  IF NOT public.has_role(array[
    'administrador'::public.app_role, 'academico'::public.app_role, 'financeiro'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_presenca_id IS NULL OR p_nova_data IS NULL OR p_novo_turno IS NULL THEN
    RAISE EXCEPTION 'Parametros obrigatorios ausentes.';
  END IF;

  IF length(trim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Justificativa deve ter pelo menos 10 caracteres.';
  END IF;

  IF p_nova_data > current_date THEN
    RAISE EXCEPTION 'Nao e permitido corrigir presenca para data futura.';
  END IF;

  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado nao identificado.';
  END IF;

  -- Validar presença (transação única: tudo ou nada)
  SELECT * INTO v_presenca
  FROM public.presencas
  WHERE id = p_presenca_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presenca nao encontrada.';
  END IF;

  IF v_presenca.status = 'cancelada' THEN
    RAISE EXCEPTION 'Presenca cancelada nao pode ser corrigida.';
  END IF;

  -- Validar vínculo ativo e vigente na nova data
  IF v_presenca.tipo_atuacao = 'internato' THEN
    IF v_presenca.vinculo_internato_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = v_presenca.vinculo_internato_id
        AND vi.status = 'ativo'
        AND coalesce(vi.data_inicio, '1900-01-01'::date) <= p_nova_data
        AND coalesce(vi.data_fim, '9999-12-31'::date) >= p_nova_data
    ) THEN
      RAISE EXCEPTION 'Vinculo de Internato inativo ou sem vigencia na nova data.';
    END IF;
  ELSIF v_presenca.vinculo_adm_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vinculos_adm va
      WHERE va.id = v_presenca.vinculo_adm_id
        AND va.status = 'ativo'
        AND coalesce(va.data_inicio, '1900-01-01'::date) <= p_nova_data
        AND coalesce(va.data_fim, '9999-12-31'::date) >= p_nova_data
    ) THEN
      RAISE EXCEPTION 'Vinculo de Pratica inativo ou sem vigencia na nova data.';
    END IF;
  END IF;

  -- Bloquear duplicidade: mesmo vínculo/escala + preceptor + data + turno
  IF EXISTS (
    SELECT 1 FROM public.presencas p
    WHERE p.id <> p_presenca_id
      AND p.preceptor_id = v_presenca.preceptor_id
      AND p.data_presenca = p_nova_data
      AND p.turno = p_novo_turno
      AND p.status <> 'cancelada'
      AND (
        p.escala_id IS NOT DISTINCT FROM v_presenca.escala_id
        OR (p.local_id = v_presenca.local_id AND p.tipo_atuacao = v_presenca.tipo_atuacao)
      )
  ) THEN
    RAISE EXCEPTION 'Ja existe presenca registrada para este preceptor, data e turno no mesmo vinculo.';
  END IF;

  -- Competências afetadas
  v_competencia_antiga := to_char(v_presenca.data_presenca, 'YYYY-MM');
  v_competencia_nova  := to_char(p_nova_data, 'YYYY-MM');
  v_mes_antigo := EXTRACT(MONTH FROM v_presenca.data_presenca)::INT;
  v_ano_antigo := EXTRACT(YEAR FROM v_presenca.data_presenca)::INT;
  v_mes_novo   := EXTRACT(MONTH FROM p_nova_data)::INT;
  v_ano_novo   := EXTRACT(YEAR FROM p_nova_data)::INT;

  -- Gravar ajuste com antes/depois, usuário e data (histórico nunca é apagado)
  INSERT INTO public.ajustes_presenca (
    presenca_id,
    preceptor_id,
    tipo_ajuste,
    dados_anteriores,
    dados_novos,
    justificativa,
    realizado_por,
    realizado_em
  ) VALUES (
    p_presenca_id,
    v_presenca.preceptor_id,
    'alteracao',
    jsonb_build_object(
      'data_presenca', v_presenca.data_presenca,
      'turno', v_presenca.turno,
      'status', v_presenca.status,
      'escala_id', v_presenca.escala_id,
      'tipo_atuacao', v_presenca.tipo_atuacao,
      'vinculo_adm_id', v_presenca.vinculo_adm_id,
      'vinculo_internato_id', v_presenca.vinculo_internato_id,
      'local_id', v_presenca.local_id,
      'setor_id', v_presenca.setor_id,
      'registrado_por', v_presenca.registrado_por
    ),
    jsonb_build_object(
      'data_presenca', p_nova_data,
      'turno', p_novo_turno,
      'status', 'confirmada',
      'escala_id', v_presenca.escala_id,
      'tipo_atuacao', v_presenca.tipo_atuacao,
      'vinculo_adm_id', v_presenca.vinculo_adm_id,
      'vinculo_internato_id', v_presenca.vinculo_internato_id,
      'local_id', v_presenca.local_id,
      'setor_id', v_presenca.setor_id,
      'registrado_por', v_presenca.registrado_por
    ),
    p_justificativa,
    v_profile_id,
    now()
  ) RETURNING id INTO v_ajuste_id;

  -- Atualizar a presença sem apagar o histórico (status permanece confirmada,
  -- pois a presença realmente trabalhada continua sendo fonte do cálculo)
  UPDATE public.presencas SET
    data_presenca = p_nova_data,
    turno = p_novo_turno,
    status = 'confirmada',
    observacoes = coalesce(
      observacoes,
      ''
    ) || coalesce(
      E'\n[Correcao ' || v_ajuste_id::text || '] ' || p_justificativa,
      ''
    ),
    updated_at = now()
  WHERE id = p_presenca_id;

  -- Chamado aberto/processado: preservar dados e marcar revisão financeira
  FOR v_calculo_id IN
    SELECT c.id
    FROM public.calculos c
    JOIN public.competencias co ON co.id = c.competencia_id
    WHERE c.preceptor_id = v_presenca.preceptor_id
      AND c.chamado_status IS DISTINCT FROM 'nao_aberto'
      AND to_char(make_date(co.ano, co.mes, 1), 'YYYY-MM') IN (v_competencia_antiga, v_competencia_nova)
      AND (
        (v_presenca.tipo_atuacao = 'adm' AND coalesce(c.vinculo_adm_id::text, '') = coalesce(v_presenca.vinculo_adm_id::text, ''))
        OR
        (v_presenca.tipo_atuacao = 'internato' AND coalesce(c.vinculo_internato_id::text, '') = coalesce(v_presenca.vinculo_internato_id::text, ''))
      )
  LOOP
    v_msg := 'Correcao administrativa de presenca (ajuste ' || v_ajuste_id::text || ') - revisao financeira necessaria.';
    v_revisao := true;

    -- Preserva os dados do chamado e anexa a observação de revisão
    UPDATE public.calculos SET
      chamado_observacao = CASE
        WHEN chamado_observacao IS NULL OR chamado_observacao = '' THEN v_msg
        ELSE chamado_observacao || E'\n' || v_msg
      END,
      chamado_updated_at = now(),
      chamado_updated_by = v_profile_id,
      updated_at = now()
    WHERE id = v_calculo_id;

    -- Marca revisão financeira na fila de validações
    IF EXISTS (
      SELECT 1 FROM public.aprovacoes a
      WHERE a.calculo_id = v_calculo_id AND a.tipo = 'financeira' AND a.status = 'pendente'
    ) THEN
      UPDATE public.aprovacoes SET
        comentario = v_msg,
        decidido_por = NULL,
        decidido_em = NULL,
        responsavel_profile_id = v_profile_id
      WHERE calculo_id = v_calculo_id AND tipo = 'financeira' AND status = 'pendente';
    ELSE
      INSERT INTO public.aprovacoes (
        calculo_id, tipo, ordem, status,
        responsavel_profile_id, comentario
      ) VALUES (
        v_calculo_id, 'financeira', 1, 'pendente',
        v_profile_id, v_msg
      );
    END IF;
  END LOOP;

  -- Recalcular somente o preceptor, vínculo e competências afetadas.
  -- Sempre recalcula a competência de origem; se o mês mudou, recalcula também a nova.
  PERFORM public.auto_apurar_preceptor_financeiro(
    v_mes_antigo, v_ano_antigo,
    v_presenca.preceptor_id,
    v_presenca.vinculo_adm_id,
    v_presenca.vinculo_internato_id
  );
  IF v_competencia_antiga <> v_competencia_nova THEN
    PERFORM public.auto_apurar_preceptor_financeiro(
      v_mes_novo, v_ano_novo,
      v_presenca.preceptor_id,
      v_presenca.vinculo_adm_id,
      v_presenca.vinculo_internato_id
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'presenca_id', p_presenca_id,
    'ajuste_id', v_ajuste_id,
    'revisao_financeira', v_revisao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.corrigir_presenca_administrativa(UUID, DATE, PUBLIC.turno, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_solicitacao_nota_fiscal(
  p_calculo_id UUID,
  p_situacao TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_calculo public.calculos%ROWTYPE;
  v_competencia_ano INT;
  v_competencia_mes INT;
  v_preceptor_nome TEXT;
  v_preceptor_email TEXT;
  v_profile_id UUID;
  v_atual public.situacao_nota_fiscal;
  v_nova public.situacao_nota_fiscal;
  v_ok BOOLEAN;
  v_solicitacao_id UUID;
  v_competencia_label TEXT;
  v_assunto TEXT;
  v_corpo TEXT;
  v_demonstrativo TEXT;
BEGIN
  -- Somente Administrativo ou Financeiro autorizado
  IF NOT public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_calculo_id IS NULL OR p_situacao IS NULL OR trim(p_situacao) = '' THEN
    RAISE EXCEPTION 'Parametros obrigatorios ausentes.';
  END IF;

  BEGIN
    v_nova := p_situacao::public.situacao_nota_fiscal;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Situacao de nota fiscal invalida.';
  END;

  v_profile_id := public.current_profile_id();

  -- Validar cálculo de Internato
  SELECT c.* INTO v_calculo
  FROM public.calculos c
  WHERE c.id = p_calculo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Calculo nao encontrado.';
  END IF;

  IF v_calculo.tipo_atuacao IS DISTINCT FROM 'internato' THEN
    RAISE EXCEPTION 'Solicitacao de nota fiscal somente para calculos de Internato.';
  END IF;

  SELECT co.ano, co.mes INTO v_competencia_ano, v_competencia_mes
  FROM public.competencias co
  WHERE co.id = v_calculo.competencia_id;

  SELECT p.nome_completo, p.email INTO v_preceptor_nome, v_preceptor_email
  FROM public.preceptores p
  WHERE p.id = v_calculo.preceptor_id;

  -- Situação atual (pode não existir ainda)
  SELECT s.situacao, s.id INTO v_atual, v_solicitacao_id
  FROM public.solicitacoes_nota_fiscal s
  WHERE s.calculo_id = p_calculo_id;

  IF NOT FOUND THEN
    v_atual := 'nao_solicitada';
  END IF;

  -- Mesma situação: operação idempotente (upsert sem duplicar por cálculo)
  IF v_atual = v_nova THEN
    RETURN jsonb_build_object('sucesso', true, 'id', v_solicitacao_id, 'calculo_id', p_calculo_id, 'situacao', v_nova, 'alterado', false);
  END IF;

  -- Validação de transições de estado
  v_ok := false;
  CASE v_atual
    WHEN 'nao_solicitada' THEN v_ok := v_nova IN ('preparada', 'solicitada', 'cancelado');
    WHEN 'preparada'     THEN v_ok := v_nova IN ('solicitada', 'cancelado');
    WHEN 'solicitada'    THEN v_ok := v_nova IN ('nota_recebida', 'cancelado');
    WHEN 'nota_recebida' THEN v_ok := v_nova IN ('em_pagamento', 'pago', 'cancelado');
    WHEN 'em_pagamento'  THEN v_ok := v_nova IN ('pago', 'cancelado');
    ELSE v_ok := false;
  END CASE;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transicao de situacao invalida: % -> %', v_atual, v_nova;
  END IF;

  v_competencia_label := to_char(make_date(v_competencia_ano, v_competencia_mes, 1), 'YYYY-MM');
  v_assunto := 'Solicitacao de nota fiscal - ' || coalesce(v_preceptor_nome, 'Preceptor') || ' - ' || v_competencia_label;
  v_corpo := 'Ola, ' || coalesce(v_preceptor_nome, 'Preceptor') || '.' || E'\n\n'
          || 'Solicitamos o envio da nota fiscal referente aos servicos de preceptoria prestados na competencia ' || v_competencia_label || '.' || E'\n\n'
          || 'O demonstrativo detalhado foi anexado. Por favor, encaminhe a nota fiscal conforme as orientacoes institucionais.' || E'\n\nAtenciosamente,';
  v_demonstrativo := 'demonstrativo-' || lower(regexp_replace(coalesce(v_preceptor_nome, 'preceptor'), '\s+', '-', 'g')) || '-' || v_competencia_label || '.pdf';

  -- Upsert: nunca duplicar por cálculo. Nunca envia e-mail automaticamente.
  INSERT INTO public.solicitacoes_nota_fiscal (
    calculo_id, preceptor_id, competencia, email_usado, situacao,
    assunto, corpo, demonstrativo_nome,
    preparado_por, preparado_em,
    enviado_por, enviado_em,
    nota_recebida_em, observacao
  ) VALUES (
    p_calculo_id, v_calculo.preceptor_id, v_competencia_label, v_preceptor_email, v_nova,
    v_assunto, v_corpo, v_demonstrativo,
    CASE WHEN v_nova = 'preparada' THEN v_profile_id ELSE NULL END,
    CASE WHEN v_nova = 'preparada' THEN now() ELSE NULL END,
    CASE WHEN v_nova = 'solicitada' THEN v_profile_id ELSE NULL END,
    CASE WHEN v_nova = 'solicitada' THEN now() ELSE NULL END,
    CASE WHEN v_nova = 'nota_recebida' THEN now() ELSE NULL END,
    NULL
  )
  ON CONFLICT (calculo_id) DO UPDATE SET
    situacao = excluded.situacao,
    email_usado = excluded.email_usado,
    preparado_por = CASE WHEN excluded.situacao = 'preparada' AND solicitacoes_nota_fiscal.preparado_em IS NULL THEN excluded.preparado_por ELSE solicitacoes_nota_fiscal.preparado_por END,
    preparado_em = CASE WHEN excluded.situacao = 'preparada' AND solicitacoes_nota_fiscal.preparado_em IS NULL THEN excluded.preparado_em ELSE solicitacoes_nota_fiscal.preparado_em END,
    enviado_por = CASE WHEN excluded.situacao = 'solicitada' AND solicitacoes_nota_fiscal.enviado_em IS NULL THEN excluded.enviado_por ELSE solicitacoes_nota_fiscal.enviado_por END,
    enviado_em = CASE WHEN excluded.situacao = 'solicitada' AND solicitacoes_nota_fiscal.enviado_em IS NULL THEN excluded.enviado_em ELSE solicitacoes_nota_fiscal.enviado_em END,
    nota_recebida_em = CASE WHEN excluded.situacao = 'nota_recebida' AND solicitacoes_nota_fiscal.nota_recebida_em IS NULL THEN excluded.nota_recebida_em ELSE solicitacoes_nota_fiscal.nota_recebida_em END,
    updated_at = now()
  RETURNING id INTO v_solicitacao_id;

  -- Histórico de eventos/auditoria
  INSERT INTO public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, calculo_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, detalhes
  ) VALUES (
    v_solicitacao_id, p_calculo_id, v_atual, v_nova,
    v_profile_id, now(),
    jsonb_build_object(
      'preceptor_id', v_calculo.preceptor_id,
      'competencia', v_competencia_label,
      'email_usado', v_preceptor_email,
      'origem', 'rpc'
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'id', v_solicitacao_id,
    'calculo_id', p_calculo_id,
    'situacao', v_nova,
    'alterado', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_solicitacao_nota_fiscal(UUID, TEXT) TO authenticated;

-- =====================================================================
-- 2. POLÍTICAS RLS ATUALIZADAS (incluem variantes de administrador)
-- =====================================================================
DROP POLICY IF EXISTS solicitacoes_nota_read ON public.solicitacoes_nota_fiscal;
CREATE POLICY solicitacoes_nota_read ON public.solicitacoes_nota_fiscal
  FOR SELECT TO authenticated
  USING (public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'auditor'::public.app_role, 'coordenador'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]));

DROP POLICY IF EXISTS solicitacoes_nota_write ON public.solicitacoes_nota_fiscal;
CREATE POLICY solicitacoes_nota_write ON public.solicitacoes_nota_fiscal
  FOR ALL TO authenticated
  USING (public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]))
  WITH CHECK (public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]));

DROP POLICY IF EXISTS solicitacao_nota_eventos_read ON public.solicitacao_nota_fiscal_eventos;
CREATE POLICY solicitacao_nota_eventos_read ON public.solicitacao_nota_fiscal_eventos
  FOR SELECT TO authenticated
  USING (public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'auditor'::public.app_role, 'coordenador'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]));

DROP POLICY IF EXISTS solicitacao_nota_eventos_write ON public.solicitacao_nota_fiscal_eventos;
CREATE POLICY solicitacao_nota_eventos_write ON public.solicitacao_nota_fiscal_eventos
  FOR ALL TO authenticated
  USING (public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]))
  WITH CHECK (public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]));

-- =====================================================================
-- 3. DASHBOARD E RELATÓRIOS DO INTERNATO (RPC SEGURA)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.dashboard_preceptoria_internato(
  p_competencia_id uuid DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_unidade_id uuid DEFAULT NULL,
  p_internato_id uuid DEFAULT NULL,
  p_local_id uuid DEFAULT NULL,
  p_setor_id uuid DEFAULT NULL,
  p_preceptor_id uuid DEFAULT NULL,
  p_chamado_status text DEFAULT NULL,
  p_situacao_nota text DEFAULT NULL,
  p_pagamento_status text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_detalhes jsonb;
  v_resumo jsonb;
  v_chamados jsonb;
  v_por_internato jsonb;
  v_por_unidade jsonb;
  v_por_local jsonb;
  v_por_preceptor jsonb;
  v_pendencias jsonb;
  v_preceptores_ativos int;
  v_escalas_ativas int;
BEGIN
  -- Painel administrativo: Administrativo, Financeiro, Acadêmico ou Auditor (leitura)
  IF NOT public.has_role(array[
    'administrador'::public.app_role, 'financeiro'::public.app_role,
    'academico'::public.app_role, 'auditor'::public.app_role,
    'admin_super'::public.app_role, 'super_admin'::public.app_role, 'admin'::public.app_role
  ]) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Base: cálculos de Internato somente (sem dados de Prática/ADM)
  WITH base AS (
    SELECT c.id AS calculo_id,
           c.preceptor_id, c.vinculo_internato_id, c.competencia_id,
           co.ano, co.mes, co.data_inicio, co.data_fim,
           c.total_bruto, c.total_descontos, c.total_liquido,
           c.status AS calculo_status, c.versao, c.calculado_em, c.quantidade_presencas,
           c.chamado_numero, c.chamado_status, c.chamado_observacao,
           p.nome_completo, p.email,
           vi.unidade_id, vi.internato_id, vi.local_id, vi.setor_id,
           s.id AS solicitacao_id, s.situacao AS nota_situacao,
           s.email_usado, s.observacao AS nota_observacao,
           s.preparado_em, s.enviado_em, s.nota_recebida_em,
           EXISTS (
             SELECT 1 FROM public.aprovacoes a
             WHERE a.calculo_id = c.id AND a.tipo = 'financeira' AND a.status = 'pendente'
           ) AS revisao_pendente
    FROM public.calculos c
    JOIN public.competencias co ON co.id = c.competencia_id
    JOIN public.preceptores p ON p.id = c.preceptor_id
    JOIN public.vinculos_internato vi ON vi.id = c.vinculo_internato_id
    LEFT JOIN public.solicitacoes_nota_fiscal s ON s.calculo_id = c.id
    WHERE c.tipo_atuacao = 'internato'
      AND (p_competencia_id IS NULL OR c.competencia_id = p_competencia_id)
      AND (p_mes IS NULL OR co.mes = p_mes)
      AND (p_ano IS NULL OR co.ano = p_ano)
      AND (p_data_inicio IS NULL OR co.data_inicio >= p_data_inicio)
      AND (p_data_fim IS NULL OR co.data_fim <= p_data_fim)
      AND (p_unidade_id IS NULL OR vi.unidade_id = p_unidade_id)
      AND (p_internato_id IS NULL OR vi.internato_id = p_internato_id)
      AND (p_local_id IS NULL OR vi.local_id = p_local_id)
      AND (p_setor_id IS NULL OR vi.setor_id = p_setor_id)
      AND (p_preceptor_id IS NULL OR c.preceptor_id = p_preceptor_id)
      AND (p_chamado_status IS NULL OR c.chamado_status::text = p_chamado_status)
      AND (
        p_situacao_nota IS NULL
        OR (p_situacao_nota = 'nao_solicitada'
            AND (s.situacao IS NULL OR s.situacao::text = 'nao_solicitada'))
        OR (p_situacao_nota <> 'nao_solicitada' AND s.situacao::text = p_situacao_nota)
      )
      AND (
        p_pagamento_status IS NULL
        OR (p_pagamento_status = 'pago' AND s.situacao::text = 'pago')
        OR (p_pagamento_status = 'pendente'
            AND coalesce(s.situacao::text, 'nao_solicitada') <> 'pago')
      )
  ),
  -- Presenças confirmadas por (preceptor, vínculo, competência). Presença
  -- cancelada NÃO entra no cálculo nem nos totais.
  presencas AS (
    SELECT pr.preceptor_id, pr.vinculo_internato_id, co.id AS competencia_id,
           count(DISTINCT pr.id) AS total_confirmadas,
           count(DISTINCT pr.id) FILTER (WHERE pr.turno = 'manha') AS manha,
           count(DISTINCT pr.id) FILTER (WHERE pr.turno = 'tarde') AS tarde,
           count(DISTINCT pr.id) FILTER (WHERE pr.turno = 'noite') AS noite,
           string_agg(DISTINCT pr.turno::text, ', ' ORDER BY pr.turno::text) AS turnos_lista
    FROM public.presencas pr
    JOIN public.competencias co ON pr.data_presenca BETWEEN co.data_inicio AND co.data_fim
    WHERE pr.tipo_atuacao = 'internato'
      AND pr.status = 'confirmada'
      AND pr.vinculo_internato_id IS NOT NULL
    GROUP BY pr.preceptor_id, pr.vinculo_internato_id, co.id
  ),
  detalhes AS (
    SELECT b.*,
           coalesce(pc.total_confirmadas, 0) AS presencas_confirmadas,
           coalesce(pc.manha, 0) AS pres_manha,
           coalesce(pc.tarde, 0) AS pres_tarde,
           coalesce(pc.noite, 0) AS pres_noite,
           coalesce(pc.turnos_lista, '') AS turnos,
           to_char(make_date(b.ano, b.mes, 1), 'YYYY-MM') AS competencia_label,
           i.nome AS internato_nome,
           u.nome AS unidade_nome,
           l.nome AS local_nome,
           st.nome AS setor_nome,
           r.regra_nome,
           CASE WHEN b.nota_situacao = 'pago' THEN 'pago' ELSE 'pendente' END AS pagamento_status
    FROM base b
    LEFT JOIN presencas pc
      ON pc.preceptor_id = b.preceptor_id
     AND pc.vinculo_internato_id = b.vinculo_internato_id
     AND pc.competencia_id = b.competencia_id
    LEFT JOIN public.internatos i ON i.id = b.internato_id
    LEFT JOIN public.unidades u ON u.id = b.unidade_id
    LEFT JOIN public.locais l ON l.id = b.local_id
    LEFT JOIN public.setores st ON st.id = b.setor_id
    LEFT JOIN LATERAL (
      SELECT rf.nome AS regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_internato_id = b.vinculo_internato_id AND vrf.status = 'ativo'
      ORDER BY rf.prioridade NULLS LAST, rf.data_inicio DESC
      LIMIT 1
    ) r ON true
  )
  SELECT coalesce(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.ano DESC, d.mes DESC, d.nome_completo), '[]'::jsonb)
  INTO v_detalhes
  FROM (
    SELECT
      d.calculo_id, d.competencia_id, d.ano, d.mes, d.competencia_label,
      d.data_inicio, d.data_fim,
      d.preceptor_id, d.nome_completo AS preceptor_nome,
      coalesce(d.email, '') AS preceptor_email,
      d.vinculo_internato_id, d.internato_id, coalesce(d.internato_nome, '') AS internato_nome,
      d.unidade_id, coalesce(d.unidade_nome, '') AS unidade_nome,
      d.local_id, coalesce(d.local_nome, '') AS local_nome,
      d.setor_id, coalesce(d.setor_nome, '') AS setor_nome,
      d.turnos, d.presencas_confirmadas, d.pres_manha, d.pres_tarde, d.pres_noite,
      coalesce(d.regra_nome, '') AS regra_nome,
      d.total_bruto, d.total_descontos, d.total_liquido,
      d.calculo_status, d.versao, d.calculado_em, d.quantidade_presencas,
      d.chamado_numero, d.chamado_status, d.chamado_observacao,
      coalesce(d.nota_situacao, 'nao_solicitada') AS situacao_nota,
      coalesce(d.email_usado, '') AS email_usado,
      coalesce(d.nota_observacao, '') AS nota_observacao,
      d.preparado_em, d.enviado_em, d.nota_recebida_em,
      d.pagamento_status, d.revisao_pendente
    FROM detalhes d
  ) d;

  -- Chamados por status
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_chamados
  FROM (
    SELECT coalesce(d.chamado_status, 'nao_aberto') AS status, count(*) AS total
    FROM detalhes d
    GROUP BY 1 ORDER BY 1
  ) t;

  -- Consolidação
  SELECT jsonb_build_object(
    'preceptores_ativos', v_preceptores_ativos,
    'escalas_ativas', v_escalas_ativas,
    'calculos', count(*),
    'presencas_confirmadas', sum(d.presencas_confirmadas),
    'presencas_manha', sum(d.pres_manha),
    'presencas_tarde', sum(d.pres_tarde),
    'presencas_noite', sum(d.pres_noite),
    'valor_calculado', sum(d.total_bruto),
    'notas_nao_solicitada', count(*) FILTER (WHERE d.situacao_nota = 'nao_solicitada'),
    'notas_preparadas', count(*) FILTER (WHERE d.situacao_nota = 'preparada'),
    'notas_solicitadas', count(*) FILTER (WHERE d.situacao_nota = 'solicitada'),
    'notas_recebidas', count(*) FILTER (WHERE d.situacao_nota = 'nota_recebida'),
    'notas_pendentes', count(*) FILTER (WHERE d.situacao_nota IN ('nao_solicitada', 'preparada')),
    'notas_enviadas', count(*) FILTER (WHERE d.situacao_nota IN ('solicitada', 'nota_recebida', 'em_pagamento')),
    'pagamentos_concluidos', count(*) FILTER (WHERE d.situacao_nota = 'pago'),
    'pagamentos_em_processo', count(*) FILTER (WHERE d.situacao_nota = 'em_pagamento'),
    'pendencias_financeiras', count(*) FILTER (
      WHERE d.chamado_status IS DISTINCT FROM 'nao_aberto'
        AND d.situacao_nota NOT IN ('pago', 'cancelado')),
    'revisoes_pendentes', count(*) FILTER (WHERE d.revisao_pendente),
    'valor_pago', sum(d.total_bruto) FILTER (WHERE d.situacao_nota = 'pago')
  ) INTO v_resumo
  FROM (
    SELECT d.* FROM detalhes d
  ) d;

  -- Valores por Internato, unidade, local e preceptor
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_internato
  FROM (
    SELECT d.internato_id, coalesce(d.internato_nome, '') AS internato_nome,
           count(*) AS calculos, sum(d.presencas_confirmadas) AS presencas,
           sum(d.total_bruto) AS valor,
           count(*) FILTER (WHERE d.situacao_nota = 'pago') AS pagamentos,
           count(*) FILTER (WHERE d.situacao_nota <> 'pago') AS pendentes
    FROM detalhes d GROUP BY 1, 2 ORDER BY 2
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_unidade
  FROM (
    SELECT d.unidade_id, coalesce(d.unidade_nome, '') AS unidade_nome,
           count(*) AS calculos, sum(d.presencas_confirmadas) AS presencas,
           sum(d.total_bruto) AS valor,
           count(*) FILTER (WHERE d.situacao_nota = 'pago') AS pagamentos
    FROM detalhes d GROUP BY 1, 2 ORDER BY 2
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_local
  FROM (
    SELECT d.local_id, coalesce(d.local_nome, '') AS local_nome,
           count(*) AS calculos, sum(d.presencas_confirmadas) AS presencas,
           sum(d.total_bruto) AS valor,
           count(*) FILTER (WHERE d.situacao_nota = 'pago') AS pagamentos
    FROM detalhes d GROUP BY 1, 2 ORDER BY 2
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_preceptor
  FROM (
    SELECT d.preceptor_id, d.nome_completo AS preceptor_nome,
           coalesce(d.email, '') AS preceptor_email,
           count(*) AS calculos, sum(d.presencas_confirmadas) AS presencas,
           sum(d.total_bruto) AS valor,
           coalesce(d.situacao_nota, 'nao_solicitada') AS situacao_nota
    FROM detalhes d GROUP BY 1, 2, 3, 7 ORDER BY 2
  ) t;

  -- Pendências financeiras: chamado aberto/processado com nota não paga/não cancelada
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_pendencias
  FROM (
    SELECT d.calculo_id, d.preceptor_id, d.nome_completo AS preceptor_nome,
           d.competencia_label, d.chamado_numero, d.chamado_status,
           d.situacao_nota, d.total_bruto, d.revisao_pendente
    FROM detalhes d
    WHERE d.chamado_status IS DISTINCT FROM 'nao_aberto'
      AND d.situacao_nota NOT IN ('pago', 'cancelado')
    ORDER BY d.competencia_label DESC, d.nome_completo
  ) t;

  RETURN jsonb_build_object(
    'resumo', v_resumo,
    'chamados_por_status', v_chamados,
    'por_internato', v_por_internato,
    'por_unidade', v_por_unidade,
    'por_local', v_por_local,
    'por_preceptor', v_por_preceptor,
    'pendencias', v_pendencias,
    'detalhes', v_detalhes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_preceptoria_internato(
  UUID, INTEGER, INTEGER, DATE, DATE, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_preceptoria_internato(
  UUID, INTEGER, INTEGER, DATE, DATE, UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Reforço: garantir que as demais RPCs sensíveis continuem sem acesso anônimo
REVOKE EXECUTE ON FUNCTION public.corrigir_presenca_administrativa(UUID, DATE, PUBLIC.turno, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_solicitacao_nota_fiscal(UUID, TEXT) FROM PUBLIC, anon;
