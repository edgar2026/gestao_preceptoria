-- ============================================================================
-- MIGRACAO 002: ACESSO INDIVIDUAL DE PRESENCA POR PRECEPTOR
-- Cada preceptor ativo recebe um link unico /p/:token com token aleatorio.
-- Token aberto nunca e armazenado; apenas o hash SHA-256 fica gravado.
-- Funcoes: gerar, validar, buscar escalas, registrar, bloquear, renovar.
--
-- EXECUCAO:
-- 1. Execute este arquivo apos a migracao 001 no Supabase SQL Editor.
-- 2. O token retornado por gerar_acesso_presenca deve ser copiado e
--    entregue ao preceptor. Depois de fechada a janela, o token bruto
--    nao pode ser recuperado.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- TABELA DE ACESSO
-- --------------------------------------------------------------------------
create table if not exists public.preceptor_acesso_presenca (
  id uuid primary key default gen_random_uuid(),
  preceptor_id uuid not null references public.preceptores(id) on delete cascade,
  token_hash text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expira_em timestamptz,
  ultimo_acesso_em timestamptz,
  bloqueado boolean not null default false,
  bloqueado_em timestamptz,
  revogado boolean not null default false,
  revogado_em timestamptz,
  created_by uuid references public.profiles(id)
);

create index if not exists idx_acesso_preceptor on public.preceptor_acesso_presenca(preceptor_id, ativo);
create index if not exists idx_acesso_hash on public.preceptor_acesso_presenca(token_hash);

-- Permitir registro de presenca via token sem perfil autenticado
alter table public.presencas alter column registrado_por drop not null;

-- --------------------------------------------------------------------------
-- FUNCAO: Gerar acesso de presenca (admin)
-- Revoga tokens anteriores ativos e cria um novo.
-- Retorna o token bruto (exibido apenas uma vez).
-- --------------------------------------------------------------------------
create or replace function public.gerar_acesso_presenca(
  p_preceptor_id uuid
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_raw text;
  v_hash text;
  v_profile_id uuid;
begin
  if not public.has_role(array['administrador','academico']::public.app_role[]) then
    raise exception 'Acesso negado';
  end if;

  if not exists(select 1 from public.preceptores where id=p_preceptor_id and status='ativo') then
    raise exception 'Preceptor nao encontrado ou inativo';
  end if;

  -- Revogar tokens anteriores
  update public.preceptor_acesso_presenca
  set revogado=true, revogado_em=now(), ativo=false
  where preceptor_id=p_preceptor_id and ativo=true and not revogado;

  -- Gerar novo token
  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_raw::bytea), 'hex');
  v_profile_id := public.current_profile_id();

  insert into public.preceptor_acesso_presenca(preceptor_id, token_hash, created_by)
  values(p_preceptor_id, v_hash, v_profile_id);

  return v_raw;
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Validar token e retornar dados do preceptor (publica, sem auth)
-- --------------------------------------------------------------------------
create or replace function public.validar_acesso_token(
  p_token text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
begin
  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into v_acesso
  from public.preceptor_acesso_presenca
  where token_hash = v_hash;

  if v_acesso.id is null then
    return jsonb_build_object('valido', false, 'erro', 'Link invalido ou inexistente.');
  end if;

  if v_acesso.revogado then
    return jsonb_build_object('valido', false, 'erro', 'Este acesso foi revogado. Solicite um novo link ao administrador.');
  end if;

  if v_acesso.bloqueado then
    return jsonb_build_object('valido', false, 'erro', 'Este acesso foi bloqueado pelo administrador.');
  end if;

  if not v_acesso.ativo then
    return jsonb_build_object('valido', false, 'erro', 'Este acesso esta inativo.');
  end if;

  if v_acesso.expira_em is not null and v_acesso.expira_em < now() then
    return jsonb_build_object('valido', false, 'erro', 'Este acesso expirou. Solicite um novo link ao administrador.');
  end if;

  select * into v_preceptor
  from public.preceptores
  where id = v_acesso.preceptor_id and status='ativo';

  if v_preceptor.id is null then
    return jsonb_build_object('valido', false, 'erro', 'Preceptor nao encontrado ou inativo.');
  end if;

  update public.preceptor_acesso_presenca
  set ultimo_acesso_em = now()
  where id = v_acesso.id;

  return jsonb_build_object(
    'valido', true,
    'preceptor_id', v_preceptor.id,
    'nome', v_preceptor.nome_completo
  );
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Buscar escalas de hoje do preceptor via token
-- --------------------------------------------------------------------------
create or replace function public.buscar_escalas_token(
  p_token text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_row jsonb;
  v_rec record;
  v_dow smallint;
begin
  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into v_acesso
  from public.preceptor_acesso_presenca
  where token_hash = v_hash and ativo=true and not bloqueado and not revogado;

  if v_acesso.id is null then
    return v_result;
  end if;

  if v_acesso.expira_em is not null and v_acesso.expira_em < now() then
    return v_result;
  end if;

  v_dow := extract(dow from current_date)::smallint;

  for v_rec in
    select
      e.id as escala_id,
      e.tipo_atuacao,
      e.turno,
      e.hora_inicio,
      e.hora_fim,
      case when e.tipo_atuacao='adm' then d.nome else i.nome end as atividade_nome,
      l.nome as local_nome,
      coalesce(s.nome, '-') as setor_nome,
      case when e.tipo_atuacao='adm' then e.vinculo_adm_id else e.vinculo_internato_id end as vinculo_id,
      vl.local_id,
      vl.setor_id
    from public.escalas e
    left join public.vinculo_locais vl on vl.id = e.vinculo_local_id
    left join public.locais l on l.id = vl.local_id
    left join public.setores s on s.id = vl.setor_id
    left join public.vinculos_adm va on va.id = e.vinculo_adm_id
    left join public.vinculos_internato vi on vi.id = e.vinculo_internato_id
    left join public.disciplinas d on d.id = va.disciplina_id
    left join public.internatos i on i.id = vi.internato_id
    where e.status = 'ativo'
      and e.dia_semana = v_dow
      and current_date between e.data_inicio and e.data_fim
      and (
        (e.tipo_atuacao='adm' and va.preceptor_id = v_acesso.preceptor_id)
        or
        (e.tipo_atuacao='internato' and vi.preceptor_id = v_acesso.preceptor_id)
      )
  loop
    v_row := jsonb_build_object(
      'escala_id', v_rec.escala_id,
      'tipo_atuacao', v_rec.tipo_atuacao,
      'turno', v_rec.turno,
      'atividade', v_rec.atividade_nome,
      'local', v_rec.local_nome,
      'setor', v_rec.setor_nome,
      'local_id', v_rec.local_id,
      'hora_inicio', to_char(v_rec.hora_inicio, 'HH24:MI'),
      'hora_fim', to_char(v_rec.hora_fim, 'HH24:MI'),
      'ja_registrada', exists(
        select 1 from public.presencas p
        where p.escala_id = v_rec.escala_id
          and p.turno = v_rec.turno
          and p.data_presenca = current_date
          and p.status in ('confirmada','ajustada')
      )
    );
    v_result := v_result || v_row;
  end loop;

  return v_result;
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Registrar presenca via token
-- --------------------------------------------------------------------------
create or replace function public.registrar_presenca_token(
  p_token text,
  p_escala_id uuid,
  p_turno public.turno
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hash text;
  v_acesso public.preceptor_acesso_presenca%rowtype;
  v_preceptor public.preceptores%rowtype;
  v_escala public.escalas%rowtype;
  v_local public.vinculo_locais%rowtype;
  v_id uuid;
  v_registrado_por uuid;
begin
  v_hash := encode(sha256(p_token::bytea), 'hex');

  select * into v_acesso
  from public.preceptor_acesso_presenca
  where token_hash = v_hash and ativo=true and not bloqueado and not revogado;

  if v_acesso.id is null then
    return jsonb_build_object('sucesso', false, 'erro', 'Acesso invalido.');
  end if;

  if v_acesso.expira_em is not null and v_acesso.expira_em < now() then
    return jsonb_build_object('sucesso', false, 'erro', 'Acesso expirado.');
  end if;

  select * into v_preceptor
  from public.preceptores
  where id = v_acesso.preceptor_id and status='ativo';

  if v_preceptor.id is null then
    return jsonb_build_object('sucesso', false, 'erro', 'Preceptor inativo.');
  end if;

  select * into v_escala
  from public.escalas
  where id = p_escala_id and status='ativo';

  if v_escala.id is null then
    return jsonb_build_object('sucesso', false, 'erro', 'Escala invalida.');
  end if;

  if v_escala.turno <> p_turno then
    return jsonb_build_object('sucesso', false, 'erro', 'Turno nao corresponde a escala.');
  end if;

  if extract(dow from current_date)::smallint <> v_escala.dia_semana then
    return jsonb_build_object('sucesso', false, 'erro', 'Escala nao corresponde ao dia atual.');
  end if;

  if current_date not between v_escala.data_inicio and v_escala.data_fim then
    return jsonb_build_object('sucesso', false, 'erro', 'Escala fora da vigencia.');
  end if;

  if v_escala.tipo_atuacao='adm' and not exists(
    select 1 from public.vinculos_adm v
    where v.id=v_escala.vinculo_adm_id and v.preceptor_id=v_preceptor.id
  ) then
    return jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  end if;

  if v_escala.tipo_atuacao='internato' and not exists(
    select 1 from public.vinculos_internato v
    where v.id=v_escala.vinculo_internato_id and v.preceptor_id=v_preceptor.id
  ) then
    return jsonb_build_object('sucesso', false, 'erro', 'Escala nao pertence a este preceptor.');
  end if;

  -- Verificar duplicidade (mesma escala + turno + data)
  if exists(
    select 1 from public.presencas
    where preceptor_id=v_preceptor.id
      and data_presenca=current_date
      and turno=p_turno
      and escala_id=p_escala_id
      and status in ('confirmada','ajustada')
  ) then
    return jsonb_build_object('sucesso', false, 'erro', 'Presenca ja registrada para esta escala e turno hoje.');
  end if;

  select * into v_local from public.vinculo_locais where id=v_escala.vinculo_local_id;

  -- Usar created_by do acesso como registrado_por; fallback para admin
  v_registrado_por := v_acesso.created_by;
  if v_registrado_por is null then
    select p.id into v_registrado_por
    from public.profiles p
    join public.user_roles ur on ur.profile_id=p.id
    where ur.role='administrador' and p.ativo=true
    limit 1;
  end if;

  insert into public.presencas(
    preceptor_id, escala_id, tipo_atuacao,
    vinculo_adm_id, vinculo_internato_id,
    local_id, setor_id,
    data_presenca, turno, status, origem, registrado_por
  ) values (
    v_preceptor.id, v_escala.id, v_escala.tipo_atuacao,
    v_escala.vinculo_adm_id, v_escala.vinculo_internato_id,
    v_local.local_id, v_local.setor_id,
    current_date, p_turno, 'confirmada', 'preceptor',
    v_registrado_por
  )
  returning id into v_id;

  update public.preceptor_acesso_presenca
  set ultimo_acesso_em = now()
  where id = v_acesso.id;

  return jsonb_build_object('sucesso', true, 'presenca_id', v_id);
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Bloquear acesso (admin)
-- --------------------------------------------------------------------------
create or replace function public.bloquear_acesso_preceptor(
  p_preceptor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['administrador','academico']::public.app_role[]) then
    raise exception 'Acesso negado';
  end if;

  update public.preceptor_acesso_presenca
  set bloqueado=true, bloqueado_em=now(), ativo=false
  where preceptor_id=p_preceptor_id and ativo=true and not revogado;
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Revogar acesso (admin)
-- --------------------------------------------------------------------------
create or replace function public.revogar_acesso_preceptor(
  p_preceptor_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['administrador','academico']::public.app_role[]) then
    raise exception 'Acesso negado';
  end if;

  update public.preceptor_acesso_presenca
  set revogado=true, revogado_em=now(), ativo=false
  where preceptor_id=p_preceptor_id and ativo=true;
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Renovar acesso (gera novo e invalida anteriores)
-- --------------------------------------------------------------------------
create or replace function public.renovar_acesso_preceptor(
  p_preceptor_id uuid
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_raw text;
  v_hash text;
  v_profile_id uuid;
begin
  if not public.has_role(array['administrador','academico']::public.app_role[]) then
    raise exception 'Acesso negado';
  end if;

  if not exists(select 1 from public.preceptores where id=p_preceptor_id and status='ativo') then
    raise exception 'Preceptor nao encontrado ou inativo';
  end if;

  update public.preceptor_acesso_presenca
  set revogado=true, revogado_em=now(), ativo=false
  where preceptor_id=p_preceptor_id and ativo=true and not revogado;

  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_raw::bytea), 'hex');
  v_profile_id := public.current_profile_id();

  insert into public.preceptor_acesso_presenca(preceptor_id, token_hash, created_by)
  values(p_preceptor_id, v_hash, v_profile_id);

  return v_raw;
end;
$$;

-- --------------------------------------------------------------------------
-- FUNCAO: Consultar status do acesso (admin)
-- --------------------------------------------------------------------------
create or replace function public.consultar_acesso_preceptor(
  p_preceptor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_acesso public.preceptor_acesso_presenca%rowtype;
begin
  if not public.has_role(array['administrador','academico','coordenador']::public.app_role[]) then
    raise exception 'Acesso negado';
  end if;

  select * into v_acesso
  from public.preceptor_acesso_presenca
  where preceptor_id=p_preceptor_id
  order by created_at desc limit 1;

  if v_acesso.id is null then
    return jsonb_build_object('existe', false);
  end if;

  return jsonb_build_object(
    'existe', true,
    'id', v_acesso.id,
    'ativo', v_acesso.ativo,
    'bloqueado', v_acesso.bloqueado,
    'revogado', v_acesso.revogado,
    'created_at', v_acesso.created_at,
    'expira_em', v_acesso.expira_em,
    'ultimo_acesso_em', v_acesso.ultimo_acesso_em,
    'bloqueado_em', v_acesso.bloqueado_em,
    'revogado_em', v_acesso.revogado_em
  );
end;
$$;

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table public.preceptor_acesso_presenca enable row level security;

create policy "acesso_admin_read" on public.preceptor_acesso_presenca
  for select to authenticated
  using (public.has_role(array['administrador','academico','coordenador']::public.app_role[]));

create policy "acesso_admin_write" on public.preceptor_acesso_presenca
  for all to authenticated
  using (public.has_role(array['administrador','academico']::public.app_role[]))
  with check (public.has_role(array['administrador','academico']::public.app_role[]));

create policy "acesso_own_select" on public.preceptor_acesso_presenca
  for select to authenticated
  using (exists(
    select 1 from public.preceptores p
    where p.id=preceptor_acesso_presenca.preceptor_id
      and p.profile_id=public.current_profile_id()
  ));

-- --------------------------------------------------------------------------
-- TRIGGERS
-- --------------------------------------------------------------------------
create trigger trg_acesso_presenca_audit
  after insert or update or delete on public.preceptor_acesso_presenca
  for each row execute function public.audit_row_change();

create trigger trg_acesso_presenca_updated
  before update on public.preceptor_acesso_presenca
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- GRANTS
-- --------------------------------------------------------------------------
grant execute on function public.validar_acesso_token(text) to anon;
grant execute on function public.buscar_escalas_token(text) to anon;
grant execute on function public.registrar_presenca_token(text, uuid, public.turno) to anon;
grant execute on function public.gerar_acesso_presenca(uuid) to authenticated;
grant execute on function public.bloquear_acesso_preceptor(uuid) to authenticated;
grant execute on function public.revogar_acesso_preceptor(uuid) to authenticated;
grant execute on function public.renovar_acesso_preceptor(uuid) to authenticated;
grant execute on function public.consultar_acesso_preceptor(uuid) to authenticated;

-- Grant usage on presencas for the SECURITY DEFINER functions
grant select, insert on public.presencas to anon;

commit;

-- ============================================================================
-- PARA TESTE: Gerar token para um preceptor existente e testar a rota /p/:token
-- Substitua o UUID pelo ID de um preceptor ativo no seu banco:
--
-- select public.gerar_acesso_presenca('UUID_DO_PRECEPTOR');
-- -- Copie o token retornado e acesse: https://SEU-PROJETO.supabase.co/p/TOKEN_AQUI
-- ============================================================================
