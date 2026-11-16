# Backup e restauração do banco (item C3)

Como o Mercadins protege os dados de produção, e como restaurar se um dia for
preciso.

---

## O que existe

| Proteção | O que é |
|---|---|
| **Migrações versionadas** | Toda mudança de estrutura fica em um arquivo em `Backend/src/db/migrations/` e é aplicada **uma única vez** — o controle fica na tabela `schema_migrations` |
| **Backup automático** | Toda segunda-feira (03h de Brasília) o GitHub gera um `pg_dump` completo da Neon e guarda como artefato privado |
| **Backup manual** | Pelo botão **Run workflow** na aba Actions do GitHub — use antes de mudanças grandes |
| **Sincronização local → Neon** | Script `Backend/scripts/sincronizar-neon.js` — deixa o Neon igual ao banco local, com backup automático e preservando as senhas de produção (ver [§ Sincronizar](#sincronizar-o-banco-local-com-o-neon)) |

Arquivo da ação: `.github/workflows/backup-banco.yml`.

---

## Configuração (uma única vez)

1. No GitHub, abrir **Settings → Secrets and variables → Actions**;
2. Criar o segredo `DATABASE_URL_NEON` com a mesma URL de conexão usada no Render;
3. Pronto — a ação passa a rodar sozinha toda semana.

Sem esse segredo, a ação falha com mensagem explicando o que falta (nunca
gera um arquivo vazio fazendo parecer que há backup).

---

## Onde encontrar os backups

**GitHub → Actions → "Backup do banco (Neon)" → execução mais recente → Artifacts.**

Cada execução gera um arquivo `backup-mercadins-AAAA-MM-DD.dump`, que fica
disponível por 90 dias (artefatos privados do GitHub). Para guarda de longo
prazo, baixe o arquivo e guarde também em um local próprio (HD, nuvem).

---

## Como restaurar um backup

O `.dump` é o formato nativo do `pg_dump` — restaura com `pg_restore`
(ferramentas do cliente PostgreSQL instalado localmente, ex.:
`apt install postgresql-client` ou o instalador oficial para Windows):

```bash
# Restaurar tudo em um banco novo (ex.: conferir o backup)
pg_restore --dbname="postgresql://usuario:senha@host/novo_banco" backup-mercadins-2026-10-26.dump

# Restaurar apenas uma tabela (ex.: cupons)
pg_restore --table=cupons --dbname="postgresql://..." backup-mercadins-2026-10-26.dump
```

Restauração de um backup **por cima** do banco atual deve ser feita com
cuidado (substitui dados) — em dúvida, restaure primeiro em um banco novo e
confira.

---

## Sincronizar o banco local com o Neon

Quando o banco **local** é a fonte da verdade e você quer o Neon igualzinho
(ex.: depois de reorganizar os dados na sua máquina):

```bash
cd Backend
node scripts/sincronizar-neon.js --verificar                   # só confere (não mexe em nada)
node scripts/sincronizar-neon.js --executar --confirmar=neon   # copia local → Neon
```

A cópia é **sempre no sentido local → Neon** (nunca ao contrário) e faz, nesta ordem:

1. Confere se os dois bancos têm as mesmas tabelas **e as mesmas colunas** —
   se algo faltar, o script para e manda rodar `npm run migrate` (local) ou
   `node src/db/migrate.js --db=neon`;
2. Gera um backup completo do Neon em
   `%TEMP%\opencode\mercadins-backups\neon-antes-sync-AAAA-MM-DD.dump`;
3. Extrai **só os dados** do local (`pg_dump --data-only --column-inserts`);
4. Esvazia todas as tabelas do Neon (`TRUNCATE ... RESTART IDENTITY`) e restaura
   por cima;
5. **Devolve as senhas do Neon** — a coluna `senha` nunca é copiada do local para
   produção (cada guarda a própria senha por e-mail) e por isso fica **fora** da
   conferência;
6. Compara tabela a tabela (contagem de linhas + hash do conteúdo) e imprime
   `✅ Banco do Neon sincronizado com o local.`

Regras importantes:

- **É cópia de dados, não de estrutura.** Colunas, índices e tudo que é DDL
  continua sendo papel das migrações (nunca de sincronização);
- **Reversível:** o `.dump` do passo 2 devolve o Neon ao estado anterior
  (`pg_restore --no-owner --no-privileges <arquivo>`);
- **Nunca rode `pg_dump`/`pg_restore` pela URL da Neon com `-pooler`**
  (justamente a `DATABASE_URL_NEON`). O `pg_dump` grava
  `set_config('search_path','',false)` no início da sessão e o PgBouncer do
  pooler **compartilha** a conexão de servidor entre clientes — o valor vaza e o
  site inteiro passa a falhar com `relation "..." does not exist`. Para operação
  manual, troque `-pooler.` por `.` na URL (endpoint direto); o script já faz
  isso sozinho. Blindagem extra aplicada no banco:
  `ALTER DATABASE neondb SET search_path = public, pg_catalog` (toda conexão nova
  já nasce com `search_path` válido, inclusive as do pooler).

### Versão "só o essencial": `sincronizar-admin`

Para deixar os dois bancos iguais **mantendo apenas** as contas de administrador,
os mercados dessas contas (com categorias e produtos) e o catálogo do admin — o
demais é zerado:

```bash
cd Backend
node scripts/sincronizar-admin.js --exportar                       # grava backup-admin-export.json
node scripts/sincronizar-admin.js --db=neon    --aplicar --confirmar=neon
node scripts/sincronizar-admin.js --db=local   --aplicar --confirmar=local
node scripts/sincronizar-admin.js --verificar
```

O `--aplicar` preserva a senha vigente de **cada** banco por e-mail e reescreve
`http://localhost:3001` para a URL de produção nas URLs das imagens do catálogo.
O JSON exportado contém hashes de senha — por isso **não deve ser commitado**.

---

## Como as migrações se relacionam com o backup

- Cada migração tem um identificador fixo (`001…`, `002…`) registrado em
  `schema_migrations` — rodar `npm run migrate` não repete o que já foi feito;
- Se um backup for restaurado, ele já traz o `schema_migrations` da época do
  backup — basta rodar `npm run migrate` para aplicar o que faltou até hoje;
- Nunca altere um arquivo de migração já aplicado: crie um novo arquivo com o
  próximo número;
- O executor usa o **nome do arquivo** como id (ex.:
  `018_notificacoes_lida`) — o campo `id` do `module.exports` é só
  documentação. Por isso a duplicação de número `015_*` não quebra nada, mas
  deve ser evitada em migrações novas (use sempre o próximo número livre).

---

## Checklist antes de mudanças grandes

- [ ] Disparar o backup manual (Actions → Run workflow);
- [ ] Esperar a ação terminar verde e conferir o tamanho do artefato;
- [ ] Só então aplicar a mudança em produção;
- [ ] Se algo der errado, restaurar a partir do artefato conforme acima.
