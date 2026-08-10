-- --------------------------------------------------------------------------
-- 1. TABELA INTERNOATO_DISCIPLINAS (junção many-to-many)
-- --------------------------------------------------------------------------
create table if not exists public.internato_disciplinas (
  id uuid primary key default gen_random_uuid(),
  internato_id uuid not null references public.internatos(id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(internato_id, disciplina_id)
);

-- --------------------------------------------------------------------------
-- 2. COLUNAS ADICIONAIS NA TABELA SETORES
-- --------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS aplicacao text not null default 'pratica';
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS internato_id uuid references public.internatos(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS disciplina_id uuid references public.disciplinas(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- --------------------------------------------------------------------------
-- 3. ATUALIZAR CONSTRAINT UNIQUE DO SETORES
-- --------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.setores DROP CONSTRAINT IF EXISTS setores_local_id_nome_key;
EXCEPTION WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.setores ADD CONSTRAINT setores_local_id_nome_unique UNIQUE (local_id, nome);
EXCEPTION WHEN duplicate_table THEN null;
END $$;

-- --------------------------------------------------------------------------
-- 4. GRANTS
-- --------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internato_disciplinas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internato_disciplinas TO anon;