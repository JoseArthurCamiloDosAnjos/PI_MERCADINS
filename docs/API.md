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
| POST | `/register` | público | Cria conta de cliente; envia código de verificação por E-mail |
| POST | `/login` | público | Valida E-mail + senha e devolve `{ token }` (limite de 10 tentativas/minuto) |
| GET | `/perfil` | token | Devolve o perfil de quem está logado |
| PUT | `/perfil` | token | Atualiza nome, telefone e foto do perfil |
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
# → { "token": "eyJhbGci..." }
```

---

## Mercados — `/api/mercados`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/` | público | Lista mercados (filtros por tipo, cidade, busca e ordenação) |
| POST | `/` | token (vendedor) | Cria uma loja |
| GET | `/meus` | token | Lista as lojas do vendedor logado |
| GET | `/slug/:slug` | opcional | Abre a vitrine pelo endereço amigável (`/vitrine/meu-mercado`) — devolve loja, categorias, horários, entrega e avaliação |
| GET | `/:id` | opcional | Dados de uma loja pelo número |
| GET | `/:id/dashboard` | token | Painel do vendedor (vendas, pedidos e resumos) |
| PUT | `/:id` | token | Atualiza a loja (inclui taxa de entrega, pedido mínimo, entrega/retirada, cores e horários) |
| DELETE | `/:id` | token | Remove a loja |
| POST | `/:id/favoritar` | token | Adiciona aos favoritos do cliente |
| DELETE | `/:id/favoritar` | token | Remove dos favoritos |
| GET | `/:id/avaliacoes` | opcional | Avaliações e média da loja |
| POST | `/:id/avaliacoes` | token | Avalia a loja (nota 1–5 e texto) |
| GET | `/:id/financeiro` | token | Resumo financeiro do mês escolhido |

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
  "validade": "2026-12-31"
}
```

- `tipo`: `percentual` (percentual) ou `valor` (valor fixo em reais);
- `max_usos` vazio/omitido = sem limite; `validade` vazia = não expira;
- o desconto é sempre calculado **no servidor** — o cliente nunca envia o valor do desconto.

---

## Assinaturas (planos das lojas) — `/api/assinaturas`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| POST | `/checkout` | token | Cria *customer* + assinatura no Asaas e devolve `{ idAssinatura, urlCheckout }` (o mercado só nasce depois, quando o pagamento confirma) |
| GET | `/minha` | token | **Todas** as assinaturas do usuário: plano, validade, dias restantes, **mercado vinculado**, faturas e link de pagamento |
| POST | `/:id/cancelar` | token | Cancela no Asaas e localmente (a loja segue no ar até o fim da vigência) |
| POST | `/api/webhooks/asaas` | token do webhook | Recebe os eventos de pagamento do Asaas (sem JWT; valida o cabeçalho `webhook-security-token`) |

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

## Pedidos

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| POST | `/api/mercados/:id/pedidos` | token | Cria o pedido (valida estoque, mínimo e cupom; envia E-mail de confirmação) |
| GET | `/api/mercados/:id/pedidos` | token (dono) | Lista os pedidos da loja (com entrega, agendamento e cupom) |
| PUT | `/api/pedidos/:id/status` | token (dono) | Muda o status e avisa o cliente por E-mail |
| GET | `/api/usuario/historico` | token | Histórico de compras do cliente |

Corpo de um pedido:

```json
{
  "produtos": [ { "id_produto": 254, "quantidade": 2 } ],
  "tipo_entrega": "entrega",
  "cupom": "BEMVINDO10",
  "agendamento": "Hoje à tarde",
  "observacoes": "Trocar a nota, por favor",
  "forma_pagamento": "pix"
}
```

- `tipo_entrega`: `entrega` (cobra a taxa e exige o pedido mínimo) ou `retirada` (taxa zero);
- `cupom` (opcional): código validado no servidor — inválido, expirado ou abaixo do mínimo rejeita o pedido;
- `agendamento` (opcional): texto livre combinado com a loja.

O servidor calcula: `total = subtotal − desconto + taxa de entrega` e grava tudo
no histórico, junto de `produto_ids` (base do selo "compra verificada").

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

O produto traz `estoque` e, no painel, a margem de lucro é calculada do
`custo` cadastrado — o campo `margem` do JSON serve para isso.

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

## Busca — `/api/busca`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/produtos?termo=pão` | público | Busca produtos em todas as lojas ativas |

---

## Administração — `/api/admin` (somente administrador)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/dashboard` | Números gerais da plataforma |
| GET | `/usuarios` · `/usuarios/:id` | Lista e detalhes de contas |
| PUT | `/usuarios/:id` · `/:id/bloquear` · `/:id/status` | Edita, bloqueia e muda situação |
| DELETE | `/usuarios/:id` | Exclui conta |
| GET | `/relatorios` · `/atividade` · `/alertas` | Relatórios, atividade recente e alertas |
| PUT | `/mercados/:id/bloquear` | Bloqueia uma loja |

---

## SEO — `/sitemap.xml`

| Método | Rota | Acesso | O que faz |
|---|---|---|---|
| GET | `/sitemap.xml` | público | Sitemap dinâmico: páginas institucionais + vitrine de cada loja ativa (cache de 1 hora) |

O `robots.txt` do frontend aponta para esta rota.

---

## Limites e proteções

- **Limite de requisições:** as rotas de autenticação têm limite (ex.: login, 10 por minuto por IP);
- **Validação:** todos os campos são validados no servidor (nada confia no navegador);
- **SQL:** todas as consultas usam parâmetros do driver (nunca concatenação de texto) — verificado pelo script `npm run auditar-sql`;
- **E-mails:** envio em segundo plano — falha de E-mail nunca impede um pedido de ser criado.
