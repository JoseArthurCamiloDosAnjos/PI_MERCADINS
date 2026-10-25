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
const { processarPagamentoPedido } = require('./pedidoController');

// Dados exibidos na tela "Assinaturas": nome comercial + preço do ciclo.
// 'personalizado' não existe no catálogo do Asaas → cai nos limites do plano.
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

// ─────────────────────────────────────────────
// Grava (ou atualiza) a fatura da assinatura em pagamentos — idempotente,
// porque webhook e fallback podem chegar com a mesma cobrança.
// ─────────────────────────────────────────────
async function registrarFatura(sql, assinatura, pagamento) {
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
}

// ─────────────────────────────────────────────
// Pagamento confirmado → assinatura ativa, vigência nova, mercado criado
// e mercados suspensos reativados. Usado pelo webhook E pelo fallback.
// ─────────────────────────────────────────────
async function confirmarAssinatura(sql, assinatura, pagamento) {
  // Fim da vigência do período pago: se o Asaas não informar a próxima
  // cobrança, calcula +1 mês / +1 ano. Usar o vencimento que acabou de
  // ser pago deixaria a data no passado e suspenderia a loja na hora.
  const base = pagamento.paymentDate || pagamento.dueDate || null;
  const proximo = pagamento.nextPaymentDate || proximaVigencia(assinatura.ciclo, base);

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

  // Regularizou a cobrança → mercados suspensos voltam para o ar
  // (somente os suspensos por assinatura; bloqueio do admin permanece)
  const reativados = await reativarMercados(sql, assinatura);
  if (reativados > 0) {
    console.log(`Assinatura ${assinatura.id}: ${reativados} mercado(s) reativado(s)`);
  }
}

// ─────────────────────────────────────────────
// FALLBACK — o webhook do Asaas não alcança localhost (dev) e às vezes
// atrasa em produção. Consulta a API na hora e aplica o mesmo caminho do
// webhook: fatura gravada + assinatura ativa + mercado criado.
// Retorna { confirmado, pagamento } para a tela mostrar o estado real.
// ─────────────────────────────────────────────
async function sincronizarComAsaas(sql, assinatura) {
  if (!assinatura.asaas_subscription_id) return { confirmado: false, pagamento: null };
  if (assinatura.status === 'ativa') return { confirmado: true, pagamento: null };
  if (!['pendente', 'inadimplente'].includes(assinatura.status)) {
    return { confirmado: false, pagamento: null };
  }

  const cobrancas = await asaas.buscarPagamentosAssinatura(assinatura.asaas_subscription_id);

  const confirmada = cobrancas.find(
    (p) => p.status === 'CONFIRMED' || p.status === 'RECEIVED'
  );
  if (confirmada) {
    await registrarFatura(sql, assinatura, confirmada);
    await confirmarAssinatura(sql, assinatura, confirmada);
    console.log(`Assinatura ${assinatura.id}: confirmada via consulta direta ao Asaas (${confirmada.id})`);
    return { confirmado: true, pagamento: confirmada };
  }

  // Ainda não pagou → registra a cobrança pendente (a tela mostra o status)
  const pendente = cobrancas.find((p) => p.status === 'PENDING') || cobrancas[0] || null;
  if (pendente) await registrarFatura(sql, assinatura, pendente);
  return { confirmado: false, pagamento: pendente };
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

    // Varredura preguiçosa: garante que a tela já mostre a suspensão mesmo
    // se o job agendado ainda não tiver rodado (ex.: servidor reiniciado)
    await encerrarVencidas(sql);

    // TODAS as assinaturas do usuário (cada loja pode ter um plano diferente).
    // lista[0] é a mais recente — a "principal" que o checkout e a tela de
    // aguardando-pagamento já conhecem.
    let lista = await sql`
      SELECT * FROM assinaturas
      WHERE id_usuario = ${id_usuario}
      ORDER BY id DESC
    `;
    if (lista.length === 0) {
      return res.json({ assinatura: null, assinaturas: [], pagamentos: [] });
    }

    // FALLBACK: o webhook do Asaas não chega em desenvolvimento (localhost)
    // e às vezes atrasa. Consulta a API na hora para CADA assinatura que
    // depende do Asaas — é o que o botão "Já paguei — atualizar status"
    // do frontend espera que aconteça.
    let pagamentoAsaas = null;
    let confirmouAlguma = false;
    for (const item of lista) {
      if (!['pendente', 'inadimplente'].includes(item.status)) continue;
      try {
        const sincronia = await sincronizarComAsaas(sql, item);
        if (item.id === lista[0].id) pagamentoAsaas = sincronia.pagamento || null;
        if (sincronia.confirmado) confirmouAlguma = true;
      } catch (eSync) {
        // Sem conexão com o Asaas não derruba a tela: só loga
        console.error(`ERRO minhaAssinatura (sincronizar Asaas #${item.id}):`, eSync.message);
      }
    }
    if (confirmouAlguma) {
      // Alguma assinatura mudou de estado → relê tudo para a tela refletir o banco
      lista = await sql`
        SELECT * FROM assinaturas
        WHERE id_usuario = ${id_usuario}
        ORDER BY id DESC
      `;
    }
    const assinatura = lista[0];

    // Prazo de validade do plano (fim do período pago) + dias restantes
    const vigencia = resumoVigencia(assinatura);

    // Se assinatura ativa e mercado ainda não existe → cria agora (retry do
    // webhook e do fallback). Roda ANTES de ler mercado_status para a tela
    // já mostrar a loja recém-criada.
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
        // Não bloqueia a resposta; o webhook / novo acesso tenta de novo
      }
    }

    // Situação da loja vinculada (suspenso por cobrança aparece aqui)
    let mercado_status = null;
    if (assinatura.id_mercado) {
      const [mercadoDaAssinatura] = await sql`
        SELECT id_mercado, nome, status, suspenso_em
        FROM mercados WHERE id_mercado = ${assinatura.id_mercado}
      `;
      mercado_status = mercadoDaAssinatura || null;
    }

    // Link de pagamento de cada assinatura pendente (botão "Ir para o pagamento")
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
      // Falha ao listar faturas não pode derrubar a tela: o link de
      // pagamento (urlPagamento) e o status da assinatura continuam válidos
      console.error('ERRO minhaAssinatura (listar pagamentos):', ePag);
    }

    // Mercados vinculados (uma consulta por loja: são poucas por usuário)
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

    // Aba "Assinaturas": 1 cartão por assinatura, com a loja que ela cobre
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
      // Última cobrança vista no Asaas (PENDING = ainda liquidando)
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

    // ── B3: pagamento de PEDIDO (Pix/cartão da compra de produtos) ──────────
    // Cobranças de pedido vêm com externalReference "pedido:<id>"; as de
    // assinatura têm subscription. Este ramo roda antes e não mexe nelas.
    const refExterna = pagamento.externalReference || '';
    if (String(refExterna).startsWith('pedido:')) {
      const resultado = await processarPagamentoPedido(sql, evento, pagamento);
      return res.status(200).json(resultado);
    }

    // Localiza assinatura pelo id da assinatura no Asaas
    const subscriptionId = pagamento.subscription;
    const [assinatura] = subscriptionId
      ? await sql`SELECT * FROM assinaturas WHERE asaas_subscription_id = ${subscriptionId} LIMIT 1`
      : [];

    if (!assinatura) {
      // Evento sem assinatura correspondente — acknowledge para o Asaas não reenviar
      return res.status(200).json({ ignorado: true });
    }

    // Fatura da assinatura (idempotente — o fallback pode já tê-la gravado)
    await registrarFatura(sql, assinatura, pagamento);

    // Atualiza status da assinatura conforme o evento
    if (evento === 'PAYMENT_CONFIRMED' || evento === 'PAYMENT_RECEIVED') {
      await confirmarAssinatura(sql, assinatura, pagamento);
    } else if (evento === 'PAYMENT_OVERDUE') {
      // Vencida: entra em inadimplência agora; a suspensão dos mercados só
      // acontece após a carência (vigenciaService.encerrarVencidas)
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
