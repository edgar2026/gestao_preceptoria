# Documentação da Implementação — 01/08/2026 (atualizado)

## O que foi feito

### 1. Levantamento completo do banco real

Consultei diretamente o Supabase remoto via REST API e confirmei:

- **37 tabelas** existem, todas vazias (0 registros)
- **16 enums** funcionais
- **2 views** (`v_saldos_disponiveis`, `v_preceptores_ativos`)
- **15 funções/RPCs** definidas no SQL mas **AUSENTES do banco remoto** (apenas tabelas e enums foram aplicadas corretamente)
- **3 migrações** já aplicadas parcialmente (001, 002, 003) — tabelas existem, funções/triggers/RLS/grants **não**

Resultado salvo em: `docs/ESTRUTURA_REAL_SUPABASE.md`

---

### 2. Service layer criado

**Arquivo:** `src/services/queries.js` (429 linhas)

Funções de consulta e escrita para cada tabela.

---

### 3. Fluxo de autenticação completo

**Arquivos modificados/criados:**

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/main.jsx` | Modificado | Dispatcher de rotas: /login, /recuperar-senha, /redefinir-senha, /preceptor/presenca, /p/:token |
| `src/App.jsx` | Modificado | LoginScreen com "Esqueci minha senha?", proteção de rotas, logout |
| `src/components/RecuperarSenha.jsx` | Novo | Tela de recuperação de senha via Supabase Auth |
| `src/components/RedefinirSenha.jsx` | Novo | Tela de redefinição com validação em tempo real |
| `src/styles.css` | Modificado | Estilos para telas de auth, validação de senha, logout |

#### 3.1 Tela de Login (`/login`)

- Logo do sistema
- Campo E-mail (com validação)
- Campo Senha
- Botão "Entrar"
- Link "Esqueci minha senha?" → /recuperar-senha
- **Sem** botão "Criar conta" ou "Cadastrar-se"
- **Sem** uso de `signUp` no frontend
- Mensagens de erro específicas:
  - "Informe seu e-mail."
  - "Informe sua senha."
  - "Credenciais incorretas. Verifique seu e-mail e senha."
  - "E-mail não confirmado. Verifique sua caixa de entrada."
  - "Não foi possível realizar o login. Tente novamente."

#### 3.2 Tela de Recuperação de Senha (`/recuperar-senha`)

- Logo do sistema
- Campo de e-mail
- Botão "Enviar link de recuperação"
- Botão "Voltar ao login"
- Usa `supabase.auth.resetPasswordForEmail()` com `redirectTo` para `/redefinir-senha`
- Após envio, mostra mensagem neutra: "Se o e-mail estiver cadastrado, você receberá um link..."
- **Não revela** se o e-mail existe ou não

#### 3.3 Tela de Redefinição de Senha (`/redefinir-senha`)

- Valida sessão de recuperação via `onAuthStateChange` (evento `PASSWORD_RECOVERY`)
- Se sessão inválida/expirada: mostra erro com link para nova recuperação
- Campos: Nova Senha, Confirmar Nova Senha
- **Validação em tempo real** com indicadores visuais:
  - Mínimo de 8 caracteres
  - Uma letra maiúscula
  - Uma letra minúscula
  - Um número
  - Um caractere especial (!@#$%^&*)
  - Cada requisito muda visualmente (verde) quando atendido
- Indicador de coincidência de senhas
- Botão "Salvar" habilitado **somente** quando todos os requisitos são atendidos e senhas coincidem
- Usa `supabase.auth.updateUser({ password })`
- Após redefinição: encerra sessão, mostra confirmação, direciona ao login
- Toggle de visibilidade da senha (olho)

#### 3.4 Proteção de Rotas

| Rota | Acesso | Componente |
|------|--------|------------|
| `/login` | Público | App (forceLogin) |
| `/recuperar-senha` | Público | RecuperarSenha |
| `/redefinir-senha` | Público (requer sessão de recovery) | RedefinirSenha |
| `/preceptor/presenca` | Público (mobile) | RegistroPresencaMobile |
| `/p/:token` | Público (token) | RegistroPresencaToken |
| `/*` (demais) | Autenticado | App (admin panel) |

- Usuário sem sessão em rotas admin → redirecionado para `/login`
- Rotas de presença por token continuam acessíveis sem login administrativo
- Botão de logout no sidebar (ícone de sair)

#### 3.5 CSS de Autenticação

Estilos preservando identidade azul-marinho e dourada:

- `.auth-card` — Card responsivo para telas de auth
- `.auth-forgot-link` — Link "Esqueci minha senha?"
- `.auth-back-link` — Link "Voltar ao login"
- `.auth-success-icon` / `.auth-error-icon` — Ícones de estado
- `.pw-input-wrap` / `.pw-toggle` — Campo de senha com toggle de visibilidade
- `.pw-rules` / `.pw-rule` — Lista de requisitos de senha
- `.pw-rule-ok` — Requisito atendido (verde)
- `.pw-match` — Indicador de coincidência de senhas
- `.user-logout` — Botão de logout no sidebar
- Responsivo: funciona em mobile e desktop

---

### 4. Migrations criadas

#### Migration 004: Recuperação de funções, triggers, RLS e grants

**Arquivo:** `supabase/migrations/004_auth_setup.sql` (792 linhas)

- Todas as 15 funções com `SECURITY DEFINER` correto
- Triggers `handle_new_auth_user`, `audit_row_change`, `set_updated_at`
- RLS habilitado em 37 tabelas com 35+ políticas
- GRANTs para `authenticated` e `anon`
- 15+ índices de performance
- Configurações iniciais do sistema

#### Migration 005: Seed inicial Medicina UNINASSAU

**Arquivo:** `supabase/migrations/005_seed_inicial.sql` (350+ linhas)

- IES: UNINASSAU
- Curso: Medicina
- Semestre: 2026.1
- 12 períodos, ~50 disciplinas, 8 internatos
- 10 locais, ~50 setores em Recife/PE
- 9 feriados nacionais 2026

---

### 5. Configuração de URLs no Supabase Auth

**Obrigatório:** Configurar URLs de redirecionamento no Supabase Dashboard:

1. Acesse **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Adicione as seguintes URLs:

| Ambiente | URL |
|----------|-----|
| **Site URL** | `https://seu-dominio.com` (produção) ou `http://localhost:5173` (desenvolvimento) |
| **Redirect URLs** | `http://localhost:5173/redefinir-senha` |
| | `https://seu-dominio.com/redefinir-senha` |

> **IMPORTANTE:** O Supabase usa URLs hash para recuperação de senha. O link gerado será algo como:
> `https://seu-dominio.com/redefinir-senha#access_token=...&type=recovery`
>
> O Supabase redireciona para a URL configurada + hash com os tokens.

---

## Como testar

### Passo 1: Aplicar migrations 004 e 005

No SQL Editor do Supabase:
1. Execute `004_auth_setup.sql`
2. Execute `005_seed_inicial.sql`

### Passo 2: Criar usuário admin

No Dashboard → Authentication → Users → Add User:
- Email: `admin@medicina-uninassau.edu.br`
- Defina uma senha

### Passo 3: Atribuir papel administrador

```sql
INSERT INTO public.user_roles (profile_id, role)
SELECT p.id, 'administrador'::public.app_role
FROM public.profiles p
WHERE lower(p.email) = lower('admin@medicina-uninassau.edu.br')
ON CONFLICT (profile_id, role) DO UPDATE SET ativo = true;
```

### Passo 4: Configurar URLs no Supabase Auth

Adicione `http://localhost:5173/redefinir-senha` em Redirect URLs.

### Passo 5: Rodar e testar

```bash
npm run dev
```

### Checklist de teste de autenticação

| # | Teste | Esperado |
|---|-------|----------|
| 1 | Acessar `/` sem sessão | Redireciona para `/login` |
| 2 | Login com credenciais corretas | Entra no painel admin |
| 3 | Login com credenciais incorretas | "Credenciais incorretas" |
| 4 | Login com campo e-mail vazio | "Informe seu e-mail" |
| 5 | Login com campo senha vazio | "Informe sua senha" |
| 6 | Clicar "Esqueci minha senha?" | Navega para `/recuperar-senha` |
| 7 | `/recuperar-senha` com e-mail válido | Mensagem de confirmação |
| 8 | `/recuperar-senha` com e-mail inválido | Mensagem neutra (não revela) |
| 9 | `/recuperar-senha` com campo vazio | "Informe seu e-mail" |
| 10 | `/recuperar-senha` com e-mail malformado | "E-mail inválido" |
| 11 | Clicar link de recuperação no e-mail | Abre `/redefinir-senha` com sessão |
| 12 | `/redefinir-senha` com link expirado | "Link inválido ou expirado" |
| 13 | `/redefinir-senha` com link válido | Mostra formulário de nova senha |
| 14 | Digitar senha fraca | Regras mostram em vermelho |
| 15 | Digitar senha forte (todas regras) | Regras ficam verdes |
| 16 | Senhas diferentes | "Senhas não coincidem" + botão desabilitado |
| 17 | Senhas iguais + regras atendidas | Botão "Salvar" habilitado |
| 18 | Salvar nova senha | "Senha redefinida" + direciona ao login |
| 19 | Acessar `/redefinir-senha` sem sessão | "Link inválido" |
| 20 | Botão logout no sidebar | Sai do sistema, volta para `/login` |
| 21 | Acessar `/preceptor/presenca` | Funciona sem login |
| 22 | Acessar `/p/TOKEN` | Funciona sem login |

---

## Arquivos alterados

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `src/main.jsx` | **Modificado** | 30 |
| `src/App.jsx` | **Modificado** (+login, logout, proteção) | 670 |
| `src/components/RecuperarSenha.jsx` | **Novo** | 95 |
| `src/components/RedefinirSenha.jsx` | **Novo** | 155 |
| `src/styles.css` | **Modificado** (+auth CSS) | 870 |
| `supabase/migrations/004_auth_setup.sql` | Criado anteriormente | 792 |
| `supabase/migrations/005_seed_inicial.sql` | Criado anteriormente | 350 |

## URLs para configurar no Supabase Auth

Acesse **Supabase Dashboard → Authentication → URL Configuration** e adicione:

**Redirect URLs:**
```
http://localhost:5173/redefinir-senha
https://seu-dominio.com/redefinir-senha
```

**Site URL:**
```
http://localhost:5173 (desenvolvimento)
https://seu-dominio.com (produção)
```

## Pendências

| Pendência | Prioridade | Descrição |
|-----------|-----------|-----------|
| Aplicar migrations 004 e 005 | **CRÍTICA** | Executar no SQL Editor |
| Criar usuário admin | **CRÍTICA** | Via Dashboard Authentication |
| Configurar URLs Supabase Auth | **CRÍTICA** | Adicionar redirect URLs |
| Forms financeiros | **MÉDIA** | Regras, fechamentos usam form genérico |
| Paginação | **BAIXA** | Limitado a 200 registros |
| Busca server-side | **BAIXA** | Filtro é client-side |
