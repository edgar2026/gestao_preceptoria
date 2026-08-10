-- ============================================================================
-- MIGRACAO 010: CADASTROS AUXILIARES - Profissoes, siglas automaticas
-- Cria tabela profissoes, adiciona sigla e created_by/updated_by as tabelas
-- existentes, e cria trigger para geracao automatica de sigla.
--
-- SEGURANCA: Nao usa DROP TABLE, TRUNCATE ou db reset.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. CRIAR TABELA profissoes
-- --------------------------------------------------------------------------
create table if not exists public.profissoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sigla text,
  status public.status_registro not null default 'ativo',
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint on normalized nome (lowercase, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profissoes_nome_unique ON public.profissoes (lower(trim(nome)));

alter table public.profissoes enable row level security;

create policy "profissoes_read" on public.profissoes
  for select to authenticated using (true);

create policy "profissoes_write" on public.profissoes
  for all to authenticated
  using (public.has_role(array['administrador','academico']::public.app_role[]))
  with check (public.has_role(array['administrador','academico']::public.app_role[]));

create trigger trg_profissoes_updated before update on public.profissoes
  for each row execute function public.set_updated_at();

create trigger trg_profissoes_audit after insert or update or delete on public.profissoes
  for each row execute function public.audit_row_change();

-- --------------------------------------------------------------------------
-- 2. ADICIONAR COLUNAS sigla e created_by/updated_by as tabelas existentes
-- --------------------------------------------------------------------------

-- disciplinas
DO $$ BEGIN
  ALTER TABLE public.disciplinas ADD COLUMN IF NOT EXISTS sigla text;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.disciplinas ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.disciplinas ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- locais
DO $$ BEGIN
  ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS sigla text;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.locais ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- setores
DO $$ BEGIN
  ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS sigla text;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.setores ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Unique constraints on normalized names for existing tables
CREATE UNIQUE INDEX IF NOT EXISTS idx_disciplinas_nome_unique ON public.disciplinas (lower(trim(nome)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_locais_nome_unique ON public.locais (lower(trim(nome)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_setores_nome_unique ON public.setores (lower(trim(local_id::text) || ' ' || trim(nome)));

-- --------------------------------------------------------------------------
-- 3. FUNCAO: Gerar sigla a partir do nome
-- Normaliza: remove acentos, maiusculas, remove artigos/preposicoes,
-- pega primeira letra de cada palavra significativa.
-- Se duplicata, acrescenta numero sequencial.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_sigla(p_table text, p_nome text)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_normalized text;
  v_words text[];
  v_sigla text;
  v_counter integer := 1;
  v_suffix text;
  v_exists boolean;
  -- Artigos e preposicoes para ignorar
  v_stop_words text[] := ARRAY['de','do','da','dos','das','em','para','por','com','o','a','os','as','um','uma','e','no','na','nos','nas'];
BEGIN
  -- Normalizar: remover acentos, converter para lowercase, trim
  v_normalized := lower(unaccent(trim(p_nome)));
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');

  -- Dividir em palavras
  v_words := string_to_array(v_normalized, ' ');

  -- Filtrar stop words e pegar primeira letra de cada palavra significativa
  v_sigla := '';
  FOR i IN 1..array_length(v_words, 1) LOOP
    IF v_words[i] != '' AND NOT (v_words[i] = ANY(v_stop_words)) THEN
      v_sigla := v_sigla || upper(substring(v_words[i] from 1 for 1));
    END IF;
  END LOOP;

  -- Se sigla ficou vazia, usar as 3 primeiras letras do nome normalizado
  IF length(v_sigla) = 0 THEN
    v_sigla := upper(substring(regexp_replace(unaccent(trim(p_nome)), '\s+', '', 'g') from 1 for 3));
  END IF;

  -- Verificar duplicata e acrescentar numero se necessario
  v_suffix := '';
  LOOP
    IF p_table = 'profissoes' THEN
      SELECT EXISTS(SELECT 1 FROM public.profissoes WHERE sigla = v_sigla || v_suffix) INTO v_exists;
    ELSIF p_table = 'disciplinas' THEN
      SELECT EXISTS(SELECT 1 FROM public.disciplinas WHERE sigla = v_sigla || v_suffix) INTO v_exists;
    ELSIF p_table = 'locais' THEN
      SELECT EXISTS(SELECT 1 FROM public.locais WHERE sigla = v_sigla || v_suffix) INTO v_exists;
    ELSIF p_table = 'setores' THEN
      SELECT EXISTS(SELECT 1 FROM public.setores WHERE sigla = v_sigla || v_suffix) INTO v_exists;
    ELSE
      v_exists := false;
    END IF;

    IF NOT v_exists THEN
      RETURN v_sigla || v_suffix;
    END IF;

    v_counter := v_counter + 1;
    v_suffix := v_counter::text;
  END LOOP;
END;
$$;

-- --------------------------------------------------------------------------
-- 4. FUNCAO TRIGGER: Gerar sigla automaticamente no INSERT
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_generate_sigla()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_table text;
BEGIN
  -- Só gerar sigla se não foi fornecida
  IF NEW.sigla IS NOT NULL AND NEW.sigla != '' THEN
    RETURN NEW;
  END IF;

  v_table := TG_TABLE_NAME;
  NEW.sigla := public.generate_sigla(v_table, NEW.nome);
  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- 5. CRIAR TRIGGERS para cada tabela
-- --------------------------------------------------------------------------

-- Profissoes
DROP TRIGGER IF EXISTS trg_profissoes_sigla ON public.profissoes;
CREATE TRIGGER trg_profissoes_sigla
  BEFORE INSERT ON public.profissoes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_sigla();

-- Disciplinas
DROP TRIGGER IF EXISTS trg_disciplinas_sigla ON public.disciplinas;
CREATE TRIGGER trg_disciplinas_sigla
  BEFORE INSERT ON public.disciplinas
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_sigla();

-- Locais
DROP TRIGGER IF EXISTS trg_locais_sigla ON public.locais;
CREATE TRIGGER trg_locais_sigla
  BEFORE INSERT ON public.locais
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_sigla();

-- Setores
DROP TRIGGER IF EXISTS trg_setores_sigla ON public.setores;
CREATE TRIGGER trg_setores_sigla
  BEFORE INSERT ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_sigla();

-- --------------------------------------------------------------------------
-- 6. GRANTS
-- --------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.generate_sigla(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_generate_sigla() TO authenticated;

commit;
