-- ============================================================================
-- MIGRACAO 012: SIMPLIFICAR CADASTRO AUXILIAR DE INTERNATOS
-- Remocao de curso_id e numero da tabela internatos
-- Adicao de sigla e triggers para geracao automatica de sigla
-- ============================================================================

begin;

-- 1. Remover FK e NOT NULL de curso_id em internatos
ALTER TABLE public.internatos DROP CONSTRAINT IF EXISTS internatos_curso_id_fkey;
ALTER TABLE public.internatos DROP CONSTRAINT IF EXISTS internatos_curso_id_numero_key;
ALTER TABLE public.internatos DROP CONSTRAINT IF EXISTS internatos_curso_id_nome_key;
ALTER TABLE public.internatos ALTER COLUMN curso_id DROP NOT NULL;
ALTER TABLE public.internatos DROP COLUMN IF EXISTS curso_id;

-- 2. Tornar numero opcional em internatos se existir
ALTER TABLE public.internatos ALTER COLUMN numero DROP NOT NULL;

-- 3. Adicionar coluna sigla em internatos se nao existir
DO $$ BEGIN
  ALTER TABLE public.internatos ADD COLUMN IF NOT EXISTS sigla text;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 4. Adicionar created_by e updated_by em internatos se nao existir
DO $$ BEGIN
  ALTER TABLE public.internatos ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.internatos ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- 5. Criar Unique Index em lower(trim(nome)) para internatos
CREATE UNIQUE INDEX IF NOT EXISTS idx_internatos_nome_unique ON public.internatos (lower(trim(nome)));

-- 6. Atualizar a funcao generate_sigla para incluir a tabela internatos
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
  v_stop_words text[] := ARRAY['de','do','da','dos','das','em','para','por','com','o','a','os','as','um','uma','e','no','na','nos','nas'];
BEGIN
  v_normalized := lower(unaccent(trim(p_nome)));
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_words := string_to_array(v_normalized, ' ');

  v_sigla := '';
  FOR i IN 1..array_length(v_words, 1) LOOP
    IF v_words[i] != '' AND NOT (v_words[i] = ANY(v_stop_words)) THEN
      v_sigla := v_sigla || upper(substring(v_words[i] from 1 for 1));
    END IF;
  END LOOP;

  IF length(v_sigla) = 0 THEN
    v_sigla := upper(substring(regexp_replace(unaccent(trim(p_nome)), '\s+', '', 'g') from 1 for 3));
  END IF;

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
    ELSIF p_table = 'internatos' THEN
      SELECT EXISTS(SELECT 1 FROM public.internatos WHERE sigla = v_sigla || v_suffix) INTO v_exists;
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

-- 7. Criar Trigger para geracao automatica de sigla em internatos
DROP TRIGGER IF EXISTS trg_internatos_sigla ON public.internatos;
CREATE TRIGGER trg_internatos_sigla
  BEFORE INSERT ON public.internatos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_generate_sigla();

commit;
