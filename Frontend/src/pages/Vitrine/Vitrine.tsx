import { useState, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import './Vitrine.css';
import CadastroProduto  from '../../components/CadastroProduto';
import EditarMercado    from '../../components/EditarMercado';
import CriarCategoria   from '../../components/CriarCategoria';
import ConfirmarSaida   from '../../components/ConfirmarSaida';
import ToastContainer   from '../../components/Toast';
import EscolherPaleta, { resolverPaleta, IconPaleta } from '../../components/EscolherPaleta';
import { useToast }     from '../../hooks/useToast';
import { api }          from '../../services/api';
import { useTheme }     from '../../context/ThemeContext';
import ThemeToggle      from '../../components/ThemeToggle';
import {
  IconStore,
  IconPlus,
  IconPencil,
  IconCheck,
  IconX,
  IconArrowLeft,
} from '../../components/Icons';

// ─── Ícones locais (mesmos usados na VitrineCliente) ──────────────────────────

function IconSearch({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
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
  paleta: string;
  corBase?: string;
  corDestaque?: string;
  categorias: Categoria[];
}

interface VitrineProps {
  mercadoId?: number;
  onVoltar?: () => void;
}

interface ProdutoForm {
  nome: string;
  descricao: string;
  preco: string;
  imagens: string[];
  categoriaId: number;
}

// ─── Placeholder — sem categoria de exemplo ───────────────────────────────────

const MERCADO_PLACEHOLDER: VitrineMercado = {
  id: 0,
  nome: 'Nome do mercado',
  descricao: 'Descrição do mercado',
  paleta: 'classico',
  categorias: [],
};

// ─── useProdutos ──────────────────────────────────────────────────────────────

function useProdutos(mercadoId: number, categoriaId: number, inicial: Produto[]) {
  const [produtos, setProdutos]     = useState<Produto[]>(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const abortRef                    = useRef(false);

  useEffect(() => {
    if (mercadoId === 0) return;
    abortRef.current = false;

    const carregar = async () => {
      try {
        const dados: Produto[] = await api.listarProdutos(mercadoId, categoriaId);
        if (!abortRef.current) { setProdutos(dados); setCarregando(false); }
      } catch (e: unknown) {
        if (!abortRef.current) {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar produtos.');
          setCarregando(false);
        }
      }
    };

    queueMicrotask(() => { if (!abortRef.current) setCarregando(true); });
    carregar();
    return () => { abortRef.current = true; };
  }, [mercadoId, categoriaId]);

  return { produtos, setProdutos, carregando, erro };
}

function formatarPreco(valor?: string) {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return valor ?? '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── ProdutoCard ──────────────────────────────────────────────────────────────

function ProdutoCard({ produto }: { produto: Produto }) {
  return (
    <div className="vt-produto-card">
      <div className="vt-produto-img">
        {produto.imagem
          ? <img src={produto.imagem} alt={produto.nome} />
          : <span className="vt-produto-img-placeholder">Sem imagem</span>
        }
      </div>
      <div className="vt-produto-info">
        <p className="vt-produto-nome">{produto.nome}</p>
        {produto.preco && <p className="vt-produto-preco">R$ {formatarPreco(produto.preco)}</p>}
      </div>
    </div>
  );
}

function ProdutoAddCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button className="vt-produto-card vt-produto-add" onClick={onAdd}>
      <span className="vt-add-icon"><IconPlus size={20} /></span>
    </button>
  );
}

// ─── EditarNomeCategoria — inline ─────────────────────────────────────────────

interface EditarNomeCategoriaProps {
  nome: string;
  onSalvar: (novoNome: string) => void;
  onCancelar: () => void;
}

function EditarNomeCategoria({ nome, onSalvar, onCancelar }: EditarNomeCategoriaProps) {
  const [valor, setValor] = useState(nome);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  function confirmar() {
    const limpo = valor.trim();
    if (!limpo) return;
    onSalvar(limpo);
  }

  return (
    <div className="vt-categoria-editar-wrap">
      <input
        ref={inputRef}
        className="vt-categoria-editar-input"
        value={valor}
        maxLength={100}
        onChange={e => setValor(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') confirmar();
          if (e.key === 'Escape') onCancelar();
        }}
      />
      <button className="vt-categoria-editar-ok" onClick={confirmar} title="Confirmar">
        <IconCheck size={14} />
      </button>
      <button className="vt-categoria-editar-cancel" onClick={onCancelar} title="Cancelar">
        <IconX size={14} />
      </button>
    </div>
  );
}

// ─── CategoriaSection ─────────────────────────────────────────────────────────

interface CategoriaSectionProps {
  categoria: Categoria;
  mercadoId: number;
  filtro: string;
  onAlterado: () => void;
  onErroProduto: (msg: string) => void;
  onRenomear: (categoriaId: number, novoNome: string) => void;
  sectionRef: (el: HTMLElement | null) => void;
}

function CategoriaSection({
  categoria, mercadoId, filtro, onAlterado, onErroProduto, onRenomear, sectionRef,
}: CategoriaSectionProps) {
  const { produtos, setProdutos, carregando, erro } =
    useProdutos(mercadoId, categoria.id, categoria.produtos);

  const [modalAberto, setModalAberto]   = useState(false);
  const [salvando, setSalvando]         = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);

  async function handleSalvar(dados: ProdutoForm) {
    if (mercadoId === 0) {
      setProdutos(prev => [...prev, {
        id_produto: Date.now(), nome: dados.nome, descricao: dados.descricao,
        preco: dados.preco, imagem: dados.imagens[0] ?? undefined, id_categoria: dados.categoriaId,
      }]);
      setModalAberto(false);
      onAlterado();
      return;
    }

    setSalvando(true);
    try {
      const precoNum = Number(dados.preco.replace(/\./g, '').replace(',', '.'));
      const novo: Produto = await api.criarProduto(mercadoId, categoria.id, {
        nome: dados.nome, descricao: dados.descricao,
        imagem: dados.imagens[0] ?? null,
        imagens: dados.imagens.length > 0 ? dados.imagens : undefined,
        preco: Number.isFinite(precoNum) ? precoNum : 0,
      });
      setProdutos(prev => [...prev, novo]);
      setModalAberto(false);
      onAlterado();
    } catch (e: unknown) {
      onErroProduto(e instanceof Error ? e.message : 'Erro ao salvar produto.');
    } finally {
      setSalvando(false);
    }
  }

  function handleRenomear(novoNome: string) {
    setEditandoNome(false);
    onRenomear(categoria.id, novoNome);
  }

  const termo = filtro.trim().toLowerCase();
  const produtosFiltrados = termo
    ? produtos.filter(p => p.nome.toLowerCase().includes(termo))
    : produtos;

  // Esconde a categoria inteira se estiver buscando e nada bater
  if (termo && !carregando && produtosFiltrados.length === 0) return null;

  return (
    <>
      <section className="vt-categoria" ref={sectionRef}>

        {/* Título com botão de editar */}
        <div className="vt-categoria-header">
          {editandoNome
            ? (
              <EditarNomeCategoria
                nome={categoria.nome}
                onSalvar={handleRenomear}
                onCancelar={() => setEditandoNome(false)}
              />
            ) : (
              <>
                <h2 className="vt-categoria-titulo">{categoria.nome}</h2>
                <button
                  className="vt-categoria-btn-editar"
                  onClick={() => setEditandoNome(true)}
                  title="Renomear categoria"
                >
                  <IconPencil size={13} />
                </button>
              </>
            )
          }
        </div>

        {erro && <p className="vt-erro-inline">{erro}</p>}

        <div className="vt-produtos-grid">
          {carregando
            ? <span className="vt-carregando">Carregando produtos…</span>
            : produtosFiltrados.map(p => <ProdutoCard key={p.id_produto} produto={p} />)
          }
          {!termo && <ProdutoAddCard onAdd={() => setModalAberto(true)} />}
        </div>
      </section>

      {modalAberto && (
        <CadastroProduto
          categoriaId={categoria.id}
          salvando={salvando}
          onSalvar={handleSalvar}
          onCancelar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}

// ─── Tela vazia — sem categorias ──────────────────────────────────────────────

function TelaVazia({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="vt-vazio">
      <span className="vt-vazio-icone"><IconStore size={26} /></span>
      <p className="vt-vazio-titulo">Sua vitrine está vazia</p>
      <p className="vt-vazio-sub">Crie uma categoria para começar a adicionar produtos</p>
      <button className="vt-vazio-btn" onClick={onCriar}>
        <IconPlus size={15} /> Nova categoria
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Vitrine({ mercadoId, onVoltar }: VitrineProps) {
  const [dados, setDados]                         = useState<VitrineMercado>(MERCADO_PLACEHOLDER);
  const [temAlteracoes, setTemAlteracoes]         = useState(false);
  const [salvandoVitrine, setSalvandoVitrine]     = useState(false);
  const [modalEditar, setModalEditar]             = useState(false);
  const [modalCategoria, setModalCategoria]       = useState(false);
  const [modalSaida, setModalSaida]               = useState(false);
  const [modalPaleta, setModalPaleta]             = useState(false);
  const [salvandoMercado, setSalvandoMercado]     = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [carregando, setCarregando]               = useState(!!mercadoId);
  const [busca, setBusca]                         = useState('');
  const [categoriaAtiva, setCategoriaAtiva]       = useState<number | null>(null);
  const acaoAoSair                                = useRef<'voltar' | 'fechar' | null>(null);
  const refsCategoria                             = useRef<Record<number, HTMLElement | null>>({});

  const { toasts, showToast, dismissToast } = useToast();
  const { tema, toggleTema } = useTheme();

  // ── Carregar dados do banco ───────────────────────────────────────────────

  useEffect(() => {
    if (!mercadoId) return;

    async function carregarDados() {
      try {
        const [mercadoData, categoriasData] = await Promise.all([
          api.buscarMercado(mercadoId!),
          api.listarCategorias(mercadoId!),
        ]);

        // Carregar produtos de cada categoria
        const categoriasComProdutos = await Promise.all(
          categoriasData.map(async (cat: { id: number; nome: string }) => {
            try {
              const produtos = await api.listarProdutos(mercadoId!, cat.id);
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
          paleta: mercadoData.mercado.paleta ?? 'classico',
          corBase: mercadoData.mercado.cor_base ?? undefined,
          corDestaque: mercadoData.mercado.cor_destaque ?? undefined,
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

  const paletaAtual = useMemo(
    () => resolverPaleta(dados.paleta, dados.corBase, dados.corDestaque),
    [dados.paleta, dados.corBase, dados.corDestaque]
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

  // ── Intercepta saída ─────────────────────────────────────────────────────

  function tentarSair(acao: 'voltar' | 'fechar') {
    if (temAlteracoes) {
      acaoAoSair.current = acao;
      setModalSaida(true);
    } else {
      executarSaida(acao);
    }
  }

  function executarSaida(acao: 'voltar' | 'fechar') {
    if (acao === 'voltar' && onVoltar) onVoltar();
  }

  function irParaCategoria(id: number) {
    setCategoriaAtiva(id);
    refsCategoria.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Salvar vitrine ────────────────────────────────────────────────────────

  async function salvarVitrine(): Promise<boolean> {
    if (!dados.id || dados.id === 0) {
      showToast('erro', 'Salve o mercado primeiro antes de salvar a vitrine.');
      return false;
    }
    try {
      await api.atualizarMercado(dados.id, {
        nome: dados.nome,
        descricao: dados.descricao,
        paleta: dados.paleta,
        cor_base: dados.corBase ?? '',
        cor_destaque: dados.corDestaque ?? '',
      });
      setTemAlteracoes(false);
      showToast('sucesso', 'Vitrine salva com sucesso!');
      return true;
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao salvar vitrine.');
      return false;
    }
  }

  async function handleSalvarVitrine() {
    setSalvandoVitrine(true);
    await salvarVitrine();
    setSalvandoVitrine(false);
  }

  async function handleSalvarESair() {
    setSalvandoVitrine(true);
    const ok = await salvarVitrine();
    setSalvandoVitrine(false);
    if (ok) { setModalSaida(false); executarSaida(acaoAoSair.current ?? 'voltar'); }
  }

  function handleSairSemSalvar() {
    setTemAlteracoes(false);
    setModalSaida(false);
    executarSaida(acaoAoSair.current ?? 'voltar');
  }

  // ── Paleta de cores ───────────────────────────────────────────────────────

  function handleSelecionarPaleta(paletaId: string) {
    setDados(prev => ({ ...prev, paleta: paletaId }));
    setTemAlteracoes(true);
  }

  function handleSelecionarPaletaPersonalizada(corBase: string, corDestaque: string) {
    setDados(prev => ({ ...prev, paleta: 'personalizada', corBase, corDestaque }));
    setTemAlteracoes(true);
  }

  // ── Editar mercado ────────────────────────────────────────────────────────

  async function handleSalvarMercado(form: { nome: string; descricao: string; logo?: string }) {
    if (!dados.id || dados.id === 0) {
      setDados(prev => ({ ...prev, ...form }));
      setModalEditar(false);
      setTemAlteracoes(true);
      showToast('info', 'Alterações pendentes — clique em Salvar vitrine.');
      return;
    }
    setSalvandoMercado(true);
    try {
      await api.atualizarMercado(dados.id, {
        nome: form.nome,
        descricao: form.descricao,
        paleta: dados.paleta,
        cor_base: dados.corBase ?? '',
        cor_destaque: dados.corDestaque ?? '',
      });
      setDados(prev => ({ ...prev, ...form }));
      setModalEditar(false);
      setTemAlteracoes(true);
      showToast('sucesso', 'Mercado atualizado com sucesso!');
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao atualizar mercado.');
    } finally {
      setSalvandoMercado(false);
    }
  }

  // ── Criar categoria ───────────────────────────────────────────────────────

  async function handleCriarCategoria(nome: string) {
    if (!dados.id || dados.id === 0) {
      showToast('erro', 'Salve o mercado primeiro antes de criar categorias.');
      return;
    }
    setSalvandoCategoria(true);
    try {
      const nova = await api.criarCategoria(dados.id, { nome });
      setDados(prev => ({ ...prev, categorias: [...prev.categorias, { ...nova, produtos: [] }] }));
      setModalCategoria(false);
      setTemAlteracoes(true);
      showToast('sucesso', 'Categoria criada com sucesso!');
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao criar categoria.');
    } finally {
      setSalvandoCategoria(false);
    }
  }

  // ── Renomear categoria ────────────────────────────────────────────────────

  async function handleRenomear(categoriaId: number, novoNome: string) {
    setDados(prev => ({
      ...prev,
      categorias: prev.categorias.map(c =>
        c.id === categoriaId ? { ...c, nome: novoNome } : c
      ),
    }));
    setTemAlteracoes(true);

    if (dados.id && dados.id !== 0) {
      try {
        await api.atualizarCategoria(dados.id, categoriaId, { nome: novoNome });
        showToast('sucesso', 'Categoria renomeada!');
      } catch (e: unknown) {
        showToast('erro', e instanceof Error ? e.message : 'Erro ao renomear categoria.');
      }
    }
  }

  if (carregando) {
    return (
      <div className="vt-shell">
        <div className="vt-loading"><p>Carregando vitrine...</p></div>
      </div>
    );
  }

  return (
    <div className="vt-shell" data-tema={tema} style={estiloPaleta}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="vt-topbar">
        {onVoltar
          ? (
            <button className="vt-btn-voltar" onClick={() => tentarSair('voltar')}>
              <IconArrowLeft size={15} /> Voltar ao Gerenciamento
            </button>
          )
          : <span />
        }

        <div className="vt-topbar-direita">
          <div className="vt-topbar-mercado">
            {dados.logo
              ? <img src={dados.logo} alt={dados.nome} className="vt-topbar-mercado-logo" />
              : <span className="vt-topbar-mercado-logo vt-topbar-mercado-logo--placeholder"><IconStore size={13} /></span>
            }
            <span className="vt-topbar-mercado-nome">{dados.nome}</span>
          </div>

          <ThemeToggle tema={tema} onToggle={toggleTema} />

          <button className="vt-btn-paleta" onClick={() => setModalPaleta(true)} title="Personalizar cores">
            <IconPaleta size={14} /> Cores
          </button>

          {temAlteracoes && (
            <button
              className={`vt-btn-salvar ${salvandoVitrine ? 'vt-btn-salvar--carregando' : ''}`}
              onClick={handleSalvarVitrine}
              disabled={salvandoVitrine}
            >
              {salvandoVitrine
                ? <><span className="vt-btn-salvar-spinner" /> Salvando…</>
                : <><IconCheck size={14} /> Salvar vitrine</>
              }
            </button>
          )}
        </div>
      </div>

      {/* ── Banner ────────────────────────────────────────────────────── */}
      <div className="vt-banner">
        {dados.banner
          ? <img src={dados.banner} alt="" className="vt-banner-img" />
          : <div className="vt-banner-fallback" />
        }
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="vt-header">
        <div className="vt-header-identity">
          <button className="vt-logo-btn" onClick={() => setModalEditar(true)} title="Alterar logo">
            {dados.logo
              ? <img src={dados.logo} alt={dados.nome} className="vt-logo-img" />
              : <div className="vt-logo-placeholder"><IconPlus size={22} /></div>
            }
            <span className="vt-logo-edit-overlay"><IconPencil size={12} /></span>
          </button>

          <div className="vt-header-text">
            <div className="vt-header-nome-wrap">
              <h1 className="vt-nome-mercado">{dados.nome}</h1>
              <button className="vt-btn-editar" onClick={() => setModalEditar(true)}>
                <IconPencil size={12} /> Editar
              </button>
            </div>
            <p className="vt-desc-mercado">{dados.descricao}</p>
          </div>
        </div>

        {/* Busca */}
        <div className="vt-busca-wrap">
          <IconSearch size={15} />
          <input
            className="vt-busca-input"
            placeholder="Buscar produtos na sua vitrine..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Tags de categoria — navegação rápida */}
        {dados.categorias.length > 0 && (
          <div className="vt-tags-row">
            {dados.categorias.map(cat => (
              <button
                key={cat.id}
                className={`vt-tag ${categoriaAtiva === cat.id ? 'active' : ''}`}
                onClick={() => irParaCategoria(cat.id)}
              >
                {cat.nome}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Categorias ────────────────────────────────────────────────── */}
      <main className="vt-main">
        {dados.categorias.length === 0
          ? <TelaVazia onCriar={() => setModalCategoria(true)} />
          : dados.categorias.map(cat => (
              <CategoriaSection
                key={cat.id}
                categoria={cat}
                mercadoId={dados.id}
                filtro={busca}
                onAlterado={() => setTemAlteracoes(true)}
                onErroProduto={(msg) => showToast('erro', msg)}
                onRenomear={handleRenomear}
                sectionRef={el => { refsCategoria.current[cat.id] = el; }}
              />
            ))
        }

        {dados.categorias.length > 0 && (
          <div className="vt-fab-wrap">
            <button className="vt-fab" onClick={() => setModalCategoria(true)} title="Adicionar categoria">
              <IconPlus size={24} />
            </button>
          </div>
        )}
      </main>

      {/* ── Modais ────────────────────────────────────────────────────── */}
      {modalEditar && (
        <EditarMercado
          nome={dados.nome}
          descricao={dados.descricao}
          logo={dados.logo}
          salvando={salvandoMercado}
          onSalvar={handleSalvarMercado}
          onCancelar={() => setModalEditar(false)}
        />
      )}

      {modalCategoria && (
        <CriarCategoria
          salvando={salvandoCategoria}
          onSalvar={handleCriarCategoria}
          onCancelar={() => setModalCategoria(false)}
        />
      )}

      {modalSaida && (
        <ConfirmarSaida
          salvando={salvandoVitrine}
          onSalvarESair={handleSalvarESair}
          onSairSemSalvar={handleSairSemSalvar}
          onCancelar={() => setModalSaida(false)}
        />
      )}

      {modalPaleta && (
        <EscolherPaleta
          paletaAtual={dados.paleta}
          corBaseAtual={dados.corBase}
          corDestaqueAtual={dados.corDestaque}
          onSelecionar={handleSelecionarPaleta}
          onSelecionarPersonalizada={handleSelecionarPaletaPersonalizada}
          onFechar={() => setModalPaleta(false)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}