const { conectar } = require('../db/neon');
const asaas = require('../services/asaasService');
const {
  CARENCIA_DIAS,
  proximaVigencia,
  encerrarVencidas,
  reativarMercados,
  resumoVigencia,
} = require('../services/vigenciaService');
const { LIMITES_PLANOS } = require('../utils/planos');
const { validarDadosMercado, criarMercadoCompleto } = require('./marketController');
const { MENSAGEM_ACEITE_OBRIGATORIO } = require('../utils/termos');
const { processarPagamentoPedido } = require('./pedidoController');

function infoPlano(assinatura) {
  const plano = asaas.obterPlano(assinatura.codigo_plano, assinatura.ciclo);
  if (plano) return plano;
  return {
    codigo: assinatura.codigo_plano,
    nome: LIMITES_PLANOS[assinatura.codigo_plano]?.nome || assinatura.codigo_plano,
    ciclo: assinatura.ciclo,
    valor: Number(assinatura.valor || 0),
  };
}

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
  validacao.dados.plano = assinatura.codigo_plano;

  const mercado = await criarMercadoCompleto(sql, assinatura.id_usuario, validacao.dados);

  await sql`
    UPDATE assinaturas
    SET id_mercado = ${mercado.id_mercado}, atualizada_em = NOW()
    WHERE id = ${assinatura.id}
  `;

  return mercado;
}

async function registrarFatura(sql, assinatura, pagamento) {
  const statusPagamento = pagamento.status || 'PENDING';
  const metodo = pagamento.billingType || '';
  const vencimento = pagamento.dueDate || null;
  const pagoEm = pagamento.paymentDate || null;
  const valor = pagamento.value != null ? Number(pagamento.value).toFixed(2) : null;
  const ehPago = asaas.pagamentoPago(statusPagamento);

  const existente = await sql`
    SELECT id FROM pagamentos WHERE asaas_payment_id = ${pagamento.id} LIMIT 1
  `;

  if (existente.length) {
    await sql`
      UPDATE pagamentos
      SET status = ${statusPagamento},
          metodo = ${metodo},
          vencimento = COALESCE(${vencimento}, vencimento),
          pago_em = CASE WHEN ${ehPago} THEN COALESCE(${pagoEm}, NOW()) ELSE pago_em END
      WHERE asaas_payment_id = ${pagamento.id}
    `;
  } else {
    await sql`
      INSERT INTO pagamentos (id_assinatura, asaas_payment_id, valor, status, metodo, vencimento, pago_em)
      VALUES (
        ${assinatura.id}, ${pagamento.id}, ${valor}, ${statusPagamento}, ${metodo}, ${vencimento},
        ${ehPago ? (pagoEm || new Date().toISOString().slice(0, 10)) : null}
      )
    `;
  }
}

async function confirmarAssinatura(sql, assinatura, pagamento) {
  const base = pagamento.paymentDate || pagamento.dueDate || null;
  const proximo = pagamento.nextPaymentDate || proximaVigencia(assinatura.ciclo, base);

  await sql`
    UPDATE assinaturas
    SET status = 'ativa',
        proximo_pagamento = COALESCE(${proximo}, proximo_pagamento),
        atualizada_em = NOW()
    WHERE id = ${assinatura.id}
  `;

  if (!assinatura.id_mercado && assinatura.dados_mercado) {
    await criarMercadoDaAssinatura(sql, assinatura);
  }

  await reativarMercados(sql, assinatura);
}

async function sincronizarComAsaas(sql, assinatura) {
  if (!assinatura.asaas_subscription_id) return { confirmado: false, pagamento: null };
  if (assinatura.status === 'ativa') return { confirmado: true, pagamento: null };
  if (!['pendente', 'inadimplente'].includes(assinatura.status)) {
    return { confirmado: false, pagamento: null };
  }

  const cobrancas = await asaas.buscarPagamentosAssinatura(assinatura.asaas_subscription_id);

  const confirmada = cobrancas.find((p) => asaas.pagamentoPago(p.status));
  if (confirmada) {
    await registrarFatura(sql, assinatura, confirmada);
    await confirmarAssinatura(sql, assinatura, confirmada);
    return { confirmado: true, pagamento: confirmada };
  }

  const pendente = cobrancas.find((p) => p.status === 'PENDING') || cobrancas[0] || null;
  if (pendente) await registrarFatura(sql, assinatura, pendente);
  return { confirmado: false, pagamento: pendente };
}

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

    if (mercado.aceite_termos !== true) {
      return res.status(400).json({ erro: MENSAGEM_ACEITE_OBRIGATORIO });
    }

    const validacao = validarDadosMercado({
      ...mercado,
      plano: codigo_plano,
      termos_ip: req.ip,
    });
    if (validacao.erro) {
      return res.status(400).json({ erro: validacao.erro });
    }

    const [assinaturaExistente] = await sql`
      SELECT * FROM assinaturas
      WHERE id_usuario = ${id_usuario}
        AND status IN ('pendente', 'ativa', 'inadimplente')
      ORDER BY id DESC
      LIMIT 1
    `;
    if (assinaturaExistente) {
      let jaTemLoja = false;
      if (assinaturaExistente.id_mercado) {
        const [mercadoJaExiste] = await sql`
          SELECT * FROM mercados WHERE id_mercado = ${assinaturaExistente.id_mercado}
        `;
        jaTemLoja = !!mercadoJaExiste;
      }

      if (!jaTemLoja) {
        if (assinaturaExistente.status !== 'pendente') {
          try {
            const mercadoRecuperado = await criarMercadoDaAssinatura(sql, assinaturaExistente);
            if (mercadoRecuperado) {
              return res.json({
                mensagem: 'Pagamento já confirmado: sua loja foi criada.',
                status: 'ativa',
                mercado: mercadoRecuperado,
              });
            }
          } catch (eRec) {
            console.error(`ERRO criarCheckout (recuperar loja da assinatura ${assinaturaExistente.id}):`, eRec.message);
          }
          return res.status(409).json({
            erro: 'Seu pagamento já foi confirmado, mas a loja ainda não pôde ser criada. Abra a tela de Assinaturas e tente novamente.',
            status: assinaturaExistente.status,
          });
        }

        let mesmoFormulario = false;
        if (assinaturaExistente.asaas_subscription_id) {
          const [igual] = await sql`
            SELECT 1 FROM assinaturas
            WHERE id = ${assinaturaExistente.id}
              AND codigo_plano = ${plano.codigo}
              AND ciclo = ${cicloDb}
              AND dados_mercado = ${JSON.stringify(validacao.dados)}::jsonb
          `;
          mesmoFormulario = !!igual;
        }

        if (mesmoFormulario) {
          let urlCheckout = null;
          try {
            urlCheckout = await asaas.buscarUrlPagamento(assinaturaExistente.asaas_subscription_id);
          } catch { /* falha ignorada */ }

          if (urlCheckout) {
            return res.json({
              mensagem: 'Você já possui uma assinatura pendente. Retome o pagamento.',
              status: assinaturaExistente.status,
              idAssinatura: assinaturaExistente.id,
              urlCheckout,
            });
          }
        }

        if (assinaturaExistente.asaas_subscription_id) {
          try {
            await asaas.cancelarAssinatura(assinaturaExistente.asaas_subscription_id);
          } catch { /* falha ignorada */ }
        }
        await sql`
          UPDATE assinaturas
          SET status = 'cancelada', atualizada_em = NOW()
          WHERE id = ${assinaturaExistente.id}
        `;
      }
    }

    const [usuario] = await sql`
      SELECT nome, email, cpf, telefone FROM usuarios WHERE id_usuario = ${id_usuario}
    `;
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    const customer = await asaas.criarCustomer({
      nome: usuario.nome,
      email: usuario.email,
      cpfCnpj: usuario.cpf || undefined,
      mobilePhone: usuario.telefone || undefined,
    });
    const customerId = customer.id;

    const assinaturaAsaas = await asaas.criarAssinatura({
      customerId,
      valor: plano.valor,
      ciclo: cicloDb,
      descricao: `Plano ${plano.nome} Mercadins — ${cicloDb === 'ANUAL' ? 'anual' : 'mensal'}`,
    });

    const urlCheckout = await asaas.buscarUrlPagamento(assinaturaAsaas.id);

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

const minhaAssinatura = async (req, res) => {
  const id_usuario = req.usuarioId;
  try {
    const sql = await conectar();

    await encerrarVencidas(sql);

    let lista = await sql`
      SELECT * FROM assinaturas
      WHERE id_usuario = ${id_usuario}
      ORDER BY id DESC
    `;
    if (lista.length === 0) {
      return res.json({ assinatura: null, assinaturas: [], pagamentos: [] });
    }

    let pagamentoAsaas = null;
    let confirmouAlguma = false;
    for (const item of lista) {
      if (!['pendente', 'inadimplente'].includes(item.status)) continue;
      try {
        const sincronia = await sincronizarComAsaas(sql, item);
        if (item.id === lista[0].id) pagamentoAsaas = sincronia.pagamento || null;
        if (sincronia.confirmado) confirmouAlguma = true;
      } catch (eSync) {
        console.error(`ERRO minhaAssinatura (sincronizar Asaas #${item.id}):`, eSync.message);
      }
    }
    if (confirmouAlguma) {
      lista = await sql`
        SELECT * FROM assinaturas
        WHERE id_usuario = ${id_usuario}
        ORDER BY id DESC
      `;
    }
    const assinatura = lista[0];

    const vigencia = resumoVigencia(assinatura);

    let mercadoRecuperado = null;
    for (const item of lista) {
      if (item.status !== 'ativa' || item.id_mercado || !item.dados_mercado) continue;
      try {
        const criado = await criarMercadoDaAssinatura(sql, item);
        if (criado) {
          item.id_mercado = criado.id_mercado;
          if (item.id === assinatura.id) mercadoRecuperado = criado;
        }
      } catch (eRec) {
        console.error(`ERRO minhaAssinatura (recuperar mercado #${item.id}):`, eRec);
      }
    }

    let mercado_status = null;
    if (assinatura.id_mercado) {
      const [mercadoDaAssinatura] = await sql`
        SELECT id_mercado, nome, status, suspenso_em
        FROM mercados WHERE id_mercado = ${assinatura.id_mercado}
      `;
      mercado_status = mercadoDaAssinatura || null;
    }

    for (const item of lista) {
      item.url_pagamento = null;
      if (item.status === 'pendente' && item.asaas_subscription_id) {
        try {
          item.url_pagamento = await asaas.buscarUrlPagamento(item.asaas_subscription_id);
        } catch (eUrl) {
          console.error(`ERRO minhaAssinatura (buscar URL #${item.id}):`, eUrl);
        }
      }
    }
    const urlPagamento = assinatura.url_pagamento || null;

    let pagamentos = [];
    try {
      pagamentos = await sql`
        SELECT id, asaas_payment_id, valor, status, metodo, vencimento, pago_em, criado_em
        FROM pagamentos
        WHERE id_assinatura = ${assinatura.id}
        ORDER BY id DESC
        LIMIT 12
      `;
    } catch (ePag) {
      console.error('ERRO minhaAssinatura (listar pagamentos):', ePag);
    }

    const mercadosPorId = new Map();
    for (const idMerc of new Set(lista.map((a) => a.id_mercado).filter(Boolean))) {
      try {
        const [merc] = await sql`
          SELECT id_mercado, nome, status, suspenso_em
          FROM mercados WHERE id_mercado = ${idMerc}
        `;
        if (merc) mercadosPorId.set(idMerc, merc);
      } catch (eMerc) {
        console.error('ERRO minhaAssinatura (buscar mercado vinculado):', eMerc);
      }
    }

    const assinaturas = lista.map((item) => {
      const vig = resumoVigencia(item);
      return {
        id: item.id,
        status: item.status,
        codigo_plano: item.codigo_plano,
        ciclo: item.ciclo,
        valor: item.valor,
        plano: infoPlano(item),
        proximo_pagamento: item.proximo_pagamento,
        validade_ate: vig.validade_ate,
        dias_restantes: vig.dias_restantes,
        mercado: item.id_mercado ? mercadosPorId.get(item.id_mercado) || null : null,
        url_pagamento: item.url_pagamento || null,
        criada_em: item.criada_em,
      };
    });

    res.json({
      assinatura,
      assinaturas,
      plano: infoPlano(assinatura),
      validade_ate: vigencia.validade_ate,
      dias_restantes: vigencia.dias_restantes,
      carencia_dias: CARENCIA_DIAS,
      mercado_status,
      pagamento_asaas: pagamentoAsaas
        ? {
            id: pagamentoAsaas.id,
            status: pagamentoAsaas.status,
            vencimento: pagamentoAsaas.dueDate || null,
            valor: pagamentoAsaas.value ?? null,
          }
        : null,
      pagamentos,
      urlPagamento,
      mercado: mercadoRecuperado || undefined,
    });
  } catch (err) {
    console.error('ERRO minhaAssinatura:', err);
    res.status(500).json({ erro: 'Não foi possível carregar a assinatura.' });
  }
};

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

const webhookAsaas = async (req, res) => {
  // ── 1. Autenticação ────────────────────────────────────────────────────────
  const tokensAceitos = String(process.env.ASAAS_WEBHOOK_TOKEN || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const tokenRecebido = String(
    req.headers['asaas-access-token'] || req.headers['webhook-security-token'] || ''
  ).trim();

  if (tokensAceitos.length === 0) {
    console.warn('webhookAsaas: ASAAS_WEBHOOK_TOKEN ausente — rejeitando eventos (fail-closed).');
    return res.status(401).json({ erro: 'Webhook não configurado (ASAAS_WEBHOOK_TOKEN ausente).' });
  }
  if (!tokenRecebido || !tokensAceitos.includes(tokenRecebido)) {
    return res.status(401).json({ erro: 'Token de webhook inválido.' });
  }

  const evento = req.body?.event;
  const eventId = req.body?.id;
  const pagamento = req.body?.payment;
  const subscriptionNoPayload = req.body?.subscription?.id || null;

  if (!evento || !eventId || (!pagamento?.id && !subscriptionNoPayload)) {
    return res.status(400).json({ erro: 'Payload de webhook inválido (event/id/payment ausentes).' });
  }

  if (pagamento && req.body.additionalInfo && typeof req.body.additionalInfo === 'object') {
    pagamento.additionalInfo = req.body.additionalInfo;
  }

  const sql = await conectar();

  // ── 2. Idempotência por ID do EVENTO (gate de 1ª camada) ───────────────────
  let eventoPersistido = false;
  try {
    const linhas = await sql`
      INSERT INTO asaas_eventos (asaas_event_id, evento, payload, status)
      VALUES (${eventId}, ${evento}, ${JSON.stringify(req.body)}::jsonb, 'PENDING')
      ON CONFLICT (asaas_event_id) DO NOTHING
      RETURNING id
    `;
    eventoPersistido = linhas.length > 0;
  } catch (erroTabela) {
    console.error(
      'webhookAsaas: tabela asaas_eventos indisponível — processando sem gate de evento (' +
      `${erroTabela.message}). Aplicar migração 023.`
    );
    eventoPersistido = true;
  }

  if (!eventoPersistido) {
    const [existente] = await sql`
      SELECT status FROM asaas_eventos WHERE asaas_event_id = ${eventId} LIMIT 1
    `;
    if (existente?.status === 'DONE') {
      return res.status(200).json({ recebido: true, duplicado: true });
    }
    return res.status(200).json({ recebido: true, duplicado: true });
  }

  try {
    let statusApi = null;
    if (pagamento?.id) {
      const fonte = await asaas.buscarPagamento(pagamento.id);
      if (!fonte) {
        throw Object.assign(new Error('Pagamento não encontrado na API do Asaas.'), { status: 404 });
      }
      statusApi = fonte.status;
      Object.assign(pagamento, fonte);
    }

    // ── B3: pagamento de PEDIDO (cartão da compra de produtos) ───────────────
    const refExterna = pagamento?.externalReference || '';
    if (String(refExterna).startsWith('pedido:')) {
      const resultado = await processarPagamentoPedido(sql, evento, pagamento);
      await marcarEventoComoDone(sql, eventId);
      return res.status(200).json(resultado);
    }

    const subscriptionId = pagamento?.subscription || subscriptionNoPayload;
    const [assinatura] = subscriptionId
      ? await sql`SELECT * FROM assinaturas WHERE asaas_subscription_id = ${subscriptionId} LIMIT 1`
      : [];

    if (!assinatura) {
      await marcarEventoComoDone(sql, eventId);
      return res.status(200).json({ ignorado: true });
    }

    if (pagamento?.id) {
      await registrarFatura(sql, assinatura, pagamento);
    }

    // ── Máquina de estados (helper em asaasService) ─────────────────────────
    if (pagamento?.id && statusApi) {
      const classe = asaas.classificarStatusAsaas(statusApi);
      if (classe === 'pago_aprovado' || classe === 'pago_liquidado') {
        await confirmarAssinatura(sql, assinatura, pagamento);
      } else if (classe === 'vencido') {
        await sql`
          UPDATE assinaturas
          SET status = 'inadimplente', atualizada_em = NOW()
          WHERE id = ${assinatura.id} AND status != 'cancelada'
        `;
      } else if (classe === 'estorno_concluido') {
        console.error(
          `CRÍTICO — Assinatura ${assinatura.id}: pagamento ${pagamento.id} ESTORNADO/CHARGEBACK (${statusApi}). ` +
          'Reavaliar status da assinatura manualmente.'
        );
      } else if (classe === 'estorno_solicitado') {
        console.warn(
          `Assinatura ${assinatura.id}: estorno SOLICITADO (${statusApi}) — aguardando REFUNDED.`
        );
      }
    } else if (evento === 'SUBSCRIPTION_DELETED') {
      await sql`
        UPDATE assinaturas
        SET status = 'cancelada', atualizada_em = NOW()
        WHERE id = ${assinatura.id}
      `;
    }

    await marcarEventoComoDone(sql, eventId);
    res.status(200).json({ recebido: true });
  } catch (err) {
    try {
      await sql`DELETE FROM asaas_eventos WHERE asaas_event_id = ${eventId} AND status = 'PENDING'`;
    } catch (erroLimpeza) {
      console.error('webhookAsaas: falha ao liberar evento para retry:', erroLimpeza.message);
    }
    const statusErro = Number(err?.status);
    if (statusErro === 404) {
      return res.status(404).json({ erro: err.message });
    }
    console.error('ERRO webhookAsaas:', err);
    res.status(500).json({ erro: 'Erro ao processar webhook.' });
  }
};

async function marcarEventoComoDone(sql, eventId) {
  try {
    await sql`
      UPDATE asaas_eventos
      SET status = 'DONE', atualizado_em = NOW()
      WHERE asaas_event_id = ${eventId}
    `;
  } catch (erro) {
    console.error(`webhookAsaas: falha ao marcar evento ${eventId} como DONE:`, erro.message);
  }
}

module.exports = { criarCheckout, minhaAssinatura, cancelarAssinatura, webhookAsaas };