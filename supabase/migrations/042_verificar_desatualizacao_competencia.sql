-- 042_verificar_desatualizacao_competencia.sql
-- Detecta vínculos desatualizados ou não calculados em uma competência.
--
-- Compara registered_at/updated_at das presenças com calculado_em dos cálculos.
-- Retorna:
--   - vinculos_desatualizados: presenças Posteriores ao último cálculo
--   - vinculos_nao_calculados: presenças sem nenhum cálculo
--   - ultima_apuracao: timestamp do cálculo mais recente
--   - total_vinculos_com_presenca: total de vinculos com presenças
--   - total_calculados_ok: vinculos com cálculo atualizado

CREATE OR REPLACE FUNCTION public.verificar_desatualizacao_competencia(
  p_mes integer,
  p_ano integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_competencia_id uuid;
  v_resultado jsonb;
  v_desatualizados jsonb := '[]'::jsonb;
  v_nao_calculados jsonb := '[]'::jsonb;
  v_ultima_apuracao timestamptz;
  v_reg record;
  v_mais_recente_presenca timestamptz;
  v_calculo_existe boolean;
  v_calculo_desatualizado boolean;
  v_total_vinculos integer := 0;
  v_total_ok integer := 0;
BEGIN
  IF p_mes IS NULL OR p_ano IS NULL THEN
    RAISE EXCEPTION 'Mes e ano sao obrigatorios';
  END IF;

  -- Buscar competência
  SELECT id INTO v_competencia_id
  FROM public.competencias
  WHERE mes = p_mes AND ano = p_ano
  LIMIT 1;

  IF v_competencia_id IS NULL THEN
    RETURN jsonb_build_object(
      'possui_desatualizacao', false,
      'vinculos_desatualizados', '[]'::jsonb,
      'vinculos_nao_calculados', '[]'::jsonb,
      'ultima_apuracao', null,
      'total_vinculos_com_presenca', 0,
      'total_calculados_ok', 0
    );
  END IF;

  -- Última apuração da competência
  SELECT MAX(calculado_em) INTO v_ultima_apuracao
  FROM public.calculos
  WHERE competencia_id = v_competencia_id;

  -- Iterar sobre cada vinculo que tem presenças na competência
  FOR v_reg IN
    SELECT
      p.preceptor_id,
      p.tipo_atuacao,
      p.vinculo_adm_id,
      p.vinculo_internato_id,
      MAX(GREATEST(p.registrado_em, p.updated_at)) AS ultima_presenca,
      COUNT(*)::integer AS qtd_presencas
    FROM public.presencas p
    JOIN public.competencias co ON co.id = (
      SELECT id FROM public.competencias
      WHERE mes = p_mes AND ano = p_ano LIMIT 1
    )
    WHERE p.status IN ('confirmada', 'ajustada')
      AND EXTRACT(MONTH FROM p.data_presenca) = p_mes
      AND EXTRACT(YEAR FROM p.data_presenca) = p_ano
    GROUP BY p.preceptor_id, p.tipo_atuacao, p.vinculo_adm_id, p.vinculo_internato_id
  LOOP
    v_total_vinculos := v_total_vinculos + 1;

    -- Verificar se existe cálculo para este vínculo
    SELECT EXISTS (
      SELECT 1 FROM public.calculos c
      WHERE c.competencia_id = v_competencia_id
        AND c.preceptor_id = v_reg.preceptor_id
        AND c.tipo_atuacao = v_reg.tipo_atuacao
        AND (
          (v_reg.tipo_atuacao = 'adm' AND c.vinculo_adm_id = v_reg.vinculo_adm_id)
          OR
          (v_reg.tipo_atuacao = 'internato' AND c.vinculo_internato_id = v_reg.vinculo_internato_id)
        )
    ) INTO v_calculo_existe;

    IF NOT v_calculo_existe THEN
      -- Vínculo não calculado
      v_nao_calculados := v_nao_calculados || jsonb_build_object(
        'preceptor_id', v_reg.preceptor_id,
        'tipo_atuacao', v_reg.tipo_atuacao::text,
        'vinculo_adm_id', v_reg.vinculo_adm_id,
        'vinculo_internato_id', v_reg.vinculo_internato_id,
        'qtd_presencas', v_reg.qtd_presencas,
        'ultima_presenca', v_reg.ultima_presenca
      );
    ELSE
      -- Verificar se há presenças Posteriores ao cálculo
      SELECT EXISTS (
        SELECT 1 FROM public.calculos c
        WHERE c.competencia_id = v_competencia_id
          AND c.preceptor_id = v_reg.preceptor_id
          AND c.tipo_atuacao = v_reg.tipo_atuacao
          AND (
            (v_reg.tipo_atuacao = 'adm' AND c.vinculo_adm_id = v_reg.vinculo_adm_id)
            OR
            (v_reg.tipo_atuacao = 'internato' AND c.vinculo_internato_id = v_reg.vinculo_internato_id)
          )
          AND c.calculado_em < v_reg.ultima_presenca
      ) INTO v_calculo_desatualizado;

      IF v_calculo_desatualizado THEN
        v_desatualizados := v_desatualizados || jsonb_build_object(
          'preceptor_id', v_reg.preceptor_id,
          'tipo_atuacao', v_reg.tipo_atuacao::text,
          'vinculo_adm_id', v_reg.vinculo_adm_id,
          'vinculo_internato_id', v_reg.vinculo_internato_id,
          'qtd_presencas', v_reg.qtd_presencas,
          'ultima_presenca', v_reg.ultima_presenca
        );
      ELSE
        v_total_ok := v_total_ok + 1;
      END IF;
    END IF;
  END LOOP;

  -- Enriquecer com nomes dos preceptores
  v_desatualizados := (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(d) || jsonb_build_object('preceptor_nome', p.nome_completo)
    ), '[]'::jsonb)
    FROM jsonb_to_recordset(v_desatualizados) AS d(
      preceptor_id uuid, tipo_atuacao text, vinculo_adm_id uuid,
      vinculo_internato_id uuid, qtd_presencas integer, ultima_presenca timestamptz
    )
    JOIN public.preceptores p ON p.id = d.preceptor_id
  );

  v_nao_calculados := (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(n) || jsonb_build_object('preceptor_nome', p.nome_completo)
    ), '[]'::jsonb)
    FROM jsonb_to_recordset(v_nao_calculados) AS n(
      preceptor_id uuid, tipo_atuacao text, vinculo_adm_id uuid,
      vinculo_internato_id uuid, qtd_presencas integer, ultima_presenca timestamptz
    )
    JOIN public.preceptores p ON p.id = n.preceptor_id
  );

  v_resultado := jsonb_build_object(
    'possui_desatualizacao', (jsonb_array_length(v_desatualizados) > 0 OR jsonb_array_length(v_nao_calculados) > 0),
    'vinculos_desatualizados', v_desatualizados,
    'vinculos_nao_calculados', v_nao_calculados,
    'ultima_apuracao', v_ultima_apuracao,
    'total_vinculos_com_presenca', v_total_vinculos,
    'total_calculados_ok', v_total_ok
  );

  RETURN v_resultado;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verificar_desatualizacao_competencia(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificar_desatualizacao_competencia(integer, integer) TO authenticated;
