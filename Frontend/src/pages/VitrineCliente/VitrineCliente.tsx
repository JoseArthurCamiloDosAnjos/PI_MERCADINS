import { useState, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import './VitrineCliente.css';
import ToastContainer from '../../components/Toast';
import DescricaoModal from '../../components/DescricaoModal';
import AvaliacoesModal from '../../components/AvaliacoesModal';
import { useToast } from '../../hooks/useToast';
import { removeEmojis } from '../../hooks/useBlockEmojis';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ProfileMenu from '../../components/ProfileMenu';
import CarrinhoSidebar from '../../components/CarrinhoSidebar/CarrinhoSidebar';
import { resolverPaleta } from '../../components/EscolherPaleta';
import {
  IconStore,
  IconArrowLeft,
} from '../../components/Icons';
import { useCarrinho } from '../../hooks/useCarrinho';

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
// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id_produto: number;
  imagem?: string;
  imagens?: string[];
  nome: string;
  descricao: string;
  preco?: string;
  id_categoria: number;
}

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
  corBase?: string;
  corDestaque?: string;
  corTexto?: string;
  corTextoSec?: string;
  corIcones?: string;
  /** Tipos de loja declarados no cadastro (ex.: Hortifruti, Padaria) */
  tipos?: string[];
  categorias: Categoria[];
}

interface VitrineClienteProps {
  mercadoId: number;
  slug?: string;
  onVoltar?: () => void;
}

/** Tipos de loja vindo do banco (lista ou "{mercado,padaria}") */
function normalizarTipos(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === "string") return valor.replace(/[{}"]/g, "").split(",").filter(Boolean);
  return [];
}

const NOMES_TIPOS: Record<string, string> = {
  mercado: "Mercado",
  hortifruti: "Hortifruti",
  acougue: "Açougue",
  padaria: "Padaria",
  bebidas: "Bebidas",
  organicos: "Orgânicos",
  conveniencia: "Conveniência",
};

function formatarPreco(valor?: string) {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return valor ?? '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── ProdutoCard (cliente) ─────────────────────────────────────────────────────

function ProdutoCardCliente({
  produto,
  slug,
  categoriaId,
  onAbrir,
}: {
  produto: Produto;
  slug?: string;
  categoriaId: number;
  onAbrir?: () => void;
}) {
  const navigate = useNavigate();

  const imagens = useMemo(() => {
    if (produto.imagens && produto.imagens.length > 0) return produto.imagens;
    if (produto.imagem) return [produto.imagem];
    return [];
  }, [produto.imagens, produto.imagem]);

  const [imgIdx, setImgIdx] = useState(0);

  function handleClick() {
    if (slug) {
      navigate(`/vitrine/${slug}/produto/${categoriaId}/${produto.id_produto}`);
    } else {
      onAbrir?.();
    }
  }

  function slide(dir: 'prev' | 'next') {
    setImgIdx(prev =>
      dir === 'prev'
        ? (prev - 1 + imagens.length) % imagens.length
        : (prev + 1) % imagens.length
    );
  }

  return (
    <button className="vtc-produto-card" onClick={handleClick}>
      <div className="vtc-produto-img">
        {imagens.length > 0
          ? (
            <>
              <img src={imagens[imgIdx]} alt={produto.nome} />
              {imagens.length > 1 && (
                <>
                  <button className="vtc-card-seta vtc-card-seta--prev" onClick={(e) => { e.stopPropagation(); slide('prev'); }} aria-label="Imagem anterior">‹</button>
                  <button className="vtc-card-seta vtc-card-seta--next" onClick={(e) => { e.stopPropagation(); slide('next'); }} aria-label="Próxima imagem">›</button>
                  <span className="vtc-card-counter">{imgIdx + 1}/{imagens.length}</span>
                </>
              )}
            </>
          )
          : <span className="vtc-produto-img-placeholder">Sem imagem</span>
        }
      </div>
      <div className="vtc-produto-info">
        <p className="vtc-produto-nome">{produto.nome}</p>
        {produto.preco && <p className="vtc-produto-preco">R$ {formatarPreco(produto.preco)}</p>}
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VitrineCliente({ mercadoId, slug, onVoltar }: VitrineClienteProps) {
  const navigate = useNavigate();
  const shellRef = useRef<HTMLDivElement>(null);
  const [dados, setDados]           = useState<VitrineMercado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca]           = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<number | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [favoritando, setFavoritando]       = useState(false);
  const [modalDescricao, setModalDescricao] = useState(false);
  const [modalAvaliacoes, setModalAvaliacoes] = useState(false);

  const { toasts, showToast, dismissToast } = useToast();
  const { tema } = useTheme();
  const { usuario } = useAuth();
  const carrinho = useCarrinho(mercadoId);
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
          corBase: mercadoData.mercado.cor_base ?? undefined,
          corDestaque: mercadoData.mercado.cor_destaque ?? undefined,
          corTexto: mercadoData.mercado.cor_texto ?? undefined,
          corTextoSec: mercadoData.mercado.cor_texto_sec ?? undefined,
          corIcones: mercadoData.mercado.cor_icones ?? undefined,
          tipos: normalizarTipos(mercadoData.mercado.categorias),
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

  // Garante que a tela sempre comece do topo depois que os dados (e categorias)
  // terminam de carregar — evita que a logo/nome apareçam cortados por trás da
  // topbar quando o navegador reancora o scroll com múltiplas categorias/imagens.
  // Usamos requestAnimationFrame (duas vezes) em vez de rodar direto, porque o
  // reset precisa acontecer DEPOIS que o navegador termina de calcular o layout
  // final da página — inclusive em navegadores como Safari, que não têm a
  // propriedade overflow-anchor e por isso não respeitam esse CSS sozinho.
  useEffect(() => {
    if (carregando || !dados) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        shellRef.current?.scrollTo({ top: 0 });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [carregando, dados]);

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

  async function handleFavoritar() {
    if (!dados) return;
    // Favoritar é por perfil: exige usuário logado
    if (!usuario) {
      showToast('erro', 'Faça login para favoritar esta loja.');
      navigate('/auth');
      return;
    }
    const novoValor = !dados.favoritado;
    setDados(prev => (prev ? { ...prev, favoritado: novoValor } : prev));
    setFavoritando(true);
    try {
      await api.favoritarMercado(dados.id, novoValor);
      showToast('sucesso', novoValor
        ? `${dados.nome} adicionada aos favoritos!`
        : `${dados.nome} removida dos favoritos.`);
    } catch {
      setDados(prev => (prev ? { ...prev, favoritado: !novoValor } : prev));
      showToast('erro', 'Não foi possível atualizar os favoritos.');
    } finally {
      setFavoritando(false);
    }
  }

  if (carregando || !dados) {
    const paletaPadrao = resolverPaleta();
    const estiloPaletaPadrao = {
      '--vt-azul-escuro': paletaPadrao.cores.azulEscuro,
      '--vt-azul-medio': paletaPadrao.cores.azulMedio,
      '--vt-azul-claro': paletaPadrao.cores.azulClaro,
      '--vt-azul-bg': paletaPadrao.cores.azulBg,
      '--vt-azul-card': paletaPadrao.cores.azulCard,
      '--vt-azul-borda': paletaPadrao.cores.azulBorda,
      '--vt-azul-item': paletaPadrao.cores.azulItem,
      '--vt-amarelo': paletaPadrao.cores.amarelo,
      '--vt-amarelo-hover': paletaPadrao.cores.amareloHover,
      '--vt-cor-texto': paletaPadrao.cores.corTexto,
      '--vt-cor-texto-sec': paletaPadrao.cores.corTextoSec,
      '--vt-cor-icones': paletaPadrao.cores.corIcones,
    } as CSSProperties;
    return (
      <div className="vtc-shell" ref={shellRef} data-tema={tema} style={estiloPaletaPadrao}>
        <div className="vtc-loading"><p>Carregando vitrine...</p></div>
      </div>
    );
  }

  const paletaAtual = resolverPaleta(dados.paleta, dados.corBase, dados.corDestaque, dados.corTexto, dados.corTextoSec, dados.corIcones);
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
    '--vt-cor-texto': paletaAtual.cores.corTexto,
    '--vt-cor-texto-sec': paletaAtual.cores.corTextoSec,
    '--vt-cor-icones': paletaAtual.cores.corIcones,
  } as CSSProperties;

  return (
    <div className="vtc-shell" ref={shellRef} data-tema={tema} style={estiloPaleta}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="vtc-topbar">
        <button
          className="vtc-btn-voltar"
          onClick={() => {
            if (onVoltar) onVoltar();
            else navigate('/');
          }}
        >
          <IconArrowLeft size={16} />
          <span>Voltar ao menu</span>
        </button>
        <div className="vtc-topbar-direita">
          {usuario ? (
            <ProfileMenu />
          ) : (
            <button className="vtc-btn-entrar" onClick={() => navigate('/auth')}>
              Entrar
            </button>
          )}
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
            <p className="vtc-desc-mercado">
              {dados.descricao && dados.descricao.length > 100
                ? <>{dados.descricao.slice(0, 100)}... <button className="vtc-btn-leia-mais" onClick={() => setModalDescricao(true)}>Leia mais</button></>
                : dados.descricao
              }
            </p>
            <button
              className="vtc-avaliacao vtc-avaliacao-btn"
              onClick={() => setModalAvaliacoes(true)}
              title="Ver avaliações e avaliar esta loja"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <IconStar key={i} size={13} filled={i < Math.round(dados.avaliacao ?? 0)} />
              ))}
              <span>{(dados.avaliacao ?? 0).toFixed(1)}</span>
              <em className="vtc-avaliacao-cta">· Avaliar</em>
            </button>

            {dados.tipos && dados.tipos.length > 0 && (
              <div className="vtc-tipos">
                {dados.tipos.map(tipo => (
                  <span key={tipo} className="vtc-tipo-chip">
                    {NOMES_TIPOS[tipo] ?? tipo}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Busca */}
        <div className="vtc-busca-wrap">
          <IconSearch size={15} />
          <input
            className="vtc-busca-input"
            placeholder="Buscar produtos nesta loja..."
            value={busca}
            onChange={e => setBusca(removeEmojis(e.target.value))}
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
                  <ProdutoCardCliente
                    key={p.id_produto}
                    produto={p}
                    slug={slug}
                    categoriaId={cat.id}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* ── Carrinho (sidebar lateral) ───────────────────────────────── */}
      <CarrinhoSidebar
        aberto={carrinhoAberto}
        onFechar={() => setCarrinhoAberto(false)}
        carrinho={carrinho}
        onIrParaCarrinho={() => {
          setCarrinhoAberto(false);
          if (slug) navigate(`/vitrine/${slug}/carrinho`);
        }}
        storeName={dados.nome}
        tema={tema}
      />

      {/* ── FAB carrinho (mobile) ────────────────────────────────────── */}
      {carrinho.totalItens > 0 && (
        <button className="vtc-fab-carrinho" onClick={() => setCarrinhoAberto(true)}>
          <IconCart size={20} />
          <span>{carrinho.totalItens} {carrinho.totalItens === 1 ? 'item' : 'itens'} · R$ {formatarPreco(String(carrinho.totalValor))}</span>
        </button>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {modalDescricao && (
        <DescricaoModal
          titulo={dados.nome}
          descricao={dados.descricao}
          onFechar={() => setModalDescricao(false)}
        />
      )}

      {modalAvaliacoes && (
        <AvaliacoesModal
          mercadoId={dados.id}
          onFechar={() => setModalAvaliacoes(false)}
          onAtualizar={media => setDados(d => (d ? { ...d, avaliacao: media } : d))}
        />
      )}
    </div>
  );
}