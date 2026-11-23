import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { api } from '../services/api';

export interface ProdutoCarrinho {
  id_produto: number;
  id_categoria: number;
  nome: string;
  descricao?: string;
  preco?: string;
  imagem?: string;
  imagens?: string[];
  estoque?: number;
}

export interface ItemCarrinho {
  produto: ProdutoCarrinho;
  quantidade: number;
}

const STORAGE_KEY = 'carrinho';

/**
 * Teto de unidades de um único produto em um pedido — mesma regra do backend
 * (Backend/src/utils/limites.js).
 */
export const MAX_UNIDADES_PRODUTO = 99;

/**
 * Limite de unidades de um produto aceito no carrinho: o menor valor entre o
 * estoque disponível e o teto de unidades por produto. Um produto sem estoque
 * informado (ou zerado) não pode ser selecionado.
 */
export function limiteQuantidade(estoque?: number): number {
  const disponivel = Math.max(0, Number(estoque) || 0);
  return Math.min(disponivel, MAX_UNIDADES_PRODUTO);
}

/** Texto explicando por que o limite de um produto foi atingido. */
export function mensagemLimiteQuantidade(estoque?: number): string {
  const disponivel = Math.max(0, Number(estoque) || 0);
  if (disponivel <= 0) return 'Produto sem estoque disponível.';
  if (disponivel > MAX_UNIDADES_PRODUTO) {
    return `Limite de ${MAX_UNIDADES_PRODUTO} unidades por produto.`;
  }
  return `Estoque esgotado: só temos ${disponivel} unidade${disponivel === 1 ? '' : 's'}.`;
}

function loadCarrinhoLocal(mercadoId: number): ItemCarrinho[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${mercadoId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCarrinhoLocal(mercadoId: number, itens: ItemCarrinho[]) {
  localStorage.setItem(`${STORAGE_KEY}_${mercadoId}`, JSON.stringify(itens));
}

// Um timer por mercado: um debounce global cancelaria o save de outro
// mercado se o usuário trocasse de vitrine no meio da janela.
const debounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

function debounceSalvar(mercadoId: number, itens: ItemCarrinho[]) {
  const anterior = debounceTimers.get(mercadoId);
  if (anterior) clearTimeout(anterior);
  debounceTimers.set(mercadoId, setTimeout(() => {
    debounceTimers.delete(mercadoId);
    const token = localStorage.getItem('token');
    if (!token) return;

    api.salvarCarrinho(
      mercadoId,
      itens.map(i => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade }))
    ).catch(() => {});
  }, 500));
}

interface ItemCarrinhoBanco {
  id_produto: number;
  id_categoria: number;
  nome: string;
  descricao?: string;
  preco?: string;
  imagem?: string;
  estoque?: number;
  quantidade: number;
}

export function useCarrinho(mercadoId: number) {
  const [itens, setItens] = useState<ItemCarrinho[]>(() => loadCarrinhoLocal(mercadoId));
  const carregouBanco = useRef(false);
  const mercadoIdAnterior = useRef(mercadoId);

  useEffect(() => {
    if (mercadoIdAnterior.current !== mercadoId && mercadoId > 0) {
      setItens(loadCarrinhoLocal(mercadoId));
      carregouBanco.current = false;
      mercadoIdAnterior.current = mercadoId;
    }
  }, [mercadoId]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || carregouBanco.current || mercadoId <= 0) return;

    api.buscarCarrinho(mercadoId)
      .then(res => {
        const itensBanco: ItemCarrinho[] = (res.itens ?? []).map((i: ItemCarrinhoBanco) => ({
          produto: {
            id_produto: i.id_produto,
            id_categoria: i.id_categoria,
            nome: i.nome,
            descricao: i.descricao,
            preco: i.preco,
            imagem: i.imagem,
            estoque: i.estoque,
          },
          quantidade: i.quantidade,
        }));

        setItens(prev => {
          if (prev.length > 0) {
            const estoqueDoServidor = new Map(
              itensBanco.map(i => [i.produto.id_produto, i.produto.estoque])
            );
            // Estoque/plano mudaram? Ajusta os itens que ficaram acima do novo limite.
            const atualizados = prev
              .map(item => {
                const atual = estoqueDoServidor.get(item.produto.id_produto);
                if (atual === undefined) return item;
                const quantidade = Math.min(item.quantidade, limiteQuantidade(atual));
                if (atual === item.produto.estoque && quantidade === item.quantidade) return item;
                return {
                  ...item,
                  quantidade,
                  produto: { ...item.produto, estoque: atual },
                };
              })
              .filter(item => item.quantidade > 0);
            if (atualizados.length !== prev.length ||
                atualizados.some((item, i) => item !== prev[i])) {
              saveCarrinhoLocal(mercadoId, atualizados);
            }
            debounceSalvar(mercadoId, atualizados);
            return atualizados;
          }
          if (itensBanco.length > 0) {
            // Carrinho vindo do banco também respeita o limite atual.
            const ajustados = itensBanco
              .map(item => ({
                ...item,
                quantidade: Math.min(item.quantidade, limiteQuantidade(item.produto.estoque)),
              }))
              .filter(item => item.quantidade > 0);
            saveCarrinhoLocal(mercadoId, ajustados);
            return ajustados;
          }
          return prev;
        });
      })
      .catch(() => {});

    carregouBanco.current = true;
  }, [mercadoId]);

  const adicionar = useCallback((produto: ProdutoCarrinho, quantidade: number): boolean => {
    const maximo = limiteQuantidade(produto.estoque);
    if (maximo <= 0) return false;

    const atual = itens.find(i => i.produto.id_produto === produto.id_produto)?.quantidade ?? 0;
    if (atual >= maximo) return false;

    const quantidadeFinal = Math.min(atual + quantidade, maximo);

    setItens(prev => {
      const idx = prev.findIndex(i => i.produto.id_produto === produto.id_produto);
      let novos: ItemCarrinho[];
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], quantidade: quantidadeFinal };
        novos = copia;
      } else {
        novos = [...prev, { produto, quantidade: quantidadeFinal }];
      }
      saveCarrinhoLocal(mercadoId, novos);
      debounceSalvar(mercadoId, novos);
      return novos;
    });
    return true;
  }, [mercadoId, itens]);

  const alterarQuantidade = useCallback((idProduto: number, delta: number) => {
    setItens(prev => {
      const novos = prev
        .map(i => {
          if (i.produto.id_produto !== idProduto) return i;
          const maximo = limiteQuantidade(i.produto.estoque);
          // Sem estoque (ou sem limite disponível) não deixa aumentar.
          if (delta > 0 && maximo <= 0) return i;
          const nova = maximo > 0
            ? Math.min(i.quantidade + delta, maximo)
            : i.quantidade + delta;
          return { ...i, quantidade: nova };
        })
        .filter(i => i.quantidade > 0);
      saveCarrinhoLocal(mercadoId, novos);
      debounceSalvar(mercadoId, novos);
      return novos;
    });
  }, [mercadoId]);

  const remover = useCallback((idProduto: number) => {
    setItens(prev => {
      const novos = prev.filter(i => i.produto.id_produto !== idProduto);
      saveCarrinhoLocal(mercadoId, novos);
      debounceSalvar(mercadoId, novos);
      return novos;
    });
  }, [mercadoId]);

  const limpar = useCallback(() => {
    const timer = debounceTimers.get(mercadoId);
    if (timer) {
      clearTimeout(timer);
      debounceTimers.delete(mercadoId);
    }
    setItens([]);
    saveCarrinhoLocal(mercadoId, []);
    const token = localStorage.getItem('token');
    if (token) {
      api.limparCarrinho(mercadoId).catch(() => {});
    }
  }, [mercadoId]);

  const totalItens = useMemo(() => itens.reduce((s, i) => s + i.quantidade, 0), [itens]);
  const totalValor = useMemo(
    () => itens.reduce((s, i) => s + (Number(i.produto.preco ?? 0) * i.quantidade), 0),
    [itens]
  );

  return { itens, totalItens, totalValor, adicionar, alterarQuantidade, remover, limpar };
}
