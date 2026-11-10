# Mercadins — delivery de mercados da sua região

O Mercadins reúne mercados, padarias, açougues e hortifrutis de uma cidade em
um só lugar: o cliente monta o carrinho, escolhe entre **entrega em casa** ou
**retirada no balcão**, aplica cupom e acompanha o pedido — e o vendedor
gerencia loja, produtos, estoque e pedidos pelo painel.

- **Site no ar:** https://mercadins.com.br
- **API no ar:** https://pi-mercadins.onrender.com

---

## Participantes (Projeto Integrador)

| Integrante | Repositório GitHub |
|---|---|
| **José Arthur Camilo dos Anjos** | [JoseArthurCamiloDosAnjos](https://github.com/JoseArthurCamiloDosAnjos) |
| **Juan de Oliveira Marcondes Xavier** | [Juanmacondes](https://github.com/Juanmacondes) |
| **Raul Diaz Vitoria** | [RaulDiaz07](https://github.com/RaulDiaz07) |

> Projeto Integrador (PI) — disciplina do curso. Repositório principal:
> [JoseArthurCamiloDosAnjos/PI_MERCADINS](https://github.com/JoseArthurCamiloDosAnjos/PI_MERCADINS).

---

## Sumário

1. [Como funciona](#como-funciona)
2. [Arquitetura](#arquitetura)
3. [Tecnologias](#tecnologias)
4. [Como fazer o projeto funcionar](#como-fazer-o-projeto-funcionar)
5. [Docker (alternativa sem instalar Node/Postgres)](#docker-alternativa-sem-instalar-nodepostgres)
6. [Scripts úteis](#scripts-úteis)
7. [Estrutura do repositório](#estrutura-do-repositório)
8. [Documentação](#documentação)
9. [Verificações automáticas](#verificações-automáticas)

---

## Como funciona

O sistema tem **três papéis**:

### Cliente

1. Cria conta (e confirma o e-mail por código);
2. Busca lojas por **nome, tipo e cidade**;
3. Abre a vitrine, avalia produtos com foto e favorita lojas;
4. Monta o carrinho, aplica **cupom** e fecha o pedido — com **taxa de entrega
   e pedido mínimo** visíveis antes de confirmar;
5. Escolhe **entrega em casa** ou **retirada no balcão**, com data/horário
   (quando a loja permite agendamento);
6. Paga na entrega, por **Pix** ou **cartão** (Asaas) — ou fala direto com a
   loja pelo **WhatsApp**;
7. Acompanha o status do pedido e recebe **avisos por e-mail** (cadastro,
   pagamento, saiu para entrega etc.).

### Vendedor

1. Cadastra a loja (paleta de cores, horários, taxa de entrega, pedido mínimo);
2. Gerencia **categorias e produtos** com imagens, custo e estoque
   (alerta de estoque baixo/esgotado);
3. Escolhe produtos prontos do **catálogo** da plataforma (padaria, açougue…);
4. Recebe e atualiza **pedidos** (pendente → preparo → a caminho → entregue);
5. Cria **cupons** (percentual ou valor fixo, com mínimo, limite, validade e
   escopo por categorias e/ou **produtos específicos**);
6. Acompanha o **painel financeiro** por mês e o **split** dos pedidos online
   (valor cai direto na conta Asaas do lojista).

### Administrador

1. Painel com **números da plataforma** (pedidos, faturamento, lojas);
2. Gestão de **usuários e lojas** (bloquear/desbloquear);
3. **Catálogo** de produtos prontos (CRUD);
4. Relatórios, atividade recente e **alertas**.

---

## Arquitetura

```
Navegador ──► Frontend (React + Vite)
                 │  VITE_API_URL  (dev: http://localhost:3001)
                 ▼
             Backend (Node.js + Express)
                 │
        ┌────────┴────────┐
        ▼                 ▼
   PostgreSQL          Serviços externos
   (local ou Neon)                            • Resend      → e-mails e notificações
                       • Asaas       → Pix/cartão, planos, Split
                       • Supabase    → backup das fotos (opcional)
```

**Ambientes** (detalhes em [docs/ambientes.md](docs/ambientes.md)):

| | Desenvolvimento | Produção |
|---|---|---|
| Site | `http://localhost:5173` | https://mercadins.com.br |
| API | `http://localhost:3001` | https://pi-mercadins.onrender.com |
| Banco | PostgreSQL local | Neon |

---

## Tecnologias

| Camada | Ferramentas |
|---|---|
| **Frontend** | React 19 + TypeScript, Vite, React Router, CSS puro por página |
| **Backend** | Node.js 22, Express 5, JWT (autenticação), Resend (E-mails e notificações), Asaas (cobrança e Split) |
| **Banco** | PostgreSQL 16 — local em desenvolvimento, **Neon** em produção; migrações versionadas |
| **Serviços** | Render (API **e** site, conforme `render.yaml`), Neon (banco), Supabase (backup de fotos), Asaas (pagamentos), GitHub Actions (verificações e backup) |

---

## Como fazer o projeto funcionar

Passo a passo para rodar **localmente** (sem Docker).

### 1. Requisitos

| O quê | Versão / observação |
|---|---|
| **Node.js** | 18 ou superior (recomendado 22) — `node -v` |
| **npm** | vem junto com o Node |
| **PostgreSQL** | 14+ local, **apenas para desenvolvimento** (produção usa a Neon) |
| **Git** | para clonar o repositório |

> Sem PostgreSQL local? Pule para [Docker](#docker-alternativa-sem-instalar-nodepostgres)
> ou use a Neon (`DB_PROVIDER=neon`).

### 2. Clonar e instalar

```bash
git clone https://github.com/JoseArthurCamiloDosAnjos/PI_MERCADINS.git
cd PI_MERCADINS

# instala tudo de uma vez (raiz + Backend + Frontend)
npm run install:all
```

Ou, se preferir, uma pasta de cada vez:

```bash
cd Backend  && npm install
cd ../Frontend && npm install
```

### 3. Variáveis de ambiente

Copie os modelos (cada variável está explicada no próprio arquivo):

```bash
# Windows
copy Backend\.env.example  Backend\.env
copy Frontend\.env.example Frontend\.env

# Linux / macOS
cp Backend/.env.example  Backend/.env
cp Frontend/.env.example Frontend/.env
```

**Backup de imagens no `Frontend/.env`** (opcional — as fotos são salvas na
pasta `imagens/` do backend; sem estas variáveis só o backup fica desativado):

| Variável | O que é |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase (backup das fotos) |
| `VITE_SUPABASE_ANON_KEY` | chave pública do Supabase |

**Obrigatórias no `Backend/.env`** para o básico rodar:

| Variável | O que é |
|---|---|
| `DATABASE_URL_LOCAL` | conexão com o PostgreSQL local |
| `JWT_SECRET` | chave para assinar os tokens de login (gere uma longa e aleatória) |

Opcionais (e-mail, pagamentos, notificações): veja comentários em
`Backend/.env.example` e [docs/ambientes.md](docs/ambientes.md).

### 4. Banco de dados

Crie um banco local e aplique as **migrações versionadas** (cada mudança de
estrutura é um arquivo aplicado uma única vez):

```bash
# exemplo de criação do banco (psql ou pgAdmin)
CREATE DATABASE mercadins;

cd Backend

# confira se DATABASE_URL_LOCAL e DB_PROVIDER=local estão no .env
npm run migrate        # aplica as migrações pendentes
```

### 5. Subir Backend e Frontend

**Opção A — um comando na raiz** (levanta os dois juntos):

```bash
npm run dev
# API   → http://localhost:3001
# Site  → http://localhost:5173
```

**Opção B — em dois terminais:**

```bash
# Terminal 1 — API
cd Backend
npm run dev            # PostgreSQL local
# ou: npm run dev:neon # banco da Neon

# Terminal 2 — site
cd Frontend
npm run dev            # http://localhost:5173
```

### 6. Conferir se está no ar

| O quê | URL | Esperado |
|---|---|---|
| Health da API | http://localhost:3001/api/health | `{"status":"ok",...}` |
| Site | http://localhost:5173 | home carrega |

Se a API responder mas o site não chamar a API, confira `VITE_API_URL` no
`Frontend/.env` (deve ser `http://localhost:3001`) e reinicie o `npm run dev`.

### 7. Primeiro uso

1. **Cliente:** cadastre-se em http://localhost:5173 → confirme o e-mail →
   busque uma loja → monte o carrinho;
2. **Vendedor:** cadastre uma loja pelo painel → cadastre categorias e
   produtos → acompanhe pedidos;
3. **Administrador:** use um e-mail de admin já cadastrado no banco (ou
   promova um usuário na tabela `usuarios`) para abrir o painel admin.

---

## Docker (alternativa sem instalar Node/Postgres)

O `compose.yaml` na raiz sobe **Postgres + API + site** em containers:

```bash
# 1. variáveis do build do frontend (raiz)
copy .env.example .env
#    preencha VITE_SUPABASE_* (opcionais — backup de imagens) e VITE_API_URL

# 2. subir tudo
docker compose up --build
```

| Serviço | URL |
|---|---|
| Site (nginx) | http://localhost:8080 |
| API | http://localhost:3001 |
| Banco | só dentro da rede do compose (`postgres:5432`) |

O backend aplica as migrações sozinho antes de aceitar requisições; o nginx
do frontend encaminha `/api/...` e `/sitemap.xml` para a API. O
`Backend/.env` existente é aproveitado (o compose força `DB_PROVIDER=local`
apontando para o Postgres do container).

```bash
docker compose up -d                              # sobe em segundo plano
docker compose logs -f backend                    # acompanha a API
docker compose exec postgres psql -U mercadins -d mercadins   # shell do banco
docker compose down                               # para (dados preservados)
docker compose down -v                            # para e apaga os dados
```

---

## Scripts úteis

**Na raiz:**

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe Backend e Frontend juntos (via `concurrently`) |
| `npm run install:all` | Instala dependências da raiz, do Backend e do Frontend |

**Backend (`cd Backend`):**

| Script | O que faz |
|---|---|
| `npm run dev` / `dev:neon` / `dev:local` | Sobe a API com o banco escolhido (nodemon) |
| `npm start` / `start:neon` / `start:local` | Sobe a API em produção (sem hot-reload) |
| `npm run migrate` | Aplica as migrações pendentes do banco |
| `npm run auditar-sql` | Confere se alguma consulta SQL deixou de usar parâmetros (proteção contra SQL Injection) |

**Frontend (`cd Frontend`):**

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o site em modo de desenvolvimento |
| `npm run build` | Compila o site para produção, com checagem de tipos (`tsc` + Vite) |
| `npm run lint` | ESLint no código do frontend |

---

## Estrutura do repositório

```
PI_MERCADINS/
├── compose.yaml                     # stack Docker: Postgres + Backend + Frontend
├── render.yaml                      # blueprint de produção (API + site na Render)
├── Backend/
│   ├── Dockerfile                   # imagem da API (Node 22)
│   ├── .env.example                 # modelo de variáveis do backend
│   ├── imagens/                     # fotos enviadas (produtos, mercados, usuários…)
│   ├── scripts/                     # auditar-sql, dados demo
│   └── src/
│       ├── controllers/             # regras de negócio (auth, mercados, pedidos, cupons…)
│       ├── db/                      # conexão + migrações versionadas
│       ├── middleware/              # autenticação, rate limit, CORS
│       ├── routes/                  # rotas HTTP (inclui /sitemap.xml)
│       ├── services/                # Asaas, Supabase, envio de E-mails
│       ├── utils/                   # validações, planos, notificações por e-mail
│       └── server.js                # entrada da API
├── Frontend/
│   ├── Dockerfile                   # build Vite + nginx (proxy de /api)
│   ├── nginx.conf                   # rotas do site + proxy para a API
│   ├── public/                      # ícones, robots.txt
│   └── src/
│       ├── assets/                  # imagens e ícones do site
│       ├── components/              # botões, modais, carrinho, notificações
│       ├── context/                 # estado global (carrinho, autenticação)
│       ├── hooks/                   # hooks reutilizáveis
│       ├── pages/                   # login, home, vitrine, produto, carrinho, painel do vendedor, admin
│       ├── services/api.ts          # comunicação com a API
│       └── utils/                   # SEO por página, tipos de loja, paletas
├── docs/
│   ├── API.md                       # documentação das rotas da API
│   ├── pagamentos.md                # pagamento (planos, Asaas, Split, vigência)
│   ├── backup.md                    # backup e restauração do banco
│   └── ambientes.md                 # desenvolvimento x produção
└── .github/workflows/               # verificações automáticas e backup do banco
```

---

## Documentação

- **[docs/API.md](docs/API.md)** — rotas da API (autenticação, mercados, assinaturas, produtos, pedidos, cupons, **notificações por e-mail**, **upload de imagens**, webhook, administração);
- **[docs/pagamentos.md](docs/pagamentos.md)** — pagamento: planos, confirmação via webhook, vigência, suspensão, cancelamento e **Split com o vendedor**;
- **[docs/backup.md](docs/backup.md)** — backup semanal da Neon e como restaurar;
- **[docs/ambientes.md](docs/ambientes.md)** — desenvolvimento × produção, variáveis de ambiente e Docker.

---

## Verificações automáticas

O repositório roda verificações a cada push (GitHub Actions): identificação de
arquivos e SonarQube. No fluxo de manutenção:

- `npm run auditar-sql` — garante que nenhuma consulta SQL use texto concatenado;
- `npx tsc --noEmit` e `npx eslint` — tipos e padrões do frontend;
- **backup semanal do banco** (ação `backup-banco.yml`) — gera um `pg_dump` da Neon e guarda como artefato.
