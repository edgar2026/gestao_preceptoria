# Sistema de Gestão de Preceptoria

Sistema completo para gerenciamento de preceptores acadêmicos do curso de Medicina da UNINASSAU. Substitui planilhas manuais por plataforma digital com banco de dados, regras financeiras, registro de presença, auditoria e operação administrativa.

## 🚀 Funcionalidades

### Cadastros
- **Preceptores:** Dados pessoais, vínculos Prática e Internato
- **Favorecidos:** Empresas e dados fiscais
- **Estrutura Acadêmica:** IES, cursos, semestres, períodos, disciplinas, internatos
- **Locais e Setores:** Hospitais, clínicas, UBS, setores

### Operação
- **Escalas:** Dias da semana, turnos, horários, vigências
- **Presenças:** Registro via mobile e token individual
- **Ajustes:** Inclusões, correções e cancelamentos

### Financeiro
- **Regras:** Por turno, hora, grupo, mensal fixo, rateio, adicional
- **Cálculos:** Memória de cálculo detalhada
- **Competências:** Abertura, cálculo, conferência, fechamento
- **Saldos e Pagamentos:** Autorizações e processos

### Governança
- **Auditoria:** Log completo de todas as operações
- **Configurações:** Parâmetros gerais do sistema
- **Usuários:** Gerenciamento de papéis e permissões

## 📱 Rotas

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Painel administrativo | Autenticado |
| `/login` | Tela de login | Público |
| `/preceptor/presenca` | Registro mobile | Público |
| `/p/:token` | Acesso individual por token | Token válido |

## 🛠️ Tecnologias

- **Frontend:** React + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Estilo:** CSS personalizado com design system premium
- **Ícones:** Lucide React

## 📦 Instalação

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

## ⚙️ Configuração do Supabase

1. Criar projeto no Supabase
2. Executar migrações em ordem no SQL Editor:
   - `001_schema_completo.sql`
   - `002_acesso_presenca_preceptor.sql`
   - `003_integridade_e_consistencia.sql`
   - `004_auth_setup.sql`
   - `005_seed_inicial.sql`
   - `006_role_admin_super.sql`
   - `007_super_admin_role.sql`
   - `007a_add_super_admin_enum.sql`
   - `007b_assign_roles.sql`
   - `008_rls_auditoria_gestao_usuarios.sql`
   - `008a_self_role_guard.sql`
3. Criar primeiro usuário no Supabase Auth
4. Atribuir role `super_admin` via SQL

## 📊 Estrutura do Banco

- **35+ tabelas** com RLS habilitado
- **15+ enums** para tipos e status
- **10+ funções de negócio** (RPCs)
- **20+ triggers** de auditoria e updated_at
- **30+ índices** de performance
- **Seed inicial:** Medicina UNINASSAU com dados completos

## 🔒 Segurança

- **Autenticação:** JWT com Supabase Auth
- **Autorização:** RLS em todas as tabelas
- **Token de Presença:** Hash SHA-256, único por preceptor
- **Auditoria:** Log completo de operações
- **Proteção:** Impede auto-elevação de roles

## 📚 Documentação

- `docs/DOCUMENTACAO_COMPLETA_SISTEMA.md` - Documentação técnica completa
- `docs/DOCUMENTACAO_VIVA_PLANILHAS_PRECEPTORIA.md` - Levantamento de requisitos
- `AGENTS.md` - Instruções para agentes de desenvolvimento

## 🎯 Seed Inicial

O sistema inclui dados iniciais para o curso de Medicina da UNINASSAU:
- IES, curso, semestre 2026.1
- 12 períodos, 60+ disciplinas, 8 internatos
- 10 locais com setores
- 9 feriados nacionais de 2026

## 📈 Status

✅ Sistema em operação com funcionalidades core implementadas  
✅ Interface administrativa desktop-first  
✅ Interface mobile para preceptores  
✅ Registro de presença via token seguro  
✅ Gestão financeira completa  
✅ Auditoria e conformidade
