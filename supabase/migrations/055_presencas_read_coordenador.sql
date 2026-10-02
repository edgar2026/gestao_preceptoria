-- 055: libera leitura de presencas para o perfil Coordenacao (role real: 'coordenador'),
-- restrita aos vinculos de Internato associados ao proprio perfil.
-- Motivo: a policy anterior so reconhecia as roles 'admin'/'coordenacao', e o perfil
-- de Coordenacao nao era preceptor, retornando 0 linhas e deixando o calendario azul.

drop policy if exists "presencas_read" on public.presencas;

create policy "presencas_read"
on public.presencas
as permissive
for select
to public
using (
  has_role(ARRAY['admin','coordenacao']::public.app_role[])
  or exists (
    select 1
    from public.preceptores p
    where p.id = presencas.preceptor_id
      and p.profile_id = current_profile_id()
  )
  or (
    has_role(ARRAY['coordenador','coordenacao']::public.app_role[])
    and coalesce(
      presencas.vinculo_internato_id,
      (
        select e.vinculo_internato_id
        from public.escalas e
        where e.id = presencas.escala_id
      )
    ) = any (public.get_coordinator_vinculo_ids())
  )
);
