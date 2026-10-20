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
  /** Unidades disponíveis em estoque (trava a quantidade no carrinho) */
  estoque?: number;
}

export interface ItemCarrinho {
  produto: ProdutoCarrinho;
  quantidade: number;
}

const STORAGE_KEY = 'carrinho';

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

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debounceSalvar(mercadoId: number, itens: ItemCarrinho[]) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    api.salvarCarrinho(
      mercadoId,
      itens.map(i => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade }))
    ).catch(() => {});
  }, 500);
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
        if (res.itens && res.itens.length > 0) {
          const itensBanco: ItemCarrinho[] = res.itens.map((i: ItemCarrinhoBanco) => ({
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
            const merged = [...itensBanco];
            for (const local of prev) {
              const idx = merged.findIndex(m => m.produto.id_produto === local.produto.id_produto);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], quantidade: merged[idx].quantidade + local.quantidade };
              } else {
                merged.push(local);
              }
            }
            saveCarrinhoLocal(mercadoId, merged);
            debounceSalvar(mercadoId, merged);
            return merged;
          });
        }
      })
      .catch(() => {});

    carregouBanco.current = true;
  }, [mercadoId]);

  /**
   * Adiciona um produto ao carrinho respeitando o estoque.
   * Retorna false quando não foi possível (sem estoque ou já no máximo).
   */
  const adicionar = useCallback((produto: ProdutoCarrinho, quantidade: number): boolean => {
    const maximo = produto.estoque ?? 0;
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
          // Trava a quantidade no estoque disponível do produto
          const maximo = i.produto.estoque ?? 0;
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
    // Cancela o salvamento pendente: sem isso, um agendamento antigo
    // poderia regravar o carrinho no servidor logo após o checkout
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
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
