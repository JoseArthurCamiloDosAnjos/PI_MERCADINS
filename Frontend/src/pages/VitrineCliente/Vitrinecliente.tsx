import { useState, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import './VitrineCliente.css';
import ToastContainer from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useCarrinho, type ProdutoCarrinho } from '../../hooks/useCarrinho';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import { encontrarPaleta } from '../../components/Escolherpaleta';
import {
  IconStore,
  IconPlus,
  IconX,
} from '../../components/Icons';

// ─── Ícones locais (não existiam no set do vendedor) ──────────────────────────

function IconHeart({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconStar({ size = 14, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.8L12 17.7 5.9 20.9l1.5-6.8-5.1-4.6 6.8-.7L12 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}
function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
function IconCart({ size = 20 }: { size?: number }) {
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

// ─── Types ────────────────────────────────────────────────────────────────────

// Produto reaproveita o mesmo shape usado pelo carrinho compartilhado
// (hooks/useCarrinho.ts), pra não haver dois tipos divergentes do mesmo objeto.
type Produto = ProdutoCarrinho;

interface Categoria {
  id: number;
  nome: string;
  produtos: Produto[];
}

interface VitrineMercado {
  id: number;
  logo?: string;
  banner?: string;
  nome: string;
  descricao: string;
  avaliacao?: number;
  favoritado?: boolean;
  paleta?: string;
  categorias: Categoria[];
}

interface VitrineClienteProps {
  mercadoId: number;
  onVoltar?: () => void;
  /**
   * Slug do mercado (ex.: vindo da rota /vitrine/:slug). Quando presente,
   * os cards de produto navegam pra tela cheia (/vitrine/:slug/produto/...).
   * Quando ausente (ex.: preview do vendedor sem rota própria), os cards
   * abrem o modal rápido como fallback.
   */
  slug?: string;
}

function formatarPreco(valor?: string) {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return valor ?? '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── ProdutoCard (cliente) ─────────────────────────────────────────────────────

function ProdutoCardCliente({ produto, onAbrir }: { produto: Produto; onAbrir: () => void }) {
  return (
    <button className="vtc-produto-card" onClick={onAbrir}>
      <div className="vtc-produto-img">
        {produto.imagem
          ? <img src={produto.imagem} alt={produto.nome} />
          : <span className="vtc-produto-img-placeholder">Sem imagem</span>
        }
      </div>
      <div className="vtc-produto-info">
        <p className="vtc-produto-nome">{produto.nome}</p>
        {produto.preco && <p className="vtc-produto-preco">R$ {formatarPreco(produto.preco)}</p>}
      </div>
      <span className="vtc-produto-add-icon" title="Ver produto"><IconPlus size={15} /></span>
    </button>
  );
}

// ─── Modal de produto (fallback quando não há slug/rota) ──────────────────────

function ModalProduto({
  produto, onFechar, onAdicionar,
}: {
  produto: Produto;
  onFechar: () => void;
  onAdicionar: (quantidade: number) => void;
}) {
  const [quantidade, setQuantidade] = useState(1);

  return (
    <div className="vtc-modal-overlay" onClick={onFechar}>
      <div className="vtc-modal" onClick={e => e.stopPropagation()}>
        <button className="vtc-modal-fechar" onClick={onFechar}><IconX size={16} /></button>

        <div className="vtc-modal-img">
          {produto.imagem
            ? <img src={produto.imagem} alt={produto.nome} />
            : <span className="vtc-produto-img-placeholder">Sem imagem</span>
          }
        </div>

        <div className="vtc-modal-conteudo">
          <h3 className="vtc-modal-nome">{produto.nome}</h3>
          <p className="vtc-modal-desc">{produto.descricao || 'Sem descrição disponível.'}</p>
          {produto.preco && <p className="vtc-modal-preco">R$ {formatarPreco(produto.preco)}</p>}

          <div className="vtc-modal-rodape">
            <div className="vtc-stepper">
              <button className="vtc-stepper-btn" onClick={() => setQuantidade(q => Math.max(1, q - 1))}>
                <IconMinus size={13} />
              </button>
              <span className="vtc-stepper-valor">{quantidade}</span>
              <button className="vtc-stepper-btn" onClick={() => setQuantidade(q => q + 1)}>
                <IconPlus size={13} />
              </button>
            </div>

            <button className="vtc-btn-adicionar" onClick={() => { onAdicionar(quantidade); onFechar(); }}>
              <IconCart size={16} /> Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer do carrinho ────────────────────────────────────────────────────────

function CarrinhoDrawer({
  aberto, itens, totalValor, onFechar, onAlterarQuantidade, onRemover, onFinalizar, finalizando,
}: {
  aberto: boolean;
  itens: { produto: Produto; quantidade: number }[];
  totalValor: number;
  onFechar: () => void;
  onAlterarQuantidade: (id: number, delta: number) => void;
  onRemover: (id: number) => void;
  onFinalizar: () => void;
  finalizando: boolean;
}) {
  if (!aberto) return null;

  return (
    <div className="vtc-drawer-overlay" onClick={onFechar}>
      <aside className="vtc-drawer" onClick={e => e.stopPropagation()}>
        <div className="vtc-drawer-header">
          <h3><IconCart size={18} /> Seu carrinho</h3>
          <button className="vtc-drawer-fechar" onClick={onFechar}><IconX size={16} /></button>
        </div>

        {itens.length === 0 ? (
          <div className="vtc-drawer-vazio">
            <IconCart size={30} />
            <p>Seu carrinho está vazio</p>
          </div>
        ) : (
          <div className="vtc-drawer-lista">
            {itens.map(item => (
              <div className="vtc-drawer-item" key={item.produto.id_produto}>
                <div className="vtc-drawer-item-img">
                  {item.produto.imagem
                    ? <img src={item.produto.imagem} alt={item.produto.nome} />
                    : <span className="vtc-produto-img-placeholder">—</span>
                  }
                </div>
                <div className="vtc-drawer-item-info">
                  <p className="vtc-drawer-item-nome">{item.produto.nome}</p>
                  <p className="vtc-drawer-item-preco">R$ {formatarPreco(item.produto.preco)}</p>
                  <div className="vtc-stepper vtc-stepper-sm">
                    <button className="vtc-stepper-btn" onClick={() => onAlterarQuantidade(item.produto.id_produto, -1)}>
                      <IconMinus size={11} />
                    </button>
                    <span className="vtc-stepper-valor">{item.quantidade}</span>
                    <button className="vtc-stepper-btn" onClick={() => onAlterarQuantidade(item.produto.id_produto, 1)}>
                      <IconPlus size={11} />
                    </button>
                  </div>
                </div>
                <button className="vtc-drawer-item-remover" onClick={() => onRemover(item.produto.id_produto)} title="Remover">
                  <IconX size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {itens.length > 0 && (
          <div className="vtc-drawer-footer">
            <div className="vtc-drawer-total">
              <span>Total</span>
              <strong>R$ {formatarPreco(String(totalValor))}</strong>
            </div>
            <button className="vtc-btn-finalizar" onClick={onFinalizar} disabled={finalizando}>
              {finalizando ? 'Enviando…' : 'Finalizar pedido'}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VitrineCliente({ mercadoId, slug }: VitrineClienteProps) {
  const [dados, setDados]           = useState<VitrineMercado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca]           = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | null>(null);
  const [produtoAberto, setProdutoAberto]   = useState<Produto | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [finalizando, setFinalizando]       = useState(false);
  const [favoritando, setFavoritando]       = useState(false);

  const { toasts, showToast, dismissToast } = useToast();
  const { tema, toggleTema } = useTheme();
  const carrinho = useCarrinho(mercadoId);
  const navigate = useNavigate();
  const refsCategoria = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    async function carregarDados() {
      try {
        const [mercadoData, categoriasData] = await Promise.all([
          api.buscarMercado(mercadoId),
          api.listarCategorias(mercadoId),
        ]);

        const categoriasComProdutos = await Promise.all(
          categoriasData.map(async (cat: { id: number; nome: string }) => {
            try {
              const produtos = await api.listarProdutos(mercadoId, cat.id);
              return { ...cat, produtos };
            } catch {
              return { ...cat, produtos: [] };
            }
          })
        );

        setDados({
          id: mercadoData.mercado.id_mercado,
          nome: mercadoData.mercado.nome,
          descricao: mercadoData.mercado.descricao ?? '',
          logo: mercadoData.mercado.foto_perfil ?? undefined,
          banner: mercadoData.mercado.banner ?? undefined,
          avaliacao: mercadoData.mercado.avaliacao ?? 0,
          favoritado: mercadoData.mercado.favoritado ?? false,
          paleta: mercadoData.mercado.paleta ?? 'classico',
          categorias: categoriasComProdutos,
        });
      } catch (err) {
        console.error('Erro ao carregar vitrine:', err);
        showToast('erro', 'Erro ao carregar dados da vitrine.');
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, [mercadoId]);

  const categoriasFiltradas = useMemo(() => {
    if (!dados) return [];
    const termo = busca.trim().toLowerCase();
    return dados.categorias
      .map(cat => ({
        ...cat,
        produtos: termo
          ? cat.produtos.filter(p => p.nome.toLowerCase().includes(termo))
          : cat.produtos,
      }))
      .filter(cat => cat.produtos.length > 0 || !termo);
  }, [dados, busca]);

  function irParaCategoria(id: number) {
    setCategoriaAtiva(id);
    refsCategoria.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleAbrirProduto(produto: Produto) {
    if (slug) {
      navigate(`/vitrine/${slug}/produto/${produto.id_categoria}/${produto.id_produto}`);
    } else {
      setProdutoAberto(produto);
    }
  }

  function handleAdicionarAoCarrinho(produto: Produto, quantidade: number) {
    carrinho.adicionar(produto, quantidade);
    showToast('sucesso', `${produto.nome} adicionado ao carrinho!`);
  }

  async function handleFavoritar() {
    if (!dados) return;
    const novoValor = !dados.favoritado;
    setDados(prev => (prev ? { ...prev, favoritado: novoValor } : prev));
    setFavoritando(true);
    try {
      await api.favoritarMercado(dados.id, novoValor);
    } catch {
      setDados(prev => (prev ? { ...prev, favoritado: !novoValor } : prev));
      showToast('erro', 'Não foi possível atualizar os favoritos.');
    } finally {
      setFavoritando(false);
    }
  }

  async function handleFinalizarPedido() {
    if (!dados) return;
    setFinalizando(true);
    try {
      await api.criarPedido(dados.id, {
        itens: carrinho.itens.map(i => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade })),
      });
      showToast('sucesso', 'Pedido enviado com sucesso!');
      carrinho.limpar();
      setCarrinhoAberto(false);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao enviar pedido.');
    } finally {
      setFinalizando(false);
    }
  }

  if (carregando || !dados) {
    return (
      <div className="vtc-shell">
        <div className="vtc-loading"><p>Carregando vitrine...</p></div>
      </div>
    );
  }

  const paletaAtual = encontrarPaleta(dados.paleta);
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

  return (
    <div className="vtc-shell" style={estiloPaleta}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="vtc-topbar">
        <div className="vtc-topbar-direita">
          <div className="vtc-topbar-mercado">
            {dados.logo
              ? <img src={dados.logo} alt={dados.nome} className="vtc-topbar-mercado-logo" />
              : <span className="vtc-topbar-mercado-logo vtc-topbar-mercado-logo--placeholder"><IconStore size={13} /></span>
            }
            <span className="vtc-topbar-mercado-nome">{dados.nome}</span>
          </div>
          <ThemeToggle tema={tema} onToggle={toggleTema} />
          <button
            className={`vtc-btn-carrinho ${carrinho.totalItens > 0 ? 'vtc-btn-carrinho--ativo' : ''}`}
            onClick={() => setCarrinhoAberto(true)}
          >
            <IconCart size={17} />
            {carrinho.totalItens > 0 && <span className="vtc-carrinho-badge">{carrinho.totalItens}</span>}
          </button>
        </div>
      </div>

      {/* ── Banner + Header ───────────────────────────────────────────── */}
      <div className="vtc-banner">
        {dados.banner
          ? <img src={dados.banner} alt="" className="vtc-banner-img" />
          : <div className="vtc-banner-fallback" />
        }
      </div>

      <header className="vtc-header">
        <div className="vtc-header-identity">
          <div className="vtc-logo">
            {dados.logo
              ? <img src={dados.logo} alt={dados.nome} className="vtc-logo-img" />
              : <div className="vtc-logo-placeholder"><IconStore size={26} /></div>
            }
          </div>

          <div className="vtc-header-text">
            <div className="vtc-header-nome-wrap">
              <h1 className="vtc-nome-mercado">{dados.nome}</h1>
              <button
                className={`vtc-btn-favoritar ${dados.favoritado ? 'vtc-btn-favoritar--ativo' : ''}`}
                onClick={handleFavoritar}
                disabled={favoritando}
                title={dados.favoritado ? 'Remover dos favoritos' : 'Favoritar mercado'}
              >
                <IconHeart size={16} filled={!!dados.favoritado} />
              </button>
            </div>
            <p className="vtc-desc-mercado">{dados.descricao}</p>
            <div className="vtc-avaliacao">
              {Array.from({ length: 5 }, (_, i) => (
                <IconStar key={i} size={13} filled={i < Math.round(dados.avaliacao ?? 0)} />
              ))}
              <span>{(dados.avaliacao ?? 0).toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Busca */}
        <div className="vtc-busca-wrap">
          <IconSearch size={15} />
          <input
            className="vtc-busca-input"
            placeholder="Buscar produtos nesta loja..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Tags de categoria */}
        {dados.categorias.length > 0 && (
          <div className="vtc-tags-row">
            {dados.categorias.map(cat => (
              <button
                key={cat.id}
                className={`vtc-tag ${categoriaAtiva === cat.id ? 'active' : ''}`}
                onClick={() => irParaCategoria(cat.id)}
              >
                {cat.nome}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Categorias e produtos ─────────────────────────────────────── */}
      <main className="vtc-main">
        {categoriasFiltradas.length === 0 ? (
          <div className="vtc-vazio">
            <span className="vtc-vazio-icone"><IconStore size={26} /></span>
            <p className="vtc-vazio-titulo">Nenhum produto encontrado</p>
            <p className="vtc-vazio-sub">
              {busca ? 'Tente buscar por outro termo.' : 'Esta loja ainda não cadastrou produtos.'}
            </p>
          </div>
        ) : (
          categoriasFiltradas.map(cat => (
            <section
              className="vtc-categoria"
              key={cat.id}
              ref={el => { refsCategoria.current[cat.id] = el; }}
            >
              <h2 className="vtc-categoria-titulo">{cat.nome}</h2>
              <div className="vtc-produtos-grid">
                {cat.produtos.map(p => (
                  <ProdutoCardCliente key={p.id_produto} produto={p} onAbrir={() => handleAbrirProduto(p)} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* ── Modal de produto (fallback sem slug/rota) ───────────────────── */}
      {produtoAberto && (
        <ModalProduto
          produto={produtoAberto}
          onFechar={() => setProdutoAberto(null)}
          onAdicionar={(qtd) => handleAdicionarAoCarrinho(produtoAberto, qtd)}
        />
      )}

      {/* ── Carrinho ──────────────────────────────────────────────────── */}
      <CarrinhoDrawer
        aberto={carrinhoAberto}
        itens={carrinho.itens}
        totalValor={carrinho.totalValor}
        onFechar={() => setCarrinhoAberto(false)}
        onAlterarQuantidade={carrinho.alterarQuantidade}
        onRemover={carrinho.remover}
        onFinalizar={handleFinalizarPedido}
        finalizando={finalizando}
      />

      {/* ── FAB carrinho (mobile) ────────────────────────────────────── */}
      {carrinho.totalItens > 0 && (
        <button className="vtc-fab-carrinho" onClick={() => setCarrinhoAberto(true)}>
          <IconCart size={20} />
          <span>{carrinho.totalItens} {carrinho.totalItens === 1 ? 'item' : 'itens'} · R$ {formatarPreco(String(carrinho.totalValor))}</span>
        </button>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}