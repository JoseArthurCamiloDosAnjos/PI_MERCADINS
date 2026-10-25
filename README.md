# Mercadins — delivery de mercados da sua região

O Mercadins reúne mercados, padarias, açougues e hortifrutis de uma cidade em
um só lugar: o cliente monta o carrinho, escolhe entre **entrega em casa** ou
**retirada no balcão**, aplica cupom e acompanha o pedido — e o vendedor
gerencia loja, produtos, estoque e pedidos pelo painel.

- **Site no ar:** https://mercadins.com.br
- **API no ar:** https://pi-mercadins.onrender.com

---

## Como funciona

**Para o cliente:** cria conta, encontra as lojas da região (busca, tipo e
cidade), abre a vitrine, avalia produtos com foto, favorita as lojas preferidas
e pede pelo site — com taxa e pedido mínimo mostrados antes de fechar a
compra. Quem preferir, fala direto com a loja pelo WhatsApp e pode combinar
horário de entrega ou retirada no pedido.

**Para o vendedor:** cadastro de loja com paleta de cores própria, horários,
taxa de entrega e pedido mínimo; gestão de categorias e produtos com imagens,
custo e estoque (com alerta de estoque baixo e esgotado); pedidos com forma de
entrega, agendamento e cupom visíveis; cupons de desconto (percentual ou valor
fixo, com mínimo, limite de usos e validade); painel financeiro por mês.

**Para o administrador:** painel com números da plataforma, gestão de usuários
e lojas, relatórios e alertas.

---

## Tecnologias

| Camada | Ferramentas |
|---|---|
| **Frontend** | React + TypeScript, Vite, React Router, CSS puro por página |
| **Backend** | Node.js, Express, JWT (autenticação), Nodemailer + Resend (E-mails) |
| **Banco** | PostgreSQL — local em desenvolvimento, **Neon** em produção |
| **Serviços** | Vercel (site), Render (API), GitHub (código e verificações) |

---

## Rodando o projeto

### 1. Requisitos

- Node.js 18 ou superior;
- PostgreSQL local (apenas para desenvolvimento — em produção usa a Neon).

### 2. Instalação

```bash
git clone https://github.com/JoseArthurCamiloDosAnjos/PI_MERCADINS.git
cd PI_MERCADINS
cd Backend && npm install
cd ../Frontend && npm install
```

### 3. Variáveis de ambiente

Copie os modelos de exemplo e preencha (cada variável está explicada no modelo):

```bash
copy Backend\.env.example Backend\.env
copy Frontend\.env.example Frontend\.env
```

Guia completo da separação entre desenvolvimento e produção: [docs/ambientes.md](docs/ambientes.md).

### 4. Banco de dados

O banco usa **migrações versionadas** — cada mudança fica registrada em um
arquivo e aplicada uma única vez:

```bash
cd Backend
npm run migrate        # aplica as migrações pendentes
npm run dev            # PostgreSQL local  (ou: npm run dev:neon para a Neon)
```

### 5. Frontend

```bash
cd Frontend
npm run dev            # site em http://localhost:5173
```

---

## Scripts úteis (Backend)

| Script | O que faz |
|---|---|
| `npm run dev` / `dev:neon` / `dev:local` | Sobe a API com o banco escolhido |
| `npm run migrate` | Aplica as migrações pendentes do banco |
| `npm run auditar-sql` | Confere se alguma consulta SQL deixou de usar parâmetros (proteção contra SQL Injection) |
| `npm run build` (Frontend) | Compila o site para produção, com checagem de tipos |

---

## Estrutura do repositório

```
PI_MERCADINS/
├── Backend/
│   ├── scripts/auditar-sql.js      # guarda permanente contra SQL Injection
│   └── src/
│       ├── controllers/            # regras de negócio (auth, mercados, pedidos, cupons…)
│       ├── db/                     # conexão + migrações versionadas
│       ├── routes/                 # rotas HTTP (inclui /sitemap.xml)
│       ├── utils/                  # e-mails (mailer), validações, limitadores
│       └── server.js               # entrada da API
├── Frontend/
│   ├── public/                     # ícones, robots.txt
│   └── src/
│       ├── components/             # botões, modais, carrinho lateral, aviso de cookies
│       ├── pages/                  # login, home, vitrine, produto, carrinho, painel do vendedor, admin
│       ├── services/api.ts         # comunicação com a API
│       └── utils/                  # SEO por página, tipos de loja, paletas
├── docs/
│   ├── API.md                      # documentação de todos os endpoints
│   ├── pagamentos.md               # sistema de pagamento (planos, Asaas, vigência)
│   ├── backup.md                   # backup e restauração do banco
│   └── ambientes.md                # desenvolvimento x produção
└── .github/workflows/              # verificações automáticas e backup do banco
```

---

## Documentação

- **[docs/API.md](docs/API.md)** — todos os endpoints da API (autenticação, mercados, assinaturas, produtos, pedidos, cupons, administração);
- **[docs/pagamentos.md](docs/pagamentos.md)** — sistema de pagamento: planos, confirmação via webhook, vigência, suspensão e cancelamento;
- **[docs/ambientes.md](docs/ambientes.md)** — como os ambientes de desenvolvimento e produção são separados.

---

## Verificações automáticas

O repositório roda verificações a cada push (GitHub Actions): identificação de
arquivos e SonarQube. Somam-se a elas, no fluxo de manutenção:

- `npm run auditar-sql` — garante que nenhuma consulta SQL use texto concatenado;
- `npx tsc --noEmit` e `npx eslint` — tipos e padrões do frontend;
- **backup semanal do banco** (ação `backup-banco.yml`) — gera um `pg_dump` da Neon e guarda como artefato.
