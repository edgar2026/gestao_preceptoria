-- 036_fix_dashboard_drop_temp_table.sql
-- Corrige 42P07 (relation tmp_dash_detalhes already exists) quando a função é
-- chamada mais de uma vez na mesma sessão/transação: garante limpeza com
-- DROP TABLE IF EXISTS antes do CREATE TEMP TABLE. Remove ON COMMIT DROP
-- (sem efeito em transações longas) mantendo o comportamento idempotente.
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

  -- Tabela temporária pode sobreviver a múltiplas chamadas na mesma sessão/transação
  DROP TABLE IF EXISTS tmp_dash_detalhes;

  CREATE TEMP TABLE tmp_dash_detalhes AS
  WITH base AS (
    SELECT c.id AS calculo_id,
           c.preceptor_id, c.vinculo_internato_id, c.competencia_id,
           co.ano, co.mes, co.data_inicio, co.data_fim,
           c.total_bruto, c.total_descontos, c.total_liquido,
           c.status AS calculo_status, c.versao, c.calculado_em, c.quantidade_presencas,
           c.chamado_numero, c.chamado_status, c.chamado_observacao,
           p.nome_completo, p.email,
           vi.unidade_id, vi.internato_id, vi.local_id, vi.setor_id,
           s.situacao AS nota_situacao,
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
  FROM detalhes d;

  -- Detalhamento (colunas para exportação Excel no frontend)
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.ano DESC, t.mes DESC, t.preceptor_nome), '[]'::jsonb)
  INTO v_detalhes
  FROM tmp_dash_detalhes t;

  -- Chamados por status
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_chamados
  FROM (
    SELECT coalesce(t.chamado_status, 'nao_aberto') AS status, count(*) AS total
    FROM tmp_dash_detalhes t
    GROUP BY 1 ORDER BY 1
  ) t;

  -- Preceptores ativos (com vínculo de Internato ativo, respeitando filtros de vínculo)
  SELECT count(DISTINCT vi.preceptor_id) INTO v_preceptores_ativos
  FROM public.vinculos_internato vi
  JOIN public.preceptores pr ON pr.id = vi.preceptor_id
  WHERE vi.status = 'ativo' AND pr.status = 'ativo'
    AND (p_unidade_id IS NULL OR vi.unidade_id = p_unidade_id)
    AND (p_internato_id IS NULL OR vi.internato_id = p_internato_id)
    AND (p_local_id IS NULL OR vi.local_id = p_local_id)
    AND (p_setor_id IS NULL OR vi.setor_id = p_setor_id)
    AND (p_preceptor_id IS NULL OR vi.preceptor_id = p_preceptor_id);

  -- Escalas ativas de Internato (vínculos que passam nos filtros)
  SELECT count(DISTINCT e.id) INTO v_escalas_ativas
  FROM public.escalas e
  WHERE e.tipo_atuacao = 'internato' AND e.status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM public.vinculos_internato vi
      WHERE vi.id = e.vinculo_internato_id AND vi.status = 'ativo'
        AND (p_unidade_id IS NULL OR vi.unidade_id = p_unidade_id)
        AND (p_internato_id IS NULL OR vi.internato_id = p_internato_id)
        AND (p_local_id IS NULL OR vi.local_id = p_local_id)
        AND (p_setor_id IS NULL OR vi.setor_id = p_setor_id)
        AND (p_preceptor_id IS NULL OR vi.preceptor_id = p_preceptor_id)
    );

  -- Consolidação
  SELECT jsonb_build_object(
    'preceptores_ativos', v_preceptores_ativos,
    'escalas_ativas', v_escalas_ativas,
    'calculos', count(*),
    'presencas_confirmadas', sum(t.presencas_confirmadas),
    'presencas_manha', sum(t.pres_manha),
    'presencas_tarde', sum(t.pres_tarde),
    'presencas_noite', sum(t.pres_noite),
    'valor_calculado', sum(t.total_bruto),
    'notas_nao_solicitada', count(*) FILTER (WHERE t.situacao_nota = 'nao_solicitada'),
    'notas_preparadas', count(*) FILTER (WHERE t.situacao_nota = 'preparada'),
    'notas_solicitadas', count(*) FILTER (WHERE t.situacao_nota = 'solicitada'),
    'notas_recebidas', count(*) FILTER (WHERE t.situacao_nota = 'nota_recebida'),
    'notas_pendentes', count(*) FILTER (WHERE t.situacao_nota IN ('nao_solicitada', 'preparada')),
    'notas_enviadas', count(*) FILTER (WHERE t.situacao_nota IN ('solicitada', 'nota_recebida', 'em_pagamento')),
    'pagamentos_concluidos', count(*) FILTER (WHERE t.situacao_nota = 'pago'),
    'pagamentos_em_processo', count(*) FILTER (WHERE t.situacao_nota = 'em_pagamento'),
    'pendencias_financeiras', count(*) FILTER (
      WHERE t.chamado_status IS DISTINCT FROM 'nao_aberto'
        AND t.situacao_nota NOT IN ('pago', 'cancelado')),
    'revisoes_pendentes', count(*) FILTER (WHERE t.revisao_pendente),
    'valor_pago', sum(t.total_bruto) FILTER (WHERE t.situacao_nota = 'pago')
  ) INTO v_resumo
  FROM tmp_dash_detalhes t;

  -- Valores por Internato, unidade, local e preceptor
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_internato
  FROM (
    SELECT t.internato_id, coalesce(t.internato_nome, '') AS internato_nome,
           count(*) AS calculos, sum(t.presencas_confirmadas) AS presencas,
           sum(t.total_bruto) AS valor,
           count(*) FILTER (WHERE t.situacao_nota = 'pago') AS pagamentos,
           count(*) FILTER (WHERE t.situacao_nota <> 'pago') AS pendentes
    FROM tmp_dash_detalhes t GROUP BY 1, 2 ORDER BY 2
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_unidade
  FROM (
    SELECT t.unidade_id, coalesce(t.unidade_nome, '') AS unidade_nome,
           count(*) AS calculos, sum(t.presencas_confirmadas) AS presencas,
           sum(t.total_bruto) AS valor,
           count(*) FILTER (WHERE t.situacao_nota = 'pago') AS pagamentos
    FROM tmp_dash_detalhes t GROUP BY 1, 2 ORDER BY 2
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_local
  FROM (
    SELECT t.local_id, coalesce(t.local_nome, '') AS local_nome,
           count(*) AS calculos, sum(t.presencas_confirmadas) AS presencas,
           sum(t.total_bruto) AS valor,
           count(*) FILTER (WHERE t.situacao_nota = 'pago') AS pagamentos
    FROM tmp_dash_detalhes t GROUP BY 1, 2 ORDER BY 2
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_por_preceptor
  FROM (
    SELECT t.preceptor_id, t.preceptor_nome,
           coalesce(t.preceptor_email, '') AS preceptor_email,
           count(*) AS calculos, sum(t.presencas_confirmadas) AS presencas,
           sum(t.total_bruto) AS valor,
           coalesce(t.situacao_nota, 'nao_solicitada') AS situacao_nota
    FROM tmp_dash_detalhes t GROUP BY 1, 2, 3, 7 ORDER BY 2
  ) t;

  -- Pendências financeiras: chamado aberto/processado com nota não paga/não cancelada
  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_pendencias
  FROM (
    SELECT t.calculo_id, t.preceptor_id, t.preceptor_nome,
           t.competencia_label, t.chamado_numero, t.chamado_status,
           t.situacao_nota, t.total_bruto, t.revisao_pendente
    FROM tmp_dash_detalhes t
    WHERE t.chamado_status IS DISTINCT FROM 'nao_aberto'
      AND t.situacao_nota NOT IN ('pago', 'cancelado')
    ORDER BY t.competencia_label DESC, t.preceptor_nome
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
