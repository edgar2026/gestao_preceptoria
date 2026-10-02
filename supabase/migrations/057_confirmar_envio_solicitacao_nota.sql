-- 057: confirmacao transacional do envio da solicitacao de nota fiscal.
--
-- Problema comprovado: a confirmacao do envio gravava em
-- solicitacoes_nota_fiscal.enviado_por um identificador de auth.users.id,
-- violando a FK solicitacoes_nota_fiscal_enviado_por_fkey
-- (enviado_por -> profiles.id).
--
-- Correcao: a responsabilidade e resolvida NO SERVIDOR a partir de auth.uid()
-- (public.current_profile_id() -> profiles.id), nunca por ID enviado pelo
-- frontend. Situacao, data, responsavel e evento de historico sao gravados na
-- MESMA transacao: qualquer falha gera rollback total (nenhum estado parcial).
--
-- A chave estrangeira, a RLS e a maquina de estados sao preservadas.

begin;

create or replace function public.confirmar_envio_solicitacao_nota(p_solicitacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id uuid;
  v_sol public.solicitacoes_nota_fiscal%rowtype;
begin
  if not public.has_role(ARRAY['admin']::public.app_role[]) then
    raise exception 'Acesso negado. Perfil nao autorizado para confirmar o envio.';
  end if;

  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'Perfil do usuario autenticado nao encontrado.';
  end if;

  select * into v_sol
  from public.solicitacoes_nota_fiscal
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitacao de nota fiscal nao encontrada.';
  end if;

  if v_sol.situacao is distinct from 'preparada' then
    raise exception 'Somente solicitacoes em estado "preparada" podem ter o envio confirmado. Estado atual: %', v_sol.situacao;
  end if;

  update public.solicitacoes_nota_fiscal
  set situacao = 'solicitada',
      enviado_por = v_profile_id,
      enviado_em = now(),
      updated_at = now()
  where id = p_solicitacao_id;

  insert into public.solicitacao_nota_fiscal_eventos (
    solicitacao_id, situacao_anterior, situacao_nova,
    realizado_por, ocorrido_em, detalhes
  ) values (
    p_solicitacao_id, 'preparada', 'solicitada',
    v_profile_id, now(),
    jsonb_build_object(
      'acao', 'confirmar_envio_humano',
      'preceptor_id', v_sol.preceptor_id,
      'competencia', v_sol.competencia,
      'valor_total', v_sol.valor_total_solicitado
    )
  );

  return jsonb_build_object(
    'sucesso', true,
    'id', p_solicitacao_id,
    'situacao', 'solicitada',
    'enviado_por', v_profile_id,
    'enviado_em', now()
  );
end;
$function$;

revoke all on function public.confirmar_envio_solicitacao_nota(uuid) from public, anon;
grant execute on function public.confirmar_envio_solicitacao_nota(uuid) to authenticated;

commit;
