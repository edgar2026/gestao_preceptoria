# Inventário de Documentação Antiga

> **Data:** 18/09/2026  
> **Última atualização:** 18/09/2026 (limpeza documental final — conclusão)  
> **Objetivo:** Classificar todos os arquivos de documentação existentes para decisão sobre preservação, incorporação ou exclusão.  
> **Status:** Limpeza concluída. 12 arquivos excluídos. 4 arquivos preservados. Uma única fonte oficial.

---

## Resumo Final

| Categoria | Quantidade |
|-----------|------------|
| Excluídos | 12 |
| Preservados | 3 |
| **Total original** | **15** |
| **Total restante** | **4** (3 preservados + 1 inventário) |

---

## 1. Arquivos Preservados

Estes arquivos permanecem ativos.

| # | Arquivo | Caminho | Motivo |
|---|---------|---------|--------|
| 1 | `AGENTS.md` | `./AGENTS.md` | Instruções obrigatórias para agentes de desenvolvimento. Regras ativas. |
| 2 | `README.md` | `./README.md` | Documentação pública do projeto. |
| 3 | `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` | `./` | **Fonte oficial única** (v1.1). |
| 4 | `INVENTARIO_DOCUMENTACAO_ANTIGA.md` | `./` | Este arquivo — inventário de referência. |

---

## 2. Arquivos Incorporados à Documentação Oficial

Todo o conteúdo útil destes arquivos foi incorporado ao `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md`. Podem ser mantidos como referência ou excluídos posteriormente.

| # | Arquivo | Caminho | Conteúdo incorporado | Divergências com a oficial |
|---|---------|---------|---------------------|---------------------------|
| 1 | `MAPA_ATUAL_FLUXO_FINANCEIRO.md` | `./` | Regras operacionais do fluxo financeiro (Apuração, Pagamentos, PDF, E-mail, NF, Pagamento). | Nenhuma — documento atualizado em 18/09/2026. |
| 2 | `DIAGNOSTICO_FLUXO_FINANCEIRO_ATUAL.md` | `./` | Status de implementação do fluxo financeiro. | Nenhuma — documento atualizado em 18/09/2026. |
| 3 | `HOMOLOGACAO_TECNICA_FLUXO_FINANCEIRO.md` | `./` | Relatório de homologação técnica (15 testes automatizados). | Nenhuma — resultado técnico válido. |
| 4 | `HOMOLOGACAO_SIMPLIFICACAO_FINANCEIRO.md` | `./` | Homologação da simplificação Apuração × Pagamentos (28 testes). | Nenhuma — resultado técnico válido. |
| 5 | `EDITOR_HANDOFF.md` | `./` | Handoff para novos desenvolvedores. | Parcialmente desatualizado (menciona módulos que não existem mais como "Fechamentos", "Processos"). |
| 6 | `docs/DOCUMENTACAO_COMPLETA_SISTEMA.md` | `./docs/` | Visão geral completa do sistema (802 linhas). | **Desatualizado:** Menciona "chamado" como etapa, "auto-pago", regras antigas. Seções 3.10.2 e 3.10.3 contêm regras substituídas. |
| 7 | `docs/DOCUMENTACAO_IMPLEMENTACAO_01_08_2026.md` | `./docs/` | Status de implementação de 01/08/2026. | **Desatualizado:** Menciona "15 funções" (hoje são 30), "37 tabelas vazias" (hoje com dados), login implementado. |
| 8 | `docs/ESTRUTURA_REAL_SUPABASE.md` | `./docs/` | Estrutura real do banco em 01/08/2026. | **Parcialmente desatualizado:** Seções 6.1–6.3 descrevem o frontend como "sem login" e "dados mock" — hoje implementado. Tabelas e enums ainda válidos. |
| 9 | `docs/ANALISE_CADASTRO_PRECEPTORES_INTERNATO.md` | `./docs/` | Análise completa do cadastro de preceptores do Internato (3115 linhas). Regras incorporadas: completude do vínculo (12 campos), regras de visibilidade por perfil, regras de duplicidade, badge de situação, exclusão lógica, motor financeiro configurável, presença por token como legado técnico. **Excluído em 18/09/2026.** | Regras descartadas: presença por token como oficial, link individual como oficial, coordenador como requisito de completude, badge "Liberado" sozinho. Contradições resolvidas: RG removido da interface, unidade_id com fallback. |
| 10 | `docs/DOCUMENTACAO_VIVA_PLANILHAS_PRECEPTORIA.md` | `./docs/` | Levantamento original das 4 planilhas. Visão geral do sistema, stack, arquitetura, dados iniciais. **Excluído em 18/09/2026.** Conteúdo incorporado à oficial (seções 1, 3, 17). | Nenhuma — conteúdo histórico preservado na oficial. |

---

## 3. Candidatos à Exclusão

Estes arquivos são duplicatas ou conteúdo que não agrega valor à documentação oficial.

| # | Arquivo | Caminho | Motivo |
|---|---------|---------|--------|
| 1 | `docs/Baixar documentação consolidada.md` | `./docs/` | **Duplicata exata** de `DOCUMENTACAO_VIVA_PLANILHAS_PRECEPTORIA.md` (primeiras 908 linhas idênticas). Contém apenas a análise das 4 planilhas. |
| 2 | `docs/MCP_FORMS_CONFIG.md` | `./docs/` | **Configuração técnica de MCP** para outro projeto (`ugpkojgzyqzzssbsdope`), não para este (`tdmrscavrdoekrzdlmpf`). Irrelevante para este projeto. |

---

## 4. Arquivos que Exigem Análise Manual

Nenhum arquivo pendente de análise.

---

## 5. Arquivos Técnicos que Não São Documentação

Nenhum arquivo foi identificado nesta categoria. Todos os arquivos `.md` encontrados são documentação.

---

## 6. Pasta `private/`

A pasta `private/` não existe no projeto. Nenhum arquivo a tratar.

---

## 7. Divergências Encontradas entre Documentações

| Divergência | Documentos afetados | Resolução |
|-------------|---------------------|-----------|
| "Chamado" como etapa do fluxo | `DOCUMENTACAO_COMPLETA_SISTEMA.md` (seção 3.10.2) | Regra descartada. Deep link substituiu. Removida da oficial. |
| "Auto-pago" via `atualizar_chamado` | `DOCUMENTACAO_COMPLETA_SISTEMA.md` (seção 3.10.2) | Regra descartada. Pagamento agora é explícito (iniciar → concluir). |
| "15 funções/RPCs" | `DOCUMENTACAO_IMPLEMENTACAO_01_08_2026.md` | Hoje são 30 RPCs. Atualizado na oficial. |
| "37 tabelas vazias" | `DOCUMENTACAO_IMPLEMENTACAO_01_08_2026.md` | Hoje com dados. Atualizado na oficial. |
| "Sem login" / "dados mock" | `ESTRUTURA_REAL_SUPABASE.md` (seções 6.1–6.3) | Login e dados implementados. Atualizado na oficial. |
| "PDFs separados por vínculo" | `MAPA_ATUAL_FLUXO_FINANCEIRO.md` (versão anterior) | Substituído por PDF consolidado. Atualizado em 18/09/2026. |
| "E-mails separados" | `MAPA_ATUAL_FLUXO_FINANCEIRO.md` (versão anterior) | Substituído por e-mail consolidado. Atualizado em 18/09/2026. |
| Botões fiscais na Apuração | `MAPA_ATUAL_FLUXO_FINANCEIRO.md` (versão anterior) | Removidos em 18/09/2026. Atualizado. |
| Presença por token como fluxo oficial | `ANALISE_CADASTRO_PRECEPTORES_INTERNATO.md` (seção 4.4) | Classificado como legado técnico na oficial. Aguardando descontinuação. |
| Coordenador como requisito de completude | `ANALISE_CADASTRO_PRECEPTORES_INTERNATO.md` (seção 28) | Removido. Coordenador controla visibilidade, não completude. Atualizado na oficial. |
| Badge "Liberado" sozinho | `ANALISE_CADASTRO_PRECEPTORES_INTERNATO.md` (seção 25) | Substituído por "Ativo \| X de Y vínculo(s) liberado". Atualizado na oficial. |
| RG na interface | `ANALISE_CADASTRO_PRECEPTORES_INTERNATO.md` (seção 3.2) | RG existe no banco mas foi removido da interface. Nota adicionada na oficial. |

---

## 8. Situação Final

| Arquivo | Status |
|---------|--------|
| `AGENTS.md` | Preservado — regras ativas |
| `README.md` | Preservado — documentação pública |
| `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` | Preservado — **fonte oficial única** (v1.1) |
| `INVENTARIO_DOCUMENTACAO_ANTIGA.md` | Preservado — inventário de referência |
| Todos os demais `.md` | **Excluídos** — incorporados à oficial ou irrelevantes |

---

## 9. Resultado da Limpeza (18/09/2026)

### Arquivos Excluídos (12)

| # | Arquivo | Motivo |
|---|---------|--------|
| 1 | `MAPA_ATUAL_FLUXO_FINANCEIRO.md` | Incorporado à oficial (seções 8–14) |
| 2 | `DIAGNOSTICO_FLUXO_FINANCEIRO_ATUAL.md` | Incorporado à oficial (seção 18) |
| 3 | `HOMOLOGACAO_TECNICA_FLUXO_FINANCEIRO.md` | Incorporado à oficial (evidência técnica) |
| 4 | `HOMOLOGACAO_SIMPLIFICACAO_FINANCEIRO.md` | Incorporado à oficial (evidência técnica) |
| 5 | `EDITOR_HANDOFF.md` | Incorporado à oficial (seções 1–4, 17) |
| 6 | `docs/DOCUMENTACAO_COMPLETA_SISTEMA.md` | Desatualizado, regras substituídas |
| 7 | `docs/DOCUMENTACAO_IMPLEMENTACAO_01_08_2026.md` | Desatualizado (15→30 RPCs, vazias→com dados) |
| 8 | `docs/ESTRUTURA_REAL_SUPABASE.md` | Parcialmente desatualizado |
| 9 | `docs/Baixar documentação consolidada.md` | Duplicata exata |
| 10 | `docs/MCP_FORMS_CONFIG.md` | Configuração de outro projeto |
| 11 | `docs/ANALISE_CADASTRO_PRECEPTORES_INTERNATO.md` | Incorporado à oficial (completude, visibilidade, duplicidade, badge) |
| 12 | `docs/DOCUMENTACAO_VIVA_PLANILHAS_PRECEPTORIA.md` | Incorporado à oficial (visão geral do sistema, stack, arquitetura) |

### Arquivos Preservados (3 + 1 inventário)

| # | Arquivo | Motivo |
|---|---------|--------|
| 1 | `AGENTS.md` | Instruções obrigatórias para agentes — regras ativas |
| 2 | `README.md` | Documentação pública do projeto |
| 3 | `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` | **Fonte oficial única** (v1.1) |

### Arquivo de Referência (1)

| # | Arquivo | Motivo |
|---|---------|--------|
| 1 | `INVENTARIO_DOCUMENTACAO_ANTIGA.md` | Inventário histórico desta limpeza |

### Arquivos Não Excluídos por Segurança (0)

Nenhum arquivo pendente de análise manual.

### Referências Atualizadas (1)

| Arquivo | Referência antiga | Referência nova |
|---------|-------------------|-----------------|
| `README.md` | `docs/DOCUMENTACAO_COMPLETA_SISTEMA.md` | `DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md` |

### Lista Final das Documentações Restantes

```
./
├── AGENTS.md                                    (preservado)
├── README.md                                    (preservado)
├── DOCUMENTACAO_OFICIAL_SISTEMA_PRECEPTORIA.md  (fonte oficial única — v1.1)
└── INVENTARIO_DOCUMENTACAO_ANTIGA.md            (este arquivo — inventário de referência)
```

### Confirmação

**Nenhuma funcionalidade foi alterada.** Apenas documentação markdown foi excluída. Código, banco, dados, migrations, RPCs, RLS, telas e automações permanecem intocados.
