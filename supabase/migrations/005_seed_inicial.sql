-- ============================================================================
-- MIGRACAO 005: SEED INICIAL - MEDICINA UNINASSAU
--
-- Cadastra IES, curso, semestre vigente, periodos, disciplinas, internatos,
-- locais e setores para o Medicina UNINASSAU.
--
-- EXECUCAO: Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Apos a execucao, crie o primeiro usuario admin e atribua papel administrador.
--
-- IMPORTANTE:
-- - Este script e idempotente (usando ON CONFLICT / INSERT com cuidado).
-- - Nao apaga dados existentes.
-- - Assume que 004_auth_setup.sql ja foi executado com sucesso.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. IES: Medicina UNINASSAU
-- --------------------------------------------------------------------------
INSERT INTO public.ies (nome, sigla, status)
VALUES ('UNINASSAU - Centro Universitário Maurício de Nassau', 'UNINASSAU', 'ativo')
ON CONFLICT (nome) DO UPDATE SET sigla = 'UNINASSAU', status = 'ativo';

-- --------------------------------------------------------------------------
-- 2. CURSO: Medicina
-- --------------------------------------------------------------------------
INSERT INTO public.cursos (ies_id, nome, codigo, status)
SELECT
  (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau'),
  'Medicina',
  'MED001',
  'ativo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cursos
  WHERE nome = 'Medicina' AND ies_id = (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau')
);

-- --------------------------------------------------------------------------
-- 3. SEMESTRE VIGENTE: 2026.1
-- --------------------------------------------------------------------------
INSERT INTO public.semestres (curso_id, codigo, data_inicio, data_fim, status)
SELECT
  (SELECT id FROM public.cursos WHERE nome = 'Medicina' AND ies_id = (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau')),
  '2026.1',
  '2026-02-01',
  '2026-07-31',
  'ativo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.semestres
  WHERE codigo = '2026.1'
    AND curso_id = (SELECT id FROM public.cursos WHERE nome = 'Medicina' AND ies_id = (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau'))
);

-- --------------------------------------------------------------------------
-- 4. PERIODOS (1º ao 12º período - Medicina 12 semestres)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_curso_id uuid;
  v_i integer;
BEGIN
  SELECT id INTO v_curso_id
  FROM public.cursos
  WHERE nome = 'Medicina'
    AND ies_id = (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau');

  IF v_curso_id IS NULL THEN
    RAISE NOTICE 'Curso Medicina não encontrado. Pulando periodos.';
    RETURN;
  END IF;

  FOR v_i IN 1..12 LOOP
    INSERT INTO public.periodos (curso_id, numero, nome, status)
    VALUES (v_curso_id, v_i, v_i || 'º Período', 'ativo')
    ON CONFLICT (curso_id, numero) DO UPDATE SET nome = v_i || 'º Período', status = 'ativo';
  END LOOP;

  RAISE NOTICE 'Períodos 1º a 12º criados com sucesso.';
END $$;

-- --------------------------------------------------------------------------
-- 5. DISCIPLINAS (ativas - semestre 2026.1)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_curso_id uuid;
BEGIN
  SELECT id INTO v_curso_id
  FROM public.cursos
  WHERE nome = 'Medicina'
    AND ies_id = (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau');

  IF v_curso_id IS NULL THEN
    RAISE NOTICE 'Curso Medicina não encontrado. Pulando disciplinas.';
    RETURN;
  END IF;

  -- Disciplinas por período (simplificado - apenas as principais para demonstração)
  -- 1º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Anatomia Humana I', 'ANAT101', 120, 'ativo'),
    (v_curso_id, 'Histologia e Embriologia', 'HIST101', 80, 'ativo'),
    (v_curso_id, 'Biofísica', 'BIOF101', 60, 'ativo'),
    (v_curso_id, 'Citologia e Biologia Celular', 'CITO101', 60, 'ativo'),
    (v_curso_id, 'Introdução à Medicina', 'INTM101', 40, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 2º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Anatomia Humana II', 'ANAT201', 120, 'ativo'),
    (v_curso_id, 'Fisiologia', 'FISI201', 100, 'ativo'),
    (v_curso_id, 'Bioquímica', 'BIOQ201', 80, 'ativo'),
    (v_curso_id, 'Genética', 'GENE201', 60, 'ativo'),
    (v_curso_id, 'Imunologia', 'IMUN201', 60, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 3º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Farmacologia', 'FARM301', 100, 'ativo'),
    (v_curso_id, 'Patologia Geral', 'PATO301', 100, 'ativo'),
    (v_curso_id, 'Microbiologia', 'MICR301', 80, 'ativo'),
    (v_curso_id, 'Parasitologia', 'PARA301', 60, 'ativo'),
    (v_curso_id, 'Fisiopatologia', 'FISI301', 80, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 4º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Semiologia', 'SEMI401', 120, 'ativo'),
    (v_curso_id, 'Propedêutica Clínica', 'PROP401', 100, 'ativo'),
    (v_curso_id, 'Semiologia e Propedêutica II', 'SEMI402', 100, 'ativo'),
    (v_curso_id, 'Ética Médica', 'ETIC401', 40, 'ativo'),
    (v_curso_id, 'Saúde Coletiva', 'SAUC401', 60, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 5º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Clínica Médica I', 'CLMD501', 160, 'ativo'),
    (v_curso_id, 'Pediatria I', 'PEDI501', 120, 'ativo'),
    (v_curso_id, 'Ginecologia e Obstetrícia I', 'GINE501', 120, 'ativo'),
    (v_curso_id, 'Farmacologia Clínica', 'FARC501', 60, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 6º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Clínica Médica II', 'CLMD601', 160, 'ativo'),
    (v_curso_id, 'Pediatria II', 'PEDI601', 120, 'ativo'),
    (v_curso_id, 'Ginecologia e Obstetrícia II', 'GINE601', 120, 'ativo'),
    (v_curso_id, 'Psiquiatria', 'PSIQ601', 80, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 7º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Cirurgia Geral I', 'CIRG701', 160, 'ativo'),
    (v_curso_id, 'Urologia', 'UROL701', 80, 'ativo'),
    (v_curso_id, 'Oftalmologia', 'OFTH701', 60, 'ativo'),
    (v_curso_id, 'Otorrinolaringologia', 'OTOR701', 60, 'ativo'),
    (v_curso_id, 'Anestesiologia', 'ANES701', 80, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 8º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Cirurgia Geral II', 'CIRG801', 160, 'ativo'),
    (v_curso_id, 'Ortopedia e Traumatologia', 'ORTO801', 120, 'ativo'),
    (v_curso_id, 'Neurocirurgia', 'NEUC801', 80, 'ativo'),
    (v_curso_id, 'Cirurgia Pediátrica', 'CIRP801', 80, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 9º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Clínica Médica III', 'CLMD901', 160, 'ativo'),
    (v_curso_id, 'Pediatria III', 'PEDI901', 120, 'ativo'),
    (v_curso_id, 'Ginecologia e Obstetrícia III', 'GINE901', 120, 'ativo'),
    (v_curso_id, 'Dermatologia', 'DERM901', 60, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 10º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Cirurgia Geral III', 'CIRGA01', 160, 'ativo'),
    (v_curso_id, 'Neurologia', 'NEUR101', 100, 'ativo'),
    (v_curso_id, 'Psiquiatria e Saúde Mental', 'PSIQ101', 80, 'ativo'),
    (v_curso_id, 'Reumatologia', 'REUM101', 60, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 11º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Clínica Médica IV', 'CLMD111', 160, 'ativo'),
    (v_curso_id, 'Pediatria IV', 'PEDI111', 120, 'ativo'),
    (v_curso_id, 'Ginecologia e Obstetrícia IV', 'GINE111', 120, 'ativo'),
    (v_curso_id, 'Medicina Legal', 'MDLG101', 60, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  -- 12º Período
  INSERT INTO public.disciplinas (curso_id, nome, codigo, carga_horaria, status) VALUES
    (v_curso_id, 'Clínica Médica V', 'CLMD121', 160, 'ativo'),
    (v_curso_id, 'Pediatria V', 'PEDI121', 120, 'ativo'),
    (v_curso_id, 'Ginecologia e Obstetrícia V', 'GINE121', 120, 'ativo'),
    (v_curso_id, 'Medicina de Emergência', 'EMER101', 100, 'ativo')
  ON CONFLICT (curso_id, nome) DO UPDATE SET codigo = EXCLUDED.codigo, carga_horaria = EXCLUDED.carga_horaria;

  RAISE NOTICE 'Disciplinas de Medicina criadas com sucesso.';
END $$;

-- --------------------------------------------------------------------------
-- 6. INTERNATOS (baseados na grade curricular de Medicina)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_curso_id uuid;
  v_periodo_9_id uuid;
  v_periodo_10_id uuid;
  v_periodo_11_id uuid;
  v_periodo_12_id uuid;
BEGIN
  SELECT id INTO v_curso_id
  FROM public.cursos
  WHERE nome = 'Medicina'
    AND ies_id = (SELECT id FROM public.ies WHERE nome = 'UNINASSAU - Centro Universitário Maurício de Nassau');

  IF v_curso_id IS NULL THEN
    RAISE NOTICE 'Curso Medicina não encontrado. Pulando internatos.';
    RETURN;
  END IF;

  SELECT id INTO v_periodo_9_id FROM public.periodos WHERE curso_id = v_curso_id AND numero = 9;
  SELECT id INTO v_periodo_10_id FROM public.periodos WHERE curso_id = v_curso_id AND numero = 10;
  SELECT id INTO v_periodo_11_id FROM public.periodos WHERE curso_id = v_curso_id AND numero = 11;
  SELECT id INTO v_periodo_12_id FROM public.periodos WHERE curso_id = v_curso_id AND numero = 12;

  INSERT INTO public.internatos (curso_id, numero, nome, periodo_id, carga_horaria, status) VALUES
    (v_curso_id, 1, 'Internato de Clínica Médica', v_periodo_9_id, 480, 'ativo'),
    (v_curso_id, 2, 'Internato de Pediatria', v_periodo_10_id, 480, 'ativo'),
    (v_curso_id, 3, 'Internato de Ginecologia e Obstetrícia', v_periodo_10_id, 480, 'ativo'),
    (v_curso_id, 4, 'Internato de Cirurgia Geral', v_periodo_11_id, 480, 'ativo'),
    (v_curso_id, 5, 'Internato de Saúde Coletiva', v_periodo_11_id, 360, 'ativo'),
    (v_curso_id, 6, 'Internato de Emergência e Unidade de Terapia Intensiva', v_periodo_12_id, 480, 'ativo'),
    (v_curso_id, 7, 'Internato de Psiquiatria e Saúde Mental', v_periodo_12_id, 360, 'ativo'),
    (v_curso_id, 8, 'Internato eletivo', v_periodo_12_id, 360, 'ativo')
  ON CONFLICT (curso_id, numero) DO UPDATE SET
    nome = EXCLUDED.nome,
    periodo_id = EXCLUDED.periodo_id,
    carga_horaria = EXCLUDED.carga_horaria,
    status = 'ativo';

  RAISE NOTICE 'Internatos de Medicina criados com sucesso.';
END $$;

-- --------------------------------------------------------------------------
-- 7. LOCAIS (hospitais e unidades de saúde em Recife/PE)
-- --------------------------------------------------------------------------
INSERT INTO public.locais (nome, tipo, cidade, uf, status) VALUES
  ('Hospital das Clínicas - UFPE', 'Hospital', 'Recife', 'PE', 'ativo'),
  ('Hospital São Lucas', 'Hospital', 'Recife', 'PE', 'ativo'),
  ('Hospital Português', 'Hospital', 'Recife', 'PE', 'ativo'),
  ('Hospital de Promoção à Saúde - HPRO', 'Hospital', 'Recife', 'PE', 'ativo'),
  ('Hospital Memorial Saúde', 'Hospital', 'Recife', 'PE', 'ativo'),
  ('UPA Norte', 'UPA', 'Recife', 'PE', 'ativo'),
  ('UPA Sul', 'UPA', 'Recife', 'PE', 'ativo'),
  ('UBS Boa Viagem', 'UBS', 'Recife', 'PE', 'ativo'),
  ('UBS Casa Amarela', 'UBS', 'Recife', 'PE', 'ativo'),
  ('Ambulatório UNINASSAU', 'Ambulatório', 'Recife', 'PE', 'ativo')
ON CONFLICT (nome) DO UPDATE SET tipo = EXCLUDED.tipo, cidade = EXCLUDED.cidade, uf = EXCLUDED.uf, status = 'ativo';

-- --------------------------------------------------------------------------
-- 8. SETORES (por local)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_local record;
  v_local_ids text[];
BEGIN
  -- Hospital das Clínicas
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'Hospital das Clínicas - UFPE';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Clínica Médica', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Ginecologia e Obstetrícia', 'ativo'),
      (v_local.id, 'Cirurgia Geral', 'ativo'),
      (v_local.id, 'UTI Adulto', 'ativo'),
      (v_local.id, 'UTI Neonatal', 'ativo'),
      (v_local.id, 'Pronto Socorro', 'ativo'),
      (v_local.id, 'Cardiologia', 'ativo'),
      (v_local.id, 'Neurologia', 'ativo'),
      (v_local.id, 'Ortopedia', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- Hospital São Lucas
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'Hospital São Lucas';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Clínica Médica', 'ativo'),
      (v_local.id, 'Cirurgia Geral', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Maternidade', 'ativo'),
      (v_local.id, 'UTI', 'ativo'),
      (v_local.id, 'Pronto Socorro', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- Hospital Português
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'Hospital Português';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Clínica Médica', 'ativo'),
      (v_local.id, 'Cirurgia Geral', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Ginecologia', 'ativo'),
      (v_local.id, 'UTI', 'ativo'),
      (v_local.id, 'Pronto Socorro', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- Hospital de Promoção à Saúde - HPRO
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'Hospital de Promoção à Saúde - HPRO';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Clínica Médica', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Saúde da Mulher', 'ativo'),
      (v_local.id, 'Saúde Mental', 'ativo'),
      (v_local.id, 'Pronto Socorro', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- Hospital Memorial Saúde
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'Hospital Memorial Saúde';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Clínica Médica', 'ativo'),
      (v_local.id, 'Cirurgia Geral', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Maternidade', 'ativo'),
      (v_local.id, 'UTI', 'ativo'),
      (v_local.id, 'Pronto Socorro', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- UPA Norte
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'UPA Norte';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Pronto Atendimento', 'ativo'),
      (v_local.id, 'Observação', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- UPA Sul
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'UPA Sul';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Pronto Atendimento', 'ativo'),
      (v_local.id, 'Observação', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- UBS Boa Viagem
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'UBS Boa Viagem';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Atendimento Geral', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Pré-Natal', 'ativo'),
      (v_local.id, 'Vacinas', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- UBS Casa Amarela
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'UBS Casa Amarela';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Atendimento Geral', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Pré-Natal', 'ativo'),
      (v_local.id, 'Vacinas', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  -- Ambulatório UNINASSAU
  SELECT id INTO v_local.id FROM public.locais WHERE nome = 'Ambulatório UNINASSAU';
  IF v_local.id IS NOT NULL THEN
    INSERT INTO public.setores (local_id, nome, status) VALUES
      (v_local.id, 'Clínica Médica', 'ativo'),
      (v_local.id, 'Pediatria', 'ativo'),
      (v_local.id, 'Ginecologia', 'ativo'),
      (v_local.id, 'Dermatologia', 'ativo')
    ON CONFLICT (local_id, nome) DO UPDATE SET status = 'ativo';
  END IF;

  RAISE NOTICE 'Setores criados com sucesso.';
END $$;

-- --------------------------------------------------------------------------
-- 9. FERIADOS NACIONAIS 2026 (exemplos)
-- --------------------------------------------------------------------------
INSERT INTO public.feriados (data, descricao, abrangencia, local_id, ponto_facultativo) VALUES
  ('2026-01-01', 'Confraternização Universal', 'nacional', NULL, false),
  ('2026-04-21', 'Tiradentes', 'nacional', NULL, false),
  ('2026-05-01', 'Dia do Trabalho', 'nacional', NULL, false),
  ('2026-09-07', 'Independência do Brasil', 'nacional', NULL, false),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional', NULL, false),
  ('2026-11-02', 'Finados', 'nacional', NULL, false),
  ('2026-11-15', 'Proclamação da República', 'nacional', NULL, false),
  ('2026-11-20', 'Consciência Negra', 'nacional', NULL, true),
  ('2026-12-25', 'Natal', 'nacional', NULL, false)
ON CONFLICT (data, abrangencia, local_id) DO UPDATE SET descricao = EXCLUDED.descricao, ponto_facultativo = EXCLUDED.ponto_facultativo;

COMMIT;

-- ============================================================================
-- POS-EXECUCAO:
-- 1. Acesse o Supabase Dashboard > Authentication > Users > Add User
-- 2. Crie o primeiro usuario admin (ex: admin@uninassau.edu.br)
-- 3. No SQL Editor, execute:
--
--    INSERT INTO public.user_roles (profile_id, role)
--    SELECT p.id, 'administrador'::public.app_role
--    FROM public.profiles p
--    WHERE lower(p.email) = lower('admin@uninassau.edu.br')
--    ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;
-- ============================================================================
