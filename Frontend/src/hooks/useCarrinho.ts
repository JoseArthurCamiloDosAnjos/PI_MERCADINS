import { useState, useCallback, useMemo } from 'react';

export interface ProdutoCarrinho {
  id_produto: number;
  id_categoria: number;
  nome: string;
  descricao?: string;
  preco?: string;
  imagem?: string;
  imagens?: string[];
}

interface ItemCarrinho {
  produto: ProdutoCarrinho;
  quantidade: number;
}

const STORAGE_KEY = 'carrinho';

function loadCarrinho(mercadoId: number): ItemCarrinho[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${mercadoId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCarrinho(mercadoId: number, itens: ItemCarrinho[]) {
  localStorage.setItem(`${STORAGE_KEY}_${mercadoId}`, JSON.stringify(itens));
}

export function useCarrinho(mercadoId: number) {
  const [itens, setItens] = useState<ItemCarrinho[]>(() => loadCarrinho(mercadoId));

  const persist = useCallback((novosItens: ItemCarrinho[]) => {
    setItens(novosItens);
    saveCarrinho(mercadoId, novosItens);
  }, [mercadoId]);

  const adicionar = useCallback((produto: ProdutoCarrinho, quantidade: number) => {
    persist(prev => {
      const idx = prev.findIndex(i => i.produto.id_produto === produto.id_produto);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], quantidade: copia[idx].quantidade + quantidade };
        return copia;
      }
      return [...prev, { produto, quantidade }];
    });
  }, [persist]);

  const alterarQuantidade = useCallback((idProduto: number, delta: number) => {
    persist(prev =>
      prev
        .map(i => i.produto.id_produto === idProduto ? { ...i, quantidade: i.quantidade + delta } : i)
        .filter(i => i.quantidade > 0)
    );
  }, [persist]);

  const remover = useCallback((idProduto: number) => {
    persist(prev => prev.filter(i => i.produto.id_produto !== idProduto));
  }, [persist]);

  const limpar = useCallback(() => persist([]), [persist]);

  const totalItens = useMemo(() => itens.reduce((s, i) => s + i.quantidade, 0), [itens]);
  const totalValor = useMemo(
    () => itens.reduce((s, i) => s + (Number(i.produto.preco ?? 0) * i.quantidade), 0),
    [itens]
  );

  return { itens, totalItens, totalValor, adicionar, alterarQuantidade, remover, limpar };
}
