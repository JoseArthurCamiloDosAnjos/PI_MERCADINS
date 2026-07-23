import { useState, useEffect } from 'react';
import ProdutoTela from './ProdutoTela';
import type { ProdutoDetalhe } from './ProdutoTela';
import { api } from '../../services/api';

interface ProdutoTelaContainerProps {
  mercadoId: number;
  categoriaId: number;
  produtoId: number;
  onVoltar: () => void;
  onAbrirCarrinho: () => void;
  onAbrirProduto: (catId: number, prodId: number) => void;
}

export default function ProdutoTelaContainer({
  mercadoId,
  categoriaId,
  produtoId,
  onVoltar,
  onAbrirCarrinho,
}: ProdutoTelaContainerProps) {
  const [produto, setProduto] = useState<ProdutoDetalhe | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string | undefined>(undefined);
  const [mercadoNome, setMercadoNome] = useState('');
  const [mercadoLogo, setMercadoLogo] = useState<string | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [mercadoData, produtosData] = await Promise.all([
          api.buscarMercado(mercadoId),
          api.listarProdutos(mercadoId, categoriaId),
        ]);

        setMercadoNome(mercadoData.mercado.nome);
        setMercadoLogo(mercadoData.mercado.foto_perfil ?? undefined);

        const encontrado = (produtosData as ProdutoDetalhe[]).find(
          (p) => p.id_produto === produtoId
        );

        if (encontrado) {
          setProduto(encontrado);
        }

        const categorias = await api.listarCategorias(mercadoId);
        const cat = (categorias as { id: number; nome: string }[]).find(
          (c) => c.id === categoriaId
        );
        if (cat) setCategoriaNome(cat.nome);
      } catch (err) {
        console.error('Erro ao carregar produto:', err);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [mercadoId, categoriaId, produtoId]);

  if (carregando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Carregando produto...</p>
      </div>
    );
  }

  if (!produto) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <p>Produto não encontrado.</p>
        <button onClick={onVoltar}>Voltar</button>
      </div>
    );
  }

  return (
    <ProdutoTela
      produto={produto}
      categoriaNome={categoriaNome}
      mercado={{ id: mercadoId, nome: mercadoNome, logo: mercadoLogo }}
      onVoltar={onVoltar}
      onIrParaCarrinho={onAbrirCarrinho}
    />
  );
}
