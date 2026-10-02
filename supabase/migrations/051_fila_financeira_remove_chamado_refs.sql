-- 051: correção da migração 050. A migração 050 foi reconstruída a partir da
-- versão antiga (031) da RPC buscar_fila_financeira e reintroduziu referências
-- às colunas chamado_* que foram removidas de `calculos` na migração 046.
-- Esta migração remove as referências a chamado e mantém os campos novos
-- (competencia_id, vinculo_adm_id, vinculo_internato_id, setor_nome, periodo_nome).
-- O parâmetro p_situacao é mantido por compatibilidade de assinatura, mas não
-- filtra mais por chamado (conceito removido do fluxo financeiro na migração 044).

CREATE OR REPLACE FUNCTION public.buscar_fila_financeira(
  p_mes integer DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_modalidade text DEFAULT NULL,
  p_situacao text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_resultado jsonb := '[]'::jsonb;
  v_row jsonb;
  v_calc record;
  v_unidade_nome text;
  v_disciplina_nome text;
  v_internato_nome text;
  v_local_nome text;
  v_setor_nome text;
  v_periodo_nome text;
  v_regra_nome text;
  v_mes_comp integer;
  v_ano_comp integer;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  FOR v_calc IN
    SELECT
      c.*,
      p.nome_completo AS preceptor_nome,
      p.email AS preceptor_email,
      co.data_inicio AS competencia_inicio,
      co.data_fim AS competencia_fim,
      s.situacao AS nota_situacao
    FROM public.calculos c
    JOIN public.preceptores p ON p.id = c.preceptor_id
    JOIN public.competencias co ON co.id = c.competencia_id
    LEFT JOIN public.solicitacoes_nota_fiscal s ON s.calculo_id = c.id
    WHERE (p_mes IS NULL OR co.mes = p_mes)
      AND (p_ano IS NULL OR co.ano = p_ano)
      AND (p_modalidade IS NULL OR c.tipo_atuacao::text = p_modalidade)
      AND (p_search IS NULL OR p.nome_completo ILIKE '%' || p_search || '%')
    ORDER BY c.created_at DESC
  LOOP
    v_unidade_nome := NULL;
    v_disciplina_nome := NULL;
    v_internato_nome := NULL;
    v_local_nome := NULL;
    v_setor_nome := NULL;
    v_periodo_nome := NULL;
    v_regra_nome := NULL;

    IF v_calc.tipo_atuacao = 'adm' AND v_calc.vinculo_adm_id IS NOT NULL THEN
      SELECT
        u.nome, d.nome, l.nome, st.nome,
        CASE WHEN pe.numero IS NOT NULL THEN pe.numero || 'º período' END
      INTO v_unidade_nome, v_disciplina_nome, v_local_nome, v_setor_nome, v_periodo_nome
      FROM public.vinculos_adm va
      LEFT JOIN public.unidades u ON u.id = va.unidade_id
      LEFT JOIN public.disciplinas d ON d.id = va.disciplina_id
      LEFT JOIN public.locais l ON l.id = va.local_id
      LEFT JOIN public.setores st ON st.id = va.setor_id
      LEFT JOIN public.periodos pe ON pe.id = va.periodo_id
      WHERE va.id = v_calc.vinculo_adm_id;
    ELSIF v_calc.tipo_atuacao = 'internato' AND v_calc.vinculo_internato_id IS NOT NULL THEN
      SELECT
        u.nome, i.nome, l.nome, st.nome,
        CASE WHEN pe.numero IS NOT NULL THEN pe.numero || 'º período' END
      INTO v_unidade_nome, v_internato_nome, v_local_nome, v_setor_nome, v_periodo_nome
      FROM public.vinculos_internato vi
      LEFT JOIN public.unidades u ON u.id = vi.unidade_id
      LEFT JOIN public.internatos i ON i.id = vi.internato_id
      LEFT JOIN public.locais l ON l.id = vi.local_id
      LEFT JOIN public.setores st ON st.id = vi.setor_id
      LEFT JOIN public.periodos pe ON pe.id = vi.periodo_id
      WHERE vi.id = v_calc.vinculo_internato_id;
    END IF;

    IF v_calc.tipo_atuacao = 'adm' AND v_calc.vinculo_adm_id IS NOT NULL THEN
      SELECT rf.nome INTO v_regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_adm_id = v_calc.vinculo_adm_id AND vrf.status = 'ativo'
      LIMIT 1;
    ELSIF v_calc.tipo_atuacao = 'internato' AND v_calc.vinculo_internato_id IS NOT NULL THEN
      SELECT rf.nome INTO v_regra_nome
      FROM public.vinculo_regras_financeiras vrf
      JOIN public.regras_financeiras rf ON rf.id = vrf.regra_id
      WHERE vrf.vinculo_internato_id = v_calc.vinculo_internato_id AND vrf.status = 'ativo'
      LIMIT 1;
    END IF;

    v_mes_comp := EXTRACT(MONTH FROM v_calc.competencia_inicio)::integer;
    v_ano_comp := EXTRACT(YEAR FROM v_calc.competencia_inicio)::integer;
    v_data_inicio := v_calc.competencia_inicio;
    v_data_fim := v_calc.competencia_fim;

    v_row := jsonb_build_object(
      'id', v_calc.id,
      'competencia_id', v_calc.competencia_id,
      'preceptor_id', v_calc.preceptor_id,
      'preceptor_nome', v_calc.preceptor_nome,
      'preceptor_email', coalesce(v_calc.preceptor_email, ''),
      'mes', v_mes_comp,
      'ano', v_ano_comp,
      'tipo_atuacao', v_calc.tipo_atuacao,
      'modalidade', v_calc.tipo_atuacao::text,
      'vinculo_adm_id', v_calc.vinculo_adm_id,
      'vinculo_internato_id', v_calc.vinculo_internato_id,
      'unidade_nome', COALESCE(v_unidade_nome, '-'),
      'disciplina_nome', COALESCE(v_disciplina_nome, '-'),
      'internato_nome', COALESCE(v_internato_nome, '-'),
      'local_nome', COALESCE(v_local_nome, '-'),
      'setor_nome', v_setor_nome,
      'periodo_nome', v_periodo_nome,
      'quantidade_presencas', v_calc.quantidade_presencas,
      'regra_nome', COALESCE(v_regra_nome, 'Regra financeira pendente'),
      'total_bruto', v_calc.total_bruto,
      'status', v_calc.status,
      'observacoes', v_calc.observacoes,
      'versao', v_calc.versao,
      'calculado_em', v_calc.calculado_em,
      'data_inicio', v_data_inicio,
      'data_fim', v_data_fim,
      'situacao_nota', coalesce(v_calc.nota_situacao, 'nao_solicitada')
    );

    v_resultado := v_resultado || v_row;
  END LOOP;

  RETURN v_resultado;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buscar_fila_financeira(integer, integer, text, text, text) TO authenticated;
