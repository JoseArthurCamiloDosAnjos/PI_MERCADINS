import { useState, useEffect } from 'react';

export interface ProdutoCarrinho {
  id_produto: number;
  imagem?: string;
  nome: string;
  descricao: string;
  preco?: string;
  id_categoria: number;
}

export interface ItemCarrinho {
  produto: ProdutoCarrinho;
  quantidade: number;
}

/**
 * Carrinho persistido em localStorage, por mercado.
 * Usado tanto pela VitrineCliente quanto pela ProdutoTela — como as duas
 * usam a mesma chave (`mercadins_carrinho_${mercadoId}`), o carrinho fica
 * sincronizado ao navegar entre as telas.
 */
export function useCarrinho(mercadoId: number) {
  const chave = `mercadins_carrinho_${mercadoId}`;
  const [itens, setItens] = useState<ItemCarrinho[]>(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo ? JSON.parse(salvo) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(chave, JSON.stringify(itens)); } catch { /* ignora */ }
  }, [itens, chave]);

  function adicionar(produto: ProdutoCarrinho, quantidade: number) {
    setItens(prev => {
      const existente = prev.find(i => i.produto.id_produto === produto.id_produto);
      if (existente) {
        return prev.map(i =>
          i.produto.id_produto === produto.id_produto
            ? { ...i, quantidade: i.quantidade + quantidade }
            : i
        );
      }
      return [...prev, { produto, quantidade }];
    });
  }

  function alterarQuantidade(idProduto: number, delta: number) {
    setItens(prev =>
      prev
        .map(i => (i.produto.id_produto === idProduto ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter(i => i.quantidade > 0)
    );
  }

  function remover(idProduto: number) {
    setItens(prev => prev.filter(i => i.produto.id_produto !== idProduto));
  }

  function limpar() {
    setItens([]);
  }

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const totalValor = itens.reduce((acc, i) => acc + i.quantidade * Number(i.produto.preco ?? 0), 0);

  return { itens, adicionar, alterarQuantidade, remover, limpar, totalItens, totalValor };
}