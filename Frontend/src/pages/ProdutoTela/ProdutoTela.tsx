import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import './ProdutoTela.css';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';

/**
 * Tela completa de produto (não é modal).
 * Segue o mesmo design system da VitrineCliente (mesmas CSS vars --vt-*),
 * então este componente assume que os tokens :root já foram carregados
 * globalmente (ex.: via VitrineCliente.css). Caso use isolado, basta
 * colar o bloco :root do arquivo original no topo do ProdutoTela.css.
 */

// ─── Ícones locais ──────────────────────────────────────────────────────────

function IconArrowLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCart({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="21" r="1.4" fill="currentColor" stroke="none" />
      <path d="M2.5 3h2.2l2.4 12.3a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconMinus({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function IconPlus({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function IconHeart({ size = 17, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconShare({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5 15.4 6.6M8.6 13.5l6.8 3.9" strokeLinecap="round" />
    </svg>
  );
}
function IconStar({ size = 13, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.8L12 17.7 5.9 20.9l1.5-6.8-5.1-4.6 6.8-.7L12 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconStorePlaceholder({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l1.5-5h15L21 9M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M3 9h18M8 20v-6h8v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProdutoDetalhe {
  id_produto: number;
  nome: string;
  descricao: string;
  preco?: string;
  id_categoria: number;
  categoria_nome?: string;
  imagens?: string[];      // várias fotos, se existirem
  imagem?: string;         // fallback: uma foto só
  avaliacao?: number;
  totalAvaliacoes?: number;
  estoque?: number;        // se undefined, assume disponível
}

export interface ProdutoRelacionado {
  id_produto: number;
  nome: string;
  preco?: string;
  imagem?: string;
}

interface ProdutoTelaProps {
  produto: ProdutoDetalhe;
  relacionados?: ProdutoRelacionado[];
  totalItensCarrinho?: number;
  favoritado?: boolean;
  onVoltar: () => void;
  onAdicionarCarrinho: (quantidade: number) => void;
  onAbrirCarrinho?: () => void;
  onFavoritar?: () => void;
  onAbrirRelacionado?: (idProduto: number) => void;
  style?: CSSProperties; // permite herdar a paleta de cores do mercado (mesmas --vt-*)
}

function formatarPreco(valor?: string) {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return valor ?? '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function ProdutoTela({
  produto,
  relacionados = [],
  totalItensCarrinho = 0,
  favoritado = false,
  onVoltar,
  onAdicionarCarrinho,
  onAbrirCarrinho,
  onFavoritar,
  onAbrirRelacionado,
  style,
}: ProdutoTelaProps) {
  const { tema, toggleTema } = useTheme();

  const galeria = useMemo(() => {
    if (produto.imagens && produto.imagens.length > 0) return produto.imagens;
    if (produto.imagem) return [produto.imagem];
    return [];
  }, [produto]);

  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [favoritoLocal, setFavoritoLocal] = useState(favoritado);

  const semEstoque = produto.estoque !== undefined && produto.estoque <= 0;
  const precoTotal = Number(produto.preco ?? 0) * quantidade;

  function handleFavoritar() {
    setFavoritoLocal(f => !f);
    onFavoritar?.();
  }

  return (
    <div className="vtp-shell" style={style}>

      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div className="vtp-topbar">
        <button className="vtp-btn-voltar" onClick={onVoltar} title="Voltar">
          <IconArrowLeft size={18} />
        </button>
        <div className="vtp-topbar-acoes">
          <ThemeToggle tema={tema} onToggle={toggleTema} />
          <button className="vtp-icon-btn" onClick={() => {}} title="Compartilhar">
            <IconShare size={16} />
          </button>
          <button
            className={`vtp-icon-btn ${favoritoLocal ? 'vtp-icon-btn--ativo' : ''}`}
            onClick={handleFavoritar}
            title={favoritoLocal ? 'Remover dos favoritos' : 'Favoritar produto'}
          >
            <IconHeart size={16} filled={favoritoLocal} />
          </button>
          <button className="vtp-icon-btn vtp-icon-btn--carrinho" onClick={onAbrirCarrinho} title="Ver carrinho">
            <IconCart size={17} />
            {totalItensCarrinho > 0 && <span className="vtp-carrinho-badge">{totalItensCarrinho}</span>}
          </button>
        </div>
      </div>

      {/* ── Galeria de imagens ─────────────────────────────────────────── */}
      <div className="vtp-galeria">
        <div className="vtp-galeria-principal">
          {galeria.length > 0
            ? <img src={galeria[imagemAtiva]} alt={produto.nome} />
            : <span className="vtp-galeria-placeholder"><IconStorePlaceholder size={34} /></span>
          }
        </div>

        {galeria.length > 1 && (
          <div className="vtp-galeria-miniaturas">
            {galeria.map((img, i) => (
              <button
                key={i}
                className={`vtp-miniatura ${i === imagemAtiva ? 'vtp-miniatura--ativa' : ''}`}
                onClick={() => setImagemAtiva(i)}
              >
                <img src={img} alt={`${produto.nome} ${i + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────── */}
      <main className="vtp-conteudo">
        {produto.categoria_nome && (
          <span className="vtp-tag-categoria">{produto.categoria_nome}</span>
        )}

        <h1 className="vtp-nome">{produto.nome}</h1>

        {(produto.avaliacao !== undefined) && (
          <div className="vtp-avaliacao">
            {Array.from({ length: 5 }, (_, i) => (
              <IconStar key={i} size={13} filled={i < Math.round(produto.avaliacao ?? 0)} />
            ))}
            <span>{(produto.avaliacao ?? 0).toFixed(1)}</span>
            {produto.totalAvaliacoes !== undefined && (
              <span className="vtp-avaliacao-total">({produto.totalAvaliacoes} avaliações)</span>
            )}
          </div>
        )}

        <p className="vtp-preco">R$ {formatarPreco(produto.preco)}</p>

        <div className="vtp-secao">
          <h2 className="vtp-secao-titulo">Descrição</h2>
          <p className="vtp-descricao">{produto.descricao || 'Sem descrição disponível.'}</p>
        </div>

        {semEstoque && (
          <div className="vtp-aviso-estoque">Produto indisponível no momento</div>
        )}

        {/* ── Relacionados ─────────────────────────────────────────────── */}
        {relacionados.length > 0 && (
          <div className="vtp-secao">
            <h2 className="vtp-secao-titulo">Você também pode gostar</h2>
            <div className="vtp-relacionados-grid">
              {relacionados.map(rp => (
                <button
                  key={rp.id_produto}
                  className="vtp-relacionado-card"
                  onClick={() => onAbrirRelacionado?.(rp.id_produto)}
                >
                  <div className="vtp-relacionado-img">
                    {rp.imagem
                      ? <img src={rp.imagem} alt={rp.nome} />
                      : <span className="vtp-galeria-placeholder"><IconStorePlaceholder size={20} /></span>
                    }
                  </div>
                  <p className="vtp-relacionado-nome">{rp.nome}</p>
                  {rp.preco && <p className="vtp-relacionado-preco">R$ {formatarPreco(rp.preco)}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* espaço para não ficar atrás da barra fixa */}
        <div className="vtp-espaco-rodape" />
      </main>

      {/* ── Barra fixa: quantidade + adicionar ──────────────────────────── */}
      <div className="vtp-barra-fixa">
        <div className="vtp-stepper">
          <button
            className="vtp-stepper-btn"
            onClick={() => setQuantidade(q => Math.max(1, q - 1))}
            disabled={semEstoque}
          >
            <IconMinus size={13} />
          </button>
          <span className="vtp-stepper-valor">{quantidade}</span>
          <button
            className="vtp-stepper-btn"
            onClick={() => setQuantidade(q => q + 1)}
            disabled={semEstoque}
          >
            <IconPlus size={13} />
          </button>
        </div>

        <button
          className="vtp-btn-adicionar"
          onClick={() => onAdicionarCarrinho(quantidade)}
          disabled={semEstoque}
        >
          <IconCart size={16} />
          {semEstoque ? 'Indisponível' : `Adicionar · R$ ${formatarPreco(String(precoTotal))}`}
        </button>
      </div>
    </div>
  );
}