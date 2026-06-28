import { useState, useEffect, useRef } from 'react';
import '../pages/CSS/Vetrine.css';
import CadastroProduto  from '../components/Cadastroproduto';
import EditarMercado    from '../components/Editarmercado';
import CriarCategoria   from '../components/Criarcategoria';
import ConfirmarSaida   from '../components/Confirmarsaida';
import ToastContainer   from '../components/Toast';
import { useToast }     from '../hooks/useToast';
import { api }          from '../services/api';

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
  mercado?: VitrineMercado;
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
      <span className="vt-add-icon">+</span>
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
      <button className="vt-categoria-editar-ok" onClick={confirmar} title="Confirmar">✓</button>
      <button className="vt-categoria-editar-cancel" onClick={onCancelar} title="Cancelar">✕</button>
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
                  ✎
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
      <span className="vt-vazio-icone">🏪</span>
      <p className="vt-vazio-titulo">Sua vitrine está vazia</p>
      <p className="vt-vazio-sub">Crie uma categoria para começar a adicionar produtos</p>
      <button className="vt-vazio-btn" onClick={onCriar}>+ Nova categoria</button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Vitrine({ mercado, onVoltar }: VitrineProps) {
  const [dados, setDados]                         = useState<VitrineMercado>(mercado ?? MERCADO_PLACEHOLDER);
  const [temAlteracoes, setTemAlteracoes]         = useState(false);
  const [salvandoVitrine, setSalvandoVitrine]     = useState(false);
  const [modalEditar, setModalEditar]             = useState(false);
  const [modalCategoria, setModalCategoria]       = useState(false);
  const [modalSaida, setModalSaida]               = useState(false);
  const [salvandoMercado, setSalvandoMercado]     = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const acaoAoSair                                = useRef<'voltar' | 'fechar' | null>(null);

  const { toasts, showToast, dismissToast } = useToast();

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
    if (dados.id === 0) {
      await new Promise(r => setTimeout(r, 500));
      setTemAlteracoes(false);
      showToast('sucesso', 'Vitrine salva com sucesso!');
      return true;
    }
    try {
      await api.atualizar({ nome: dados.nome, descricao: dados.descricao });
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
    if (dados.id === 0) {
      setDados(prev => ({ ...prev, ...form }));
      setModalEditar(false);
      setTemAlteracoes(true);
      showToast('info', 'Alterações pendentes — clique em Salvar vitrine.');
      return;
    }
    setSalvandoMercado(true);
    try {
      await api.atualizar({ nome: form.nome, descricao: form.descricao });
      setDados(prev => ({ ...prev, ...form }));
      setModalEditar(false);
      setTemAlteracoes(true);
      showToast('info', 'Alterações pendentes — clique em Salvar vitrine.');
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao atualizar mercado.');
    } finally {
      setSalvandoMercado(false);
    }
  }

  // ── Criar categoria ───────────────────────────────────────────────────────

  async function handleCriarCategoria(nome: string) {
    if (dados.id === 0) {
      setDados(prev => ({ ...prev, categorias: [...prev.categorias, { id: Date.now(), nome, produtos: [] }] }));
      setModalCategoria(false);
      setTemAlteracoes(true);
      showToast('info', 'Alterações pendentes — clique em Salvar vitrine.');
      return;
    }
    setSalvandoCategoria(true);
    try {
      const nova: Categoria = await api.criarCategoria(dados.id, { nome });
      setDados(prev => ({ ...prev, categorias: [...prev.categorias, nova] }));
      setModalCategoria(false);
      setTemAlteracoes(true);
      showToast('info', 'Alterações pendentes — clique em Salvar vitrine.');
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
    showToast('info', 'Alterações pendentes — clique em Salvar vitrine.');

    // TODO: chamar api.atualizarCategoria quando a rota existir
    // try { await api.atualizarCategoria(dados.id, categoriaId, { nome: novoNome }) } catch ...
  }

  return (
    <div className="vt-shell">

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      {onVoltar && (
        <div className="vt-topbar">
          <button className="vt-btn-voltar" onClick={() => tentarSair('voltar')}>
            ← Voltar ao Gerenciamento
          </button>

          <div className="vt-topbar-direita">
            <span className="vt-topbar-label">Pré-visualização da Vitrine</span>

            {temAlteracoes && (
              <button
                className={`vt-btn-salvar ${salvandoVitrine ? 'vt-btn-salvar--carregando' : ''}`}
                onClick={handleSalvarVitrine}
                disabled={salvandoVitrine}
              >
                {salvandoVitrine
                  ? <><span className="vt-btn-salvar-spinner" /> Salvando…</>
                  : <><span className="vt-btn-salvar-icon">✓</span> Salvar vitrine</>
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
              : <div className="vt-logo-placeholder"><span>+</span></div>
            }
            <span className="vt-logo-edit-overlay">✎</span>
          </button>

          <div className="vt-header-text">
            <div className="vt-header-nome-wrap">
              <h1 className="vt-nome-mercado">{dados.nome}</h1>
              <button className="vt-btn-editar" onClick={() => setModalEditar(true)}>✎ Editar</button>
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
            <button className="vt-fab" onClick={() => setModalCategoria(true)} title="Adicionar categoria">+</button>
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