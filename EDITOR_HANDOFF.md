# Handoff para o Editor

Este pacote contém o Sistema de Gestão de Preceptoria completo e funcional.

## 📍 Rotas Principais

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Painel administrativo desktop-first | Autenticado |
| `/preceptor/presenca` | Registro mobile dos preceptores | Público |
| `/p/:token` | Acesso individual por token | Token válido |
| `/login` | Tela de login | Público |
| `/recuperar-senha` | Recuperação de senha | Público |
| `/redefinir-senha` | Redefinição de senha | Token válido |

## 🏗️ Arquitetura

- **Frontend:** React + Vite (SPA)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Estilo:** CSS personalizado com design system azul-escuro e dourado
- **Banco:** 35+ tabelas com RLS, 10+ funções de negócio

## 📋 Módulos do Painel Administrativo

### Operação
- Preceptores Prática (disciplinas, períodos)
- Preceptores do Internato (internatos, locais)
- Escalas (dias, turnos, vigências)
- Presenças (registros e validação)
- Ajustes de presença (inclusões, correções)

### Financeiro
- Regras financeiras (por turno, hora, grupo, fixo, rateio)
- Fechamentos (competências)
- Memória de cálculo
- Validações
- Saldos autorizados
- Processos e movimentos
- Pagamentos

### Governança
- Auditoria (logs completos)
- Configurações (parâmetros gerais)
- Gerenciar Usuários (super_admin)

### Cadastros
- Favorecidos e empresas
- Estrutura acadêmica (IES, cursos, disciplinas, internatos)
- Locais e setores

## 🔐 Segurança

- **Autenticação:** JWT via Supabase Auth
- **Autorização:** RLS em todas as tabelas
- **Token de Presença:** Hash SHA-256, único por preceptor
- **Auditoria:** Trigger automático em 17+ tabelas
- **Proteção:** Impede auto-elevação de roles

## 📱 Funcionalidades Mobile

### Rota /preceptor/presenca
- Lista de preceptores ativos
- Busca por nome
- Seleção de turnos (Manhã/Tarde/Noite)
- Registro via RPC `registrar_presenca`
- Apenas data atual

### Rota /p/:token (Acesso Individual)
- Token seguro de 64 caracteres
- Validação automática
- Exibição "Olá, [nome]"
- Escalas do dia automaticamente
- Seleção de turno
- Registro via RPC `registrar_presenca_token`

## 🗄️ Banco de Dados

### Tabelas Principais (35+)
- profiles, user_roles, preceptores, vinculos_pratica, vinculos_internato
- escalas, presencas, ajustes_presenca
- regras_financeiras, competencias, calculos, calculo_itens
- favorecidos, locais, setores, disciplinas, internatos
- preceptor_acesso_presenca (tokens)
- audit_logs, configuracoes, notificacoes

### Funções de Negócio (10+)
- registrar_presenca / registrar_presenca_token
- recalcular_competencia
- gerar_acesso_presenca / renovar_acesso_preceptor
- bloquear_acesso_preceptor / revogar_acesso_preceptor
- validar_acesso_token / buscar_escalas_token
- listar_usuarios_staff / atualizar_usuario_staff

## 🎨 Design

- **Cores:** Azul-escuro (#1e293b) e dourado (#d4af37)
- **Layout:** Sidebar fixa + conteúdo principal
- **Responsivo:** Desktop-first para admin, mobile-first para preceptores
- **Ícones:** Lucide React

## ⚠️ Regras Obrigatórias

1. **Não simplificar nem remover telas do menu**
2. **Não separar a rota mobile em outro projeto**
3. **Não usar planilhas como banco operacional**
4. **Manter azul-escuro e dourado**
5. **A presença deve chamar a RPC `registrar_presenca` ou `registrar_presenca_token`**
6. **Ler `AGENTS.md` e a documentação em `docs/`**
7. **Preservar RLS, auditoria, vigências e memória de cálculo**
8. **Rota do preceptor continua mobile-first e exibe apenas presença**
9. **Painel administrativo é desktop-first**
10. **Preceptor Prática e Internato são vínculos diferentes do mesmo cadastro**

## 🚀 Execução

```bash
npm install
cp .env.example .env
# Configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## 📚 Documentação

- `docs/DOCUMENTACAO_COMPLETA_SISTEMA.md` - Documentação técnica completa
- `docs/DOCUMENTACAO_VIVA_PLANILHAS_PRECEPTORIA.md` - Levantamento de requisitos
- `AGENTS.md` - Instruções para agentes de desenvolvimento
