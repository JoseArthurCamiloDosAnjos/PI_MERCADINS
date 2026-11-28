//  Regras de limite de quantidade por produto (carrinho e pedido)
//  Mantidas em um só lugar para o backend inteiro falar a mesma língua que o
//  Frontend/src/hooks/useCarrinho.ts.

/** Máximo de unidades de um único produto em um pedido. */
const MAX_UNIDADES_PRODUTO = 99;

/**
 * Limite de unidades aceitas para um produto no carrinho/pedido: o menor valor
 * entre o estoque disponível e o teto por produto. Estoque zerado/nulo = 0.
 */
function limiteUnidadesProduto(estoque) {
  const disponivel = Math.max(0, Number(estoque) || 0);
  return Math.min(disponivel, MAX_UNIDADES_PRODUTO);
}

module.exports = { MAX_UNIDADES_PRODUTO, limiteUnidadesProduto };
