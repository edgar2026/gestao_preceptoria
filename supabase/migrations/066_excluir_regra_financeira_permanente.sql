-- Migration 066: Exclusão permanente de regra financeira por Administrador e limpeza de regras de teste
-- Etapa: CORRIGIR-REGRAS-FINANCEIRAS
-- 1. Limpeza de regras de teste repetidas 'REGRA PRECEPTOR TESTE'
-- 2. RPC previa_excluir_regra_financeira (valida admin, conta vínculos e cálculos históricos)
-- 3. RPC transacional excluir_regra_financeira (preserva dados em calculo_itens desvinculando regra_id = NULL)

-- 1. Limpeza das regras de teste criadas indevidamente na homologação
DELETE FROM public.regras_financeiras
WHERE nome = 'REGRA PRECEPTOR TESTE';

-- 2. RPC de Prévia para Exclusão de Regra Financeira
CREATE OR REPLACE FUNCTION public.previa_excluir_regra_financeira(p_regra_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_regra record;
  v_total_vinculos integer := 0;
  v_total_calculos integer := 0;
  v_vigencia text;
BEGIN
  -- Validar que o usuário é administrador
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    BEGIN
      v_caller_id := current_setting('request.jwt.claim.sub', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_id := NULL;
    END;
  END IF;

  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE (p.user_id = v_caller_id OR p.id = v_caller_id)
      AND ur.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem visualizar a prévia de exclusão.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_regra
  FROM public.regras_financeiras
  WHERE id = p_regra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regra financeira não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  -- Contar vínculos associados
  SELECT count(*) INTO v_total_vinculos
  FROM public.vinculo_regras_financeiras
  WHERE regra_id = p_regra_id;

  -- Contar cálculos históricos distintos que utilizaram a regra
  SELECT count(DISTINCT calculo_id) INTO v_total_calculos
  FROM public.calculo_itens
  WHERE regra_id = p_regra_id;

  IF v_regra.data_fim IS NOT NULL THEN
    v_vigencia := to_char(v_regra.data_inicio, 'DD/MM/YYYY') || ' até ' || to_char(v_regra.data_fim, 'DD/MM/YYYY');
  ELSE
    v_vigencia := to_char(v_regra.data_inicio, 'DD/MM/YYYY') || ' (vigente)';
  END IF;

  RETURN jsonb_build_object(
    'regra_id', v_regra.id,
    'nome', v_regra.nome,
    'tipo_atuacao', 'Internato',
    'vigencia', v_vigencia,
    'total_vinculos', v_total_vinculos,
    'total_calculos', v_total_calculos
  );
END;
$$;

-- 3. RPC Transacional de Exclusão Permanente de Regra Financeira
CREATE OR REPLACE FUNCTION public.excluir_regra_financeira(
  p_regra_id uuid,
  p_confirmar boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_regra record;
  v_vinculos_removidos integer := 0;
  v_calculo_itens_atualizados integer := 0;
  v_componentes_removidos integer := 0;
  v_rateios_removidos integer := 0;
  v_regra_preceptores_removidos integer := 0;
BEGIN
  -- 1. Validar autenticação e perfil Admin
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    BEGIN
      v_caller_id := current_setting('request.jwt.claim.sub', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_id := NULL;
    END;
  END IF;

  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE (p.user_id = v_caller_id OR p.id = v_caller_id)
      AND ur.role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores podem excluir regras financeiras.' USING ERRCODE = 'P0001';
  END IF;

  IF p_confirmar IS NOT TRUE THEN
    RAISE EXCEPTION 'Operação não confirmada. Para excluir permanentemente a regra passe p_confirmar = TRUE.' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Localizar regra
  SELECT * INTO v_regra
  FROM public.regras_financeiras
  WHERE id = p_regra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regra financeira não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Preservar cálculos históricos:
  -- Desvincula a FK calculo_itens.regra_id para NULL sem apagar o item ou o cálculo.
  -- Os dados de descrição, tipo, quantidade, valor unitário e total já gravados no cálculo permanecem intactos.
  WITH upd AS (
    UPDATE public.calculo_itens
    SET regra_id = NULL
    WHERE regra_id = p_regra_id
    RETURNING 1
  )
  SELECT count(*) INTO v_calculo_itens_atualizados FROM upd;

  -- 4. Remover associações com vínculos existentes
  WITH del_vrf AS (
    DELETE FROM public.vinculo_regras_financeiras
    WHERE regra_id = p_regra_id
    RETURNING 1
  )
  SELECT count(*) INTO v_vinculos_removidos FROM del_vrf;

  -- 5. Remover rateios associados (se houver)
  WITH del_rat AS (
    DELETE FROM public.rateios_financeiros
    WHERE regra_id = p_regra_id
    RETURNING 1
  )
  SELECT count(*) INTO v_rateios_removidos FROM del_rat;

  -- 6. Remover associações em regra_preceptores (se houver)
  WITH del_rp AS (
    DELETE FROM public.regra_preceptores
    WHERE regra_id = p_regra_id
    RETURNING 1
  )
  SELECT count(*) INTO v_regra_preceptores_removidos FROM del_rp;

  -- 7. Remover componentes da regra (se houver)
  WITH del_rc AS (
    DELETE FROM public.regra_componentes
    WHERE regra_id = p_regra_id
    RETURNING 1
  )
  SELECT count(*) INTO v_componentes_removidos FROM del_rc;

  -- 8. Excluir permanentemente a regra financeira
  DELETE FROM public.regras_financeiras
  WHERE id = p_regra_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', 'Regra financeira excluída permanentemente.',
    'regra', jsonb_build_object(
      'id', v_regra.id,
      'nome', v_regra.nome,
      'tipo_atuacao', v_regra.tipo_atuacao
    ),
    'resumo', jsonb_build_object(
      'vinculos_desvinculados', v_vinculos_removidos,
      'calculos_preservados', v_calculo_itens_atualizados,
      'componentes_removidos', v_componentes_removidos,
      'rateios_removidos', v_rateios_removidos,
      'regra_preceptores_removidos', v_regra_preceptores_removidos
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.previa_excluir_regra_financeira(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_regra_financeira(uuid, boolean) TO authenticated;
