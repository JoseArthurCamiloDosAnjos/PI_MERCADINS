import { useState, useEffect, useRef } from 'react';
import './Vitrine.css';
import CadastroProduto  from '../../components/CadastroProduto';
import EditarMercado    from '../../components/EditarMercado';
import CriarCategoria   from '../../components/CriarCategoria';
import ConfirmarSaida   from '../../components/ConfirmarSaida';
import ToastContainer   from '../../components/Toast';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id_produto: number;
  imagem?: string;
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
  nome: string;
  descricao: string;
  categorias: Categoria[];
  banner?: string;
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

// ─── ProdutoCard ──────────────────────────────────────────────────────────────

function ProdutoCard({ produto }: { produto: Produto }) {
  return (
    <div className="vt-produto-card">
      <div className="vt-produto-img">
        {produto.imagem
          ? <img src={produto.imagem} alt={produto.nome} />
          : <span className="vt-produto-img-placeholder">Imagem do produto</span>
        }
      </div>
      <div className="vt-produto-info">
        <p className="vt-produto-nome">{produto.nome}</p>
        <p className="vt-produto-desc">{produto.descricao || 'Sem descrição'}</p>
        {produto.preco && <p className="vt-produto-preco">R$ {produto.preco}</p>}
      </div>
    </div>
  );
}

function ProdutoAddCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button className="vt-produto-card vt-produto-add" onClick={onAdd}>
      <span className="vt-add-icon"><IconPlus size={24} /></span>
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
  onAlterado: () => void;
  onErroProduto: (msg: string) => void;
  onRenomear: (categoriaId: number, novoNome: string) => void;
}

function CategoriaSection({
  categoria, mercadoId, onAlterado, onErroProduto, onRenomear,
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
      const novo: Produto = await api.criarProduto(mercadoId, categoria.id, {
        nome: dados.nome, descricao: dados.descricao, imagem: dados.imagens[0] ?? null,
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

  return (
    <>
      <section className="vt-categoria">

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
            : produtos.map(p => <ProdutoCard key={p.id_produto} produto={p} />)
          }
          <ProdutoAddCard onAdd={() => setModalAberto(true)} />
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
  const [salvandoMercado, setSalvandoMercado]     = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [carregando, setCarregando]               = useState(!!mercadoId);
  const acaoAoSair                                = useRef<'voltar' | 'fechar' | null>(null);

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

  // ── Salvar vitrine ────────────────────────────────────────────────────────

  async function salvarVitrine(): Promise<boolean> {
    if (!dados.id || dados.id === 0) {
      showToast('erro', 'Salve o mercado primeiro antes de salvar a vitrine.');
      return false;
    }
    try {
      await api.atualizarMercado(dados.id, { nome: dados.nome, descricao: dados.descricao });
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
      await api.atualizarMercado(dados.id, { nome: form.nome, descricao: form.descricao });
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
    // Atualiza localmente primeiro (otimista)
    setDados(prev => ({
      ...prev,
      categorias: prev.categorias.map(c =>
        c.id === categoriaId ? { ...c, nome: novoNome } : c
      ),
    }));
    setTemAlteracoes(true);

    // Salva no banco
    if (dados.id && dados.id !== 0) {
      try {
        await api.atualizarCategoria(dados.id, categoriaId, { nome: novoNome });
        showToast('sucesso', 'Categoria renomeada!');
      } catch (e: unknown) {
        showToast('erro', e instanceof Error ? e.message : 'Erro ao renomear categoria.');
      }
    }
  }

  return (
    <div className="vt-shell">

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {carregando && (
        <div className="vt-loading">
          <p>Carregando vitrine...</p>
        </div>
      )}

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      {onVoltar && !carregando && (
        <div className="vt-topbar">
          <button className="vt-btn-voltar" onClick={() => tentarSair('voltar')}>
            <IconArrowLeft size={15} /> Voltar ao Gerenciamento
          </button>

          <div className="vt-topbar-direita">
            <ThemeToggle tema={tema} onToggle={toggleTema} />
            <span className="vt-topbar-label">Pré-visualização da Vitrine</span>

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
      )}

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

        <div className="vt-tags-row">
          {Array.from({ length: 5 }, (_, i) => (
            <button key={i} className="vt-tag">dropbox</button>
          ))}
        </div>
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
                onAlterado={() => setTemAlteracoes(true)}
                onErroProduto={(msg) => showToast('erro', msg)}
                onRenomear={handleRenomear}
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}