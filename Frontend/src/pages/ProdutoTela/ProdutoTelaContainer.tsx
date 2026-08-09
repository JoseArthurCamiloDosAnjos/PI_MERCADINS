import { useState, useEffect } from 'react';
import ProdutoTela from './ProdutoTela';
import type { ProdutoDetalhe } from './ProdutoTela';
import { api } from '../../services/api';
import LoadingOverlay from '../../components/LoadingOverlay';

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
  const [paleta, setPaleta] = useState<string>('classico');
  const [corBase, setCorBase] = useState<string | undefined>(undefined);
  const [corDestaque, setCorDestaque] = useState<string | undefined>(undefined);
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
        setPaleta(mercadoData.mercado.paleta ?? 'classico');
        setCorBase(mercadoData.mercado.cor_base ?? undefined);
        setCorDestaque(mercadoData.mercado.cor_destaque ?? undefined);

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
    return <LoadingOverlay mensagem="Carregando produto..." />;
  }

  if (!produto) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: 'var(--azul-bg)', color: 'var(--branco)', fontFamily: 'var(--font)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p style={{ fontSize: 16, fontWeight: 700 }}>Produto não encontrado</p>
        <button onClick={onVoltar} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'var(--amarelo)', color: 'var(--azul-escuro)', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <ProdutoTela
      produto={produto}
      categoriaNome={categoriaNome}
      mercado={{ id: mercadoId, nome: mercadoNome, logo: mercadoLogo }}
      paleta={paleta}
      corBase={corBase}
      corDestaque={corDestaque}
      onVoltar={onVoltar}
      onIrParaCarrinho={onAbrirCarrinho}
    />
  );
}
