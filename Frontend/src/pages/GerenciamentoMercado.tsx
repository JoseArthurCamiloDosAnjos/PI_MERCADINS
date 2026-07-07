import { useState, useEffect } from 'react';
import '../pages/CSS/GerenciamentoMercado.css';
import { api } from '../services/api';

// Alturas fixas para o skeleton do gráfico (evita Math.random no render)
const SKELETON_HEIGHTS = [55, 80, 65, 90, 45, 75];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id_produto: number;
  nome: string;
  descricao?: string;
  imagem?: string;
  categoria: string;
}

interface Pedido {
  num: string;
  cliente: string;
  itens: string;
  preco: string;
  status: 'entregue' | 'caminho' | 'preparo' | 'novo';
  label: string;
}

interface Avaliacao {
  iniciais: string;
  nome: string;
  n: number;
  texto: string;
}

interface Stat {
  val: string;
  lbl: string;
}

interface FinanceiroMes {
  mes: string;
  val: number;
}

interface MercadoInfo {
  id_mercado: number;
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
}

interface DadosMercado {
  mercado: MercadoInfo | null;
  produtos: Produto[];
  totalCategorias: number;
  totalProdutos: number;
  loading: boolean;
}

// ─── Sidebar nav ─────────────────────────────────────────────────────────────

const SIDEBAR_NAV = [
  { emoji: '📊', label: 'Dashboard' },
  { emoji: '📦', label: 'Produtos' },
  { emoji: '🛒', label: 'Pedidos' },
  { emoji: '⭐', label: 'Avaliações' },
  { emoji: '💰', label: 'Financeiro' },
  { emoji: 'ℹ️', label: 'Informações' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <span className="gm-stars">
      {Array.from({ length: 5 }, (_, i) => (i < n ? '★' : '☆')).join('')}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="gm-empty">
      <span className="gm-empty-icon">📭</span>
      <p>{msg}</p>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="gm-loading-row">
      <div className="gm-skeleton" style={{ width: '60%' }} />
      <div className="gm-skeleton" style={{ width: '40%' }} />
      <div className="gm-skeleton" style={{ width: '50%' }} />
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SecDashboard({ stats, financeiro, loading }: {
  stats: Stat[];
  financeiro: FinanceiroMes[];
  loading: boolean;
}) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-stats-row">
        {stats.map((s, i) => (
          <div key={i} className={`gm-stat${loading ? ' gm-stat--loading' : ''}`} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
            <p className="gm-stat-val">{loading ? '—' : s.val}</p>
            <p className="gm-stat-lbl">{s.lbl}</p>
          </div>
        ))}
      </div>

      <div className="gm-divider" />

      <div className="gm-dash-grid">
        <div className="gm-chart-card">
          <p className="gm-sec-title">📈 Receita Mensal</p>
          {loading ? (
            <div className="gm-chart-loading">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="gm-bar-skeleton" style={{ height: `${SKELETON_HEIGHTS[i]}%` }} />
              ))}
            </div>
          ) : financeiro.length === 0 ? (
            <EmptyState msg="Sem dados financeiros ainda" />
          ) : (
            <div className="gm-bar-chart">
              {financeiro.map((f, i) => {
                const max = Math.max(...financeiro.map(x => x.val));
                const pct = (f.val / max) * 100;
                return (
                  <div key={i} className="gm-bar-col">
                    <span className="gm-bar-val">R$ {(f.val / 1000).toFixed(1)}k</span>
                    <div className="gm-bar-outer">
                      <div className="gm-bar-inner" style={{ height: `${pct}%`, animationDelay: `${0.1 + i * 0.07}s` }} />
                    </div>
                    <span className="gm-bar-label">{f.mes}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="gm-quick-card">
          <p className="gm-sec-title">⚡ Resumo Rápido</p>
          <div className="gm-quick-list">
            {loading ? (
              Array.from({ length: 6 }, (_, i) => <LoadingRow key={i} />)
            ) : (
              <>
                <div className="gm-quick-row"><span>Pedidos hoje</span><strong>—</strong></div>
                <div className="gm-quick-row"><span>Receita hoje</span><strong className="gm-yellow">—</strong></div>
                <div className="gm-quick-row"><span>Ticket médio</span><strong>—</strong></div>
                <div className="gm-quick-row"><span>Sem estoque</span><strong className="gm-red">—</strong></div>
                <div className="gm-quick-row"><span>Estoque baixo</span><strong className="gm-orange">—</strong></div>
                <div className="gm-quick-row"><span>Avaliação média</span><strong className="gm-yellow">—</strong></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecProdutos({ produtos, loading }: { produtos: Produto[]; loading: boolean }) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title">📦 Todos os Produtos</h2>
        <button className="gm-btn-link">Ver todos ({produtos.length})</button>
      </div>

      {loading ? (
        <div className="gm-prod-row">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="gm-prod-card gm-prod-card--skeleton">
              <div className="gm-prod-img gm-skeleton-block" />
              <div className="gm-prod-body">
                <div className="gm-skeleton" style={{ width: '80%' }} />
                <div className="gm-skeleton" style={{ width: '50%', marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <EmptyState msg="Nenhum produto cadastrado ainda" />
      ) : (
        <div className="gm-prod-row">
          {produtos.map((p) => (
            <div key={p.id_produto} className="gm-prod-card">
              <div className="gm-prod-img">
                {p.imagem ? <img src={p.imagem} alt={p.nome} /> : '📦'}
              </div>
              <div className="gm-prod-body">
                <p className="gm-prod-nome">{p.nome}</p>
                <p className="gm-prod-preco">{p.categoria}</p>
                {p.descricao && <p className="gm-prod-desc">{p.descricao}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecPedidos({ pedidos, loading }: { pedidos: Pedido[]; loading: boolean }) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title">🛒 Pedidos Recentes</h2>
        <button className="gm-btn-link">Ver todos</button>
      </div>

      {loading ? (
        Array.from({ length: 4 }, (_, i) => <LoadingRow key={i} />)
      ) : pedidos.length === 0 ? (
        <EmptyState msg="Nenhum pedido ainda" />
      ) : (
        <div className="gm-pedidos-list">
          {pedidos.map((p, i) => (
            <div key={i} className="gm-pedido-row" style={{ animationDelay: `${0.05 + i * 0.06}s` }}>
              <span className="gm-pedido-num">{p.num}</span>
              <span className="gm-pedido-cliente">{p.cliente}</span>
              <span className="gm-pedido-itens">{p.itens}</span>
              <span className="gm-pedido-preco">{p.preco}</span>
              <span className={`gm-pedido-status gm-pedido-status--${p.status}`}>{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecAvaliacoes({ avaliacoes, loading }: { avaliacoes: Avaliacao[]; loading: boolean }) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title">⭐ Avaliações</h2>
        <button className="gm-btn-link">Ver todas</button>
      </div>

      {loading ? (
        Array.from({ length: 3 }, (_, i) => <LoadingRow key={i} />)
      ) : avaliacoes.length === 0 ? (
        <EmptyState msg="Nenhuma avaliação ainda" />
      ) : (
        <div className="gm-reviews-grid">
          {avaliacoes.map((a, i) => (
            <div key={i} className="gm-review-card" style={{ animationDelay: `${0.05 + i * 0.06}s` }}>
              <div className="gm-rev-header">
                <div className="gm-rev-avatar">{a.iniciais}</div>
                <p className="gm-rev-nome">{a.nome}</p>
              </div>
              <Stars n={a.n} />
              <p className="gm-rev-text">{a.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecFinanceiro({ financeiro, loading }: { financeiro: FinanceiroMes[]; loading: boolean }) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title">💰 Financeiro</h2>
        <button className="gm-btn-link">Exportar relatório</button>
      </div>

      <div className="gm-stats-row">
        {[
          { val: '—', lbl: 'Receita do Mês' },
          { val: '—', lbl: 'Custos do Mês' },
          { val: '—', lbl: 'Lucro Líquido' },
          { val: '—', lbl: 'Margem' },
        ].map((s, i) => (
          <div key={i} className={`gm-stat${loading ? ' gm-stat--loading' : ''}`} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
            <p className="gm-stat-val">{s.val}</p>
            <p className="gm-stat-lbl">{s.lbl}</p>
          </div>
        ))}
      </div>

      <div className="gm-divider" />

      <div className="gm-chart-card gm-chart-card--full">
        <p className="gm-sec-title" style={{ marginBottom: '1.2rem' }}>📊 Receita x Custo — Últimos 6 meses</p>

        {loading ? (
          <div className="gm-chart-loading">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="gm-bar-skeleton" style={{ height: `${SKELETON_HEIGHTS[i]}%` }} />
            ))}
          </div>
        ) : financeiro.length === 0 ? (
          <EmptyState msg="Sem dados financeiros ainda" />
        ) : (
          <div className="gm-bar-chart gm-bar-chart--lg">
            {financeiro.map((f, i) => {
              const max = Math.max(...financeiro.map(x => x.val));
              const custo = Math.round(f.val * 0.65);
              const pctRec = (f.val / max) * 100;
              const pctCusto = (custo / max) * 100;
              return (
                <div key={i} className="gm-bar-col gm-bar-col--pair">
                  <div className="gm-bar-pair">
                    <div className="gm-bar-outer">
                      <div className="gm-bar-inner" style={{ height: `${pctRec}%`, animationDelay: `${0.1 + i * 0.07}s` }} />
                    </div>
                    <div className="gm-bar-outer">
                      <div className="gm-bar-inner gm-bar-inner--cost" style={{ height: `${pctCusto}%`, animationDelay: `${0.15 + i * 0.07}s` }} />
                    </div>
                  </div>
                  <span className="gm-bar-label">{f.mes}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="gm-legend">
          <span className="gm-legend-dot gm-legend-dot--rec" /> Receita
          <span className="gm-legend-dot gm-legend-dot--cost" style={{ marginLeft: '1rem' }} /> Custo
        </div>
      </div>
    </div>
  );
}

function SecInformacoes({ mercado }: { mercado: MercadoInfo | null }) {
  if (!mercado) return <EmptyState msg="Carregando informações..." />;

  const formatarTelefone = (tel: string) => {
    if (!tel) return '—';
    const nums = tel.replace(/\D/g, '');
    if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
    if (nums.length === 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
    return tel;
  };

  const formatarCNPJ = (cnpj: string) => {
    if (!cnpj) return '—';
    const nums = cnpj.replace(/\D/g, '');
    if (nums.length === 14) return `${nums.slice(0,2)}.${nums.slice(2,5)}.${nums.slice(5,8)}/${nums.slice(8,12)}-${nums.slice(12)}`;
    return cnpj;
  };

  const formatarCEP = (cep: string) => {
    if (!cep) return '—';
    const nums = cep.replace(/\D/g, '');
    if (nums.length === 8) return `${nums.slice(0,5)}-${nums.slice(5)}`;
    return cep;
  };

  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title">ℹ️ Informações do Mercado</h2>
        <button className="gm-btn-link">Editar</button>
      </div>
      <div className="gm-info-grid">
        <div className="gm-info-card">
          <div className="gm-info-row"><span className="gm-info-lbl">📍 Endereço</span><span className="gm-info-val">{mercado.rua}, {mercado.bairro}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl">📞 Telefone</span><span className="gm-info-val">{formatarTelefone(mercado.telefone)}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl">✉️ Email</span><span className="gm-info-val">{mercado.email}</span></div>
        </div>
        <div className="gm-info-card">
          <div className="gm-info-row"><span className="gm-info-lbl">📍 Cidade</span><span className="gm-info-val">{mercado.cidade} - {mercado.estado}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl">📮 CEP</span><span className="gm-info-val">{formatarCEP(mercado.cep)}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl">🏘️ Bairro</span><span className="gm-info-val">{mercado.bairro}</span></div>
        </div>
        <div className="gm-info-card">
          <div className="gm-info-row"><span className="gm-info-lbl">🆔 CNPJ</span><span className="gm-info-val">{formatarCNPJ(mercado.cnpj)}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl">🏷️ Nome</span><span className="gm-info-val">{mercado.nome}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl">📦 Categorias</span><span className="gm-info-val">—</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GerenciamentoMercado({
  mercadoId,
  onVoltar,
  onAbrirVitrine,
}: {
  mercadoId: number;
  onVoltar: () => void;
  onAbrirVitrine: () => void;
}) {
  const [nav, setNav] = useState(0);

  const [dados, setDados] = useState<DadosMercado>({
    mercado: null,
    produtos: [],
    totalCategorias: 0,
    totalProdutos: 0,
    loading: true,
  });

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const data = await api.dashboardMercado(mercadoId);
        setDados({
          mercado: data.mercado,
          produtos: data.produtos,
          totalCategorias: data.totalCategorias,
          totalProdutos: data.totalProdutos,
          loading: false,
        });
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        setDados(prev => ({ ...prev, loading: false }));
      }
    }
    carregarDashboard();
  }, [mercadoId]);

  const { mercado, produtos, totalCategorias, totalProdutos, loading } = dados;

  const stats: Stat[] = [
    { val: String(totalProdutos), lbl: 'Produtos' },
    { val: String(totalCategorias), lbl: 'Categorias' },
    { val: '—', lbl: 'Pedidos' },
    { val: '—', lbl: 'Avaliação' },
  ];

  const SECTIONS = [
    <SecDashboard stats={stats} financeiro={[]} loading={loading} />,
    <SecProdutos produtos={produtos} loading={loading} />,
    <SecPedidos pedidos={[]} loading={loading} />,
    <SecAvaliacoes avaliacoes={[]} loading={loading} />,
    <SecFinanceiro financeiro={[]} loading={loading} />,
    <SecInformacoes mercado={mercado} />,
  ];

  return (
    <div className="gm-shell">

      {/* SIDEBAR */}
      <aside className="gm-sidebar">
        <div className="gm-mkt-identity">
          <div className="gm-mkt-logo">🛒</div>
          <p className="gm-mkt-nome">{mercado?.nome ?? 'Carregando...'}</p>
          <p className="gm-mkt-sub">{mercado?.cidade ?? ''} · {mercado?.estado ?? ''}</p>
          <span className="gm-status-open">● Aberto</span>
        </div>
        <nav className="gm-nav">
          {SIDEBAR_NAV.map((item, i) => (
            <button
              key={i}
              className={`gm-nav-btn${nav === i ? ' active' : ''}`}
              style={{ animationDelay: `${0.18 + i * 0.06}s` }}
              onClick={() => setNav(i)}
            >
              <span className="gm-nav-emoji">{item.emoji}</span>
              <span className="gm-nav-label">{item.label}</span>
              {nav === i && <span className="gm-nav-dot" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="gm-main">
        <div className="gm-topbar">
          <div className="gm-topbar-left">
            <button className="gm-btn-back" onClick={onVoltar}>← Meus Mercados</button>
            <span className="gm-topbar-title">
              {SIDEBAR_NAV[nav].emoji} {SIDEBAR_NAV[nav].label}
            </span>
          </div>
          <div className="gm-topbar-actions">
            <button className="gm-btn-sec" onClick={onAbrirVitrine}>👁 Ver Vitrine</button>
          </div>
        </div>

        <div className="gm-content" key={nav}>
          {SECTIONS[nav]}
        </div>
      </main>
    </div>
  );
}