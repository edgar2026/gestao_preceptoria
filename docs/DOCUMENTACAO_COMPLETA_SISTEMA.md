# Documentação Completa do Sistema de Gestão de Preceptoria

**Versão:** 2.0  
**Data:** 03 de Agosto de 2026  
**Status:** Sistema em operação com funcionalidades core implementadas

---

## 1. Visão Geral

O Sistema de Gestão de Preceptoria é uma aplicação web completa para gerenciamento de preceptores acadêmicos do curso de Medicina da UNINASSAU. O sistema substitui planilhas manuais por uma plataforma digital com banco de dados, regras financeiras, registro de presença, auditoria e operação administrativa.

### 1.1 Objetivos
- Cadastro centralizado de preceptores e seus vínculos acadêmicos
- Registro de presença via token seguro individual
- Gestão financeira com regras de cálculo flexíveis
- Auditoria completa de todas as operações
- Interface administrativa desktop-first
- Interface mobile-first para preceptores

### 1.2 Stack Tecnológica
- **Frontend:** React + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Estilo:** CSS personalizado com design system premium
- **Ícones:** Lucide React
- **Deploy:** Vercel/Netlify (frontend) + Supabase Cloud (backend)

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      SISTEMA DE GESTÃO DE PRECEPTORIA          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   PAINEL ADMIN   │    │  ROTA MOBILE     │                   │
│  │   (Desktop)      │    │  (/preceptor/    │                   │
│  │                  │    │   presenca)      │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                             │
│           └───────────┬───────────┘                             │
│                       │                                         │
│  ┌────────────────────▼────────────────────────┐               │
│  │              SUPABASE                        │               │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │               │
│  │  │ Auth     │ │ Database │ │ Edge     │     │               │
│  │  │ (JWT)    │ │ (RLS)    │ │ Functions│     │               │
│  │  └──────────┘ └──────────┘ └──────────┘     │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  ROTA TOKEN      │    │  EDGE FUNCTION   │                   │
│  │  (/p/:token)     │    │  (admin-create-  │                   │
│  │  (Acesso público)│    │   user)          │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Funcionalidades Implementadas

### 3.1 Autenticação e Autorização

#### 3.1.1 Login
- Autenticação via email/senha usando Supabase Auth
- Sessão JWT com refresh automático
- Tratamento de erros amigável
- Link "Esqueci minha senha" para recuperação

#### 3.1.2 Perfis e Papéis
| Papel | Descrição | Permissões |
|-------|-----------|------------|
| `super_admin` | Administrador master | Acesso total, gerenciar usuários |
| `admin_super` | Administrador avançado | Acesso administrativo completo |
| `administrador` | Administrador | Cadastros, vínculos, escalas |
| `academico` | Acadêmico | Preceptores, vínculos, escalas |
| `financeiro` | Financeiro | Regras, cálculos, pagamentos |
| `coordenador` | Coordenador | Validações, ajustes |
| `auditor` | Auditor | Leitura, auditoria |
| `preceptor` | Preceptor | Próprio cadastro, presença |

#### 3.1.3 Controle de Acesso
- **RLS (Row Level Security):** Todas as tabelas com políticas de acesso
- **Trigger de proteção:** Impede que usuário altere própria role
- **Auditoria:** Log de todas as operações críticas

### 3.2 Cadastros

#### 3.2.1 Preceptores
- **Dados pessoais:** Nome completo, CPF, email, telefone
- **Dados profissionais:** Profissão, conselho, modalidade de pagamento
- **Vínculos ADM:** Disciplina + período + semestre + vigência
- **Vínculos Internato:** Internato + local + setor + semestre + vigência
- **Status:** Ativo/Inativo com inativação em cascata

**Validações:**
- CPF único no sistema (constraint)
- Formato CPF: 11 dígitos numéricos
- Validação de dígitos verificadores
- Período obrigatório: ADM (1º ao 8º), Internato (9º ao 12º)

#### 3.2.2 Favorecidos e Empresas
- **Dados:** Nome/Razão Social, CPF/CNPJ, email financeiro, telefone
- **Dados bancários:** JSON com informações bancárias
- **Vínculos:** Relação com preceptores
- **Modalidade:** NFS, RPA, CLT, Sem pagamento

#### 3.2.3 Estrutura Acadêmica
- **IES:** Nome e sigla
- **Cursos:** Nome, código, vinculação à IES
- **Semestres:** Código (ex: 2026.1), vigência
- **Períodos:** Número e nome (ex: 1º Período)
- **Disciplinas:** Nome, código, carga horária
- **Internatos:** Número, nome, período, carga horária

#### 3.2.4 Locais e Setores
- **Locais:** Nome, tipo (Hospital/Clínica/UBS/etc), CNPJ, endereço
- **Setores:** Nome, vinculação ao local
- **Exemplos:** Hospital das Clínicas → Clínica Médica, Pediatria, etc.

### 3.3 Escalas

#### 3.3.1 Configuração
- **Vínculo local:** Referência ao vínculo ADM ou Internato
- **Dia da semana:** Segunda a Domingo (0-6)
- **Turno:** Manhã, Tarde, Noite
- **Horário:** Hora início e fim (opcional)
- **Vigência:** Data início e fim

#### 3.3.2 Regras
- Única escala por vínculo_local + dia_semana + turno + data_inicio
- Validação de vigência no registro de presença
- Verificação de pertencimento ao preceptor

### 3.4 Registro de Presença

#### 3.4.1 Rota Mobile (/preceptor/presenca)
- Lista de preceptores ativos
- Busca por nome
- Seleção de turnos (Manhã/Tarde/Noite)
- Registro via RPC `registrar_presenca`
- Apenas data atual permitida

#### 3.4.2 Rota Token (/p/:token)
- **Acesso individual seguro** por preceptor
- **Token:** 64 caracteres hexadecimais (32 bytes)
- **Armazenamento:** Apenas hash SHA-256 no banco
- **Fluxo:**
  1. Validação do token
  2. Exibição "Olá, [nome]"
  3. Busca de escalas do dia
  4. Seleção de turno
  5. Registro de presença

#### 3.4.3 RPCs Públicas (acesso via anon)
| Função | Parâmetros | Retorno |
|--------|------------|---------|
| `validar_acesso_token` | p_token (text) | jsonb {valido, preceptor_id, nome} |
| `buscar_escalas_token` | p_token (text) | jsonb array de escalas |
| `registrar_presenca_token` | p_token, p_escala_id, p_turno | jsonb {sucesso, presenca_id} |

#### 3.4.4 RPCs Autenticadas (painel administrativo)
| Função | Parâmetros | Retorno |
|--------|------------|---------|
| `gerar_acesso_presenca` | p_preceptor_id (uuid) | text (token bruto) |
| `renovar_acesso_preceptor` | p_preceptor_id (uuid) | text (novo token) |
| `bloquear_acesso_preceptor` | p_preceptor_id (uuid) | void |
| `revogar_acesso_preceptor` | p_preceptor_id (uuid) | void |
| `consultar_acesso_preceptor` | p_preceptor_id (uuid) | jsonb (status) |

#### 3.4.5 Validações de Presença
- Escala ativa para o dia da semana
- Escala dentro da vigência
- Turno corresponde à escala
- Preceptor vinculado à escala
- Sem duplicidade (mesmo vínculo + escala + data + turno)

### 3.5 Gestão Financeira

#### 3.5.1 Regras Financeiras
- **Tipos de cálculo:** por_turno, por_hora, por_grupo, mensal_fixo, rateio, adicional
- **Filtros:** tipo_atuacao, curso, disciplina, internato, local, setor
- **Vigência:** Data início e fim
- **Prioridade:** Para regras concorrentes
- **Exige presença:** Flag para regras que dependem de presença

#### 3.5.2 Cálculo Mensal (RPC `recalcular_competencia`)
- Busca preceptores com presença ou regras fixas
- Gera itens de cálculo detalhados
- Calcula totais (bruto, descontos, líquido)
- Suporta múltiplas versões

#### 3.5.3 Competências
- Abertura, cálculo, conferência, bloqueio
- Status: rascunho, aberta, em_conferencia, fechada, reaberta, cancelada
- Proteção contra recalculo após fechamento

### 3.6 Aprovações e Validações
- **Tipos:** acadêmica, financeira, saldo, ajuste, reabertura
- **Status:** pendente, aprovado, rejeitado, dispensado
- **Fluxo:** Multi-step com ordem

### 3.7 Saldos e Pagamentos
- **Saldos autorizados:** Por favorecido e curso
- **Movimentos:** Reserva, consumo, estorno, ajuste
- **Processos:** CH, processo, movimento, deferimento
- **Pagamentos:** Programação, baixa, comprovante

### 3.8 Auditoria

#### 3.8.1 Logs de Auditoria
- **Todas as tabelas de negócio** com trigger de auditoria
- **Dados:** Tabela, registro_id, operação, dados anteriores/novos
- **Rastreamento:** profile_id, user_id, timestamp

#### 3.8.2 Tela de Auditoria
- Visualização de logs por tabela
- Filtros por data e operação
- Detalhes de alterações

### 3.9 Gerenciamento de Usuários

#### 3.9.1 Funcionalidades
- **Criar usuário:** Via Edge Function (GoTrue Admin API)
- **Editar:** Nome, email, telefone, papéis
- **Bloquear/Desbloquear:** Ativar/inativar acesso
- **Recuperação de senha:** Envio de link por email
- **Listar:** Todos os usuários com papéis

#### 3.9.2 Segurança
- Apenas `super_admin` pode criar usuários
- Proteção contra auto-elevação de roles
- Auditoria de todas as operações

#### 3.10 Presença Real, Correções e Fluxo Financeiro (06/08/2026)

##### 3.10.1 Presenças e Correções
- Registro de presença passa por presenças reais (tabela `presencas`) com origem `preceptor`, `coordenador` ou `administrador` e status `confirmada`/`cancelada`.
- Presença cancelada **não entra** no cálculo nem nos totais.
- Correção administrativa via RPC `corrigir_presenca_administrativa` (roles: administrador, academico, financeiro, admin_super, super_admin, admin):
  - Grava ajuste em `ajustes_presenca` (turno/data antigos e novos, justificativa, responsável).
  - Atualiza observações da presença com a referência do ajuste.
  - Cria aprovação financeira pendente (tipo `financeira`, ordem 1) exigindo revisão.
  - Recalcula **somente** o vínculo/competência afetados (não recria outros cálculos; chamados existentes são preservados e ganham observação da correção).
- Recalcular seletivo preserva chamados e demais competências intactos.

##### 3.10.2 Nota Fiscal e Fila Financeira
- `solicitacoes_nota_fiscal` guarda a situação da nota (nao_solicitada, preparada, solicitada, nota_recebida, em_pagamento, pago, cancelado) + e-mail usado, demonstrativo e datas.
- `registrar_solicitacao_nota_fiscal` prepara a solicitação **sem duplicar** (idempotente por cálculo) e registra eventos em `solicitacao_nota_fiscal_eventos`.
- `buscar_fila_financeira` (painel financeiro, desktop-first) retorna **todos** os cálculos Internato com LEFT JOIN na situação da nota — sem filtrar por chamado_status. A página de Pagamentos exibe todos os cálculos e permite avançar no fluxo.
- **Fluxo definitivo**: presenca → cálculo → PDF demonstrativo → Outlook (preparada) → solicitada → nota_recebida → abertura de chamado → em_analise → deferido/concluido (= pagamento confirmado, auto-marcado como `pago`).
- **Bloqueio obrigatório**: `atualizar_chamado` rejeita transição para qualquer status diferente de `nao_aberto` se a nota fiscal não estiver em `nota_recebida` ou `pago`. Retorna `restricao: 'nota_nao_recebida'` com mensagem amigável.
- **Auto-pago**: quando `atualizar_chamado` recebe `deferido` ou `concluido`, a nota fiscal é automaticamente marcada como `pago` via upsert (idempotente). Evento de auditoria registrado com `origem: 'auto_deferido_chamado'`.

##### 3.10.3 Dashboard Administrativo
- RPC `dashboard_preceptoria_internato` (somente Internato; Prática excluída):
  - 13 parâmetros de filtro: competência, mês, ano, período, unidade, internato, local, setor, preceptor, chamado, situação da nota, pagamento.
  - Retorna `resumo`, `chamados_por_status`, `por_internato`, `por_unidade`, `por_local`, `por_preceptor`, `pendencias` e `detalhes` (colunas prontas para exportação).
  - Materializa o detalhamento em tabela temporária por chamada (idempotente em múltiplas chamadas na mesma sessão).
  - Acesso restrito a administrador, financeiro, academico, auditor, admin_super, super_admin, admin via `has_role`; `anon`/`PUBLIC` sem EXECUTE.
- Testado (banco remoto): duplicidade bloqueada, correção com ajuste + revisão financeira, recálculo seletivo, preservação de chamado, fila sem e-mail inventado, dashboard filtrado/ordenado, RLS por papel, entradas inválidas sem erro HTTP 400.

---

## 4. Estrutura do Banco de Dados

### 4.1 Diagrama de Entidades (Simplificado)

```
┌─────────────────┐     ┌─────────────────┐
│    profiles      │     │   user_roles     │
│─────────────────│     │─────────────────│
│ id (PK)         │◄────│ profile_id (FK) │
│ user_id (FK)    │     │ role            │
│ nome_completo   │     │ ativo           │
│ email           │     └─────────────────┘
│ ativo           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   preceptores    │     │ preceptor_       │
│─────────────────│     │ documentos       │
│ id (PK)         │◄────│─────────────────│
│ profile_id (FK) │     │ preceptor_id(FK) │
│ nome_completo   │     │ tipo            │
│ cpf             │     │ numero          │
│ modalidade_padrao│    └─────────────────┘
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  vinculos_pratica │ │ vinculos_       │ │ preceptor_      │
│─────────────────│ │ internato       │ │ acesso_presenca │
│ preceptor_id(FK)│ │─────────────────│ │─────────────────│
│ semestre_id(FK) │ │ preceptor_id(FK)│ │ preceptor_id(FK)│
│ disciplina_id   │ │ semestre_id(FK) │ │ token_hash      │
│ periodo_id      │ │ internato_id    │ │ ativo           │
│ data_inicio     │ │ data_inicio     │ │ bloqueado       │
│ data_fim        │ │ data_fim        │ │ revogado        │
└────────┬────────┘ └────────┬────────┘ └─────────────────┘
         │                   │
         └─────────┬─────────┘
                   ▼
         ┌─────────────────┐
         │  vinculo_locais  │
         │─────────────────│
         │ tipo_atuacao    │
         │ vinculo_adm_id  │
         │ vinculo_internato│
         │ local_id        │
         │ setor_id        │
         └────────┬────────┘
                   │
                   ├──────────────────┐
                   ▼                  ▼
         ┌─────────────────┐ ┌─────────────────┐
         │    escalas      │ │   presencas     │
         │─────────────────│ │─────────────────│
         │ vinculo_local_id│ │ preceptor_id(FK)│
         │ dia_semana      │ │ escala_id (FK)  │
         │ turno           │ │ data_presenca   │
         │ data_inicio     │ │ turno           │
         │ data_fim        │ │ status          │
         └─────────────────┘ └─────────────────┘
```

### 4.2 Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfis de usuários do sistema |
| `user_roles` | Papéis dos usuários |
| `preceptores` | Cadastro de preceptores |
| `preceptor_documentos` | Documentos dos preceptores |
| `ies` | Instituições de Ensino Superior |
| `cursos` | Cursos oferecidos |
| `semestres` | Semestres letivos |
| `periodos` | Períodos do curso |
| `disciplinas` | Disciplinas ministradas |
| `internatos` | Internatos do curso |
| `locais` | Locais de estágio |
| `setores` | Setores dos locais |
| `feriados` | Feriados nacionais/locais |
| `favorecidos` | Empresas/pessoas favorecidas |
| `preceptor_favorecidos` | Vínculo preceptor-favorecido |
| `vinculos_pratica` | Vínculos de prática acadêmica |
| `vinculos_internato` | Vínculos de internato |
| `vinculo_locais` | Vínculo com locais |
| `escalas` | Escalas de trabalho |
| `presencas` | Registros de presença |
| `ajustes_presenca` | Ajustes de presença |
| `regras_financeiras` | Regras de pagamento |
| `regra_preceptores` | Vínculo regra-preceptor |
| `rateios_financeiros` | Rateios entre preceptores |
| `competencias` | Competências financeiras |
| `calculos` | Cálculos mensais |
| `calculo_itens` | Itens do cálculo |
| `aprovacoes` | Aprovações de cálculos |
| `saldos_autorizados` | Saldos autorizados |
| `saldo_movimentos` | Movimentos de saldo |
| `processos_pagamento` | Processos de pagamento |
| `processo_calculos` | Vínculo processo-cálculo |
| `pagamentos` | Pagamentos realizados |
| `notificacoes` | Notificações do sistema |
| `configuracoes` | Configurações gerais |
| `audit_logs` | Logs de auditoria |
| `preceptor_acesso_presenca` | Tokens de acesso |

### 4.3 Enums

| Enum | Valores |
|------|---------|
| `app_role` | administrador, academico, financeiro, coordenador, auditor, preceptor, admin_super, super_admin |
| `status_registro` | ativo, inativo, pendente, bloqueado, cancelado |
| `tipo_atuacao` | adm, internato |
| `modalidade_pagamento` | nfs, rpa, clt, sem_pagamento |
| `turno` | manha, tarde, noite |
| `status_presenca` | confirmada, ajustada, cancelada |
| `origem_presenca` | preceptor, administrador, importacao |
| `forma_calculo` | por_turno, por_hora, por_grupo, mensal_fixo, rateio, adicional, ajuste, desconto, estorno |
| `status_competencia` | rascunho, aberta, em_conferencia, fechada, reaberta, cancelada |
| `status_calculo` | rascunho, calculado, em_validacao, aprovado, rejeitado, fechado, pago, cancelado |
| `tipo_item_calculo` | presenca, fixo, rateio, adicional, ajuste, desconto, estorno |
| `status_aprovacao` | pendente, aprovado, rejeitado, dispensado |
| `tipo_aprovacao` | academica, financeira, saldo, ajuste, reabertura |
| `status_processo` | rascunho, aberto, em_andamento, deferido, indeferido, concluido, cancelado |
| `status_pagamento` | pendente, programado, pago, estornado, cancelado |
| `tipo_documento` | cpf, rg, conselho, cnpj, contrato, nota_fiscal, rpa, comprovante, outro |

---

## 5. Rotas e Telas

### 5.1 Rotas da Aplicação

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Painel administrativo | Autenticado |
| `/login` | Tela de login | Público |
| `/recuperar-senha` | Recuperação de senha | Público |
| `/redefinir-senha` | Redefinição de senha | Token válido |
| `/preceptor/presenca` | Registro mobile | Público |
| `/p/:token` | Acesso individual por token | Token válido |

### 5.2 Módulos do Painel Administrativo

#### Operação
| Módulo | Descrição | Botão |
|--------|-----------|-------|
| `preceptores-pratica` | Preceptores Prática | Novo preceptor Prática |
| `preceptores-internato` | Preceptores do Internato | Novo preceptor |
| `escalas` | Escalas de trabalho | Nova escala |
| `presencas` | Registros de presença | - |
| `ajustes` | Ajustes de presença | Novo ajuste |

#### Financeiro
| Módulo | Descrição | Botão |
|--------|-----------|-------|
| `regras` | Regras financeiras | Nova regra |
| `fechamentos` | Fechamentos | Abrir competência |
| `memoria` | Memória de cálculo | - |
| `validacoes` | Validações | Validar selecionados |
| `saldos` | Saldos autorizados | Novo saldo |
| `processos` | Processos e movimentos | Novo processo |
| `pagamentos` | Pagamentos | Registrar pagamento |

#### Governança
| Módulo | Descrição | Botão |
|--------|-----------|-------|
| `auditoria` | Auditoria | - |
| `configuracoes` | Configurações | Nova configuração |
| `usuarios` | Gerenciar Usuários | Novo usuário (super_admin) |

#### Cadastros
| Módulo | Descrição | Botão |
|--------|-----------|-------|
| `favorecidos` | Favorecidos e empresas | Novo favorecido |
| `estrutura` | Estrutura acadêmica | Novo item |
| `locais` | Locais e setores | Novo local |

---

## 6. Segurança

### 6.1 Autenticação
- JWT com Supabase Auth
- Refresh automático de tokens
- Proteção contra CSRF
- Rate limiting no Supabase

### 6.2 Autorização
- **RLS (Row Level Security):** Todas as tabelas
- **Políticas por papel:** Leitura e escrita controladas
- **Funções SECURITY DEFINER:** Para operações sensíveis

### 6.3 Token de Presença
- **Geração:** 32 bytes aleatórios (64 hex chars)
- **Armazenamento:** Apenas hash SHA-256
- **Unicidade:** Máximo 1 token ativo por preceptor
- **Revocação:** Automática ao gerar novo token
- **Exposição:** Token bruto exibido apenas uma vez

### 6.4 Auditoria
- **Trigger automático:** Em todas as tabelas de negócio
- **Dados capturados:** Operação, dados antes/depois, usuário, timestamp
- **Logs imutáveis:** Tabela `audit_logs` com append-only

### 6.5 Proteção contra Elevação
- **Trigger:** Impede que usuário altere própria role
- **Validação:** Apenas super_admin pode atribuir super_admin
- **Bloqueio:** Usuário não pode bloquear a si mesmo

---

## 7. Migrações do Banco

### 7.1 Histórico de Migrações

| Migração | Descrição |
|----------|-----------|
| `001_schema_completo.sql` | Schema completo do sistema |
| `002_acesso_presenca_preceptor.sql` | Tokens de acesso individual |
| `003_integridade_e_consistencia.sql` | Correções de integridade |
| `004_auth_setup.sql` | Recuperação de funções e RLS |
| `005_seed_inicial.sql` | Dados iniciais (Medicina UNINASSAU) |
| `006_role_admin_super.sql` | Role admin_super |
| `007_super_admin_role.sql` | Role super_admin |
| `007a_add_super_admin_enum.sql` | Adicionar enum super_admin |
| `007b_assign_roles.sql` | Atribuir roles iniciais |
| `008_rls_auditoria_gestao_usuarios.sql` | RLS, auditoria, gestão de usuários |
| `008a_self_role_guard.sql` | Proteção contra auto-elevação |
| `010_cadastros_auxiliares.sql` | Cadastros auxiliares (setores, locais) |
| `011_disciplinas_curso_id_opcional.sql` | Disciplinas com curso opcional |
| `011_internato_disciplinas_setor.sql` | Internato × disciplinas × setor |
| `012_simplificar_internatos.sql` | Simplificação de internatos |
| `013_simplificar_setores.sql` | Simplificação de setores |
| `014_possui_vinculo_clt_nullable.sql` | Campo CLT opcional |
| `015_valor_inicial_numeric_14_2.sql` | Valor inicial numeric(14,2) |
| `016_escalas_itens_relacional.sql` | Escalas em modelo relacional |
| `017_escalas_itens_data_especifica.sql` | Itens com data específica |
| `019_escalas_itens_dia_semana_trigger.sql` | Trigger de dia da semana |
| `020_escalas_legacy_dia_semana_turno_nullable.sql` | Compatibilidade legado |
| `021_unica_escala_por_vinculo.sql` | Uma escala ativa por vínculo |
| `022_presencas_coordenador.sql` | Registro de presença pelo coordenador |
| `023_regras_componentes.sql` | Regras e componentes financeiros |
| `024_regra_componentes_condicao_liberacao.sql` | Condição de liberação |
| `025_internato_vinculo_campos_opcionais.sql` | Campos opcionais do vínculo |
| `026_vinculo_regras_financeiras.sql` | Regras por vínculo |
| `027_apuracao_mensal_fila_financeira.sql` | Apuração mensal + fila financeira |
| `028_rename_auto_apurar_fila_financeira.sql` | Renome de apuração |
| `030_presenca_real_e_ajustes.sql` | Presenças reais, ajustes, correção administrativa |
| `031_pagamentos_nota_fiscal.sql` | Pagamentos, nota fiscal, fila financeira |
| `032_revoke_anon_execute_novas_rpcs.sql` | Revoga EXECUTE de novas RPCs de anon |
| `033_dashboard_preceptoria_internato.sql` | Dashboard administrativo (Internato) |
| `034_fix_dashboard_ordernacao.sql` | Fix ordenação do dashboard |
| `035_fix_dashboard_temp_table.sql` | Fix escopo de CTE (tabela temporária) |
| `036_fix_dashboard_drop_temp_table.sql` | Fix idempotência da tabela temporária |
| `037_fix_universal_recalc.sql` | Recálculo universal, cadastro coordenador, frontend calc |
| `037b_fix_presencas_turno.sql` | `registrar_presenca_coordenador` aceita turno diferente |
| `037c_drop_sobrecarga_apuracao.sql` | Drop sobrecarga antiga `auto_apurar_competencia_financeira` |
| `037d_fix_liquido_calculo.sql` | Remove `total_liquido` (generated column) de UPDATE/INSERT |
| `038_fix_financial_flow.sql` | Validação nota recebida + auto-pago + fluxo financeiro definitivo |

### 7.2 Execução
1. Criar projeto Supabase vazio
2. Executar migrações em ordem no SQL Editor
3. Criar primeiro usuário no Supabase Auth
4. Atribuir papel administrador via SQL

---

## 8. Configuração e Execução

### 8.1 Pré-requisitos
- Node.js 18+
- npm ou yarn
- Conta no Supabase

### 8.2 Instalação

```bash
# Clonar repositório
git clone <url-do-repositorio>
cd sistema-preceptoria

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais do Supabase

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

### 8.3 Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 8.4 Configuração do Supabase

1. Criar projeto no Supabase
2. Executar todas as migrações em ordem
3. Configurar Email Templates (opcional)
4. Criar primeiro usuário admin
5. Atribuir role `super_admin` via SQL

---

## 9. Seed Inicial

### 9.1 Dados Cadastrados

#### IES
- UNINASSAU - Centro Universitário Maurício de Nassau

#### Curso
- Medicina (MED001)

#### Semestre
- 2026.1 (01/02/2026 a 31/07/2026)

#### Períodos
- 1º ao 12º Período

#### Disciplinas
- 60+ disciplinas distribuídas nos 12 períodos
- Exemplos: Anatomia, Fisiologia, Clínica Médica, Cirurgia, etc.

#### Internatos
1. Internato de Clínica Médica (9º período)
2. Internato de Pediatria (10º período)
3. Internato de Ginecologia e Obstetrícia (10º período)
4. Internato de Cirurgia Geral (11º período)
5. Internato de Saúde Coletiva (11º período)
6. Internato de Emergência e UTI (12º período)
7. Internato de Psiquiatria e Saúde Mental (12º período)
8. Internato eletivo (12º período)

#### Locais
- Hospital das Clínicas - UFPE
- Hospital São Lucas
- Hospital Português
- Hospital de Promoção à Saúde - HPRO
- Hospital Memorial Saúde
- UPA Norte
- UPA Sul
- UBS Boa Viagem
- UBS Casa Amarela
- Ambulatório UNINASSAU

#### Setores
- Clínica Médica, Pediatria, Ginecologia, Cirurgia, UTI, Pronto Socorro, etc.

#### Feriados
- 9 feriados nacionais de 2026

---

## 10. Funções de Banco (RPCs)

### 10.1 Funções de Negócio

| Função | Descrição |
|--------|-----------|
| `registrar_presenca` | Registra presença do preceptor autenticado |
| `registrar_presenca_token` | Registra presença via token |
| `recalcular_competencia` | Recalcula cálculos de uma competência |
| `registrar_presenca_coordenador` | Registra presença pelo coordenador |
| `corrigir_presenca_administrativa` | Corrige presença com ajuste + revisão financeira |
| `registrar_solicitacao_nota_fiscal` | Prepara solicitação de nota fiscal (idempotente) |
| `buscar_fila_financeira` | Fila financeira com situação da nota e e-mail |
| `atualizar_chamado` | Atualiza chamado com validação de nota recebida + auto-pago |
| `dashboard_preceptoria_internato` | Dashboard administrativo de Internato |

### 10.2 Funções de Acesso por Token

| Função | Descrição |
|--------|-----------|
| `validar_acesso_token` | Valida token e retorna dados do preceptor |
| `buscar_escalas_token` | Busca escalas do dia para o preceptor |
| `gerar_acesso_presenca` | Gera novo token de acesso |
| `renovar_acesso_preceptor` | Renova token (invalida anterior) |
| `bloquear_acesso_preceptor` | Bloqueia acesso |
| `revogar_acesso_preceptor` | Revoga acesso |
| `consultar_acesso_preceptor` | Consulta status do acesso |

### 10.3 Funções de Gestão de Usuários

| Função | Descrição |
|--------|-----------|
| `listar_usuarios_staff` | Lista todos os usuários (super_admin) |
| `atualizar_usuario_staff` | Atualiza dados e roles |
| `bloquear_usuario` | Bloqueia/desbloqueia usuário |
| `atualizar_dados_usuario` | Atualiza dados básicos |
| `redefinir_senha_usuario` | Registra auditoria de redefinição |

### 10.4 Funções Utilitárias

| Função | Descrição |
|--------|-----------|
| `current_profile_id` | Retorna ID do perfil atual |
| `has_role` | Verifica se usuário tem papel |
| `set_updated_at` | Atualiza campo updated_at |
| `handle_new_auth_user` | Cria profile ao criar usuário |
| `audit_row_change` | Registra auditoria |

---

## 11. Triggers

### 11.1 Triggers de Auditoria
- Aplicadas em 17+ tabelas de negócio
- Capturam INSERT, UPDATE, DELETE
- Registram dados anteriores e novos

### 11.2 Triggers de Updated At
- Aplicadas em 20+ tabelas
- Atualizam campo `updated_at` automaticamente

### 11.3 Triggers de Proteção
- `trg_prevent_self_role_change`: Impede auto-elevação

### 11.4 Triggers de Autenticação
- `on_auth_user_created`: Cria profile ao criar usuário no Auth

---

## 12. Políticas RLS

### 12.1 Padrões de Acesso

| Categoria | Leitura | Escrita |
|-----------|---------|---------|
| Perfil próprio | Próprio usuário | Próprio usuário |
| Dados acadêmicos | Todos autenticados | admin/academico |
| Dados financeiros | admin/financeiro/auditor/coordenador | admin/financeiro |
| Preceptores | Próprio ou staff | admin/academico |
| Presenças | Próprio ou staff | admin/academico |
| Auditoria | admin/auditor | Automático (trigger) |
| Configurações | Staff | admin |

### 12.2 Políticas Especiais

- **Vínculos:** Leitura individualizada por preceptor
- **Escalas:** Leitura baseada em vínculos
- **Token:** Acesso via RPC (anon) com validação interna

---

## 13. Índices

### 13.1 Índices de Performance

```sql
-- Preceptores
idx_preceptores_status
idx_preceptores_profile

-- Vínculos
idx_vinculos_pratica_preceptor
idx_vinculos_internato_preceptor

-- Escalas
idx_escalas_dia

-- Presenças
idx_presencas_data
idx_presencas_unica (único)

-- Regras financeiras
idx_regras_vigencia

-- Cálculos
idx_calculos_competencia
idx_calculo_itens_calculo

-- Processos
idx_processos_competencia

-- Pagamentos
idx_pagamentos_status

-- Auditoria
idx_audit_tabela_registro

-- Notificações
idx_notificacoes_profile

-- Token
idx_acesso_preceptor
idx_acesso_hash

-- Vínculo Locais
idx_vinculo_locais_unica (único)
```

---

## 14. Configurações do Sistema

### 14.1 Configurações Padrão

| Chave | Valor | Descrição |
|-------|-------|-----------|
| `registro_presenca_somente_dia_atual` | true | Preceptor registra apenas data atual |
| `exigir_escala_para_presenca` | true | Exige escala ativa para registrar |
| `permitir_saldo_negativo` | false | Bloqueia consumo acima do saldo |
| `moeda` | BRL | Moeda padrão |
| `timezone` | America/Recife | Fuso horário |

---

## 15. Conclusão

O Sistema de Gestão de Preceptoria está completo em suas funcionalidades core, incluindo:

✅ **Cadastros completos** (preceptores, vínculos, escalas, locais)  
✅ **Registro de presença** (mobile e token individual)  
✅ **Gestão financeira** (regras, cálculos, competências)  
✅ **Auditoria completa** (logs de todas as operações)  
✅ **Controle de acesso** (RLS, papéis, permissões)  
✅ **Gerenciamento de usuários** (criar, editar, bloquear)  
✅ **Interface administrativa** (desktop-first)  
✅ **Interface mobile** (preceptores)  
✅ **Seed inicial** (Medicina UNINASSAU)  
✅ **Migrações organizadas** (11 migrações)  

O sistema está pronto para uso em produção, com todas asseguranças de integridade, segurança e auditoria implementadas.
