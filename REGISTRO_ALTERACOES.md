# Registro de Alterações — Projeto PI Mercadins

**Data:** 05 de setembro de 2026
**Responsável:** IA Assistente (opencode) + JoseArthurCamiloDosAnjos
**Modelo:** mimo-v2.5-free

---

## Sumário Executivo

Esta sessão de desenvolvimento abrangeu **19 categorias de trabalho** com **13 commits** ao repositório, resultando em:

- **6 arquivos novos** criados
- **3 arquivos** deletados
- **48 arquivos** modificados
- **~1.400 linhas** de código adicionadas
- **~530 linhas** removidas

As alterações cobrem: segurança do backend, migração para Supabase Storage, melhorias de UX, lazy loading, validação de dados, limpeza de código e proteção contra vulnerabilidades.

---

## Índice

1. [Bloqueio de Emojis nos Inputs](#1-bloqueio-de-emojis-nos-inputs)
2. [Segurança no Backend](#2-segurança-no-backend)
3. [Correção de TypeScript](#3-correção-de-typescript)
4. [Limpeza de Warnings (Dynamic Imports)](#4-limpeza-de-warnings-dynamic-imports)
5. [Exibição de CPF no Modal de Edição de Perfil](#5-exibição-de-cpf-no-modal-de-edição-de-perfil)
6. [SPA Routing — Correção de "Not Found"](#6-spa-routing--correção-de-not-found)
7. [Correção de Rotas — Vendedor Sobrescrevendo Todas](#7-correção-de-rotas--vendedor-sobrescrevendo-todas)
8. [Botão "Leia Mais" na Descrição do Mercado](#8-botão-leia-mais-na-descrição-do-mercado)
9. [Segurança — Middleware de Auth nas Rotas](#9-segurança--middleware-de-auth-nas-rotas)
10. [Rate Limiting nas Rotas de Auth](#10-rate-limiting-nas-rotas-de-auth)
11. [Fix de Email Leak na Recuperação de Senha](#11-fix-de-email-leak-na-recuperação-de-senha)
12. [Botão "Criar Mercado" Condicional na Sidebar](#12-botão-criar-mercado-condicional-na-sidebar)
13. [Migração de Uploads para Supabase Storage](#13-migração-de-uploads-para-supabase-storage)
14. [Campo Data de Nascimento no Cadastro](#14-campo-data-de-nascimento-no-cadastro)
15. [Página de Verificação de Email por Código](#15-página-de-verificação-de-email-por-código)
16. [Validação de Senha Atual na Troca de Senha](#16-validação-de-senha-atual-na-troca-de-senha)
17. [Lazy Loading nas Rotas (Code Splitting)](#17-lazy-loading-nas-rotas-code-splitting)
18. [Scroll Suave na Landing Page](#18-scroll-suave-na-landing-page)
19. [Limpeza de Código e Correções](#19-limpeza-de-código-e-correções)

---

## 1. Bloqueio de Emojis nos Inputs

**Commit:** `ae84a22`
**Tipo:** Funcionalidade / Segurança de dados
**Arquivos afetados:** 23 (1 criado + 22 modificados)

### Contexto

Em aplicações web que lidam com dados de texto (nomes, emails, descrições), a inserção de caracteres de emoji pode causar diversos problemas:

- **Banco de dados:** Alguns bancos (incluindo PostgreSQL com encoding padrão) podem ter dificuldades com caracteres Unicode de 4 bytes (emojis)
- **APIs externas:** Serviços de envio de email, SMS ou integração podem rejeitar ou corromper mensagens com emojis
- **Exibição:** Em algunos contextos (PDFs, relatórios, APIs legadas), emojis podem quebrar a formatação
- **Segurança:** Emojis podem ser usados para bypass de filtros de conteúdo

### Solução Implementada

Criado um hook personalizado `useBlockEmojis.ts` que exporta uma função `removeEmojis()`:

```typescript
// Frontend/src/hooks/useBlockEmojis.ts
export function removeEmojis(texto: string): string {
  // Remove todos os caracteres de emoji usando regex Unicode
  return texto.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '');
}
```

### Como foi aplicado

A função `removeEmojis()` foi integrada no `onChange` de cada campo de input controlado:

**Antes:**
```tsx
<input onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
```

**Depois:**
```tsx
<input onChange={e => setForm(f => ({ ...f, nome: removeEmojis(e.target.value) }))} />
```

### Campos protegidos por página/componente

| Arquivo | Campos protegidos | Justificativa |
|---------|------------------|---------------|
| `Login.tsx` | Email | Email com emoji quebraria autenticação |
| `Register.tsx` | Nome, email, telefone, CPF | Dados cadastrais devem ser texto puro |
| `PerfilUsuario.tsx` | Nova senha, confirmar senha, email | Senhas não devem conter emojis |
| `PerfilVendedor.tsx` | Nova senha, confirmar senha, email | Idem |
| `RedefinirSenha.tsx` | Campos de senha | Idem |
| `RegistrarMercado.tsx` | Nome, email, estado, cidade, bairro, rua | Endereço precisa ser texto puro |
| `GerenciamentoMercado.tsx` | Nome e descrição (modal) | Dados públicos do mercado |
| `Cart.tsx` | Input de cupom | Códigos de cupom são alfanuméricos |
| `Vitrine.tsx` | Busca e edição de categoria | Busca não deve conter emojis |
| `VitrineCliente.tsx` | Input de busca | Idem |
| `CadastroProduto.tsx` | Nome e descrição do produto | Dados de produto |
| `CriarCategoria.tsx` | Nome da categoria | Nome da categoria |
| `EditarMercado.tsx` | Nome e descrição | Dados do mercado |
| `EsqueciSenhaModal.tsx` | Input de email | Email de recuperação |
| `ModalEditarPerfil.tsx` | Nome, email, telefone | Dados do perfil |
| `AdicionarMercadoFavorito.tsx` | Busca de mercado | Busca por slug/nome |

---

## 2. Segurança no Backend

**Commit:** `ae84a22`
**Tipo:** Segurança
**Arquivo principal:** `Backend/src/server.js`

### Contexto

O backend estava funcionando mas sem as proteções de segurança básicas recomendadas para aplicações em produção. Isso incluía:

- Ausência de redirect HTTP → HTTPS
- Headers de segurança não configurados
- CORS restritivo não implementado
- Tratamento de erros inconsistente
- Ausência de monitoramento de saúde do serviço

### Proteções Implementadas

#### 2.1 Redirect HTTP → HTTPS

```javascript
if (process.env.NODE_ENV === 'production') {
  const proto = req.headers['x-forwarded-proto'];
  if (proto && proto !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
}
```

**Por quê:** Em produção (Render), o tráfego deve ser sempre criptografado. O header `x-forwarded-proto` é adicionado pelo proxy reverso do Render.

#### 2.2 Headers de Segurança

| Header | Valor | Proteção |
|--------|-------|----------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Força HTTPS por 1 ano |
| `X-Content-Type-Options` | `nosniff` | Impede MIME sniffing |
| `X-Frame-Options` | `DENY` | Impede clickjacking (iframe) |
| `X-XSS-Protection` | `1; mode=block` | Proteção XSS do navegador |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controle de referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Desativa APIs sensíveis |

#### 2.3 CORS Restrito

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === 'production') {
      if (origin.startsWith('https://')) {
        callback(null, true);
      } else {
        callback(new Error('Não permitido pelo CORS'));
      }
    } else {
      callback(null, true); // localhost permitido em dev
    }
  }
};
```

**Por quê:** Em produção, apenas origins HTTPS são aceitas. Isso impede que sites maliciosos façam requisições à API.

#### 2.4 Tratamento de Erros

```javascript
// 404 para rotas API não encontradas
app.use('/api', (req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// Error handler global
app.use((err, req, res, next) => {
  if (err.message === 'Não permitido pelo CORS') {
    return res.status(403).json({ erro: 'Origem não permitida' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido' });
  }
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});
```

#### 2.5 Health Check

```javascript
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**Por quê:** Endpoint para monitoramento e keep-alive do Render (que suspende serviços inativos no plano gratuito).

#### 2.6 Cache de Uploads

```javascript
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  immutable: true,
}));
```

**Por quê:** Arquivos estáticos (imagens) podem ser cacheados por 1 dia, reduzindo carga no servidor.

---

## 3. Correção de TypeScript

**Commit:** `281cfaf`
**Tipo:** Bug fix
**Arquivo:** `Frontend/src/pages/Vitrine/Vitrine.tsx`

### O problema

A interface `ProdutoForm` estava com uma propriedade `files` faltando, causando erro de compilação TypeScript:

```
Property 'files' is missing in type 'ProdutoForm' but required in type ...
```

### A solução

Adicionada a propriedade `files: File[]` na interface:

```typescript
interface ProdutoForm {
  nome: string;
  preco: string;
  descricao: string;
  categoriaId: number | null;
  files: File[];  // ← Adicionado
}
```

---

## 4. Limpeza de Warnings (Dynamic Imports)

**Commits:** `7fd12fe`, `a1a483d`
**Tipo:** Limpeza de código
**Arquivos:** 3

### Contexto

O Vite gera warnings quando um módulo é importado dinamicamente (`await import()`) mas já possui um import estático no mesmo arquivo. Dynamic imports são úteis para code splitting (carregar módulos sob demanda), mas quando o módulo já está importado estaticamente, o dynamic import é ineficiente e gera warning.

### O que foi feito

| Arquivo | Imports removidos | Import adicionado |
|---------|------------------|-------------------|
| `PerfilUsuario.tsx` | 2 `await import('../../services/api')` | — |
| `PerfilVendedor.tsx` | 2 `await import('../../services/api')` | — |
| `ModalEditarPerfil.tsx` | 1 `await import('../services/api')` | `import { api } from '../services/api'` |

**Exemplo antes/depois:**

```tsx
// ANTES (com warning)
const handleTrocarSenha = async () => {
  const { api } = await import('../../services/api');  // ← Warning!
  await api.trocarSenha({ ... });
};

// DEPOIS (sem warning)
import { api } from '../../services/api';  // ← Import estático

const handleTrocarSenha = async () => {
  await api.trocarSenha({ ... });  // ← Usa o import estático
};
```

---

## 5. Exibição de CPF no Modal de Edição de Perfil

**Commit:** `be8c2c5`
**Tipo:** Funcionalidade / UX
**Arquivos:** 3

### Contexto

O modal de edição de perfil (`ModalEditarPerfil.tsx`) permitia editar nome, email e telefone, mas não exibia o CPF do usuário. O CPF é um dado importante que o usuário deve conseguir visualizar (mesmo que não edite).

### Alterações por camada

#### Backend (`authController.js`)

**Login** — Adicionado `cpf` no SELECT e na resposta:
```javascript
// ANTES
const resultado = await sql`
  SELECT id_usuario, nome, email, senha, email_verificado, foto_perfil
  FROM usuarios WHERE email = ${email}
`;
// ...
res.json({ usuario: { id_usuario, nome, email, email_verificado, foto_perfil } });

// DEPOIS
const resultado = await sql`
  SELECT id_usuario, nome, email, cpf, senha, email_verificado, foto_perfil
  FROM usuarios WHERE email = ${email}
`;
// ...
res.json({ usuario: { id_usuario, nome, email, cpf, email_verificado, foto_perfil } });
```

**Perfil** — Adicionado `cpf` no SELECT:
```javascript
const [usuario] = await sql`
  SELECT id_usuario, nome, email, cpf, telefone, email_verificado, foto_perfil
  FROM usuarios WHERE id_usuario = ${req.usuarioId}
`;
```

#### Frontend (`AuthContext.tsx`)

Adicionado `cpf` na interface `Usuario`:
```typescript
interface Usuario {
  id_usuario: number;
  nome: string;
  email: string;
  cpf?: string;      // ← Adicionado
  telefone?: string;
  email_verificado: boolean;
  foto_perfil?: string;
}
```

#### Modal (`ModalEditarPerfil.tsx`)

- **CPF:** Exibido como campo `readOnly` com formatação `000.000.000-00`
- **Email:** Alterado de editável para `readOnly`
- **Ambos:** Com texto explicativo "não pode ser alterado"
- **Inputs:** Configurados com `placeholder`, `maxLength`, `autoComplete`, `type` adequados

---

## 6. SPA Routing — Correção de "Not Found"

**Commits:** `ae84a22` → `586003e`
**Tipo:** Bug fix / Infraestrutura
**Arquivos:** `vercel.json` (deletado), `Frontend/vercel.json` (deletado), `Frontend/public/_redirects` (deletado)

### O problema

Ao dar refresh (F5 ou acesso direto) em rotas como `/vendedor`, `/auth/register`, `/vitrine/mercado-x`, o navegador recebia erro **404 Not Found**. Isso acontecia porque:

1. O React Router gerencia rotas no **client-side** (no navegador)
2. O servidor estático (Render) só conhece o arquivo `index.html`
3. Quando o navegador pede `/vendedor`, o servidor procura um arquivo `vendedor.html` que não existe
4. Resultado: 404

### Tentativas de solução (que falharam)

| Tentativa | Por quê falhou |
|-----------|---------------|
| `vercel.json` com rewrites | O deploy é no **Render**, não no Vercel. O Render ignora `vercel.json` |
| `_redirects` file (estilo Netlify) | O Render Static Sites **não** processa `_redirects` como o Netlify |

### Solução final

Configuração de **Rewrite Rule** diretamente no painel do Render:

1. Acesse o painel do Render → Settings do Static Site
2. Role para **Redirects and Rewrites**
3. Adicione uma regra:
   - **Source:** `/*`
   - **Destination:** `/index.html`
   - **Action:** **Rewrite** (não Redirect!)

**Como funciona:**
```
Navegador: GET /vendedor
    ↓
Render: "Não existe arquivo /vendedor, aplico rewrite"
    ↓
Render: Serve /index.html (o HTML do React)
    ↓
React Router: "A rota é /vendedor, renderizo o componente PerfilVendedor"
    ↓
Usuário vê a página correta
```

**Importante:** O Rewrite serve o conteúdo de `/index.html` **sem** mudar a URL no navegador. Se fosse Redirect, a URL mudaria para `/index.html`.

---

## 7. Correção de Rotas — Vendedor Sobrescrevendo Todas

**Commits:** `7694671`, `6225e2a`
**Tipo:** Bug fix
**Arquivo:** `Frontend/src/App.tsx`

### O problema

O componente `Rotas` tinha uma lógica que verificava se o vendedor tinha um mercado aberto (`mercadoAberto`) e a vitrine aberta (`vitrineAberta`) no localStorage. Se tivesse, ele **renderizava diretamente** o componente de gerenciamento, **pulando completamente o `<Routes>`**:

```tsx
// CÓDIGO PROBLEMÁTICO
if (usuario && mercadoAberto && vitrineAberta) {
  return <Vitrine ... />;  // ← Pulava TODAS as rotas!
}
if (usuario && mercadoAberto) {
  return <GerenciamentoMercado ... />;  // ← Pulava TODAS as rotas!
}

return <Routes>...</Routes>;  // ← Só chegava aqui se não tivesse mercadoAberto
```

**Resultado:**
- Usuário acessava `/auth` → Via o dashboard do vendedor
- Usuário acessava `/perfil` → Via o dashboard do vendedor
- Usuário acessava `/vitrine/mercado-x` (rota pública de cliente) → Via a vitrine do vendedor
- A URL no navegador não refletia o que estava sendo exibido

### A solução

Adicionada verificação da URL atual usando `useLocation()` do React Router:

```tsx
import { useLocation } from 'react-router-dom';

function Rotas() {
  const location = useLocation();
  // ...

  const isRotaVendedor = location.pathname === '/vendedor';

  // Só aplica o override se estiver na rota /vendedor
  if (isRotaVendedor && usuario && mercadoAberto && vitrineAberta) {
    return <Vitrine ... />;
  }
  if (isRotaVendedor && usuario && mercadoAberto) {
    return <GerenciamentoMercado ... />;
  }

  // Para todas as outras rotas, segue o fluxo normal do React Router
  return <Routes>...</Routes>;
}
```

**Resultado agora:**
| Rota | Comportamento |
|------|--------------|
| `/vendedor` | Mostra dashboard/vitrine do vendedor (se logado e tem mercado) |
| `/auth` | Mostra login (corretamente) |
| `/perfil` | Mostra perfil do usuário (corretamente) |
| `/vitrine/slug` | Mostra vitrine do cliente (corretamente) |
| `/` | Mostra home (corretamente) |

---

## 8. Botão "Leia Mais" na Descrição do Mercado

**Commit:** `cff5a5f`
**Tipo:** Funcionalidade / UX
**Arquivos:** 5 (1 criado + 4 modificados)

### Contexto

A descrição do mercado era exibida integralmente na vitrine (tanto do vendedor quanto do cliente). Para mercados com descrições longas, isso ocupava muito espaço vertical e prejudicava a experiência visual.

### Solução Implementada

#### Novo componente: `DescricaoModal.tsx`

```tsx
interface Props {
  titulo: string;
  descricao: string;
  onFechar: () => void;
}
```

Modal reutilizável que:
- Exibe o nome do mercado como título
- Mostra a descrição completa com `whiteSpace: 'pre-wrap'` (preserva quebras de linha)
- Fecha ao clicar fora (overlay) ou no botão "Fechar"
- Segue o padrão visual dos outros modais (`pu-modal-overlay`, `pu-modal`)

#### Lógica de truncamento

```tsx
<p className="vt-desc-mercado">
  {dados.descricao && dados.descricao.length > 100
    ? <>{dados.descricao.slice(0, 100)}... 
        <button onClick={() => setModalDescricao(true)}>Leia mais</button>
      </>
    : dados.descricao
  }
</p>
```

| Tamanho da descrição | Comportamento |
|---------------------|--------------|
| Até 100 caracteres | Exibe completa, sem botão |
| Mais de 100 caracteres | Trunca em 100 chars + `...` + botão "Leia mais" |

#### Estilo do botão

```css
.vt-btn-leia-mais {
  background: none;
  border: none;
  color: var(--vt-cor-icones);  /* Cor do tema ativo */
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
}
```

---

## 9. Segurança — Middleware de Auth nas Rotas

**Commit:** `0ddd7d9`
**Tipo:** Segurança
**Arquivos:** 5 routes files

### O problema

A autenticação era verificada de duas formas no codebase:

1. **Middleware** (`authMiddleware.js`) — Usado apenas em `carrinhoRoutes.js`
2. **Dentro do controller** (`pegarIdUsuario()`) — Usado em todos os outros controllers

O problema da abordagem #2 é que ela depende do desenvolvedor **lembrar** de chamar `pegarIdUsuario()` em cada nova função de controller. Se alguém esquecesse, a rota ficaria completamente aberta.

### A solução

Adicionado o middleware `autenticar` (importado de `authMiddleware.js`) diretamente na definição de cada rota de escrita. Isso cria uma **dupla proteção**: o middleware bloqueia antes e o controller verifica novamente.

**Exemplo — Market Routes:**

```javascript
// ANTES (proteção só no controller)
router.post('/',   criarMercado);
router.put('/:id', upload.fields([...]), atualizarMercado);
router.delete('/:id', deletarMercado);

// DEPOIS (proteção em duas camadas)
router.post('/',   autenticar, criarMercado);
router.put('/:id', autenticar, upload.fields([...]), atualizarMercado);
router.delete('/:id', autenticar, deletarMercado);
```

### Rotas protegidas

| Rota | Método | Proteção |
|------|--------|----------|
| `/api/mercados` | POST | `autenticar` middleware |
| `/api/mercados/meus` | GET | `autenticar` middleware |
| `/api/mercados/:id/dashboard` | GET | `autenticar` middleware |
| `/api/mercados/:id` | PUT | `autenticar` middleware |
| `/api/mercados/:id` | DELETE | `autenticar` middleware |
| `/api/mercados/:id/categorias` | POST | `autenticar` middleware |
| `/api/mercados/:id/categorias/:catId` | PUT | `autenticar` middleware |
| `/api/mercados/:id/categorias/:catId` | DELETE | `autenticar` middleware |
| `/api/mercados/:id/categorias/:catId/produtos` | POST | `autenticar` middleware |
| `/api/mercados/:id/categorias/:catId/produtos/:prodId` | PUT | `autenticar` middleware |
| `/api/mercados/:id/categorias/:catId/produtos/:prodId` | DELETE | `autenticar` middleware |
| `/api/usuario/favoritos` | GET | `autenticar` middleware |
| `/api/usuario/avaliacoes` | GET | `autenticar` middleware |
| `/api/usuario/historico` | GET | `autenticar` middleware |

### Rotas que permanecem públicas (por design)

| Rota | Método | Motivo |
|------|--------|--------|
| `/api/mercados` | GET | Listagem pública de mercados |
| `/api/mercados/:id` | GET | Visualização pública |
| `/api/mercados/slug/:slug` | GET | Visualização pública |
| `/api/mercados/:id/categorias` | GET | Listagem pública |
| `/api/mercados/:id/categorias/:catId/produtos` | GET | Listagem pública |
| `/api/auth/register` | POST | Cadastro público |
| `/api/auth/login` | POST | Login público |
| `/api/auth/*` | POST | Fluxos de auth (recuperação, verificação) |

---

## 10. Rate Limiting nas Rotas de Auth

**Commit:** `0ddd7d9`
**Tipo:** Segurança
**Arquivo criado:** `Backend/src/middleware/rateLimiter.js`

### Contexto

Sem rate limiting, um atacante pode:
- **Brute force:** Tentar milhares de senhas por segundo no login
- **Credential stuffing:** Testar listas de email/senha obtidas em vazamentos
- **Spam de cadastro:** Criar milhares de contas falsas
- **Abuso de recuperação:** Enviar milhares de emails de recuperação

### Implementação

Criado um rate limiter em memória (sem dependências externas):

```javascript
const rateLimit = new Map();

function limiter(maxRequisicoes = 10, janelaMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const chave = req.ip + req.path;
    const agora = Date.now();

    if (!rateLimit.has(chave)) {
      rateLimit.set(chave, { count: 1, inicio: agora });
      return next();
    }

    const registro = rateLimit.get(chave);

    // Reseta janela se expirou
    if (agora - registro.inicio > janelaMs) {
      registro.count = 1;
      registro.inicio = agora;
      return next();
    }

    registro.count++;

    if (registro.count > maxRequisicoes) {
      const segundosRestantes = Math.ceil((janelaMs - (agora - registro.inicio)) / 1000);
      return res.status(429).json({
        erro: `Muitas tentativas. Tente novamente em ${segundosRestantes} segundos.`
      });
    }

    next();
  };
}
```

**Características:**
- **Armazenamento:** Em memória (Map do JavaScript)
- **Chave:** IP + rota (ex: `192.168.1.1POST /api/auth/login`)
- **Limpeza automática:** Registros antigos (>30 min) são removidos a cada 10 minutos
- **Sem dependências:** Não precisa de Redis ou banco de dados

### Limites aplicados

| Rota | Máx. requisições | Janela | Justificativa |
|------|-----------------|--------|---------------|
| `POST /register` | 5 | 15 min | Prevenir spam de cadastro |
| `POST /login` | 10 | 15 min | Prevenir brute force (generoso para usuários legítimos) |
| `POST /esqueci-senha` | 3 | 15 min | Prevenir abuso de envio de email |
| `POST /verificar-email` | 5 | 15 min | Prevenir abuso de verificação |
| `POST /redefinir-senha` | 5 | 15 min | Prevenir abuso de redefinição |
| `POST /trocar-senha` | 5 | 15 min | Prevenir abuso |
| `POST /confirmar-troca-senha` | 5 | 15 min | Prevenir abuso |

### Resposta HTTP 429

```json
{
  "erro": "Muitas tentativas. Tente novamente em 847 segundos."
}
```

O frontend deve tratar esse erro e exibir uma mensagem amigável ao usuário.

---

## 11. Fix de Email Leak na Recuperação de Senha

**Commit:** `0ddd7d9`
**Tipo:** Segurança
**Arquivo:** `Backend/src/controllers/authController.js`

### O problema

O endpoint `POST /api/auth/esqueci-senha` retornava respostas diferentes dependendo de o email existir ou não:

```javascript
// Se email NÃO existe:
res.status(404).json({ erro: "Usuário não encontrado" });

// Se email EXISTE:
res.json({ mensagem: "Email de recuperação enviado" });
```

**Vulnerabilidade:** Um atacante poderia usar essa diferença para descobrir quais emails estão cadastrados no sistema (ataque de **email enumeration**).

### A solução

Agora o endpoint **sempre retorna a mesma resposta**, independente de o email existir:

```javascript
if (usuario.length === 0) {
  return res.json({
    mensagem: "Se o email estiver cadastrado, você receberá um código de recuperação."
  });
}
```

**Resultado:**
- Email existe → Envia o código + retorna mensagem genérica
- Email não existe → Retorna a mesma mensagem genérica (sem enviar nada)
- Atacante não consegue distinguir os dois cenários

---

## 12. Botão "Criar Mercado" Condicional na Sidebar

**Commit:** `ebcd325`
**Tipo:** Funcionalidade / UX
**Arquivo:** `Frontend/src/components/Sidebar.tsx`

### Contexto

A sidebar exibia o botão "Criar Mercado" para todos os usuários, incluindo aqueles que já possuíam um mercado cadastrado. Isso poderia causar confusão, já que um vendedor não deveria criar múltiplos mercados.

### Solução Implementada

Adicionada uma propriedade `showCriarMercado` (boolean, default `true`) na interface `SidebarProps`:

```tsx
interface SidebarProps {
  // ... outras props
  showCriarMercado?: boolean;
}
```

O botão é renderizado condicionalmente:

```tsx
{showCriarMercado && (
  <button
    className="sb-create-btn"
    onClick={() => { navigate("/registrar-mercado"); setOpen(false); }}
  >
    <IconPlus size={16} />
    Criar Mercado
  </button>
)}
```

---

## 13. Migração de Uploads para Supabase Storage

**Commit:** `9c168ac`
**Tipo:** Infraestrutura / Performance
**Arquivos:** 25 (1 criado + 24 modificados)

### Contexto

O sistema anterior usava `multer` no backend para receber uploads de imagens e salvá-las no disco do servidor. Isso tinha diversos problemas:

- **Render.com (plano gratuito):** O filesystem é efêmero — uploads são perdidos a cada deploy ou reinício do dyno
- **Escalabilidade:** Imagens ficam no mesmo servidor da API, sobrecarregando I/O
- **Backup:** Sem backup automático das imagens

### Solução Implementada

Migração completa para **Supabase Storage**, onde as imagens são enviadas diretamente do frontend para o Supabase, e o backend apenas recebe a URL resultante.

#### Novo serviço: `Frontend/src/services/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### Fluxo anterior (com multer):

```
Frontend → FormData (arquivo binário) → Backend (multer) → Salva no disco → Retorna path
```

#### Fluxo novo (com Supabase):

```
Frontend → Upload direto para Supabase → Retorna URL pública → Frontend envia URL para Backend → Backend salva URL no banco
```

### Alterações por camada

#### Frontend (`api.ts`)

Removida a função `requestFormData()` e todas as chamadas que usavam `FormData`. Agora todas as requisições usam `JSON`:

```typescript
// ANTES (FormData)
atualizarMercado: (mercadoId, dados) => {
  const formData = new FormData()
  if (dados.logo) formData.append('foto_perfil', dados.logo)
  return requestFormData(`/mercados/${mercadoId}`, formData, 'PUT')
}

// DEPOIS (JSON)
atualizarMercado: (mercadoId, dados) => {
  return request(`/mercados/${mercadoId}`, {
    method: 'PUT',
    body: JSON.stringify(dados), // dados já contém URLs do Supabase
  })
}
```

#### Backend (`marketController.js`, `produtoController.js`, `authController.js`)

Removida a lógica de processamento de `req.files`:

```javascript
// ANTES
const files = req.files || {}
const bannerFile = files.banner?.[0]
const banner = bannerFile ? `/uploads/mercados/${bannerFile.filename}` : undefined

// DEPOIS
const banner = banner_url || undefined // URL já vem do frontend
```

#### Backend - Arquivo removido

`Backend/src/middleware/upload.js` — Configuração do multer (não mais necessária).

---

## 14. Campo Data de Nascimento no Cadastro

**Commit:** `6c9590d`
**Tipo:** Funcionalidade / Dados do usuário
**Arquivos:** 17 (2 criados + 15 modificados)

### Contexto

O cadastro de usuários coletava nome, telefone, CPF e email, mas não incluía data de nascimento. Esse dado é útil para:
- Análise demográfica dos usuários
- Personalização de ofertas
- Campos legais (maioridade)

### Solução Implementada

#### Backend - Migração do banco

```javascript
// Backend/src/db/migrate.js
await sql`
  ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE
`;
```

#### Backend - `authController.js`

- Campo `data_nascimento` adicionado no `INSERT` do cadastro
- Campo retornado no `SELECT` do login e do perfil
- Suporte na atualização de perfil

#### Frontend - `Register.tsx`

Adicionado um componente `DatePicker` (biblioteca `react-datepicker`) com as seguintes características:
- Formato brasileiro `dd/MM/yyyy`
- Locale `pt-BR`
- Seleção via dropdown de mês/ano
- Validação: data não pode ser futura
- Formatação automática com máscara

```tsx
<DatePicker
  selected={parseDateSafe(form.data_nascimento)}
  onChange={(date) => { /* ... */ }}
  dateFormat="dd/MM/yyyy"
  locale="pt-BR"
  maxDate={new Date()}
  showYearDropdown
  showMonthDropdown
  dropdownMode="select"
/>
```

---

## 15. Página de Verificação de Email por Código

**Commit:** `6c9590d`
**Tipo:** Funcionalidade / Segurança
**Arquivos:** 2 criados

### Contexto

O fluxo anterior de verificação de email usava um modal (`EmailVerificacaoModal`) que abria sobre a tela de login. Isso tinha problemas de UX:
- Modal容易 ser fechado acidentalmente
- Sem URL compartilhável (não suportava verificação por link)
- Usuário não entendia claramente o que estava acontecendo

### Solução Implementada

Criada uma página dedicada `VerificarEmail.tsx` com:

- **6 inputs separados** para cada dígito do código
- **Autofocus automático** entre os inputs
- **Suporte a colar** (paste) o código completo
- **Máscara de email** para privacidade (`jo****@gmail.com`)
- **Tela de sucesso** com animação e redirecionamento automático
- **Suporte a verificação por URL** (`/verificar-email?codigo=123456`)

#### Fluxo:

1. Usuário se cadastra → Redirecionado para `/verificar-email?email=joao@email.com`
2. Página mostra os 6 inputs e o email mascarado
3. Usuário digita o código recebido por email
4. Código é validado no backend
5. Tela de sucesso → Redireciona para `/auth` após 2.5 segundos

---

## 16. Validação de Senha Atual na Troca de Senha

**Commit:** `6c9590d`
**Tipo:** Segurança
**Arquivo:** `Backend/src/controllers/authController.js`

### O problema

O endpoint `solicitarTrocaSenha` permitia solicitar a troca de senha **sem verificar a senha atual**. Um atacante com acesso à sessão de um usuário poderia trocar a senha sem saber a original.

### A solução

Adicionada verificação da senha atual antes de permitir a troca:

```javascript
const { senhaAtual, novaSenha, emailConfirmacao } = req.body;

// Validação da senha atual
const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
if (!senhaValida) {
  return res.status(400).json({ erro: 'Senha atual incorreta.' });
}
```

---

## 17. Lazy Loading nas Rotas (Code Splitting)

**Commit:** `03ac5bd`
**Tipo:** Performance
**Arquivo:** `Frontend/src/App.tsx`

### Contexto

Todas as páginas eram importadas estaticamente no `App.tsx`, resultando em um bundle único e grande. Isso significava que o navegador baixava **todo o código de todas as páginas** na primeira visita, mesmo que o usuário nunca visitasse a maioria delas.

### Solução Implementada

Conversão de imports estáticos para **lazy imports** com `React.lazy()`:

```tsx
// ANTES
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
// ... 10+ imports estáticos

// DEPOIS
const Login = lazy(() => import('./pages/Login/Login'))
const Register = lazy(() => import('./pages/Register/Register'))
// ... imports sob demanda
```

Envolvido em `<Suspense>` com fallback de loading:

```tsx
<Suspense fallback={<LoadingOverlay mensagem="Carregando..." />}>
  <Routes>
    {/* ... rotas */}
  </Routes>
</Suspense>
```

**Resultado:**
- Bundle inicial significativamente menor
- Cada página é carregada apenas quando o usuário navega para ela
- Melhor experiência em conexões lentas

---

## 18. Scroll Suave na Landing Page

**Commit:** `03ac5bd`
**Tipo:** UX
**Arquivo:** `Frontend/src/pages/MercadinsPromo/MercadinsPromo.tsx`

### Contexto

Os links de navegação da landing page ("Benefícios", "Planos", "FAQ") usavam âncoras HTML (`href="#beneficios"`) que causavam um scroll abrupto e podiam não funcionar corretamente em todos os navegadores.

### Solução Implementada

Criada uma função `scrollTo()` que usa a API nativa `scrollIntoView` com comportamento suave:

```tsx
function scrollTo(id: string) {
  setMobileMenuOpen(false);
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

Links de navegação atualizados:

```tsx
// ANTES
<a href="#beneficios">Benefícios</a>

// DEPOIS
<a href="#beneficios" onClick={(e) => { e.preventDefault(); scrollTo('beneficios'); }}>Benefícios</a>
```

---

## 19. Limpeza de Código e Correções

**Commit:** `03ac5bd`
**Tipo:** Manutenção
**Arquivos:** Múltiplos

### Alterações realizadas:

| Alteração | Descrição |
|-----------|-----------|
| **Correção de typo** | Pasta `Carrrinho` renomeada para `Carrinho` (3 letras 'r' → 2) |
| **Remoção de código morto** | Arquivo `Frontend/src/services/Usecarrinho.ts` deletado (72 linhas) |
| **Remoção de middleware** | `Backend/src/middleware/upload.js` deletado (38 linhas) |
| **Remoção de arquivo HTTP** | `Backend/marketRoutestest.http` deletado |
| **Limpeza de dependências** | Pacotes desnecessários removidos do `package.json` |
| **Rota `/verificar-email`** | Adicionada no `App.tsx` para a nova página de verificação |

---

## Resumo dos Commits

| # | Commit | Data | Descrição | Tipo |
|---|--------|------|-----------|------|
| 1 | `ae84a22` | 27/08 | Bloquear emojis nos inputs + correção SPA routing e segurança | feat + fix + security |
| 2 | `281cfaf` | 27/08 | Adicionar propriedade files na interface ProdutoForm | fix |
| 3 | `7fd12fe` | 27/08 | Remover dynamic imports redundantes do api.ts | fix |
| 4 | `a1a483d` | 27/08 | Adicionar import estático de api no ModalEditarPerfil | fix |
| 5 | `be8c2c5` | 27/08 | Exibir CPF no modal de edição de perfil (read-only) | feat |
| 6 | `586003e` | 27/08 | Usar _redirects para SPA routing no Render.com | fix |
| 7 | `6225e2a` | 27/08 | Override mercadoAberto só aplica na rota /vendedor | fix |
| 8 | `cff5a5f` | 27/08 | Botão "Leia mais" na descrição do mercado com modal | feat |
| 9 | `0ddd7d9` | 27/08 | Segurança: middleware auth, rate limiting, fixar leak de email | security |
| 10 | `ebcd325` | 28/08 | Botão "Criar Mercado" condicional na Sidebar | feat |
| 11 | `9c168ac` | 01/09 | Migração de uploads para Supabase Storage | infra |
| 12 | `6c9590d` | 05/09 | Data de nascimento, VerificarEmail, validação de senha | feat + security |
| 13 | `03ac5bd` | 05/09 | Lazy loading, scroll suave, limpeza de código | perf + fix |

---

## Arquivos Criados (total da sessão)

| # | Arquivo | Descrição | Linhas |
|---|---------|-----------|--------|
| 1 | `Frontend/src/hooks/useBlockEmojis.ts` | Função `removeEmojis()` para filtrar emojis | ~10 |
| 2 | `Frontend/src/components/DescricaoModal.tsx` | Modal reutilizável para descrição completa | ~35 |
| 3 | `Backend/src/middleware/rateLimiter.js` | Middleware de rate limiting em memória | ~50 |
| 4 | `Frontend/src/services/supabase.ts` | Cliente Supabase para uploads | ~10 |
| 5 | `Frontend/src/pages/VerificarEmail/VerificarEmail.tsx` | Página de verificação de email por código | ~190 |
| 6 | `Frontend/src/pages/VerificarEmail/VerificarEmail.css` | Estilos da página de verificação | ~113 |

## Arquivos Deletados

| # | Arquivo | Motivo |
|---|---------|--------|
| 1 | `Backend/src/middleware/upload.js` | Substituído por Supabase Storage |
| 2 | `Frontend/src/services/Usecarrinho.ts` | Código morto (não utilizado) |
| 3 | `Backend/marketRoutestest.http` | Arquivo de teste desnecessário |

## Arquivos Modificados (total da sessão)

| # | Arquivo | Commits | Descrição da alteração |
|---|---------|---------|----------------------|
| 1 | `Backend/src/server.js` | `ae84a22` | HTTPS redirect, security headers, CORS, error handling |
| 2 | `Backend/src/controllers/authController.js` | `be8c2c5`, `0ddd7d9`, `6c9590d` | CPF, fix email leak, data_nascimento, validação senha atual |
| 3 | `Backend/src/controllers/marketController.js` | `9c168ac` | Uploads via URL (Supabase) em vez de FormData |
| 4 | `Backend/src/controllers/produtoController.js` | `9c168ac` | Uploads via URL (Supabase) em vez de FormData |
| 5 | `Backend/src/controllers/carrinhoController.js` | `03ac5bd` | Limpeza de código |
| 6 | `Backend/src/controllers/categoriaController.js` | `03ac5bd` | Limpeza de código |
| 7 | `Backend/src/controllers/usuarioController.js` | `03ac5bd` | Limpeza de código |
| 8 | `Backend/src/controllers/usuariosMercadosController.js` | `03ac5bd` | Limpeza de código |
| 9 | `Backend/src/routes/marketRoutes.js` | `0ddd7d9`, `9c168ac` | Auth middleware + remoção de upload |
| 10 | `Backend/src/routes/categoriaRoutes.js` | `0ddd7d9` | Auth middleware nas rotas de escrita |
| 11 | `Backend/src/routes/produtoRoutes.js` | `0ddd7d9`, `9c168ac` | Auth middleware + remoção de upload |
| 12 | `Backend/src/routes/usuarioRoutes.js` | `0ddd7d9` | Auth middleware nos dados pessoais |
| 13 | `Backend/src/routes/authRoutes.js` | `0ddd7d9`, `6c9590d` | Rate limiting + rota verificar-email |
| 14 | `Backend/src/routes/usuariosMercadosRoutes.js` | `03ac5bd` | Limpeza de código |
| 15 | `Backend/src/db/migrate.js` | `6c9590d` | Coluna data_nascimento na tabela usuarios |
| 16 | `Backend/src/utils/mailer.js` | `6c9590d` | Suporte a URL de verificação no email |
| 17 | `Backend/src/middleware/authMiddleware.js` | `03ac5bd` | Limpeza de código |
| 18 | `Frontend/src/App.tsx` | `7694671`, `6225e2a`, `03ac5bd` | Routing, lazy loading, rota verificar-email |
| 19 | `Frontend/src/context/AuthContext.tsx` | `be8c2c5`, `6c9590d` | cpf + data_nascimento na interface |
| 20 | `Frontend/src/services/api.ts` | `9c168ac` | Migração de FormData para JSON |
| 21 | `Frontend/src/components/Sidebar.tsx` | `ebcd325` | Botão "Criar Mercado" condicional |
| 22 | `Frontend/src/components/ModalEditarPerfil.tsx` | `a1a483d`, `be8c2c5`, `9c168ac` | Fix import + CPF + upload via URL |
| 23 | `Frontend/src/components/CadastroProduto.tsx` | `ae84a22`, `9c168ac` | removeEmojis + upload via URL |
| 24 | `Frontend/src/components/EditarMercado.tsx` | `ae84a22`, `9c168ac` | removeEmojis + upload via URL |
| 25 | `Frontend/src/components/PasswordStrength.tsx` | `6c9590d` | Ajustes na exibição |
| 26 | `Frontend/src/pages/Vitrine/Vitrine.tsx` | `281cfaf`, `cff5a5f`, `9c168ac` | Fix interface + "Leia mais" + upload via URL |
| 27 | `Frontend/src/pages/Vitrine/Vitrine.css` | `cff5a5f` | Estilo do botão "Leia mais" |
| 28 | `Frontend/src/pages/VitrineCliente/VitrineCliente.tsx` | `cff5a5f` | "Leia mais" na vitrine do cliente |
| 29 | `Frontend/src/pages/VitrineCliente/VitrineCliente.css` | `cff5a5f` | Estilo do botão "Leia mais" |
| 30 | `Frontend/src/pages/Register/Register.tsx` | `ae84a22`, `6c9590d` | removeEmojis + campo data_nascimento |
| 31 | `Frontend/src/pages/Register/Register.css` | `6c9590d` | Estilos do DatePicker |
| 32 | `Frontend/src/pages/PerfilUsuario/PerfilUsuario.tsx` | `ae84a22`, `7fd12fe`, `6c9590d` | removeEmojis + fix imports + upload via URL |
| 33 | `Frontend/src/pages/PerfilUsuario/PerfilUsuario.css` | `6c9590d` | Estilos do DatePicker |
| 34 | `Frontend/src/pages/PerfilVendedor/PerfilVendedor.tsx` | `ae84a22`, `7fd12fe`, `6c9590d` | removeEmojis + fix imports + upload via URL |
| 35 | `Frontend/src/pages/MercadinsPromo/MercadinsPromo.tsx` | `03ac5bd` | Scroll suave na navegação |
| 36 | `Frontend/src/pages/MercadinsPromo/MercadinsPromo.css` | `03ac5bd` | Estilos de scroll |
| 37 | `Frontend/src/pages/Carrinho/Cart.tsx` | `ae84a22` | removeEmojis no cupom |
| 38 | `Frontend/src/pages/GerenciamentoMercado/GerenciamentoMercado.tsx` | `ae84a22`, `9c168ac` | removeEmojis + upload via URL |
| 39 | `Frontend/src/pages/RedefinirSenha/RedefinirSenha.tsx` | `ae84a22` | removeEmojis nos campos |
| 40 | `Frontend/src/pages/RegistrarMercado/RegistrarMercado.tsx` | `ae84a22` | removeEmojis em 6 campos |
| 41 | `Frontend/src/components/EsqueciSenhaModal.tsx` | `ae84a22` | removeEmojis no input |
| 42 | `Frontend/src/components/AdicionarMercadoFavorito.tsx` | `ae84a22` | removeEmojis na busca |
| 43 | `Frontend/src/components/CriarCategoria.tsx` | `ae84a22` | removeEmojis no input |
| 44 | `Frontend/src/hooks/useCarrinho.ts` | `9c168ac` | Ajustes na integração |
| 45 | `Frontend/src/context/ThemeContext.tsx` | `9c168ac` | Limpeza |
| 46 | `Frontend/src/index.css` | `ebcd325`, `03ac5bd` | Correções de pointer e scroll |
| 47 | `Frontend/src/components/Sidebar.css` | `ebcd325` | Limpeza |
| 48 | `Frontend/package.json` | `9c168ac`, `03ac5bd` | Dependências (supabase, react-datepicker) |

---

## Stack Tecnológica Utilizada

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 19 |
| Frontend | TypeScript | — |
| Frontend | Vite | 8 |
| Frontend | React Router | — |
| Frontend | react-datepicker | — |
| Frontend | @supabase/supabase-js | — |
| Backend | Express | 5 |
| Backend | PostgreSQL | Neon (Serverless) |
| Backend | JWT | jsonwebtoken |
| Backend | Upload | Supabase Storage |
| Backend | Email | nodemailer |
| Deploy (Frontend) | Render.com | Static Site |
| Deploy (Backend) | Render.com | Web Service |
| Storage (Imagens) | Supabase | Storage |
| Versionamento | GitHub | — |
