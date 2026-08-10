-- Tornar curso_id opcional na tabela disciplinas
DO $$ BEGIN
  ALTER TABLE public.disciplinas ALTER COLUMN curso_id DROP NOT NULL;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- Remover constraint unique composta e substituir por unique simples em nome
-- (curso_id agora pode ser null, e a constraint original nao funciona bem com nulls)
DO $$ BEGIN
  ALTER TABLE public.disciplinas DROP CONSTRAINT disciplinas_curso_id_nome_key;
EXCEPTION WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.disciplinas ADD CONSTRAINT disciplinas_nome_unique UNIQUE (nome);
EXCEPTION WHEN duplicate_table THEN null;
END $$;