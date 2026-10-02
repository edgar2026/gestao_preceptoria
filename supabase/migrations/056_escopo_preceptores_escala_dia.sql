-- 056: restringe a listagem de preceptores escalados no dia ao escopo do proprio
-- perfil. A funcao e SECURITY DEFINER e alimenta o modal "Registrar Presenca" da
-- tela de Presencas, que passa a ficar disponivel para o perfil Coordenacao.
-- Administrador e demais perfis mantem o comportamento anterior.

create or replace function public.fetch_preceptores_com_escala_no_dia(p_data date)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_resultado JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'escala_id', sub.escala_id,
      'preceptor_id', sub.preceptor_id,
      'preceptor_nome', sub.preceptor_nome,
      'tipo_atuacao', sub.tipo_atuacao,
      'modalidade_label', CASE WHEN sub.tipo_atuacao = 'adm' THEN 'Prática' ELSE 'Internato' END,
      'vinculo_adm_id', sub.vinculo_adm_id,
      'vinculo_internato_id', sub.vinculo_internato_id,
      'local_id', sub.local_id,
      'setor_id', sub.setor_id,
      'local_nome', sub.local_nome,
      'setor_nome', sub.setor_nome,
      'turnos_previstos', sub.turnos_previstos,
      'turnos_ja_registrados', sub.turnos_ja_registrados
    )
  ) INTO v_resultado
  FROM (
    SELECT
      e.id AS escala_id,
      p.id AS preceptor_id,
      p.nome_completo AS preceptor_nome,
      e.tipo_atuacao,
      e.vinculo_adm_id,
      e.vinculo_internato_id,
      vl.local_id,
      vl.setor_id,
      coalesce(loc.nome, '-') AS local_nome,
      coalesce(set.nome, '-') AS setor_nome,
      (
        SELECT jsonb_agg(DISTINCT ei.turno)
        FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id AND ei.data = p_data
      ) AS turnos_previstos,
      (
        SELECT coalesce(jsonb_agg(DISTINCT pr.turno), '[]'::jsonb)
        FROM public.presencas pr
        WHERE pr.escala_id = e.id AND pr.preceptor_id = p.id AND pr.data_presenca = p_data AND pr.status != 'cancelada'
      ) AS turnos_ja_registrados
    FROM public.escalas e
    JOIN public.vinculo_locais vl ON vl.id = e.vinculo_local_id
    LEFT JOIN public.locais loc ON loc.id = vl.local_id
    LEFT JOIN public.setores set ON set.id = vl.setor_id
    LEFT JOIN public.vinculos_adm va ON va.id = e.vinculo_adm_id
    LEFT JOIN public.vinculos_internato vi ON vi.id = e.vinculo_internato_id
    LEFT JOIN public.preceptores p ON p.id = coalesce(va.preceptor_id, vi.preceptor_id)
    WHERE e.status = 'ativo'
      AND EXISTS (
        SELECT 1 FROM public.escalas_itens ei
        WHERE ei.escala_id = e.id AND ei.data = p_data
      )
      AND (
        public.has_role(ARRAY['admin','coordenacao']::public.app_role[])
        OR NOT public.has_role(ARRAY['coordenador']::public.app_role[])
        OR e.vinculo_internato_id = ANY (public.get_coordinator_vinculo_ids())
      )
    ORDER BY p.nome_completo
  ) sub;

  RETURN coalesce(v_resultado, '[]'::jsonb);
END;
$function$;
