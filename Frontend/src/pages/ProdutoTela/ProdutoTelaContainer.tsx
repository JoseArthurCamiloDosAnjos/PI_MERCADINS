import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import ProdutoTela from './ProdutoTela';
import type { ProdutoDetalhe, ProdutoRelacionado } from './ProdutoTela';
import ToastContainer from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useCarrinho, type ProdutoCarrinho } from '../../hooks/useCarrinho';
import { api } from '../../services/api';
import { encontrarPaleta } from '../../components/Escolherpaleta';
import LoadingOverlay from '../../components/LoadingOverlay';

interface ProdutoTelaContainerProps {
  mercadoId: number;
  categoriaId: number;
  produtoId: number;
  onVoltar: () => void;
  onAbrirCarrinho: () => void;
  onAbrirProduto: (categoriaId: number, produtoId: number) => void;
}

/**
 * Faz a ponte entre a API real e o componente visual <ProdutoTela />.
 *
 * Limitações da API atual (services/api.ts):
 * - Não existe endpoint para buscar 1 produto isolado — por isso buscamos
 *   a lista de produtos da categoria e filtramos pelo id.
 * - Não existe favoritar/avaliar produto individual (só mercado inteiro),
 *   então o coração no ProdutoTela funciona só como toggle visual local,
 *   sem persistir no backend.
 */
export default function ProdutoTelaContainer({
  mercadoId,
  categoriaId,
  produtoId,
  onVoltar,
  onAbrirCarrinho,
  onAbrirProduto,
}: ProdutoTelaContainerProps) {
  const [produto, setProduto] = useState<ProdutoCarrinho | null>(null);
  const [categoriaNome, setCategoriaNome] = useState<string>('');
  const [relacionados, setRelacionados] = useState<ProdutoRelacionado[]>([]);
  const [paletaStyle, setPaletaStyle] = useState<CSSProperties>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const { toasts, showToast, dismissToast } = useToast();
  const carrinho = useCarrinho(mercadoId);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro(false);
      try {
        const [mercadoData, categorias, produtos] = await Promise.all([
          api.buscarMercado(mercadoId),
          api.listarCategorias(mercadoId),
          api.listarProdutos(mercadoId, categoriaId),
        ]);

        if (cancelado) return;

        const encontrado = (produtos as ProdutoCarrinho[]).find(p => p.id_produto === produtoId);
        if (!encontrado) {
          setErro(true);
          return;
        }

        const categoria = (categorias as { id: number; nome: string }[]).find(c => c.id === categoriaId);

        setProduto(encontrado);
        setCategoriaNome(categoria?.nome ?? '');
        setRelacionados(
          (produtos as ProdutoCarrinho[])
            .filter(p => p.id_produto !== produtoId)
            .slice(0, 8)
            .map(p => ({ id_produto: p.id_produto, nome: p.nome, preco: p.preco, imagem: p.imagem }))
        );

        const paleta = encontrarPaleta(mercadoData.mercado.paleta ?? 'classico');
        setPaletaStyle({
          '--vt-azul-escuro': paleta.cores.azulEscuro,
          '--vt-azul-medio': paleta.cores.azulMedio,
          '--vt-azul-claro': paleta.cores.azulClaro,
          '--vt-azul-bg': paleta.cores.azulBg,
          '--vt-azul-card': paleta.cores.azulCard,
          '--vt-azul-borda': paleta.cores.azulBorda,
          '--vt-azul-item': paleta.cores.azulItem,
          '--vt-amarelo': paleta.cores.amarelo,
          '--vt-amarelo-hover': paleta.cores.amareloHover,
        } as CSSProperties);
      } catch (err) {
        console.error('Erro ao carregar produto:', err);
        if (!cancelado) setErro(true);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();
    return () => { cancelado = true; };
  }, [mercadoId, categoriaId, produtoId]);

  function handleAdicionarCarrinho(quantidade: number) {
    if (!produto) return;
    carrinho.adicionar(produto, quantidade);
    showToast('sucesso', `${produto.nome} adicionado ao carrinho!`);
  }

  if (carregando) return <LoadingOverlay mensagem="Carregando produto..." />;

  if (erro || !produto) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#c8d6f0' }}>
        <p>Não foi possível carregar este produto.</p>
        <button onClick={onVoltar} style={{ marginTop: 12 }}>Voltar</button>
      </div>
    );
  }

  const produtoDetalhe: ProdutoDetalhe = {
    id_produto: produto.id_produto,
    nome: produto.nome,
    descricao: produto.descricao,
    preco: produto.preco,
    id_categoria: produto.id_categoria,
    categoria_nome: categoriaNome,
    imagem: produto.imagem,
    // avaliacao, totalAvaliacoes e estoque não existem na API hoje —
    // ficam undefined e o ProdutoTela já esconde esses blocos nesse caso.
  };

  return (
    <>
      <ProdutoTela
        produto={produtoDetalhe}
        relacionados={relacionados}
        totalItensCarrinho={carrinho.totalItens}
        onVoltar={onVoltar}
        onAdicionarCarrinho={handleAdicionarCarrinho}
        onAbrirCarrinho={onAbrirCarrinho}
        onAbrirRelacionado={(idProdutoRelacionado) => onAbrirProduto(categoriaId, idProdutoRelacionado)}
        style={paletaStyle}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}