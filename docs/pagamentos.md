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
`webhook-security-token`):

| Evento | Efeito |
|---|---|
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | fatura gravada → assinatura `ativa` → mercado criado/reativado |
| `PAYMENT_OVERDUE` | assinatura `inadimplente` (a suspensão espera a carência) |
| `SUBSCRIPTION_DELETED` | assinatura `cancelada` |
| `externalReference` iniciado por `pedido:` | é pagamento de **pedido**, não de plano (§8) |

A gravação da fatura é **idempotente** (chave `asaas_payment_id` única): webhook
e consulta imediata podem chegar com a mesma cobrança sem duplicar nada.
Erros devolvem `500`, para o Asaas reenviar o evento (retry).

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

`PENDING` (liquidando) · `CONFIRMED` / `RECEIVED` (pago) · `OVERDUE` (vencido) ·
`REFUNDED` (estornado) · `FAILED`.

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

---

## 9. Banco de dados

| Tabela / coluna | Papel |
|---|---|
| `assinaturas` | um plano contratado: `codigo_plano`, `ciclo`, `valor`, `asaas_customer_id`, `asaas_subscription_id`, `status`, `proximo_pagamento`, `dados_mercado` (JSONB com o formulário da loja), `id_mercado` |
| `pagamentos` | faturas das assinaturas, com `asaas_payment_id` único (idempotência) |
| `mercados.suspenso_em` | data da suspensão por cobrança (migração `010`) |
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
| `Assas_API_KEY` | token de acesso à API do Asaas |
| `Assas_API_URL_Sandbox` / `Assas_API_URL_Producao` | base da API (o código escolhe pela `NODE_ENV`) |
| `ASAAS_WEBHOOK_TOKEN` | valor esperado no cabeçalho `webhook-security-token` (obrigatório em produção) |
| `FRONTEND_URL` | para onde o Asaas devolve o cliente após pagar (`/registrar-mercado?pagamento=1`) |

No painel do Asaas: criar a **integração de webhook** apontando para
`https://pi-mercadins.onrender.com/api/webhooks/asaas` e marcar os eventos de
pagamento (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`,
`SUBSCRIPTION_DELETED`). Em desenvolvimento, basta usar o botão
"Já paguei" — o caminho 2 do §3 substitui o webhook.

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
| `Chave da API do Asaas não configurada` | falta `Assas_API_KEY` no `.env` |
| Pix do **produto** falha só no site no ar | variáveis do Asaas ausentes/erradas no Render (ver checklist abaixo) |

### Diagnóstico rápido

```
GET /api/saude/pagamentos
```

Rota pública que devolve **só a presença** das variáveis (nenhum valor é
exposto):

```json
{ "ambiente": "producao",
  "asaas": { "url_usada": "https://api.asaas.com/", "chave_api": true,
             "url_producao": true, "webhook_token": true },
  "frontend_url": "https://mercadins.com.br" }
```

`chave_api: false` ou `url_usada: null` = variável não cadastrada no ambiente.

### Checklist de produção (Render)

- [ ] `Assas_API_KEY` = chave de **produção** (a de sandbox não serve na URL de produção);
- [ ] `Assas_API_URL_Producao=https://api.asaas.com/`;
- [ ] `NODE_ENV=production`;
- [ ] `FRONTEND_URL=https://mercadins.com.br`;
- [ ] `ASAAS_WEBHOOK_TOKEN` preenchido **e** a integração de webhook criada no
      Asaas apontando para `https://pi-mercadins.onrender.com/api/webhooks/asaas`
      (sem ela, o pedido só é confirmado quando o cliente abre a página do pedido);
- [ ] Depois de mexer em variável, deixar o Render reiniciar o serviço.

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
| `Backend/src/server.js` | montagem das rotas + job horário de vigência |
| `Backend/src/db/migrations/009_*.js`, `010_*.js` | tabelas de pagamento e `suspenso_em` |
| `Frontend/src/pages/RegistrarMercado/` | checkout, tela de aguardando pagamento e botão "Já paguei" |
| `Frontend/src/components/TelaAssinaturas/` | aba Assinaturas (cartões, mercado vinculado, cancelar) |
| `Frontend/src/services/api.ts` | `criarCheckout`, `minhaAssinatura`, `cancelarAssinatura` |

Referência das rotas: [docs/API.md](API.md).
