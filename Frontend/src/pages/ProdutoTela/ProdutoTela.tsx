import { useState, useMemo, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import './ProdutoTela.css';
import ToastContainer from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { resolverPaleta } from '../../components/EscolherPaleta';
import { useCarrinho, type ProdutoCarrinho } from '../../hooks/useCarrinho';
import CarrinhoSidebar from '../../components/CarrinhoSidebar/CarrinhoSidebar';
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
  /** Quantidade em estoque */
  estoque?: number;
}

/** Uma avaliação de produto vinda da API */
export interface AvaliacaoProduto {
  id: number;
  nota: number;
  texto: string;
  data_cadastro: string;
  cliente: string;
  minha: boolean;
}

/** Resumo das avaliações de um produto (média + lista) */
export interface ResumoAvaliacoes {
  media: number;
  total: number;
  avaliacoes: AvaliacaoProduto[];
}

const ROTULOS_NOTA: Record<number, string> = {
  1: 'Ruim',
  2: 'Regular',
  3: 'Bom',
  4: 'Ótimo',
  5: 'Excelente',
};

interface ProdutoTelaProps {
  produto: ProdutoDetalhe;
  categoriaId: number;
  categoriaNome?: string;
  mercado: { id: number; nome: string; logo?: string };
  paleta?: string;
  corBase?: string;
  corDestaque?: string;
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
  produto, categoriaId, categoriaNome, mercado, paleta, corBase, corDestaque, onVoltar, onIrParaCarrinho,
}: ProdutoTelaProps) {
  const { toasts, showToast, dismissToast } = useToast();
  const { tema } = useTheme();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const carrinho = useCarrinho(mercado.id);

  const paletaAtual = useMemo(
    () => resolverPaleta(paleta, corBase, corDestaque),
    [paleta, corBase, corDestaque]
  );

  const estiloPaleta = {
    '--vt-azul-escuro': paletaAtual.cores.azulEscuro,
    '--vt-azul-medio': paletaAtual.cores.azulMedio,
    '--vt-azul-claro': paletaAtual.cores.azulClaro,
    '--vt-azul-bg': paletaAtual.cores.azulBg,
    '--vt-azul-card': paletaAtual.cores.azulCard,
    '--vt-azul-borda': paletaAtual.cores.azulBorda,
    '--vt-azul-item': paletaAtual.cores.azulItem,
    '--vt-amarelo': paletaAtual.cores.amarelo,
    '--vt-amarelo-hover': paletaAtual.cores.amareloHover,
  } as CSSProperties;

  const imagens = useMemo(
    () => (produto.imagens && produto.imagens.length > 0 ? produto.imagens : produto.imagem ? [produto.imagem] : []),
    [produto.imagens, produto.imagem]
  );

  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [quantidade, setQuantidade]   = useState(1);
  const [enviando, setEnviando]       = useState(false);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  // ── Avaliações do produto ────────────────────────────────────────────────
  const [avaliacoes, setAvaliacoes] = useState<ResumoAvaliacoes | null>(null);
  const [notaForm, setNotaForm]     = useState(0);
  const [notaHover, setNotaHover]   = useState(0);
  const [textoAval, setTextoAval]   = useState('');
  const [enviandoAval, setEnviandoAval] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.avaliacoesProduto(mercado.id, categoriaId, produto.id_produto)
      .then((dados) => {
        if (!vivo) return;
        const res = dados as ResumoAvaliacoes;
        setAvaliacoes(res);
        // Se já avaliei, o formulário nasce com a minha nota/texto antigos
        const minha = res.avaliacoes.find(a => a.minha);
        if (minha) {
          setNotaForm(minha.nota);
          setTextoAval(minha.texto);
        }
      })
      .catch(() => { /* sem avaliações segue zerado */ });
    return () => { vivo = false; };
  }, [mercado.id, categoriaId, produto.id_produto]);

  const jaAvaliou = !!avaliacoes?.avaliacoes.some(a => a.minha);
  // Média exibida: ao vivo depois que carrega (atualiza após enviar)
  const mediaExibida = avaliacoes ? avaliacoes.media : (produto.avaliacao ?? 0);
  const totalExibida = avaliacoes ? avaliacoes.total : (produto.numAvaliacoes ?? 0);

  async function handleEnviarAvaliacao() {
    if (notaForm < 1) {
      showToast('erro', 'Escolha uma nota de 1 a 5 estrelas.');
      return;
    }
    setEnviandoAval(true);
    try {
      await api.criarAvaliacaoProduto(mercado.id, categoriaId, produto.id_produto, {
        nota: notaForm,
        texto: textoAval,
      });
      showToast('sucesso', jaAvaliou ? 'Sua avaliação foi atualizada com sucesso.' : 'Avaliação enviada com sucesso.');
      const novo = await api.avaliacoesProduto(mercado.id, categoriaId, produto.id_produto) as ResumoAvaliacoes;
      setAvaliacoes(novo);
    } catch (err) {
      showToast('erro', (err as Error).message || 'Não foi possível enviar sua avaliação.');
    } finally {
      setEnviandoAval(false);
    }
  }

  const estoqueDisponivel = produto.estoque ?? 0;
  const semEstoque = estoqueDisponivel <= 0;
  // Quantidade efetiva: mesmo quem tinha mais unidades abertas num produto
  // anterior nunca pede acima do estoque do produto atual
  const quantidadeEfetiva = semEstoque
    ? 1
    : Math.min(Math.max(quantidade, 1), estoqueDisponivel);
  const noMaximoEstoque = !semEstoque && quantidadeEfetiva >= estoqueDisponivel;

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
    const ok = carrinho.adicionar(produto, quantidadeEfetiva);
    if (!ok) {
      if (semEstoque) showToast('erro', 'Produto sem estoque disponível.');
      else showToast('erro', `Estoque esgotado: só temos ${estoqueDisponivel} unidade${estoqueDisponivel !== 1 ? 's' : ''}.`);
      return;
    }
    showToast('sucesso', `${produto.nome} adicionado ao carrinho!`);
    setCarrinhoAberto(true);
  }

  function handleComprarAgora() {
    setEnviando(true);
    const ok = carrinho.adicionar(produto, quantidadeEfetiva);
    setEnviando(false);
    if (!ok) {
      if (semEstoque) showToast('erro', 'Produto sem estoque disponível.');
      else showToast('erro', `Estoque esgotado: só temos ${estoqueDisponivel} unidade${estoqueDisponivel !== 1 ? 's' : ''}.`);
      return;
    }
    if (onIrParaCarrinho) {
      onIrParaCarrinho();
    } else {
      setCarrinhoAberto(true);
    }
  }

  function irParaCarrinho() {
    setCarrinhoAberto(false);
    onIrParaCarrinho?.();
  }

  return (
    <div className="pd-shell" data-tema={tema} style={estiloPaleta}>

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
          <button
            className={`pd-btn-carrinho ${carrinho.totalItens > 0 ? 'pd-btn-carrinho--ativo' : ''}`}
            onClick={() => setCarrinhoAberto(true)}
            aria-label="Abrir carrinho"
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

          <p className="pd-descricao-inline">{produto.descricao || 'Sem descrição disponível.'}</p>

          <div className="pd-avaliacao">
            <span className="pd-avaliacao-valor">{mediaExibida.toFixed(1)}</span>
            {Array.from({ length: 5 }, (_, i) => (
              <IconStar key={i} size={14} filled={i < Math.round(mediaExibida)} />
            ))}
            <span className="pd-avaliacao-total">({totalExibida})</span>
          </div>

          <div className="pd-preco-bloco">
            <span className="pd-preco-atual">R$ {formatarPreco(produto.preco)}</span>
            {produto.precoOriginal && (
              <span className="pd-preco-original">R$ {formatarPreco(produto.precoOriginal)}</span>
            )}
            {desconto !== null && <span className="pd-desconto-badge">-{desconto}%</span>}
          </div>

          <div className="pd-estoque">
            {produto.estoque != null && produto.estoque > 0 ? (
              <span className="pd-estoque-disponivel">
                Estoque disponível: <strong>{produto.estoque}</strong> unidade{produto.estoque !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="pd-estoque-esgotado">Produto sem estoque</span>
            )}
          </div>

          <div className="pd-quantidade-row">
            <span className="pd-quantidade-label">Quantidade</span>
            <div className="pd-stepper">
              <button
                className="pd-stepper-btn"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade(Math.max(1, quantidadeEfetiva - 1))}
              >
                <IconMinus size={13} />
              </button>
              <span className="pd-stepper-valor">{quantidadeEfetiva}</span>
              <button
                className="pd-stepper-btn"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade(Math.min(quantidadeEfetiva + 1, Math.max(1, estoqueDisponivel)))}
                disabled={semEstoque || noMaximoEstoque}
              >
                <IconPlusMini size={13} />
              </button>
            </div>
            {noMaximoEstoque && (
              <span className="pd-estoque-max">Máximo: {estoqueDisponivel} unidade{estoqueDisponivel !== 1 ? 's' : ''}</span>
            )}
          </div>

          <div className="pd-acoes">
            <button className="pd-btn-comprar" onClick={handleComprarAgora} disabled={enviando || semEstoque}>
              Comprar agora
            </button>
            <button className="pd-btn-adicionar" onClick={handleAdicionar} disabled={semEstoque}>
              <IconCart size={16} /> {semEstoque ? 'Produto sem estoque' : 'Adicionar ao carrinho'}
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

        {/* ── Avaliações do produto ─────────────────────────────────────── */}
        <section className="pd-avaliacoes">
          <div className="pd-aval-head">
            <h2>Avaliações do produto</h2>
            <div className="pd-aval-resumo">
              <span className="pd-aval-media">{mediaExibida.toFixed(1)}</span>
              <span className="pd-aval-estrelas">
                {Array.from({ length: 5 }, (_, i) => (
                  <IconStar key={i} size={15} filled={i < Math.round(mediaExibida)} />
                ))}
              </span>
              <span className="pd-aval-total">
                {totalExibida} avaliaç{totalExibida === 1 ? 'ão' : 'ões'}
              </span>
            </div>
          </div>

          {usuario ? (
            <div className="pd-aval-form">
              <p className="pd-aval-form-titulo">
                {jaAvaliou ? 'Sua avaliação — ajuste e salve de novo' : 'Avalie este produto'}
              </p>
              <div className="pd-aval-form-linha">
                <div className="pd-aval-picker" role="group" aria-label="Escolha a nota de 1 a 5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`pd-aval-estrela-btn ${n <= (notaHover || notaForm) ? 'ativa' : ''}`}
                      onClick={() => setNotaForm(n)}
                      onMouseEnter={() => setNotaHover(n)}
                      onMouseLeave={() => setNotaHover(0)}
                      aria-label={`Nota ${n}`}
                    >
                      <IconStar size={20} filled={n <= (notaHover || notaForm)} />
                    </button>
                  ))}
                  {(notaHover || notaForm) > 0 && (
                    <span className="pd-aval-dica">{ROTULOS_NOTA[notaHover || notaForm]}</span>
                  )}
                </div>
              </div>
              <textarea
                className="pd-aval-textarea"
                rows={3}
                maxLength={500}
                placeholder="Conte como foi sua experiência com o produto (opcional)"
                value={textoAval}
                onChange={e => setTextoAval(e.target.value)}
              />
              <button
                className="pd-aval-btn"
                onClick={handleEnviarAvaliacao}
                disabled={enviandoAval || notaForm < 1}
              >
                {enviandoAval ? 'Enviando...' : jaAvaliou ? 'Atualizar avaliação' : 'Enviar avaliação'}
              </button>
            </div>
          ) : (
            <div className="pd-aval-login">
              <p>Faça login para avaliar este produto.</p>
              <button className="pd-aval-btn" onClick={() => navigate('/auth')}>
                Fazer login
              </button>
            </div>
          )}

          <div className="pd-aval-lista">
            {!avaliacoes ? (
              <p className="pd-aval-vazio">Carregando avaliações...</p>
            ) : avaliacoes.avaliacoes.length === 0 ? (
              <p className="pd-aval-vazio">Este produto ainda não recebeu avaliações. Seja o primeiro!</p>
            ) : (
              avaliacoes.avaliacoes.map(a => (
                <article key={a.id} className="pd-aval-item">
                  <div className="pd-aval-item-topo">
                    <span className="pd-aval-avatar">{a.cliente.charAt(0).toUpperCase()}</span>
                    <div className="pd-aval-quem">
                      <strong>
                        {a.cliente} {a.minha && <span className="pd-aval-badge">você</span>}
                      </strong>
                      <span className="pd-aval-data">
                        {new Date(a.data_cadastro).toLocaleDateString('pt-BR', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="pd-aval-estrelas-item">
                      {Array.from({ length: 5 }, (_, i) => (
                        <IconStar key={i} size={13} filled={i < a.nota} />
                      ))}
                    </span>
                  </div>
                  {a.texto && <p className="pd-aval-texto-item">{a.texto}</p>}
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <CarrinhoSidebar
        aberto={carrinhoAberto}
        onFechar={() => setCarrinhoAberto(false)}
        carrinho={carrinho}
        onIrParaCarrinho={onIrParaCarrinho ? irParaCarrinho : undefined}
        storeName={mercado.nome}
        tema={tema}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}