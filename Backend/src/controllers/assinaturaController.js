const { conectar } = require('../db/neon');
const asaas = require('../services/asaasService');
const { validarDadosMercado, criarMercadoCompleto } = require('./marketController');

// ─────────────────────────────────────────────
// Cria (ou recupera) o mercado a partir do payload gravado em
// assinaturas.dados_mercado. Chamado pelo webhook e pela recuperação.
// Retorna o mercado (novo ou já existente) ou lança erro.
// ─────────────────────────────────────────────
async function criarMercadoDaAssinatura(sql, assinatura) {
  if (assinatura.id_mercado) {
    const [mercado] = await sql`
      SELECT * FROM mercados WHERE id_mercado = ${assinatura.id_mercado}
    `;
    return mercado || null;
  }
  if (!assinatura.dados_mercado) return null;

  const dados = typeof assinatura.dados_mercado === 'string'
    ? JSON.parse(assinatura.dados_mercado)
    : assinatura.dados_mercado;

  const validacao = validarDadosMercado(dados);
  if (validacao.erro) {
    throw new Error(`Dados do mercado inválidos: ${validacao.erro}`);
  }
  // Força o plano escolhido no checkout (defesa extra, já que vem do servidor)
  validacao.dados.plano = assinatura.codigo_plano;

  const mercado = await criarMercadoCompleto(sql, assinatura.id_usuario, validacao.dados);

  await sql`
    UPDATE assinaturas
    SET id_mercado = ${mercado.id_mercado}, atualizada_em = NOW()
    WHERE id = ${assinatura.id}
  `;

  return mercado;
}

// POST /api/assinaturas/checkout — cria customer + assinatura no Asaas e retorna o link de pagamento
// O mercado NÃO é criado aqui: o payload do formulário fica guardado em
// assinaturas.dados_mercado e só vira mercado quando o pagamento confirma.
const criarCheckout = async (req, res) => {
  const id_usuario = req.usuarioId;
  const { codigo_plano, ciclo, mercado } = req.body;

  if (!codigo_plano || !['basico', 'profissional'].includes(codigo_plano)) {
    return res.status(400).json({ erro: 'Plano inválido.' });
  }
  if (!ciclo || !['mensal', 'anual'].includes(ciclo)) {
    return res.status(400).json({ erro: 'Ciclo de cobrança inválido.' });
  }
  if (!mercado || typeof mercado !== 'object') {
    return res.status(400).json({ erro: 'Dados do mercado ausentes.' });
  }

  const cicloDb = ciclo === 'anual' ? 'ANUAL' : 'MENSAL';
  const plano = asaas.obterPlano(codigo_plano, cicloDb);
  if (!plano) {
    return res.status(400).json({ erro: 'Plano não encontrado.' });
  }

  try {
    const sql = await conectar();

    // Valida os dados do mercado (mesma validação do cadastro direto)
    const validacao = validarDadosMercado({ ...mercado, plano: codigo_plano });
    if (validacao.erro) {
      return res.status(400).json({ erro: validacao.erro });
    }

    // Assinatura pendente/ativa/inadimplente → retoma em vez de bloquear
    const [assinaturaExistente] = await sql`
      SELECT * FROM assinaturas
      WHERE id_usuario = ${id_usuario}
        AND status IN ('pendente', 'ativa', 'inadimplente')
      ORDER BY id DESC
      LIMIT 1
    `;
    if (assinaturaExistente) {
      // Se já tem mercado (criado antes do fluxo novo ou já pago), devolve
      if (assinaturaExistente.status === 'ativa' && assinaturaExistente.id_mercado) {
        const [mercadoJaExiste] = await sql`
          SELECT * FROM mercados WHERE id_mercado = ${assinaturaExistente.id_mercado}
        `;
        if (mercadoJaExiste) {
          return res.json({
            mensagem: 'Você já possui uma assinatura ativa.',
            status: assinaturaExistente.status,
            mercado: mercadoJaExiste,
          });
        }
      }
      // Pendente/inadimplente → tenta retomar o link de pagamento existente
      if (assinaturaExistente.asaas_subscription_id) {
        let urlCheckout = null;
        try {
          urlCheckout = await asaas.buscarUrlPagamento(assinaturaExistente.asaas_subscription_id);
        } catch { /* assinatura morta no Asaas — cancela e refaz abaixo */ }

        if (urlCheckout) {
          return res.json({
            mensagem: 'Você já possui uma assinatura pendente. Retome o pagamento.',
            status: assinaturaExistente.status,
            idAssinatura: assinaturaExistente.id,
            urlCheckout,
          });
        }

        // Assinatura pendente sem cobrança válida (restou de um fluxo antigo
        // ou o Asaas expirou) → cancela e cria uma nova
        try {
          await asaas.cancelarAssinatura(assinaturaExistente.asaas_subscription_id);
        } catch { /* pode já estar cancelada no Asaas */ }
        await sql`
          UPDATE assinaturas
          SET status = 'cancelada', atualizada_em = NOW()
          WHERE id = ${assinaturaExistente.id}
        `;
      } else {
        return res.status(409).json({
          erro: 'Você já possui uma assinatura ativa ou pendente.',
          status: assinaturaExistente.status,
        });
      }
    }

    // Dados do usuário para o customer
    const [usuario] = await sql`
      SELECT nome, email, cpf, telefone FROM usuarios WHERE id_usuario = ${id_usuario}
    `;
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    // Customer no Asaas
    const customer = await asaas.criarCustomer({
      nome: usuario.nome,
      email: usuario.email,
      cpfCnpj: usuario.cpf || undefined,
      mobilePhone: usuario.telefone || undefined,
    });
    const customerId = customer.id;

    // Após pagar, o Asaas devolve o usuário para /registrar-mercado
    // (a tela detecta o pagamento via ?pagamento=1 e leva para o gerenciador)
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const redirectUrl = frontendUrl
      ? `${frontendUrl}/registrar-mercado?pagamento=1`
      : undefined;

    // Assinatura no Asaas
    const assinaturaAsaas = await asaas.criarAssinatura({
      customerId,
      valor: plano.valor,
      ciclo: cicloDb,
      descricao: `Plano ${plano.nome} Mercadins — ${cicloDb === 'ANUAL' ? 'anual' : 'mensal'}`,
      redirectUrl,
    });

    // Link de checkout da primeira cobrança
    const urlCheckout = await asaas.buscarUrlPagamento(assinaturaAsaas.id);

    // Grava assinatura localmente — o mercado ainda NÃO existe; o payload
    // fica em dados_mercado e será consumido pelo webhook quando pagar
    const [assinatura] = await sql`
      INSERT INTO assinaturas (
        id_usuario, id_mercado, codigo_plano, ciclo, valor,
        asaas_customer_id, asaas_subscription_id, status, proximo_pagamento, dados_mercado
      ) VALUES (
        ${id_usuario},
        null,
        ${plano.codigo}, ${cicloDb}, ${plano.valor.toFixed(2)},
        ${customerId}, ${assinaturaAsaas.id}, 'pendente', ${assinaturaAsaas.nextDueDate || null},
        ${JSON.stringify(validacao.dados)}
      )
      RETURNING *
    `;

    res.status(201).json({
      mensagem: 'Assinatura criada. Finalize o pagamento para ativar.',
      idAssinatura: assinatura.id,
      urlCheckout,
    });
  } catch (err) {
    console.error('ERRO criarCheckout:', err);
    res.status(500).json({ erro: err.message || 'Não foi possível iniciar o checkout.' });
  }
};

// GET /api/assinaturas/minha — assinatura + pagamentos do usuário logado
// Recupera o mercado se o pagamento já confirmou mas o webhook falhou.
const minhaAssinatura = async (req, res) => {
  const id_usuario = req.usuarioId;
  try {
    const sql = await conectar();

    const [assinatura] = await sql`
      SELECT * FROM assinaturas
      WHERE id_usuario = ${id_usuario}
      ORDER BY id DESC
      LIMIT 1
    `;
    if (!assinatura) {
      return res.json({ assinatura: null, pagamentos: [] });
    }

    // Se assinatura ativa e mercado ainda não existe → cria agora (retry do webhook)
    let mercadoRecuperado = null;
    if (assinatura.status === 'ativa' && !assinatura.id_mercado && assinatura.dados_mercado) {
      try {
        mercadoRecuperado = await criarMercadoDaAssinatura(sql, assinatura);
        if (mercadoRecuperado) {
          assinatura.id_mercado = mercadoRecuperado.id_mercado;
        }
      } catch (eRec) {
        console.error('ERRO minhaAssinatura (recuperar mercado):', eRec);
        // Não bloqueia a resposta; o webhook / novo acesso tenta de novo
      }
    }

    // Se pendente, devolve o link de pagamento para o frontend exibir botão
    let urlPagamento = null;
    if (assinatura.status === 'pendente' && assinatura.asaas_subscription_id) {
      try {
        urlPagamento = await asaas.buscarUrlPagamento(assinatura.asaas_subscription_id);
      } catch (eUrl) {
        console.error('ERRO minhaAssinatura (buscar URL):', eUrl);
      }
    }

    const pagamentos = await sql`
      SELECT id, asaas_payment_id, valor, status, metodo, vencimento, pago_em, criado_em
      FROM pagamentos
      WHERE id_assinatura = ${assinatura.id}
      ORDER BY id DESC
      LIMIT 12
    `;

    res.json({
      assinatura,
      pagamentos,
      urlPagamento,
      mercado: mercadoRecuperado || undefined,
    });
  } catch (err) {
    console.error('ERRO minhaAssinatura:', err);
    res.status(500).json({ erro: 'Não foi possível carregar a assinatura.' });
  }
};

// POST /api/assinaturas/:id/cancelar — cancela assinatura do próprio usuário
const cancelarAssinatura = async (req, res) => {
  const id_usuario = req.usuarioId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'Assinatura inválida.' });
  }

  try {
    const sql = await conectar();

    const [assinatura] = await sql`
      SELECT * FROM assinaturas WHERE id = ${id} AND id_usuario = ${id_usuario}
    `;
    if (!assinatura) {
      return res.status(404).json({ erro: 'Assinatura não encontrada.' });
    }
    if (assinatura.status === 'cancelada') {
      return res.status(400).json({ erro: 'Assinatura já cancelada.' });
    }

    if (assinatura.asaas_subscription_id) {
      await asaas.cancelarAssinatura(assinatura.asaas_subscription_id);
    }

    await sql`
      UPDATE assinaturas
      SET status = 'cancelada', atualizada_em = NOW()
      WHERE id = ${id}
    `;

    res.json({ mensagem: 'Assinatura cancelada com sucesso.' });
  } catch (err) {
    console.error('ERRO cancelarAssinatura:', err);
    res.status(500).json({ erro: err.message || 'Não foi possível cancelar a assinatura.' });
  }
};

// POST /api/webhooks/asaas — recebe eventos do Asaas (sem JWT; valida token do webhook)
// Quando o pagamento confirma e a assinatura ainda não tem mercado, cria o
// mercado a partir de dados_mercado (o cadastro só acontece após o pagamento).
const webhookAsaas = async (req, res) => {
  const tokenWebhook = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenRecebido = req.headers['webhook-security-token'];

  if (tokenWebhook) {
    if (tokenRecebido !== tokenWebhook) {
      return res.status(401).json({ erro: 'Token de webhook inválido.' });
    }
  } else if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    console.error('ASAAS_WEBHOOK_TOKEN não configurado em produção.');
    return res.status(500).json({ erro: 'Webhook não configurado.' });
  }

  const evento = req.body?.event;
  const pagamento = req.body?.payment;

  if (!evento || !pagamento?.id) {
    return res.status(400).json({ erro: 'Payload de webhook inválido.' });
  }

  try {
    const sql = await conectar();

    // Localiza assinatura pelo id da assinatura no Asaas
    const subscriptionId = pagamento.subscription;
    const [assinatura] = subscriptionId
      ? await sql`SELECT * FROM assinaturas WHERE asaas_subscription_id = ${subscriptionId} LIMIT 1`
      : [];

    if (!assinatura) {
      // Evento sem assinatura correspondente — acknowledge para o Asaas não reenviar
      return res.status(200).json({ ignorado: true });
    }

    // Upsert do pagamento
    const statusPagamento = pagamento.status || 'PENDING';
    const metodo = pagamento.billingType || '';
    const vencimento = pagamento.dueDate || null;
    const pagoEm = pagamento.paymentDate || null;
    const valor = pagamento.value != null ? Number(pagamento.value).toFixed(2) : null;

    const existente = await sql`
      SELECT id FROM pagamentos WHERE asaas_payment_id = ${pagamento.id} LIMIT 1
    `;

    if (existente.length) {
      await sql`
        UPDATE pagamentos
        SET status = ${statusPagamento},
            metodo = ${metodo},
            vencimento = COALESCE(${vencimento}, vencimento),
            pago_em = CASE WHEN ${statusPagamento} IN ('CONFIRMED', 'RECEIVED') THEN COALESCE(${pagoEm}, NOW()) ELSE pago_em END
        WHERE asaas_payment_id = ${pagamento.id}
      `;
    } else {
      await sql`
        INSERT INTO pagamentos (id_assinatura, asaas_payment_id, valor, status, metodo, vencimento, pago_em)
        VALUES (
          ${assinatura.id}, ${pagamento.id}, ${valor}, ${statusPagamento}, ${metodo}, ${vencimento},
          ${statusPagamento === 'CONFIRMED' || statusPagamento === 'RECEIVED' ? (pagoEm || new Date().toISOString().slice(0, 10)) : null}
        )
      `;
    }

    // Atualiza status da assinatura conforme o evento
    if (evento === 'PAYMENT_CONFIRMED' || evento === 'PAYMENT_RECEIVED') {
      const proximo = pagamento.nextPaymentDate || pagamento.dueDate || null;
      await sql`
        UPDATE assinaturas
        SET status = 'ativa',
            proximo_pagamento = COALESCE(${proximo}, proximo_pagamento),
            atualizada_em = NOW()
        WHERE id = ${assinatura.id}
      `;
      // Pagamento confirmado e mercado ainda não existe → cria agora
      if (!assinatura.id_mercado && assinatura.dados_mercado) {
        await criarMercadoDaAssinatura(sql, assinatura);
      }
    } else if (evento === 'PAYMENT_OVERDUE') {
      await sql`
        UPDATE assinaturas
        SET status = 'inadimplente', atualizada_em = NOW()
        WHERE id = ${assinatura.id} AND status != 'cancelada'
      `;
    } else if (evento === 'SUBSCRIPTION_DELETED') {
      await sql`
        UPDATE assinaturas
        SET status = 'cancelada', atualizada_em = NOW()
        WHERE id = ${assinatura.id}
      `;
    }

    res.status(200).json({ recebido: true });
  } catch (err) {
    console.error('ERRO webhookAsaas:', err);
    // 500 faz o Asaas reenviar o evento (retry) — se o mercado falhou,
    // o retry tenta criar de novo
    res.status(500).json({ erro: 'Erro ao processar webhook.' });
  }
};

module.exports = { criarCheckout, minhaAssinatura, cancelarAssinatura, webhookAsaas };
