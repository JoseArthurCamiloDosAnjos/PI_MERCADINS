# API do Mercadins — referência (item C9)

Documentação de todas as rotas HTTP do backend. Serve de guia para quem for
continuar o projeto, integrar um aplicativo futuro ou revisar o funcionamento.

- **Produção:** `https://pi-mercadins.onrender.com`
- **Desenvolvimento:** `http://localhost:3001`
- **Formato de dados:** JSON (as datas vêm em ISO 8601; os valores em reais, com ponto decimal)

## Como autenticar

A maioria das rotas exige estar logado. O login devolve um **token JWT**, que
acompanha os pedidos no cabeçalho:

```
Authorization: Bearer <token>
```

Rotas marcadas como *público* funcionam sem token; *opcional* aceitam com ou
sem (exibem informações extras para quem está logado, como "favoritado").

Erros seguem sempre o mesmo formato:

```json
{ "erro": "Mensagem em português para a pessoa usuária" }
```

---

## Autenticação — `/api/auth`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| POST | `/register` | público | Cria conta de cliente; envia código de verificação por E-mail (com limite de tentativas) |
| POST | `/login` | público | Valida E-mail + senha e devolve `{ token, usuario }` (limite de 10 tentativas/minuto; exige e-mail verificado — senão `403`) |
| GET | `/perfil` | token | Devolve o perfil de quem está logado |
| PUT | `/perfil` | token | Atualiza o perfil — **`nome` e `email` são obrigatórios no corpo**; opcionais: `telefone`, `data_nascimento`, `foto_perfil_url` |
| POST | `/verificar-email` | público | Confirma o código recebido por E-mail no cadastro |
| POST | `/reenviar-verificacao` | público | Reenvia o código de verificação |
| POST | `/esqueci-senha` | público | Dispara E-mail de recuperação de senha |
| POST | `/reenviar-recuperacao` | público | Reenvia o E-mail de recuperação |
| POST | `/redefinir-senha` | público | Define a nova senha a partir do código recebido |
| POST | `/trocar-senha` | token | Solicita troca de senha (envia código por E-mail) |
| POST | `/confirmar-troca-senha` | público | Confirma a troca com o código recebido |
| POST | `/solicitar-troca-email` | token | Solicita troca de E-mail (envia código para o endereço novo) |
| POST | `/confirmar-troca-email` | token | Confirma a troca de E-mail com o código |

Exemplo de login:

```bash
curl -X POST https://pi-mercadins.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@exemplo.com","senha":"SuaSenha@123"}'
# → { "token": "eyJhbGci...", "usuario": { "id_usuario": 1, "nome": "...", ... } }
```

---

## Mercados — `/api/mercados`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | público | Lista lojas ativas com paginação: `?page=1&limit=20&busca=texto` → `{ mercados, paginacao: { page, limit, total, totalPages }, stats }` |
| POST | `/` | token (**somente administrador**) | Cria uma loja direto (o usuário comum cria só via checkout de assinatura — ver Assinaturas) |
| GET | `/meus` | token | Lista as lojas do vendedor logado |
| GET | `/slug/:slug` | opcional | Abre a vitrine pelo endereço amigável (`/vitrine/meu-mercado`) — devolve loja, categorias, horários, entrega e avaliação |
| GET | `/:id` | opcional | Dados de uma loja pelo número |
| GET | `/:id/dashboard` | token | Painel do vendedor (vendas, pedidos e resumos) |
| PUT | `/:id` | token | Atualiza a loja (inclui taxa de entrega, pedido mínimo, entrega/retirada, cores, horários e wallet Asaas) |
| DELETE | `/:id` | token | Remove a loja |
| POST | `/:id/favoritar` | token | Adiciona aos favoritos do cliente |
| DELETE | `/:id/favoritar` | token | Remove dos favoritos |
| GET | `/:id/avaliacoes` | opcional | Avaliações e média da loja |
| POST | `/:id/avaliacoes` | token | Avalia a loja (nota 1–5 e texto) |
| PUT | `/:id/avaliacoes/:avaliacaoId` | token (dono) | Moderação: oculta/exibe uma avaliação da loja |
| GET | `/:id/avaliacoes-produtos` | token (dono) | Avaliações de produtos da loja (moderação no painel) |
| GET | `/:id/financeiro?ano=&mes=` | token | Resumo financeiro do mês (padrão: mês atual; inclui bloco `recebimento` com os repasses do Split) |

Rota auxiliar de lojas do logado (prefixo próprio): `GET /api/usuarios-mercados/meus`.

### Entrega e retirada (campos da loja)

Ao criar ou atualizar, a loja pode receber:

```json
{
  "taxa_entrega": 7.90,
  "pedido_minimo": 20,
  "oferece_entrega": true,
  "oferece_retirada": true
}
```

O `taxa_entrega` é cobrado no pedido de entrega; o `pedido_minimo` só trava
pedidos com entrega (retirada não tem mínimo).

### Recebimento — `asaas_wallet_id` (Split)

Campo opcional aceito na criação e na atualização (`PUT /:id`) da loja:

```json
{ "asaas_wallet_id": "48548710-9baa-4ec1-a11f-9010193527c6" }
```

- é o **walletId da conta Asaas do vendedor** (formato UUID ou id numérico);
- com wallet cadastrado, o Pix/cartão dos pedidos online é criado com
  Split de 100% do valor líquido → o dinheiro cai direto na conta do
  vendedor (sem comissão da plataforma);
- string **vazia limpa** o valor (volta ao comportamento antigo: valor na
  conta da plataforma); sem o campo no corpo, o banco não muda;
- validação no servidor: `^[A-Za-z0-9_-]{4,64}$` → erro
  `Wallet ID do Asaas inválido.`

Passo a passo para habilitar o Split no Asaas: ver
[docs/pagamentos.md §13](pagamentos.md#13-split-de-pagamento-dinheiro-direto-ao-vendedor).

---

## Cupons — `/api/mercados/:id/cupons`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | token (dono) | Lista os cupons da loja |
| POST | `/` | token (dono) | Cria um cupom |
| PUT | `/:cupomId` | token (dono) | Atualiza (inclusive ativar/desativar) |
| DELETE | `/:cupomId` | token (dono) | Apaga o cupom |
| POST | `/validar` | token | Testa um código no carrinho, antes de fechar o pedido |

Criação de cupom:

```json
{
  "codigo": "BEMVINDO10",
  "tipo": "percentual",
  "valor": 10,
  "min_pedido": 30,
  "max_usos": 100,
  "validade": "2026-12-31",
  "categorias": [12, 18]
}
```

- `tipo`: `percentual` (percentual) ou `valor` (valor fixo em reais);
- `max_usos` vazio/omitido = sem limite; `validade` vazia = não expira;
- `categorias` (opcional): lista de ids de categorias em que o cupom vale —
  vazio/omitido vale para a loja inteira;
- o desconto é sempre calculado **no servidor** — o cliente nunca envia o valor do desconto.

Validação no carrinho (`POST /validar`):

```json
{ "codigo": "BEMVINDO10", "subtotal": 87.5, "itens": [ { "id_categoria": 12, "preco": 10, "quantidade": 2 } ] }
```

---

## Assinaturas (planos das lojas) — `/api/assinaturas`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| POST | `/checkout` | token | Cria *customer* + assinatura no Asaas e devolve `{ idAssinatura, urlCheckout }` (o mercado só nasce depois, quando o pagamento confirma) |
| GET | `/minha` | token | **Todas** as assinaturas do usuário: plano, validade, dias restantes, **mercado vinculado**, faturas e link de pagamento |
| POST | `/:id/cancelar` | token | Cancela no Asaas e localmente (a loja segue no ar até o fim da vigência) |

Corpo do checkout:

```json
{
  "codigo_plano": "profissional",
  "ciclo": "mensal",
  "mercado": { "nome": "Mercado da Esquina", "descricao": "...", "horario": "...", "cats": "..." }
}
```

- `codigo_plano`: `basico` (Essencial) ou `profissional` (Plus);
- `ciclo`: `mensal` ou `anual`;
- `mercado`: o mesmo payload do cadastro de loja (validado no servidor e
  guardado em `assinaturas.dados_mercado`).

Fluxo completo, estados, carência de 3 dias e como testar:
**[docs/pagamentos.md](pagamentos.md)**.

---

## Webhook do Asaas — `POST /api/webhooks/asaas`

Recebe os eventos de pagamento do Asaas (assinaturas **e** pedidos online).
**Não usa JWT** — valida o cabeçalho `webhook-security-token` contra a variável
`ASAAS_WEBHOOK_TOKEN`: token diferente → `401`; variável ausente em produção →
`500` (em desenvolvimento sem a variável, processa mesmo assim).

| Evento | Efeito |
|---|---|
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` (assinatura) | Confirma a assinatura → cria a loja a partir de `dados_mercado` |
| `PAYMENT_OVERDUE` (assinatura) | Fatura vencida → assinatura fica `inadimplente` (a suspensão das lojas só ocorre após a carência) |
| `SUBSCRIPTION_DELETED` (assinatura) | Cancela a assinatura |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` / `RECEIVED_IN_CASH` (pedido — `externalReference "pedido:<id>"`) | Pedido `aguardando_pagamento` vira `pendente`; e-mails de confirmação ao cliente e aviso ao vendedor |
| Pagamento falhou (`DELETED`, `FAILED`, `EXPIRED`, `REFUNDED`…) no pedido | Cancela o pedido, devolve o estoque e apaga as linhas de `repasses` |
| `PAYMENT_SPLIT_*` | Sincroniza os repasses (tabela `repasses`) do Split |

---

## Diagnóstico

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/api/health` | público | Responde `{ status: "ok" }` (healthcheck do Render) |
| GET | `/api/saude/pagamentos` | público | Mostra o ambiente, o banco e a **presença** das variáveis do Asaas (nenhum segredo é exposto) |

Resposta de `/api/saude/pagamentos`:

```json
{ "ambiente": "producao",
  "banco": "auto",
  "asaas": { "url_usada": "https://api.asaas.com/", "chave_api": true,
             "url_producao": true, "url_sandbox": false, "webhook_token": true },
  "frontend_url": "https://mercadins.com.br" }
```

`chave_api: false` ou `url_usada: null` = variável não cadastrada no ambiente.

---

## Pedidos

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| POST | `/api/mercados/:id/pedidos` | token | Cria o pedido (valida estoque, mínimo e cupom; envia E-mail de confirmação) |
| GET | `/api/mercados/:id/pedidos` | token (dono) | Lista os pedidos da loja (com entrega, agendamento e cupom) |
| GET | `/api/pedidos/meus` | token | Acompanhamento do cliente: pedidos que ele fez |
| GET | `/api/pedidos/:id` | token | Detalhe de um pedido (cliente dono ou vendedor da loja) |
| PUT | `/api/pedidos/:id/status` | token (dono) | Muda o status e avisa o cliente por E-mail |
| POST | `/api/pedidos/:id/cancelar` | token | Cliente cancela o próprio pedido (se ainda for possível) |
| GET | `/api/pedidos/:id/itens-recompra` | token | Produtos do pedido com preço/estoque atuais (base do botão "comprar de novo") |
| DELETE | `/api/pedidos/:id/historico` | token | Cliente remove o pedido da própria lista |
| GET | `/api/usuario/historico` | token | Histórico de compras do cliente |

Corpo de um pedido:

```json
{
  "itens": [ { "id_produto": 254, "quantidade": 2 } ],
  "tipo_entrega": "entrega",
  "endereco_entrega": "Rua das Flores, 123 — Centro",
  "cupom": "BEMVINDO10",
  "agendamento": "Hoje à tarde",
  "observacao": "Trocar a nota, por favor",
  "forma_pagamento": "pix"
}
```

- `itens`: lista de `{ id_produto, quantidade }`;
- `tipo_entrega`: `entrega` (cobra a taxa e exige o pedido mínimo) ou `retirada` (taxa zero);
- `endereco_entrega` (opcional): endereço de entrega digitado pelo cliente;
- `cupom` (opcional): código validado no servidor — inválido, expirado ou abaixo do mínimo rejeita o pedido;
- `agendamento` (opcional): texto livre combinado com a loja;
- `observacao` (opcional): recado do cliente;
- `forma_pagamento`: `presencial` (padrão, paga na entrega), `pix` ou `cartao`.
  Nas duas últimas a cobrança é criada no Asaas com `externalReference
  "pedido:<id>"`; se a loja tem `asaas_wallet_id`, a cobrança sai com
  **Split de 100%** e o valor líquido vai direto para a conta do vendedor
  (ver [pagamentos.md §13](pagamentos.md#13-split-de-pagamento-dinheiro-direto-ao-vendedor)).

Status possíveis do pedido (`PUT /api/pedidos/:id/status`): a fila de avanço é
`pendente → preparo → caminho → entregue` (só avança, não volta); existem ainda
os estados especiais `aguardando_pagamento` (webhook ainda não confirmou) e
`cancelado` (não muda mais).

O servidor calcula: `total = subtotal − desconto + taxa de entrega` e grava tudo
no histórico, junto de `produto_ids` (base do selo "compra verificada").

O resumo financeiro da loja (`GET /:id/financeiro`) devolve o bloco
`recebimento` com o estado dos repasses do mês:

```json
"recebimento": {
  "walletCadastrado": true,
  "liquidado": 152.40,
  "pendente": 38.10,
  "retidoPlataforma": 0
}
```

---

## Avaliações de produto — `/api/mercados/:m/categorias/:c/produtos/:p/avaliacoes`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | opcional | Média, total e lista (com `minha` quando o logado já avaliou) |
| POST | `/` | token | Avalia o produto; `foto` (link) é opcional |

```json
{ "nota": 5, "texto": "Muito fresco", "foto": "https://.../produto.jpg" }
```

O campo `verificada` vem `true` quando quem avaliou **comprou** o produto
antes (checado no histórico de compras, no servidor).

---

## Categorias e produtos

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/api/mercados/:m/categorias` | público | Lista as categorias da loja |
| POST | `/api/mercados/:m/categorias` | token (dono) | Cria categoria |
| PUT | `/api/mercados/:m/categorias/:c` | token (dono) | Renomeia |
| DELETE | `/api/mercados/:m/categorias/:c` | token (dono) | Remove |
| GET | `/api/mercados/:m/categorias/:c/produtos` | público | Lista produtos |
| POST | `/api/mercados/:m/categorias/:c/produtos` | token (dono) | Cadastra produto (com imagens, custo e estoque) |
| PUT | `/api/mercados/:m/categorias/:c/produtos/:p` | token (dono) | Atualiza produto |
| DELETE | `/api/mercados/:m/categorias/:c/produtos/:p` | token (dono) | Remove produto |

O produto traz `estoque` e o `custo` cadastrado — no painel, a margem de lucro
é calculada a partir desse `custo` (é valor derivado, não um campo gravado).

---

## Catálogo de produtos prontos — `/api/catalogo`

O vendedor pode escolher "produto pronto" no card "＋" da vitrine: um item do
catálogo já vem com nome, descrição, fotos e preço sugerido — ao selecionar,
os dados são copiados para um produto normal da loja (o preço/estoque ficam
livres para ajuste).

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/api/catalogo?tipo=padaria` | público | Itens **ativos** do catálogo; `tipo` filtra por tipo de loja (sempre inclui os `geral`) |

Campos do item: `id`, `nome`, `descricao`, `imagens` (lista de URLs),
`preco_sugerido`, `tipo_loja` (`geral`, `mercado`, `hortifruti`, `acougue`,
`padaria`, `bebidas`, `organicos`, `conveniencia`).

CRUD completo (painel → aba "Catálogo"):

| Método | Rota | O que faz |
|---|---|---|
| GET | `/api/admin/catalogo` | Lista todos os itens (inclusive ocultos) |
| POST | `/api/admin/catalogo` | Cria item (`nome` obrigatório; `descricao`, `imagens`, `preco_sugerido`, `tipo_loja`) |
| PUT | `/api/admin/catalogo/:id` | Atualiza (edição parcial; aceita `ativo` para ocultar/restaurar) |
| DELETE | `/api/admin/catalogo/:id` | Remove item |

---

## Cliente — `/api/usuario` e `/api/carrinho`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/api/usuario/favoritos` | token | Lojas favoritadas (com foto, cidade, nota e situação) |
| GET | `/api/usuario/avaliacoes` | token | Avaliações de lojas feitas pelo cliente |
| GET | `/api/usuario/historico` | token | Compras do cliente |
| GET | `/api/carrinho/:mercadoId` | token | Carrinho salvo de uma loja |
| PUT | `/api/carrinho/:mercadoId` | token | Salva o carrinho (sobrevive ao fechar a aba) |
| DELETE | `/api/carrinho/:mercadoId` | token | Limpa o carrinho |

---

## Endereços de entrega — `/api/enderecos`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | token | Lista os endereços do cliente logado |
| POST | `/` | token | Cria um endereço |
| PUT | `/:id` | token | Atualiza um endereço |
| PUT | `/:id/principal` | token | Define o endereço como principal |
| DELETE | `/:id` | token | Remove o endereço |

---

## Notificações por telefone — `/api/notificacoes`

Avisos enviados (ou registrados) para o telefone do cadastro: conta criada,
e-mail confirmado, loja criada e andamento de pedidos. Sem provedor de
WhatsApp/SMS configurado, o aviso fica no histórico com o link "Abrir no
WhatsApp" e status `sem_provedor`. Variáveis de configuração: ver
`Backend/.env.example` (seção *Notificações por telefone*).

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | token | Últimos 50 avisos da conta e dos mercados que ela gerencia; devolve `naoLidas`, telefone, canal e `canalConfigurado` |
| POST | `/teste` | token | Envia/registra um aviso de teste no telefone do próprio usuário (limite 5 a cada 15 min) |
| POST | `/:id/lida` | token | Marca um aviso como lido (só os da própria conta) |
| POST | `/lidas` | token | Marca todos os avisos do usuário como lidos |

Os avisos gravados têm `status`: `enviada`, `sem_provedor`, `registrada` ou
`erro`. A listagem vem com `lida` (boolean) e não lidas primeiro.

---

## Depoimentos — `/api/depoimentos`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | opcional | Depoimentos visíveis; com token, devolve `minha` no depoimento de quem está logado |
| POST | `/` | token | Escreve (ou edita) o próprio depoimento |

---

## Busca — `/api/busca`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/produtos?q=pão` | público | Busca produtos em todas as lojas ativas (`q` = termo) |

---

## Administração — `/api/admin` (somente administrador)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/dashboard` | Números gerais da plataforma |
| GET | `/usuarios` · `/usuarios/:id` | Lista e detalhes de contas |
| PUT | `/usuarios/:id` · `/:id/bloquear` · `/:id/status` | Edita, bloqueia e muda situação |
| DELETE | `/usuarios/:id` | Exclui conta |
| GET | `/mercados` · `/mercados/:id` | Lista e detalhe de todas as lojas (moderação) |
| PUT | `/mercados/:id/bloquear` | Bloqueia uma loja |
| GET/POST | `/catalogo` · PUT/DELETE `/catalogo/:id` | CRUD do catálogo de produtos prontos |
| GET | `/relatorios` · `/atividade` · `/alertas` | Relatórios, atividade recente e alertas |

---

## SEO — `/sitemap.xml`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/sitemap.xml` | público | Sitemap dinâmico: páginas institucionais + vitrine de cada loja ativa (cache de 1 hora) |

O `robots.txt` do frontend aponta para esta rota.

---

## Limites e proteções

- **Limite de requisições:** as rotas de autenticação têm limite (ex.: login, 10 por minuto por IP); o teste de notificação também (5 a cada 15 minutos);
- **Validação:** todos os campos são validados no servidor (nada confia no navegador);
- **SQL:** todas as consultas usam parâmetros do driver (nunca concatenação de texto) — verificado pelo script `npm run auditar-sql`;
- **E-mails:** envio em segundo plano — falha de E-mail nunca impede um pedido de ser criado;
- **Notificações por telefone:** envio em segundo plano, com timeout de 8 s — provedor lento nunca atrasa cadastro ou pedido.
