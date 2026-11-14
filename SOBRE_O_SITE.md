# O que é o Mercadins

O **Mercadins** é um site que reúne os mercados, padarias, açougues e
hortifrutis de uma cidade em um só lugar. O cliente compra pela internet e
recebe em casa ou retira no balcão; o lojista vende pela plataforma e recebe
direto na conta.

## Para o cliente (quem compra)

1. **Cria uma conta** e confirma o e-mail por código.
2. **Busca lojas** por nome, tipo de comércio e cidade.
3. **Navega pelas lojas**: vê os produtos, avalia com foto e favorita as
   preferidas.
4. **Monta o carrinho**, aplica cupom de desconto e fecha o pedido — com a
   taxa de entrega e o pedido mínimo aparecendo antes de confirmar.
5. **Escolhe como receber**: entrega em casa ou retirada no balcão, com
   data e horário quando a loja permite agendar.
6. **Paga** na entrega, por Pix ou cartão (processado pelo Asaas) — ou fala
   direto com a loja pelo WhatsApp.
7. **Acompanha o pedido** e recebe avisos por e-mail em cada etapa
   (pagamento confirmado, saiu para entrega etc.).

## Para o vendedor (quem vende)

1. **Cadastra a loja** com paleta de cores, horários, taxa de entrega e
   pedido mínimo — pagando a assinatura do plano escolhido.
2. **Gerencia catálogo**: categorias e produtos com imagens, preço de custo
   e estoque (com alerta de estoque baixo ou esgotado).
3. **Usa o catálogo da plataforma** para puxar produtos prontos (padaria,
   açougue…) sem digitar tudo à mão.
4. **Recebe pedidos** e atualiza o status: pendente → em preparo → a caminho
   → entregue.
5. **Cria cupons** de desconto (percentual ou valor fixo, com mínimo,
   limite, validade e escopo por categoria ou produto).
6. **Acompanha o financeiro** por mês e o split dos pedidos online — o valor
   cai direto na conta Asaas do lojista.

## Para o administrador (equipe do projeto)

1. Painel com os **números da plataforma** (pedidos, faturamento, lojas).
2. Gestão de **usuários e lojas** (bloquear/desbloquear).
3. Administração do **catálogo** de produtos prontos.
4. Relatórios, atividade recente e alertas.

## Como o pagamento funciona

- **Pedidos**: Pix ou cartão via Asaas, com retorno confirmado por webhook;
  o valor é rateado (split) para a conta do lojista.
- **Cadastro de loja**: o vendedor escolhe um plano e paga a assinatura no
  checkout do Asaas antes de a loja ficar ativa.
- O ambiente de testes (sandbox) é usado até a liberação para produção.

## Onde está

- **Site:** https://mercadins.com.br
- **API:** https://pi-mercadins.onrender.com
- **Código:** https://github.com/JoseArthurCamiloDosAnjos/PI_MERCADINS
