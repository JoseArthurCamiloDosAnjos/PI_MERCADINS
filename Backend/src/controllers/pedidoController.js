const { conectar } = require('../db/neon');
const asaas = require('../services/asaasService');
const {
  enviarEmailPedidoConfirmado,
  enviarEmailStatusPedido,
  enviarEmailPedidoVendedor,
  enviarEmailPagamentoAposCancelamento,
} = require('../utils/mailer');
const { enviarNotificacao } = require('../utils/notificacoes');
const { limitesDoPlano } = require('../utils/planos');

async function montarDadosPedidoParaEmail(sql, idPedido) {
  const [dados] = await sql`
    SELECT h.id, h.produtos, h.valor_total, h.taxa_entrega, h.desconto, h.cupom_codigo,
           h.tipo_entrega, h.agendamento, h.status, h.observacao, h.forma_pagamento,
           h.endereco_entrega, h.id_usuario, h.id_mercado,
           u.email, u.nome AS cliente, u.telefone AS telefone_cliente,
           m.nome AS mercado, m.email AS email_vendedor, m.telefone AS telefone_vendedor
    FROM historico_compras h
    JOIN usuarios u ON u.id_usuario = h.id_usuario
    JOIN mercados m ON m.id_mercado = h.id_mercado
    WHERE h.id = ${idPedido}
  `;
  if (!dados || !dados.email) return null;
  return {
    numero: dados.id,
    idUsuario: dados.id_usuario,
    idMercado: dados.id_mercado,
    cliente: dados.cliente,
    telefoneCliente: dados.telefone_cliente || '',
    telefoneVendedor: dados.telefone_vendedor || '',
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

function avisarVendedorPedido(sql, idPedido) {
  montarDadosPedidoParaEmail(sql, idPedido)
    .then((dados) => {
      if (!dados) return;
      const envios = [];
      if (dados.emailVendedor) {
        envios.push(
          enviarEmailPedidoVendedor(dados.emailVendedor, dados)
            .catch((err) => console.error('Falha no e-mail de pedido ao vendedor:', err.message))
        );
        envios.push(
          enviarNotificacao(sql, {
            id_mercado: dados.idMercado,
            email: dados.emailVendedor,
            tipo: 'pedido_novo_vendedor',
            titulo: 'Novo pedido recebido',
            mensagem: `Olá! O ${dados.mercado} recebeu um novo pedido nº ${dados.numero}, de ${dados.cliente}, no valor de R$ ${dados.total.toFixed(2).replace('.', ',')}. Abra o painel do vendedor para acompanhar.`,
            enviarEmail: false,
          }).catch((err) => console.error('Falha na notificação ao vendedor:', err.message))
        );
      }
      return Promise.all(envios);
    })
    .catch((err) => console.error('Falha no e-mail de pedido ao vendedor:', err.message));
}

function avisarClientePedido(sql, idPedido, status) {
  montarDadosPedidoParaEmail(sql, idPedido)
    .then((dados) => {
      if (!dados?.email) return;
      const primeiroNome = String(dados.cliente || '').split(' ')[0];
      const textos = {
        pendente: [
          'Pedido recebido',
          `Olá, ${primeiroNome}! Seu pedido nº ${dados.numero} no ${dados.mercado} foi recebido e já está com a loja.`,
        ],
        preparo: [
          'Pedido em preparo',
          `Olá, ${primeiroNome}! O ${dados.mercado} começou a preparar o seu pedido nº ${dados.numero}.`,
        ],
        caminho: [
          'Pedido saiu para entrega',
          `Olá, ${primeiroNome}! O seu pedido nº ${dados.numero} saiu para entrega. Fique de olho no portão.`,
        ],
        entregue: [
          'Pedido entregue',
          `Olá, ${primeiroNome}! O seu pedido nº ${dados.numero} foi entregue. Obrigado por comprar no Mercadins.`,
        ],
        cancelado: [
          'Pedido cancelado',
          `Olá, ${primeiroNome}! O seu pedido nº ${dados.numero} no ${dados.mercado} foi cancelado. Se precisar, fale com a loja pelo site.`,
        ],
      };
      const [titulo, mensagem] = textos[status] || [
        'Atualização do pedido',
        `Olá, ${primeiroNome}! O seu pedido nº ${dados.numero} no ${dados.mercado} foi atualizado para: ${status}.`,
      ];
      return enviarNotificacao(sql, {
        id_usuario: dados.idUsuario,
        email: dados.email,
        tipo: `pedido_${status}`,
        titulo,
        mensagem,
        enviarEmail: false,
      });
    })
    .catch((err) => console.error('Falha na notificação do pedido:', err.message));
}

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

async function devolverEstoque(sql, itens) {
  for (const item of itens || []) {
    await sql`
      UPDATE produtos SET estoque = estoque + ${Number(item.quantidade)}
      WHERE id_produto = ${Number(item.id_produto)}
    `;
  }
}

async function devolverCupom(sql, idMercado, cupomCodigo) {
  const codigo = String(cupomCodigo || '').trim().toUpperCase();
  if (!codigo) return;
  const [cupom] = await sql`
    SELECT id FROM cupons
    WHERE id_mercado = ${Number(idMercado)} AND upper(codigo) = ${codigo}
  `;
  if (cupom) {
    await sql`UPDATE cupons SET usos = GREATEST(usos - 1, 0) WHERE id = ${cupom.id}`;
  }
}

function valorSplitCalculado(split, netValue) {
  if (split?.fixedValue != null) return Number(split.fixedValue) || 0;
  const pct = split?.percentualValue != null ? Number(split.percentualValue) : null;
  const liquido = netValue != null ? Number(netValue) : null;
  if (pct != null && liquido != null) return Math.round(liquido * pct) / 100;
  return 0;
}

async function sincronizarRepasses(sql, pedidoId, pagamento) {
  const lista = Array.isArray(pagamento?.split) ? pagamento.split : [];
  if (lista.length === 0) return;

  await sql`
    DELETE FROM repasses
    WHERE id_pedido = ${pedidoId} AND asaas_split_id IS NULL
  `;

  for (const s of lista) {
    if (!s?.id) continue;
    const valor = valorSplitCalculado(s, pagamento.netValue);
    await sql`
      INSERT INTO repasses (id_pedido, asaas_payment_id, asaas_split_id, wallet_id, valor, status, motivo)
      VALUES (
        ${pedidoId}, ${pagamento.id || null}, ${s.id}, ${s.walletId || null},
        ${Number(valor).toFixed(2)}, ${s.status || 'PENDENTE'}, ${s.refusalReason || ''}
      )
      ON CONFLICT (asaas_split_id) DO UPDATE
      SET status = EXCLUDED.status,
          valor = CASE WHEN EXCLUDED.valor > 0 THEN EXCLUDED.valor ELSE repasses.valor END,
          asaas_payment_id = COALESCE(EXCLUDED.asaas_payment_id, repasses.asaas_payment_id),
          motivo = CASE WHEN EXCLUDED.motivo != '' THEN EXCLUDED.motivo ELSE repasses.motivo END,
          atualizado_em = NOW()
    `;
  }
}

async function registrarRepassesCriacao(sql, pedidoId, pagamento, { walletId, splitEnviado, motivoSplit, valorTotal }) {
  const temSplit = Array.isArray(pagamento?.split) && pagamento.split.length > 0;
  if (temSplit) {
    await sincronizarRepasses(sql, pedidoId, pagamento);
    return;
  }
  if (splitEnviado) {
    return;
  }
  const motivo = walletId
    ? `Split recusado pelo Asaas${motivoSplit ? `: ${motivoSplit}` : ''} — valor na conta da plataforma`
    : 'Sem wallet do vendedor — valor na conta da plataforma';
  await sql`
    INSERT INTO repasses (id_pedido, asaas_payment_id, wallet_id, valor, status, motivo)
    VALUES (
      ${pedidoId}, ${pagamento?.id || null}, ${walletId || null},
      ${Number(valorTotal || 0).toFixed(2)},
      'RETIDO_PLATAFORMA',
      ${motivo}
    )
  `;
}

const criarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);
  const { itens, observacao, tipo_entrega, cupom, agendamento, forma_pagamento, endereco_entrega } = req.body;

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Informe os itens do pedido.' });
  }

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

  const formaPagamento = forma_pagamento === 'cartao' ? 'cartao' : 'presencial';
  const statusInicial = formaPagamento === 'presencial' ? 'pendente' : 'aguardando_pagamento';

  const tipoEntrega = tipo_entrega === 'retirada' ? 'retirada' : 'entrega';

  const observacaoLimpa = typeof observacao === 'string'
    ? observacao.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300)
    : '';

  const agendamentoLimpo = typeof agendamento === 'string'
    ? agendamento.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 60)
    : '';

  const enderecoLimpo = tipoEntrega === 'entrega' && typeof endereco_entrega === 'string'
    ? endereco_entrega.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 300)
    : '';

  try {
    const sql = await conectar();

    const idsProdutos = [...new Set(itens.map(i => Number(i.id_produto)))];

    const produtos = await sql`
      SELECT p.id_produto, p.nome, p.preco, p.estoque, p.id_categoria
      FROM produtos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE c.id_mercado = ${mercadoId}
        AND p.id_produto = ANY(${idsProdutos})
    `;

    if (produtos.length !== idsProdutos.length) {
      return res.status(400).json({ erro: 'Alguns produtos não pertencem a este mercado.' });
    }

    const [mercado] = await sql`
      SELECT nome, taxa_entrega, pedido_minimo, oferece_entrega, oferece_retirada, asaas_wallet_id, plano, status
      FROM mercados
      WHERE id_mercado = ${mercadoId}
    `;
    if (!mercado) {
      return res.status(404).json({ erro: 'Mercado não encontrado.' });
    }
    if (mercado.status !== 'ativo') {
      return res.status(403).json({ erro: 'Este mercado não está aceitando pedidos no momento.' });
    }

    const limites = limitesDoPlano(mercado.plano);
    const [pedidosMes] = await sql`
      SELECT COUNT(*)::int AS total
      FROM historico_compras
      WHERE id_mercado = ${mercadoId}
        AND status <> 'cancelado'
        AND data_compra >= DATE_TRUNC('month', NOW())
    `;
    if (pedidosMes.total >= limites.pedidosMes) {
      return res.status(403).json({
        erro: `Seu plano ${limites.nome} permite até ${limites.pedidosMes} pedidos por mês. Faça upgrade para continuar recebendo pedidos.`,
      });
    }

    if (tipoEntrega === 'entrega' && mercado.oferece_entrega === false) {
      return res.status(400).json({ erro: 'Este mercado não faz entrega — escolha retirar no balcão.' });
    }
    if (tipoEntrega === 'retirada' && mercado.oferece_retirada === false) {
      return res.status(400).json({ erro: 'Este mercado não permite retirada no balcão.' });
    }

    const mapaProdutos = new Map(produtos.map(p => [Number(p.id_produto), p]));

    let valorTotal = 0;
    const resumo = [];
    const itensPedido = [];
    for (const item of itens) {
      const produto    = mapaProdutos.get(Number(item.id_produto));
      const quantidade = Number(item.quantidade);

      const disponivel = Number(produto.estoque) || 0;
      if (quantidade > disponivel) {
        const motivo = disponivel <= 0
          ? `O produto "${produto.nome}" está sem estoque.`
          : `Estoque insuficiente para "${produto.nome}": disponível ${disponivel}, solicitado ${quantidade}.`;
        return res.status(400).json({ erro: motivo });
      }
      const totalItem = Number(produto.preco ?? 0) * quantidade;
      valorTotal += totalItem;
      itensPedido.push({
        id_produto: Number(produto.id_produto),
        id_categoria: Number(produto.id_categoria),
        total: totalItem,
      });
      resumo.push(`${quantidade}x ${produto.nome}`);
    }

    const pedidoMinimo = Number(mercado.pedido_minimo) || 0;
    if (tipoEntrega === 'entrega' && pedidoMinimo > 0 && valorTotal < pedidoMinimo) {
      return res.status(400).json({
        erro: `Pedido mínimo de R$ ${pedidoMinimo.toFixed(2).replace('.', ',')} para entrega.`,
      });
    }

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

      const categoriasCupom = await sql`
        SELECT cc.id_categoria, c.nome
        FROM cupom_categorias cc
        JOIN categorias c ON c.id_categoria = cc.id_categoria
        WHERE cc.id_cupom = ${registro.id}
        ORDER BY c.nome ASC
      `;
      const produtosCupom = await sql`
        SELECT cp.id_produto, p.nome
        FROM cupom_produtos cp
        JOIN produtos p ON p.id_produto = cp.id_produto
        WHERE cp.id_cupom = ${registro.id}
        ORDER BY p.nome ASC
      `;

      let baseDesconto = valorTotal;
      if (categoriasCupom.length > 0 || produtosCupom.length > 0) {
        const idsCategorias = new Set(categoriasCupom.map(c => Number(c.id_categoria)));
        const idsProdutos = new Set(produtosCupom.map(p => Number(p.id_produto)));
        baseDesconto = Math.round(
          itensPedido
            .filter(item =>
              (idsCategorias.size > 0 && idsCategorias.has(item.id_categoria)) ||
              (idsProdutos.size > 0 && idsProdutos.has(item.id_produto))
            )
            .reduce((soma, item) => soma + item.total, 0) * 100
        ) / 100;

        if (baseDesconto <= 0) {
          const partes = [];
          if (categoriasCupom.length > 0) partes.push(categoriasCupom.map(c => c.nome).join(', '));
          if (produtosCupom.length > 0) partes.push(produtosCupom.map(p => p.nome).join(', '));
          return res.status(400).json({
            erro: `Este cupom vale apenas para: ${partes.join(' | ')}.`,
          });
        }
      }

      desconto = registro.tipo === 'percentual'
        ? baseDesconto * (Number(registro.valor) / 100)
        : Number(registro.valor);
      desconto = Math.min(Math.round(desconto * 100) / 100, baseDesconto);
      cupomRegistro = registro;
    }

    const taxaEntrega = tipoEntrega === 'entrega' ? Number(mercado.taxa_entrega) || 0 : 0;

    const produtoIds = idsProdutos.join(',');

    const itensJson = itens.map(i => ({
      id_produto: Number(i.id_produto),
      quantidade: Number(i.quantidade),
    }));

    const pedido = await sql.transaction(async (tx) => {
      const [novo] = await tx`
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

      await baixarEstoque(tx, itensJson);

      if (cupomRegistro) {
        const [cupomOk] = await tx`
          UPDATE cupons SET usos = usos + 1
          WHERE id = ${cupomRegistro.id}
            AND (max_usos IS NULL OR usos < max_usos)
          RETURNING id
        `;
        if (!cupomOk) {
          throw new Error('Este cupom já atingiu o limite de usos.');
        }
      }

      await tx`
        DELETE FROM carrinho
        WHERE id_usuario = ${id_usuario}
          AND id_mercado = ${mercadoId}
          AND id_produto = ANY(${idsProdutos})
      `;

      return novo;
    });

    const totalPedido = round2(valorTotal - desconto + taxaEntrega);

    // ── Pagamento online (cartão) — B3 ───────────────────────────────────────
    if (formaPagamento !== 'presencial') {
      const walletId0 = String(mercado.asaas_wallet_id || '').trim() || null;
      const refPedido0 = `pedido:${pedido.id}`;
      let walletId = walletId0;
      let refPedido = refPedido0;
      let splitEnviado = false;
      let motivoSplit = '';
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

        walletId = walletId0;
        refPedido = refPedido0;
        const splits = asaas.montarSplitVendedor(walletId, refPedido);
        splitEnviado = !!splits;
        motivoSplit = '';

        const descricao = `Pedido nº ${pedido.id} — ${mercado.nome}`;
        let pagamento;
        try {
          pagamento = await asaas.criarPagamentoPedidoCartao({
            customerId: customer.id,
            valor: totalPedido,
            descricao,
            externalReference: refPedido,
            splits: splits || undefined,
          });
        } catch (erroSplit) {
          motivoSplit = String(erroSplit.message || '');
          const ehRecusaSplit =
            Number(erroSplit.status) >= 400 &&
            Number(erroSplit.status) < 500 &&
            /split|wallet|carteira|invalid_action/i.test(motivoSplit);
          if (!splits || !ehRecusaSplit) {
            throw erroSplit;
          }
          const existente = await asaas
            .buscarPagamentoPorExternalReference(refPedido)
            .catch(() => null);
          if (existente?.id) {
            console.warn(
              `Pedido ${pedido.id}: erro de split (${motivoSplit}), mas cobrança ${existente.id} já existe — reutilizando sem recriar.`
            );
            pagamento = {
              id: existente.id,
              status: existente.status,
              vencimento: existente.dueDate || null,
              qrCodeBase64: '',
              copiaEcola: '',
              urlPagamento: existente.invoiceUrl || '',
              split: Array.isArray(existente.split) ? existente.split : [],
              semRedirect: false,
            };
          } else {
            console.error(`Pedido ${pedido.id}: split recusado (${motivoSplit}) — cobrança refeita sem split.`);
            splitEnviado = false;
            pagamento = await asaas.criarPagamentoPedidoCartao({
              customerId: customer.id,
              valor: totalPedido,
              descricao,
              externalReference: refPedido,
            });
          }
        }

        await sql`
          UPDATE historico_compras SET asaas_payment_id = ${pagamento.id}
          WHERE id = ${pedido.id}
        `;

        await registrarRepassesCriacao(sql, pedido.id, pagamento, {
          walletId,
          splitEnviado,
          motivoSplit,
          valorTotal: totalPedido,
        });

        return res.status(201).json({
          mensagem: 'Pedido criado. Finalize o pagamento do cartão para a loja iniciar o preparo.',
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
            semRedirect: pagamento.semRedirect === true,
          },
        });
      } catch (erroPagamento) {
        // ── Erros tipados: validação × rede × servidor ──────────────────────
        const tipoErro = asaas.classificarErroAsaas(erroPagamento);
        if (tipoErro === 'rede' && refPedido) {
          try {
            const existente = await asaas.buscarPagamentoPorExternalReference(refPedido);
            if (existente?.id) {
              console.warn(
                `Pedido ${pedido.id}: erro de rede na criação, mas cobrança ${existente.id} existe no Asaas — adotando (sem rollback).`
              );
              const pagamentoAdotado = {
                id: existente.id,
                status: existente.status,
                vencimento: existente.dueDate || null,
                qrCodeBase64: '',
                copiaEcola: '',
                urlPagamento: existente.invoiceUrl || '',
                split: Array.isArray(existente.split) ? existente.split : [],
                semRedirect: false,
              };
              await sql`
                UPDATE historico_compras SET asaas_payment_id = ${existente.id}
                WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'
              `;
              await registrarRepassesCriacao(sql, pedido.id, pagamentoAdotado, {
                walletId,
                splitEnviado,
                motivoSplit,
                valorTotal: totalPedido,
              });
              return res.status(201).json({
                mensagem: 'Pedido criado. Finalize o pagamento do cartão para a loja iniciar o preparo.',
                pedido: {
                  ...pedido,
                  total: totalPedido,
                  forma_pagamento: formaPagamento,
                },
                pagamento: {
                  id: pagamentoAdotado.id,
                  vencimento: pagamentoAdotado.vencimento || null,
                  qrCodeBase64: pagamentoAdotado.qrCodeBase64 || '',
                  copiaEcola: pagamentoAdotado.copiaEcola || '',
                  urlPagamento: pagamentoAdotado.urlPagamento || '',
                  semRedirect: false,
                },
              });
            }
          } catch (erroBusca) {
            console.error(
              `CRÍTICO — Pedido ${pedido.id}: falha ao verificar cobrança após erro de rede ` +
              `(${erroBusca.message}). Se o Asaas criou a cobrança para ${refPedido}, ` +
              'há uma cobrança órfã — reconciliar no painel do Asaas.'
            );
          }
        }

        await sql`DELETE FROM historico_compras WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'`;
        await sql`DELETE FROM repasses WHERE id_pedido = ${pedido.id}`;
        await devolverEstoque(sql, itensJson);
        if (cupomRegistro) {
          await sql`UPDATE cupons SET usos = GREATEST(usos - 1, 0) WHERE id = ${cupomRegistro.id}`;
        }
        const motivo = String(erroPagamento.message || '');
        console.error(`Pedido ${pedido.id} desfeito: pagamento não iniciado [${tipoErro}] (${motivo}).`);
        let aviso = 'Não foi possível iniciar o pagamento online. Tente novamente ou escolha pagar na entrega.';
        if (tipoErro === 'rede') {
          aviso = 'Falha de conexão ao iniciar o pagamento. Verifique sua internet e tente novamente.';
        } else if (tipoErro === 'servidor') {
          aviso = 'O serviço de pagamento está instável no momento. Tente novamente em instantes ou escolha pagar na entrega.';
        }
        if (/CPF|CNPJ/i.test(motivo)) {
          aviso = 'Falta o CPF/CNPJ na sua conta para pagar online. Cadastre-o no perfil ou escolha pagar na entrega.';
        } else if (/acesso|access_token|api key|chave|401|403/i.test(motivo)) {
          aviso = 'Pagamento online indisponível no momento. Escolha pagar na entrega.';
        }
        const statusHttp = tipoErro === 'validacao' ? 400 : 502;
        return res.status(statusHttp).json({ erro: aviso, detalhe: motivo, tipo: tipoErro });
      }
    }

    // ── Pagar na entrega: pedido já entra em andamento ───────────────────────
    montarDadosPedidoParaEmail(sql, pedido.id)
      .then((dados) => dados && enviarEmailPedidoConfirmado(dados.email, dados))
      .catch((err) => console.error('Falha no e-mail de confirmação do pedido:', err.message));
    avisarVendedorPedido(sql, pedido.id);
    avisarClientePedido(sql, pedido.id, 'pendente');

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
    const msg = String(err.message || '');
    if (msg.includes('estoque') || msg.includes('cupom')) {
      return res.status(400).json({ erro: msg });
    }
    res.status(500).json({ erro: 'Não foi possível registrar o pedido. Tente novamente.' });
  }
};

const listarPedidosMercado = async (req, res) => {
  const id_usuario = req.usuarioId;
  const mercadoId  = Number(req.params.id);

  if (!Number.isInteger(mercadoId) || mercadoId <= 0) {
    return res.status(400).json({ erro: 'Mercado inválido.' });
  }

  try {
    const sql = await conectar();

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

    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${pedido.id_mercado}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso a este pedido.' });
    }

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

    montarDadosPedidoParaEmail(sql, pedidoId)
      .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, status))
      .catch((err) => console.error('Falha no e-mail de status do pedido:', err.message));
    avisarClientePedido(sql, pedidoId, status);

    res.status(200).json({ mensagem: 'Status atualizado com sucesso.', pedido: atualizado });
  } catch (err) {
    console.error('ERRO atualizarStatusPedido:', err);
    res.status(500).json({ erro: 'Não foi possível atualizar o status.' });
  }
};

const round2 = (v) => Math.round(v * 100) / 100;

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

    const [permissao] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_usuario = ${id_usuario} AND id_mercado = ${mercadoId}
    `;
    if (!permissao) {
      return res.status(403).json({ erro: 'Você não tem acesso ao financeiro deste mercado.' });
    }

    const folgaInicio = new Date(ano, mes - 1, 0);
    const folgaFim    = new Date(ano, mes, 2);

    const pedidos = await sql`
      SELECT h.produtos, h.valor_total, h.desconto, h.taxa_entrega, h.status,
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
      SELECT custos_fixos, asaas_wallet_id FROM mercados WHERE id_mercado = ${mercadoId}
    `;

    const repassesMes = await sql`
      SELECT r.status, COALESCE(r.valor, 0) AS valor
      FROM repasses r
      JOIN historico_compras h ON h.id = r.id_pedido
      WHERE h.id_mercado = ${mercadoId}
        AND h.data_compra >= ${folgaInicio}
        AND h.data_compra <  ${folgaFim}
      LIMIT 5000
    `;
    let repasseLiquidado = 0, repassePendente = 0, repasseRetido = 0;
    for (const r of repassesMes) {
      const v = Number(r.valor) || 0;
      if (r.status === 'DONE') repasseLiquidado += v;
      else if (r.status === 'RETIDO_PLATAFORMA') repasseRetido += v;
      else repassePendente += v;
    }

    const mapaProdutos = new Map(produtosMercado.map(p => [p.nome, p]));

    let faturamento = 0, custoMercadoria = 0, totalPedidos = 0, itensSemCusto = 0;
    const porStatus = { pendente: 0, preparo: 0, caminho: 0, entregue: 0 };
    const porDia = new Map();
    const porProduto = new Map();

    for (const p of pedidos) {
      const d = new Date(p.data_local);
      if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) continue;

      const st = p.status || 'pendente';
      porStatus[st] = (porStatus[st] || 0) + 1;

      if (st === 'cancelado' || st === 'aguardando_pagamento') continue;

      const valor = round2(
        (Number(p.valor_total) || 0) - (Number(p.desconto) || 0) + (Number(p.taxa_entrega) || 0)
      );
      faturamento += valor;
      totalPedidos += 1;

      const dia = d.getDate();
      const reg = porDia.get(dia) || { pedidos: 0, receita: 0 };
      reg.pedidos += 1;
      reg.receita += valor;
      porDia.set(dia, reg);

      for (const item of parseItensPedido(p.produtos)) {
        const ref = mapaProdutos.get(item.nome);
        const custo = ref ? Number(ref.custo) || 0 : 0;
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
      recebimento: {
        walletCadastrado: !!mercado?.asaas_wallet_id,
        liquidado: round2(repasseLiquidado),
        pendente: round2(repassePendente),
        retidoPlataforma: round2(repasseRetido),
      },
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

async function cancelarPedidoPorFalha(sql, pedido, { statusAsaas, paymentId, origem }) {
  const [cancelado] = await sql`
    UPDATE historico_compras
    SET status = 'cancelado',
        motivo_cancelamento = ${`Pagamento não confirmado no Asaas (${statusAsaas})`},
        asaas_payment_id = COALESCE(${paymentId || null}, asaas_payment_id)
    WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'
    RETURNING id
  `;
  if (!cancelado) return false;

  await sql`DELETE FROM repasses WHERE id_pedido = ${pedido.id}`;
  await devolverEstoque(sql, pedido.itens_json);
  await devolverCupom(sql, pedido.id_mercado, pedido.cupom_codigo);
  montarDadosPedidoParaEmail(sql, pedido.id)
    .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, 'cancelado'))
    .catch((err) => console.error('Falha no e-mail de cancelamento:', err.message));
  avisarClientePedido(sql, pedido.id, 'cancelado');
  console.error(`Pedido ${pedido.id} cancelado [${origem}]: pagamento ${statusAsaas}.`);
  return true;
}

function avisarPagamentoAposCancelamento(sql, idPedido, estornado) {
  montarDadosPedidoParaEmail(sql, idPedido)
    .then((dados) => {
      if (!dados) return;
      const desfecho = estornado
        ? 'O estorno já foi solicitado no Asaas e o valor volta para o meio de pagamento do cliente.'
        : 'Atenção: o estorno automático falhou — faça o estorno manualmente no painel do Asaas.';
      if (dados.email) {
        enviarNotificacao(sql, {
          id_usuario: dados.idUsuario,
          email: dados.email,
          tipo: 'pedido_pagamento_estorno',
          titulo: 'Pagamento confirmado após cancelamento',
          mensagem: `Olá, ${String(dados.cliente || '').split(' ')[0]}! O pagamento do pedido nº ${dados.numero} foi confirmado depois do cancelamento. ${desfecho}`,
          enviarEmail: false,
        }).catch((err) => console.error('Falha na notificação pós-cancelamento:', err.message));
      }
      if (dados.emailVendedor) {
        enviarNotificacao(sql, {
          id_mercado: dados.idMercado,
          email: dados.emailVendedor,
          tipo: 'pedido_pagamento_estorno_vendedor',
          titulo: 'Pagamento após cancelamento',
          mensagem: `O pedido nº ${dados.numero} do ${dados.mercado} teve o pagamento confirmado DEPOIS de cancelado. ${desfecho}`,
        }).catch((err) => console.error('Falha na notificação ao vendedor:', err.message));
      }
    })
    .catch((err) => console.error('Falha ao avisar pagamento pós-cancelamento:', err.message));
}

async function processarPagamentoPedido(sql, evento, pagamentoAsaas) {
  let confirmado = pagamentoAsaas;
  let statusAsaas = pagamentoAsaas?.status || '';
  try {
    confirmado = await asaas.buscarPagamento(pagamentoAsaas.id);
    statusAsaas = confirmado?.status || statusAsaas;
  } catch (erro) {
    throw erro;
  }
  if (!confirmado) return { ignorado: true };

  const ref = confirmado.externalReference || '';
  const [, idStr] = String(ref).split(':');
  const pedidoId = Number(idStr);

  const [pedido] = Number.isInteger(pedidoId) && pedidoId > 0
    ? await sql`SELECT * FROM historico_compras WHERE id = ${pedidoId}`
    : [];
  if (!pedido) return { ignorado: true };

  // ── Split: liquidação/cancelamento de UM repasse ao vendedor ──────────────
  if (String(evento).startsWith('PAYMENT_SPLIT_')) {
    const splitId = pagamentoAsaas?.additionalInfo?.splitId || null;
    const statusPorEvento = {
      PAYMENT_SPLIT_DONE: 'DONE',
      PAYMENT_SPLIT_CANCELLED: 'CANCELLED',
      PAYMENT_SPLIT_DIVERGENCE_BLOCK: 'DIVERGENCE_BLOCK',
      PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED: 'PENDENTE',
    };
    if (splitId && statusPorEvento[evento]) {
      await sql`
        UPDATE repasses SET status = ${statusPorEvento[evento]}, atualizado_em = NOW()
        WHERE asaas_split_id = ${splitId}
      `;
    }
  }

  try {
    await sincronizarRepasses(sql, pedido.id, confirmado);
  } catch (erroRepasses) {
    console.error(`Pedido ${pedido.id}: falha ao sincronizar repasses (${erroRepasses.message}).`);
  }

  // ── Máquina de estados (helper único em asaasService) ─────────────────────
  const classe = asaas.classificarStatusAsaas(statusAsaas);
  const pago = classe === 'pago_aprovado' || classe === 'pago_liquidado';

  if (pago) {
    const [atualizado] = await sql`
      UPDATE historico_compras SET status = 'pendente', asaas_payment_id = ${pagamentoAsaas.id}
      WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'
      RETURNING id
    `;
    if (atualizado) {
      montarDadosPedidoParaEmail(sql, pedido.id)
        .then((dados) => dados && enviarEmailPedidoConfirmado(dados.email, dados))
        .catch((err) => console.error('Falha no e-mail de pagamento do pedido:', err.message));
      avisarVendedorPedido(sql, pedido.id);
      avisarClientePedido(sql, pedido.id, 'pendente');
      return { recebido: true, pago: true };
    }

    const [atual] = await sql`
      SELECT status FROM historico_compras WHERE id = ${pedido.id}
    `;
    if (atual?.status === 'cancelado') {
      await sql`
        UPDATE historico_compras SET asaas_payment_id = ${pagamentoAsaas.id}
        WHERE id = ${pedido.id}
      `;
      let estornado = false;
      try {
        await asaas.estornarPagamento(pagamentoAsaas.id);
        estornado = true;
        console.error(
          `Pedido ${pedido.id}: pagamento ${pagamentoAsaas.id} confirmado APÓS cancelamento — estorno automático solicitado.`
        );
      } catch (erroEstorno) {
        console.error(
          `CRÍTICO — Pedido ${pedido.id}: pagamento ${pagamentoAsaas.id} confirmado após cancelamento e o estorno FALHOU (${erroEstorno.message}). Estornar manualmente no painel do Asaas.`
        );
      }
      montarDadosPedidoParaEmail(sql, pedido.id)
        .then((dados) => dados && enviarEmailPagamentoAposCancelamento(dados.email, dados, { estornado }))
        .catch((err) => console.error('Falha no e-mail de pagamento pós-cancelamento:', err.message));
      avisarPagamentoAposCancelamento(sql, pedido.id, estornado);
      return { recebido: true, estornado };
    }

    return { recebido: true, pago: true };
  }

  if (classe === 'falha') {
    const cancelado = await cancelarPedidoPorFalha(sql, pedido, {
      statusAsaas,
      paymentId: pagamentoAsaas.id,
      origem: 'webhook',
    });
    return { recebido: true, ...(cancelado ? { cancelado: true } : {}) };
  }

  if (classe === 'estorno_concluido') {
    const [atual] = await sql`
      SELECT status FROM historico_compras WHERE id = ${pedido.id}
    `;
    if (atual && !['cancelado', 'aguardando_pagamento'].includes(atual.status)) {
      const [cancelado] = await sql`
        UPDATE historico_compras
        SET status = 'cancelado',
            motivo_cancelamento = ${`Estorno/chargeback do pagamento (${statusAsaas})`}
        WHERE id = ${pedido.id} AND status = ${atual.status}
        RETURNING id
      `;
      if (cancelado) {
        await sql`DELETE FROM repasses WHERE id_pedido = ${pedido.id}`;
        if (atual.status !== 'entregue') {
          await devolverEstoque(sql, pedido.itens_json);
        }
        await devolverCupom(sql, pedido.id_mercado, pedido.cupom_codigo);
        montarDadosPedidoParaEmail(sql, pedido.id)
          .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, 'cancelado'))
          .catch((err) => console.error('Falha no e-mail de cancelamento:', err.message));
        avisarClientePedido(sql, pedido.id, 'cancelado');
        console.error(
          `Pedido ${pedido.id} cancelado: ${statusAsaas} em pedido já confirmado (status anterior: ${atual.status}, ${evento}).`
        );
        return { recebido: true, cancelado: true };
      }
    }
    return { recebido: true };
  }

  if (classe === 'estorno_solicitado') {
    console.warn(
      `Pedido ${pedido.id}: estorno SOLICITADO (${statusAsaas}, ${evento}) — sem transição até REFUNDED.`
    );
    return { recebido: true, estornoSolicitado: true };
  }

  return { recebido: true };
}

const cancelarPedido = async (req, res) => {
  const id_usuario = req.usuarioId;
  const pedidoId   = Number(req.params.id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return res.status(400).json({ erro: 'Pedido inválido.' });
  }

  try {
    const sql = await conectar();

    const [pedido] = await sql`
      SELECT id, id_usuario, id_mercado, status, forma_pagamento, asaas_payment_id, itens_json, cupom_codigo
      FROM historico_compras
      WHERE id = ${pedidoId}
    `;
    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }

    if (Number(pedido.id_usuario) !== Number(id_usuario)) {
      return res.status(403).json({ erro: 'Você não pode cancelar este pedido.' });
    }

    if (pedido.status === 'cancelado') {
      return res.status(200).json({ mensagem: 'Este pedido já estava cancelado.', pedido: { id: pedido.id, status: 'cancelado' } });
    }

    if (!['pendente', 'aguardando_pagamento'].includes(pedido.status)) {
      return res.status(400).json({
        erro: 'Este pedido já está em preparo e não pode mais ser cancelado. Fale com a loja.',
      });
    }

    if (pedido.status === 'pendente' && ['pix', 'cartao'].includes(pedido.forma_pagamento)) {
      return res.status(400).json({
        erro: 'Este pedido já foi pago e não pode ser cancelado pela tela. Fale com a loja para combinar o estorno.',
      });
    }

    const [cancelado] = await sql`
      UPDATE historico_compras
      SET status = 'cancelado', motivo_cancelamento = 'Cancelado pelo cliente'
      WHERE id = ${pedido.id} AND status IN ('pendente', 'aguardando_pagamento')
      RETURNING id, status
    `;
    if (!cancelado) {
      return res.status(409).json({ erro: 'Este pedido não pode mais ser cancelado.' });
    }

    await devolverEstoque(sql, pedido.itens_json);

    await devolverCupom(sql, pedido.id_mercado, pedido.cupom_codigo);

    await sql`DELETE FROM repasses WHERE id_pedido = ${pedido.id}`;

    if (pedido.asaas_payment_id) {
      try {
        await asaas.cancelarPagamento(pedido.asaas_payment_id);
      } catch (err) {
        console.error(`Falha ao cancelar cobrança ${pedido.asaas_payment_id} no Asaas: ${err.message}`);
      }
    }

    montarDadosPedidoParaEmail(sql, pedido.id)
      .then((dados) => dados && enviarEmailStatusPedido(dados.email, dados, 'cancelado'))
      .catch((err) => console.error('Falha no e-mail de cancelamento:', err.message));
    avisarClientePedido(sql, pedido.id, 'cancelado');

    res.status(200).json({
      mensagem: 'Pedido cancelado. O estoque dos produtos voltou para a loja.',
      pedido: { id: pedido.id, status: 'cancelado' },
    });
  } catch (err) {
    console.error('ERRO cancelarPedido:', err);
    res.status(500).json({ erro: 'Não foi possível cancelar o pedido. Tente novamente.' });
  }
};

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

    let pagamento = null;
    if (pedido.status === 'aguardando_pagamento' && pedido.asaas_payment_id) {
      try {
        const cobranca = await asaas.buscarPagamento(pedido.asaas_payment_id);
        const statusAsaas = cobranca?.status || '';
        const classe = asaas.classificarStatusAsaas(statusAsaas);
        pagamento = {
          id: pedido.asaas_payment_id,
          status: statusAsaas,
          vencimento: cobranca?.dueDate || null,
          qrCodeBase64: '',
          copiaEcola: '',
          urlPagamento: cobranca?.invoiceUrl || '',
        };
        if (classe === 'pago_aprovado' || classe === 'pago_liquidado') {
          const [atualizado] = await sql`
            UPDATE historico_compras SET status = 'pendente'
            WHERE id = ${pedido.id} AND status = 'aguardando_pagamento'
            RETURNING id
          `;
          pedido.status = 'pendente';
          if (atualizado) {
            montarDadosPedidoParaEmail(sql, pedido.id)
              .then((dados) => dados && enviarEmailPedidoConfirmado(dados.email, dados))
              .catch((err) => console.error('Falha no e-mail de pagamento do pedido:', err.message));
            avisarVendedorPedido(sql, pedido.id);
            avisarClientePedido(sql, pedido.id, 'pendente');
          }
          await sincronizarRepasses(sql, pedido.id, cobranca);
        } else if (classe === 'falha') {
          const cancelado = await cancelarPedidoPorFalha(sql, pedido, {
            statusAsaas,
            paymentId: pedido.asaas_payment_id,
            origem: 'detalharPedido',
          });
          if (cancelado) {
            pedido.status = 'cancelado';
            pagamento = {
              id: pedido.asaas_payment_id,
              status: statusAsaas,
              vencimento: cobranca?.dueDate || null,
              qrCodeBase64: '',
              copiaEcola: '',
              urlPagamento: '',
            };
          } else {
            await sincronizarRepasses(sql, pedido.id, cobranca);
          }
        } else if (classe === 'estorno_concluido') {
          console.warn(
            `Pedido ${pedido.id}: status ${statusAsaas} (estorno concluído) ainda em aguardando_pagamento — verificar no Asaas.`
          );
          await sincronizarRepasses(sql, pedido.id, cobranca);
        } else {
          await sincronizarRepasses(sql, pedido.id, cobranca);
        }
      } catch (err) {
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