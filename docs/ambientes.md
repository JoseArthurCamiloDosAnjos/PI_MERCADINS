# Ambientes: desenvolvimento e produção (item C4)

Este documento explica como o Mercadins separa o ambiente de **desenvolvimento**
(o computador de quem programa) do ambiente de **produção** (o site que os
clientes usam), e como manter essa separação sem segredo.

---

## Os dois ambientes, lado a lado

| O quê | Desenvolvimento | Produção |
|---|---|---|
| **Site (frontend)** | `http://localhost:5173` (Vite) | `https://mercadins.com.br` (Render — `static_site` do blueprint `render.yaml`) |
| **API (backend)** | `http://localhost:3001` (nodemon) | `https://pi-mercadins.onrender.com` (Render) |
| **Banco de dados** | PostgreSQL local (`DATABASE_URL_LOCAL`) | Neon (`DATABASE_URL_NEON`) |
| **Variáveis** | Arquivos `Backend/.env`, `Frontend/.env` e `.env` da raiz (não versionados) | Cadastradas no painel do Render (backend e site) |
| **E-mails** | Podem ficar desativados (sem chave) | Resend com chave de produção |
| **Notificações por e-mail** | Enviadas com a `RESEND_API_KEY` (sem chave, ficam só no histórico) | Mesma `RESEND_API_KEY` no painel do Render |

> **Imagens:** as fotos (PNG, JPG e WEBP) são salvas na pasta local
> `Backend/imagens/<categoria>/` (ou na pasta indicada em `IMAGENS_DIR`) e só
> o **caminho** vai para o banco. No
> Render o disco é efêmero (some a cada deploy), por isso o upload também
> mantém uma cópia no Supabase Storage (bucket `imagens`) como backup.

O backend escolhe qual banco usar pela variável `DB_PROVIDER`:

- `DB_PROVIDER=local` → usa `DATABASE_URL_LOCAL` (banco da própria máquina);
- `DB_PROVIDER=neon` → usa `DATABASE_URL_NEON` (banco online compartilhado pelo site no ar);
- **sem a variável (padrão `auto`)** → tenta o Neon primeiro e usa o local como
  fallback — é o que acontece no Render, onde `DB_PROVIDER` nem é obrigatório.

Em produção o backend também detecta sozinho o ambiente (a variável `RENDER`
já é definida pela plataforma), então `NODE_ENV=production` não precisa ser
cadastrada à mão.

Assim, quem programa nunca arrisca apagar ou alterar dados do site real.

---

## Arquivos de exemplo (`.env.example`)

Cada pasta tem um modelo com todas as variáveis explicadas:

- `Backend/.env.example`
- `Frontend/.env.example`
- `.env.example` na raiz (só para o Docker — interpola o `compose.yaml`)

Para ligar o projeto na sua máquina:

1. Copie o modelo: `copy Backend\.env.example Backend\.env` (mesmo raciocínio para o Frontend);
2. Preencha os valores locais (banco local, porta, chave de teste);
3. Nunca versione o `.env` preenchido — o `.gitignore` já bloqueia isso.

Os `.env.example` **são** versionados (não contêm valores reais) — servem de
documentação viva para quem chegar no projeto.

---

## O que NUNCA deve se misturar

1. **Chaves de produção ficam só nos serviços.** A chave do Resend, a senha do
   banco da Neon, o `JWT_SECRET` e a chave do Asaas do site no ar existem
   apenas no painel do Render — nunca em arquivo commitado, nunca em mensagem
   de commit, nunca em print.
2. **Banco de produção não é usado para testar.** Testes de funcionalidade nova
   usam banco local (ou o banco da Neon apenas para dados de demonstração já
   preparados, como os mercados de exemplo).
3. **`.env` local não vai para o Git.** O `.gitignore` já impede; se um `.env`
   com segredo for commitado por engano, a chave deve ser **trocada** (apagar do
   histórico do Git não basta — assume-se que ela vazou).

---

## Como cada serviço recebe as variáveis em produção

O blueprint **`render.yaml` na raiz** define os dois serviços (backend e site)
e a maioria das variáveis. Os valores com `sync: false` são cadastrados à mão
no painel na primeira sincronização.

### Render — backend (`mercadins-backend`)

1. Painel do serviço → **Environment** → **Add Environment Variable**;
2. Cadastrar as que não vêm do blueprint (`sync: false`):
   `DATABASE_URL_NEON`, `JWT_SECRET`, `RESEND_API_KEY`,
   `Assas_API_KEY_Producao` (chave de produção do Asaas — ou a legada
   `Assas_API_KEY`, que vale para os dois ambientes), `ASAAS_WEBHOOK_TOKEN`;
3. As demais já vêm do `render.yaml`: `FRONTEND_URL`, `ALLOWED_ORIGINS`,
   `Assas_API_URL_Producao`, `Assas_API_URL_Sandbox`;
4. **Notificações por e-mail:** são enviadas com a própria `RESEND_API_KEY`
   já cadastrada no passo 2 — nenhuma variável extra é necessária. Sem a
   chave, os avisos continuam gravados no histórico com status `registrada`;
5. **Pagamentos (Asaas):** o `render.yaml` já publica o site com
   `ASAAS_AMBIENTE=sandbox` — o build no ar usa a API de **teste** (cadastre
   `Assas_API_KEY_Sandbox`, ou a chave de sandbox em `Assas_API_KEY`). Para
   faturar de verdade, troque a variável para `producao` no painel e use a
   chave de produção (detalhes em [pagamentos.md](pagamentos.md) §10). No
   desenvolvimento o servidor já cai no sandbox por padrão;
6. Salvar — o Render reinicia o serviço sozinho.

### Render — site (`mercadins-frontend`, static_site)

1. Painel do serviço → **Environment**;
2. `VITE_API_URL=https://pi-mercadins.onrender.com` já vem do `render.yaml`;
3. Cadastrar também (opcionais — backup das imagens no Supabase; sem elas o
   app roda normal, só sem o backup): `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`;
4. Fazer um novo deploy para as variáveis `VITE_*` valerem (elas entram no build).

> O repositório não tem `vercel.json` — o deploy do site é o `static_site` do
> `render.yaml`. Se algum dia o site passar para outro serviço (ex.: Vercel),
> basta cadastrar as mesmas variáveis `VITE_*` no painel de lá.

---

## Checklist ao criar uma variável nova

- [ ] Adicionada ao `.env.example` com comentário explicando o que é;
- [ ] Valor de desenvolvimento testado localmente;
- [ ] Valor de produção cadastrado no Render (backend ou site, conforme o caso);
- [ ] Nenhum valor real commitado;
- [ ] Código usa `process.env.NOME` (backend) ou `import.meta.env.VITE_NOME`
      (frontend) com um padrão seguro quando a variável falta.

---

## Docker local

O `compose.yaml` da raiz sobe Postgres + API + site em containers (ver
[README — Docker](../README.md#6-docker-opcional)):

- O `.env` **da raiz** alimenta o build do frontend (`VITE_*`);
- O `Backend/.env` é lido pelo serviço `backend` (formato `raw`, para o token
  do Asaas que começa com `$`) — se faltar, o compose segue assim mesmo;
- O compose força `DB_PROVIDER=local` apontando para o Postgres do container;
- As migrações rodam sozinhas na subida do backend
  (`node src/db/migrate.js && node src/server.js`).
