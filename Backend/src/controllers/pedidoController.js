const { conectar } = require('../db/neon');
const asaas = require('../services/asaasService');
const {
  enviarEmailPedidoConfirmado,
  enviarEmailStatusPedido,
  enviarEmailPedidoVendedor,
} = require('../utils/mailer');

// ─────────────────────────────────────────────
// E-mails do pedido — busca os dados prontos e dispara sem travar a resposta
// (quem chama usa .catch(...); provedor fora do ar não derruba o pedido).
// ─────────────────────────────────────────────
async function montarDadosPedidoParaEmail(sql, idPedido) {
  const [dados] = await sql`
    SELECT h.id, h.produtos, h.valor_total, h.taxa_entrega, h.desconto, h.cupom_codigo,
           h.tipo_entrega, h.agendamento, h.status, h.observacao, h.forma_pagamento,
           h.endereco_entrega,
           u.email, u.nome AS cliente, m.nome AS mercado, m.email AS email_vendedor
    FROM historico_compras h
    JOIN usuarios u ON u.id_usuario = h.id_usuario
    JOIN mercados m ON m.id_mercado = h.id_mercado
    WHERE h.id = ${idPedido}
  `;
  if (!dados || !dados.email) return null;
  return {
    numero: dados.id,
    cliente: dados.cliente,
    mercado: dados.mercado,
    itens: dados.produtos,
    valorTotal: Number(dados.valor_total) || 0,
    desconto: Number(dados.desconto) || 0,
    cupom: dados.cupom_codigo || '',
    taxa: Number(dados.taxa_entrega) || 0,
    total: (Number(dados.valor_total) || 0) - (Number(dados.desconto) || 0) + (Number(dados.taxa_entrega) || 0),
    tipoEntrega: dados.tipo_entrega === 'retirada' ? 'retirada' : 'entrega',
    enderecoEntrega: dados.endereco_entrega || '',
    agendamento: dados.agendamento || '',
    observacao: dados.observacao || '',
    formaPagamento: dados.forma_pagamento || 'presencial',
    email: dados.email,
    emailVendedor: dados.email_vendedor || '',
    status: dados.status || 'pendente',
  };
}

// Avisa o vendedor por e-mail que entrou pedido novo (B2)
// (dispara sem segurar a resposta; falha de e-mail não afeta o pedido)
function avisarVendedorPedido(sql, idPedido) {
  montarDadosPedidoParaEmail(sql, idPedido)
    .then((dados) => dados && enviarEmailPedidoVendedor(dados.emailVendedor, dados))
    .catch((err) => console.error('Falha no e-mail de pedido ao vendedor:', err.message));
}

// ─────────────────────────────────────────────
// A3 — Baixa automática de estoque
// Baixa unidade por unidade com trava no banco (WHERE estoque >= quantidade):
// se dois clientes disputarem o último item, só um consegue. Se algo falhar
// no meio, o que já foi baixado é devolvido antes de responder o erro.
// ─────────────────────────────────────────────
async function baixarEstoque(sql, itens) {
  const baixados = [];
  for (const item of itens) {
    const idProduto  = Number(item.id_produto);
    const quantidade = Number(item.quantidade);
    const atualizado = await sql`
      UPDATE produtos SET estoque = estoque - ${quantidade}
      WHERE id_produto = ${idProduto} AND estoque >= ${quantidade}
      RETURNING id_produto
    `;
    if (atualizado.length === 0) {
      // Estoque acabou entre a validação e a baixa → devolve o que já saiu
      await devolverEstoque(sql, baixados);
      const nome = await sql`SELECT nome FROM produtos WHERE id_produto = ${idProduto}`;
      throw new Error(
        `O produto "${nome[0]?.nome || 'produto'}" acabou de ficar sem estoque. Atualize o carrinho e tente novamente.`
      );
    }
    baixados.push({ id_produto: idProduto, quantidade });
  }
  return baixados;
}

// Devolve estoque (usado quando o pedido é cancelado ou a baixa falha no meio)
async function devolverEstoque(sql, itens) {
  for (const item of itens || []) {
    await sql`
      UPDATE produtos SET estoque = estoque + ${Number(item.quantidade)}
      WHERE id_produto = ${Number(item.id_produto)}
    `;
  }
}

// POST /api/mercados/:id/pedidos — cria um pedido a partir do carrinho do usuário
// forma_pagamento: 'presencial' (padrão, paga na entrega), 'pix' ou 'cartao'
const criarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);
  const { itens, observacao, tipo_entrega, cupom, agendamento, forma_pagamento, endereco_entrega } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Informe os itens do pedido.' });
  }

  // Validação básica de cada item (id inteiro > 0 e quantidade inteira > 0)
  for (const item of itens) {
    const idProduto  = Number(item && item.id_produto);
    const quantidade = Number(item && item.quantidade);
    if (!Number.isInteger(idProduto) || idProduto <= 0 ||
        !Number.isInteger(quantidade) || quantidade <= 0) {
      return res.status(400).json({ erro: 'Item inválido no pedido.' });
    }
  }

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  // Forma de pagamento: paga na entrega (padrão), Pix ou cartão online
  const formaPagamento = ['pix', 'cartao'].includes(forma_pagamento) ? forma_pagamento : 'presencial';
  // Pagamento online começa "aguardando"; só vira "pendente" quando o Asaas confirmar
  const statusInicial = formaPagamento === 'presencial' ? 'pendente' : 'aguardando_pagamento';

  // Entrega pelo cliente ou retirada no balcão (padrão: entrega)
  const tipoEntrega = tipo_entrega === 'retirada' ? 'retirada' : 'entrega';

  // Observação é opcional: máx. 300 caracteres, sem caracteres de controle
  const observacaoLimpa = typeof observacao === 'string'
    ? observacao.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300)
    : '';

  // Agendamento é opcional: quando o cliente quer receber/retirar
  // (ex.: "Hoje à tarde", "Amanhã de manhã") — máx. 60 caracteres
  const agendamentoLimpo = typeof agendamento === 'string'
    ? agendamento.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 60)
    : '';

  // Endereço de entrega (item 1): só existe quando a compra será entregue
  // (na retirada no balcão não faz sentido) — máx. 300 caracteres
  const enderecoLimpo = tipoEntrega === 'entrega' && typeof endereco_entrega === 'string'
    ? endereco_entrega.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300)
    : '';

  try {
    const sql = await conectar();

    const idsProdutos = [...new Set(itens.map(i => Number(i.id_produto)))];

    // Só aceita produtos que pertencem a este mercado
    // (produtos não têm id_mercado direto: a ligação é pela categoria)
    const produtos = await sql`
      SELECT p.id_produto, p.nome, p.preco, p.estoque
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${mercadoId}
        AND p.id_produto = ANY(${idsProdutos})
    `;

    if (produtos.length !== idsProdutos.length) {
      return res.status(400).json({ erro: 'Alguns produtos não pertencem a este mercado.' });
    }

    // Regras de entrega do mercado (taxa, mínimo e quais formas aceita)
    const [mercado] = await sql`
      SELECT nome, taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada
      FROM mercados
      WHERE id_mercado = ${mercadoId}
    `;
    if (!mercado) {
      return res.status(404).json({ erro: 'Mercado não encontrado.' });
    }

    if (tipoEntrega === 'entrega' && mercado.oferece_entrega === false) {
      return res.status(400).json({ erro: 'Este mercado não faz entrega — escolha retirar no balcão.' });
    }
    if (tipoEntrega === 'retirada' && mercado.oferece_retirada === false) {
      return res.status(400).json({ erro: 'Este mercado não permite retirada no balcão.' });
    }

    const mapaProdutos = new Map(produtos.map(p => [Number(p.id_produto), p]));

    // O valor total é calculado SEMPRE pelo preço do banco, nunca pelo cliente
    let valorTotal = 0;
    const resumo = [];
    for (const item of itens) {
      const produto    = mapaProdutos.get(Number(item.id_produto));
      const quantidade = Number(item.quantidade);

      // Estoque: a quantidade pedida nunca pode passar do disponível
      // (a baixa de verdade acontece depois, com trava — função baixarEstoque)
      const disponivel = Number(produto.estoque) || 0;
      if (quantidade > disponivel) {
        const motivo = disponivel <= 0
          ? `O produto "${produto.nome}" está sem estoque.`
          : `Estoque insuficiente para "${produto.nome}": disponível ${disponivel}, solicitado ${quantidade}.`;
        return res.status(400).json({ erro: motivo });
      }
      valorTotal += Number(produto.preco ?? 0) * quantidade;
      resumo.push(`${quantidade}x ${produto.nome}`);
    }

    // Pedido mínimo só vale para entrega (na retirada o cliente pega no balcão)
    const pedidoMinimo = Number(mercado.pedido_minimo) || 0;
    if (tipoEntrega === 'entrega' && pedidoMinimo > 0 && valorTotal < pedidoMinimo) {
      return res.status(400).json({
        erro: `Pedido mínimo de R$ ${pedidoMinimo.toFixed(2).replace('.', ',')} para entrega.`,
      });
    }

    // Cupom de desconto (opcional) — conferido no banco, nunca no navegador
    let desconto = 0;
    let cupomRegistro = null;
    if (typeof cupom === 'string' && cupom.trim()) {
      const codigo = cupom.trim().toUpperCase().slice(0, 30);
      const [registro] = await sql`
        SELECT * FROM cupons
        WHERE id_mercado = ${mercadoId}
          AND upper(codigo) = ${codigo}
          AND ativo = TRUE
      `;
      if (!registro) {
        return res.status(400).json({ erro: 'Cupom inválido ou desativado.' });
      }
      if (registro.validade) {
        // validade chega como meia-noite (fuso do banco): compara até o fim do dia
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const validade = new Date(registro.validade);
        validade.setHours(23, 59, 59, 999);
        if (hoje > validade) {
          return res.status(400).json({ erro: 'Este cupom expirou.' });
        }
      }
      if (registro.max_usos != null && Number(registro.usos) >= Number(registro.max_usos)) {
        return res.status(400).json({ erro: 'Este cupom já atingiu o limite de usos.' });
      }
      const minPedido = Number(registro.min_pedido) || 0;
      if (valorTotal < minPedido) {
        return res.status(400).json({
          erro: `Este cupom exige pedido mínimo de R$ ${minPedido.toFixed(2).replace('.', ',')}.`,
        });
      }
      desconto = registro.tipo === 'percentual'
        ? valorTotal * (Number(registro.valor) / 100)
        : Number(registro.valor);
      desconto = Math.min(Math.round(desconto * 100) / 100, valorTotal);
      cupomRegistro = registro;
    }

    // Taxa: cobrada só na entrega; no balcão é grátis
    const taxaEntrega = tipoEntrega === 'entrega' ? Number(mercado.taxa_entrega) || 0 : 0;

    // Ids dos produtos comprados — usados pelo selo "compra verificada" da
    // avaliação de produto (quem já comprou pode receber o selo)
    const produtoIds = idsProdutos.join(',');

    // Foto dos itens no momento do pedido — permite devolver o estoque
    // certinho se o pagamento falhar ou o pedido for cancelado
    const itensJson = itens.map(i => ({
      id_produto: Number(i.id_produto),
      quantidade: Number(i.quantidade),
    }));

    const [pedido] = await sql`
      INSERT INTO historico_compras (
        id_usuario, id_mercado, produtos, valor_total, status, observacao,
        tipo_entrega, taxa_entrega, agendamento, cupom_codigo, desconto, produto_ids,
        forma_pagamento, itens_json, endereco_entrega
      )
      VALUES (
        ${id_usuario}, ${mercadoId}, ${resumo.join(', ')}, ${valorTotal.toFixed(2)}, ${statusInicial}, ${observacaoLimpa},
        ${tipoEntrega}, ${taxaEntrega.toFixed(2)}, ${agendamentoLimpo}, ${cupomRegistro ? cupomRegistro.codigo : ''}, ${desconto.toFixed(2)}, ${produtoIds},
        ${formaPagamento}, ${JSON.stringify(itensJson)}, ${enderecoLimpo}
      )
      RETURNING id, id_mercado, produtos, valor_total, data_compra, status, observacao,
                tipo_entrega, taxa_entrega, agendamento, cupom_codigo, desconto, forma_pagamento,
                endereco_entrega
    `;

    // A3 — Baixa automática de estoque (com trava no banco).
    // Se algo faltar no meio, apaga o pedido recém-criado e responde o motivo.
    try {
      await baixarEstoque(sql, itensJson);
    } catch (erroEstoque) {
      await sql`DELETE FROM historico_compras WHERE id = ${pedido.id} AND status = ${statusInicial}`;
      return res.status(400).json({ erro: erroEstoque.message });
    }

    // Cupom usado: soma 1 no contador de usos
    if (cupomRegistro) {
      await sql`UPDATE cupons SET usos = usos + 1 WHERE id = ${cupomRegistro.id}`;
    }

    // Remove do carrinho apenas os produtos que foram comprados
    await sql`
      DELETE FROM carrinho
      WHERE id_usuario = ${id_usuario}
        AND id_mercado = ${mercadoId}
        AND id_produto = ANY(${idsProdutos})
    `;

    const totalPedido = valorTotal - desconto + taxaEntrega;

    // ── Pagamento online (Pix ou cartão) — B3 ────────────────────────────────
    if (formaPagamento !== 'presencial') {
      try {
        const [usuario] = await sql`
          SELECT nome, email, cpf, telefone FROM usuarios WHERE id_usuario = ${id_usuario}
        `;
        const customer = await asaas.criarCustomer({
          nome: usuario?.nome || 'Cliente Mercadins',
          email: usuario?.email,
          cpfCnpj: usuario?.cpf || undefined,
          mobilePhone: usuario?.telefone || undefined,
        });

        const descricao = `Pedido nº ${pedido.id} — ${mercado.nome}`;
        let pagamento;
        if (formaPagamento === 'pix') {
          pagamento = await asaas.criarPagamentoPedidoPix({
            customerId: customer.id,
            valor: totalPedido,
            descricao,
            externalReference: `pedido:${pedido.id}`,
          });
        } else {
          const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
          pagamento = await asaas.criarPagamentoPedidoCartao({
            customerId: customer.id,
            valor: totalPedido,
            descricao,
            externalReference: `pedido:${pedido.id}`,
            // Depois de pagar, o cliente volta para a página de acompanhamento
            redirectUrl: frontendUrl ? `${frontendUrl}/pedidos/${pedido.id}` : undefined,
          });
        }

        await sql`
          UPDATE historico_compras SET asaas_payment_id = ${pagamento.id}
          WHERE id = ${pedido.id}
        `;

        // O cliente não recebe e-mail agora: o QR/link está na tela dele.
        // O e-mail de confirmação + aviso à loja sai quando o Asaas confirmar (webhook).
        return res.status(201).json({
          mensagem: formaPagamento === 'pix'
            ? 'Pedido criado. Pague com o Pix para a loja iniciar o preparo.'
            : 'Pedido criado. Finalize o pagamento do cartão para a loja iniciar o preparo.',
          pedido: {
            ...pedido,
            total: totalPedido,
            forma_pagamento: formaPagamento,
          },
          pagamento: {
            id: pagamento.id,
            vencimento: pagamento.vencimento || null,
            qrCodeBase64: pagamento.qrCodeBase64 || '',
            copiaEcola: pagamento.copiaEcola || '',
            urlPagamento: pagamento.urlPagamento || '',
          },
        });
      } catch (erroPagamento) {
        // Pagamento não conseguiu ser criado → desfaz TUDO: para o cliente este
        // pedido nunca chegou a existir (estoque e cupom voltam ao normal)
        await sql`DELETE FROM historico_compras WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'`;
        await devolverEstoque(sql, itensJson);
        if (cupomRegistro) {
          await sql`UPDATE cupons SET usos = GREATEST(usos - 1, 0) WHERE id = ${cupomRegistro.id}`;
        }
        const motivo = String(erroPagamento.message || '');
        console.error(`Pedido ${pedido.id} desfeito: pagamento não iniciado (${motivo}).`);
        // Traduz os erros mais comuns do Asaas; o "detalhe" volta na resposta
        // para a pessoa conseguir se ajudar (o frontend mostra junto do aviso)
        let aviso = 'Não foi possível iniciar o pagamento online. Tente novamente ou escolha pagar na entrega.';
        if (/CPF|CNPJ/i.test(motivo)) {
          aviso = 'Falta o CPF/CNPJ na sua conta para pagar online. Cadastre-o no perfil ou escolha pagar na entrega.';
        } else if (/menor que|R\$\s*5/i.test(motivo)) {
          aviso = 'O Pix tem valor mínimo de R$ 5,00. Adicione itens ao carrinho ou escolha pagar na entrega.';
        } else if (/acesso|access_token|api key|chave|401|403/i.test(motivo)) {
          aviso = 'Pagamento online indisponível no momento. Escolha pagar na entrega.';
        }
        return res.status(502).json({ erro: aviso, detalhe: motivo });
      }
    }

    // ── Pagar na entrega: pedido já entra em andamento ───────────────────────
    // E-mail de confirmação para o cliente + aviso de pedido novo para a loja (B2)
    montarDadosPedidoParaEmail(sql, pedido.id)
      .then((dados) => dados && enviarEmailPedidoConfirmado(dados.email, dados))
      .catch((err) => console.error('Falha no e-mail de confirmação do pedido:', err.message));
    avisarVendedorPedido(sql, pedido.id);

    res.status(201).json({
      mensagem: 'Pedido criado com sucesso.',
      pedido: {
        ...pedido,
        total: totalPedido,
        forma_pagamento: formaPagamento,
      },
    });
  } catch (err) {
    console.error('ERRO criarPedido:', err);
    res.status(500).json({ erro: 'Não foi possível registrar o pedido. Tente novamente.' });
  }
};

// GET /api/mercados/:id/pedidos — lista os pedidos recebidos pelo mercado (vendedor)
const listarPedidosMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  try {
    const sql = await conectar();

    // Só quem gerencia o mercado pode ver os pedidos dele
    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${mercadoId}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso aos pedidos deste mercado.' });
    }

    const pedidos = await sql`
      SELECT h.id, h.produtos, h.valor_total, h.data_compra, h.status, h.observacao,
             h.tipo_entrega, h.taxa_entrega, h.agendamento, h.cupom_codigo, h.desconto,
             h.forma_pagamento, h.endereco_entrega,
             u.nome AS cliente
      FROM historico_compras h
      JOIN usuarios u ON u.id_usuario = h.id_usuario
      WHERE h.id_mercado = ${mercadoId}
      ORDER BY h.data_compra DESC
      LIMIT 50
    `;

    res.status(200).json({
      pedidos: pedidos.map(p => ({
        id: p.id,
        cliente: p.cliente,
        itens: p.produtos,
        valorTotal: Number(p.valor_total),
        dataCompra: p.data_compra,
        status: p.status || 'pendente',
        observacao: p.observacao || '',
        tipoEntrega: p.tipo_entrega === 'retirada' ? 'retirada' : 'entrega',
        taxaEntrega: Number(p.taxa_entrega) || 0,
        agendamento: p.agendamento || '',
        enderecoEntrega: p.endereco_entrega || '',
        cupom: p.cupom_codigo || '',
        desconto: Number(p.desconto) || 0,
        formaPagamento: p.forma_pagamento || 'presencial',
      })),
    });
  } catch (err) {
    console.error('ERRO listarPedidosMercado:', err);
    res.status(500).json({ erro: 'Não foi possível carregar os pedidos.' });
  }
};

// ─────────────────────────────────────────────
// PUT /api/pedidos/:id/status — vendedor atualiza o status do pedido
// Ordem: pendente → preparo → caminho → entregue (só avança, nunca volta)
// ─────────────────────────────────────────────
const ORDEM_STATUS = ['pendente', 'preparo', 'caminho', 'entregue'];

const atualizarStatusPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);
  const { status } = req.body;

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }
  if (!ORDEM_STATUS.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido. Use: pendente, preparo, caminho ou entregue.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT id, id_mercado, status FROM historico_compras WHERE id = ${pedidoId}
    `;
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    // Só quem gerencia o mercado do pedido pode alterá-lo
    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${pedido.id_mercado}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso a este pedido.' });
    }

    // Pedidos que ainda aguardam pagamento ou foram cancelados não avançam:
    // o fluxo deles é pago (vira "pendente" pelo webhook) ou desistido
    if (pedido.status === 'aguardando_pagamento') {
      return res.status(400).json({ erro: 'Este pedido ainda está aguardando o pagamento do cliente.' });
    }
    if (pedido.status === 'cancelado') {
      return res.status(400).json({ erro: 'Este pedido foi cancelado e não pode mudar de status.' });
    }

    const atual = ORDEM_STATUS.includes(pedido.status) ? pedido.status : 'pendente';
    if (ORDEM_STATUS.indexOf(status) < ORDEM_STATUS.indexOf(atual)) {
      return res.status(400).json({ erro: 'O status de um pedido só pode avançar, não voltar.' });
    }

    const [atualizado] = await sql`
      UPDATE historico_compras SET status = ${status}
      WHERE id = ${pedidoId}
      RETURNING id, status
    `;

    // Avisa o cliente por e-mail (fire-and-forget: falha de e-mail não afeta o pedido)
    montarDadosPedidoParaEmail(sql, pedidoId)
      .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, status))
      .catch((err) => console.error('Falha no e-mail de status do pedido:', err.message));

    res.status(200).json({ mensagem: 'Status atualizado com sucesso.', pedido: atualizado });
  } catch (err) {
    console.error('ERRO atualizarStatusPedido:', err);
    res.status(500).json({ erro: 'Não foi possível atualizar o status.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/mercados/:id/financeiro?ano=2026&mes=10
// Painel financeiro do mês escolhido: faturamento, custos, lucro e demanda.
// Feito para o pequeno comércio que "não sabe quanto ganha e quanto gasta":
//   - Faturamento = soma dos pedidos do mês
//   - Custo da mercadoria = quantidade vendida x custo cadastrado no produto
//   - Custo fixo = valor mensal informado pelo vendedor (aluguel, luz, salários)
//   - Lucro = faturamento − custo da mercadoria − custo fixo (pode dar negativo)
// ─────────────────────────────────────────────
const round2 = (v) => Math.round(v * 100) / 100;

// Resumo gravado no pedido ("2x Arroz, 1x Feijão") → [{ qtd, nome }]
function parseItensPedido(txt) {
  const out = [];
  for (const parte of String(txt || '').split(', ')) {
    const limpo = parte.trim();
    if (!limpo) continue;
    const m = /^(\d+)\s*x\s+(.+)$/.exec(limpo);
    if (m) out.push({ qtd: Number(m[1]), nome: m[2] });
  }
  return out;
}

const financeiroMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  const agora = new Date();
  const ano = Number(req.query.ano) || agora.getFullYear();
  const mes = Number(req.query.mes) || agora.getMonth() + 1;
  if (!Number.isInteger(ano) || !Number.isInteger(mes) ||
      ano < 2020 || ano > 2100 || mes < 1 || mes > 12) {
    return res.status(400).json({ erro: 'Período inválido.' });
  }

  try {
    const sql = await conectar();

    // Só quem gerencia o mercado vê o financeiro dele
    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${mercadoId}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso ao financeiro deste mercado.' });
    }

    // Busca com folga de 1 dia em cada lado (cobre diferença de fuso na
    // comparação) e filtra o mês exato no JavaScript, com o relógio local.
    // data_local: a coluna é "timestamp" sem fuso; a conversão devolve o
    // horário de Taquaritinga (America/Sao_Paulo) para dia e mês certos
    const folgaInicio = new Date(ano, mes - 1, 0);
    const folgaFim    = new Date(ano, mes, 2);

    const pedidos = await sql`
      SELECT h.produtos, h.valor_total, h.status,
             (h.data_compra AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'America/Sao_Paulo' AS data_local
      FROM historico_compras h
      WHERE h.id_mercado = ${mercadoId}
        AND h.data_compra >= ${folgaInicio}
        AND h.data_compra <  ${folgaFim}
      ORDER BY h.data_compra ASC
      LIMIT 5000
    `;

    const produtosMercado = await sql`
      SELECT p.nome, p.preco, p.custo
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${mercadoId}
    `;

    const [mercado] = await sql`
      SELECT custos_fixos FROM mercados WHERE id_mercado = ${mercadoId}
    `;

    const mapaProdutos = new Map(produtosMercado.map(p => [p.nome, p]));

    let faturamento = 0, custoMercadoria = 0, totalPedidos = 0, itensSemCusto = 0;
    const porStatus = { pendente: 0, preparo: 0, caminho: 0, entregue: 0 };
    const porDia = new Map();
    const porProduto = new Map();

    for (const p of pedidos) {
      const d = new Date(p.data_local);
      if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) continue;

      const valor = Number(p.valor_total) || 0;
      faturamento += valor;
      totalPedidos += 1;

      const st = p.status || 'pendente';
      porStatus[st] = (porStatus[st] || 0) + 1;

      const dia = d.getDate();
      const reg = porDia.get(dia) || { pedidos: 0, receita: 0 };
      reg.pedidos += 1;
      reg.receita += valor;
      porDia.set(dia, reg);

      // Itens do pedido casados com o cadastro atual (preço e custo)
      for (const item of parseItensPedido(p.produtos)) {
        const ref = mapaProdutos.get(item.nome);
        const custo = ref ? Number(ref.custo) || 0 : 0;
        // Sem custo cadastrado (ou produto renomeado/removido): avisa o vendedor
        if (!ref || custo <= 0) itensSemCusto += item.qtd;
        custoMercadoria += custo * item.qtd;

        const pp = porProduto.get(item.nome) || { qtd: 0, receita: 0 };
        pp.qtd += item.qtd;
        pp.receita += (ref ? Number(ref.preco) || 0 : 0) * item.qtd;
        porProduto.set(item.nome, pp);
      }
    }

    const custoFixo = Number(mercado?.custos_fixos) || 0;
    const lucro = faturamento - custoMercadoria - custoFixo;
    const diasNoMes = new Date(ano, mes, 0).getDate();

    res.status(200).json({
      ano,
      mes,
      pedidos: totalPedidos,
      faturamento: round2(faturamento),
      ticketMedio: totalPedidos > 0 ? round2(faturamento / totalPedidos) : 0,
      custoMercadoria: round2(custoMercadoria),
      custoFixo: round2(custoFixo),
      lucro: round2(lucro),
      itensSemCusto,
      porStatus,
      serieDiaria: Array.from({ length: diasNoMes }, (_, i) => {
        const reg = porDia.get(i + 1) || { pedidos: 0, receita: 0 };
        return { dia: i + 1, pedidos: reg.pedidos, receita: round2(reg.receita) };
      }),
      topProdutos: [...porProduto.entries()]
        .map(([nome, v]) => ({ nome, qtd: v.qtd, receita: round2(v.receita) }))
        .sort((a, b) => b.qtd - a.qtd || b.receita - a.receita)
        .slice(0, 8),
    });
  } catch (err) {
    console.error('ERRO financeiroMercado:', err);
    res.status(500).json({ erro: 'Não foi possível carregar o financeiro do mercado.' });
  }
};

// ─────────────────────────────────────────────
// B3 — Webhook do Asaas para PAGAMENTO DE PEDIDO
// Chamado pelo webhookAsaas quando o evento for de uma cobrança de pedido
// (externalReference "pedido:<id>"). Confere o status direto no Asaas antes
// de agir, para nunca marcar como pago por engano.
// ─────────────────────────────────────────────
async function processarPagamentoPedido(sql, evento, pagamentoAsaas) {
  const ref = pagamentoAsaas?.externalReference || '';
  const [, idStr] = String(ref).split(':');
  const pedidoId = Number(idStr);

  // O pedido pode ser achar pelo id local; o id do Asaas é gravado em seguida
  const [pedido] = Number.isInteger(pedidoId) && pedidoId > 0
    ? await sql`SELECT * FROM historico_compras WHERE id = ${pedidoId}`
    : [];
  if (!pedido) return { ignorado: true };

  // Confirmação na fonte: o status vem do Asaas, não do corpo da mensagem
  let statusAsaas = pagamentoAsaas?.status || '';
  try {
    const confirmado = await asaas.buscarPagamento(pagamentoAsaas.id);
    statusAsaas = confirmado?.status || statusAsaas;
  } catch (erro) {
    // Sem confirmação não agimos; o Asaas reenvia o evento depois
    throw erro;
  }

  const pago = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(statusAsaas);
  const falhou = ['DELETED', 'FAILED', 'EXPIRED', 'REFUND_REQUESTED', 'REFUNDED', 'CHARGBACK_REQUESTED', 'CHARGBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(statusAsaas);

  if (pago) {
    // Idempotente: webhook pode chegar mais de uma vez
    if (pedido.status === 'aguardando_pagamento') {
      await sql`
        UPDATE historico_compras SET status = 'pendente', asaas_payment_id = ${pagamentoAsaas.id}
        WHERE id = ${pedido.id}
      `;
      // Confirmação para o cliente + aviso de pedido novo para a loja (B2)
      montarDadosPedidoParaEmail(sql, pedido.id)
        .then((dados) => dados && enviarEmailPedidoConfirmado(dados.email, dados))
        .catch((err) => console.error('Falha no e-mail de pagamento do pedido:', err.message));
      avisarVendedorPedido(sql, pedido.id);
    }
    return { recebido: true, pago: true };
  }

  if (falhou && pedido.status === 'aguardando_pagamento') {
    // Pagamento falhou/caiu: cancela o pedido e devolve o estoque
    await sql`
      UPDATE historico_compras SET status = 'cancelado', asaas_payment_id = ${pagamentoAsaas.id}
      WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'
    `;
    await devolverEstoque(sql, pedido.itens_json);
    montarDadosPedidoParaEmail(sql, pedido.id)
      .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, 'cancelado'))
      .catch((err) => console.error('Falha no e-mail de cancelamento:', err.message));
    console.error(`Pedido ${pedido.id} cancelado: pagamento ${statusAsaas} (${evento}).`);
    return { recebido: true, cancelado: true };
  }

  // PENDING, IN_ANALYSIS etc. — ainda em análise, nada a fazer agora
  return { recebido: true };
}

// ─────────────────────────────────────────────
// Item 4 — Cancelar pedido pelo CLIENTE
// POST /api/pedidos/:id/cancelar
//
// O cliente desiste de um pedido que ainda não foi preparado. Só pode cancelar
// quem é dono do pedido (o vendedor NÃO cancela pelo cliente). Regras:
//   • Pendente (paga na entrega) ou aguardando pagamento → pode cancelar
//   • Em preparo / a caminho / entregue → tarde demais (loja já começou)
//   • Cancelado → não faz nada (idempotente)
// Ao cancelar: devolve o estoque (itens_json), cancela a cobrança Pix/cartão
// no Asaas (se houver) e avisa o cliente por e-mail.
// ─────────────────────────────────────────────
const cancelarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT id, id_usuario, id_mercado, status, forma_pagamento, asaas_payment_id, itens_json
      FROM historico_compras
      WHERE id = ${pedidoId}
    `;
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    // Só o dono do pedido pode cancelá-lo
    if (Number(pedido.id_usuario) !== Number(id_usuario)) {
      return res.status(403).json({ erro: 'Você não pode cancelar este pedido.' });
    }

    // Já cancelado: nada a fazer (responde ok para a tela não quebrar)
    if (pedido.status === 'cancelado') {
      return res.status(200).json({ mensagem: 'Este pedido já estava cancelado.', pedido: { id: pedido.id, status: 'cancelado' } });
    }

    // Só dá para cancelar antes da loja começar o preparo
    if (!['pendente', 'aguardando_pagamento'].includes(pedido.status)) {
      return res.status(400).json({
        erro: 'Este pedido já está em preparo e não pode mais ser cancelado. Fale com a loja.',
      });
    }

    // Pedido pago por Pix/cartão (ele nasce "aguardando_pagamento" e vira
    // "pendente" quando o pagamento é confirmado) não pode ser cancelado pela
    // tela: o dinheiro já saiu do cliente e só a loja resolve o estorno.
    if (pedido.status === 'pendente' && ['pix', 'cartao'].includes(pedido.forma_pagamento)) {
      return res.status(400).json({
        erro: 'Este pedido já foi pago e não pode ser cancelado pela tela. Fale com a loja para combinar o estorno.',
      });
    }

    // Cancela o pedido (o WHERE protege contra corrida com o webhook do Asaas)
    const [cancelado] = await sql`
      UPDATE historico_compras
      SET status = 'cancelado', motivo_cancelamento = 'Cancelado pelo cliente'
      WHERE id = ${pedido.id} AND status IN ('pendente', 'aguardando_pagamento')
      RETURNING id, status
    `;
    if (!cancelado) {
      // O status mudou nesse meio-tempo (ex.: webhook confirmou o pagamento)
      return res.status(409).json({ erro: 'Este pedido não pode mais ser cancelado.' });
    }

    // Devolve o estoque que foi baixado na compra
    await devolverEstoque(sql, pedido.itens_json);

    // Se havia uma cobrança Pix/cartão pendente, cancela no Asaas para não
    // deixar um QR "vivo" que o cliente poderia pagar depois
    if (pedido.asaas_payment_id) {
      try {
        await asaas.cancelarPagamento(pedido.asaas_payment_id);
      } catch (err) {
        // Asaas fora do ar ou cobrança já paga: o pedido local já está cancelado
        console.error(`Falha ao cancelar cobrança ${pedido.asaas_payment_id} no Asaas: ${err.message}`);
      }
    }

    // Avisa o cliente por e-mail (fire-and-forget: falha de e-mail não quebra)
    montarDadosPedidoParaEmail(sql, pedido.id)
      .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, 'cancelado'))
      .catch((err) => console.error('Falha no e-mail de cancelamento:', err.message));

    res.status(200).json({
      mensagem: 'Pedido cancelado. O estoque dos produtos voltou para a loja.',
      pedido: { id: pedido.id, status: 'cancelado' },
    });
  } catch (err) {
    console.error('ERRO cancelarPedido:', err);
    res.status(500).json({ erro: 'Não foi possível cancelar o pedido. Tente novamente.' });
  }
};

// ─────────────────────────────────────────────
// Item 3 — Recomprar: devolve os produtos de um pedido com os dados ATUAIS
// GET /api/pedidos/:id/itens-recompra
//
// O histórico guarda apenas "id + quantidade" (itens_json). Para a tela
// reconstruir o carrinho ela precisa do nome, preço, foto e estoque de hoje —
// é isso que este endpoint devolve. O que saiu de linha ou ficou sem estoque
// é descartado aqui (a tela não recebe item que não dá para comprar).
// Só o dono do pedido pode consultar.
// ─────────────────────────────────────────────

// Pedidos antigos (anteriores à migração 005) não têm a foto dos itens. O
// resumo deles foi gravado como texto no formato "2x Banana prata (kg)" — daí
// recuperamos o nome e a quantidade e procuramos o produto ATUAL da mesma loja
// (se o item sumiu do cardápio ou ficou sem estoque, ele simplesmente sai).
async function reconstruirItensAntigos(sql, pedido) {
  const resumo = String(pedido.produtos || '');
  const linhas = resumo
    .split(',')
    .map(texto => {
      const partes = texto.trim().match(/^(\d+)\s*x\s+(.+)$/i);
      if (!partes) return null;
      return { quantidade: Number(partes[1]), nome: partes[2].trim() };
    })
    .filter(linha => linha && linha.quantidade > 0 && linha.nome);

  const itens = [];
  for (const linha of linhas) {
    const [p] = await sql`
      SELECT p.id_produto, p.id_categoria, p.nome, p.descricao, p.preco, p.imagem, p.estoque
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${pedido.id_mercado}
        AND lower(p.nome) = lower(${linha.nome})
      LIMIT 1
    `;
    if (!p || Number(p.estoque) <= 0) continue;

    const estoque = Number(p.estoque) || 0;
    itens.push({
      id_produto:   Number(p.id_produto),
      id_categoria: Number(p.id_categoria),
      nome:         p.nome,
      descricao:    p.descricao || '',
      preco:        p.preco,
      imagem:       p.imagem || '',
      estoque,
      quantidade:   Math.max(1, Math.min(linha.quantidade, estoque)),
    });
  }
  return itens;
}

const itensParaRecompra = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT id, id_usuario, id_mercado, itens_json, produtos
      FROM historico_compras
      WHERE id = ${pedidoId}
    `;
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }
    if (Number(pedido.id_usuario) !== Number(id_usuario)) {
      return res.status(403).json({ erro: 'Você não pode recomprar este pedido.' });
    }

    let bruto = pedido.itens_json;
    if (typeof bruto === 'string') {
      try { bruto = JSON.parse(bruto); } catch { bruto = null; }
    }

    let itens = [];

    if (Array.isArray(bruto) && bruto.length > 0) {
      // Caminho normal: foto dos itens gravada na hora da compra
      const ids = bruto
        .map(i => Number(i?.id_produto))
        .filter(n => Number.isInteger(n) && n > 0);

      const produtos = await sql`
        SELECT id_produto, id_categoria, nome, descricao, preco, imagem, estoque
        FROM produtos
        WHERE id_produto = ANY(${ids}) AND estoque > 0
        ORDER BY nome ASC
      `;
      const porId = new Map(produtos.map(p => [Number(p.id_produto), p]));

      itens = bruto
        .map(i => {
          const p = porId.get(Number(i?.id_produto));
          if (!p) return null;
          const estoque = Number(p.estoque) || 0;
          const quantidade = Math.max(1, Math.min(Number(i?.quantidade) || 1, estoque));
          return {
            id_produto:   Number(p.id_produto),
            id_categoria: Number(p.id_categoria),
            nome:         p.nome,
            descricao:    p.descricao || '',
            preco:        p.preco,
            imagem:       p.imagem || '',
            estoque,
            quantidade,
          };
        })
        .filter(Boolean);
    } else {
      // Pedido antigo (feito antes da foto dos itens existir): reconstrói a
      // partir do resumo gravado, no formato "2x Banana prata (kg)"
      itens = await reconstruirItensAntigos(sql, pedido);
    }

    if (itens.length === 0) {
      return res.status(400).json({ erro: 'Os itens deste pedido não estão mais disponíveis.' });
    }

    res.status(200).json({ itens });
  } catch (err) {
    console.error('ERRO itensParaRecompra:', err);
    res.status(500).json({ erro: 'Não foi possível montar o carrinho deste pedido.' });
  }
};

// ─────────────────────────────────────────────
// B4 — Acompanhamento do pedido (visão do CLIENTE)
// GET /api/pedidos/meus — lista dos pedidos que o cliente fez
// ─────────────────────────────────────────────
const meusPedidos = async (req, res) => {
  const id_usuario = req.usuarioId;

  try {
    const sql = await conectar();

    const pedidos = await sql`
      SELECT h.id, h.id_mercado, m.nome AS mercado, m.slug AS mercado_slug,
             h.produtos, h.valor_total, h.taxa_entrega, h.desconto, h.cupom_codigo,
             h.tipo_entrega, h.agendamento, h.status, h.forma_pagamento, h.data_compra
      FROM historico_compras h
      JOIN mercados m ON m.id_mercado = h.id_mercado
      WHERE h.id_usuario = ${id_usuario}
        AND h.removido_cliente = false
      ORDER BY h.data_compra DESC
      LIMIT 50
    `;

    res.status(200).json({
      pedidos: pedidos.map(p => ({
        id: p.id,
        mercadoId: p.id_mercado,
        mercado: p.mercado,
        mercadoSlug: p.mercado_slug || '',
        itens: p.produtos,
        valorTotal: Number(p.valor_total),
        taxaEntrega: Number(p.taxa_entrega) || 0,
        desconto: Number(p.desconto) || 0,
        cupom: p.cupom_codigo || '',
        tipoEntrega: p.tipo_entrega === 'retirada' ? 'retirada' : 'entrega',
        agendamento: p.agendamento || '',
        status: p.status || 'pendente',
        formaPagamento: p.forma_pagamento || 'presencial',
        dataCompra: p.data_compra,
      })),
    });
  } catch (err) {
    console.error('ERRO meusPedidos:', err);
    res.status(500).json({ erro: 'Não foi possível carregar os seus pedidos.' });
  }
};

// ─────────────────────────────────────────────
// B4 — GET /api/pedidos/:id — detalhe de um pedido para a tela de acompanhamento
// O cliente vê o próprio pedido; o vendedor do mercado também pode ver.
// Quando o pedido ainda aguarda Pix, recarrega o QR code do Asaas.
// ─────────────────────────────────────────────
const detalharPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT h.*, m.nome AS mercado, m.slug AS mercado_slug, u.nome AS cliente
      FROM historico_compras h
      JOIN mercados m ON m.id_mercado = h.id_mercado
      JOIN usuarios u ON u.id_usuario = h.id_usuario
      WHERE h.id = ${pedidoId}
    `;
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    // Cliente dono do pedido ou quem gerencia o mercado pode ver
    const dono = Number(pedido.id_usuario) === Number(id_usuario);
    let gerencia = false;
    if (!dono) {
      const [permissao] = await sql`
        SELECT 1 FROM usuarios_mercados
        WHERE id_usuario = ${id_usuario} AND id_mercado = ${pedido.id_mercado}
      `;
      gerencia = !!permissao;
    }
    if (!dono && !gerencia) {
      return res.status(403).json({ erro: 'Você não tem acesso a este pedido.' });
    }

    // Pedido aguardando Pix: devolve o QR atualizado para a tela
    let pagamento = null;
    if (pedido.status === 'aguardando_pagamento' && pedido.asaas_payment_id) {
      try {
        const cobranca = await asaas.buscarPagamento(pedido.asaas_payment_id);
        const statusAsaas = cobranca?.status || '';
        const pix = await asaas.buscarQrPix(pedido.asaas_payment_id).catch(() => null);
        pagamento = {
          id: pedido.asaas_payment_id,
          status: statusAsaas,
          vencimento: cobranca?.dueDate || null,
          qrCodeBase64: pix?.encodedImage || '',
          copiaEcola: pix?.payload || '',
          urlPagamento: cobranca?.invoiceUrl || '',
        };
        // Pagamento já confirmou mas o webhook atrasou → confirma agora
        if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(statusAsaas) && pedido.status === 'aguardando_pagamento') {
          await sql`UPDATE historico_compras SET status = 'pendente' WHERE id = ${pedido.id}`;
          pedido.status = 'pendente';
          avisarVendedorPedido(sql, pedido.id);
        }
      } catch (err) {
        // Asaas fora do ar não quebra a tela: só sem o QR
        console.error('Falha ao buscar pagamento do pedido:', err.message);
        pagamento = { id: pedido.asaas_payment_id, status: '', qrCodeBase64: '', copiaEcola: '', urlPagamento: '' };
      }
    }

    const total = (Number(pedido.valor_total) || 0)
      - (Number(pedido.desconto) || 0)
      + (Number(pedido.taxa_entrega) || 0);

    res.status(200).json({
      pedido: {
        id: pedido.id,
        mercado: pedido.mercado,
        mercadoSlug: pedido.mercado_slug || '',
        cliente: pedido.cliente,
        itens: pedido.produtos,
        valorTotal: Number(pedido.valor_total),
        taxaEntrega: Number(pedido.taxa_entrega) || 0,
        desconto: Number(pedido.desconto) || 0,
        cupom: pedido.cupom_codigo || '',
        total,
        tipoEntrega: pedido.tipo_entrega === 'retirada' ? 'retirada' : 'entrega',
        enderecoEntrega: pedido.endereco_entrega || '',
        agendamento: pedido.agendamento || '',
        observacao: pedido.observacao || '',
        status: pedido.status || 'pendente',
        formaPagamento: pedido.forma_pagamento || 'presencial',
        dataCompra: pedido.data_compra,
        gerencia,
      },
      pagamento,
    });
  } catch (err) {
    console.error('ERRO detalharPedido:', err);
    res.status(500).json({ erro: 'Não foi possível carregar o pedido.' });
  }
};

// ─────────────────────────────────────────────
// Cliente remove um pedido da própria lista "Meus pedidos".
// É uma exclusão APARÊNCIA: o pedido sai da tela do cliente, mas continua
// gravado no banco e aparece normalmente no painel da loja.
// ─────────────────────────────────────────────
const removerDoHistorico = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT id, id_usuario FROM historico_compras WHERE id = ${pedidoId}
    `;

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    if (pedido.id_usuario !== id_usuario) {
      return res.status(403).json({ erro: 'Este pedido não pertence a você.' });
    }

    await sql`
      UPDATE historico_compras SET removido_cliente = true WHERE id = ${pedidoId}
    `;

    res.status(200).json({ mensagem: 'Pedido removido do seu histórico.' });
  } catch (err) {
    console.error('ERRO removerDoHistorico:', err);
    res.status(500).json({ erro: 'Não foi possível remover o pedido do histórico.' });
  }
};

module.exports = {
  criarPedido,
  listarPedidosMercado,
  atualizarStatusPedido,
  cancelarPedido,
  itensParaRecompra,
  financeiroMercado,
  processarPagamentoPedido,
  meusPedidos,
  detalharPedido,
  removerDoHistorico,
};
