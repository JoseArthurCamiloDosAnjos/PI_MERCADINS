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

O `.dump` é o formato nativo do `pg_dump` — restaura com `pg_restore`:

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

## Como as migrações se relacionam com o backup

- Cada migração tem um identificador fixo (`001…`, `002…`) registrado em
  `schema_migrations` — rodar `npm run migrate` não repete o que já foi feito;
- Se um backup for restaurado, ele já traz o `schema_migrations` da época do
  backup — basta rodar `npm run migrate` para aplicar o que faltou até hoje;
- Nunca altere um arquivo de migração já aplicado: crie um novo arquivo com o
  próximo número.

---

## Checklist antes de mudanças grandes

- [ ] Disparar o backup manual (Actions → Run workflow);
- [ ] Esperar a ação terminar verde e conferir o tamanho do artefato;
- [ ] Só então aplicar a mudança em produção;
- [ ] Se algo der errado, restaurar a partir do artefato conforme acima.
