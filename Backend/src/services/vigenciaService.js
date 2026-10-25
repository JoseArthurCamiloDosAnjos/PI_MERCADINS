// ─────────────────────────────────────────────────────────────────────────────
//  Vigência das assinaturas (planos)
//
//  • proximaVigencia   — calcula o fim do período pago (mensal +1 mês,
//                        anual +1 ano) no servidor, nunca pelo cliente.
//  • encerrarVencidas  — assinaturas cuja vigência passou da carência viram
//                        'inadimplente' e seus mercados ficam 'suspenso'
//                        (saiem de busca/vitrine/sitemap, que filtram 'ativo').
//  • reativarMercados  — pagamento confirmado devolve 'suspenso' → 'ativo'.
//
//  Escopo dos mercados suspensos/reativados:
//    • plano personalizado → todos os mercados onde o usuário é dono;
//    • demais planos       → apenas assinaturas.id_mercado.
//
//  Loja 'bloqueada' (bloqueio manual do admin) nunca é tocada aqui.
// ─────────────────────────────────────────────────────────────────────────────

// Dias que o cliente tem após o vencimento para regularizar antes da suspensão
const CARENCIA_DIAS = 3;

function dataUtc(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Soma meses sem estourar o dia (31/01 + 1 mês → 28/02 em ano bissexto)
function somarMeses(data, meses) {
  const dia = data.getUTCDate();
  const alvo = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo;
}

// Fim da vigência do próximo ciclo, a partir da data base recebida.
// Sem data base → usa hoje. Retorna 'YYYY-MM-DD' ou null.
function proximaVigencia(ciclo, dataBase) {
  const base = dataUtc(dataBase) || new Date();
  const alvo = ciclo === 'ANUAL' ? somarMeses(base, 12) : somarMeses(base, 1);
  return alvo.toISOString().slice(0, 10);
}

// Data-limite de corte: vencimento há mais de CARENCIA_DIAS dias
function corteVencimento() {
  const corte = new Date(Date.now() - CARENCIA_DIAS * 24 * 60 * 60 * 1000);
  return corte.toISOString().slice(0, 10);
}

// Quais mercados esta assinatura cobre (ver cabeçalho do arquivo)
async function escopoMercados(sql, assinatura) {
  if (assinatura.codigo_plano === 'personalizado') {
    return sql`
      SELECT m.id_mercado
      FROM mercados m
      JOIN usuarios_mercados um ON um.id_mercado = m.id_mercado AND um.papel = 'dono'
      WHERE um.id_usuario = ${assinatura.id_usuario}
    `;
  }
  return assinatura.id_mercado ? [{ id_mercado: assinatura.id_mercado }] : [];
}

// Tira as lojas do ar (status 'suspenso'); não mexe em 'bloqueado'
async function suspenderMercados(sql, assinatura) {
  const alvos = await escopoMercados(sql, assinatura);
  const ids = alvos.map((m) => m.id_mercado);
  if (ids.length === 0) return 0;

  const suspensos = await sql`
    UPDATE mercados
    SET status = 'suspenso', suspenso_em = NOW()
    WHERE id_mercado = ANY(${ids}::int[])
      AND status <> 'suspenso'
      AND status <> 'bloqueado'
    RETURNING id_mercado
  `;
  return suspensos.length;
}

// Devolve as lojas suspensas por cobrança para o ar
async function reativarMercados(sql, assinatura) {
  const alvos = await escopoMercados(sql, assinatura);
  const ids = alvos.map((m) => m.id_mercado);
  if (ids.length === 0) return 0;

  const reativados = await sql`
    UPDATE mercados
    SET status = 'ativo', suspenso_em = NULL
    WHERE id_mercado = ANY(${ids}::int[]) AND status = 'suspenso'
    RETURNING id_mercado
  `;
  return reativados.length;
}

// Varredura principal: vigência vencida + carência → inadimplente e suspensão
async function encerrarVencidas(sql) {
  const vencidas = await sql`
    SELECT id, id_usuario, id_mercado, codigo_plano, status, proximo_pagamento
    FROM assinaturas
    WHERE status IN ('ativa', 'inadimplente', 'cancelada')
      AND proximo_pagamento IS NOT NULL
      AND proximo_pagamento < ${corteVencimento()}
    ORDER BY id
  `;

  const resultado = [];
  for (const assinatura of vencidas) {
    // Quem estava ativo e não pagou a renovação entra em inadimplência
    if (assinatura.status === 'ativa') {
      await sql`
        UPDATE assinaturas
        SET status = 'inadimplente', atualizada_em = NOW()
        WHERE id = ${assinatura.id}
      `;
      assinatura.status = 'inadimplente';
    }
    assinatura.mercados_suspensos = await suspenderMercados(sql, assinatura);
    resultado.push(assinatura);
  }
  return resultado;
}

// Resumo exibido na tela "Assinaturas" (fim da vigência + dias restantes)
function resumoVigencia(assinatura) {
  const fim = dataUtc(assinatura?.proximo_pagamento);
  if (!fim) return { validade_ate: null, dias_restantes: null };

  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const alvo = new Date(fim.getTime());
  alvo.setUTCHours(0, 0, 0, 0);
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));

  return {
    validade_ate: alvo.toISOString().slice(0, 10),
    dias_restantes: dias,
  };
}

module.exports = {
  CARENCIA_DIAS,
  proximaVigencia,
  encerrarVencidas,
  suspenderMercados,
  reativarMercados,
  resumoVigencia,
};
