import { useState } from 'react';
import '../pages/CSS/Vetrine.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id: number;
  imagem?: string;
  nome: string;
  descricao: string;
  preco: string;
}

interface Categoria {
  id: number;
  nome: string;
  produtos: Produto[];
}

interface VitrineMercado {
  logo?: string;
  nome: string;
  descricao: string;
  categorias: Categoria[];
  banner?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VitrineProps {
  mercado?: VitrineMercado;
  onVoltar?: () => void;
}

// ─── Placeholder data (remover quando API estiver pronta) ─────────────────────

const MERCADO_PLACEHOLDER: VitrineMercado = {
  nome: 'Nome do mercado',
  descricao: 'Descrição do mercado',
  categorias: [],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoPlaceholder() {
  return (
    <div className="vt-logo-placeholder">
      <span>+</span>
    </div>
  );
}

function BannerTags() {
  // TODO: substituir pelos dados reais do banco
  return (
    <div className="vt-tags-row">
      {Array.from({ length: 5 }, (_, i) => (
        <button key={i} className="vt-tag">
          dropbox
        </button>
      ))}
    </div>
  );
}

function ProdutoCard({ produto }: { produto: Produto }) {
  return (
    <div className="vt-produto-card">
      <div className="vt-produto-img">
        {produto.imagem ? (
          <img src={produto.imagem} alt={produto.nome} />
        ) : (
          <span className="vt-produto-img-placeholder">Imagem do produto</span>
        )}
      </div>
      <div className="vt-produto-info">
        <p className="vt-produto-desc">{produto.descricao || 'Descrição do produto com preço'}</p>
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

function CategoriaSection({ categoria }: { categoria: Categoria }) {
  const handleAddProduto = () => {
    // TODO: abrir modal/drawer de criação de produto
    console.log('Adicionar produto na categoria:', categoria.id);
  };

  return (
    <section className="vt-categoria">
      <h2 className="vt-categoria-titulo">{categoria.nome}</h2>
      <div className="vt-produtos-grid">
        {categoria.produtos.map(p => (
          <ProdutoCard key={p.id} produto={p} />
        ))}
        <ProdutoAddCard onAdd={handleAddProduto} />
      </div>
    </section>
  );
}

function CategoriaVazia() {
  return (
    <section className="vt-categoria">
      <h2 className="vt-categoria-titulo">Categoria</h2>
      <div className="vt-produtos-grid">
        <div className="vt-produto-card">
          <div className="vt-produto-img">
            <span className="vt-produto-img-placeholder">Imagem do produto</span>
          </div>
          <div className="vt-produto-info">
            <p className="vt-produto-desc">Descrição do produto com preço</p>
          </div>
        </div>
        <button className="vt-produto-card vt-produto-add">
          <span className="vt-add-icon">+</span>
        </button>
      </div>
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Vitrine({ mercado, onVoltar }: VitrineProps) {
  const [dados] = useState<VitrineMercado>(mercado ?? MERCADO_PLACEHOLDER);

  // TODO: buscar do banco quando API estiver pronta
  // useEffect(() => {
  //   fetch(`/api/mercado/${id}/vitrine`)
  //     .then(r => r.json())
  //     .then(setDados);
  // }, [id]);

  const handleAddCategoria = () => {
    // TODO: abrir modal/drawer de criação de categoria
    console.log('Adicionar categoria');
  };

  const handleEditLogo = () => {
    // TODO: abrir seletor de imagem para logo
    console.log('Editar logo');
  };

  return (
    <div className="vt-shell">

      {/* ── TOPBAR (só aparece quando chamada do gerenciamento) ──────────── */}
      {onVoltar && (
        <div className="vt-topbar">
          <button className="vt-btn-voltar" onClick={onVoltar}>
            ← Voltar ao Gerenciamento
          </button>
          <span className="vt-topbar-label">Pré-visualização da Vitrine</span>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="vt-header">
        <div className="vt-header-identity">

          {/* Logo */}
          <button className="vt-logo-btn" onClick={handleEditLogo} title="Alterar logo">
            {dados.logo
              ? <img src={dados.logo} alt={dados.nome} className="vt-logo-img" />
              : <LogoPlaceholder />
            }
          </button>

          {/* Nome e descrição */}
          <div className="vt-header-text">
            <h1 className="vt-nome-mercado">{dados.nome}</h1>
            <p className="vt-desc-mercado">{dados.descricao}</p>
          </div>
        </div>

        {/* Tags / banners */}
        <BannerTags />
      </header>

      {/* ── CATEGORIAS ─────────────────────────────────────────────────── */}
      <main className="vt-main">
        {dados.categorias.length === 0
          ? <CategoriaVazia />
          : dados.categorias.map(cat => (
              <CategoriaSection key={cat.id} categoria={cat} />
            ))
        }

        {/* Botão flutuante — adicionar nova categoria */}
        <div className="vt-fab-wrap">
          <button className="vt-fab" onClick={handleAddCategoria} title="Adicionar categoria">
            +
          </button>
        </div>
      </main>
    </div>
  );
}