# Documentação Oficial — Sistema de Gestão de Preceptoria

> **Versão:** 1.17  
> **Data:** 02/10/2026  
> **Fonte Única Oficial** — Substitui todos os documentos anteriores.  
> **Changelog 1.17:** etapa **CORRIGIR-USUARIOS-CRIADOS-POR-ENGANO** — diagnóstico e limpeza de contas criadas indevidamente fora do aplicativo durante a homologação (01/10/2026, 18:50–20:51 UTC): **19 contas de `auth.users` + 19 `profiles` correspondentes removidos** (criadas por script externo em Node via endpoint público `auth.signUp`, sem `papel`, sem `user_roles`, sem registro em `audit_logs` e sem qualquer relação com `preceptores`). **7 usuários legítimos preservados** (4 Admin, 2 Coordenador anteriores + 1 Coordenador criado pelo fluxo oficial `admin-create-user` e usado em `vinculo_coordenadores`). **`preceptores` (127), vínculos (45), e-mails de cópia (44), `user_roles` (8) e auditoria não foram alterados.** Verificado que **nenhuma rotina do aplicativo cria autenticação ao cadastrar preceptor** (`insertPreceptor`/`updatePreceptor` gravam somente em `preceptores`; `criarUsuarioViaEdge` só é chamado pela tela Gerenciar Usuários). Nenhuma tela, migration, RLS ou funcionalidade alterada; nenhum e-mail ou redefinição de senha enviado; `npm run build` OK (ver seções 2, 4 e 18).  
> **Changelog 1.16:** etapa **ESCALA-COM-SETOR-VARIAVEL** — o **setor passou a ser selecionado exclusivamente por item da escala** (data/dia + turno) no formulário visual de criação/edição e foi **removido dos formulários de cadastro e edição de preceptores/vínculos** (`PreceptorFormModal` e `VinculoFormModal` em `src/App.jsx`). A **presença recupera automaticamente o setor do item da escala correspondente** (`registrar_presenca_coordenador` / `registrar_presenca_token` / `fetch_preceptores_com_escala_no_dia`), exibindo o setor recuperado na lista de presenças e sem permitir escolha manual de outro setor na confirmação. O setor do vínculo continua como campo legado/opcional no banco (local mantido no vínculo). Migração **`063_escala_com_setor_variavel.sql`** (aplicada via MCP `supabase-preceptor` no Project Ref `tdmrscavrdoekrzdlmpf`). Compatibilidade com escalas antigas preservada (fallback para setor do vínculo). Nenhuma alteração em regras financeiras, valores, saldos, cálculos, PDF, e-mail ou Dashboard. `npm run build` OK (ver seções 4, 5, 6 e 18).  
> **Changelog 1.15:** etapa **SETOR-NO-ITEM-DA-ESCALA** — o **setor passou a pertencer ao item da escala** (`escalas_itens.setor_id`), permitindo setores diferentes conforme data, dia e turno, **sem criar um vínculo por setor**. O setor do vínculo (`vinculo_locais.setor_id` / `vinculos_*.setor_id`) **não foi removido**: tornou-se **legado/opcional** e continua sendo o **fallback de leitura** para itens antigos sem setor próprio (`setor_nome` dos itens em `fetchEscalasPorVinculo` usa `COALESCE(setor do item, setor legado do vínculo)`). Migração **`062_setor_no_item_escala.sql`** (aplicada via MCP `supabase-preceptor` no Project Ref `tdmrscavrdoekrzdlmpf`): adiciona a coluna `setor_id uuid NULL` + FK `escalas_itens_setor_id_fkey → setores(id)` (somente setores cadastrados, nunca texto livre) + índice + comentário, e recria a RPC `salvar_escala_completa` aceitando `setor_id` **opcional** por item (item sem setor fica `NULL` = legado; **nenhum setor copiado automaticamente**). **Local continua no vínculo**; RLS/triggers/presenças/cálculos/pagamentos **inalterados**; nenhuma coluna antiga removida; nenhuma alteração de valores, saldos, PDF, e-mail ou Dashboard; **formulário visual não alterado** (próxima etapa). Verificações: estrutura confirmada; item criado com setor próprio e persistido; rejeição de setor inexistente e de texto livre; item sem setor cai no fallback do vínculo; conflito de escala e UNIQUE (escala+data+turno) intactos; RLS testada com papel simulado (admin lê/grava, coordenador lê escalas associadas e não grava em `setores`); banco restaurado ao baseline (0 escalas/0 presenças/0 cálculos, auditoria 3431); `npm run build` OK (ver seções 5, 17 e 18).  
> **Changelog 1.14:** etapa **DASHBOARD-GRAFICO-SALDO-EXPORTACAO** — o gráfico **"Utilização do saldo semestral"** passou a exibir **ranking de vínculos com barras clicáveis** (até 10 maiores percentuais + todos os acima de 80% e com saldo esgotado; cada barra traz preceptor, identificação do vínculo, saldo inicial, valor utilizado, saldo disponível, percentual e barra de progresso; **vínculos sem saldo não entram no ranking** e aparecem como contagem "X vínculos sem saldo informado"; a busca por preceptor mostra só os vínculos dele; **clique na barra aplica o preceptor na lista e expande o registro correspondente**, sem navegar e sem alterar dados). **Exportações ganharam saldo** com os mesmos valores da lista: Excel com colunas de saldo nas abas **Preceptores** e **Atuações** (por vínculo) + ranking e contagens no Resumo; PDF com a seção **"Vínculos com maior utilização do saldo"** (totais, maiores utilizações, acima de 80%, esgotados e sem saldo informado, **sem CPF/CNPJ**) e com as mesmas colunas de saldo na lista e na composição; todos os registros **filtrados** exportados (não só a página visível). Novas funções puras `montarRankingSaldoVinculos`, `identificacaoVinculoLinha` e `valoresSaldoExport` com **69 asserções** (`scratch/test_grafico_saldo_exportacao.mjs`) além das 102 da etapa anterior; `npm run build` OK; **nenhuma** migração, RPC, cálculo, pagamento, filtro ou gráfico de indicadores alterado (ver seções 15 e 18).  
> **Changelog 1.13:** etapa **DASHBOARD-SALDO-POR-PRECEPTOR** — a lista única "Acompanhamento dos preceptores" passou a exibir o **saldo semestral por preceptor e por vínculo**: linha de saldo no cabeçalho de cada preceptor (vínculos, turnos, saldo inicial, valor utilizado, valor pago, saldo disponível, percentual e **situação financeira**) e **expansão agrupada por vínculo** (um bloco por vínculo com as 8 colunas existentes + faixa de saldo com barra de progresso); **filtros rápidos de saldo** independentes (acima de 80% utilizado, saldo esgotado, saldo não informado). Fonte única: `vinculos_internato.valor_inicial` (via `saldo_semestral`, agora preservando `null` = "Saldo não informado") + fila financeira, considerando cálculos **válidos** (`calculado/aprovado/fechado/pago`) e **atualizados** (sem observação de desatualização); nunca usa `preceptores.valor_inicial`. Funções puras testadas (102 asserções) e `npm run build` OK; **nenhuma** migração, RPC, cálculo, pagamento, gráfico ou exportação alterado (ver seções 15 e 18).  
> **Changelog 1.12:** etapa **CPF-OPCIONAL-SEM-VALIDACAO** — CPF **opcional** no cadastro do preceptor e **validação matemática dos dígitos verificadores removida** (`validateCpf` eliminada de `App.jsx`): CPF vazio salva normalmente (grava `NULL`), CPF fictício (ex.: `555.555.555-55`) aceito, máscara `000.000.000-00` e limite de 11 dígitos preservados, formato parcial ainda tratado ("CPF incompleto"), **duplicidade bloqueada somente para CPF preenchido** (pré-checagem + UNIQUE; `NULL` não conflita), **nenhuma alteração de banco necessária**; com CNPJ, razão social e CNPJ continuam sendo a identificação fiscal principal (ver seções 4 e 18).  
> **Changelog 1.11:** etapa **BLOQUEAR-CONFLITO-DE-ESCALA** — bloqueio implementado no banco e na interface: migração `061_bloqueio_conflito_escala.sql` cria as funções `fn_mensagem_conflito_escala`/`fn_avaliar_conflito_escala`, as RPCs públicas `validar_conflito_escala`/`validar_conflito_escala_itens`, triggers `trg_escalas_itens_conflito`/`trg_escalas_conflito`/`trg_presencas_conflito` e reforça `salvar_escala_completa`, `registrar_presenca_coordenador` e `registrar_presenca_token` com mensagem amigável (sem SQL/UUID na tela); pré-validação no frontend (`validarConflitoEscala` em `queries.js`, diálogo em `App.jsx`, exibição em `RegistroPresencaToken.jsx`, `white-space:pre-line` em `styles.css`); 24 testes SQL executados com sucesso e banco limpo (fixtures removidas); `npm run build` OK (ver seções 5, 6, 17 e 18).  
> **Changelog 1.10:** etapa **MAPEAR-CONFLITOS-DE-ESCALA** — mapeamento somente leitura dos conflitos de escala (relatório `MAPA_CONFLITOS_ESCALA.md` na raiz): regra registrada na seção 5, **0 conflitos** encontrados no estado atual do banco; nenhum dado, escala, presença ou estrutura alterada e **nenhum bloqueio implementado** (ver seções 5 e 18).  
> **Changelog 1.9:** etapa **VALIDAR-PAGAMENTO-SIMPLIFICADO** — o Dashboard foi alinhado ao fluxo simplificado: os rótulos antigos **"Aguardando nota fiscal"**, **"Nota fiscal recebida"**, **"Valor da nota"** e **divergência de nota** deixaram de existir na tela; a faixa de situações, os filtros rápidos da lista e o gráfico "Situação dos processos" usam **E-mail não enviado / Não pagos / Pagos / Com pendência real**; grade dos chips ajustada para 4 colunas; gráficos, indicadores, lista única e exportação **preservados**; nenhum cálculo, regra, RPC ou migração alterado (ver seções 15 e 18).  
> **Changelog 1.8:** etapa **PAGAMENTO-LOTE-TELA** — o Controle Financeiro ganhou **filtros rápidos de pagamento**, **modo de seleção múltipla** (checkbox por linha, "Selecionar esta página" e "Selecionar todos os resultados filtrados"), **barra fixa** com quantidade/valor/limpar e **modal de confirmação com prévia obrigatória** das RPCs de lote (não executa em divergência); ação individual **Marcar como pago** preservada; responsivo desktop/mobile e sem alteração de banco (ver seções 8, 14, 17, 18 e 19).  
> **Changelog 1.7:** etapa **PAGAMENTO-LOTE-BANCO** — RPCs transacionais `previa_pagamento_lote` e `executar_pagamento_lote` para registrar o pagamento de **vários preceptores na mesma competência** (prévia com bloqueios + execução tudo-ou-nada, histórico individual, data/valor/responsável; sem interface, sem alterar cálculos, valores, escalas, presenças, PDF ou e-mail; ver seções 10, 14, 17 e 18).  
> **Changelog 1.6:** etapa **FLUXO-EMAIL-PAGAMENTO** — fluxo pós-cálculo simplificado para **Cálculo conferido → Preparar e-mail → Marcar e-mail enviado → Não pago → Marcar como pago → Pago**; etapas de nota fiscal e de pagamento em etapas removidas da interface; novo texto de fechamento do e-mail (ver seções 8, 10 e 12).  
> **Changelog 1.5:** etapa **CORRIGIR-CC-DO-OUTLOOK** — a preparação agora envia também o parâmetro **`mailtouri`** (URI `mailto:` completo), único formato da integração atual que preenche o **Cc** do Outlook Web (ver seção 12).  
> **Changelog 1.4:** etapa **EMAIL-OUTLOOK-COM-CC** — deep link do Outlook Web agora preenche **Para = e-mail principal** e **Cc = e-mails adicionais ativos** do cadastro atual, com remoção de duplicidades e bloqueio amigável sem endereço válido (ver seção 12).  
> **Changelog 1.3:** etapa **EMAILS-ADICIONAIS-CADASTRO** — e-mail principal preservado em `preceptores.email` (sem migração) + nova tabela `preceptor_emails_copia` para e-mails adicionais de cópia do cadastro principal (migrações 058/059; ver seção 4).  
> **Changelog 1.2:** correção da identificação do responsável pela confirmação de envio de e-mail (`enviado_por` violava a FK `→ profiles.id`); transição `preparada → solicitada` agora é transacional via RPC `confirmar_envio_solicitacao_nota` (migração 057).
> **Project Ref:** `tdmrscavrdoekrzdlmpf`  
> **MCP:** `supabase-preceptor`

---

## 1. Visão Geral

Sistema completo para gerenciamento de preceptores acadêmicos do curso de Medicina da UNINASSAU. Substitui planilhas manuais por plataforma digital com banco de dados, regras financeiras, registro de presença, auditoria e operação administrativa.

### Stack
- **Frontend:** React + Vite (SPA, sem react-router — navegação por pathname + state)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Estilo:** CSS personalizado (azul-escuro #10203e + dourado #c8993f)
- **Ícones:** Lucide React
- **Banco:** 34+ tabelas, 40 RPCs, 61 migrações, RLS em todas as tabelas

### Arquitetura
```
Painel Administrativo (desktop-first)  ─┐
                                         ├─ Supabase (PostgreSQL + Auth + RPCs)
Rota Mobile /p/:token (mobile-first)  ─┘
```

### Arquivos Principais
| Arquivo | Linhas | Função |
|---------|--------|--------|
| `src/App.jsx` | ~7660 | Componente principal (todas as telas admin) |
| `src/services/queries.js` | ~1800 | Service layer (queries + RPCs) |
| `src/styles.css` | ~5000 | Estilos do sistema |
| `src/RegistroPresencaToken.jsx` | ~300 | Rota mobile /p/:token |

---

## 2. Perfis e Permissões

### Papéis do Sistema
| Papel | Acesso |
|-------|--------|
| `admin` | Acesso administrativo completo (cadastros, escalas, financeiro, configurações) |
| `coordenador` | Acesso operacional restrito: visualiza e opera apenas atuações associadas (via `vinculo_coordenadores`). Não acessa cadastro administrativo, financeiro nem configurações. |

> **Somente `admin` e `coordenador` possuem usuário de autenticação (`auth.users` + `profiles` + `user_roles`). Preceptores não têm login, senha nem primeiro acesso** — ver regra inegociável na seção 4.

### Controle de Acesso
- **RLS (Row Level Security)** habilitado em todas as tabelas.
- **Trigger de proteção:** Impede que usuário altere própria role (`fn_self_role_guard`).
- **Auditoria:** Log completo de operações críticas em `audit_logs`.

### Rotas e Acesso
| Rota | Acesso | Descrição | Status |
|------|--------|-----------|--------|
| `/login` | Público | Tela de login | Ativo |
| `/recuperar-senha` | Público | Recuperação de senha | Ativo |
| `/redefinir-senha` | Público (token) | Redefinição de senha | Ativo |
| `/` | Autenticado | Painel administrativo | Ativo |
| `/preceptor/presenca` | Coordenador/Admin | Registro de presença por coordenador | Ativo |
| `/p/:token` | Token válido | Registro mobile de presença | **Legado técnico** — aguardando descontinuação |

---

### Grupos do Menu Lateral (Sidebar)
| Grupo | Itens | Acesso |
|-------|-------|--------|
| Operação | Escalas, Registrar Presenças, Presenças | Admin (todos); Coordenador (Escalas, Registrar Presenças e Presenças — sempre restritos às atuações associadas via `vinculo_coordenadores`) |
| Financeiro | Controle financeiro, Dashboard | Admin |
| Cadastros | Preceptores do Internato, Cadastros auxiliares, **Regras financeiras** | Admin |
| Governança | Auditoria, Configurações, Gerenciar Usuários | Admin |

---

## 3. Cadastros Auxiliares

### Estrutura Acadêmica
| Tabela | Descrição |
|--------|-----------|
| `ies` | Instituições de Ensino Superior |
| `cursos` | Cursos (vinculados à IES) |
| `semestres` | Semestres letivos |
| `periodos` | Períodos do curso (1º ao 12º) |
| `disciplinas` | Disciplinas ministradas |
| `internatos` | Internatos do curso |

### Locais e Setores
| Tabela | Descrição |
|--------|-----------|
| `locais` | Locais de estágio (hospitais, clínicas, UBS) |
| `setores` | Setores dos locais |
| `unidades` | Unidades dentro dos locais |

### Outros Cadastros
| Tabela | Descrição |
|--------|-----------|
| `profissoes` | Profissões dos preceptores |
| `modalidades_pagamento` | Modalidades (NFS, RPA, CLT, Sem pagamento) |
| `feriados` | Feriados nacionais e locais |

**Status:** Implementada e testada manualmente.

---

## 4. Preceptores e Atuações

### Cadastro Principal
| Tabela | Descrição |
|--------|-----------|
| `preceptores` | Cadastro pessoal (nome, **e-mail principal**, CPF/CNPJ, razão social, profissão, conselho) |
| `preceptor_emails_copia` | E-mails adicionais para cópia do **cadastro principal** (não do vínculo) |
| `preceptor_documentos` | Documentos do preceptor |
| `profiles` | Perfil de **usuário de autenticação** — pertence apenas a Administradores e Coordenadores, **nunca a preceptores** |

### Regra Inegociável — Preceptores NÃO Possuem Login (Etapa CORRIGIR-USUARIOS-CRIADOS-POR-ENGANO)
- **Preceptores não possuem login.**
- **Preceptores não possuem senha.**
- **Preceptores não recebem primeiro acesso** (`profiles.primeiro_acesso_pendente` não se aplica a eles — não têm `profile`).
- **Somente Administradores e Coordenadores possuem usuários de autenticação** (`auth.users` + `profiles` + `user_roles`).
- **O cadastro de preceptor nunca cria `auth.users`, nunca cria `profile` de acesso, nunca envia convite/primeiro acesso e nunca gera senha.** O fluxo grava somente em estruturas administrativas: `preceptores`, `preceptor_emails_copia`, `preceptor_documentos`, `vinculos_*`, `vinculo_locais` e associações necessárias.
- Não existe papel/usuário "preceptor": a permissão vem exclusivamente de `user_roles` (`admin` ou `coordenador`).
- A rotina de criação de usuário (`criarUsuarioViaEdge` → Edge Function `admin-create-user`) é **exclusiva da tela Gerenciar Usuários** e só aceita `admin`/`coordenacao`; o fluxo legítimo de Administradores e Coordenadores **não foi alterado**.
- **Situação verificada em 02/10/2026:** 7 usuários de autenticação (4 Admin, 3 perfis com `papel=coordenador`) e 127 preceptores — **nenhum preceptor entre os usuários**; 19 contas indevidas removidas sem tocar em preceptores, vínculos ou auditoria.

**Nota sobre RG:** O campo `rg` existe na tabela `preceptores` mas foi **removido da interface** (não é exibido no formulário).

### CPF (Etapa CPF-OPCIONAL-SEM-VALIDACAO)
- **Opcional:** CPF vazio permite salvar o preceptor (`normalizeCpf()` grava `NULL`; a constraint `preceptores_cpf_unique` é `UNIQUE` e o Postgres permite múltiplos `NULL`s — **nenhuma alteração de banco foi necessária**).
- **Sem validação de dígitos verificadores:** a função `validateCpf()` foi removida; CPF fictício (ex.: `555.555.555-55`) é aceito. A mensagem "CPF inválido. Verifique os dígitos verificadores." **não existe mais**.
- **Preservado:** máscara visual `000.000.000-00`, limite de 11 dígitos, armazenamento normalizado (só dígitos) e tratamento de formato parcial ("CPF incompleto. Informe todos os 11 dígitos ou deixe o campo vazio.").
- **Duplicidade:** bloqueada **somente quando o CPF está preenchido** — pré-checagem `buscarPreceptorPorCpf()` + constraint `preceptores_cpf_unique` (`23505` → "CPF já cadastrado para outro preceptor."). Dois preceptores com CPF vazio não conflitam.
- **Com CNPJ:** razão social e CNPJ são a identificação fiscal principal no e-mail e no PDF (identificação `PJ`; CPF não aparece). Sem CNPJ, usa-se o nome do preceptor e o CPF **somente se estiver preenchido**. Nenhum CPF é gerado ou preenchido automaticamente.
- **Constraints existentes mantidas:** `cpf_formato CHECK (cpf is null or cpf ~ '^[0-9]{11}$')` (só formato) e `preceptores_cpf_unique UNIQUE (cpf)` (duplicidade de preenchidos).
- **Arquivos alterados:** `src/App.jsx` (remoção de `validateCpf`, campo do formulário, `handleSave`). **Não alterado:** banco, máscara, CNPJ, PDF, e-mail, vínculos, escalas, presenças, cálculos, financeiro e Dashboard.

### E-mails para cópia (Etapa EMAILS-ADICIONAIS-CADASTRO)

**Estrutura utilizada:** tabela nova `preceptor_emails_copia` com `id`, `preceptor_id` (FK → `preceptores` com `ON DELETE CASCADE`), `email`, `ativo`, `criado_em`, `atualizado_em`. Cada e-mail adicional pertence ao **cadastro principal do preceptor**, nunca ao vínculo. Não foi criada tabela intermediária para o e-mail principal.

**Preservação do e-mail principal:** o campo continua sendo `preceptores.email` (mesma coluna, mesmo valor, **sem migração de dados**). Na interface o rótulo passou a ser **"E-mail principal"** (formulário, ficha e prévia de exclusão).

**Restrições e validações (banco — migração 058):**
| Regra | Implementação |
|-------|---------------|
| Sem duplicidade no mesmo preceptor (ignora maiúsculas/minusúsculas) | Índice único `preceptor_emails_copia_preceptor_email_uniq (preceptor_id, lower(btrim(email)))` |
| Adicional nunca igual ao e-mail principal | Trigger `fn_preceptor_emails_copia_validar` (insert/update da linha) |
| E-mail principal nunca igual a um adicional ativo | Trigger `fn_preceptores_email_principal_guard` (update de `preceptores.email`) |
| Formato válido e não vazio | Mesma trigger de validação + `CHECK` de não vazio |
| Espaços nas pontas | `btrim` aplicado pela trigger antes de gravar |
| `atualizado_em` automático | Preenchido pela trigger de validação |
| Histórico preservado | Remoção de uso = **desativação** (`ativo=false`); exclusão definitiva só para linha nunca persistida; `ON DELETE CASCADE` acompanha a exclusão do preceptor |
| Auditoria | Trigger `trg_preceptor_emails_copia_audit` → `audit_logs` |

Mensagens curtas amigáveis (`email_vazio`, `email_invalido`, `email_principal_repetido`, `email_principal_duplicado_copia`, código `23505`) são convertidas pelo frontend em texto amigável — **SQL e constraint nunca são exibidos** (`mensagemErroEmailsCopia()` em `src/services/queries.js`).

**Validações de frontend** (`validarEmailsCopia()` em `src/services/queries.js`): formato válido, trim, comparação sem diferenciar maiúsculas/minusúsculas, bloqueio de duplicidade entre adicionais, bloqueio de repetição com o e-mail principal e bloqueio de campo vazio — executadas antes de gravar, com mensagem amigável.

**Interface:** modal do cadastro mantém a largura atual (`760px`). Bloco **"E-mails para cópia"** ocupa toda a largura abaixo da linha E-mail principal/Telefone: lista compacta com **campo de e-mail**, **badge Ativo/Inativo** e ação por linha (**Remover** para linha ainda não persistida, **Desativar** para linha persistida ativa, **Ativar** para linha persistida inativa) + botão **"+ Adicionar e-mail para cópia"**. Estado vazio: "Nenhum e-mail para cópia cadastrado." Responsivo em 390/768/1366 px (quebra para pilha em ≤768 px, alvos ≥44 px em ≤430 px).

**Permissões:** RLS `preceptor_emails_copia_admin` (ALL) restrita às roles `admin`/`super_admin`; o bloco só é renderizado para Administrador (`isAdmin`) e só é validado/gravado por ele. Coordenador não visualiza nem edita o cadastro administrativo.

**Arquivos alterados:** `src/App.jsx` (rótulos + componente `EmailsCopiaSection` + carga em edição + validação/gravação no `handleSave`), `src/services/queries.js` (`fetchEmailsCopia`, `salvarEmailsCopia`, `validarEmailsCopia`, `normalizarEmailCopia`), `src/styles.css` (bloco `.emails-copia-*` + media queries), `supabase/migrations/058_emails_adicionais_copia.sql` e `supabase/migrations/059_revoca_exec_funcoes_emails_copia.sql` (revoga `EXECUTE` das funções de trigger para `anon`/`authenticated`). **Não alterado:** Outlook/montagem de e-mail, vínculos, escalas, presenças, cálculos, PDF e financeiro.

### Vínculos
| Tabela | Descrição | Períodos |
|--------|-----------|----------|
| `vinculos_adm` | Vínculos de Prática | 1º ao 8º período |
| `vinculos_internato` | Vínculos de Internato | 9º ao 12º período |
| `vinculo_locais` | Associação vínculo → local + setor | — |
| `vinculo_coordenadores` | Associação vínculo ↔ coordenador | — |
| `vinculo_regras_financeiras` | Associação vínculo → regra financeira | — |

### Regras de Período
- **Prática:** Período obrigatório de 1º ao 8º.
- **Internato:** Período obrigatório de 9º ao 12º.
- Validação no frontend (Form) e no banco (trigger `fn_validate_vinculo_periodo`).

### Regras de Completude do Vínculo (Liberação para Escala)
Um vínculo é considerado **liberado para Escala** quando todos os campos obrigatórios estão preenchidos:

| # | Campo | Obrigatório | Tabela |
|---|-------|-------------|--------|
| 1 | Preceptor ativo | Sim | `preceptores.status` |
| 2 | Vínculo ativo | Sim | `vinculos_internato.status` |
| 3 | Nome completo | Sim | `preceptores.nome_completo` |
| 4 | Unidade | Sim | `vinculos_internato.unidade_id` (com fallback para `preceptores.unidade_id`) |
| 5 | Profissão | Sim | `preceptores.profissao_id` |
| 6 | Internato | Sim | `vinculos_internato.internato_id` |
| 7 | Período | Sim | `vinculos_internato.periodo_id` |
| 8 | Local de atuação | Sim | `vinculos_internato.local_id` |
| 9 | Setor | Sim | `vinculos_internato.setor_id` |
| 10 | Semestre | Sim | `vinculos_internato.semestre_id` |
| 11 | Início da vigência | Sim | `vinculos_internato.data_inicio` |

**Campos que NÃO participam da completude** (são avaliados separadamente):
- Coordenador (controla visibilidade, não completude)
- Saldo semestral (pertence ao fluxo financeiro)
- Regra financeira (ausência bloqueia apenas cálculos futuros)
- Modalidade de pagamento dentro do vínculo
- CNPJ ou razão social dentro do vínculo
- RG

**Fonte única da regra:** Função `getVinculoCamposFaltantes()` em `src/services/queries.js`.

### Regras de Visibilidade por Perfil
| Perfil | Visualiza | Escalas | Financeiro | Cadastros |
|--------|-----------|---------|------------|-----------|
| Admin | Todas as atuações | Cria/edita/visualiza qualquer vínculo | Acesso completo | Acesso completo |
| Coordenador | Apenas atuações associadas (via `vinculo_coordenadores`) | Visualiza e opera apenas vínculos associados | **Sem acesso** | **Sem acesso** |

**Coordenador não acessa:**
- Cadastro de preceptores (criar, editar, inativar)
- Regras financeiras
- Apuração mensal
- Pagamentos
- Dashboard financeiro
- Configurações
- Gerenciamento de usuários

### Regras de Exclusão
- **Nenhum cadastro legítimo deve ser excluído definitivamente.**
- Preceptor deve ser **desativado** (`status='inativo'`) ou **arquivado**.
- **Arquivar** preserva o cadastro legítimo para histórico (inativar NÃO apaga o histórico; a RLS garante que dados anteriores permanecem consultáveis).
- **Excluir** remove permanentemente um cadastro criado incorretamente, para re-cadastrá-lo do zero — **exclusivo do Administrador**.
- **Exceção — Excluir vínculo (somente Administrador):** ação no **cadastro do preceptor** (card do vínculo, ao lado de "Editar vínculo"; não está no Controle Financeiro e não é visível ao Coordenador) que exclui **permanentemente** um vínculo criado incorretamente, junto com todos os dados dependentes dele: escalas e itens, presenças, cálculos e itens, revisões financeiras, composição fiscal (itens/eventos/solicitações — a solicitação compartilhada com outros vínculos é preservada e redesacoplada), pagamentos não concluídos/processos, movimentos de saldo, coordenadores, locais e regra do vínculo. **Não altera** os demais vínculos nem o cadastro do preceptor e **não é arquivamento**. Prévia com contagens reais + digitação de `EXCLUIR` para confirmar; RPC transacional `previa_excluir_vinculo`/`excluir_vinculo` (migração 053); pagamento concluído bloqueia. Sucesso: "Vínculo excluído permanentemente."
- **Exceção — Excluir preceptor permanentemente (somente Administrador):** ação no **cadastro do preceptor** (rodapé do formulário de edição, ao lado de "Cancelar"; não está no Controle Financeiro e não é visível ao Coordenador) que exclui **permanentemente** o preceptor criado incorretamente, todos os seus vínculos e todos os dados dependentes (escalas/itens, presenças/ajustes, cálculos/itens, revisões, composição fiscal, pagamentos não concluídos/processos, movimentos de saldo, coordenadores, locais, regras, documentos, favorecidos, acesso por token). **Não arquiva** (não vai para Arquivados), **não afeta outros preceptores** e **não exclui perfil/usuário** (gestão de usuários é fluxo separado). Prévia com contagens reais (vínculos, coordenadores, escalas, presenças, cálculos, revisões, solicitações/eventos, pagamentos, movimentos de saldo, arquivos e registros dependentes) + digitação de `EXCLUIR`; RPC transacional `previa_excluir_preceptor`/`excluir_preceptor` (migração 054); pagamento concluído bloqueia; qualquer falha gera rollback total. Sucesso: "Preceptor excluído permanentemente." — volta à lista de preceptores atualizada.

### Criação e Edição
- Ao criar préceptor + vínculo na mesma operação: se o vínculo falhar, o préceptor criado é inativado.
- Ao editar: pré-selecionar período e vínculo existentes; se período incompatível, mostrar aviso.
- Coordenador **não é requisito** para o Admin criar escala.

### Regras de Duplicidade de Vínculos
Um vínculo é considerado **duplicado** quando, para o **mesmo preceptor**, já existe um vínculo ativo com a **mesma combinação** de:
`preceptor_id`, `internato_id`, `periodo_id`, `semestre_id`, `local_id`, `setor_id`, `data_inicio`, `data_fim`.

**Permitido (não bloqueado):**
- Mesmo coordenador em vínculos diferentes
- Mesmo Internato e período, mas local ou setor diferente
- Mesmo contexto, mas vigência diferente
- Vínculos de preceptores diferentes

**Bloqueado:**
- Criar vínculo quando já existe, para o mesmo preceptor, vínculo ativo com todos os 8 campos idênticos
- Editar vínculo para ficar idêntico a outro vínculo ativo do mesmo preceptor

**Implementação:** Função `verificarDuplicidadeVinculo()` em `src/services/queries.js`.

### Badge de Situação (Listagem)
| Badge | Condição |
|-------|----------|
| "Inativo" | `preceptor.status !== 'ativo'` |
| "Nenhum vínculo cadastrado" | `vinculos_quantidade === 0` |
| "Ativo \| X de X vínculo(s) liberado" | Todos os vínculos liberados |
| "Ativo \| X de Y vínculos liberados" | Alguns vínculos liberados |
| "Ativo \| 0 de X vínculo(s) liberado" | Nenhum vínculo liberado |

**Status:** Implementada e testada manualmente.

---

## 5. Escalas

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `escalas` | Escalas de trabalho (dia da semana, turno, vigência) |
| `escalas_itens` | Itens da escala (datas específicas + **turno + setor próprio**) |

### Setor no item da escala (Etapa SETOR-NO-ITEM-DA-ESCALA)
- **O setor pertence ao ITEM da escala**: `escalas_itens.setor_id` (uuid, **opcional/nullable**) → FK `setores(id)`. Pode variar por **data, dia e turno** dentro da mesma escala/vínculo.
- **O setor do vínculo continua existindo** (`vinculo_locais.setor_id`, `vinculos_internato.setor_id`, `vinculos_adm.setor_id`) como **setor legado/opcional** — **não foi removido nesta etapa**. O **local** continua pertencendo ao vínculo.
- **Fallback de leitura:** item antigo sem setor próprio (`setor_id IS NULL`) usa **temporariamente o setor legado do vínculo** — em `fetchEscalasPorVinculo` (`src/services/queries.js`) cada item expõe `setor_nome = item.setor?.nome || setorLegadoVinculo`.
- **Gravação:** a RPC `salvar_escala_completa` aceita `setor_id` **opcional em cada item** de `p_itens`. Item sem `setor_id` grava `NULL` (**nenhum setor é copiado automaticamente**). Setor inexistente ou texto livre é **rejeitado** com mensagem amigável ("Setor nao encontrado no cadastro…" / "Setor invalido…") — **somente setores cadastrados** em `setores`.
- **Não cria vínculo por setor:** a regra de duplicidade de vínculos (seção 4) e a estrutura de vínculos permanecem inalteradas.
- **Setor não altera valor financeiro, não cria presença nem pagamento extra:** nenhum cálculo, regra, saldo ou RPC financeira foi tocado; o par `preceptor + data + turno` continua representando **uma única ocorrência financeira** (conflito de escala e UNIQUE `escalas_itens(escala_id, data, turno)` intactos).
- **Migração:** `062_setor_no_item_escala.sql` (coluna + FK + índice + comentário + RPC). RLS, triggers e permissões **preservadas**; coluna antiga **não removida**.
- **Formulário visual:** **não alterado** nesta etapa (próxima etapa).

### Regras
- **Um preceptor não pode possuir mais de uma escala ativa na mesma data e turno.** — conflito = mesmo preceptor + mesma data (`escalas_itens.data`) + mesmo turno (`escalas_itens.turno`) + mais de uma escala com `escalas.status = 'ativo'`, independentemente de vínculo, Internato, disciplina, unidade, local, setor ou Coordenador (aplica-se a Internato e Prática). Escala inativa/cancelada **não** bloqueia; item removido não existe (`escalas_itens` não tem status). Turnos diferentes na mesma data **não** são conflito. **Bloqueio IMPLEMENTADO na migração `061_bloqueio_conflito_escala.sql`**: RPCs `validar_conflito_escala`/`validar_conflito_escala_itens` (pré-validação da interface), triggers `trg_escalas_itens_conflito` (INSERT/UPDATE de item), `trg_escalas_conflito` (reativação via UPDATE de status) e `trg_presencas_conflito` (INSERT direto em `presencas`), além de validação dentro de `salvar_escala_completa`, `registrar_presenca_coordenador` e `registrar_presenca_token` (estes retornam `sucesso:false` com mensagem amigável, sem lançar exceção). Direto no banco (INSERT/UPDATE/reativação), a exceção contém a mesma mensagem amigável. Mensagens: título `Conflito de horário` (escala) / `Conflito de escala` (presença) + linhas de Internato ou disciplina / Local / Setor / Encerramento `Escolha outra data, outro turno ou outro preceptor.` — nunca com SQL, UUID, constraint ou stack trace (detalhamento em `MAPA_CONFLITOS_ESCALA.md`).
- Única escala por `vinculo_local + dia_semana + turno + data_inicio`.
- Validação de vigência no registro de presença.
- Verificação de pertencimento ao preceptor.

**Status:** Implementada e testada manualmente.

---

## 6. Presenças

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `presencas` | Registros de presença |
| `ajustes_presenca` | Ajustes e correções |

### Rotas de Registro
| Rota | Método | RPC | Status |
|------|--------|-----|--------|
| `/preceptor/presenca` | Coordenador/Admin | `registrar_presenca_coordenador` | **Ativo** — fluxo oficial |
| `/p/:token` | Token | `registrar_presenca_token` | **Legado técnico** — aguardando descontinuação |

### Regras
- Presença cancelada **não entra** no cálculo nem nos totais.
- Correção administrativa via RPC `corrigir_presenca_administrativa`.
- Impede duplicidade no mesmo vínculo + local + data + turno.
- Escala e presença são identificadas pela **atuação correta** (`tipo_atuacao` + `vinculo_*_id`).
- **Conflito de escala bloqueia o registro de presença** (migração 061): se o preceptor tem duas escalas ativas na mesma data/turno, `registrar_presenca_coordenador` retorna `sucesso:false` com título `Conflito de escala` + detalhes (Internato ou disciplina / Local / Setor) + encerramento `Não foi possível registrar a presença. Procure o Administrador para corrigir o vínculo incorreto.`; INSERT direto em `presencas` dispara `trg_presencas_conflito` com a mesma mensagem amigável. Presença sem conflito vinculado (sem escala) continua bloqueada pela regra de vigência/pertencimento existente.

### Escopo por Perfil (RLS)
- Policy `presencas_read`: Admin (`admin`/`coordenacao`) **ou** preceptor sobre a própria presença **ou** Coordenador (`coordenador`/`coordenacao`) restrito a `presencas.vinculo_internato_id = ANY(get_coordinator_vinculo_ids())` (com fallback para o vínculo da escala).
- Antes da migração `055` a policy só reconhecia as roles `admin`/`coordenacao`; como o perfil real do Coordenação é `coordenador`, a leitura retornava **0 linhas** e o calendário ficava **azul**.
- `escalas_itens_read` é permissivo, mas o embed `escalas!inner` aplica `escalas_read` (escopado por `get_coordinator_escala_ids()`) e o embed `vinculos_internato` aplica `vinculos_internato_read` (escopado por `get_coordinator_vinculo_ids()`).
- RPC `fetch_preceptores_com_escala_no_dia` (SECURITY DEFINER, modal "Registrar Presença") escopada na migração `056`: Admin inalterado; Coordenador vê apenas escalas dos seus vínculos.

### Calendário de Presenças (cores por dia)
| Cor | Condição |
|-----|----------|
| Cinza | Sem escalas no dia (`escalados === 0`) |
| Verde | `total_confirmados === total_previstos` e `> 0` |
| Azul | `total_confirmados === 0` (dia escalado, nenhuma confirmação) |
| Vermelho | Dia anterior a hoje com confirmação incompleta |
| Laranja | Demais casos (futuro/hoje parcial) |

- Comparação por par `escala_id|data` + turno: manhã+tarde escaladas e apenas manhã confirmada = **parcial** (laranja se futuro, vermelho se passado), nunca verde.
- Após registrar, `handleRegistrar` incrementa `refreshKey` → calendário, contadores (escalados/confirmados/pendentes), cor do dia e cartão do preceptor atualizam **sem F5**; o botão "Confirmar" fica desabilitado durante o envio (`enviando`), impedindo duplo clique.
- Tela "Presenças" (consolidada) já refaz a carga em `onSaved` via `loadPage()`.

### Presença por Token — Legado Técnico
> **Legado técnico ainda existente, aguardando descontinuação.** Não apresentar como fluxo oficial.

- Rota `/p/:token` com token SHA-256 (bruto nunca armazenado).
- Cada preceptor ativo possui no máximo um link ativo.
- RPCs públicas (anon): `validar_acesso_token`, `buscar_escalas_token`, `registrar_presenca_token`.
- Tabela `preceptor_acesso_presenca` armazena hash do token.

**Status:** Fluxo por coordenador ativo; presença por token é legado técnico.

---

## 7. Regras Financeiras

### Princípio
- **Motor financeiro configurável e sem valores fixos no código.**
- Todos os valores, fórmulas e regras são definidos dinamicamente via tabela `regras_financeiras` e suas tabelas auxiliares.

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `regras_financeiras` | Regras de pagamento (tipo, valor, vigência) |
| `regra_componentes` | Componentes da regra (setor, atividade, valor) |
| `regra_preceptores` | Vínculo regra ↔ preceptor |

### Formas de Cálculo
- Por turno confirmado
- Por hora
- Por grupo
- Mensal fixo
- Rateio
- Adicional
- Ajuste / Desconto / Estorno

### Validação
- RPC `checar_conflito_regra_financeira` verifica sobreposição de regras.

**Status:** Implementada e testada manualmente.

---

## 8. Controle Financeiro (Tela Operacional Unificada)

A tela **Controle Financeiro** (`/controle-financeiro`) é a tela operacional única do financeiro. Combina apuração, revisão, demonstrativos, notas fiscais e pagamentos em uma única interface, eliminando a necessidade de navegar entre telas diferentes.

### Tabelas Utilizadas
| Tabela | Descrição |
|--------|-----------|
| `competencias` | Competências financeiras (mês/ano) |
| `calculos` | Cálculos mensais por preceptor + vínculo |
| `calculo_itens` | Itens do cálculo (memória de cálculo) |
| `aprovacoes` | Revisão financeira (aprovação/reprovação) |
| `solicitacoes_nota_fiscal` | Solicitações de nota fiscal |
| `solicitacao_nota_fiscal_eventos` | Timeline auditável de transições |
| `pagamentos` | Registro de pagamento por (preceptor + competência) |
| `pagamento_itens` | Composição do pagamento (1 pagamento → N atuações) |
| `saldo_movimentos` | Baixa de saldo por atuação |

### Apuração Automática
Ao clicar em **"Recalcular Competência"**, o sistema refaz toda a apuração da competência selecionada considerando:
- Turnos confirmados nas presenças
- Regra financeira aplicada ao vínculo
- Memória de cálculo detalhada
- Valor final da atuação
- Valor final consolidado do preceptor
- **Não permite valores digitados manualmente** — cálculo exclusivamente automático baseado em presenças confirmadas e regras vigentes.

### Ações Financeiras Visíveis por Preceptor
Cada preceptor possui as seguintes ações diretamente na linha do agrupamento:
| Botão | Função | Quando aparece |
|-------|--------|----------------|
| **Visualizar** | Expande/recolhe as atuações do preceptor com detalhes (cálculo, presenças, memória) | Sempre |
| **PDF** | Gera demonstrativo financeiro consolidado (um único PDF por preceptor+competência) | Enquanto não estiver **Pago** |
| **E-mail** | Abre Outlook com **Para** (e-mail principal), **Cc** (adicionais ativos), assunto e corpo preenchidos (um único e-mail por preceptor+competência) | Enquanto não estiver **Pago** |
| **Marcar E-mail Enviado** | Registra usuário, data e hora; atualiza situação para `solicitada`; permite correção administrativa | Apenas com situação `preparada` (**E-mail preparado**) |
| **Marcar como pago** | Abre modal com competência, data do pagamento, valor solicitado, valor pago e observação opcional; **apenas registra** que o pagamento foi realizado (sem processamento bancário e **sem etapa de nota fiscal**); situação vira `pago`; Refazer vínculo e Refazer fluxo passam a ser bloqueados | Situação **Não pago** (`solicitada`; também `nota_recebida`/`em_pagamento` de registros anteriores) |
| **Histórico** | Abre a timeline auditável da solicitação fiscal (quando existe solicitação para a competência) | Sempre que existir solicitação |

> **Removido nesta etapa (FLUXO-EMAIL-PAGAMENTO):** o botão **Marcar NF Recebida**, a etiqueta **"Aguardando nota fiscal"** e a situação visível **"NF Recebida"** deixaram de existir no Controle Financeiro. Nenhuma estrutura de banco foi apagada: registros antigos em `nota_recebida`/`em_pagamento` continuam no histórico e na tabela, mas são exibidos como **Não pago**.

### Persistência e Exibição da Situação Fiscal
- **Fonte única:** a situação exibida e usada pelos botões vem exclusivamente de `solicitacoes_nota_fiscal` (chave: `preceptor_id` + `competencia` no formato `AAAA-MM`). Não há fallback que presume estado quando a consulta falha ou não encontra registro.
- **Transição `preparada → solicitada` (confirmação de envio) via RPC transacional:** a confirmação usa a RPC `confirmar_envio_solicitacao_nota(p_solicitacao_id)` (migração `057`), que resolve o responsável **no servidor** a partir de `auth.uid()` → `public.current_profile_id()` → `profiles.id` e grava `situacao='solicitada'`, `enviado_por`, `enviado_em` e o evento de histórico **na mesma transação** (falha = rollback total). O frontend **não** envia ID de usuário para esta transição. A chave estrangeira `solicitacoes_nota_fiscal_enviado_por_fkey → profiles(id)` foi preservada. Fallback: se a RPC não existir, o frontend grava direto com o perfil resolvido internamente e reverte a atualização se o evento de histórico falhar.
- **Demais transições sem RPC:** `solicitada → preparada` (correção), `solicitada → nota_recebida` e correção administrativa são gravadas direto em `solicitacoes_nota_fiscal` + insert auditável em `solicitacao_nota_fiscal_eventos` pelo frontend, com o **perfil** (`profiles.id`) do usuário autenticado. As RPCs `corrigir_confirmacao_envio_nota`, `registrar_recebimento_nota_fiscal` e `buscar_historico_solicitacao_nota` **não existem** neste projeto; chamá-las gera erro 404 (PGRST202) no Console.
- **Mensagens de erro:** falhas de banco (constraint, FK, SQL) nunca são exibidas ao usuário — `mensagemErroAmigavel()` (`src/services/queries.js`) converte em mensagem amigável, sem alterar a situação exibida e liberando nova tentativa.
- **Atualização imediata:** após cada ação a tela recarrega a situação fiscal na hora (sem `window.location.reload`), refletindo o novo estado nos botões e na etiqueta de situação.
- **Erro de carga:** se a consulta da situação fiscal falhar, a linha exibe mensagem amigável + botão **"Tentar novamente"**; nenhum estado é presumido enquanto houver erro.
- **Duplo clique:** ações bloqueadas durante o processamento (`solicitacaoNotaLoading`), com rótulo de espera nos botões dos modais.

**Botões por situação fiscal (regra estrita — fluxo simplificado):**
| Estado (`situacao`) | Botões/etiquetas exibidos |
|---------------------|---------------------------|
| `preparada` | **Marcar E-mail Enviado** (+ Visualizar, PDF, E-mail, Histórico) |
| `nao_solicitada` / sem registro | Somente **Visualizar**, **PDF** e **E-mail** (preparar é a primeira ação do fluxo) |
| `solicitada` | Etiqueta **"Não pago — enviado em \<data\>"** (+ **Corrigir** para Admin), **Marcar como pago**, **Histórico** |
| `nota_recebida` / `em_pagamento` (registros anteriores à simplificação) | Etiqueta **"Não pago"**, **Marcar como pago**, **Histórico** |
| `pago` | Etiqueta "Pago"; somente **Visualizar** e **Histórico** (PDF, E-mail e Marcar como pago ocultos; Refazer vínculo e Refazer fluxo bloqueados) |
| Falha na carga | Mensagem de erro + **Tentar novamente** |

### Situação Financeira (Etapas Claras)
A situação exibe sempre a etapa mais recente, derivada de `solicitacoes_nota_fiscal.situacao` (fonte única; ver "Persistência e Exibição da Situação Fiscal"):
| Etapa | Descrição | Classe CSS |
|-------|-----------|------------|
| **Aguardando Revisão** | Cálculo feito, aguardando revisão financeira | `aguardando-revisao` |
| **Cálculo conferido** | Todas as atuações do preceptor foram aprovadas na revisão | `revisado` |
| **E-mail preparado** | Demonstrativo preparado no Outlook, envio ainda não confirmado | `email-enviado` |
| **Não pago** | E-mail confirmado como enviado e pagamento ainda não registrado (inclui registros antigos `nota_recebida`/`em_pagamento`) | `nf-recebida` |
| **Pago** | Pagamento concluído com baixa de saldo | `pago` |
| **Necessita Recálculo** | Há presenças/escalas/regras alteradas após o último cálculo | `desatualizado` |
| **Pendências** | Vínculos com presenças aguardando apuração | `pendente` |

> Os rótulos **"NF Recebida"** e **"E-mail Enviado"** não são mais exibidos: a etapa entre o envio do e-mail e o pagamento é sempre **Não pago**.

### Exclusão Simplificada de Escala
Ação: **EXCLUIR ESCALA** (disponível na tabela expandida e cards mobile)
- Remove a escala selecionada
- Remove presenças vinculadas àquela escala na competência
- Remove cálculos gerados por aquelas presenças
- Recalcula automaticamente a competência
- **Preserva:** preceptor, vínculo, regras financeiras, histórico geral, cadastros
- Objetivo: corrigir apenas aquela escala específica sem destruir todo o fluxo financeiro

### Exclusão Simplificada de Atuação
Ação: **EXCLUIR ATUAÇÃO** (disponível na tabela expandida e cards mobile)
- Remove apenas a atuação selecionada da competência
- Remove presenças vinculadas a essa atuação
- Remove cálculos vinculados
- Recalcula automaticamente a competência
- **Preserva:** o restante do preceptor (outras atuações, vínculos, cadastro)

### Fluxo Operacional Completo
O Controle Financeiro permite fazer todo o ciclo sem sair da tela (fluxo pós-cálculo simplificado — **sem etapa de nota fiscal e sem pagamento em etapas**):
```
Recalcular Competência
        ↓
      Revisar          → situação "Cálculo conferido"
        ↓
     Gerar PDF
        ↓
   Preparar E-mail     → situação "E-mail preparado"
        ↓
Marcar E-mail Enviado  → situação "Não pago"
        ↓
  Marcar como pago     → situação "Pago"
```
Além disso: **Refazer vínculo** — ação única por linha (desktop e mobile) que abre prévia e, após confirmação, apaga escala, presenças, cálculos e etapas posteriores daquele vínculo (RPC transacional, somente Administrador), sem necessidade de voltar etapas, refazer fluxo inteiro ou reiniciar a competência.

Atualização automática: o Controle Financeiro recarrega as solicitações fiscais, os pagamentos e a fila imediatamente após cada ação concluída com sucesso — **Preparar e-mail, Marcar E-mail Enviado, Corrigir confirmação e Marcar como pago** — refletindo o novo estado na tela sem exigir recarregamento manual (F5).

### Pagamento em lote — seleção múltipla (Etapa PAGAMENTO-LOTE-TELA)
Disponível somente no **Controle Financeiro** e somente para **Administrador** (as RPCs de lote exigem papel administrador). Usa exclusivamente `previa_pagamento_lote` e `executar_pagamento_lote` (seção 14), sem nenhuma alteração de banco.

**Filtros rápidos** (barra logo abaixo de "Recalcular competência"): `Todos`, `Aguardando conferência` (badge "Aguardando Revisão"), `E-mail não enviado`, `Não pagos` (somente e-mail enviado e pagamento ainda não registrado), `Pagos` e `Com pendência` (badge "Pendências"/"Necessita Recálculo" ou atuação com observação pendente). O filtro rápido vale para a lista, os contadores (Preceptores, Turnos, Valor, Pendências), o "Encontrados" e a paginação; a aba Apuração Mensal não é afetada. Sem resultado no filtro, a tela informa qual filtro está ativo.

**Modo de seleção:** o botão **"Selecionar para pagamento"** ativa o modo — somente então os checkboxes aparecem (fora dele a tela continua idêntica à atual). Nesse modo a barra superior informa `N preceptores selecionados`, `Valor total selecionado: R$ X`, `N elegível(is) nesta lista` e `N nesta página`, e oferece **"Selecionar esta página"**, **"Selecionar todos os resultados filtrados (N)"** (todas as páginas, não apenas as 20 visíveis) e **"Limpar seleção"**. O botão **"Sair da seleção"** desativa o modo e limpa a seleção.

**Elegibilidade para seleção:** o checkbox só é ativável quando o preceptor **não está pago**, o **e-mail foi confirmado como enviado** (`solicitada`, `nota_recebida` ou `em_pagamento`), o **cálculo é válido** (status permitido, valor > 0, sem desatualização e sem pendência) e está na **mesma competência**. **Não selecionáveis** (checkbox desabilitado + selo "não elegível" com o motivo): já pagos, e-mail ainda não enviado, cálculo desatualizado ou com pendência. A elegibilidade é calculada sobre **todas** as atuações do preceptor da competência (mesmo com busca/filtros ativos), e a seleção é removida automaticamente quando um preceptor deixa de ser elegível (ex.: pagamento registrado por outra ação).

**Barra fixa inferior:** `N preceptores selecionados`, `Valor total selecionado: R$ X`, **Limpar seleção** e **Marcar selecionados como pagos**. Fica fixa no rodapé sem cobrir o conteúdo (a página reserva espaço inferior), usa a largura útil ao lado do menu lateral, não gera rolagem horizontal e tem botões com alvo mínimo de 44 px no mobile.

**Modal "Marcar selecionados como pagos":** exibe competência, preceptores selecionados, valor total selecionado e **quantidade bloqueada**; campos **Data do Pagamento** (obrigatória) e **Observação** (opcional); botões **Cancelar** e **Confirmar pagamentos**. A **prévia do banco é obrigatória**: roda ao abrir o modal (mostrando válidos/bloqueados e motivos) e **novamente imediatamente antes da confirmação**. Nada é executado se a seleção da tela divergir da prévia (conjunto de preceptores, competência ou valor com tolerância de R$ 0,01) ou se houver qualquer registro bloqueado — nesses casos o modal permanece aberto com o motivo e **nenhum pagamento é registrado**.

**Após o sucesso:** fila, solicitações fiscais, pagamentos e desatualização são recarregados (a tela atualiza **sem F5**), os pagos saem do filtro "Não pagos", a seleção é limpa (os **desmarcados permanecem desmarcados**), os indicadores são atualizados e o **histórico individual** de cada registro continua disponível no botão "Histórico". Duplicidade é impedida pela própria RPC (tudo-ou-nada com linhas travadas `FOR UPDATE`); a ação individual **"Marcar como pago"** continua intacta.

**Responsividade:** no desktop o checkbox aparece na linha compacta do preceptor; no mobile ele aparece no cartão do preceptor, a barra de seleção e a fixa empilham sem scroll horizontal e a lista de filtros rápidos desliza horizontalmente (padrão já usado em Escalas/Presenças).

**Status:** Implementada; `npm run build` OK e textos presentes no bundle; teste manual com navegador pendente (seção 18).

### Filtros Avançados
Chips de filtro disponíveis: Tipo de Atuação (Prática/Internato), Internato/Disciplina, Período, Local, Setor, Situação do Cálculo, Necessita Recálculo.

**Status:** Implementada e testada.

---

### RPCs
| RPC | Função |
|-----|--------|
| `previa_refazer_fluxo` | Prévia detalhada (mostra o que será apagado, sem apagar nada) |
| `refazer_fluxo_competencia` | Executa a limpeza transacional |
| `previa_refazer_vinculo` | Prévia do **Refazer vínculo** por vínculo (Prática/Internato), sem apagar nada |
| `refazer_vinculo` | Executa a limpeza transacional do vínculo inteiro (todas as competências) |

### Escopo da Limpeza
Permitir atuação selecionada ou processo do preceptor na competência. O que pode ser apagado:
- Escalas do período
- Presenças registradas
- Cálculos gerados
- Pagamentos registrados
- Solicitações de nota fiscal
- Eventos de solicitação
- Aprovações

**Refazer vínculo:** o escopo é o vínculo inteiro (todas as competências), nunca outros vínculos. Sem erro quando não há item de escala.

### O que SEMPRE é preservado
- Cadastro do preceptor
- Atuações vinculadas (vínculos)
- Unidade, internato, período, semestre, local, setor, vigência, coordenadores
- Saldo semestral e regra financeira
- Usuários e coordenadores
- Cadastros auxiliares
- Regras gerais de negócio
- Auditoria

### Bloqueios
- Pagamento no estado `pago` → **bloqueia** o refazer fluxo.
- Pagamento em `em_pagamento` → **bloqueia** o refazer fluxo.
- Cálculo `pago`, solicitação NF `pago`, processo de pagamento concluído ou baixa de saldo (consumo) → **bloqueia** o **Refazer vínculo**.

**Nota:** O Refazer Fluxo está acessível diretamente na tela **Controle Financeiro** (ícone de rotação na linha do preceptor). O **Refazer vínculo** substituiu os antigos botões "Excluir Escala" e "Excluir Atuação" na mesma tela. Sucesso: "Vínculo liberado para refazer a escala." e o vínculo volta a aparecer como **Sem escala**.

**Nota (unificação da correção):** no modal **Detalhes do cálculo**, o botão "Corrigir dados do vínculo" foi substituído por **"Refazer vínculo"** (ícone de reinício). O modal intermediário de correção (Corrigir escala / Corrigir presenças / Revisar regra financeira) foi **descontinuado**: a correção a partir do cálculo agora usa exatamente o fluxo existente de Refazer vínculo (mesma prévia e RPCs), reiniciando o vínculo **pela Escala** e redirecionando para a tela Escalas — sem abrir a escala antiga, a presença ou a regra. O **cadastro do preceptor e do vínculo são preservados**; escala, presenças, cálculos e etapas posteriores são removidos. As **exclusões permanentes** (Excluir vínculo / Excluir preceptor) continuam sendo **ações administrativas diferentes**, exclusivas do Administrador, não ligadas a este fluxo.

**Status:** Implementada e testada.

---

## 10. Pagamentos (Integrado ao Controle Financeiro)

As funcionalidades de pagamento agora estão integradas na tela **Controle Financeiro** (`/controle-financeiro`). Não existe mais tela separada de Pagamentos.

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `pagamentos` | Registro de pagamento por (preceptor + competência) |
| `pagamento_itens` | Composição do pagamento (1 pagamento → N atuações) |
| `saldo_movimentos` | Baixa de saldo por atuação |

### Máquina de Estados (Ações por Situação) — Visível no Controle Financeiro
| Situação | Ações permitidas (botões visíveis) |
|----------|-----------------|
| **Aguardando Revisão** | Visualizar, PDF, E-mail |
| **Cálculo conferido** | Visualizar, PDF, E-mail |
| **E-mail preparado** (`preparada`) | Visualizar, PDF, E-mail, Marcar E-mail Enviado, Histórico |
| **Não pago** (`solicitada`; também `nota_recebida`/`em_pagamento` de registros anteriores) | Visualizar, PDF, E-mail, Marcar como pago, Corrigir envio (Admin, somente em `solicitada`), Histórico |
| **Pago** | Visualizar, Histórico (somente consulta; PDF/E-mail ocultos; Refazer vínculo e Refazer fluxo bloqueados) |
| **Cancelado** | Histórico (somente consulta) |

> Não existem mais as situações visíveis **"Aguardando nota fiscal"**, **"NF Recebida"** e **"Em pagamento"**, nem os botões **Marcar NF Recebida**, **Iniciar pagamento** e **Concluir pagamento** (estes últimos pertenciam à antiga tela de Pagamentos, removida da navegação e do roteamento).

### RPCs
| RPC | Função |
|-----|--------|
| `iniciar_pagamento` | Cria pagamento `em_pagamento` (chamado internamente ao Marcar como pago) |
| `concluir_pagamento` | Conclui pagamento, baixa saldo (chamado internamente ao Marcar como pago) |
| `cancelar_pagamento` | Cancela pagamento com justificativa |
| `previa_pagamento_lote` | **Prévia (somente leitura)** de pagamento em lote na competência: válidos, bloqueios com motivo e valor total elegível (somente Admin) |
| `executar_pagamento_lote` | **Execução transacional** do lote: revalida todos, grava `pago` com data/valor/responsável por registro e retorna tudo-ou-nada (somente Admin) |

> **Pagamento em lote (Etapas PAGAMENTO-LOTE-BANCO + PAGAMENTO-LOTE-TELA, 29/09/2026):** as duas RPCs de lote são de **banco** e agora são acionadas pela interface do Controle Financeiro (seleção múltipla + modal com **prévia obrigatória** antes de confirmar — seção 8). O pagamento (transferência) continua sendo feito **fora do sistema**; o lote apenas **registra** o resultado, seguindo as mesmas regras do pagamento individual (seção 14). A RPC interna `fn_pagamento_lote_avaliar` (compartilhada pela prévia e pela execução) tem `EXECUTE` revogado de `public`, `anon` e `authenticated`.

> **Situação atual (24/09/2026):** as RPCs `iniciar_pagamento`, `concluir_pagamento` e `cancelar_pagamento` **não existem** no banco (verificado em `pg_proc`; existe apenas `preparar_ou_atualizar_solicitacao_nota`) e a tabela `pagamentos` não possui coluna `solicitacao_id`. O **Marcar como pago** tenta primeiro essas RPCs (qualquer erro técnico fica apenas no Console) e, quando indisponíveis, registra o pagamento diretamente em `solicitacoes_nota_fiscal.situacao = 'pago'` com evento auditável em `solicitacao_nota_fiscal_eventos` — sem criar RPC, migração ou novo estado.

> **Fluxo simplificado (29/09/2026):** como o **Marcar como pago** agora parte da situação `solicitada` (**Não pago**), o frontend registra automaticamente, antes de iniciar/concluir o pagamento, o estado intermediário `nota_recebida` usando o mecanismo já existente (`registrarRecebimentoNotaFiscal`, com o valor solicitado como referência e motivo automático) — apenas para atender às pré-condições já gravadas no banco (`solicitada → nota_recebida → pago`). **Nenhuma migração, RPC, trigger ou constraint foi criada ou alterada nesta etapa**; o modal de pagamento deixou de exibir o campo **"Valor da Nota"**.

**Status:** Implementada e testada (homologação simplificada: 28/28 aprovados).

---

## 11. PDF (Demonstrativo)

### Regra
Um **único PDF** por preceptor e competência, consolidando todas as atuações elegíveis automaticamente.

### Conteúdo do PDF
| Seção | Conteúdo |
|-------|----------|
| Cabeçalho | Nome do preceptor, competência, período. |
| Atuações | Cada atuação: disciplina, local, setor, período, turnos, valor. |
| Total | Valor total geral (soma de todas as atuações). |
| Identificação fiscal | Razão Social/CNPJ (PJ) ou Nome/CPF (PF) — exibida **uma vez**. |

### Regras de Elegibilidade (PDF e E-mail — fluxo simplificado)
- Cálculo do **preceptor correto** e da **competência selecionada**.
- Status **`calculado`** com **valor calculado**.
- **Atualizado** em relação às presenças (sem desatualização real).
- **Sem pendência real de recálculo** — se houver, informar "é necessário recalcular".
- **Não** exige revisão financeira antiga, expirada ou anterior à versão do cálculo (bloqueio removido). Revisão, quando existir, é apenas conferência visual.
- Composição é automática — todas as atuações elegíveis do preceptor+competência, sem seleção manual.

### Botões PDF / E-mail (disponibilidade prévia)
- Antes de exibir a ação como disponível, o Controle Financeiro aplica **a mesma regra de elegibilidade do clique**.
- Sem cálculo válido/atualizado → ação desabilitada (classe `is-disabled`), motivo no `title` e ao clicar.
- Com cálculo válido → ambas as ações habilitadas e reutilizáveis.

### Geração e Download
- Ao clicar em **PDF**, o download inicia automaticamente (`doc.save`), com nome `demonstrativo-<preceptor>-<ano>-<mes>.pdf`.
- **Repetível**: cada clique consulta os dados atuais, gera novo PDF e permite novo download; não marca como consumido nem altera cálculo/NF/pagamento.
- A competência é resolvida a partir do `competencia_id` retornado pela RPC `buscar_fila_financeira`; se ausente, o frontend resolve pelo(s) cálculo(s) da linha.

### Mensagens de Erro (específicas — sem mensagem genérica)
| Situação | Mensagem exibida |
|----------|------------------|
| Preceptor sem identificação na lista | `Preceptor não identificado na lista exibida. Atualize a página e tente novamente.` |
| Competência não resolvida | `Competência financeira não encontrada para <Mês/Ano>.` |
| Preceptor inexistente no banco | `Preceptor não encontrado (<id>).` |
| Competência inexistente no banco | `Competência não encontrada (<id>).` |
| Nenhuma atuação elegível | `Nenhuma atuação elegível (calculada e atualizada)...` + **motivo por atuação nomeada** (status do cálculo, cálculo desatualizado com data → "é necessário recalcular") |

> A mensagem genérica **"Informações do preceptor ou competência incompletas."** foi **removida** e não deve ser exibida novamente.
> A mensagem antiga de **"revisão financeira ausente/anterior"** **não é mais usada** como bloqueio de PDF/e-mail.

**Status:** Implementada e testada.

---

## 12. E-mail no Outlook

### Regra
Uma **solicitação** por preceptor e competência (índice único `preceptor_id + competencia`). Preparar e-mail é **repetível**: reutiliza a linha existente (atualiza conteúdo) **sem criar duplicata**.

### Abertura
- Ao clicar em **E-mail**, uma **nova aba do navegador** abre o **Outlook Web** via deep link
  (`https://outlook.office.com/mail/deeplink/compose`) com **Para (to)**, **Cc (cc)**, **Assunto**, **Corpo** e o parâmetro **`mailtouri`** (URI `mailto:` completo) pré-preenchidos.
- **Repetível**: cada clique reconsulta dados atuais (e-mail principal, adicionais ativos, identificação, atuações), remonta destinatário/assunto/corpo e reabre o Outlook; **não** marca como enviado automaticamente. Adicionar/remover cópias no cadastro reflete **na próxima preparação**, sem exigir novo cálculo.
- Se a solicitação já estiver `preparada`, a re-preparação **atualiza** a mesma linha.
- Se já estiver `solicitada`/`nota_recebida`/`pago`, a re-preparação **não rebaixa a situação** em silêntio — apenas atualiza conteúdo para consulta/nova preparação.
- A **confirmação de envio** continua sendo ação humana separada (**Marcar E-mail Enviado**).

### Destinatários — Para e Cc (Etapa EMAIL-OUTLOOK-COM-CC)
- **Fonte dos destinatários:** consulta ao **cadastro principal atual** no momento de cada preparação: `preceptores.email` (e-mail principal) + `fetchEmailsCopia(preceptorId)` (`preceptor_emails_copia`, ordem de `criado_em`). **Não** são usados e-mails copiados de cálculos, vínculos ou estados locais antigos; **não** há fallback para `profiles.email`.
- **Campo Para (`to`):** somente o e-mail principal. Sem e-mail principal ou com formato inválido → a preparação é **bloqueada antes de abrir o Outlook**, com mensagem amigável indicando qual cadastro corrigir.
- **Campo Cc (`cc`):** todos os **adicionais ativos**, na ordem cadastrada; **ignora** adicionais inativos e campos vazios; **remove duplicidades** (sem diferenciar maiúsculas/minusúsculas) e **não repete o endereço principal**. Sem cópias ativas → o parâmetro `cc` não é enviado.
- Os endereços de cópia **não aparecem** no corpo, no assunto e não são concatenados no campo Para.
- E-mail adicional inválido existente no cadastro também **bloqueia** a preparação, indicando o endereço e o cadastro a corrigir.
- Conteúdo financeiro, assinatura pessoal do Outlook Web, ausência de anexo automático e ausência de envio automático permanecem **inalterados**.

### Correção do Cc (Etapa CORRIGIR-CC-DO-OUTLOOK — 29/09/2026)
**Diagnóstico (sem alterar nada antes da causa):**
| Verificação | Resultado |
|-------------|-----------|
| Cópia persistida no banco? | **Sim** — `preceptor_emails_copia`, `preceptor_id = <redigido>` (nome do preceptor redigido), `<e-mail redigido>`, `ativo = true`, criado 29/09 14:19 |
| Função que prepara o Outlook | `handlePrepararEmailOutlook` (`src/App.jsx`) |
| Consulta os e-mails adicionais? | **Sim** — `fetchEmailsCopia(preceptorId)` a cada clique |
| Usa dados atuais ou estado antigo? | **Atuais** (consulta no banco a cada preparação; nada de cálculo/vínculo/solicitação antiga/estado local) |
| URL gerada | Parâmetro `cc` **presente e corretamente codificado** (`cc=<e-mail redigido>`) |
| Causa comprovada | O deep link do Outlook Web **ignora o parâmetro direto `cc`** (a integração atual só preenche `to`/`subject`/`body` por parâmetros diretos) — o Cc só é aceito dentro do parâmetro **`mailtouri`**, que recebe um URI `mailto:` completo (RFC 6068, suporte a `cc`) |

**Correção aplicada (montagem da URL):** a preparação agora envia **os dois formatos** na mesma URL (`montarUrlOutlook` em `src/services/queries.js`):
- parâmetros diretos `to`, `cc`, `subject`, `body` (garantem Para/Assunto/Corpo, como já funcionava);
- **`mailtouri`** = `mailto:<principal>?cc=<ativos>&subject=<…>&body=<…>` (garante o **Cc**; sem cópias ativas, o `cc` é omitido).

**Mantido:** destinatário principal, assunto, corpo financeiro, assinatura pessoal, anexo manual e envio manual. Nenhuma alteração em cálculos, valores, vínculos, PDF, estados fiscais ou pagamentos.

### Conteúdo do E-mail
| Campo | Descrição |
|-------|-----------|
| Para (`to`) | **Somente** o e-mail principal do cadastro (`preceptores.email`); bloqueado se ausente/inválido |
| Cc (`cc`) | **Todos** os e-mails adicionais **ativos** do cadastro (`preceptor_emails_copia`), na ordem cadastrada, sem duplicidades e sem repetir o principal |
| Assunto | `Solicitação de nota fiscal - Preceptoria - <Mês/Ano>` (ex.: `Solicitação de nota fiscal - Preceptoria - Set/2026`) |
| Corpo | Identificação fiscal (uma vez; ou por atuação quando os vínculos diferem), todas atuações, datas/turnos, valor por atuação, total geral e frase de fechamento **"Este e-mail formaliza a solicitação de emissão da Nota Fiscal referente aos serviços de preceptoria e aos valores apresentados acima."** (substituiu a antiga orientação "Responda a este e-mail anexando a sua Nota Fiscal…") |

### Identificação Fiscal
- **Fonte correta:** modalidade de pagamento, CNPJ e razão social são consultados **no vínculo incluído no cálculo** (cálculo → vínculo relacionado → modalidade do vínculo → CNPJ e razão social do vínculo). Nunca utilizar dados fiscais antigos gravados no cálculo. CPF e dados profissionais (profissão, conselho profissional, número e UF) pertencem **ao cadastro principal**.
- **Com CNPJ** (modalidade NFS e vínculo com CNPJ): Razão social, CNPJ formatado, profissão, conselho profissional, número do conselho e UF do conselho (quando cadastrada) — **havendo CNPJ, ele é a identificação fiscal principal e o CPF não aparece como identificação**.
- **Sem CNPJ:** Nome do preceptor, CPF formatado, profissão, conselho profissional, número do conselho e UF do conselho (quando cadastrada).
- Sem campos vazios, linhas com hífen, `undefined`, `null` ou nomes técnicos de colunas.
- Cada preparação reconsulta os dados **atuais** do vínculo.
- **Vários vínculos com o mesmo CNPJ e a mesma razão social:** identificação exibida **uma única vez** no início (título `DADOS PARA EMISSÃO DA NOTA FISCAL`), sem repetir CNPJ/razão social dentro de cada atuação e sem CPF.
- **Vários vínculos com identificações fiscais diferentes:** o e-mail continua único por preceptor e competência, mas **os dados não podem ser misturados** — não se apresenta um CNPJ como se representasse todos os vínculos; cada bloco de atuação exibe a própria identificação fiscal (linha `Dados fiscais desta atuação:`).
- **Mistura de vínculos com e sem CNPJ:** cada bloco usa a identificação fiscal correspondente; a diferença não é escondida e o CPF **não** é usado automaticamente como identificação geral de todos.
- **Saudação:** `Prezado(a) [nome do preceptor],` — usar o nome do preceptor na saudação não implica exibir o CPF nos dados fiscais.

### Período da Competência
- Exibido como primeiro dia real ao último dia real do mês, em data local, **sem conversão UTC** (ex.: Set/2026 → `01/09/2026 a 30/09/2026`).

### Mensagens de Erro (específicas — sem mensagem genérica)
| Situação | Mensagem exibida |
|----------|------------------|
| Preceptor sem identificação | `Preceptor não identificado na lista exibida...` |
| Competência não resolvida | `Competência financeira não encontrada para <Mês/Ano>.` |
| E-mail ausente no cadastro | Preparação bloqueada antes de abrir o Outlook (sem endereço no `to`) |
| E-mail principal ausente/inválido | `O cadastro do preceptor não possui e-mail principal. Informe o e-mail principal no cadastro para preparar o e-mail no Outlook.` / `O e-mail principal "<endereço>" do cadastro do preceptor é inválido. Corrija o cadastro do preceptor antes de preparar o e-mail no Outlook.` |
| E-mail para cópia inválido no cadastro | `O e-mail para cópia "<endereço>" do cadastro do preceptor é inválido. Corrija o cadastro do preceptor (e-mails para cópia) antes de preparar o e-mail no Outlook.` |
| Falha ao consultar os adicionais | `Não foi possível consultar os e-mails para cópia do cadastro do preceptor.` |
| PJ sem Razão Social/CNPJ | `Dados fiscais de Pessoa Jurídica incompletos (Razão Social e CNPJ obrigatórios).` |
| PF sem Nome/CPF | `Dados cadastrais de Pessoa Física incompletos (Nome e CPF obrigatórios).` |
| Nenhuma atuação elegível | Lista de motivos **por atuação nomeada** (idem PDF) |

> A mensagem genérica **"Informações do preceptor ou competência incompletas."** foi **removida**.

### Envio (Decisão Humana)
- O PDF **não é anexado automaticamente**.
- O e-mail é aberto no Outlook via deep link.
- A equipe financeira decide **manualmente** se anexará o PDF e enviará.
- **Não** marca como "Enviado" automaticamente.

**Status:** Implementada e testada.  
**Etapa EMAIL-OUTLOOK-COM-CC (29/09/2026):** Para = e-mail principal e Cc = adicionais ativos, ambos consultados do cadastro atual a cada preparação; duplicidades removidas; bloqueio amigável sem SQL; lógica de destinatários validada por teste automatizado e `npm run build` OK.  
**Etapa CORRIGIR-CC-DO-OUTLOOK (29/09/2026):** causa identificada (Outlook ignora o `cc` direto) e corrigida com `mailtouri`; teste automatizado **20/20** (`scratch/test_destinatarios_outlook.mjs`) e `npm run build` OK; itens 1–25 (interface, Console e Rede) pendentes de teste manual em sessão autenticada.  
**Etapa FLUXO-EMAIL-PAGAMENTO (29/09/2026):** frase de fechamento do corpo do e-mail trocada pela versão que formaliza a solicitação de emissão (nenhuma alteração em destinatários, assunto, identificação fiscal ou no parâmetro `mailtouri`); teste automatizado reexecutado **20/20** e `npm run build` OK.

---

## 13. Nota Fiscal

### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `solicitacoes_nota_fiscal` | Solicitação por (preceptor + competência) |
| `solicitacao_nota_fiscal_itens` | Composição (1 solicitação → N cálculos) |
| `solicitacao_nota_fiscal_eventos` | Timeline auditável de transições |

### Máquina de Estados
```
preparada → solicitada → nota_recebida → em_pagamento → pago
                                                  ↓
                                             cancelado
```
> **Somente `preparada`, `solicitada` e `pago` são estados expostos na interface** (etapa FLUXO-EMAIL-PAGAMENTO). `nota_recebida` e `em_pagamento` continuam existindo no banco, preservam os registros antigos e são avançados **automaticamente** no momento do **Marcar como pago** — **sem botão, etiqueta ou tela própria**.

### Transições
| Transição | Ação | Quem pode |
|-----------|------|-----------|
| `preparada` → `solicitada` | Confirmar envio (botão **Marcar E-mail Enviado**) | Qualquer usuário com permissão |
| `solicitada` → `preparada` | Corrigir confirmação | Administrador |
| `solicitada` → `nota_recebida` | **Interna** — executada automaticamente ao confirmar **Marcar como pago** (não há etapa de nota fiscal na interface) | Automático |
| `nota_recebida` / `em_pagamento` → `pago` | **Marcar como pago** | Qualquer usuário com permissão |

- `preparada` → `solicitada` é persistida pela RPC transacional `confirmar_envio_solicitacao_nota` (migração `057`), que valida o estado anterior e grava situação, data, responsável (`profiles.id` via `auth.uid()`) e evento na mesma transação.
- As demais transições acima são persistidas pelo frontend diretamente em `solicitacoes_nota_fiscal` (com evento auditável), com validação de estado anterior no cliente e responsável resolvido como `profiles.id`. Não existem RPCs com esses nomes no projeto — chamá-las resulta em 404 (PGRST202).

### Composição da Solicitação
Preserva obrigatoriamente:
1. Cálculos incluídos (`calculo_ids`)
2. Atuações incluídas (descrição, período, local, setor, turnos)
3. Subtotal de cada atuação
4. Valor total geral
5. Competência financeira
6. Preceptor
7. Identificação fiscal utilizada

**Status:** Implementada e testada. A etapa de recebimento da NF deixou de existir na interface (ver seção 14); a máquina de estados no banco permanece intacta.

---

## 14. Pagamento (Processo)

### Fluxo (ação única — sem etapas separadas)
1. **Marcar como pago:** abre modal com competência, data do pagamento, valor solicitado, valor pago e observação opcional. Em uma única ação o sistema: (a) registra **internamente** a transição `solicitada → nota_recebida` quando a solicitação ainda está em `solicitada` (sem botão, etiqueta ou tela de nota fiscal); (b) tenta `iniciar_pagamento` + `concluir_pagamento` e, quando indisponíveis, grava o pagamento diretamente em `solicitacoes_nota_fiscal.situacao = 'pago'` com evento auditável.
2. A situação da linha passa a **Pago** e a tela atualiza sem F5.
3. **Cancelar pagamento:** continua existindo no processo/banco (justificativa obrigatória), sem botão no Controle Financeiro.

### O que foi removido da interface (Etapa FLUXO-EMAIL-PAGAMENTO)
- Botão **Marcar NF Recebida** e etiquetas **"Aguardando nota fiscal"** / **"NF Recebida"**.
- Etapas separadas **"Iniciar pagamento"**, **"Em pagamento"** e **"Concluir pagamento"** (pertenciam à antiga tela de Pagamentos, fora da navegação e do roteamento).
- Campo **"Valor da Nota"** no modal de pagamento.

### Bloqueios
- Pagamento duplicado → bloqueado.
- Nenhuma tela de divergência de valor: o registro interno usa o valor solicitado como referência.
- Situação **pago** → **Refazer vínculo** e **Refazer fluxo** bloqueados.

### Pagamento em lote (RPCs de banco — Etapa PAGAMENTO-LOTE-BANCO)
Duas RPCs permitem registrar o pagamento de **vários preceptores na mesma competência** de uma vez. A interface que as aciona foi entregue na etapa **PAGAMENTO-LOTE-TELA** (seção 8: filtros rápidos, seleção múltipla, barra fixa e modal com prévia obrigatória). O pagamento/transferência em si ocorre em outro sistema; aqui só se registra:

1. `previa_pagamento_lote(p_competencia_id, p_preceptor_ids)` — somente leitura. Retorna `resumo` (`qtd_selecionada`, `qtd_valida`, `qtd_bloqueada`, `valor_total_valido`, `pode_executar`), `validos` e `bloqueios` (cada bloqueio com `codigo` e `motivo`).
2. `executar_pagamento_lote(p_competencia_id, p_preceptor_ids, p_data_pagamento, p_observacao)` — transacional, **tudo ou nada**. Revalida **todos** os selecionados **antes** de qualquer escrita; havendo um único bloqueado, lança exceção e **nenhum** pagamento é registrado.

**Elegibilidade (todos obrigatórios):** mesmo `competencia_id`; cálculo do preceptor+competência com status `calculado`/`aprovado`/`fechado`, valor > 0 e composição da solicitação idêntica aos cálculos atuais (mesmos `calculo_id` e mesma soma); cálculo **não desatualizado** (mesma regra de `verificar_desatualizacao_competencia`); e-mail confirmado como enviado (`solicitada`/`nota_recebida`/`em_pagamento`); ainda não `pago`.

**Códigos de bloqueio:** `ja_pago`, `email_nao_enviado`, `calculo_desatualizado`, `competencia_diferente` (registros só em outra competência), `registro_invalido` (preceptor/cálculo/solicitação inexistente, cancelado, status não permitido ou composição divergente).

**Garantias da execução:** somente Administrador; linhas travadas com `FOR UPDATE` (impede corrida e duplicidade); transição interna `solicitada → nota_recebida` (mesma máquina de estados do pagamento individual) seguida de `pago`; evento auditável **por registro** em `solicitacao_nota_fiscal_eventos` com `data_pagamento`, `valor_pago`, atuações, observação e `realizado_por` (`profiles.id` resolvido de `auth.uid()`); baixa por atuação em `saldo_movimentos` **apenas quando existir** `saldos_autorizados` compatível (hoje: nenhum → `saldo_movimentos_registrados = 0`), **sem alterar o saldo geral** do preceptor; qualquer falha em qualquer ponto → `RAISE EXCEPTION` → rollback total; **sem `DELETE`** e sem transferência bancária; `calculos.status`, valores, escalas e presenças **nunca** são alterados.

**Status:** Implementada (build OK e textos removidos conferidos no bundle); teste manual com dados reais pendente.

---

## 15. Dashboard

### Fontes de dados (tela)
| Fonte | Uso |
|-------|-----|
| RPC `buscar_fila_financeira` (via `fetchPainelPagamentos`) | Linhas da fila financeira (totais, turnos, internato, preceptor, vínculos) |
| `solicitacoes_nota_fiscal` (via `fetchSolicitacoesNotaFiscal`) | Situação fiscal por preceptor/competência (enriquecimento de `situacao_nota`) |
| `solicitacao_nota_fiscal_eventos` (via `fetchDatasPagamentos`) | Data do pagamento por solicitação |
| `buscar_revisoes_competencia` (via `fetchRevisoesCompetencia`) | Revisões aprovadas por cálculo (pendência de revisão) |

### RPC (legado)
| RPC | Função |
|-----|--------|
| `dashboard_preceptoria_internato` | Painel com resumo, por internato, por unidade, por local, por preceptor (não utilizada pela tela atual) |

### Filtros
`SearchFilterBar` no topo do Dashboard: campo de **busca textual**, botão **"Filtros"** (painel `FilterPanel` recolhido — desktop inline, ≤768 px bottom-sheet) e botão **"Exportar relatório"**. Campos do painel: competência, unidade, internato, local, situação, mês e ano; a mudança de mês/ano limpa a competência e vice-versa; chips removíveis (incluindo o chip da busca) + "Limpar todos".

**Busca textual completa** (`buscaFinanceira`): nome e nome social, razão social, profissão, tipo/número de conselho, e-mail, internato/disciplina, unidade, local, setor, período e modalidade; além disso compara apenas dígitos (≥3) de CPF, CNPJ do preceptor, CNPJ do vínculo e número do conselho. CPF/CNPJ servem **somente** para localizar o registro — nunca aparecem na lista nem nos arquivos exportados.

### Exportação (modal "Exportar relatório")
- Formato: **Excel (.xlsx)** (gerador próprio, sem dependência `xlsx`) ou **PDF** (jsPDF + `autoTable`; gráficos desenhados em vetor nativamente, sem `html2canvas`).
- Conteúdo selecionável: Indicadores, Gráficos, Lista de preceptores, Composição das atuações e Pendências.
- Usa **exatamente** a busca textual e os filtros aplicados, cobrindo todos os registros da seleção (não apenas a página visível). Excel: abas Resumo / Preceptores / Atuações / Pendências. PDF paisagem: cabeçalho, competência, filtros aplicados, indicadores, gráficos, lista, composição, pendências, totais, data e paginação.
- **Colunas de saldo nas exportações (etapa DASHBOARD-GRAFICO-SALDO-EXPORTACAO):** aba **Preceptores** ganhou *Saldo inicial, Valor utilizado, Valor pago (semestre), Saldo disponível e Percentual utilizado (%)*; aba **Atuações** ganhou as mesmas colunas calculadas **por vínculo** da linha; aba **Resumo** ganhou o ranking "Utilização do saldo semestral" (preceptor, vínculo e as 5 colunas) + contagens de acima de 80%, esgotados e sem saldo informado (com os nomes dos preceptores). PDF: seção **"Vínculos com maior utilização do saldo"** (tabela de ranking + linha de contagens) e as mesmas 5 colunas na **lista de preceptores** e na **composição das atuações**. Valores idênticos aos da lista (mesma fonte `vinculos_internato.valor_inicial` + fila); sem saldo → "Saldo não informado" (percentual "—"); **nunca** CPF/CNPJ nos arquivos.

### Indicadores oficiais (abrem na competência do mês vigente; respeitam todos os filtros)
**4 cartões principais:** Valor total calculado (Σ `total_bruto` das linhas da seleção, sem duplicar atuação), Valor total pago (Σ dos grupos com situação `pago` — só pagamento concluído), Valor pendente (calculado − pago, nunca negativo), Saldo disponível (`valor_inicial` deduplicado por vínculo − pago).

**Linha compacta:** Preceptores, Atuações, Turnos confirmados, Pendências (apenas pendências financeiras reais: regra pendente, cálculo desatualizado, atuação não revisada, identificação fiscal ausente quando bloqueia, falha de processo — **nunca** registro `pago`, ausência de data de pagamento, campo opcional vazio nem ausência de movimentação pós-pagamento).

**Faixa de situações (qtd. de preceptores):** E-mail não enviado (Aguardando revisão + Aguardando envio), Não pagos, Pagos, Com pendência real. Sem novos estados.

> **Etapa VALIDAR-PAGAMENTO-SIMPLIFICADO (30/09/2026) — referências antigas removidas do Dashboard:** a tela não exibe mais **"Aguardando nota fiscal"**, **"Nota fiscal recebida"**, **"Valor da nota"** (coluna da lista/exportação) nem **divergência de nota** (motivo de pendência). Os **nomes internos** de bucket (`aguardando_nf`, `nota_recebida`) e a coluna `situacao_nota` permanecem porque são estados reais do banco — somente os **rótulos visíveis** mudaram. O modal **Histórico** do Controle Financeiro continua descrevendo os eventos já ocorridos ("Nota fiscal recebida"), pois é registro auditável, não situação atual. Grade dos chips de situação ajustada de 6 para **4 colunas** (e 2 colunas em ≤1050 px).

**Duplicidades removidas:** cartões antigos "Valor calculado", "Pago por deferimento", "Aguardando solicitação", "Notas fiscais recebidas", "Saldo semestral" e a grade de 11 indicadores (valores repetidos com nomes diferentes); fonte única agora é o bloco acima.

**Data do pagamento:** fonte = `solicitacao_nota_fiscal_eventos` (evento `situacao_nova='pago'`), priorizando `detalhes.data_pagamento` (data real informada) e usando `ocorrido_em` como fallback. Pago sem evento/data → exibe "Data de pagamento não registrada" (nunca data inventada, nunca "Sem movimentação"). Apenas apresentação: **não** conta em Pendências/"Com pendência".

### Gráficos gerenciais (grade `dash-graficos`, mesma base de dados/filtros dos indicadores)
1. **Pago x não pago** (rosca) — `ind.pago`/`ind.pendente`/`ind.total`; centro = total calculado; clique na fatia Pago aplica filtro de situação; sem dados → estado vazio.
2. **Evolução mensal — calculado x pago** (colunas agrupadas SVG) — linhas da fila sem filtros de tempo; janela: últimos 6 meses até a competência/mês de referência, ou ano inteiro se filtrar por ano; nunca mistura meses de anos diferentes (rótulo mês/ano).
3. **Valor pago por Internato** (barras, top 10) — soma de `total_bruto` de linhas pagas; clique aplica/remove filtro de Internato.
4. **Pagamentos por modalidade** (linha compacta por modalidade) — `calculos.modalidade` via `modalidade_pagamento` (enriquecimento aditivo em `fetchPainelPagamentos`); cada linha mostra modalidade, quantidade de preceptores, valor pago, "% do total pago" e barra fina; só modalidades cadastradas; hoje nenhuma existe → vazio compacto "Nenhum pagamento com modalidade identificada para os filtros selecionados." (sem altura reservada). Meia coluna, logo após a rosca.
5. **Situação dos processos** (barras) — contagem de preceptores por situação (mesmos grupos dos indicadores: E-mail não enviado, Não pagos, Pagos, Com pendência real); clique aplica filtro de situação (Com pendência real não tem filtro equivalente — não clicável).
6. **Utilização do saldo semestral** (ranking de vínculos com **barras clicáveis**) — legenda de totais (saldo autorizado / utilizado / disponível) + até **10 vínculos de maior percentual utilizado**, mantendo à parte todos os que estão **acima de 80%** e os com **saldo esgotado**. Cada barra mostra preceptor, identificação do vínculo (internato ou disciplina • período • unidade • local • setor), saldo inicial, valor utilizado, saldo disponível (selo "Excedente" quando negativo), percentual e barra de progresso (verde/amarelo/vermelho). Vínculos **sem saldo informado não entram** no ranking — aparecem como contagem separada "**X vínculos sem saldo informado**" (junto de "N vínculo(s) acima de 80%" e "N vínculo(s) com saldo esgotado"). **Clique na barra:** aplica o preceptor na busca da lista e expande o registro correspondente — sem navegar para outra tela e sem alterar dados (a rolagem até a lista é a única mudança de visualização). Fonte: `montarRankingSaldoVinculos` (agregação por vínculo, deduplicada; nunca `preceptores.valor_inicial`).

**Ordem da grade:** rosca | modalidade → evolução (largura total) → internato | situação → saldo (largura total). O gráfico "Valor pago por local" foi **removido** nesta etapa, mas o **filtro global de Local** e seu chip removível continuam disponíveis (chips agora no `SearchFilterBar`, junto com os demais).

**Filtros compartilhados:** competência, mês, ano, unidade, Internato, local, situação e busca (os já existentes — nenhum filtro duplicado dentro dos gráficos). Clique em gráfico aplica o filtro e exibe **chip removível**; todos os gráficos, indicadores e a lista de acompanhamento reagem pelo mesmo estado (sem F5). Totais: calculado = pago + pendente por construção.

**Estados vazios:** "Nenhum dado encontrado para os filtros selecionados." — sem NaN/undefined/uuid; tooltips formatados em reais e percentual. Cores: azul institucional, dourado, verde (pago), amarelo/laranja (pendente), vermelho só para divergência/erro. Responsividade: 2 colunas (desktop/tablet), 1 coluna ≤760 px, áreas de clique ≥44 px, sem rolagem horizontal.

**Aguardando teste manual (Edgar):** cliques nos gráficos + chips, tooltips ao tocar, 390/768/1366/1920 px, Console e cenário com dados de outra competência (hoje existe apenas 2026-09 com 1 linha na fila).

### Lista única — Acompanhamento dos preceptores (substitui as 4 listas anteriores)
- **Um registro por preceptor + competência** (mesmos grupos dos indicadores). Colunas desktop: Preceptor, Competência, Atuações, Turnos, Valor calculado, Valor pago, Situação, Última movimentação e Ação.
- **Saldo semestral por preceptor (linha logo abaixo do nome, sempre visível):** vínculos, turnos, saldo inicial, valor utilizado, valor pago, saldo disponível, percentual utilizado e **situação financeira** (Normal < 70%, Atenção 70–89,9%, Crítico ≥ 90%, Saldo esgotado = disponível 0, Saldo excedido = disponível negativo com selo "Excedente", Saldo não informado). Desktop: linha `<tr colspan>` na tabela; mobile: bloco logo abaixo do topo do cartão.
- **Fórmulas e fonte:** saldo inicial = `vinculos_internato.valor_inicial` (chegue como `saldo_semestral`; `null` → "Saldo não informado"; **nunca** `preceptores.valor_inicial`); valor utilizado = Σ `total_bruto` dos cálculos **válidos** (`status ∈ calculado/aprovado/fechado/pago`) e **atualizados** (`observacoes` vazio ou `Calculado`) do vínculo no semestre; valor pago = Σ `total_bruto` com `situacao_nota='pago'`; disponível = saldo inicial − utilizado; percentual = utilizado ÷ saldo inicial × 100. Somas arredondadas em 2 casas.
- **Expansão por vínculo (`+`):** um bloco por vínculo distinto da linha (internato ou admin), contendo as 8 colunas já existentes (internato/disciplina, período, unidade, local, setor, turnos, valor e situação) **agregadas daquele vínculo** + faixa de saldo com saldo inicial, valor utilizado, valor pago, saldo disponível, percentual e barra de progresso (verde/amarelo/vermelho/cinza). **A expansão nunca mistura saldos entre vínculos**; os totais do cabeçalho são a soma dos vínculos do grupo.
- **Filtros rápidos de saldo** (grupo próprio, abaixo dos filtros de situação; um ativo por vez e acumulável com a situação selecionada): "Saldo acima de 80% utilizado", "Saldo esgotado" e "Saldo não informado" — atuam **somente** sobre a lista (não alteram indicadores nem gráficos) e têm estado vazio próprio.
- **Filtros rápidos** (um ativo por vez): Todos, Pendentes, Aguardando revisão, Aguardando envio, E-mail não enviado, Não pagos, Pagos, Com pendência real. **Padrão: Pago.** Com competência vigente selecionada, o subtítulo exibe "Preceptores pagos no mês vigente".
- **Busca textual:** já cobre nome, nome social, razão social, conselho, e-mail, Internato, local, setor, período e modalidade + dígitos de CPF/CNPJ — **sem alteração** (CPF/CNPJ só localizam; nunca aparecem na lista).
- **Última movimentação:** pago → data real do pagamento (`solicitacao_nota_fiscal_eventos`, `detalhes.data_pagamento` → `ocorrido_em`) ou "Data de pagamento não registrada"; não pago → `enviado_em` → `updated_at` → `created_at` ou "Sem movimentação". Nunca exibe "Invalid Date", undefined, null, NaN ou UUID.
- **Ação:** botão "Abrir no Controle financeiro" navega já filtrado (busca por nome + competência). O nome do preceptor não é link.
- **Paginação:** 20 por padrão (opções 20/50/100), total de registros, "Página X de Y", primeira/anterior/próxima/última; volta à página 1 ao mudar filtros, filtro rápido, filtro de saldo ou tamanho da página.
- **Estados vazios:** filtro Pago → "Nenhum preceptor pago na competência selecionada."; filtros de saldo → mensagem própria ("Nenhum preceptor acima de 80%...", "Nenhum preceptor com saldo esgotado...", "Nenhum preceptor sem saldo informado..."); demais → mensagem própria por filtro.
- **Mobile (≤760 px):** cartões compactos (sem tabela), alvos de toque ≥44 px, mesma expansão e botão de ação de largura total.
- Somente consulta — sem ações de pagamento/PDF/e-mail por linha. A exportação é **global**, pelo botão "Exportar relatório" no topo do Dashboard (respeita busca e filtros e cobre todos os registros filtrados); desde a etapa DASHBOARD-GRAFICO-SALDO-EXPORTACAO ela **inclui as mesmas colunas de saldo** da lista nas abas/tabelas de Preceptores e de Composição.

**Status:** Saldo por preceptor/vínculo entregue na etapa DASHBOARD-SALDO-POR-PRECEPTOR (01/10/2026): funções puras testadas (`scratch/test_saldo_preceptor.mjs`, 102 asserções OK) e `npm run build` OK com rótulos novos conferidos no bundle (seção 18). Gráfico "Utilização do saldo semestral" refeito como ranking clicável e saldo incluído nas exportações na etapa DASHBOARD-GRAFICO-SALDO-EXPORTACAO (01/10/2026; `scratch/test_grafico_saldo_exportacao.mjs`, 69 asserções OK + 102 da etapa anterior). Referências antigas de nota fiscal removidas na etapa VALIDAR-PAGAMENTO-SIMPLIFICADO (30/09/2026). Cliques nos gráficos/chips, tooltip/clique no novo ranking, responsividade e Console seguem aguardando teste manual (Edgar; sem credenciais e sem dados financeiros no ambiente).

---

## 16. Arquivamento e Histórico

### Regra Fundamental
- **Nenhum cadastro deve ser excluído definitivamente.**
- Preceptor deve ser **desativado** (`status='inativo'`) ou **arquivado**.
- Inativar um preceptor NÃO apaga o histórico. A RLS garante que dados anteriores permanecem consultáveis.
- Operações de inativação preservam todos os registros vinculados (vínculos, presenças, cálculos).

### Auditoria
| Tabela | Descrição |
|--------|-----------|
| `audit_logs` | Log completo de operações (tabela, registro_id, operação, dados anteriores/novos) |

### Trigger de Auditoria
- Automática em 17+ tabelas via `audit_row_change()`.

### Preservação
- Registros mantêm histórico de alterações.
- Memória de cálculo preservada.
- Operações críticas com `realizado_por`, `ocorrido_em`, `detalhes`.

**Status:** Implementada.

---

## 17. Banco, RPCs e Componentes Ativos

### Tabelas (35 referenciadas no código)
`preceptores`, `preceptor_emails_copia`, `vinculos_adm`, `vinculos_internato`, `vinculo_locais`, `vinculo_coordenadores`, `vinculo_regras_financeiras`, `profiles`, `user_roles`, `escalas`, `escalas_itens`, `presencas`, `ajustes_presenca`, `disciplinas`, `internatos`, `internato_disciplinas`, `periodos`, `semestres`, `locais`, `setores`, `unidades`, `profissoes`, `modalidades_pagamento`, `cursos`, `regras_financeiras`, `regra_componentes`, `calculos`, `calculo_itens`, `competencias`, `aprovacoes`, `solicitacoes_nota_fiscal`, `solicitacao_nota_fiscal_eventos`, `pagamentos`, `configuracoes`, `audit_logs`

### RPCs (40 únicas — todas chamadas pelo frontend; as 2 de pagamento em lote também são acionadas pelo Controle Financeiro; as 2 de conflito de escala são usadas como pré-validação de `salvar_escala_completa`)
| RPC | Uso |
|-----|-----|
| `registrar_presenca_token` | Registro mobile de presença |
| `validar_acesso_token` | Validação de token |
| `buscar_escalas_token` | Busca de escalas por token |
| `registrar_presenca_coordenador` | Registro por coordenador |
| `salvar_escala_completa` | Salvar escalas — aceita `setor_id` **opcional por item** em `p_itens` (setor do item da escala; sem setor → `NULL` = legado; valida setor cadastrado; etapa SETOR-NO-ITEM-DA-ESCALA, migração 062) |
| `fetch_preceptores_com_escala_no_dia` | Preceptores com escala no dia |
| `fetch_presencas_consolidadas` | Presenças consolidadas |
| `listar_usuarios_staff` | Listar usuários |
| `atualizar_usuario_staff` | Atualizar usuário |
| `bloquear_usuario` | Bloquear/desbloquear |
| `inativar_reativar_usuario` | Ativar/inativar |
| `redefinir_acesso_usuario` | Redefinir acesso |
| `atualizar_dados_usuario` | Atualizar dados |
| `marcar_primeiro_acesso_concluido` | Marcar primeiro acesso |
| `checar_conflito_regra_financeira` | Verificar conflito de regras |
| `auto_apurar_competencia_financeira` | Auto-apuração |
| `buscar_fila_financeira` | Fila financeira — retorna também `competencia_id`, `vinculo_adm_id`, `vinculo_internato_id`, `setor_nome`, `periodo_nome` (migrações 050/051) |
| `verificar_desatualizacao_competencia` | Verificar desatualização |
| `corrigir_presenca_administrativa` | Correção administrativa |
| `registrar_solicitacao_nota_fiscal` | Registrar solicitação NF |
| `preparar_ou_atualizar_solicitacao_nota` | Preparar solicitação unificada |
| `confirmar_envio_solicitacao_nota` | Confirmar envio — transacional, resolve `profiles.id` a partir de `auth.uid()` (migração 057) |
| `corrigir_confirmacao_envio_nota` | Corrigir confirmação |
| `registrar_recebimento_nota_fiscal` | Registrar recebimento NF |
| `buscar_historico_solicitacao_nota` | Histórico de solicitação |
| `previa_refazer_fluxo` | Prévia de refazer fluxo |
| `refazer_fluxo_competencia` | Executar refazer fluxo |
| `previa_refazer_vinculo` | Prévia de refazer vínculo (por vínculo) |
| `refazer_vinculo` | Executar refazer vínculo (limpeza transacional, migração 052) |
| `previa_excluir_vinculo` | Prévia de exclusão permanente do vínculo (contagens reais, sem alterar nada) |
| `excluir_vinculo` | Excluir vínculo permanentemente com todos os dependentes (transacional, somente Admin, migração 053) |
| `previa_excluir_preceptor` | Prévia de exclusão permanente do preceptor (contagens reais de vínculos e dependentes, sem alterar nada) |
| `excluir_preceptor` | Excluir preceptor permanentemente com todos os vínculos e dependentes (transacional, somente Admin, migração 054) |
| `iniciar_pagamento` | Iniciar pagamento |
| `concluir_pagamento` | Concluir pagamento |
| `cancelar_pagamento` | Cancelar pagamento |
| `previa_pagamento_lote` | Prévia de pagamento em lote (somente leitura, somente Admin; etapa PAGAMENTO-LOTE-BANCO) |
| `executar_pagamento_lote` | Executar pagamento em lote (transacional, tudo ou nada, somente Admin; etapa PAGAMENTO-LOTE-BANCO) |
| `validar_conflito_escala` | Pré-validação de conflito preceptor+data+turno (uma data/turno; retorna `conflito` + `mensagem` amigável; etapa BLOQUEAR-CONFLITO-DE-ESCALA, migração 061) |
| `validar_conflito_escala_itens` | Pré-validação de conflito para múltiplos itens da escala (retorna `conflitos`, `turnos_conflitantes` e `mensagem`; etapa BLOQUEAR-CONFLITO-DE-ESCALA, migração 061) |

### Edge Functions (3)
| Função | Uso |
|--------|-----|
| `admin-create-user` | Criar usuário via GoTrue Admin API |
| `admin-reset-access` | Redefinir acesso |
| `admin-delete-user` | Excluir usuário |

### Componentes React
| Componente | Arquivo | Função |
|------------|---------|--------|
| `App` | App.jsx | Shell principal (default) |
| `LoginScreen` | App.jsx | Formulário de login |
| `DashboardPage` | App.jsx | Dashboard |
| `Form` | App.jsx | Formulário genérico CRUD |
| `UserForm` | App.jsx | Formulário de usuário |
| `VinculoForm` | App.jsx | Formulário de vínculo |
| `CadastrosAuxiliares` | App.jsx | Cadastros auxiliares |
| `RegistrarPresencasPage` | App.jsx | Registro de presenças |
| `SearchFilterBar` | App.jsx | Barra de busca e filtros |
| `Logo` | Logo.jsx | Logo da marca |
| `RecuperarSenha` | RecuperarSenha.jsx | Recuperação de senha |
| `RedefinirSenha` | RedefinirSenha.jsx | Redefinição de senha |
| `RegistroPresencaToken` | RegistroPresencaToken.jsx | Rota mobile /p/:token |

### Migrações (aplicadas)
`001` a `056` (com gaps e variantes `a`, `b`) + `solicitacao_nota_fiscal_unificada_aplicada` (índice único + RPC de preparação sem rebaixar situação) + `050`/`051` (fila) + `052` (refazer vínculo) + `053` (excluir vínculo permanentemente) + `054` (excluir preceptor permanentemente) + `055` (escopo de leitura de `presencas` para Coordenador) + `056` (escopo da RPC `fetch_preceptores_com_escala_no_dia`) + `057` (confirmação de envio de NF) + `058` (tabela/triggers/RLS/auditoria dos **e-mails para cópia**) + `059` (revoga `EXECUTE` das funções de trigger dos e-mails cópia para `anon`/`authenticated`) + `060_pagamento_lote_banco` (RPCs `previa_pagamento_lote`, `executar_pagamento_lote` e helper interno `fn_pagamento_lote_avaliar`) + 3 migrações de correção do helper durante os testes (`pagamento_lote_avaliar_ordenacao`, `pagamento_lote_avaliar_comparacao_arrays`, `pagamento_lote_avaliar_correcao_competencias`) + `061_bloqueio_conflito_escala` (funções `fn_mensagem_conflito_escala`/`fn_avaliar_conflito_escala`, RPCs `validar_conflito_escala`/`validar_conflito_escala_itens`, triggers `trg_escalas_itens_conflito`/`trg_escalas_conflito`/`trg_presencas_conflito` e reforço de `salvar_escala_completa`/`registrar_presenca_coordenador`/`registrar_presenca_token`; etapa BLOQUEAR-CONFLITO-DE-ESCALA) + `062_setor_no_item_escala` (coluna `escalas_itens.setor_id` + FK → `setores` + índice + RPC `salvar_escala_completa` aceitando `setor_id` opcional por item; etapa SETOR-NO-ITEM-DA-ESCALA).

---

## 18. Estado Real das Funcionalidades

| Funcionalidade | Status |
|----------------|--------|
| Login e autenticação | Implementada e testada |
| Cadastro de preceptores (Prática e Internato) | Implementada e testada |
| CPF do preceptor — opcional, sem dígitos verificadores (Etapa CPF-OPCIONAL-SEM-VALIDACAO) | Implementada: `validateCpf` removida, vazio grava `NULL`, duplicidade só para preenchido; banco inalterado (constraints já suportavam); testes SQL executados com sucesso; `npm run build` OK; Console/Rede aguardando teste manual (sem credenciais no ambiente) |
| E-mails adicionais para cópia no cadastro do preceptor (admin) | Implementada (banco + lógica + build); interface aguardando teste manual |
| Validação de período (1º–8º / 9º–12º) | Implementada e testada |
| Cadastros auxiliares | Implementada e testada |
| Escalas | Implementada e testada |
| Setor no item da escala — estrutura (banco + RPC + fallback de leitura) — Etapa SETOR-NO-ITEM-DA-ESCALA | Implementada (migração `062`): `escalas_itens.setor_id` → FK `setores`, RPC aceitando setor opcional por item, fallback para o setor legado do vínculo; RLS preservada; testes SQL OK e `npm run build` OK; **formulário visual ainda não alterado** (próxima etapa) |
| Conflito de escala (mesmo preceptor + data + turno) — mapeamento | Mapeado (etapa MAPEAR-CONFLITOS-DE-ESCALA): **0 conflitos**; relatório `MAPA_CONFLITOS_ESCALA.md` |
| Conflito de escala — bloqueio (banco + interface) | Implementada (migração `061_bloqueio_conflito_escala`): triggers + RPCs + `salvar_escala_completa`/`registrar_presenca_coordenador`/`registrar_presenca_token` + pré-validação na interface; **24 testes SQL executados com sucesso** (banco limpo, fixtures removidas); `npm run build` OK; Console/Rede aguardando teste manual (sem credenciais no ambiente) |
| Presenças (rota mobile /p/:token) | Legado técnico — aguardando descontinuação |
| Presenças (registro por coordenador) | Implementada e testada |
| Calendário de Presenças — cores e escopo por perfil | Implementada (RLS corrigida); aguardando teste manual |
| Presenças (tela consolidada) no menu Coordenador | Implementada; aguardando teste manual |
| Regras financeiras | Implementada e testada |
| Apuração mensal | Implementada e testada (homologação: 28/28) |
| Revisão financeira | Implementada e testada |
| Refazer fluxo | Implementada e testada |
| Refazer vínculo | Implementada e testada |
| Excluir vínculo permanentemente (somente Admin, cadastro do preceptor) | Implementada e testada (SQL); UI aguardando teste manual |
| Excluir preceptor permanentemente (somente Admin, cadastro do preceptor) | Implementada e testada (SQL); UI aguardando teste manual |
| Controle Financeiro (tela unificada) | Implementada e testada |
| PDF demonstrativo | Implementada e testada |
| E-mail via Outlook (deep link) | Implementada e testada |
| Outlook: Para = e-mail principal e Cc = adicionais ativos (cadastro atual) | Implementada; Cc corrigido com `mailtouri` (lógica 20/20 + build OK); Console/Rede aguardando teste manual |
| Solicitação de nota fiscal (preparar, enviar, corrigir envio) | Implementada e testada |
| Pagamento — **Marcar como pago** (ação única, sem etapas separadas) | Implementada; build + bundle OK; teste manual pendente |
| Controle Financeiro — fluxo pós-cálculo simplificado (sem NF, sem pagamento em etapas) | Implementada; interface aguardando teste manual |
| Pagamento em lote — RPCs de banco (`previa_pagamento_lote` / `executar_pagamento_lote`) | Implementada e testada (SQL, 11 verificações); interface entregue na Etapa PAGAMENTO-LOTE-TELA |
| Controle Financeiro — pagamento em lote com seleção múltipla (Etapa PAGAMENTO-LOTE-TELA) | Implementada; `npm run build` + bundle OK; teste manual aguardando |
| Dashboard | Saldo semestral por preceptor e por vínculo entregue (etapa DASHBOARD-SALDO-POR-PRECEPTOR, 01/10/2026: 102 asserções de funções puras); gráfico "Utilização do saldo semestral" com ranking de vínculos clicável e saldo nas exportações Excel/PDF entregues (etapa DASHBOARD-GRAFICO-SALDO-EXPORTACAO, 01/10/2026: 69 asserções de funções puras + `npm run build` OK); referências antigas de nota fiscal removidas (etapa VALIDAR-PAGAMENTO-SIMPLIFICADO); aguardando teste manual |
| Auditoria | Implementada |
| Gerenciamento de usuários | Implementada |
| Busca e filtros na Apuração | Implementada e testada |
| Paginação | Implementada e testada |
| Histórico de eventos | Implementada e testada |
| Responsividade (mobile/tablet/desktop) | Implementada e testada |

### Validação — Etapa EMAILS-ADICIONAIS-CADASTRO (29/09/2026)

| Verificação | Resultado |
|-------------|-----------|
| Migrações `058` e `059` aplicadas no Project Ref `tdmrscavrdoekrzdlmpf` | OK |
| Regras de banco em transação com `ROLLBACK` (sem dados residuais): trim; duplicidade entre adicionais; adicional = e-mail principal; e-mail inválido/vazio; e-mail principal = cópia **ativa**; e-mail principal = cópia **inativa** (permitido); reativação igual ao principal; desativação parcial; `atualizado_em`; cascade ao excluir preceptor; auditoria em `audit_logs` | OK — 2 registros de auditoria (1 em `preceptores`) e 0 linhas residuais |
| Re-teste pós-migração `059` (revogação de `EXECUTE`) | OK — triggers continuam disparando |
| RLS `preceptor_emails_copia_admin` + `EXECUTE` negado para `anon`/`authenticated` nas funções de trigger | OK |
| Lógica de frontend (`validarEmailsCopia`) via Node | 8/8 casos |
| `npm run build` (vite) | OK (apenas warning de chunk >500 kB, já existente) |
| Console do navegador em sessão autenticada | **Não verificado** — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` no ambiente |
| Itens 1–13 da interface (390/768/1366 px, adicionar/editar/remover/ativar-desativar, persistência ao reabrir, sem HTML bruto) | **Pendentes de teste manual** |

---

### Validação — Etapa FLUXO-EMAIL-PAGAMENTO (29/09/2026)

| Verificação | Resultado |
|-------------|-----------|
| Fluxo final: **Cálculo conferido → Preparar e-mail → Marcar e-mail enviado → Não pago → Marcar como pago → Pago** | OK — rótulos e botões correspondentes no Controle Financeiro |
| Botão **"Marcar NF Recebida"** e modal de recebimento removidos | OK — 0 ocorrências no bundle |
| Etiqueta **"Aguardando nota fiscal"** e situação **"NF Recebida"** fora do Controle Financeiro | OK — na época restavam 3 ocorrências, todas rótulos do **Dashboard** (tela preservada por regra da etapa); **removidas na etapa VALIDAR-PAGAMENTO-SIMPLIFICADO (30/09/2026 — seção 18)** |
| **"Iniciar pagamento"** / **"Concluir pagamento"** fora do bundle | OK — 0 ocorrências; "Em pagamento" aparecia 1x como rótulo legado do Dashboard e **saiu do bundle em 30/09/2026** |
| Modal de pagamento sem campo **"Valor da Nota"**; ação chamada **"Marcar como pago"** | OK |
| Novo texto de fechamento do e-mail; texto antigo ("Responda a este e-mail anexando…") ausente | OK |
| **Refazer fluxo** bloqueado quando a situação é `pago` (Refazer vínculo já bloqueava) | OK |
| Pagamento a partir de `solicitada` (sem etapa de nota fiscal) | OK — avanço interno `solicitada → nota_recebida` antes de iniciar/concluir; nenhuma migração, RPC, trigger ou constraint alterada |
| Nenhuma alteração em cálculo, valores, escalas, presenças, PDF, regras financeiras ou Dashboard | OK |
| `npm run build` (vite) | OK (apenas warnings já existentes) |
| Teste automatizado Outlook (`scratch/test_destinatarios_outlook.mjs`) | 20/20 |
| Console/Rede e execução com dados reais (preparar → enviado → não pago → pago) | **Pendente de teste manual** — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` no ambiente |
| Código legado **`PagamentosPage`** e **`FinanceFilters`** (tela de Pagamentos, fora da navegação) | Removidos do fonte — 0 ocorrências em `src/App.jsx` |

**Arquivos alterados:** `src/App.jsx` (rótulos/botões do Controle Financeiro, modais de nota fiscal removidos, ação única "Marcar como pago", guarda de refazer em `pago`, novo corpo do e-mail, rota e código legados de Pagamentos removidos), `scratch/test_destinatarios_outlook.mjs` (novo texto de fechamento) e `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` (seções 8, 10, 12, 13, 14, 18, 19 e 20). **Não alterado:** banco (nenhuma migração), cálculos, valores, escalas, presenças, PDF, identificação fiscal, destinatários do e-mail e **Dashboard**.

---

### Validação — Etapa PAGAMENTO-LOTE-BANCO (29/09/2026)

Banco: Project Ref `tdmrscavrdoekrzdlmpf`, via MCP `supabase-preceptor`. Testes com fixtures sintéticas criadas em 2026-10 e **removidas ao final** (banco de produção restaurado: 2 preceptores, 11 presenças, 2 solicitações, 3 eventos, 0 resíduos de auditoria/objetos `zz_*`).

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Prévia com vários registros não pagos | OK — 3 válidos, `valor_total_valido = 2000.00`, `pode_executar = true`, `bloqueios = []` |
| 2 | Seleção com registro **já pago** (EDGAR em 2026-09) | OK — bloqueio `ja_pago` |
| 3 | Seleção com **e-mail não enviado** (situação `preparada`) | OK — bloqueio `email_nao_enviado` |
| 4 | Registros de **competência diferente** + cálculo **desatualizado** + id inexistente | OK — `competencia_diferente`, `calculo_desatualizado`, `registro_invalido` |
| 5 | Executar lote válido (2 registros) | OK — `qtd_processada = 2`, `valor_total_pago = 1500`, transição interna `solicitada → nota_recebida → pago` |
| 6 | Histórico **individual** por registro | OK — 2 eventos por solicitação (transição interna + `pago`) em `solicitacao_nota_fiscal_eventos` |
| 7 | **Data**, **valor** e **usuário** gravados | OK — `data_pagamento = 2026-09-29` em `detalhes`, `valor_pago` 700/800, `realizado_por = 1e5e0024-…` (profile do Admin autenticado) |
| 8 | Bloqueio de **duplicidade** (2ª execução do mesmo lote) | OK — exceção `ja_pago`; nenhum pagamento regravado |
| 9 | **Rollback** com falha simulada no 2º registro (trigger temporário) | OK — exceção propagada e **0 escritas persistidas**: ambas as solicitações permaneceram `solicitada`, `updated_at` intacto, 0 eventos |
| 10 | **Refazer vínculo** bloqueado nos registros pagos (controle não pago) | OK — retorno `…Pagamento concluído bloqueia o refazer vínculo.`; controle não pago → `NULL` (desbloqueado) |
| — | Acesso negado a usuário **não-administrador** (prévia e execução) | OK — `Acesso negado. Perfil não autorizado…` nas duas RPCs |
| — | Execução com seleção **mista** (1 válido + 1 bloqueado) | OK — recusada antes de qualquer escrita; o válido permaneceu não pago |
| — | **Nenhuma alteração** em `calculos.status`, valores, escalas, presenças ou saldo geral | OK — todos os cálculos seguem `calculado`; `saldos_autorizados`/`saldo_movimentos` = 0 linhas |
| 11 | `npm run build` (vite) | OK (apenas warnings já existentes) |
| — | Interface (botões/checkbox de lote) | **Não existe nesta etapa** — RPCs de banco apenas |

**Arquivos alterados:** `supabase/migrations/060_pagamento_lote_banco.sql` (novo), `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` (seções 10, 14, 17, 18 e 19). **Não alterado:** `src/**`, cálculos, valores, escalas, presenças, PDF, e-mail e Dashboard.

---

### Validação — Etapa PAGAMENTO-LOTE-TELA (29/09/2026)

Sem alteração de banco (as RPCs da etapa PAGAMENTO-LOTE-BANCO foram apenas **chamadas** do frontend), sem novas migrações e sem alteração de Dashboard, cálculos, valores, escalas, presenças, PDF ou e-mail. Verificações executáveis nesta etapa (sem navegador/credenciais) concluídas; as demais ficam como teste manual.

| Verificação | Resultado |
|-------------|-----------|
| `npm run build` (vite) | **OK** (apenas warnings já existentes: bundle > 500 kB) |
| Funções `previaPagamentoLote` / `executarPagamentoLote` no bundle, chamando exatamente `previa_pagamento_lote` e `executar_pagamento_lote` com `p_competencia_id`, `p_preceptor_ids`, `p_data_pagamento`, `p_observacao` | **OK** (verificado no `dist/`) |
| Textos da tela presentes no bundle (filtros rápidos, "Selecionar para pagamento", "Selecionar esta página", "Selecionar todos os resultados filtrados", barra fixa, modal, selo "não elegível") | **OK** (verificado no `dist/`) |
| Prévia obrigatória **antes** da confirmação + recusa por divergência (conjunto de ids, competência, valor) e por bloqueio, sem executar nada | **OK** (código: `handleExecutarPagamentoLote` retorna antes de `executar_pagamento_lote`) |
| Somente Administrador entra no modo de seleção (RPCs exigem papel administrador) | **OK** (guard em `alternarModoSelecaoLote`) |
| Ação individual **"Marcar como pago"** preservada (fluxo, modal e botão intactos) | **OK** (nenhuma edição no fluxo individual) |
| Banco, RPCs aprovadas, Dashboard, cálculos, escalas e presenças inalterados | **OK** (nenhuma migração/SQL nesta etapa) |
| Arquivos alterados | `src/App.jsx`, `src/services/queries.js`, `src/styles.css`, `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` |
| Filtros rápidos (6) refletindo lista, contadores, "Encontrados" e paginação | **Aguardando teste manual (navegador)** |
| Modo de seleção: checkbox só no modo, página atual × todos os resultados filtrados (todas as páginas) | **Aguardando teste manual (navegador)** |
| Bloqueios visuais (já pago, e-mail não enviado, cálculo desatualizado/pendente) com motivo | **Aguardando teste manual (navegador)** |
| Barra fixa: quantidade, valor total, limpar e "Marcar selecionados como pagos" sem cobrir conteúdo | **Aguardando teste manual (navegador)** |
| Modal: competência, quantidade, valor, bloqueados, data obrigatória, observação, cancelar/confirmar | **Aguardando teste manual (navegador)** |
| Resultado do lote com dados reais (pagos, histórico individual, sem duplicidade) | **Aguardando teste manual (navegador)** |
| Atualização sem F5, saída do filtro "Não pagos", desmarcados preservados, indicadores atualizados | **Aguardando teste manual (navegador)** |
| Responsividade 390 / 768 / 1366 px (sem rolagem horizontal, alvos ≥ 44 px, checkbox no cartão mobile) | **Aguardando teste manual (navegador)** |
| Console do navegador sem erros/avisos novos | **Aguardando teste manual (navegador)** |

---

### Validação — Etapa VALIDAR-PAGAMENTO-SIMPLIFICADO (30/09/2026)

Escopo desta etapa: **validar** o fluxo simplificado e **ajustar somente as referências antigas no Dashboard**. Sem alteração de banco (nenhuma migração, RPC, trigger ou constraint), sem alteração de cálculos, regras, valores, escalas, presenças, PDF, e-mail ou exportação. Os rótulos do Dashboard (faixa de situações, filtros rápidos, gráfico "Situação dos processos", lista única e exportação) foram conferidos e já estavam no formato simplificado; o único resíduo encontrado foi a **grade de 6 colunas** dos chips de situação, ajustada para **4 colunas** (e 2 em ≤1050 px).

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | Texto do e-mail **sem pedido de resposta** | **APROVADO** (código + bundle: fechamento "Este e-mail formaliza a solicitação de emissão da Nota Fiscal…" presente; "Responda a este e-mail…" = 0 ocorrências; teste automatizado `scratch/test_destinatarios_outlook.mjs` executado: **20/20**) |
| 2 | Envio manual (**Marcar E-mail Enviado**) | **NÃO EXECUTADO** (exige navegador com login) — conferido apenas em código: ação disponível somente na situação `preparada`, transição pela RPC `confirmar_envio_solicitacao_nota` |
| 3 | Situação **Não pago** | **NÃO EXECUTADO** (exige navegador) — conferido em código: `solicitada`/`nota_recebida`/`em_pagamento`/`cancelado` exibem "Não pago" |
| 4 | **Pagamento individual** | **NÃO EXECUTADO** (exige navegador) — conferido em código: modal "Marcar como pago", avanço interno `solicitada → nota_recebida → pago`, sem campo de nota |
| 5 | **Pagamento em lote** | **NÃO EXECUTADO** (exige navegador) — conferido em código: seleção múltipla + prévia obrigatória + `executar_pagamento_lote` |
| 6 | **Selecionar todos os resultados filtrados** | **NÃO EXECUTADO** (exige navegador) — conferido em código: `selecionarLoteTodosFiltrados()` |
| 7 | **Desmarcar exceções** | **NÃO EXECUTADO** (exige navegador) — conferido em código: `alternarSelecaoLote()` |
| 8 | Pagos **saem** de "Não pagos" | **NÃO EXECUTADO** (exige navegador) — conferido em código: filtro `nao_pagos` recalculado após recarga da fila |
| 9 | **Persistência após F5 e login** | **NÃO EXECUTADO** (exige navegador) |
| 10 | **Histórico individual** | **NÃO EXECUTADO** (exige navegador) — conferido em código: `abrirModalHistorico` + `fetchHistoricoSolicitacaoNota` |
| 11 | **Refazer vínculo bloqueado após pago** | **NÃO EXECUTADO nesta etapa** (exige navegador/dados) — evidência anterior da etapa PAGAMENTO-LOTE-BANCO (teste 10, SQL): bloqueio `…Pagamento concluído bloqueia o refazer vínculo.` |
| 12 | Dashboard **sem estados de nota recebida** | **APROVADO** (verificação estática no fonte e no `dist/`): "Aguardando nota fiscal" 0, "Valor da nota" 0, "Em pagamento" 0, "Marcar NF Recebida" 0; presentes **E-mail não enviado (9)**, **Não pagos (5)**, **Com pendência real (3)**; as 2 ocorrências de "Nota fiscal recebida" restantes são **rótulos de evento do modal Histórico** (registro auditável de eventos passados), não situação do Dashboard |
| 13 | **Valores pagos e não pagos** | **NÃO EXECUTADO** (exige navegador/dados) — conferido em código: cartões `Valor total pago` (`ind.pago`), `Valor pendente` (`total − pago`), `Saldo disponível` e passos do fluxo (`resumo.fluxo`) |
| 14 | **Console** do navegador | **NÃO EXECUTADO na sessão autenticada** — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD`. **Parcial executado:** aplicação servida por `vite preview` (bundle de produção) carregada via Playwright sem sessão: **0 erros no Console** e nenhum rótulo antigo na tela (`scratch/validar_pagamento_simplificado.mjs`, 3/3) |
| 15 | `npm run build` (vite) | **APROVADO** — build OK em 5,16 s; apenas warning já existente (bundle > 500 kB); `.dash-chips` com 4 colunas no CSS gerado |

**Arquivos alterados:** `src/styles.css` (grade `.dash-chips` de 6 → 4 colunas; media query ≤1050 px de 3 → 2 colunas) e `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` (cabeçalho + seções 15, 18, 19 e 20). **Novo:** `scratch/validar_pagamento_simplificado.mjs` (verificação do bundle servido sem sessão: carga, rótulos e Console). **Não alterado:** `src/App.jsx`, `src/services/queries.js`, banco (nenhuma migração), cálculos, regras, valores, escalas, presenças, PDF, e-mail, lista única e exportação.

---

### Validação — Etapa DASHBOARD-SALDO-POR-PRECEPTOR (01/10/2026)

Escopo: completar a **lista única** "Acompanhamento dos preceptores" com o **saldo semestral por preceptor e por vínculo**, sem criar outra lista. Sem migração, RPC ou alteração de cálculo, pagamento, regra, escala, presença, gráfico ou exportação.

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Funções puras (`scratch/test_saldo_preceptor.mjs`): chave do vínculo, validade de cálculo (status + observação), mapa por vínculo, resumo/soma, arredondamento em 2 casas, faixas (70/90), excedente, esgotado, 3 filtros de saldo, cabeçalho (8 itens), formatadores e busca textual | **APROVADO — 102 asserções, 0 falhas** |
| 2 | Fonte do saldo inicial = `vinculos_internato.valor_inicial` (nunca `preceptores.valor_inicial`) e `null` preservado em `fetchPainelPagamentos` → "Saldo não informado" | **APROVADO** (código + teste) |
| 3 | Valor utilizado só de cálculos **válidos** (`calculado/aprovado/fechado/pago`) e **atualizados** (`observacoes` vazio ou `Calculado`); rascunho e marcado como desatualizado ficam de fora | **APROVADO** (teste) |
| 4 | Vários vínculos: expansão gera um bloco por vínculo com os totais daquele vínculo; cabeçalho soma os vínculos do grupo | **APROVADO** (código: `vinculosDoGrupo` agrupa por `chaveVinculoLinha`; soma por vínculo testada) |
| 5 | Compatibilidade: consumidores antigos de `saldo_semestral` (`ind` e `resumo` do Dashboard) usam `Number(... || 0)` → indicadores, gráficos e anel "Utilização do saldo semestral" inalterados **naquele momento** (o anel foi substituído pelo ranking clicável na etapa DASHBOARD-GRAFICO-SALDO-EXPORTACAO; `ind`/`resumo` continuam os mesmos) | **APROVADO** (conferência em `App.jsx`) |
| 6 | Busca textual preservada (nome, nome social, razão social, conselho, e-mail, Internato, local, setor, período, modalidade + dígitos de CPF/CNPJ) | **APROVADO** (teste, sem edição da função) |
| 7 | Novos rótulos e classes no bundle: `Saldo não informado`, `Situação financeira`, `Saldo acima de 80% utilizado`, `Valor utilizado`, `Percentual utilizado`, `dash-saldo-cab`, `dash-saldo-linha` | **APROVADO** (verificado no `dist/`) |
| 8 | `npm run build` (vite) | **APROVADO** — build OK (6,67 s); apenas warning já existente (bundle > 500 kB) |
| 9 | Somatórios, percentuais e barras com dados financeiros reais | **NÃO EXECUTADO** — banco sem dados financeiros: 45 vínculos (**0** com `valor_inicial`), 0 cálculos, 0 presenças, 0 solicitações (reconferido via MCP no Project Ref `tdmrscavrdoekrzdlmpf`) |
| 10 | Console do navegador e responsividade 390/768/1366 px da lista com saldo | **AGUARDANDO teste manual (Edgar)** — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` no ambiente; Console parcial sem sessão (bundle servido via `vite preview` + Playwright): **0 erros** |
| 11 | Reexecução na sessão de 01/10/2026: `scratch/test_saldo_preceptor.mjs`, `npm run build`, rótulos/classes novos no bundle e Console sem sessão | **APROVADO** — 102/102 asserções, build OK, bundle confere, Console 0 erros |

**Arquivos alterados:** `src/services/queries.js` (`saldo_semestral` preserva `null` + seção de funções puras do saldo), `src/App.jsx` (estado `saldoFiltro`, `mapaSaldos`, `g.saldo`/`g.chaves`, chips de saldo, linha de cabeçalho desktop, bloco mobile, expansão por vínculo), `src/styles.css` (`.dash-saldo-cab`, `.dash-saldo-linha`, `.dash-saldo-barra`, faixas), `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` (cabeçalho + seções 15, 18 e 19). **Novo:** `scratch/test_saldo_preceptor.mjs`. **Não alterado:** banco (nenhuma migração/RPC), Controle Financeiro, cálculos, pagamentos, regras, escalas, presenças, gráficos, indicadores e exportação. *(Posteriormente, a etapa **DASHBOARD-GRAFICO-SALDO-EXPORTACAO** alterou somente o gráfico "Utilização do saldo semestral" e as exportações — ver a validação logo abaixo.)*

---

### Validação — Etapa DASHBOARD-GRAFICO-SALDO-EXPORTACAO (01/10/2026)

Escopo: reforçar o gráfico **"Utilização do saldo semestral"** como **ranking de vínculos com barras clicáveis** e incluir **saldo nas exportações** Excel/PDF, com os mesmos valores da lista e exportando todos os registros filtrados. Sem migração, RPC ou alteração de cálculo, pagamento, filtro, lista de preceptores ou gráfico de indicadores.

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Funções puras novas (`scratch/test_grafico_saldo_exportacao.mjs`): identificação do vínculo, ranking (ordenação decrescente, deduplicação por vínculo, limite de 10, inclusão de todos os acima de 80% e esgotados, exclusão e contagem dos sem saldo, flags, excedente, limites customizado e casos de borda) e `valoresSaldoExport` ("Saldo não informado" + percentual `null` → "—") | **APROVADO — 69 asserções, 0 falhas** |
| 2 | Regressão da etapa anterior | **APROVADO** — `scratch/test_saldo_preceptor.mjs` **102/102** |
| 3 | Ranking respeita a mesma base dos indicadores (`data` = busca + filtros do painel); busca por preceptor mostra só os vínculos dele | **APROVADO** (memo `rankingSaldo` sobre `data`/`mapaSaldos`) |
| 4 | Clique na barra: aplica o preceptor na busca da lista, expande o registro correspondente (efeito `abrirPreceptor`), não navega de tela e não altera dados | **APROVADO** (código-fonte + asserções de integração) |
| 5 | Exportação Excel: abas existentes preservadas (Resumo / Preceptores / Atuações / Pendências) + colunas de saldo em Preceptores e Atuações (por vínculo) + ranking e contagens no Resumo | **APROVADO** (código-fonte + bundle) |
| 6 | Exportação PDF: seção "Vínculos com maior utilização do saldo" (tabela + contagens + nomes sem saldo) e colunas de saldo na lista e na composição; **sem CPF/CNPJ** | **APROVADO** (código-fonte + asserções) |
| 7 | Exporta todos os registros filtrados (não só a página visível) e usa os mesmos valores da lista (`celSaldoLinha`/`saldoPdfLinha` a partir de `resumoSaldoVinculos`); nunca `preceptores.valor_inicial` | **APROVADO** (asserções sobre `DashboardPage`) |
| 8 | Larguras das colunas do PDF paisagem (297 − 2×14 = 269 mm): somatórios 94 / 234 / 258 / 259 / 86 mm | **APROVADO** (todas ≤ 269 mm; conferido em `App.jsx`) |
| 9 | `npm run build` (vite) | **APROVADO** — build OK (3,53 s); apenas warning já existente (bundle > 500 kB); rótulos novos conferidos no bundle (`dash-rank-item`, "Vínculos sem saldo informado", "Valor pago (semestre)", "Percentual utilizado (%)") |
| 10 | Console do navegador (bundle de produção servido por `vite preview` + Playwright, sem sessão) | **APROVADO — 3/3**, 0 erros no Console (`scratch/validar_pagamento_simplificado.mjs`) |
| 11 | Somatórios, ranking e exportações com **dados financeiros reais** | **NÃO EXECUTADO** — banco sem dados financeiros: 45 vínculos (**0** com `valor_inicial`), 0 cálculos, 0 presenças, 0 solicitações |
| 12 | Console autenticado, clique nas barras da tela, abertura dos arquivos (Excel/PDF) e responsividade 390/768/1366 px do ranking | **AGUARDANDO teste manual (Edgar)** — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` no ambiente |

**Arquivos alterados:** `src/services/queries.js` (novas funções puras `identificacaoVinculoLinha`, `montarRankingSaldoVinculos`, `valoresSaldoExport`), `src/App.jsx` (estado `abrirPreceptor` + efeito de expansão, memo `rankingSaldo`, cartão de saldo refeito como ranking clicável, colunas de saldo no Excel e no PDF, seção de ranking no PDF), `src/styles.css` (classes `.dash-rank-*` e responsivo ≤760 px), `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` (cabeçalho + seções 15, 18 e 19). **Novo:** `scratch/test_grafico_saldo_exportacao.mjs`. **Não alterado:** banco (nenhuma migração/RPC), Controle Financeiro, cálculos, pagamentos, regras, escalas, presenças, filtros, lista de preceptores, demais gráficos de indicadores e dados/estrutura das abas exportadas.

---

### Validação — Etapa SETOR-NO-ITEM-DA-ESCALA (01/10/2026)

Escopo: preparar a estrutura para o **setor pertencer ao item da escala** (data/dia + turno), mantendo o setor do vínculo como legado/fallback. Sem tocar em valores, cálculos, saldos, PDF, e-mail, pagamentos, Dashboard, presença confirmada ou formulário visual. Project Ref `tdmrscavrdoekrzdlmpf`, MCP `supabase-preceptor`.

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Estrutura encontrada: `escalas_itens` **sem** `setor_id` (só `id, escala_id, data, dia_semana, turno, created_at, updated_at`); setor existia apenas no vínculo (`vinculo_locais.setor_id`, `vinculos_*.setor_id`) e em `presencas.setor_id`; cadastro auxiliar `setores` com 9 registros | **CONFIRMADO** |
| 2 | Migração `062_setor_no_item_escala` aplicada (coluna `setor_id uuid NULL`, FK `escalas_itens_setor_id_fkey → setores(id)`, índice `escalas_itens_setor_id_idx`, comentário documentando fallback) | **APROVADO** |
| 3 | RPC `salvar_escala_completa` aceita `setor_id` opcional por item; grants preservados (PUBLIC/anon/authenticated/postgres/service_role) | **APROVADO** |
| 4 | Criar item de escala **com setor próprio** e consultar de novo (fixture temporária) | **APROVADO** — item persistiu com `setor_id = CIRURGIA`; segundo item **sem** setor persistiu `NULL` |
| 5 | Fallback de leitura: item sem setor próprio → setor legado do vínculo (`AMBULATORIO`) | **APROVADO** — `coalesce(setor do item, setor legado)` retorna o setor legado para o item `NULL` e o setor próprio quando existe |
| 6 | Somente setores cadastrados: setor inexistente (uuid válido inexistente) e **texto livre** rejeitados pela RPC com mensagem amigável | **APROVADO** — "Setor nao encontrado no cadastro…" / "Setor invalido…" |
| 7 | Item novo não altera regras antigas: conflito de escala (mesmo preceptor+data+turno) continua bloqueando com mensagem amigável e UNIQUE `escalas_itens(escala_id, data, turno)` intacta | **APROVADO** |
| 8 | Coluna antiga do vínculo **não removida**; nenhum setor copiado automaticamente (itens antigos continuam `NULL`) | **APROVADO** |
| 9 | Presenças/cálculos/valores/pagamentos/saldos inalterados (baseline 0/0/0/0/0 — banco sem dados financeiros) | **APROVADO** — contagens idênticas antes e depois |
| 10 | RLS para Admin e Coordenador (papel simulado em transação com rollback): admin lê escalas/itens e grava em `setores`; coordenador lê escalas associadas (0 sem associação) e **não** grava em `setores`; policies `escalas_read/write`, `escalas_itens_*`, `presencas_*`, `setores_*` idênticas ao baseline | **APROVADO** |
| 11 | Fixtures removidas e banco restaurado (0 escalas, 0 itens, 0 vinculo_locais, auditoria 3431 = baseline, 0 resíduos `ZZ_*`) | **APROVADO** |
| 12 | Advisors de segurança: nenhum finding novo da etapa (RLS desabilitada somente em 2 tabelas pré-existentes: `solicitacao_nota_fiscal_itens` e `internato_disciplinas`) | **APROVADO** |
| 13 | `npm run build` (vite) | **APROVADO** — build OK (2,00 s; apenas warning já existente de bundle > 500 kB) |
| 14 | Formulário visual da escala (campo de setor por item na tela) | **NÃO ALTERADO** — intencionalmente fora do escopo (próxima etapa) |
| 15 | Escalas/presenças reais com dados de produção | **NÃO EXECUTADO** — banco sem escalas/presenças/cálculos no momento (0 registros) |

**Arquivos alterados:** `supabase/migrations/062_setor_no_item_escala.sql` (novo), `src/services/queries.js` (`fetchEscalasPorVinculo` lê `setor_id`/`setor` do item com fallback para o setor legado do vínculo; `salvarEscala` repassa `setor_id` quando presente), `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` (cabeçalho + seções 5, 17 e 18). **Não alterado:** `src/App.jsx`, `src/styles.css`, formulário visual, regras/valores/cálculos/saldos, PDF, e-mail, pagamentos, Dashboard, presenças confirmadas, RLS e demais RPCs.

---

## 19. Pendências Reais

| Pendência | Prioridade | Status |
|-----------|-----------|--------|
| Testes manuais do fluxo completo (Edgar) | Alta | Aguardando |
| Validação do PDF com dados reais | Alta | Aguardando |
| Validação do e-mail Outlook com dados reais | Alta | Aguardando |
| Outlook com Cc: itens 1–25 da etapa CORRIGIR-CC-DO-OUTLOOK (Para/Cc, repetição, desativação, duplicidades, corpo/assinatura, Console/Rede, build) | Alta | Aguardando |
| Validação do fluxo fiscal completo | Alta | Aguardando |
| Fluxo pós-cálculo simplificado (FLUXO-EMAIL-PAGAMENTO): preparar → enviado → não pago → pago, registros antigos exibidos como "Não pago", refazer bloqueado em Pago, novo corpo do e-mail | Alta | Aguardando |
| Validação do pagamento com baixa de saldo | Alta | Aguardando |
| Validação do refazer fluxo com pagamento pago | Alta | Aguardando |
| Dashboard: teste manual com filtros | Média | Aguardando |
| DASHBOARD-SALDO-POR-PRECEPTOR: teste manual da lista com saldo (linha de cabeçalho desktop/mobile, expansão por vínculo com barra, filtros rápidos de saldo, estados vazios, 390/768/1366 px e Console) e somatórios com dados financeiros reais | Alta | Aguardando — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` e sem dados financeiros no banco (funções puras 102/102 e build OK) |
| DASHBOARD-GRAFICO-SALDO-EXPORTACAO: teste manual do ranking "Utilização do saldo semestral" (clique na barra → busca + expansão, busca por preceptor, contagem de sem saldo, estados vazios, 390/768/1366 px) e das exportações (colunas de saldo nas abas Preceptores/Atuações e no Resumo, seção de saldo do PDF, ausência de CPF/CNPJ, arquivos abrindo) com Console autenticado | Alta | Aguardando — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` e sem dados financeiros no banco (funções puras 69/69 + regressão 102/102, build OK e Console sem sessão 3/3) |
| VALIDAR-PAGAMENTO-SIMPLIFICADO: testes 2–11, 13 e 14 (envio manual, situação Não pago, pagamento individual e em lote, selecionar/desmarcar, saída de "Não pagos", F5/login, histórico, refazer vínculo, valores e Console) | Alta | Aguardando — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` no ambiente (testes 1, 12 e 15 aprovados) |
| Calendário de Presenças: cores (verde/azul/parcial) e escopo por Admin e Coordenador | Alta | Aguardando |
| E-mails para cópia no cadastro do preceptor: teste manual de interface (itens 1–13, Console, 390/768/1366 px) | Alta | Aguardando |
| Pagamento em lote (PAGAMENTO-LOTE-TELA): teste manual da interface (filtros rápidos, seleção página × todos os filtrados, bloqueios, modal com prévia, resultado do lote, atualização sem F5, Console e 390/768/1366 px) | Alta | Aguardando |
| Pagamento em lote com `saldos_autorizados` preenchidos (baixa por atuação em `saldo_movimentos`) | Média | Aguardando — hoje não há saldo cadastrado no ambiente |
| BLOQUEAR-CONFLITO-DE-ESCALA: teste manual de Console/Rede e responsividade 390/768/1366 px (edição de escala com conflito, reativação, registro de presença com conflito e `/p/:token`) | Alta | Aguardando — sem credenciais `TEST_EMAIL`/`TEST_PASSWORD` no ambiente (testes SQL 24/24 aprovados, build OK) |
| `registrar_presenca_token`: na consulta de `profile_id` de `preceptor_acesso_presenca` a coluna não existe (bug pré-existente, presente na função original; o caminho de conflito retorna antes dessa linha) | Média | Aberta — observação registrada na etapa BLOQUEAR-CONFLITO-DE-ESCALA |
| SETOR-NO-ITEM-DA-ESCALA: **próxima etapa** — alterar o formulário visual da escala para exibir/gravar setor por item (hoje a estrutura, a RPC e o fallback de leitura estão prontos; a tela ainda não envia `setor_id` por item) | Alta | Aguardando — **não iniciar sem instrução** |

---

## 20. Regras Removidas ou Descartadas

| Regra | Motivo da remoção |
|-------|-------------------|
| ~~Chamado como etapa do fluxo~~ | Conceito removido do sistema |
| ~~E-mails separados por vínculo~~ | Substituído por e-mail consolidado (1 por preceptor+competência) |
| ~~PDFs separados por vínculo~~ | Substituído por PDF consolidado (1 por preceptor+competência) |
| ~~Seleção manual para PDF ou e-mail~~ | Composição é automática (todas atuações elegíveis) |
| ~~Ações fiscais na Apuração~~ | Removidas em 18/09/2026 (exclusivamente na Pagamentos) |
| ~~Tela separada "Apuração Mensal"~~ | Unificada na tela **Controle Financeiro** (única tela operacional do financeiro) |
| ~~Tela separada "Pagamentos"~~ | Unificada na tela **Controle Financeiro** (ações fiscais visíveis por preceptor) |
| ~~Navegação entre etapas (voltar/refazer fluxo completo) para exclusão~~ | Substituído por **Refazer vínculo** (prévia + RPC transacional por vínculo); antes: Excluir Escala e Excluir Atuação diretos |
| ~~Mensagem genérica "Informações do preceptor ou competência incompletas."~~ | Substituída por mensagens específicas indicando exatamente o campo ausente (seções 11 e 12) |
| ~~Campos `chamado_*` na RPC `buscar_fila_financeira`~~ | Conceito de chamado removido (migrações 044/046); RPC corrigida na migração 051 |
| ~~Exigência de revisão financeira para gerar PDF ou preparar e-mail~~ | Fluxo simplificado: elegibilidade = cálculo do preceptor/competência, com valor, atualizado e sem recálculo pendente; revisão é só conferência visual |
| ~~Bloqueio de PDF/e-mail por tentativa anterior~~ | Ações 100% repetíveis: nova consulta a cada clique; sem estado de "consumido" |
| ~~Homologação automática como aprovação~~ | Rejeitada — requer teste manual do usuário |
| ~~Regras contraditórias ou substituídas~~ | Consolidadas neste documento |
| ~~Função `prepararEmailConsolidado`~~ | Função legada removida |
| ~~Função `prepararEmailsSeparados`~~ | Função legada removida |
| ~~Função `prepararPagamento` (antiga)~~ | Substituída por `iniciarPagamento` |
| ~~Constraint `UNIQUE (calculo_id)`~~ | Substituída por lógica de composição unificada |
| ~~Botões incondicionais "PDF" e "E-mail"~~ | Substituídos por ações condicionais à situação |
| ~~Display "Mov:" com "Invalid Date"~~ | Corrigido: `fmtData()` detecta timestamps completos |
| ~~Propostas antigas de interface~~ | Descartadas, não são regras atuais |
| ~~Análise de riscos obsoleta~~ | Riscos já resolvidos |
| ~~Migrações detalhadas como regras~~ | Detalhes de implementação, não regras operacionais |
| ~~Presença por token como fluxo oficial~~ | Legado técnico, aguardando descontinuação (ver seção 6) |
| ~~Link individual para preceptor como fluxo oficial~~ | Legado técnico (tabela `preceptor_acesso_presenca`) |
| ~~Coordenador como requisito de completude do vínculo~~ | Coordenador controla visibilidade, não completude (seção 4) |
| ~~Regras antigas de badge "Liberado" sozinho~~ | Substituído por "Ativo \| X de Y vínculo(s) liberado" (seção 4) |
| ~~Etapa **"Marcar NF Recebida"** (botão e modal de recebimento)~~ | Removida da interface na etapa FLUXO-EMAIL-PAGAMENTO; banco e histórico preservados |
| ~~Situações visíveis **"Aguardando nota fiscal"** e **"NF Recebida"**~~ | Substituídas por **"Não pago"** (seção 8) |
| ~~Rótulos antigos do **Dashboard**: "Aguardando nota fiscal", "Nota fiscal recebida", coluna **"Valor da nota"** e **divergência de nota** como motivo de pendência~~ | Substituídos por **E-mail não enviado**, **Não pagos**, **Pagos** e **Com pendência real** (seção 15; etapa VALIDAR-PAGAMENTO-SIMPLIFICADO) |
| ~~Etapas separadas **"Iniciar pagamento"**, **"Em pagamento"** e **"Concluir pagamento"**~~ | Pagamento virou ação única **"Marcar como pago"** (seção 14) |
| ~~Campo **"Valor da Nota"** no modal de pagamento~~ | Etapa de nota fiscal fora do fluxo |
| ~~Tela/rota **"Pagamentos"** (`PagamentosPage`)~~ | Fora da navegação e removida do roteamento |
| ~~Orientação "Responda a este e-mail anexando a sua Nota Fiscal…"~~ | Substituída pela frase que formaliza a solicitação de emissão (seção 12) |
