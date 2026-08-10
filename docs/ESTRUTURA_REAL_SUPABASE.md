# Estrutura Real do Supabase - Levantamento Completo

> **Data da consulta:** 2026-08-01
> **Fonte:** Banco remoto via REST API (anon key)
> **Status:** 37/37 tabelas existem, todas vazias (0 linhas)

---

## 1. Estrutura Real Encontrada

### 1.1 Schemas
| Schema | Observação |
|--------|------------|
| `public` | Todas as tabelas do domínio |
| `extensions` | Extensões PostgreSQL |
| `graphql_public` | GraphQL (Supabase padrão) |

### 1.2 Extensões
- `pgcrypto` (gen_random_uuid)
- `btree_gist` (exclusões GiST)

### 1.3 Enums (16 tipos)

| Enum | Valores |
|------|---------|
| `app_role` | admin, super_admin (valores antigos: administrador, academico, financeiro, coordenador, auditor, preceptor, admin_super - ainda no enum mas nao utilizados) |
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

### 1.4 Tabelas (37 total)

#### Identidade e Perfis
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `profiles` | id (uuid PK), user_id (uuid FK→auth.users UNIQUE), nome_completo, email, telefone, avatar_url, ativo, created_at, updated_at | FK → auth.users |
| `user_roles` | id (uuid PK), profile_id (uuid FK→profiles), role (app_role), ativo, created_at | UNIQUE(profile_id, role) |

#### Preceptores
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `preceptores` | id (uuid PK), profile_id (uuid FK→profiles UNIQUE), nome_completo, nome_social, cpf (UNIQUE), rg, profissao, conselho_tipo, conselho_numero, email, telefone, modalidade_padrao (modalidade_pagamento), possui_vinculo_clt, status (status_registro), observacoes, created_by, updated_by, created_at, updated_at | FK → profiles (3x) |
| `preceptor_documentos` | id (uuid PK), preceptor_id (uuid FK→preceptores), tipo (tipo_documento), numero, arquivo_path, data_emissao, data_validade, observacoes, created_at | FK → preceptores |

#### Estrutura Acadêmica
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `ies` | id (uuid PK), nome (UNIQUE), sigla, status, created_at, updated_at | — |
| `cursos` | id (uuid PK), ies_id (FK→ies), nome, codigo, status, created_at, updated_at | UNIQUE(ies_id, nome) |
| `semestres` | id (uuid PK), curso_id (FK→cursos), codigo, data_inicio, data_fim, status, created_at, updated_at | UNIQUE(curso_id, codigo) |
| `periodos` | id (uuid PK), curso_id (FK→cursos), numero (smallint), nome, status | UNIQUE(curso_id, numero) |
| `disciplinas` | id (uuid PK), curso_id (FK→cursos), nome, codigo, carga_horaria, status, created_at, updated_at | UNIQUE(curso_id, nome) |
| `internatos` | id (uuid PK), curso_id (FK→cursos), numero (smallint), nome, periodo_id (FK→periodos), carga_horaria, status, created_at, updated_at | UNIQUE(curso_id, numero) |

#### Locais e Setores
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `locais` | id (uuid PK), nome (UNIQUE), tipo, cnpj, endereco, cidade, uf (char2), status, created_at, updated_at | — |
| `setores` | id (uuid PK), local_id (FK→locais), nome, status, created_at, updated_at | UNIQUE(local_id, nome) |
| `feriados` | id (uuid PK), data, descricao, abrangencia, local_id (FK→locais), ponto_facultativo | UNIQUE(data, abrangencia, local_id) |

#### Favorecidos
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `favorecidos` | id (uuid PK), tipo_pessoa (char2: PF/PJ), nome_razao_social, nome_fantasia, cpf (UNIQUE), cnpj (UNIQUE), email_financeiro, telefone, dados_bancarios (jsonb), status, created_at, updated_at | — |
| `preceptor_favorecidos` | id (uuid PK), preceptor_id (FK→preceptores), favorecido_id (FK→favorecidos), modalidade (modalidade_pagamento), data_inicio, data_fim, principal, status, created_at, updated_at | FK → preceptores, favorecidos |

#### Vínculos
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `vinculos_pratica` | id (uuid PK), preceptor_id (FK→preceptores), semestre_id (FK→semestres), disciplina_id (FK→disciplinas), periodo_id (FK→periodos), data_inicio, data_fim, status, observacoes, created_by, created_at, updated_at | UNIQUE(preceptor_id, semestre_id, disciplina_id, periodo_id, data_inicio) |
| `vinculos_internato` | id (uuid PK), preceptor_id (FK→preceptores), semestre_id (FK→semestres), internato_id (FK→internatos), **periodo_id (FK→periodos)**, data_inicio, data_fim, status, observacoes, created_by, created_at, updated_at | UNIQUE(preceptor_id, semestre_id, internato_id, data_inicio) |
| `vinculo_locais` | id (uuid PK), tipo_atuacao (enum), vinculo_pratica_id (FK→vinculos_pratica), vinculo_internato_id (FK→vinculos_internato), local_id (FK→locais), setor_id (FK→setores), status, created_at | UNIQUE(tipo_atuacao, vinculo_pratica_id, vinculo_internato_id, local_id, setor_id) |

#### Escalas
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `escalas` | id (uuid PK), tipo_atuacao, vinculo_adm_id (FK), vinculo_internato_id (FK), vinculo_local_id (FK→vinculo_locais), dia_semana (smallint), turno (enum), hora_inicio (time), hora_fim (time), data_inicio, data_fim, status, created_at, updated_at | UNIQUE(vinculo_local_id, dia_semana, turno, data_inicio) |

#### Presenças e Ajustes
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `presencas` | id (uuid PK), preceptor_id (FK→preceptores), escala_id (FK→escalas), tipo_atuacao, vinculo_adm_id (FK), vinculo_internato_id (FK), local_id (FK→locais), setor_id (FK→setores), data_presenca, turno, status (status_presenca), origem (origem_presenca), registrado_por (FK→profiles nullable), registrado_em, observacoes, created_at, updated_at | UNIQUE(preceptor_id, escala_id, data_presenca, turno) |
| `ajustes_presenca` | id (uuid PK), presenca_id (FK→presencas), preceptor_id (FK→preceptores), tipo_ajuste, dados_anteriores (jsonb), dados_novos (jsonb), justificativa, realizado_por (FK→profiles), realizado_em | — |

#### Financeiro
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `regras_financeiras` | id (uuid PK), nome, tipo_atuacao, curso_id, disciplina_id, internato_id, local_id, setor_id, forma_calculo, valor (numeric14,2), quantidade_base, prioridade, data_inicio, data_fim, exige_presenca, permite_acumulo, status, observacoes, created_by, updated_by, created_at, updated_at | Múltiplas FKs |
| `regra_preceptores` | regra_id (FK PK), preceptor_id (FK PK) | PK composta |
| `rateios_financeiros` | id (uuid PK), regra_id (FK→regras_financeiras), preceptor_id (FK→preceptores), percentual, valor_fixo, data_inicio, data_fim | — |

#### Cálculos e Aprovações
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `competencias` | id (uuid PK), curso_id (FK→cursos), ano, mes, data_inicio, data_fim, status (status_competencia), abertura_em, fechamento_em, aberto_por, fechado_por, observacoes, created_at, updated_at | UNIQUE(curso_id, ano, mes) |
| `calculos` | id (uuid PK), competencia_id (FK), preceptor_id (FK), favorecido_id (FK), modalidade, status (status_calculo), total_bruto, total_descontos, total_liquido (generated), versao, calculado_em, calculado_por, fechado_em, observacoes, created_at, updated_at | UNIQUE(competencia_id, preceptor_id, versao) |
| `calculo_itens` | id (uuid PK), calculo_id (FK→calculos), tipo (tipo_item_calculo), regra_id (FK), presenca_id (FK), descricao, quantidade, valor_unitario, valor_total (generated), referencia (jsonb), created_at | — |
| `aprovacoes` | id (uuid PK), calculo_id (FK), ajuste_presenca_id (FK), tipo (tipo_aprovacao), ordem, status (status_aprovacao), responsavel_profile_id, decidido_por, decidido_em, comentario, created_at | — |

#### Saldos e Processos
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `saldos_autorizados` | id (uuid PK), favorecido_id (FK), curso_id (FK), numero_ch, numero_movimento, valor_autorizado, data_inicio, data_fim, status, observacoes, created_at, updated_at | UNIQUE(favorecido_id, numero_ch) |
| `saldo_movimentos` | id (uuid PK), saldo_id (FK→saldos_autorizados), calculo_id (FK), tipo, valor, descricao, realizado_por, created_at | — |
| `processos_pagamento` | id (uuid PK), competencia_id (FK), favorecido_id (FK), saldo_id (FK), numero_processo, numero_ch, numero_movimento, valor, status (status_processo), deferimento_coordenacao, observacoes, created_by, created_at, updated_at | — |
| `processo_calculos` | processo_id (FK PK), calculo_id (FK PK), valor_alocado | PK composta |
| `pagamentos` | id (uuid PK), processo_id (FK), favorecido_id (FK), modalidade, valor_bruto, valor_descontos, valor_liquido (generated), data_programada, data_pagamento, status (status_pagamento), comprovante_path, observacoes, created_by, created_at, updated_at | — |

#### Sistema
| Tabela | Colunas Principais | Relações |
|--------|-------------------|----------|
| `notificacoes` | id (uuid PK), profile_id (FK→profiles), titulo, mensagem, tipo, link, lida_em, created_at | — |
| `configuracoes` | chave (text PK), valor (jsonb), descricao, updated_by, updated_at | — |
| `audit_logs` | id (bigserial PK), tabela, registro_id, operacao, dados_anteriores (jsonb), dados_novos (jsonb), profile_id, user_id, ocorrido_em | — |
| `preceptor_acesso_presenca` | id (uuid PK), preceptor_id (FK→preceptores), token_hash (UNIQUE), ativo, created_at, updated_at, expira_em, ultimo_acesso_em, bloqueado, bloqueado_em, revogado, revogado_em, created_by | — |

### 1.5 Views (2)
- `v_saldos_disponiveis` — Saldo autorizado menos consumo/estorno
- `v_preceptores_ativos` — Preceptores com status='ativo' + profile_id

### 1.6 Índices (16)
- `idx_preceptores_status`, `idx_preceptores_profile`
- `idx_vinculos_pratica_preceptor`, `idx_vinculos_internato_preceptor`
- `idx_escalas_dia`
- `idx_presencas_data`, `idx_presencas_unica` (UNIQUE)
- `idx_regras_vigencia`
- `idx_calculos_competencia`, `idx_calculo_itens_calculo`
- `idx_processos_competencia`, `idx_pagamentos_status`
- `idx_audit_tabela_registro`, `idx_notificacoes_profile`
- `idx_acesso_preceptor`, `idx_acesso_hash`
- `idx_vinculo_locais_unica` (UNIQUE)

### 1.7 Funções/RPCs (15)

| Função | Tipo | Retorno | Acesso |
|--------|------|---------|--------|
| `set_updated_at()` | trigger | trigger | — |
| `current_profile_id()` | function | uuid | authenticated |
| `has_role(roles[])` | function | boolean | authenticated |
| `handle_new_auth_user()` | trigger | trigger | — |
| `audit_row_change()` | trigger | trigger | — |
| `registrar_presenca(...)` | function | jsonb | authenticated |
| `recalcular_competencia(...)` | function | integer | authenticated |
| `gerar_acesso_presenca(...)` | function | text | authenticated |
| `validar_acesso_token(...)` | function | jsonb | **anon** |
| `buscar_escalas_token(...)` | function | jsonb | **anon** |
| `registrar_presenca_token(...)` | function | jsonb | **anon** |
| `bloquear_acesso_preceptor(...)` | function | void | authenticated |
| `revogar_acesso_preceptor(...)` | function | void | authenticated |
| `renovar_acesso_preceptor(...)` | function | text | authenticated |
| `consultar_acesso_preceptor(...)` | function | jsonb | authenticated |

### 1.8 Triggers
- `on_auth_user_created` → `handle_new_auth_user()` (auth.users INSERT)
- `set_updated_at` → `set_updated_at()` (17+ tabelas)
- `audit_*` → `audit_row_change()` (17+ tabelas)
- `trg_validate_vinculo_pratica_periodo` → `fn_validate_vinculo_periodo()` (vinculos_pratica INSERT/UPDATE OF periodo_id): Prática só aceita períodos 1-8
- `trg_validate_vinculo_internato_periodo` → `fn_validate_vinculo_periodo()` (vinculos_internato INSERT/UPDATE OF periodo_id): Internato só aceita períodos 9-12

### 1.9 Políticas RLS (resumo por tabela)

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|--------|--------|---------------------|
| `profiles` | own + staff | admin only (ALL) |
| `user_roles` | own profile | admin only |
| `preceptores` | own + staff | admin/academico |
| `preceptor_documentos` | own + staff | admin/academico |
| `ies, cursos, semestres, periodos, disciplinas, internatos` | all authenticated | admin/academico |
| `locais, setores, feriados` | all authenticated | admin/academico |
| `favorecidos, preceptor_favorecidos` | admin/financeiro/auditor/coordenador | admin/financeiro |
| `vinculos_pratica, vinculos_internato, vinculo_locais` | own vinculo + staff | admin/academico |
| `escalas` | own vinculo + staff | admin/academico |
| `presencas` | own + staff | admin/academico |
| `ajustes_presenca` | — | admin/academico/coordenador/auditor |
| `regras_financeiras, regra_preceptores, rateios_financeiros` | staff | admin/financeiro |
| `competencias, calculos, calculo_itens` | staff | admin/financeiro |
| `saldos_autorizados, saldo_movimentos` | staff | admin/financeiro |
| `processos_pagamento, processo_calculos, pagamentos` | staff | admin/financeiro |
| `aprovacoes` | staff | admin/academico/financeiro/coordenador |
| `notificacoes` | — (implicit own) | — |
| `configuracoes` | — | — |
| `audit_logs` | — | — (trigger only) |
| `preceptor_acesso_presenca` | admin + own | admin only |

---

## 2. Tabela Usada por Cada Tela

| Tela | Tabelas Principais | Tabelas de Apoio |
|------|-------------------|------------------|
| **Preceptores Prática** | `preceptores` | `profiles`, `vinculos_pratica`, `vinculo_locais`, `preceptor_acesso_presenca` |
| **Preceptores Internato** | `preceptores` | `profiles`, `vinculos_internato`, `vinculo_locais`, `preceptor_acesso_presenca` |
| **Favorecidos** | `favorecidos` | `preceptor_favorecidos` |
| **Estrutura Acadêmica** | `ies`, `cursos`, `semestres`, `periodos`, `disciplinas`, `internatos` | — |
| **Locais e Setores** | `locais`, `setores` | `feriados` |
| **Escalas** | `escalas` | `vinculo_locais`, `vinculos_pratica`, `vinculos_internato`, `preceptores` |
| **Presenças** | `presencas` | `escalas`, `preceptores`, `locais`, `setores` |
| **Ajustes** | `ajustes_presenca` | `presencas`, `preceptores` |
| **Regras Financeiras** | `regras_financeiras` | `regra_preceptores`, `preceptores` |
| **Fechamentos** | `competencias` | `calculos`, `calculo_itens` |
| **Memória de Cálculo** | `calculos`, `calculo_itens` | `regras_financeiras`, `presencas` |
| **Validações** | `aprovacoes` | `calculos`, `preceptores` |
| **Saldos Autorizados** | `saldos_autorizados` | `saldo_movimentos`, `favorecidos` |
| **Processos** | `processos_pagamento` | `processo_calculos`, `competencias` |
| **Pagamentos** | `pagamentos` | `processos_pagamento`, `favorecidos` |
| **Auditoria** | `audit_logs` | — |
| **Configurações** | `configuracoes` | `user_roles`, `profiles` |

---

## 3. Relações entre Entidades

```
auth.users
  └─ profiles (user_id)
       ├─ user_roles (profile_id)
       ├─ preceptores (profile_id)
       │    ├─ vinculos_pratica (preceptor_id)
       │    │    ├─ vinculo_locais (vinculo_pratica_id)
       │    │    │    └─ escalas (vinculo_local_id)
       │    │    │         └─ presencas (escala_id)
       │    │    └─ vinculo_locais → locais, setores
       │    ├─ vinculos_internato (preceptor_id)
       │    │    ├─ vinculo_locais (vinculo_internato_id)
       │    │    │    └─ escalas → presencas
       │    │    └─ vinculo_locais → locais, setores
       │    ├─ preceptor_favorecidos (preceptor_id)
       │    │    └─ favorecidos (favorecido_id)
       │    ├─ preceptor_acesso_presenca (preceptor_id)
       │    ├─ presencas (preceptor_id)
       │    ├─ ajustes_presenca (preceptor_id)
       │    ├─ regra_preceptores (preceptor_id)
       │    │    └─ regras_financeiras (regra_id)
       │    ├─ rateios_financeiros (preceptor_id)
       │    └─ calculos (preceptor_id)
       │         └─ calculo_itens (calculo_id)
       └─ (demais FKs para profiles)

ies → cursos → semestres
              → periodos → internatos
              → disciplinas

locais → setores
       → feriados

favorecidos
  ├─ preceptor_favorecidos → preceptores
  ├─ saldos_autorizados
  │    └─ saldo_movimentos → calculos
  ├─ processos_pagamento → competencias
  │    └─ processo_calculos → calculos
  └─ pagamentos → processos_pagamento

competencias → calculos → aprovacoes
```

---

## 4. RPCs Disponíveis

### Públicas (anon)
| RPC | Parâmetros | Retorno | Descrição |
|-----|-----------|---------|-----------|
| `validar_acesso_token` | p_token (text) | `{valido, nome, preceptor_id, erro}` | Valida token SHA-256 |
| `buscar_escalas_token` | p_token (text) | `[{escala_id, atividade, local, local_id, setor, turno, hora_inicio, hora_fim, ja_registrada}]` | Escalas do dia |
| `registrar_presenca_token` | p_token, p_escala_id, p_turno | `{sucesso, presenca_id, erro}` | Registra presença |

### Autenticadas (authenticated)
| RPC | Parâmetros | Retorno | Descrição |
|-----|-----------|---------|-----------|
| `consultar_acesso_preceptor` | p_preceptor_id | JSON status | Consulta status do token |
| `gerar_acesso_presenca` | p_preceptor_id | text (token bruto) | Gera novo token |
| `renovar_acesso_preceptor` | p_preceptor_id | text (novo token) | Revoga + gera novo |
| `bloquear_acesso_preceptor` | p_preceptor_id | void | Bloqueia acesso |
| `revogar_acesso_preceptor` | p_preceptor_id | void | Revoga acesso |
| `registrar_presenca` | (diversos) | jsonb | RPC interna |

---

## 5. Políticas RLS Existentes

Todas as 37 tabelas possuem RLS habilitado. Resumo das permissões de escrita:

| Operação | Quem pode |
|----------|-----------|
| CRUD em preceptores, vinculos, escalas, presencas | `admin`, `super_admin` |
| CRUD em favorecidos, regras financeiras, cálculos, pagamentos | `admin`, `super_admin` |
| CRUD em ajustes | `admin`, `super_admin` |
| CRUD em aprovações | `admin`, `super_admin` |
| SELECT em tabelas acadêmicas | Todos authenticated |
| SELECT em tabelas financeiras | `admin`, `super_admin` |
| Gestão de Usuários (user_roles, profiles) | `super_admin` apenas |
| Acesso token (público) | `anon` via RPCs específicas |

---

## 6. Diferenças entre Frontend e Banco

### 6.1 Frontend Atual (App.jsx)
- Usa constante `DATA` com arrays hardcoded para todas as 17 telas
- Formulários com selects hardcoded (opções fixas)
- Nenhuma consulta Supabase para CRUD (apenas token management)
- Sem autenticação — usa `anon` key diretamente
- Sem estados de carregamento/erro para dados
- Sem paginação
- IDs de preceptores são passados como nomes (strings) para token RPC

### 6.2 Banco Real
- 37 tabelas completamente estruturadas com RLS
- RPCs para token management já funcionais
- Políticas exigem `authenticated` role para INSERT/UPDATE/DELETE
- Dados acadêmicos em cascata: ies→cursos→semestres→periodos→disciplinas/internatos
- Vínculos conectam preceptores a disciplinas/internatos via semestres
- Escalas vinculadas a vinculo_locais (que conecta a vinculos_pratica/internato)
- Ausência total de dados (0 linhas em todas as tabelas)

### 6.3 Lacunas Críticas
1. **Autenticação**: Frontend não tem login — RLS bloqueia INSERT/UPDATE sem `authenticated`
2. **Queries CRUD**: Nenhuma tela faz SELECT/INSERT/UPDATE/DELETE no banco
3. **Dados de teste**: Todas as tabelas vazias — precissa seed inicial
4. **Formulários**: Campos hardcoded não correspondem 1:1 com colunas reais
5. **Selects dinâmicos**: Disciplinas, internatos, locais, preceptores devem vir do banco
6. **Relações**: Frontend não resolve joins (preceptor→vinculo→local→escala)
7. **Presença mobile**: `RegistroPresencaMobile.jsx` usa dados mock (5 preceptores fake)
8. **Paginação**: Ausente em todas as telas
9. **Busca**: Frontend filtra arrays locais, não faz busca server-side

---

## 7. Estruturas Realmente Ausentes

**Nenhuma** — Todas as 37 tabelas, 16 enums, 2 views, 15 funções, 16 índices, triggers e RLS estão presentes e funcionais. O banco está completo para o escopo atual.

---

## 8. Riscos e Pendências

### Riscos
1. **RLS sem auth**: Sem sistema de login, o frontend não consegue escrever em nenhuma tabela (exceto via RPCs de token)
2. **Dados zerados**: Qualquer CRUD precisará de dados referenciados (ies, cursos, semestres, locais) para INSERTs com FK
3. **Performance**: Queries com múltiplos joins (escalas→vinculo_local→vinculo→preceptor) podem ser lentas sem otimização
4. **Integridade**: Inserir dados sem validar existência de FKs pode causar erros de constraint

### Pendências
| Pendência | Prioridade | Impacto |
|-----------|-----------|---------|
| Implementar autenticação (login admin) | **CRÍTICA** | Sem isso, nenhuma escrita funciona |
| Seed de dados iniciais (ies, cursos, semestres, locais) | **ALTA** | Necessário para testar CRUDs |
| Conectar tela Preceptores Prática ao banco | **ALTA** | Tela principal do sistema |
| Conectar tela Preceptores Internato ao banco | **ALTA** | Segunda tela principal |
| Conectar tela Favorecidos ao banco | **ALTA** | Necessário para financeiro |
| Conectar tela Estrutura Acadêmica ao banco | **ALTA** | Dados de apoio para vínculos |
| Conectar tela Locais e Setores ao banco | **ALTA** | Dados de apoio para escalas |
| Conectar tela Escalas ao banco | **ALTA** | Operação principal |
| Conectar tela Presenças ao banco | **MÉDIA** | Consulta (já funciona via token) |
| Conectar telas financeiras ao banco | **MÉDIA** | Depende de dados de cadastro |
| Conectar Auditoria e Configurações | **BAIXA** | Consulta simples |
| Remover dados mock do frontend | **BAIXA** | Após cada tela conectada |
| Criar migration para dados seed (se necessário) | **MÉDIA** | Se FKs impedirem inserts |
