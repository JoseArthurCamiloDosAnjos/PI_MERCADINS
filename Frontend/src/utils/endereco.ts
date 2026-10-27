// ─────────────────────────────────────────────────────────────────────────────
//  Endereço de entrega — informado pelo cliente no carrinho (item 1)
//
//  • Aparece só quando a compra será ENTREGUE (na retirada no balcão não faz
//    sentido);
//  • Fica guardado no navegador para o cliente não digitar toda vez;
//  • Vai para o banco como um texto único ("Rua X, nº 123 - Bairro - CEP ..."),
//    assim a loja vê o endereço na tela de pedidos e no e-mail.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnderecoEntrega {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
}

/** Campos obrigatórios para entregar (o complemento é opcional) */
export type CampoEndereco = 'cep' | 'rua' | 'numero' | 'bairro' | 'cidade';

export const NOMES_CAMPOS_ENDERECO: Record<CampoEndereco, string> = {
  cep: 'CEP',
  rua: 'rua',
  numero: 'número',
  bairro: 'bairro',
  cidade: 'cidade',
};

export const ENDERECO_VAZIO: EnderecoEntrega = {
  cep: '',
  rua: '',
  numero: '',
  bairro: '',
  complemento: '',
  cidade: '',
};

const CHAVE = 'mercadins_endereco_entrega';

/** Endereço salvo pelo cliente neste navegador (ou vazio) */
export function carregarEndereco(): EnderecoEntrega {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { ...ENDERECO_VAZIO };
    const dados = JSON.parse(bruto) as Partial<EnderecoEntrega>;
    return { ...ENDERECO_VAZIO, ...(dados && typeof dados === 'object' ? dados : {}) };
  } catch {
    return { ...ENDERECO_VAZIO };
  }
}

/** Guarda o endereço enquanto o cliente digita (recarregar a página não perde) */
export function salvarEndereco(endereco: EnderecoEntrega): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(endereco));
  } catch {
    /* navegador sem espaço: o endereço apenas não fica salvo */
  }
}

/** Máscara de CEP: 12345678 → 12345-678 */
export function mascaraCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

/** Lista os campos obrigatórios que ainda estão vazios (ou CEP incompleto) */
export function camposEnderecoFaltando(endereco: EnderecoEntrega): CampoEndereco[] {
  const faltando: CampoEndereco[] = [];
  if (endereco.cep.replace(/\D/g, '').trim().length !== 8) faltando.push('cep');
  if (!endereco.rua.trim()) faltando.push('rua');
  if (!endereco.numero.trim()) faltando.push('numero');
  if (!endereco.bairro.trim()) faltando.push('bairro');
  if (!endereco.cidade.trim()) faltando.push('cidade');
  return faltando;
}

/** Texto único gravado no pedido e mostrado para a loja */
export function formatarEndereco(endereco: EnderecoEntrega): string {
  const logradouro = [endereco.rua.trim(), endereco.numero.trim() ? `nº ${endereco.numero.trim()}` : '']
    .filter(Boolean)
    .join(', ');
  const partes = [
    logradouro,
    endereco.bairro.trim(),
    endereco.cep.trim() ? `CEP ${endereco.cep.trim()}` : '',
    endereco.cidade.trim(),
    endereco.complemento.trim() ? `Complemento: ${endereco.complemento.trim()}` : '',
  ].filter(Boolean);
  return partes.join(' - ').slice(0, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Carteira de endereços (vários endereços salvos)
//
//  O cliente pode guardar mais de um endereço e escolher qual recebe a entrega
//  (rádio "Onde você quer receber?"). A lista fica no navegador; o endereço
//  escolhido continua sendo o que vai para o pedido.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnderecoSalvo extends EnderecoEntrega {
  id: string;
  /** Endereço principal da conta — o que já vem marcado no carrinho */
  principal?: boolean;
}

const CHAVE_LISTA = 'mercadins_enderecos';

/** Identificador simples de cada endereço salvo */
export function gerarIdEndereco(): string {
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Todos os endereços que o cliente já cadastrou neste navegador */
export function carregarEnderecos(): EnderecoSalvo[] {
  try {
    const bruto = localStorage.getItem(CHAVE_LISTA);
    if (!bruto) return [];
    const dados: unknown = JSON.parse(bruto);
    if (!Array.isArray(dados)) return [];
    return dados
      .filter(
        (e): e is EnderecoSalvo =>
          !!e && typeof e === 'object' && typeof (e as EnderecoSalvo).id === 'string'
      )
      .map(e => ({ ...ENDERECO_VAZIO, ...e }));
  } catch {
    return [];
  }
}

/** Grava a lista inteira de endereços */
export function guardarEnderecos(lista: EnderecoSalvo[]): void {
  try {
    localStorage.setItem(CHAVE_LISTA, JSON.stringify(lista));
  } catch {
    /* navegador sem espaço: a lista apenas não fica salva */
  }
}
