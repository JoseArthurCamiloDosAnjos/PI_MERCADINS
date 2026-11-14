# Sistema de pagamento — assinaturas e pedidos

Como o Mercadins cobra, confirma e controla o acesso de cada loja: o fluxo
completo desde a escolha do plano até a suspensão automática de um mercado
cujo pagamento venceu.

Toda a cobrança é feita pelo **Asaas** (Pix, boleto e cartão). O Mercadins
não guarda dado de cartão — guarda só o resultado da cobrança.

---

## 1. Planos e preços

| Código (banco) | Nome comercial | Mensal | Anual (−20%) | Limite de produtos | Limite de fotos |
|---|---|---|---|---|---|
| `basico` | Essencial | R$ 79,00 | R$ 756,00 | 300 | 600 |
| `profissional` | Plus | R$ 149,00 | R$ 1.428,00 | 1.500 | 3.000 |
| `personalizado` | Personalizado | sob consulta | sob consulta | 5.000 | 10.000 |

- Preços do Asaas ficam em `Backend/src/services/asaasService.js`;
  limites de produtos/fotos ficam em `Backend/src/utils/planos.js` (fonte única
  usada pelo cadastro, pelo produto e pelo painel).
- O anual é calculado no servidor: `floor(mensal × 0,8) × 12` — o mesmo número
  exibido na tela de planos.
- `personalizado` **não tem cobrança automática**: é vendido fora do sistema e
  aplicado pelo administrador. Ele serve também de plano "de rede" (a carência
  atinge todos os mercados do dono, ver §5).

---

## 2. Fluxo da assinatura (passo a passo)

```
RegistrarMercado ──POST /api/assinaturas/checkout──► Asaas (customer + assinatura)
        │                                                │
        │  grava assinatura 'pendente' + dados_mercado    │ link de pagamento
        │  (o mercado AINDA não existe)                  ▼
        └──────────────► tela "Aguardando pagamento"  cliente paga (Pix/boleto/cartão)
                                                            │
                                          ┌─────────────────┴──────────────────┐
                                          │  webhook  OU  consulta imediata    │
                                          └─────────────────┬──────────────────┘
                                                            ▼
                       status 'ativa' + vencimento +1 ciclo + mercado criado
```

1. **Checkout** — `POST /api/assinaturas/checkout` recebe
   `{ codigo_plano, ciclo, mercado }`. O payload do mercado é **validado**
   (mesma validação do cadastro direto) e guardado em `assinaturas.dados_mercado`.
   Em seguida cria *customer* e *assinatura* no Asaas e devolve `urlCheckout`.
   Se já existir assinatura `pendente`/`ativa`/`inadimplente`, ela é **retomada**
   em vez de criar outra.
2. **Aguardando pagamento** — a assinatura fica `pendente`; o cliente é levado ao
   checkout do Asaas e volta para `/registrar-mercado?pagamento=1`.
3. **Confirmação** — ao confirmar o pagamento (§3): status vira `ativa`,
   `proximo_pagamento` é recalculado no servidor (`+1 mês` ou `+1 ano`), a fatura
   é gravada e **o mercado é criado** a partir de `dados_mercado` (é nesse momento
   que a loja passa a existir).
4. **Renovação** — o Asaas continua cobrando sozinho; cada cobrança confirmada
   estende `proximo_pagamento`.
5. **Vencimento sem pagamento** — vira `inadimplente` e, após a carência, o
   mercado é suspenso (§5).

---

## 3. Quem confirma o pagamento

São **três caminhos** (todos aplicam a mesma rotina: gravar fatura → ativar a
assinatura → criar/reativar o mercado):

| # | Caminho | Quando roda | Arquivo |
|---|---|---|---|
| 1 | **Webhook** `POST /api/webhooks/asaas` | quando o Asaas avisa (produção) | `assinaturaController.webhookAsaas` |
| 2 | **Consulta imediata** no `GET /api/assinaturas/minha` | em toda chamada da tela, para assinaturas `pendente`/`inadimplente` | `assinaturaController.sincronizarComAsaas` |
| 3 | **Varredura de vigência** | na subida do servidor e a cada hora | `vigenciaService.encerrarVencidas` |

> **Por que existe o caminho 2:** em desenvolvimento o Asaas **não alcança
> `localhost`** — o webhook nunca chega. A consulta imediata faz o botão
> *"Já paguei — atualizar status"* confirmar o pagamento na hora, e também
> cobre atraso/queda do webhook em produção. Se o pagamento ainda estiver
> liquidando, a tela mostra "aguardando confirmação do banco".

Eventos tratados pelo webhook (validado pelo cabeçalho
`asaas-access-token` — com fallback para o legado `webhook-security-token`):

| Evento | Efeito |
|---|---|
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | fatura gravada → assinatura `ativa` → mercado criado/reativado |
| `PAYMENT_OVERDUE` | assinatura `inadimplente` (a suspensão espera a carência) |
| `SUBSCRIPTION_DELETED` | assinatura `cancelada` |
| `externalReference` iniciado por `pedido:` | é pagamento de **pedido**, não de plano (§8) |

**Idempotência em duas camadas:** (1) cada evento é registrado na tabela
`asaas_eventos` (coluna `asaas_event_id` única) **antes** de processar — o
mesmo `id` de evento do Asaas (“at least once”) não reexecuta a regra de
negócio; (2) a gravação da fatura é idempotente (chave `asaas_payment_id`
única) e as transições de pedido usam `UPDATE … WHERE status = … RETURNING`.
Erros de processamento devolvem `500` e liberam o evento (retry do Asaas);
eventos já `DONE` respondem `200` com `duplicado: true` sem reprocessar.
A validação é **fail-closed**: sem `ASAAS_WEBHOOK_TOKEN` o webhook responde
`401` (não processa eventos anônimos).

---

## 4. Estados

### Assinatura (`assinaturas.status`)

| Status | Significado | Loja |
|---|---|---|
| `pendente` | criada, 1ª cobrança ainda não confirmada | ainda não existe |
| `ativa` | pagamento confirmado / vigência válida | **no ar** |
| `inadimplente` | vencida (vigência + carência estouradas) | `suspenso` após a carência |
| `cancelada` | cancelada pelo cliente ou no Asaas | fica no ar **até** `proximo_pagamento` |

### Cobrança no Asaas (`pagamentos.status`)

Classes distintas (helper `classificarStatusAsaas` em `asaasService.js`) —
**não são equivalentes**:

| Classe | Status Asaas | Efeito no pedido / assinatura |
|---|---|---|
| `pago_aprovado` | `CONFIRMED` | pedido → `pendente`; assinatura → `ativa` (funds em compensação, ex.: cartão) |
| `pago_liquidado` | `RECEIVED`, `RECEIVED_IN_CASH` | idem + sincroniza repasses |
| `aguardando` | `PENDING`, `AWAITING_RISK_ANALYSIS`, `PENDING_RISK_ANALYSIS` | nenhuma transição |
| `vencido` | `OVERDUE` | assinatura → `inadimplente`; pedido permanece aguardando |
| `falha` | `DELETED`, `FAILED`, `EXPIRED` | cancela pedido (devolve estoque/cupom) |
| `estorno_solicitado` | `REFUND_REQUESTED` | **não cancela** — só registra; aguarda `REFUNDED` |
| `estorno_concluido` | `REFUNDED`, `CHARGBACK_*` | pedido já pago → cancela com devoluções; assinatura → log `CRÍTICO` (sem rebaixar automático) |

### Mercado (`mercados.status`)

| Status | Quando | Visibilidade |
|---|---|---|
| `ativo` | normal | aparece em busca, vitrine e sitemap |
| `suspenso` | pagamento vencido + carência | **some** de tudo (os filtros usam `status='ativo'`) |
| `bloqueado` | punição manual do administrador | nunca é tocada pelo sistema de cobrança |

---

## 5. Vigência, carência e suspensão

- **Vigência:** `proximo_pagamento` = fim do período pago. Mensal `+1 mês`,
  anual `+1 ano`, calculado no servidor (`proximaVigencia`), respeitando o dia do
  mês (31/01 + 1 mês → 28/02).
- **Carência: 3 dias** (`CARENCIA_DIAS` em `vigenciaService.js`). Passou desse
  prazo, a assinatura vira `inadimplente` e o mercado, `suspenso`
  (`suspenso_em` preenchido).
- **Escopo da suspensão/reativação:**
  - plano `personalizado` → **todos** os mercados onde o usuário é dono;
  - demais planos → **apenas** `assinaturas.id_mercado`.
- **Reativação:** pagamento confirmado → `suspenso` volta a `ativo` e
  `suspenso_em` é limpo. Loja `bloqueada` nunca muda.
- A varredura roda **na subida da API e a cada hora**, e também sob demanda em
  `GET /api/assinaturas/minha` (a tela já mostra a suspensão mesmo que o job
  tenha atrasado).

---

## 6. Cancelar o plano

Rota: `POST /api/assinaturas/:id/cancelar` (só a própria conta).

1. cancela a assinatura **no Asaas** (nada mais será cobrado);
2. marca `status = 'cancelada'` localmente;
3. **não mexe na loja**: ela segue no ar até `proximo_pagamento` e só depois
   cai na varredura e é suspensa.

Na tela (**Assinaturas** na sidebar) o botão abre um modal explicando exatamente
isso antes de confirmar.

---

## 7. Tela "Assinaturas" (frontend)

`GET /api/assinaturas/minha` devolve:

| Campo | Conteúdo |
|---|---|
| `assinatura` | a assinatura mais recente (compatível com o fluxo de checkout) |
| `assinaturas` | **lista com todas** — plano, ciclo, validade, dias restantes, `mercado` vinculado (nome + status) e `url_pagamento` |
| `plano`, `validade_ate`, `dias_restantes`, `carencia_dias` | resumo da principal |
| `mercado_status` / `mercado` | loja ligada à assinatura / recém-criada |
| `pagamento_asaas` | última cobrança vista no Asaas (`PENDING` = ainda liquidando) |
| `pagamentos` | faturas locais |
| `urlPagamento` | link de pagamento, quando `pendente` |

Como **cada loja pode ter um plano diferente**, cada assinatura vira um cartão
próprio com a linha **"Mercado vinculado"** — assim dá para ver qual loja cada
cobrança cobre quando o usuário tem mais de uma. Arquivo:
`Frontend/src/components/TelaAssinaturas/`.

### Criar outra loja (segunda assinatura)

`POST /api/assinaturas/checkout` aceita o mesmo usuário várias vezes: **uma
assinatura por loja**. O que acontece com a assinatura existente depende dela:

| Situação da assinatura existente | O que o checkout faz |
|---|---|
| Já virou loja (`ativa`/`inadimplente` com `id_mercado`) | **não bloqueia** — cria uma assinatura nova para a loja nova |
| `pendente` com o **mesmo formulário** | retoma o **mesmo** link de pagamento (sem cobrança em dobro) |
| `pendente` com formulário **diferente** | cancela a pendência antiga e cria outra com o formulário novo |
| Pagamento confirmado mas a loja não nasceu (webhook falhou) | cria a loja na hora e devolve `mercado` (sem cobrar de novo) |

A nova assinatura nasce `pendente` com o formulário guardado em
`dados_mercado` e aparece na tela junto com as demais. Teste automatizado
(Asaas mockado, roda sem internet e limpa o que cria):

```bash
node scripts/teste-segunda-loja.js --db=local
```

---

## 8. Pagamento de pedidos (compra no mercado)

O mesmo Asaas é usado na compra de produtos (`forma_pagamento`):

| Forma | Comportamento |
|---|---|
| `presencial` (padrão) | paga direto com o lojista; nada passa pelo Asaas |
| `pix` | cria cobrança Pix (`criarPagamentoPedidoPix`) e devolve QR + copia e cola |
| `cartao` | cria cobrança com cartão (`criarPagamentoPedidoCartao`) |

Diferença fundamental: essas cobranças vêm com
`externalReference = "pedido:<id>"`, enquanto as de plano vêm com
`subscription`. O webhook separa os dois casos logo no início — os pedidos passam
por `processarPagamentoPedido` (que confere o status direto no Asaas antes de
dar baixa no estoque) e nunca mexem em assinatura.

Quando o mercado tem `asaas_wallet_id`, a cobrança é criada com **Split**
(`splits: [{ walletId, percentualValue: 100 }]`): o valor líquido vai direto
para a conta Asaas do vendedor — ver [§13](#13-split-de-pagamento-dinheiro-direto-ao-vendedor).

A confirmação de um pedido é **idempotente**: webhook e o fallback do
`GET /pedido` disputam a mesma transição `aguardando_pagamento → pendente`
com `UPDATE ... WHERE status = 'aguardando_pagamento' RETURNING` — só quem
atualiza a linha dispara e-mail e registra a notificação no histórico (nunca
em dobro).

---

## 9. Banco de dados

| Tabela / coluna | Papel |
|---|---|
| `assinaturas` | um plano contratado: `codigo_plano`, `ciclo`, `valor`, `asaas_customer_id`, `asaas_subscription_id`, `status`, `proximo_pagamento`, `dados_mercado` (JSONB com o formulário da loja), `id_mercado` |
| `pagamentos` | faturas das assinaturas, com `asaas_payment_id` único (idempotência) — migração `004` (renomeada em `009`) |
| `mercados.suspenso_em` | data da suspensão por cobrança (migração `010`) |
| `mercados.asaas_wallet_id` | carteira Asaas do vendedor, destino do split dos pedidos online (migração `015`) |
| `repasses` | conciliação de cada repasse ao vendedor: `asaas_split_id`, `status` (`PENDENTE`/`DONE`/`CANCELLED`/`REFUSED`/`DIVERGENCE_BLOCK`/`RETIDO_PLATAFORMA`), `valor`, `motivo` (migração `015`) |
| `pagamentos_legado` | antiga tabela de pagamentos, renomeada pela migração `009` (esquema antigo incompatível) |

Migrações aplicadas com:

```bash
cd Backend
npm run migrate -- --db=neon      # produção/compartilhado
npm run migrate                   # banco local (DB_PROVIDER)
```

> No Render a migração **não roda sozinha** (`render.yaml` só faz build) —
> aplique manualmente antes de subir código que dependa de coluna nova.

---

## 10. Configuração (variáveis e painel do Asaas)

| Variável (Backend) | O que é |
|---|---|
| `ASAAS_AMBIENTE` | opcional: `sandbox` ou `producao` — força qual ambiente usar. Em branco = **sandbox** (default seguro); produção só por explícito: `ASAAS_AMBIENTE=producao` ou prefixo `$aact_prod_` da chave legada quando não há chaves por ambiente. `NODE_ENV`/`RENDER` **não** inferem mais produção (evita subir para produção sem autorização/credenciais) |
| `Assas_API_KEY_Sandbox` | chave da API no ambiente de **sandbox** (testes) |
| `Assas_API_KEY_Producao` | chave da API no ambiente de **produção** (vendas reais) |
| `Assas_API_KEY` | chave única (legada) — vale para os dois ambientes quando as específicas não estão preenchidas |
| `Assas_API_URL_Sandbox` / `Assas_API_URL_Producao` | base da API de cada ambiente (o código escolhe junto com o ambiente ativo) |
| `ASAAS_WEBHOOK_TOKEN` | valor esperado no cabeçalho `asaas-access-token` (legado: `webhook-security-token`). **Obrigatório**: sem ele o webhook responde `401` e não processa (fail-closed). Vários tokens? Separe por vírgula — assim webhook de sandbox e de produção valem para a mesma URL. Cadastre o MESMO valor como “Auth Token” da integração de webhook no painel do Asaas |
| `FRONTEND_URL` | para onde o Asaas devolve o cliente após pagar (`/registrar-mercado?pagamento=1`) |

**Sandbox × produção:** a chave de sandbox **não** vale na URL de produção e
vice-versa. Por isso cada ambiente tem a sua chave: a mesma máquina pode ter as
duas cadastradas e o servidor sempre escolhe a par com a URL certa (não existe
mais risco de mandar a chave errada para o ambiente errado).

**Build publicado em sandbox (padrão atual):** o `render.yaml` traz
`ASAAS_AMBIENTE=sandbox`, então o site no ar fala com a API de **teste**
mesmo rodando com `NODE_ENV=production` — serve para colocar tudo no ar e
testar pagamento sem movimentar dinheiro. Para isso funcionar no Render:

- cadastrar `Assas_API_KEY_Sandbox` (ou deixar a chave de sandbox na
  `Assas_API_KEY`) — o boot loga `Asaas: conexão OK — ambiente sandbox …`;
- registrar o webhook também na **conta sandbox**, apontando para
  `https://pi-mercadins.onrender.com/api/webhooks/asaas`, e cadastrar o token
  em `ASAAS_WEBHOOK_TOKEN`.

**Para faturar de verdade (requer autorização explícita):** não altere
`ASAAS_AMBIENTE` por conta própria — a mudança para `producao` no painel do
Render só deve ser feita quando houver **autorização explícita** e as
credenciais correspondentes (`Assas_API_KEY_Producao` + webhook da conta de
produção) já cadastradas. O código **não** cai em produção sozinho: sem a
variável o default é `sandbox`. Depois da troca, reinicie o serviço e confira
no log as linhas `Asaas: ambiente producao …` + `Asaas: conexão OK …`.

No painel do Asaas: criar a **integração de webhook** apontando para
`https://pi-mercadins.onrender.com/api/webhooks/asaas` e marcar os eventos de
pagamento (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`,
`SUBSCRIPTION_DELETED`). Faça isso **nas duas contas** (sandbox e produção) —
se os tokens de webhook forem diferentes, cadastre os dois em
`ASAAS_WEBHOOK_TOKEN` separados por vírgula. Em desenvolvimento, basta usar o
botão "Já paguei" — o caminho 2 do §3 substitui o webhook.

Nunca versione chaves: só `.env.example` (sem valores) vai para o Git — ver
[docs/ambientes.md](ambientes.md).

---

## 11. Como testar

1. `cd Backend && npm run dev` (ou `dev:neon`) + `cd Frontend && npm run dev`;
2. Preencher o cadastro de mercado e escolher plano/ciclo → cai em
   "Aguardando pagamento";
3. Pagar no checkout do Asaas (sandbox) **ou** clicar em
   **"Já paguei — atualizar status"**;
4. Esperado: assinatura `ativa`, loja criada, validade `+1 mês` (ou `+1 ano`) e
   a fatura aparecendo em "Últimos pagamentos";
5. Na aba **Assinaturas**: cartão com o mercado vinculado e o botão
   **Cancelar plano**.

Sintomas e causas:

| Sintoma | Causa provável |
|---|---|
| "aguardando confirmação do banco" | cobrança `PENDING` no Asaas — ainda não liquidou (normal em Pix de teste) |
| Pagou e a loja não apareceu | conferir `GET /api/assinaturas/minha` e o log do webhook; a consulta imediata deve resolver sozinha |
| `Dados do mercado inválidos` na ativação | payload de `dados_mercado` fora do formato normalizado (a validação é idempotente, veja `marketController.validarDadosMercado`) |
| `Chave da API do Asaas não configurada` | falta `Assas_API_KEY` (ou `Assas_API_KEY_Sandbox`/`_Producao`) no `.env` |
| Pix do **produto** falha só no site no ar | variáveis do Asaas ausentes/erradas no Render (ver checklist abaixo) |
| `401 A chave de API fornecida é inválida` (`invalid_access_token`) | chave **revogada/expirada** — gere outra no painel (Integrações > Chaves API) e atualize no `.env`/Render |
| `401` com `invalid_environment` (ou `403`) do Asaas / `401 A chave de API informada não pertence a este ambiente` | chave do ambiente errado (sandbox na produção ou vice-versa) — confira no log a linha `Asaas: ambiente … [chave: …]` e o `GET /api/saude/pagamentos` |
| `Não há nenhuma chave Pix disponível para receber cobranças` | a **conta Asaas daquele ambiente** não tem chave Pix cadastrada — cadastrar em *Chaves Pix* no painel (sandbox e produção são contas separadas); até lá o cliente pode pagar de **cartão** |
| Pedido criado mas **QR vazio** | o `/pixQrCode` demorou — o backend tenta 3× e a tela consulta a cada 10s; se seguir vazio, veja o log `não foi possível buscar o QR do Pix` |

### Diagnóstico rápido

```
GET /api/saude/pagamentos   (requer login de administrador)
```

Rota pública que devolve **só a presença** das variáveis + um **teste ao vivo
da chave** (cache de 30s; nenhum valor sensível é exposto):

```json
{ "ambiente": "producao",
  "banco": "auto",
  "asaas": { "ambiente": "producao",
             "url_usada": "https://api.asaas.com", "chave_api": true,
             "chave_fonte": "Assas_API_KEY_Producao",
             "chave_sandbox": true, "chave_producao": true,
             "url_producao": true, "url_sandbox": true,
             "chave_status": "ok", "chave_detalhe": null,
             "webhook_token": true, "webhook_tokens": 1 },
  "frontend_url": "https://mercadins.com.br" }
```

`asaas.ambiente` diz qual ambiente as chamadas estão usando agora;
`chave_api: false` ou `url_usada: null` = variável não cadastrada no ambiente.
`chave_sandbox`/`chave_producao` mostram se cada ambiente tem chave pronta
(legada `Assas_API_KEY` conta para os dois). Ao subir o servidor, o log mostra
também a linha `Asaas: ambiente sandbox → https://api-sandbox.asaas.com [chave: Assas_API_KEY_Sandbox]`.

`chave_status` é um **teste ao vivo** da credencial (cache de 30s): `ok` ·
`invalida` (chave revogada/expirada) · `ambiente_errado` (chave de outro
ambiente) · `sem_configuracao` · `erro` — `chave_detalhe` traz o motivo exato.

Do terminal (mesma verificação):

```bash
cd Backend
node scripts/verificarAsaas.js          # ambiente + validade da chave (só leitura)
node scripts/verificarAsaas.js --pix    # cria 1 cobrança Pix de teste e mostra o QR
```

### Checklist de produção (Render)

- [ ] `ASAAS_AMBIENTE` = `producao` (ou removida) — enquanto valer `sandbox`,
      o build publicado só testa e **não cobra de verdade**;
- [ ] `Assas_API_KEY_Producao` = chave de **produção** **válida** (a de sandbox não
      serve na URL de produção; chave revogada/expirada responde `401 invalid_access_token`);
- [ ] `Assas_API_URL_Producao=https://api.asaas.com/`;
- [ ] **Chave Pix** cadastrada e ativa na conta de produção do Asaas (sem ela
      o Pix do pedido falha com *"Não há nenhuma chave Pix disponível"*);
- [ ] `FRONTEND_URL=https://mercadins.com.br`;
- [ ] `ASAAS_WEBHOOK_TOKEN` preenchido **e** a integração de webhook criada no
      Asaas (conta de produção) apontando para `https://pi-mercadins.onrender.com/api/webhooks/asaas`
      (sem o webhook, o pedido só é confirmado quando o cliente abre a página;
      sem o token, o webhook funciona mas o servidor confere cada status na API);
- [ ] Depois de mexer em variável, deixar o Render reiniciar o serviço.

No log do Render, depois de subir, confira as duas linhas de confirmação:

```
Asaas: ambiente producao → https://api.asaas.com [chave: Assas_API_KEY_Producao]
Asaas: conexão OK — ambiente producao (https://api.asaas.com) com Assas_API_KEY_Producao
```

`conexão FALHOU … 401` com `invalid_environment` = chave de outro ambiente
(sandbox na produção ou vice-versa — no Render, confira `ASAAS_AMBIENTE`);
`401` sem esse código = chave revogada; `403` = permissão da chave.

### Checklist de sandbox (desenvolvimento)

- [ ] `Assas_API_KEY_Sandbox` = chave de **teste** do sandbox;
- [ ] `Assas_API_URL_Sandbox=https://api-sandbox.asaas.com/`;
- [ ] **Chave Pix** criada na conta sandbox (painel → Chaves Pix) — sem ela o
      Pix de teste falha; cartão e assinatura continuam funcionando;
- [ ] Split habilitado na conta sandbox (se for testar repasse ao vendedor);
- [ ] webhook criado também na conta sandbox (ou usar o botão "Já paguei");
- [ ] em `Backend/.env`: `ASAAS_AMBIENTE=sandbox` (opcional — sem ela o
      desenvolvimento já cai no sandbox por padrão);
- [ ] **build publicado (Render):** `ASAAS_AMBIENTE=sandbox` já vem no
      `render.yaml` — cadastrar `Assas_API_KEY_Sandbox` (ou a chave de sandbox
      em `Assas_API_KEY`) e registrar o webhook também na conta sandbox;
- [ ] subir e conferir no log do Render: `Asaas: conexão OK — ambiente sandbox …`.

Quando o pagamento online falha, a API responde `502` com
`{ "erro": "<mensagem traduzida>", "detalhe": "<motivo exato do Asaas>" }` — o
`detalhe` aparece no aviso da tela e nos logs do Render
(`Pedido <n> desfeito: pagamento não iniciado (...)`).

---

## 12. Onde está no código

| Arquivo | Responsabilidade |
|---|---|
| `Backend/src/services/asaasService.js` | cliente da API Asaas: customer, assinatura, cobranças, Pix/cartão de pedido, consulta de pagamentos |
| `Backend/src/controllers/assinaturaController.js` | checkout, `/minha` (com fallback), cancelamento, webhook |
| `Backend/src/services/vigenciaService.js` | vigência, carência, suspensão e reativação |
| `Backend/src/utils/planos.js` | limites por plano |
| `Backend/src/routes/assinaturaRoutes.js` | rotas de assinatura |
| `Backend/src/controllers/pedidoController.js` | webhook/fallback de pagamento de pedido (idempotência + avisos) |
| `Backend/src/utils/notificacoes.js` | registro das notificações (histórico por e-mail) no fluxo de pedido |
| `Backend/src/server.js` | montagem das rotas + job horário de vigência |
| `Backend/src/db/migrations/009_*.js`, `010_*.js` | tabelas de pagamento e `suspenso_em` |
| `Frontend/src/pages/RegistrarMercado/` | checkout, tela de aguardando pagamento e botão "Já paguei" |
| `Frontend/src/components/TelaAssinaturas/` | aba Assinaturas (cartões, mercado vinculado, cancelar) |
| `Frontend/src/services/api.ts` | `criarCheckout`, `minhaAssinatura`, `cancelarAssinatura` |

Referência das rotas: [docs/API.md](API.md).

---

## 13. Split de pagamento (dinheiro direto ao vendedor)

O Pix/cartão de um pedido pode cair **direto na conta Asaas do lojista**,
sem passar pela conta da plataforma. A plataforma não cobra comissão nas
vendas (coerente com o "0% de comissão" dos planos) — a receita dela é só
das assinaturas.

### Pré-requisitos (fora do código)

1. **Habilitar Split na conta emissora**: painel do Asaas →
   Integrações → Segurança → Habilitar Split (confirmação por SMS/token).
   Sem isso a API responde `invalid_action` e o sistema faz o fallback
   descrito abaixo.
2. Cada vendedor precisa de **conta Asaas própria** e o **walletId** dela
   (UUID tipo `48548710-9baa-4ec1-a11f-9010193527c6`). A plataforma cria
   essa conta automaticamente (subconta via `POST /v3/accounts`, ver fluxo
   abaixo) e grava o walletId sozinha; quem já tem conta no Asaas recupera o
   walletId com o suporte/`GET /v3/wallets` e cola no campo manual.
   Pré-requisito: a **conta-pai (plataforma) precisa ser Pessoa Jurídica
   (CNPJ)** — sem isso o Asaas recusa a criação da subconta.
3. O webhook precisa receber os eventos de split:
   `PAYMENT_SPLIT_DONE`, `PAYMENT_SPLIT_CANCELLED`,
   `PAYMENT_SPLIT_DIVERGENCE_BLOCK`, `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED`.

### Fluxo no sistema

1. O wallet vai para `mercados.asaas_wallet_id` (migração `015`) por um de
   três caminhos:
   - **automático no cadastro**: logo após a criação do mercado,
     `marketController.criarSubcontaDoMercado` chama `POST /v3/accounts`
     (subconta do vendedor, tipo de empresa padrão `LIMITED`) e grava o
     walletId — fire-and-forget: se falhar, o cadastro segue normalmente;
   - **botão "Criar conta automaticamente"** na aba **Recebimento** (o
     botão "Criar conta Asaas" da aba Financeiro leva até lá), com select
     do **tipo de empresa** (`companyType`: MEI/Ltda/Empresário/Associação —
     exigido pelo Asaas para CNPJ) → `POST /api/mercados/:id/asaas/subconta`;
   - **manual**: na mesma aba Recebimento, colar o walletId de uma conta
     Asaas já existente no campo "Wallet ID do Asaas".
2. Na criação do pedido online, `asaasService.montarSplitVendedor` monta
   `splits: [{ walletId, percentualValue: 100 }]` e a cobrança Pix/cartão
   é criada com esse array. O percentual é sobre o **líquido** (netValue,
   após a taxa do Asaas).
3. O split é executado pelo Asaas **no recebimento** da cobrança. O status
   de cada repasse é gravado em `repasses` (idempotente):
   - criação da cobrança → linha por split (`PENDENTE`) ou nenhuma linha
     (a sincronização do webhook completa);
   - webhook `PAYMENT_SPLIT_DONE` → linha vira `DONE` (valor já disponível
     na conta do vendedor); `PAYMENT_SPLIT_CANCELLED` → `CANCELLED`;
   - divergência de valor → `DIVERGENCE_BLOCK` (ajustar em 2 dias úteis).
4. **Fallback**: se o Split estiver desabilitado ou o wallet for recusado,
   a cobrança é refeita **sem split** (o pedido nunca falha por causa do
   split) e a linha fica `RETIDO_PLATAFORMA` — o financeiro do vendedor
   mostra o valor "Retido na plataforma" para conciliação manual
   (transferência entre contas Asaas: `POST /v3/transfers`).
5. Sem `asaas_wallet_id`, tudo continua como antes: o valor fica na conta
   da plataforma e a linha `RETIDO_PLATAFORMA` é registrada (motivo
   "Sem wallet do vendedor").
6. Cancelamento do pedido (cliente, falha de pagamento) apaga as linhas de
   `repasses` do pedido — o Asaas cancela o próprio split junto.

### Onde olhar

| Arquivo | Responsabilidade |
|---|---|
| `Backend/src/db/migrations/015_split_vendedor.js` | coluna `asaas_wallet_id` + tabela `repasses` |
| `Backend/src/services/asaasService.js` | `criarSubconta` (`POST /v3/accounts`), `montarSplitVendedor` + campo `splits` nas cobranças de pedido |
| `Backend/src/controllers/marketController.js` | `criarSubcontaDoMercado` (automático no cadastro + endpoint `POST /:id/asaas/subconta`), valida/grava `asaas_wallet_id` na edição |
| `Backend/src/routes/marketRoutes.js` | rota `POST /:id/asaas/subconta` |
| `Backend/src/controllers/pedidoController.js` | envia o split, grava `repasses`, sincroniza no webhook e no detalhe do pedido; `financeiroMercado` devolve o resumo `recebimento` |
| `Backend/src/controllers/assinaturaController.js` | webhook repassa `additionalInfo.splitId` dos eventos de split |
| `Frontend/.../RegistrarMercado` | campo "Recebimento das vendas" no cadastro da loja (opcional — sem ele, o backend cria a subconta sozinho) |
| `Frontend/.../GerenciamentoMercado` | **aba Recebimento** (status, select do tipo de empresa + botão "Criar conta automaticamente", wallet manual) e aviso com atalho na aba Financeiro |

### Teste rápido (sandbox)

1. Habilitar Split na conta sandbox e criar a conta do vendedor (aba
   Recebimento → "Criar conta automaticamente") ou cadastrar o walletId
   manualmente.
2. Fazer um pedido pagando com Pix e conferir em `repasses`:
   `SELECT * FROM repasses ORDER BY id DESC LIMIT 5;`
3. Confirmar o Pix no painel sandbox → webhook `PAYMENT_CONFIRMED` +
   `PAYMENT_SPLIT_DONE` → status `DONE` e o saldo cai na conta do vendedor
   (Visão financeira → Extrato, no painel do Asaas dele).

---

## 14. Retorno automático após o pagamento

Terminado o pagamento na página hospedada pelo Asaas, o cliente deve voltar
para o site. O backend envia `callback: { successUrl, autoRedirect: true }`
na criação da **assinatura**, da **cobrança de cartão** e do **Pix**:

| Fluxo | Para onde volta |
|---|---|
| Assinatura (plano da loja) | `/registrar-mercado?pagamento=1` (a tela lê `?pagamento=1` e confere o status) |
| Pedido (Pix e cartão) | `/pedidos/{id}` (acompanhamento; no Pix o QR fica lá) |

### Pix: dois fluxos, a mesma cobrança

O Pix tem **dois caminhos de pagamento para a mesma cobrança**:

1. **QR Code exibido dentro do Mercadins** (`/pedidos/{id}`) — o cliente paga
   no app bancário; o status chega por webhook/polling. O `callback` é
   **inerte** aqui (a página do Asaas nunca é aberta) — por isso ele **não é
   removido** da cobrança Pix;
2. **Página hospedada do Asaas** (`invoiceUrl`, link “Abrir a página de
   pagamento” na tela do pedido) — é o fluxo em que o `callback.successUrl`
   faz sentido (retorno automático após pagar).

Remover o `callback` do Pix degradaria o fluxo 2; mantê-lo não afeta o fluxo 1.

### Requisito fora do código

A `successUrl` precisa pertencer ao **domínio cadastrado na conta Asaas**
(painel → **Configurações da conta → Informações** — `mercadins.com.br`, nas
contas **sandbox e produção**). Sem isso a API recusa o `callback` e o
sistema cria a cobrança **sem retorno automático**, avisando no log:

```
Asaas: retorno automático NÃO configurado na cobrança Pix — cobrança criada
SEM redirecionamento. URL: https://mercadins.com.br/pedidos/12 | motivo: ...
```

### Comportamento quando o Asaas recusa o `callback`

O fallback — disparado apenas em **recusa de validação (4xx)** cuja mensagem
fala em `successUrl`, `callback` ou `domínio` — cria a cobrança sem
`callback` (o pagamento nunca falha por isso) e devolve `semRedirect: true`
em `checkout` (assinatura) e em `pagamento` (pedido). **`semRedirect: true`
só é retornado quando a cobrança foi efetivamente criada** (existe `id`); se a
recriação falhar, o erro é propagado e nenhum `semRedirect` é enviado. O
frontend então avisa a pessoa: *"O retorno automático não está ativo: ao
concluir o pagamento, use o botão voltar do navegador"* — e o botão manual
**"Ir para o pagamento"** continua disponível na tela de status.

Erros de **rede/timeout** não disparam esse fallback (são ambíguos — a
cobrança pode ter sido criada); o pedido é verificado por `externalReference`
antes de qualquer recriação/rollback (§8).

### Observações

- em desenvolvimento (`FRONTEND_URL=http://localhost:5173`) o redirect **nunca**
  é aceito — `localhost` não é domínio cadastrável; teste a volta automática
  no site publicado;
- **boleto** não redireciona: a confirmação não é imediata (só Pix e cartão
  têm `autoRedirect`);
- redirecionar **não** confirma pagamento — quem confirma é o webhook ou a
  consulta imediata (§3).
