# Registro de Alterações - Projeto PI Mercadins

**Período:** 27 de agosto de 2026
**Responsável:** IA (opencode)

---

## 1. Bloqueio de Emojis nos Inputs

**Commit:** `ae84a22`

### O que foi feito
Criada uma função utilitária `removeEmojis()` que filtra caracteres emoji usando regex e a aplicamos em todos os campos de input controlados do frontend.

### Arquivos criados
- `Frontend/src/hooks/useBlockEmojis.ts` — Exporta a função `removeEmojis()`

### Arquivos modificados (22 arquivos)

**Páginas:**
| Arquivo | Campos protegidos |
|---------|------------------|
| `Login.tsx` | Input de email |
| `Register.tsx` | Nome, email, telefone, CPF |
| `PerfilUsuario.tsx` | Nova senha, confirmar senha, email |
| `PerfilVendedor.tsx` | Nova senha, confirmar senha, email |
| `RedefinirSenha.tsx` | Campos de senha |
| `RegistrarMercado.tsx` | Nome, email, estado, cidade, bairro, rua |
| `GerenciamentoMercado.tsx` | Nome e descrição (modal de edição) |
| `Cart.tsx` | Input de cupom |
| `Vitrine.tsx` | Busca e edição inline de categoria |
| `VitrineCliente.tsx` | Input de busca |

**Componentes:**
| Arquivo | Campos protegidos |
|---------|------------------|
| `CadastroProduto.tsx` | Nome e descrição do produto |
| `CriarCategoria.tsx` | Nome da categoria |
| `EditarMercado.tsx` | Nome e descrição do mercado |
| `EsqueciSenhaModal.tsx` | Input de email |
| `ModalEditarPerfil.tsx` | Nome, email, telefone |
| `AdicionarMercadoFavorito.tsx` | Busca de mercado |

### Por quê
Impedir que usuários insiram caracteres de emoji em campos de texto, garantindo integridade dos dados no banco de dados.

---

## 2. Segurança no Backend

**Commit:** `ae84a22`

### O que foi feito
Reescrita completa da configuração de segurança no `Backend/src/server.js`.

### Proteções adicionadas

| Proteção | Descrição |
|----------|-----------|
| **HTTPS redirect** | Redireciona HTTP → HTTPS em produção via header `x-forwarded-proto` |
| **Security headers** | HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-XSS-Protection: 1; mode=block, Referrer-Policy, Permissions-Policy |
| **CORS restrito** | Em produção: só aceita origins com protocolo HTTPS. `localhost` permitido apenas em desenvolvimento |
| **404 para rotas API** | Rotas `/api/*` não encontradas retornam JSON com mensagem clara |
| **Error handler** | Captura erros CORS (403), erros de parsing JSON (400) e erros internos (500) |
| **Health check** | Endpoint `GET /api/health` para monitoramento |
| **Cache de uploads** | `maxAge: 1d` e `immutable` para arquivos estáticos |

---

## 3. Correção de TypeScript

**Commit:** `281cfaf`

### O que foi feito
Adicionada propriedade `files: File[]` na interface `ProdutoForm` em `Vitrine.tsx`, que estava faltando e causava erro de compilação.

---

## 4. Limpeza de Warnings (Dynamic Imports)

**Commits:** `7fd12fe`, `a1a483d`

### O que foi feito
Removidos 5 `await import('../../services/api')` redundantes em 3 arquivos que já tinham import estático do `api`. Também adicionado o import faltante no `ModalEditarPerfil.tsx`.

| Arquivo | Imports removidos |
|---------|------------------|
| `PerfilUsuario.tsx` | 2 dynamic imports |
| `PerfilVendedor.tsx` | 2 dynamic imports |
| `ModalEditarPerfil.tsx` | 1 dynamic import + 1 import estático adicionado |

### Por quê
O Vite gerava warning `INEFFECTIVE_DYNAMIC_IMPORT` porque o módulo já era importado estaticamente. Dynamic imports só são úteis quando o módulo não está importado de outra forma.

---

## 5. Exibição de CPF no Modal de Edição de Perfil

**Commit:** `be8c2c5`

### O que foi feito
- **Backend** (`authController.js`): Adicionado campo `cpf` no SELECT de login e no endpoint `getPerfil`
- **Frontend** (`AuthContext.tsx`): Adicionado `cpf?: string` na interface `Usuario`
- **Modal** (`ModalEditarPerfil.tsx`):
  - CPF exibido como campo **read-only** formatado (000.000.000-00)
  - Email alterado para **read-only**
  - Ambos com hint "não pode ser alterado"
  - Inputs configurados com `placeholder`, `maxLength`, `autoComplete`, `type` corretos

---

## 6. SPA Routing (Correção de "Not Found")

**Commits:** `ae84a22` → `586003e`

### O problema
Ao dar refresh em rotas como `/vendedor`, `/auth/register`, `/vitrine/slug`, o servidor retornava 404 porque não sabia servir o `index.html` para essas rotas.

### O que foi tentado
1. `vercel.json` com rewrites (não funcionou — deploy era no Render, não Vercel)
2. `_redirects` file (não funcionou — Render não suporta como Netlify)
3. **Solução final:** Rewrite rule no **Render Dashboard**

### Solução final
Configuração direta no painel do Render:
- **Source:** `/*`
- **Destination:** `/index.html`
- **Action:** Rewrite

Isso faz o Render servir `index.html` para todas as rotas, permitindo que o React Router faça o roteamento no client.

---

## 7. Correção de Rotas - Vendedor Sobrescrevendo Todas

**Commits:** `7694671`, `6225e2a`

### O problema
Quando o vendedor tinha `mercadoAberto` e `vitrineAberta` salvos no localStorage, o componente `Rotas` renderizava a Vitrine/Gerenciamento do vendedor **diretamente**, ignorando completamente o `<Routes>` do React Router. Isso fazia com que:
- `/auth` mostrava o dashboard do vendedor
- `/perfil` mostrava o dashboard
- `/vitrine/slug` (client) mostrava a vitrine do vendedor

### A solução
Adicionada verificação da URL atual com `useLocation()`. O override do `mercadoAberto` só é aplicado quando o usuário está na rota `/vendedor`:

```tsx
const isRotaVendedor = location.pathname === '/vendedor'

if (isRotaVendedor && usuario && mercadoAberto && vitrineAberta) {
  return <Vitrine ... />
}
if (isRotaVendedor && usuario && mercadoAberto) {
  return <GerenciamentoMercado ... />
}
```

---

## 8. Botão "Leia Mais" na Descrição do Mercado

**Commit:** `cff5a5f`

### O que foi feito
- **Novo componente:** `DescricaoModal.tsx` — Modal reutilizável para exibir descrição completa
- **Vitrine.tsx** e **VitrineCliente.tsx:**
  - Descrição truncada em 100 caracteres com `...`
  - Botão "Leia mais" que abre modal com a descrição completa
  - Botão estilizado com cor do tema (`var(--vt-cor-icones)`)

### Comportamento
| Descrição | Comportamento |
|-----------|--------------|
| Até 100 caracteres | Mostra completa, sem botão |
| Mais de 100 caracteres | Trunca + botão "Leia mais" |

---

## 9. Segurança - Middleware de Auth nas Rotas

**Commit:** `0ddd7d9`

### O problema
A autenticação era feita apenas dentro dos controllers (`pegarIdUsuario()`). Se um desenvolvedor esquecesse de chamar essa função numa rota nova, ela ficaria completamente aberta.

### A solução
Adicionado middleware `autenticar` (importado de `authMiddleware.js`) diretamente nas rotas de escrita:

| Rota | Antes | Agora |
|------|-------|-------|
| `POST /api/mercados` | Sem middleware | `autenticar` middleware |
| `PUT /api/mercados/:id` | Só controller | `autenticar` + controller |
| `DELETE /api/mercados/:id` | Só controller | `autenticar` + controller |
| `GET /api/mercados/meus` | Só controller | `autenticar` + controller |
| `GET /api/mercados/:id/dashboard` | Só controller | `autenticar` + controller |
| `POST/PUT/DELETE categorias` | Só controller | `autenticar` + controller |
| `POST/PUT/DELETE produtos` | Só controller | `autenticar` + controller |
| `GET favoritos/avaliacoes/historico` | Só controller | `autenticar` + controller |

Agora a proteção é em **duas camadas** (belt and suspenders).

---

## 10. Rate Limiting nas Rotas de Auth

**Commit:** `0ddd7d9`

### O que foi criado
Novo middleware: `Backend/src/middleware/rateLimiter.js`

Implementação em memória com limpeza automática:
- Armazena contagem de requisições por IP + rota
- Janela de tempo configurável
- Limpeza automática de registros antigos a cada 10 minutos

### Limites aplicados

| Rota | Limite | Janela |
|------|--------|--------|
| `POST /register` | 5 req | 15 min |
| `POST /login` | 10 req | 15 min |
| `POST /esqueci-senha` | 3 req | 15 min |
| `POST /verificar-email` | 5 req | 15 min |
| `POST /redefinir-senha` | 5 req | 15 min |
| `POST /trocar-senha` | 5 req | 15 min |
| `POST /confirmar-troca-senha` | 5 req | 15 min |

### Resposta quando excedido
```json
{
  "erro": "Muitas tentativas. Tente novamente em X segundos."
}
```

### Por quê
Proteger contra ataques de brute force e credential stuffing nos endpoints de autenticação.

---

## 11. Fix de Email Leak na Recuperação de Senha

**Commit:** `0ddd7d9`

### O problema
O endpoint `POST /api/auth/esqueci-senha` retornava:
- **404** "Usuário não encontrado" → se o email não existia
- **200** "Email de recuperação enviado" → se o email existia

Isso permitia que um atacante descobrisse quais emails estão cadastrados no sistema.

### A solução
Agora o endpoint **sempre retorna a mesma mensagem**, independente de o email existir ou não:

```json
{
  "mensagem": "Se o email estiver cadastrado, você receberá um código de recuperação."
}
```

---

## Resumo dos Commits

| Commit | Descrição |
|--------|-----------|
| `ae84a22` | Bloquear emojis nos inputs + correção SPA routing e segurança |
| `281cfaf` | Adicionar propriedade files na interface ProdutoForm |
| `7fd12fe` | Remover dynamic imports redundantes do api.ts |
| `a1a483d` | Adicionar import estático de api no ModalEditarPerfil |
| `be8c2c5` | Exibir CPF no modal de edição de perfil (read-only) |
| `586003e` | Usar _redirects para SPA routing no Render.com |
| `6225e2a` | Override mercadoAberto só aplica na rota /vendedor |
| `cff5a5f` | Botão "Leia mais" na descrição do mercado com modal |
| `0ddd7d9` | Segurança: middleware auth, rate limiting, fixar leak de email |

---

## Arquivos Criados (esta sessão)

| Arquivo | Descrição |
|---------|-----------|
| `Frontend/src/hooks/useBlockEmojis.ts` | Função removeEmojis() |
| `Frontend/src/components/DescricaoModal.tsx` | Modal de descrição completa |
| `Backend/src/middleware/rateLimiter.js` | Middleware de rate limiting |

## Arquivos Modificados (esta sessão)

| Arquivo | Commits |
|---------|---------|
| `Backend/src/server.js` | `ae84a22` |
| `Backend/src/controllers/authController.js` | `be8c2c5`, `0ddd7d9` |
| `Backend/src/routes/marketRoutes.js` | `0ddd7d9` |
| `Backend/src/routes/categoriaRoutes.js` | `0ddd7d9` |
| `Backend/src/routes/produtoRoutes.js` | `0ddd7d9` |
| `Backend/src/routes/usuarioRoutes.js` | `0ddd7d9` |
| `Backend/src/routes/authRoutes.js` | `0ddd7d9` |
| `Frontend/src/App.tsx` | `7694671`, `6225e2a` |
| `Frontend/src/context/AuthContext.tsx` | `be8c2c5` |
| `Frontend/src/pages/Vitrine/Vitrine.tsx` | `281cfaf`, `cff5a5f` |
| `Frontend/src/pages/Vitrine/Vitrine.css` | `cff5a5f` |
| `Frontend/src/pages/VitrineCliente/VitrineCliente.tsx` | `cff5a5f` |
| `Frontend/src/pages/VitrineCliente/VitrineCliente.css` | `cff5a5f` |
| `Frontend/src/components/ModalEditarPerfil.tsx` | `a1a483d`, `be8c2c5` |
| `Frontend/src/components/CadastroProduto.tsx` | `ae84a22` |
| `Frontend/src/components/CriarCategoria.tsx` | `ae84a22` |
| `Frontend/src/components/EditarMercado.tsx` | `ae84a22` |
| `Frontend/src/components/EsqueciSenhaModal.tsx` | `ae84a22` |
| `Frontend/src/components/AdicionarMercadoFavorito.tsx` | `ae84a22` |
| `Frontend/src/pages/Login/Login.tsx` | `ae84a22` |
| `Frontend/src/pages/Register/Register.tsx` | `ae84a22` |
| `Frontend/src/pages/PerfilUsuario/PerfilUsuario.tsx` | `ae84a22`, `7fd12fe` |
| `Frontend/src/pages/PerfilVendedor/PerfilVendedor.tsx` | `ae84a22`, `7fd12fe` |
| `Frontend/src/pages/RedefinirSenha/RedefinirSenha.tsx` | `ae84a22` |
| `Frontend/src/pages/RegistrarMercado/RegistrarMercado.tsx` | `ae84a22` |
| `Frontend/src/pages/GerenciamentoMercado/GerenciamentoMercado.tsx` | `ae84a22` |
| `Frontend/src/pages/Carrrinho/Cart.tsx` | `ae84a22` |
