import { useState, useMemo, useCallback } from 'react';
import './ProdutoTela.css';
import ToastContainer from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import { useCarrinho, type ProdutoCarrinho } from '../../hooks/useCarrinho';
import {
  IconStore,
  IconArrowLeft,
} from '../../components/Icons';

// ─── Ícones locais (mesmo padrão usado na VitrineCliente) ─────────────────────

function IconStar({ size = 14, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.8L12 17.7 5.9 20.9l1.5-6.8-5.1-4.6 6.8-.7L12 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconSearch({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
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
function IconPlusMini({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function IconTruck({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M2 7h11v9H2z" strokeLinejoin="round" />
      <path d="M13 10h4l4 3.5V16h-8z" strokeLinejoin="round" />
      <circle cx="6.5" cy="18" r="1.6" />
      <circle cx="16.5" cy="18" r="1.6" />
    </svg>
  );
}
function IconShield({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M12 2.8l7.5 3v5.4c0 4.7-3.2 8.9-7.5 10-4.3-1.1-7.5-5.3-7.5-10V5.8L12 2.8Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconCard({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <path d="M2.5 9.5h19" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProdutoDetalhe extends ProdutoCarrinho {
  /** Galeria de imagens; se ausente, cai para [imagem] */
  imagens?: string[];
  /** Preço "de", exibido riscado ao lado do preço atual */
  precoOriginal?: string;
  /** Nota média de 0 a 5 */
  avaliacao?: number;
  numAvaliacoes?: number;
}

interface ProdutoTelaProps {
  produto: ProdutoDetalhe;
  categoriaNome?: string;
  mercado: { id: number; nome: string; logo?: string };
  onVoltar: () => void;
  onIrParaCarrinho?: () => void;
}

function formatarPreco(valor?: string) {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return valor ?? '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProdutoTela({
  produto, categoriaNome, mercado, onVoltar, onIrParaCarrinho,
}: ProdutoTelaProps) {
  const { toasts, showToast, dismissToast } = useToast();
  const { tema, toggleTema } = useTheme();
  const carrinho = useCarrinho(mercado.id);

  const imagens = useMemo(
    () => (produto.imagens && produto.imagens.length > 0 ? produto.imagens : produto.imagem ? [produto.imagem] : []),
    [produto.imagens, produto.imagem]
  );

  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [quantidade, setQuantidade]   = useState(1);
  const [enviando, setEnviando]       = useState(false);

  const slideAnterior = useCallback(() => {
    setImagemAtiva(i => (i - 1 + imagens.length) % imagens.length);
  }, [imagens.length]);

  const slideProximo = useCallback(() => {
    setImagemAtiva(i => (i + 1) % imagens.length);
  }, [imagens.length]);

  const desconto = useMemo(() => {
    const atual = Number(produto.preco ?? 0);
    const original = Number(produto.precoOriginal ?? 0);
    if (!original || original <= atual) return null;
    return Math.round((1 - atual / original) * 100);
  }, [produto.preco, produto.precoOriginal]);

  function handleAdicionar() {
    carrinho.adicionar(produto, quantidade);
    showToast('sucesso', `${produto.nome} adicionado ao carrinho!`);
  }

  function handleComprarAgora() {
    setEnviando(true);
    carrinho.adicionar(produto, quantidade);
    setEnviando(false);
    if (onIrParaCarrinho) {
      onIrParaCarrinho();
    } else {
      showToast('sucesso', `${produto.nome} adicionado ao carrinho!`);
    }
  }

  return (
    <div className="pd-shell" data-tema={tema}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="pd-topbar">
        <button className="pd-btn-voltar" onClick={onVoltar}>
          <IconArrowLeft size={15} /> Voltar
        </button>

        <div className="pd-busca-wrap">
          <IconSearch size={14} />
          <input className="pd-busca-input" placeholder="Buscar produtos..." />
        </div>

        <div className="pd-topbar-direita">
          <ThemeToggle tema={tema} onToggle={toggleTema} />
          <button
            className={`pd-btn-carrinho ${carrinho.totalItens > 0 ? 'pd-btn-carrinho--ativo' : ''}`}
            onClick={onIrParaCarrinho}
          >
            <IconCart size={17} />
            {carrinho.totalItens > 0 && <span className="pd-carrinho-badge">{carrinho.totalItens}</span>}
          </button>
        </div>
      </div>

      {/* ── Breadcrumb ────────────────────────────────────────────────── */}
      <div className="pd-breadcrumb">
        <button className="pd-breadcrumb-link" onClick={onVoltar}>Início</button>
        <span className="pd-breadcrumb-sep">/</span>
        <span className="pd-breadcrumb-link pd-breadcrumb-static">{mercado.nome}</span>
        {categoriaNome && (
          <>
            <span className="pd-breadcrumb-sep">/</span>
            <span className="pd-breadcrumb-link pd-breadcrumb-static">{categoriaNome}</span>
          </>
        )}
        <span className="pd-breadcrumb-sep">/</span>
        <span className="pd-breadcrumb-atual">{produto.nome}</span>
      </div>

      {/* ── Conteúdo ──────────────────────────────────────────────────── */}
      <main className="pd-main">

        {/* Galeria */}
        <section className="pd-galeria">
          {imagens.length > 1 && (
            <div className="pd-miniaturas">
              {imagens.map((img, i) => (
                <button
                  key={i}
                  className={`pd-miniatura ${imagemAtiva === i ? 'active' : ''}`}
                  onClick={() => setImagemAtiva(i)}
                >
                  <img src={img} alt={`${produto.nome} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div className="pd-imagem-principal">
            {imagens[imagemAtiva]
              ? <img src={imagens[imagemAtiva]} alt={produto.nome} />
              : <span className="pd-imagem-placeholder"><IconStore size={30} /></span>
            }

            {imagens.length > 1 && (
              <>
                <button className="pd-carrocel-seta pd-carrocel-seta--prev" onClick={slideAnterior} aria-label="Imagem anterior">
                  ‹
                </button>
                <button className="pd-carrocel-seta pd-carrocel-seta--next" onClick={slideProximo} aria-label="Próxima imagem">
                  ›
                </button>
              </>
            )}
          </div>

          {imagens.length > 1 && (
            <div className="pd-dots">
              {imagens.map((_, i) => (
                <button
                  key={i}
                  className={`pd-dot ${imagemAtiva === i ? 'pd-dot--ativo' : ''}`}
                  onClick={() => setImagemAtiva(i)}
                  aria-label={`Imagem ${i + 1}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* Informações */}
        <section className="pd-info">
          <h1 className="pd-nome">{produto.nome}</h1>

          {typeof produto.avaliacao === 'number' && (
            <div className="pd-avaliacao">
              {Array.from({ length: 5 }, (_, i) => (
                <IconStar key={i} size={13} filled={i < Math.round(produto.avaliacao ?? 0)} />
              ))}
              <span className="pd-avaliacao-valor">{produto.avaliacao.toFixed(1)}</span>
              {typeof produto.numAvaliacoes === 'number' && (
                <span className="pd-avaliacao-total">({produto.numAvaliacoes} avaliações)</span>
              )}
            </div>
          )}

          <div className="pd-preco-bloco">
            <span className="pd-preco-atual">R$ {formatarPreco(produto.preco)}</span>
            {produto.precoOriginal && (
              <span className="pd-preco-original">R$ {formatarPreco(produto.precoOriginal)}</span>
            )}
            {desconto !== null && <span className="pd-desconto-badge">-{desconto}%</span>}
          </div>

          <div className="pd-quantidade-row">
            <span className="pd-quantidade-label">Quantidade</span>
            <div className="pd-stepper">
              <button className="pd-stepper-btn" onClick={() => setQuantidade(q => Math.max(1, q - 1))}>
                <IconMinus size={13} />
              </button>
              <span className="pd-stepper-valor">{quantidade}</span>
              <button className="pd-stepper-btn" onClick={() => setQuantidade(q => q + 1)}>
                <IconPlusMini size={13} />
              </button>
            </div>
          </div>

          <div className="pd-acoes">
            <button className="pd-btn-comprar" onClick={handleComprarAgora} disabled={enviando}>
              Comprar agora
            </button>
            <button className="pd-btn-adicionar" onClick={handleAdicionar}>
              <IconCart size={16} /> Adicionar ao carrinho
            </button>
          </div>

          <div className="pd-caixa-info">
            <div className="pd-caixa-item">
              <span className="pd-caixa-label">Vendido por</span>
              <div className="pd-vendedor">
                {mercado.logo
                  ? <img src={mercado.logo} alt={mercado.nome} className="pd-vendedor-logo" />
                  : <span className="pd-vendedor-logo pd-vendedor-logo--placeholder"><IconStore size={13} /></span>
                }
                <strong>{mercado.nome}</strong>
              </div>
            </div>

            <div className="pd-caixa-item">
              <span className="pd-caixa-label">Serviços</span>
              <ul className="pd-caixa-lista">
                <li><IconShield size={14} /> Trocas e devoluções em 7 dias</li>
                <li><IconTruck size={14} /> Retirada ou entrega combinada com a loja</li>
              </ul>
            </div>

            <div className="pd-caixa-item">
              <span className="pd-caixa-label">Pagamento</span>
              <ul className="pd-caixa-lista">
                <li><IconCard size={14} /> Pix, cartão ou dinheiro na entrega</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* ── Descrição completa ────────────────────────────────────────── */}
      <section className="pd-descricao">
        <h2 className="pd-descricao-titulo">Descrição do produto</h2>
        <p className="pd-descricao-texto">{produto.descricao || 'Sem descrição disponível.'}</p>
      </section>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}