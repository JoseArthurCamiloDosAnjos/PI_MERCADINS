//  Vigência das assinaturas (planos)

const CARENCIA_DIAS = 3;

function dataUtc(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function somarMeses(data, meses) {
  const dia = data.getUTCDate();
  const alvo = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo;
}

function proximaVigencia(ciclo, dataBase) {
  const base = dataUtc(dataBase) || new Date();
  const alvo = ciclo === 'ANUAL' ? somarMeses(base, 12) : somarMeses(base, 1);
  return alvo.toISOString().slice(0, 10);
}

function corteVencimento() {
  const corte = new Date(Date.now() - CARENCIA_DIAS * 24 * 60 * 60 * 1000);
  return corte.toISOString().slice(0, 10);
}

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
