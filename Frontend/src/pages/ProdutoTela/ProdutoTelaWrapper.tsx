import { useParams, useNavigate } from 'react-router-dom';
import ProdutoTela from './ProdutoTela';
import type { ProdutoDetalhe, ProdutoRelacionado } from './ProdutoTela';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useCarrinho } from '../../hooks/useCarrinho';

function ProdutoTelaWrapper() {
  const { slug, categoriaId, produtoId } = useParams<{ slug: string; categoriaId: string; produtoId: string }>();
  const navigate = useNavigate();
  const [mercadoId, setMercadoId] = useState<number | null>(null);
  const [produto, setProduto] = useState<ProdutoDetalhe | null>(null);
  const [relacionados, setRelacionados] = useState<ProdutoRelacionado[]>([]);
  const [catIdMap, setCatIdMap] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!slug) {
      navigate('/');
      return;
    }
    api.buscarMercadoPorSlug(slug)
      .then(data => setMercadoId(data.mercado.id_mercado))
      .catch(() => navigate('/'));
  }, [slug, navigate]);

  useEffect(() => {
    if (!mercadoId || !categoriaId || !produtoId) return;

    let cancelado = false;
    setCarregando(true);

    api.listarProdutos(mercadoId, categoriaId)
      .then((produtos: any[]) => {
        if (cancelado) return;
        const encontrado = produtos.find((p: any) => p.id_produto === Number(produtoId));
        if (!encontrado) {
          setErro(true);
          return;
        }
        setProduto({
          id_produto: encontrado.id_produto,
          nome: encontrado.nome,
          descricao: encontrado.descricao ?? '',
          preco: encontrado.preco,
          id_categoria: encontrado.id_categoria ?? Number(categoriaId),
          categoria_nome: encontrado.categoria_nome,
          imagem: encontrado.imagem,
          imagens: encontrado.imagens,
          avaliacao: encontrado.avaliacao,
          totalAvaliacoes: encontrado.totalAvaliacoes,
          estoque: encontrado.estoque,
        });

        const mapa: Record<number, number> = {};
        produtos.forEach((p: any) => { mapa[p.id_produto] = p.id_categoria ?? Number(categoriaId); });
        setCatIdMap(mapa);

        const outros = produtos
          .filter((p: any) => p.id_produto !== Number(produtoId))
          .slice(0, 6)
          .map((p: any) => ({
            id_produto: p.id_produto,
            nome: p.nome,
            preco: p.preco,
            imagem: p.imagem,
          }));
        setRelacionados(outros);
      })
      .catch(() => { if (!cancelado) setErro(true); })
      .finally(() => { if (!cancelado) setCarregando(false); });

    return () => { cancelado = true; };
  }, [mercadoId, categoriaId, produtoId]);

  const carrinho = useCarrinho(mercadoId ?? 0);

  const handleAdicionarCarrinho = useCallback((quantidade: number) => {
    if (!produto) return;
    carrinho.adicionar({
      id_produto: produto.id_produto,
      id_categoria: produto.id_categoria,
      nome: produto.nome,
      descricao: produto.descricao,
      preco: produto.preco,
      imagem: produto.imagem,
    }, quantidade);
  }, [produto, carrinho]);

  if (carregando || !mercadoId) return <LoadingOverlay mensagem="Carregando..." />;
  if (erro || !produto) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Produto não encontrado.</p>
        <button onClick={() => navigate(-1)}>Voltar</button>
      </div>
    );
  }

  return (
    <ProdutoTela
      produto={produto}
      relacionados={relacionados}
      totalItensCarrinho={carrinho.totalItens}
      onVoltar={() => navigate(-1)}
      onAdicionarCarrinho={handleAdicionarCarrinho}
      onAbrirCarrinho={() => navigate(`/vitrine/${slug}`)}
      onAbrirRelacionado={(prodId) => {
        const catId = catIdMap[prodId] ?? categoriaId;
        navigate(`/vitrine/${slug}/produto/${catId}/${prodId}`);
      }}
    />
  );
}

export default ProdutoTelaWrapper;
