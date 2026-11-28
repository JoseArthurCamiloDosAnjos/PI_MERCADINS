// ─── Etapas e rótulos do status de um pedido ─────────────────────────────────
// As etapas mudam conforme o tipo de recebimento:
//   · entrega:  pendente → preparo → pronto → caminho → entregue
//   · retirada: pendente → preparo → pronto → entregue
// E o texto de cada etapa também muda: num pedido de retirada nada fala de
// entrega ("Pronto para retirada"/"Retirado no balcão" no lugar de
// "A caminho"/"Entregue").

export type TipoEntrega = 'entrega' | 'retirada';

/**
 * Linha principal do pedido, na ordem em que ele avança. É a mesma lista que
 * serve para navegar (loja) e para a linha do tempo (cliente).
 */
export function passosPedido(tipoEntrega?: TipoEntrega): string[] {
  return tipoEntrega === 'retirada'
    ? ['pendente', 'preparo', 'pronto', 'entregue']
    : ['pendente', 'preparo', 'pronto', 'caminho', 'entregue'];
}

/** Status que fogem da linha principal — a loja marca, o cliente só acompanha. */
export function statusDeDesvio(tipoEntrega?: TipoEntrega): string[] {
  return tipoEntrega === 'retirada' ? [] : ['tentativa'];
}

/**
 * Leva um status para dentro da linha principal:
 *  · pedidos antigos de retirada ficaram gravados em 'caminho' (hoje esse
 *    papel é de 'pronto');
 *  · 'tentativa' de entrega acompanha a etapa em que ela acontece ('caminho').
 */
export function statusNaLinha(status: string, tipoEntrega?: TipoEntrega): string {
  if (tipoEntrega === 'retirada' && status === 'caminho') return 'pronto';
  if (status === 'tentativa') return 'caminho';
  return status;
}

/** Índice do status na linha principal (-1 quando está fora dela). */
export function indiceDoStatus(status: string, tipoEntrega?: TipoEntrega): number {
  return passosPedido(tipoEntrega).indexOf(statusNaLinha(status, tipoEntrega));
}

/** Próxima etapa do fluxo; `null` quando o pedido já terminou. */
export function proximoStatus(status: string, tipoEntrega?: TipoEntrega): string | null {
  const fluxo = passosPedido(tipoEntrega);
  const i = fluxo.indexOf(statusNaLinha(status, tipoEntrega));
  return i < 0 ? null : (fluxo[i + 1] ?? null);
}

/** Etapa anterior; `null` quando o pedido já está no começo do fluxo. */
export function statusAnterior(status: string, tipoEntrega?: TipoEntrega): string | null {
  const fluxo = passosPedido(tipoEntrega);
  // 'tentativa' acontece enquanto o pedido está 'caminho': voltar significa
  // devolver o pedido para a estrada (a retirada nunca chega aqui).
  if (status === 'tentativa') return fluxo.includes('caminho') ? 'caminho' : null;
  const i = fluxo.indexOf(statusNaLinha(status, tipoEntrega));
  return i < 0 ? null : (fluxo[i - 1] ?? null);
}

/**
 * Todo status que a loja pode escolher para este pedido (linha principal +
 * desvios), menos o que ele já está.
 */
export function opcoesDeStatus(status: string, tipoEntrega?: TipoEntrega): string[] {
  const atual = statusNaLinha(status, tipoEntrega);
  return [...passosPedido(tipoEntrega), ...statusDeDesvio(tipoEntrega)]
    .filter(s => s !== atual);
}

/** Textos na visão do cliente (Meus pedidos, histórico de compras). */
const NOMES_CLIENTE: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pendente: 'Recebido pela loja',
  preparo: 'Em preparo',
  pronto: 'Pedido pronto',
  caminho: 'A caminho',
  tentativa: 'Tentativa de entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

/** Textos na visão da loja (painel do vendedor). */
const NOMES_LOJA: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pendente: 'Novo',
  preparo: 'Em preparo',
  pronto: 'Pronto para sair',
  caminho: 'Saiu para entrega',
  tentativa: 'Tentativa de entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

/** O que passa a ser quando o cliente vai buscar no balcão. */
const NOMES_CLIENTE_RETIRADA: Record<string, string> = {
  ...NOMES_CLIENTE,
  pronto: 'Pronto para retirada',
  caminho: 'Pronto para retirada', // pedidos gravados antes de existir 'pronto'
  entregue: 'Retirado no balcão',
};

const NOMES_LOJA_RETIRADA: Record<string, string> = {
  ...NOMES_LOJA,
  pronto: 'Pronto para retirada',
  caminho: 'Pronto para retirada', // pedidos gravados antes de existir 'pronto'
  entregue: 'Retirado',
};

/** Rótulo do status para quem acompanha o pedido (cliente). */
export function nomeStatusCliente(status: string, tipoEntrega?: TipoEntrega): string {
  const mapa = tipoEntrega === 'retirada' ? NOMES_CLIENTE_RETIRADA : NOMES_CLIENTE;
  return mapa[status] ?? status;
}

/** Rótulo do status para a loja que gere o pedido. */
export function nomeStatusLoja(status: string, tipoEntrega?: TipoEntrega): string {
  const mapa = tipoEntrega === 'retirada' ? NOMES_LOJA_RETIRADA : NOMES_LOJA;
  return mapa[status] ?? status;
}
