# Ambientes: desenvolvimento e produção (item C4)

Este documento explica como o Mercadins separa o ambiente de **desenvolvimento**
(o computador de quem programa) do ambiente de **produção** (o site que os
clientes usam), e como manter essa separação sem segredo.

---

## Os dois ambientes, lado a lado

| O quê | Desenvolvimento | Produção |
|---|---|---|
| **Site (frontend)** | `http://localhost:5173` (Vite) | `https://mercadins.com.br` (Vercel) |
| **API (backend)** | `http://localhost:3001` (nodemon) | `https://pi-mercadins.onrender.com` (Render) |
| **Banco de dados** | PostgreSQL local (`DATABASE_URL_LOCAL`) | Neon (`DATABASE_URL_NEON`) |
| **Variáveis** | Arquivo `Backend/.env` e `Frontend/.env` (não versionados) | Cadastradas na painel do Render e da Vercel |
| **E-mails** | Podem ficar desativados (sem chave) | Resend com chave de produção |

O backend escolhe qual banco usar pela variável `DB_PROVIDER`:

- `DB_PROVIDER=local` → usa `DATABASE_URL_LOCAL` (banco da própria máquina);
- `DB_PROVIDER=neon` → usa `DATABASE_URL_NEON` (banco online compartilhado pelo site no ar).

Assim, quem programa nunca arrisca apagar ou alterar dados do site real.

---

## Arquivos de exemplo (`.env.example`)

Cada pasta tem um modelo com todas as variáveis explicadas:

- `Backend/.env.example`
- `Frontend/.env.example`

Para ligar o projeto na sua máquina:

1. Copie o modelo: `copy Backend\.env.example Backend\.env` (mesmo raciocínio para o Frontend);
2. Preencha os valores locais (banco local, porta, chave de teste);
3. Nunca versione o `.env` preenchido — o `.gitignore` já bloqueia isso.

Os `.env.example` **são** versionados (não contêm valores reais) — servem de
documentação viva para quem chegar no projeto.

---

## O que NUNCA deve se misturar

1. **Chaves de produção ficam só nos serviços.** A chave do Resend, a senha do
   banco da Neon e o `JWT_SECRET` do site no ar existem apenas no Render/Vercel —
   nunca em arquivo commitado, nunca em mensagem de commit, nunca em print.
2. **Banco de produção não é usado para testar.** Testes de funcionalidade nova
   usam banco local (ou o banco da Neon apenas para dados de demonstração já
   preparados, como os mercados de exemplo).
3. **`.env` local não vai para o Git.** O `.gitignore` já impede; se um `.env`
   com segredo for commitado por engano, a chave deve ser **trocada** (apagar do
   histórico do Git não basta — assume-se que ela vazou).

---

## Como cada serviço recebe as variáveis em produção

### Render (backend)

1. Painel do serviço → **Environment** → **Add Environment Variable**;
2. Cadastrar: `NODE_ENV=production`, `DB_PROVIDER=neon`, `DATABASE_URL_NEON`,
   `JWT_SECRET`, `RESEND_API_KEY`, `FRONTEND_URL=https://mercadins.com.br`,
   `ALLOWED_ORIGINS=https://mercadins.com.br,https://www.mercadins.com.br`;
3. Salvar — o Render reinicia o serviço sozinho.

### Vercel (frontend)

1. Painel do projeto → **Settings** → **Environment Variables**;
2. Cadastrar `VITE_API_URL=https://pi-mercadins.onrender.com`;
3. Fazer um novo deploy (ou usar "Redeploy") para a variável valer.

---

## Checklist ao criar uma variável nova

- [ ] Adicionada ao `.env.example` com comentário explicando o que é;
- [ ] Valor de desenvolvimento testado localmente;
- [ ] Valor de produção cadastrado no Render/Vercel (conforme o caso);
- [ ] Nenhum valor real commitado;
- [ ] Código usa `process.env.NOME` (backend) ou `import.meta.env.VITE_NOME`
      (frontend) com um padrão seguro quando a variável falta.
