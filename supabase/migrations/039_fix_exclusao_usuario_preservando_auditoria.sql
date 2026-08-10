-- 039_fix_exclusao_usuario_preservando_auditoria.sql
-- Permite exclusao definitiva de usuarios preservando historico de auditoria.
-- 1. Adiciona colunas de snapshot (nome/email) em audit_logs
-- 2. Preenche snapshots existentes a partir de profiles
-- 3. Torna TODAS as FKs que referenciam profiles anulaveis com ON DELETE SET NULL
--    (exceto notificacoes, user_roles e preceptores.profile_id que ja possuem regra adequada)

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 1: audit_logs — colunas de snapshot
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS audit_profile_nome text,
  ADD COLUMN IF NOT EXISTS audit_profile_email text;

-- Preencher snapshots para registros existentes que tenham profile_id
UPDATE public.audit_logs al
SET
  audit_profile_nome  = p.nome_completo,
  audit_profile_email = p.email
FROM public.profiles p
WHERE al.profile_id = p.id
  AND (al.audit_profile_nome IS NULL OR al.audit_profile_email IS NULL);

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 2: Remover FK antiga e recriar com ON DELETE SET NULL
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_profile_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_profile_id_fkey
  FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- PARTE 3: Demais FKs NO ACTION → SET NULL
-- Todas as colunas ja sao NULLABLE, entao SET NULL e seguro.
-- ═══════════════════════════════════════════════════════════════════════════

-- ajustes_presenca
ALTER TABLE public.ajustes_presenca
  DROP CONSTRAINT IF EXISTS ajustes_presenca_realizado_por_fkey;
ALTER TABLE public.ajustes_presenca
  ADD CONSTRAINT ajustes_presenca_realizado_por_fkey
  FOREIGN KEY (realizado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- aprovacoes (2 FKs)
ALTER TABLE public.aprovacoes
  DROP CONSTRAINT IF EXISTS aprovacoes_decidido_por_fkey;
ALTER TABLE public.aprovacoes
  ADD CONSTRAINT aprovacoes_decidido_por_fkey
  FOREIGN KEY (decidido_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.aprovacoes
  DROP CONSTRAINT IF EXISTS aprovacoes_responsavel_profile_id_fkey;
ALTER TABLE public.aprovacoes
  ADD CONSTRAINT aprovacoes_responsavel_profile_id_fkey
  FOREIGN KEY (responsavel_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- calculos (2 FKs)
ALTER TABLE public.calculos
  DROP CONSTRAINT IF EXISTS calculos_calculado_por_fkey;
ALTER TABLE public.calculos
  ADD CONSTRAINT calculos_calculado_por_fkey
  FOREIGN KEY (calculado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.calculos
  DROP CONSTRAINT IF EXISTS calculos_chamado_updated_by_fkey;
ALTER TABLE public.calculos
  ADD CONSTRAINT calculos_chamado_updated_by_fkey
  FOREIGN KEY (chamado_updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- competencias (2 FKs)
ALTER TABLE public.competencias
  DROP CONSTRAINT IF EXISTS competencias_aberto_por_fkey;
ALTER TABLE public.competencias
  ADD CONSTRAINT competencias_aberto_por_fkey
  FOREIGN KEY (aberto_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.competencias
  DROP CONSTRAINT IF EXISTS competencias_fechado_por_fkey;
ALTER TABLE public.competencias
  ADD CONSTRAINT competencias_fechado_por_fkey
  FOREIGN KEY (fechado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- configuracoes
ALTER TABLE public.configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_updated_by_fkey;
ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- disciplinas (2 FKs)
ALTER TABLE public.disciplinas
  DROP CONSTRAINT IF EXISTS disciplinas_created_by_fkey;
ALTER TABLE public.disciplinas
  ADD CONSTRAINT disciplinas_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.disciplinas
  DROP CONSTRAINT IF EXISTS disciplinas_updated_by_fkey;
ALTER TABLE public.disciplinas
  ADD CONSTRAINT disciplinas_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- internatos (2 FKs)
ALTER TABLE public.internatos
  DROP CONSTRAINT IF EXISTS internatos_created_by_fkey;
ALTER TABLE public.internatos
  ADD CONSTRAINT internatos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.internatos
  DROP CONSTRAINT IF EXISTS internatos_updated_by_fkey;
ALTER TABLE public.internatos
  ADD CONSTRAINT internatos_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- locais (2 FKs)
ALTER TABLE public.locais
  DROP CONSTRAINT IF EXISTS locais_created_by_fkey;
ALTER TABLE public.locais
  ADD CONSTRAINT locais_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.locais
  DROP CONSTRAINT IF EXISTS locais_updated_by_fkey;
ALTER TABLE public.locais
  ADD CONSTRAINT locais_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- pagamentos
ALTER TABLE public.pagamentos
  DROP CONSTRAINT IF EXISTS pagamentos_created_by_fkey;
ALTER TABLE public.pagamentos
  ADD CONSTRAINT pagamentos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- preceptor_acesso_presenca
ALTER TABLE public.preceptor_acesso_presenca
  DROP CONSTRAINT IF EXISTS preceptor_acesso_presenca_created_by_fkey;
ALTER TABLE public.preceptor_acesso_presenca
  ADD CONSTRAINT preceptor_acesso_presenca_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- preceptores (created_by e updated_by — profile_id ja tem SET NULL)
ALTER TABLE public.preceptores
  DROP CONSTRAINT IF EXISTS preceptores_created_by_fkey;
ALTER TABLE public.preceptores
  ADD CONSTRAINT preceptores_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.preceptores
  DROP CONSTRAINT IF EXISTS preceptores_updated_by_fkey;
ALTER TABLE public.preceptores
  ADD CONSTRAINT preceptores_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- presencas
ALTER TABLE public.presencas
  DROP CONSTRAINT IF EXISTS presencas_registrado_por_fkey;
ALTER TABLE public.presencas
  ADD CONSTRAINT presencas_registrado_por_fkey
  FOREIGN KEY (registrado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- processos_pagamento
ALTER TABLE public.processos_pagamento
  DROP CONSTRAINT IF EXISTS processos_pagamento_created_by_fkey;
ALTER TABLE public.processos_pagamento
  ADD CONSTRAINT processos_pagamento_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- profissoes (2 FKs)
ALTER TABLE public.profissoes
  DROP CONSTRAINT IF EXISTS profissoes_created_by_fkey;
ALTER TABLE public.profissoes
  ADD CONSTRAINT profissoes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profissoes
  DROP CONSTRAINT IF EXISTS profissoes_updated_by_fkey;
ALTER TABLE public.profissoes
  ADD CONSTRAINT profissoes_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- regras_financeiras (2 FKs)
ALTER TABLE public.regras_financeiras
  DROP CONSTRAINT IF EXISTS regras_financeiras_created_by_fkey;
ALTER TABLE public.regras_financeiras
  ADD CONSTRAINT regras_financeiras_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.regras_financeiras
  DROP CONSTRAINT IF EXISTS regras_financeiras_updated_by_fkey;
ALTER TABLE public.regras_financeiras
  ADD CONSTRAINT regras_financeiras_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- saldo_movimentos
ALTER TABLE public.saldo_movimentos
  DROP CONSTRAINT IF EXISTS saldo_movimentos_realizado_por_fkey;
ALTER TABLE public.saldo_movimentos
  ADD CONSTRAINT saldo_movimentos_realizado_por_fkey
  FOREIGN KEY (realizado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- setores (2 FKs)
ALTER TABLE public.setores
  DROP CONSTRAINT IF EXISTS setores_created_by_fkey;
ALTER TABLE public.setores
  ADD CONSTRAINT setores_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.setores
  DROP CONSTRAINT IF EXISTS setores_updated_by_fkey;
ALTER TABLE public.setores
  ADD CONSTRAINT setores_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- solicitacao_nota_fiscal_eventos
ALTER TABLE public.solicitacao_nota_fiscal_eventos
  DROP CONSTRAINT IF EXISTS solicitacao_nota_fiscal_eventos_realizado_por_fkey;
ALTER TABLE public.solicitacao_nota_fiscal_eventos
  ADD CONSTRAINT solicitacao_nota_fiscal_eventos_realizado_por_fkey
  FOREIGN KEY (realizado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- solicitacoes_nota_fiscal (2 FKs)
ALTER TABLE public.solicitacoes_nota_fiscal
  DROP CONSTRAINT IF EXISTS solicitacoes_nota_fiscal_enviado_por_fkey;
ALTER TABLE public.solicitacoes_nota_fiscal
  ADD CONSTRAINT solicitacoes_nota_fiscal_enviado_por_fkey
  FOREIGN KEY (enviado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.solicitacoes_nota_fiscal
  DROP CONSTRAINT IF EXISTS solicitacoes_nota_fiscal_preparado_por_fkey;
ALTER TABLE public.solicitacoes_nota_fiscal
  ADD CONSTRAINT solicitacoes_nota_fiscal_preparado_por_fkey
  FOREIGN KEY (preparado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- vinculo_regras_financeiras
ALTER TABLE public.vinculo_regras_financeiras
  DROP CONSTRAINT IF EXISTS vinculo_regras_financeiras_created_by_fkey;
ALTER TABLE public.vinculo_regras_financeiras
  ADD CONSTRAINT vinculo_regras_financeiras_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- vinculos_adm
ALTER TABLE public.vinculos_adm
  DROP CONSTRAINT IF EXISTS vinculos_adm_created_by_fkey;
ALTER TABLE public.vinculos_adm
  ADD CONSTRAINT vinculos_adm_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- vinculos_internato
ALTER TABLE public.vinculos_internato
  DROP CONSTRAINT IF EXISTS vinculos_internato_created_by_fkey;
ALTER TABLE public.vinculos_internato
  ADD CONSTRAINT vinculos_internato_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
