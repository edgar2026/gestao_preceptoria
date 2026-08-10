-- ============================================================================
-- SISTEMA DE GESTAO DE PRECEPTORIA - SUPABASE / POSTGRESQL
-- Versao: 1.0
-- Objetivo: criar a estrutura completa do sistema administrativo, financeiro
-- e da rota mobile de registro de presenca dos preceptores.
--
-- EXECUCAO:
-- 1. Crie um projeto Supabase vazio.
-- 2. Abra SQL Editor > New query.
-- 3. Cole este arquivo inteiro e execute uma unica vez.
-- 4. Crie o primeiro usuario no Supabase Auth.
-- 5. No SQL Editor, atribua o papel administrador ao perfil criado.
--
-- IMPORTANTE:
-- - Este script habilita RLS em todas as tabelas publicas.
-- - O service_role nunca deve ser exposto no navegador.
-- - Valores monetarios usam numeric(14,2), nunca float.
-- - Competencias fechadas nao podem ser recalculadas pela funcao padrao.
-- ============================================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- --------------------------------------------------------------------------
-- TIPOS
-- --------------------------------------------------------------------------

do $$ begin create type public.app_role as enum ('administrador','academico','financeiro','coordenador','auditor','preceptor'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_registro as enum ('ativo','inativo','pendente','bloqueado','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_atuacao as enum ('adm','internato'); exception when duplicate_object then null; end $$;
do $$ begin create type public.modalidade_pagamento as enum ('nfs','rpa','clt','sem_pagamento'); exception when duplicate_object then null; end $$;
do $$ begin create type public.turno as enum ('manha','tarde','noite'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_presenca as enum ('confirmada','ajustada','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.origem_presenca as enum ('preceptor','administrador','importacao'); exception when duplicate_object then null; end $$;
do $$ begin create type public.forma_calculo as enum ('por_turno','por_hora','por_grupo','mensal_fixo','rateio','adicional','ajuste','desconto','estorno'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_competencia as enum ('rascunho','aberta','em_conferencia','fechada','reaberta','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_calculo as enum ('rascunho','calculado','em_validacao','aprovado','rejeitado','fechado','pago','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_item_calculo as enum ('presenca','fixo','rateio','adicional','ajuste','desconto','estorno'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_aprovacao as enum ('pendente','aprovado','rejeitado','dispensado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_aprovacao as enum ('academica','financeira','saldo','ajuste','reabertura'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_processo as enum ('rascunho','aberto','em_andamento','deferido','indeferido','concluido','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.status_pagamento as enum ('pendente','programado','pago','estornado','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tipo_documento as enum ('cpf','rg','conselho','cnpj','contrato','nota_fiscal','rpa','comprovante','outro'); exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- FUNCOES UTILITARIAS
-- --------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- IDENTIDADE, PERFIS E PERMISSOES
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome_completo text not null,
  email text,
  telefone text,
  avatar_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique(profile_id, role)
);

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select p.id from public.profiles p where p.user_id = auth.uid() and p.ativo = true limit 1;
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.profile_id
    where p.user_id = auth.uid() and p.ativo = true and ur.ativo = true and ur.role = any(roles)
  );
$$;

create table if not exists public.preceptores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  nome_completo text not null,
  nome_social text,
  cpf text,
  rg text,
  profissao text,
  conselho_tipo text,
  conselho_numero text,
  email text,
  telefone text,
  modalidade_padrao public.modalidade_pagamento,
  possui_vinculo_clt boolean not null default false,
  status public.status_registro not null default 'ativo',
  observacoes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preceptores_cpf_unique unique (cpf),
  constraint cpf_formato check (cpf is null or cpf ~ '^[0-9]{11}$')
);

create table if not exists public.preceptor_documentos (
  id uuid primary key default gen_random_uuid(),
  preceptor_id uuid not null references public.preceptores(id) on delete cascade,
  tipo public.tipo_documento not null,
  numero text,
  arquivo_path text,
  data_emissao date,
  data_validade date,
  observacoes text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- ESTRUTURA ORGANIZACIONAL E ACADEMICA
-- --------------------------------------------------------------------------
create table if not exists public.ies (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  sigla text,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cursos (
  id uuid primary key default gen_random_uuid(),
  ies_id uuid not null references public.ies(id),
  nome text not null,
  codigo text,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(ies_id, nome)
);

create table if not exists public.semestres (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  codigo text not null,
  data_inicio date not null,
  data_fim date not null,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(curso_id, codigo),
  check (data_fim >= data_inicio)
);

create table if not exists public.periodos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  numero smallint not null check (numero > 0),
  nome text,
  status public.status_registro not null default 'ativo',
  unique(curso_id, numero)
);

create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  nome text not null,
  codigo text,
  carga_horaria numeric(8,2),
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(curso_id, nome)
);

create table if not exists public.internatos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  numero smallint not null check (numero > 0),
  nome text not null,
  periodo_id uuid references public.periodos(id),
  carga_horaria numeric(8,2),
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(curso_id, numero)
);

create table if not exists public.locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text,
  cnpj text,
  endereco text,
  cidade text,
  uf char(2),
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locais(id) on delete cascade,
  nome text not null,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(local_id, nome)
);

create table if not exists public.feriados (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descricao text not null,
  abrangencia text not null default 'nacional',
  local_id uuid references public.locais(id),
  ponto_facultativo boolean not null default false,
  unique(data, abrangencia, local_id)
);

-- --------------------------------------------------------------------------
-- FAVORECIDOS E DADOS FINANCEIROS
-- --------------------------------------------------------------------------
create table if not exists public.favorecidos (
  id uuid primary key default gen_random_uuid(),
  tipo_pessoa char(2) not null check (tipo_pessoa in ('PF','PJ')),
  nome_razao_social text not null,
  nome_fantasia text,
  cpf text,
  cnpj text,
  email_financeiro text,
  telefone text,
  dados_bancarios jsonb not null default '{}'::jsonb,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((tipo_pessoa='PF' and cpf is not null) or (tipo_pessoa='PJ' and cnpj is not null)),
  unique (cpf),
  unique (cnpj)
);

create table if not exists public.preceptor_favorecidos (
  id uuid primary key default gen_random_uuid(),
  preceptor_id uuid not null references public.preceptores(id) on delete cascade,
  favorecido_id uuid not null references public.favorecidos(id),
  modalidade public.modalidade_pagamento not null,
  data_inicio date not null,
  data_fim date,
  principal boolean not null default true,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio)
);

-- --------------------------------------------------------------------------
-- VINCULOS ADM E INTERNATO
-- --------------------------------------------------------------------------
create table if not exists public.vinculos_adm (
  id uuid primary key default gen_random_uuid(),
  preceptor_id uuid not null references public.preceptores(id),
  semestre_id uuid not null references public.semestres(id),
  disciplina_id uuid not null references public.disciplinas(id),
  periodo_id uuid not null references public.periodos(id),
  data_inicio date not null,
  data_fim date not null,
  status public.status_registro not null default 'ativo',
  observacoes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio),
  unique(preceptor_id, semestre_id, disciplina_id, periodo_id, data_inicio)
);

create table if not exists public.vinculos_internato (
  id uuid primary key default gen_random_uuid(),
  preceptor_id uuid not null references public.preceptores(id),
  semestre_id uuid not null references public.semestres(id),
  internato_id uuid not null references public.internatos(id),
  data_inicio date not null,
  data_fim date not null,
  status public.status_registro not null default 'ativo',
  observacoes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio),
  unique(preceptor_id, semestre_id, internato_id, data_inicio)
);

create table if not exists public.vinculo_locais (
  id uuid primary key default gen_random_uuid(),
  tipo_atuacao public.tipo_atuacao not null,
  vinculo_adm_id uuid references public.vinculos_adm(id) on delete cascade,
  vinculo_internato_id uuid references public.vinculos_internato(id) on delete cascade,
  local_id uuid not null references public.locais(id),
  setor_id uuid references public.setores(id),
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  check (
    (tipo_atuacao='adm' and vinculo_adm_id is not null and vinculo_internato_id is null)
    or
    (tipo_atuacao='internato' and vinculo_internato_id is not null and vinculo_adm_id is null)
  )
);

create table if not exists public.escalas (
  id uuid primary key default gen_random_uuid(),
  tipo_atuacao public.tipo_atuacao not null,
  vinculo_adm_id uuid references public.vinculos_adm(id) on delete cascade,
  vinculo_internato_id uuid references public.vinculos_internato(id) on delete cascade,
  vinculo_local_id uuid not null references public.vinculo_locais(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  turno public.turno not null,
  hora_inicio time,
  hora_fim time,
  data_inicio date not null,
  data_fim date not null,
  status public.status_registro not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio),
  check (hora_fim is null or hora_inicio is null or hora_fim > hora_inicio),
  check (
    (tipo_atuacao='adm' and vinculo_adm_id is not null and vinculo_internato_id is null)
    or
    (tipo_atuacao='internato' and vinculo_internato_id is not null and vinculo_adm_id is null)
  ),
  unique(vinculo_local_id, dia_semana, turno, data_inicio)
);

-- --------------------------------------------------------------------------
-- PRESENCAS E AJUSTES
-- --------------------------------------------------------------------------
create table if not exists public.presencas (
  id uuid primary key default gen_random_uuid(),
  preceptor_id uuid not null references public.preceptores(id),
  escala_id uuid references public.escalas(id),
  tipo_atuacao public.tipo_atuacao not null,
  vinculo_adm_id uuid references public.vinculos_adm(id),
  vinculo_internato_id uuid references public.vinculos_internato(id),
  local_id uuid not null references public.locais(id),
  setor_id uuid references public.setores(id),
  data_presenca date not null,
  turno public.turno not null,
  status public.status_presenca not null default 'confirmada',
  origem public.origem_presenca not null default 'preceptor',
  registrado_por uuid not null references public.profiles(id),
  registrado_em timestamptz not null default now(),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (tipo_atuacao='adm' and vinculo_adm_id is not null and vinculo_internato_id is null)
    or
    (tipo_atuacao='internato' and vinculo_internato_id is not null and vinculo_adm_id is null)
  ),
  unique(preceptor_id, data_presenca, turno, local_id, tipo_atuacao)
);

create table if not exists public.ajustes_presenca (
  id uuid primary key default gen_random_uuid(),
  presenca_id uuid references public.presencas(id),
  preceptor_id uuid not null references public.preceptores(id),
  tipo_ajuste text not null check (tipo_ajuste in ('inclusao','alteracao','cancelamento')),
  dados_anteriores jsonb,
  dados_novos jsonb not null,
  justificativa text not null check (length(trim(justificativa)) >= 10),
  realizado_por uuid not null references public.profiles(id),
  realizado_em timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- REGRAS FINANCEIRAS
-- --------------------------------------------------------------------------
create table if not exists public.regras_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_atuacao public.tipo_atuacao,
  curso_id uuid references public.cursos(id),
  disciplina_id uuid references public.disciplinas(id),
  internato_id uuid references public.internatos(id),
  local_id uuid references public.locais(id),
  setor_id uuid references public.setores(id),
  forma_calculo public.forma_calculo not null,
  valor numeric(14,2) not null default 0,
  quantidade_base numeric(12,4) not null default 1,
  prioridade integer not null default 100,
  data_inicio date not null,
  data_fim date,
  exige_presenca boolean not null default true,
  permite_acumulo boolean not null default true,
  status public.status_registro not null default 'ativo',
  observacoes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim is null or data_fim >= data_inicio)
);

create table if not exists public.regra_preceptores (
  regra_id uuid not null references public.regras_financeiras(id) on delete cascade,
  preceptor_id uuid not null references public.preceptores(id) on delete cascade,
  primary key(regra_id, preceptor_id)
);

create table if not exists public.rateios_financeiros (
  id uuid primary key default gen_random_uuid(),
  regra_id uuid not null references public.regras_financeiras(id) on delete cascade,
  preceptor_id uuid not null references public.preceptores(id),
  percentual numeric(7,4),
  valor_fixo numeric(14,2),
  data_inicio date not null,
  data_fim date,
  check ((percentual is not null) <> (valor_fixo is not null)),
  check (percentual is null or (percentual > 0 and percentual <= 100)),
  check (data_fim is null or data_fim >= data_inicio)
);

-- --------------------------------------------------------------------------
-- COMPETENCIAS, CALCULOS E APROVACOES
-- --------------------------------------------------------------------------
create table if not exists public.competencias (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id),
  ano smallint not null check (ano between 2020 and 2100),
  mes smallint not null check (mes between 1 and 12),
  data_inicio date not null,
  data_fim date not null,
  status public.status_competencia not null default 'rascunho',
  abertura_em timestamptz,
  fechamento_em timestamptz,
  aberto_por uuid references public.profiles(id),
  fechado_por uuid references public.profiles(id),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(curso_id, ano, mes),
  check (data_fim >= data_inicio)
);

create table if not exists public.calculos (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias(id),
  preceptor_id uuid not null references public.preceptores(id),
  favorecido_id uuid references public.favorecidos(id),
  modalidade public.modalidade_pagamento,
  status public.status_calculo not null default 'rascunho',
  total_bruto numeric(14,2) not null default 0,
  total_descontos numeric(14,2) not null default 0,
  total_liquido numeric(14,2) generated always as (total_bruto - total_descontos) stored,
  versao integer not null default 1,
  calculado_em timestamptz,
  calculado_por uuid references public.profiles(id),
  fechado_em timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(competencia_id, preceptor_id, versao)
);

create table if not exists public.calculo_itens (
  id uuid primary key default gen_random_uuid(),
  calculo_id uuid not null references public.calculos(id) on delete cascade,
  tipo public.tipo_item_calculo not null,
  regra_id uuid references public.regras_financeiras(id),
  presenca_id uuid references public.presencas(id),
  descricao text not null,
  quantidade numeric(12,4) not null default 1,
  valor_unitario numeric(14,2) not null,
  valor_total numeric(14,2) generated always as (round(quantidade * valor_unitario, 2)) stored,
  referencia jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  calculo_id uuid references public.calculos(id) on delete cascade,
  ajuste_presenca_id uuid references public.ajustes_presenca(id) on delete cascade,
  tipo public.tipo_aprovacao not null,
  ordem smallint not null default 1,
  status public.status_aprovacao not null default 'pendente',
  responsavel_profile_id uuid references public.profiles(id),
  decidido_por uuid references public.profiles(id),
  decidido_em timestamptz,
  comentario text,
  created_at timestamptz not null default now(),
  check (calculo_id is not null or ajuste_presenca_id is not null)
);

-- --------------------------------------------------------------------------
-- SALDOS, PROCESSOS E PAGAMENTOS
-- --------------------------------------------------------------------------
create table if not exists public.saldos_autorizados (
  id uuid primary key default gen_random_uuid(),
  favorecido_id uuid not null references public.favorecidos(id),
  curso_id uuid not null references public.cursos(id),
  numero_ch text not null,
  numero_movimento text,
  valor_autorizado numeric(14,2) not null check (valor_autorizado >= 0),
  data_inicio date not null,
  data_fim date,
  status public.status_registro not null default 'ativo',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(favorecido_id, numero_ch),
  check (data_fim is null or data_fim >= data_inicio)
);

create table if not exists public.saldo_movimentos (
  id uuid primary key default gen_random_uuid(),
  saldo_id uuid not null references public.saldos_autorizados(id),
  calculo_id uuid references public.calculos(id),
  tipo text not null check (tipo in ('reserva','consumo','estorno','ajuste')),
  valor numeric(14,2) not null,
  descricao text not null,
  realizado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.processos_pagamento (
  id uuid primary key default gen_random_uuid(),
  competencia_id uuid not null references public.competencias(id),
  favorecido_id uuid not null references public.favorecidos(id),
  saldo_id uuid references public.saldos_autorizados(id),
  numero_processo text,
  numero_ch text,
  numero_movimento text,
  valor numeric(14,2) not null default 0,
  status public.status_processo not null default 'rascunho',
  deferimento_coordenacao public.status_aprovacao not null default 'pendente',
  observacoes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processo_calculos (
  processo_id uuid not null references public.processos_pagamento(id) on delete cascade,
  calculo_id uuid not null references public.calculos(id),
  valor_alocado numeric(14,2) not null check (valor_alocado >= 0),
  primary key(processo_id, calculo_id)
);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos_pagamento(id),
  favorecido_id uuid not null references public.favorecidos(id),
  modalidade public.modalidade_pagamento not null,
  valor_bruto numeric(14,2) not null,
  valor_descontos numeric(14,2) not null default 0,
  valor_liquido numeric(14,2) generated always as (valor_bruto - valor_descontos) stored,
  data_programada date,
  data_pagamento date,
  status public.status_pagamento not null default 'pendente',
  comprovante_path text,
  observacoes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- NOTIFICACOES, CONFIGURACOES E AUDITORIA
-- --------------------------------------------------------------------------
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  tipo text not null default 'info',
  link text,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  tabela text not null,
  registro_id text,
  operacao text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  profile_id uuid references public.profiles(id),
  user_id uuid,
  ocorrido_em timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- VIEWS
-- --------------------------------------------------------------------------
create or replace view public.v_saldos_disponiveis as
select
  s.id,
  s.favorecido_id,
  s.curso_id,
  s.numero_ch,
  s.valor_autorizado,
  coalesce(sum(case when m.tipo in ('reserva','consumo') then m.valor when m.tipo='estorno' then -m.valor else m.valor end),0)::numeric(14,2) as valor_utilizado,
  (s.valor_autorizado - coalesce(sum(case when m.tipo in ('reserva','consumo') then m.valor when m.tipo='estorno' then -m.valor else m.valor end),0))::numeric(14,2) as valor_disponivel,
  s.status
from public.saldos_autorizados s
left join public.saldo_movimentos m on m.saldo_id=s.id
group by s.id;

create or replace view public.v_preceptores_ativos as
select p.*, pr.user_id
from public.preceptores p
left join public.profiles pr on pr.id=p.profile_id
where p.status='ativo';

-- --------------------------------------------------------------------------
-- TRIGGERS DE PERFIL, UPDATED_AT E AUDITORIA
-- --------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles(user_id,nome_completo,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'nome_completo',new.email,'Novo usuario'),new.email)
  on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_id text; v_profile uuid;
begin
  v_profile := public.current_profile_id();
  if tg_op='DELETE' then v_id := old.id::text; else v_id := new.id::text; end if;
  insert into public.audit_logs(tabela,registro_id,operacao,dados_anteriores,dados_novos,profile_id,user_id)
  values(tg_table_name,v_id,tg_op,case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,v_profile,auth.uid());
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','preceptores','ies','cursos','semestres','disciplinas','internatos','locais','setores','favorecidos','preceptor_favorecidos','vinculos_adm','vinculos_internato','escalas','presencas','regras_financeiras','competencias','calculos','saldos_autorizados','processos_pagamento','pagamentos'] loop
    execute format('drop trigger if exists trg_%I_updated on public.%I',t,t);
    execute format('create trigger trg_%I_updated before update on public.%I for each row execute function public.set_updated_at()',t,t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['preceptores','favorecidos','vinculos_adm','vinculos_internato','escalas','presencas','ajustes_presenca','regras_financeiras','competencias','calculos','calculo_itens','saldos_autorizados','saldo_movimentos','processos_pagamento','pagamentos','configuracoes'] loop
    execute format('drop trigger if exists trg_%I_audit on public.%I',t,t);
    execute format('create trigger trg_%I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()',t,t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- FUNCOES DE NEGOCIO
-- --------------------------------------------------------------------------
create or replace function public.registrar_presenca(
  p_escala_id uuid,
  p_turno public.turno
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_profile public.profiles;
  v_preceptor public.preceptores;
  v_escala public.escalas;
  v_local public.vinculo_locais;
  v_id uuid;
begin
  select * into v_profile from public.profiles where user_id=auth.uid() and ativo=true;
  if v_profile.id is null then raise exception 'Usuario sem perfil ativo'; end if;
  select * into v_preceptor from public.preceptores where profile_id=v_profile.id and status='ativo';
  if v_preceptor.id is null then raise exception 'Usuario nao esta vinculado a um preceptor ativo'; end if;
  select * into v_escala from public.escalas where id=p_escala_id and status='ativo';
  if v_escala.id is null then raise exception 'Escala invalida'; end if;
  if v_escala.turno<>p_turno then raise exception 'Turno diferente da escala'; end if;
  if extract(dow from current_date)::smallint<>v_escala.dia_semana then raise exception 'Escala nao corresponde ao dia atual'; end if;
  if current_date not between v_escala.data_inicio and v_escala.data_fim then raise exception 'Escala fora da vigencia'; end if;
  if v_escala.tipo_atuacao='adm' and not exists(select 1 from public.vinculos_adm v where v.id=v_escala.vinculo_adm_id and v.preceptor_id=v_preceptor.id) then raise exception 'Escala nao pertence ao preceptor'; end if;
  if v_escala.tipo_atuacao='internato' and not exists(select 1 from public.vinculos_internato v where v.id=v_escala.vinculo_internato_id and v.preceptor_id=v_preceptor.id) then raise exception 'Escala nao pertence ao preceptor'; end if;
  select * into v_local from public.vinculo_locais where id=v_escala.vinculo_local_id;
  insert into public.presencas(preceptor_id,escala_id,tipo_atuacao,vinculo_adm_id,vinculo_internato_id,local_id,setor_id,data_presenca,turno,status,origem,registrado_por)
  values(v_preceptor.id,v_escala.id,v_escala.tipo_atuacao,v_escala.vinculo_adm_id,v_escala.vinculo_internato_id,v_local.local_id,v_local.setor_id,current_date,p_turno,'confirmada','preceptor',v_profile.id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.recalcular_competencia(p_competencia_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_comp public.competencias;
  v_preceptor record;
  v_calculo_id uuid;
  v_count integer := 0;
begin
  if not public.has_role(array['administrador','financeiro']::public.app_role[]) then raise exception 'Acesso negado'; end if;
  select * into v_comp from public.competencias where id=p_competencia_id for update;
  if v_comp.id is null then raise exception 'Competencia nao encontrada'; end if;
  if v_comp.status not in ('aberta','reaberta','em_conferencia') then raise exception 'Competencia nao permite recalculo'; end if;

  for v_preceptor in
    select distinct p.preceptor_id
    from public.presencas p
    where p.data_presenca between v_comp.data_inicio and v_comp.data_fim and p.status in ('confirmada','ajustada')
    union
    select distinct rp.preceptor_id
    from public.regra_preceptores rp join public.regras_financeiras r on r.id=rp.regra_id
    where r.exige_presenca=false and r.status='ativo' and r.data_inicio<=v_comp.data_fim and coalesce(r.data_fim,v_comp.data_fim)>=v_comp.data_inicio
  loop
    insert into public.calculos(competencia_id,preceptor_id,status,calculado_em,calculado_por)
    values(v_comp.id,v_preceptor.preceptor_id,'calculado',now(),public.current_profile_id())
    on conflict(competencia_id,preceptor_id,versao) do update set status='calculado',calculado_em=now(),calculado_por=public.current_profile_id(),updated_at=now()
    returning id into v_calculo_id;

    delete from public.calculo_itens where calculo_id=v_calculo_id;

    insert into public.calculo_itens(calculo_id,tipo,regra_id,presenca_id,descricao,quantidade,valor_unitario,referencia)
    select v_calculo_id,'presenca',r.id,p.id,r.nome,1,r.valor,jsonb_build_object('data',p.data_presenca,'turno',p.turno,'local_id',p.local_id)
    from public.presencas p
    join lateral (
      select rf.* from public.regras_financeiras rf
      left join public.regra_preceptores rp on rp.regra_id=rf.id
      where rf.status='ativo' and rf.exige_presenca=true
        and p.data_presenca between rf.data_inicio and coalesce(rf.data_fim,p.data_presenca)
        and (rf.tipo_atuacao is null or rf.tipo_atuacao=p.tipo_atuacao)
        and (rf.local_id is null or rf.local_id=p.local_id)
        and (rf.setor_id is null or rf.setor_id=p.setor_id)
        and (rp.preceptor_id is null or rp.preceptor_id=p.preceptor_id)
        and rf.forma_calculo in ('por_turno','por_hora','por_grupo')
      order by rf.prioridade asc, rf.created_at desc limit 1
    ) r on true
    where p.preceptor_id=v_preceptor.preceptor_id and p.data_presenca between v_comp.data_inicio and v_comp.data_fim and p.status in ('confirmada','ajustada');

    insert into public.calculo_itens(calculo_id,tipo,regra_id,descricao,quantidade,valor_unitario,referencia)
    select v_calculo_id,
      case r.forma_calculo when 'mensal_fixo' then 'fixo'::public.tipo_item_calculo when 'rateio' then 'rateio'::public.tipo_item_calculo when 'adicional' then 'adicional'::public.tipo_item_calculo when 'desconto' then 'desconto'::public.tipo_item_calculo else 'ajuste'::public.tipo_item_calculo end,
      r.id,r.nome,r.quantidade_base,r.valor,jsonb_build_object('forma_calculo',r.forma_calculo)
    from public.regras_financeiras r
    join public.regra_preceptores rp on rp.regra_id=r.id and rp.preceptor_id=v_preceptor.preceptor_id
    where r.status='ativo' and r.exige_presenca=false and r.data_inicio<=v_comp.data_fim and coalesce(r.data_fim,v_comp.data_fim)>=v_comp.data_inicio;

    update public.calculos c set
      total_bruto=coalesce((select sum(i.valor_total) from public.calculo_itens i where i.calculo_id=c.id and i.tipo not in ('desconto','estorno')),0),
      total_descontos=abs(coalesce((select sum(i.valor_total) from public.calculo_itens i where i.calculo_id=c.id and i.tipo in ('desconto','estorno')),0)),
      updated_at=now()
    where c.id=v_calculo_id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

-- --------------------------------------------------------------------------
-- INDICES
-- --------------------------------------------------------------------------
create index if not exists idx_preceptores_status on public.preceptores(status);
create index if not exists idx_preceptores_profile on public.preceptores(profile_id);
create index if not exists idx_vinculos_adm_preceptor on public.vinculos_adm(preceptor_id,semestre_id,status);
create index if not exists idx_vinculos_internato_preceptor on public.vinculos_internato(preceptor_id,semestre_id,status);
create index if not exists idx_escalas_dia on public.escalas(dia_semana,turno,status,data_inicio,data_fim);
create index if not exists idx_presencas_data on public.presencas(data_presenca,preceptor_id,status);
create index if not exists idx_regras_vigencia on public.regras_financeiras(status,data_inicio,data_fim,prioridade);
create index if not exists idx_calculos_competencia on public.calculos(competencia_id,status);
create index if not exists idx_calculo_itens_calculo on public.calculo_itens(calculo_id,tipo);
create index if not exists idx_processos_competencia on public.processos_pagamento(competencia_id,status);
create index if not exists idx_pagamentos_status on public.pagamentos(status,data_pagamento);
create index if not exists idx_audit_tabela_registro on public.audit_logs(tabela,registro_id,ocorrido_em desc);
create index if not exists idx_notificacoes_profile on public.notificacoes(profile_id,lida_em,created_at desc);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','user_roles','preceptores','preceptor_documentos','ies','cursos','semestres','periodos','disciplinas','internatos','locais','setores','feriados','favorecidos','preceptor_favorecidos','vinculos_adm','vinculos_internato','vinculo_locais','escalas','presencas','ajustes_presenca','regras_financeiras','regra_preceptores','rateios_financeiros','competencias','calculos','calculo_itens','aprovacoes','saldos_autorizados','saldo_movimentos','processos_pagamento','processo_calculos','pagamentos','notificacoes','configuracoes','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;

-- Perfil proprio
create policy "profiles_select_own_or_staff" on public.profiles for select to authenticated using (user_id=auth.uid() or public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));
create policy "profiles_update_own" on public.profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "profiles_staff_all" on public.profiles for all to authenticated using (public.has_role(array['administrador']::public.app_role[])) with check (public.has_role(array['administrador']::public.app_role[]));

create policy "roles_admin_all" on public.user_roles for all to authenticated using (public.has_role(array['administrador']::public.app_role[])) with check (public.has_role(array['administrador']::public.app_role[]));
create policy "roles_select_own" on public.user_roles for select to authenticated using (profile_id=public.current_profile_id());

-- Preceptor ve apenas o proprio cadastro; equipe ve todos
create policy "preceptores_select_own_or_staff" on public.preceptores for select to authenticated using (profile_id=public.current_profile_id() or public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));
create policy "preceptores_staff_write" on public.preceptores for all to authenticated using (public.has_role(array['administrador','academico']::public.app_role[])) with check (public.has_role(array['administrador','academico']::public.app_role[]));

-- Cadastros de referencia: leitura autenticada, escrita por administrador/academico
-- Dados financeiros: somente administrador/financeiro/auditor; coordenador em validacoes
-- Politicas criadas em lote por categoria.
do $$
declare t text;
begin
  foreach t in array array['ies','cursos','semestres','periodos','disciplinas','internatos','locais','setores','feriados'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)',t||'_read',t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_role(array[''administrador'',''academico'']::public.app_role[])) with check (public.has_role(array[''administrador'',''academico'']::public.app_role[]))',t||'_write',t);
  end loop;
  foreach t in array array['favorecidos','preceptor_favorecidos','regras_financeiras','regra_preceptores','rateios_financeiros','competencias','calculos','calculo_itens','saldos_autorizados','saldo_movimentos','processos_pagamento','processo_calculos','pagamentos'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.has_role(array[''administrador'',''financeiro'',''auditor'',''coordenador'']::public.app_role[]))',t||'_read_staff',t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_role(array[''administrador'',''financeiro'']::public.app_role[])) with check (public.has_role(array[''administrador'',''financeiro'']::public.app_role[]))',t||'_write_finance',t);
  end loop;
  foreach t in array array['vinculos_adm','vinculos_internato','vinculo_locais','escalas'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.has_role(array[''administrador'',''academico'',''financeiro'',''coordenador'',''auditor'']::public.app_role[]) or exists(select 1 from public.preceptores p where p.profile_id=public.current_profile_id() and (exists(select 1 from public.vinculos_adm va where va.preceptor_id=p.id and va.id=%I.vinculo_adm_id) or exists(select 1 from public.vinculos_internato vi where vi.preceptor_id=p.id and vi.id=%I.vinculo_internato_id))))',t||'_read',t,t,t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_role(array[''administrador'',''academico'']::public.app_role[])) with check (public.has_role(array[''administrador'',''academico'']::public.app_role[]))',t||'_write',t);
  end loop;
end $$;

create policy "presencas_read_own_or_staff" on public.presencas for select to authenticated using (exists(select 1 from public.preceptores p where p.id=presencas.preceptor_id and p.profile_id=public.current_profile_id()) or public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));
create policy "presencas_staff_write" on public.presencas for all to authenticated using (public.has_role(array['administrador','academico']::public.app_role[])) with check (public.has_role(array['administrador','academico']::public.app_role[]));
-- Presenca do preceptor deve ser criada pela RPC registrar_presenca; sem INSERT direto.

create policy "ajustes_staff" on public.ajustes_presenca for all to authenticated using (public.has_role(array['administrador','academico','coordenador','auditor']::public.app_role[])) with check (public.has_role(array['administrador','academico','coordenador']::public.app_role[]));
create policy "aprovacoes_staff" on public.aprovacoes for all to authenticated using (public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[])) with check (public.has_role(array['administrador','academico','financeiro','coordenador']::public.app_role[]));
create policy "docs_staff_or_own" on public.preceptor_documentos for select to authenticated using (exists(select 1 from public.preceptores p where p.id=preceptor_documentos.preceptor_id and p.profile_id=public.current_profile_id()) or public.has_role(array['administrador','academico','financeiro','auditor']::public.app_role[]));
create policy "docs_staff_write" on public.preceptor_documentos for all to authenticated using (public.has_role(array['administrador','academico']::public.app_role[])) with check (public.has_role(array['administrador','academico']::public.app_role[]));
create policy "notifications_own" on public.notificacoes for select to authenticated using (profile_id=public.current_profile_id());
create policy "notifications_own_update" on public.notificacoes for update to authenticated using (profile_id=public.current_profile_id()) with check (profile_id=public.current_profile_id());
create policy "notifications_staff_insert" on public.notificacoes for insert to authenticated with check (public.has_role(array['administrador','academico','financeiro','coordenador']::public.app_role[]));
create policy "config_admin" on public.configuracoes for all to authenticated using (public.has_role(array['administrador']::public.app_role[])) with check (public.has_role(array['administrador']::public.app_role[]));
create policy "config_staff_read" on public.configuracoes for select to authenticated using (public.has_role(array['administrador','academico','financeiro','coordenador','auditor']::public.app_role[]));
create policy "audit_read" on public.audit_logs for select to authenticated using (public.has_role(array['administrador','auditor']::public.app_role[]));

-- --------------------------------------------------------------------------
-- GRANTS E CONFIGURACOES INICIAIS
-- --------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.registrar_presenca(uuid,public.turno) to authenticated;
grant execute on function public.recalcular_competencia(uuid) to authenticated;
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.audit_row_change() from public;

insert into public.configuracoes(chave,valor,descricao)
values
 ('registro_presenca_somente_dia_atual','true'::jsonb,'Preceptor registra apenas a data atual.'),
 ('exigir_escala_para_presenca','true'::jsonb,'Exige escala ativa para registrar presença.'),
 ('permitir_saldo_negativo','false'::jsonb,'Bloqueia consumo acima do saldo autorizado.'),
 ('moeda','"BRL"'::jsonb,'Moeda padrão do sistema.'),
 ('timezone','"America/Recife"'::jsonb,'Fuso horário operacional.')
on conflict(chave) do nothing;

commit;

-- ============================================================================
-- POS-INSTALACAO: PROMOVER O PRIMEIRO ADMINISTRADOR
-- Substitua o e-mail abaixo pelo e-mail criado no Supabase Auth e execute.
-- ============================================================================
-- insert into public.user_roles(profile_id,role)
-- select p.id,'administrador'::public.app_role
-- from public.profiles p
-- where lower(p.email)=lower('SEU_EMAIL@EXEMPLO.COM')
-- on conflict(profile_id,role) do update set ativo=true;
