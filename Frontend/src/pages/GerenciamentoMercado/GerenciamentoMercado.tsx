import { useState, useEffect, type ReactNode } from 'react';
import './GerenciamentoMercado.css';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import {
  IconBarChart,
  IconPackage,
  IconShoppingCart,
  IconStar,
  IconCreditCard,
  IconInfo,
  IconInbox,
  IconZap,
  IconEye,
  IconArrowLeft,
  IconMapPin,
  IconPhone,
  IconMail,
  IconStore,
} from '../../components/Icons';

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
  slug: string;
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

const SIDEBAR_NAV: { icon: ReactNode; label: string }[] = [
  { icon: <IconBarChart size={18} />, label: 'Dashboard' },
  { icon: <IconPackage size={18} />, label: 'Produtos' },
  { icon: <IconShoppingCart size={18} />, label: 'Pedidos' },
  { icon: <IconStar size={18} />, label: 'Avaliações' },
  { icon: <IconCreditCard size={18} />, label: 'Financeiro' },
  { icon: <IconInfo size={18} />, label: 'Informações' },
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
      <span className="gm-empty-icon"><IconInbox size={26} /></span>
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

// ─── Caixa de URL da loja (copiar link) ────────────────────────────────────────

function montarUrlVitrine(slug: string) {
  return `${window.location.origin}/vitrine/${slug}`;
}

function CaixaUrlLoja({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = montarUrlVitrine(slug);

  async function copiarUrl() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback para navegadores/contextos sem permissão de clipboard
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="gm-url-banner">
      <div className="gm-url-banner-icon">
        <IconStore size={20} />
      </div>
      <div className="gm-url-banner-body">
        <p className="gm-url-banner-label">Link da sua loja</p>
        <p className="gm-url-banner-link">{url}</p>
      </div>
      <button className={`gm-url-banner-btn${copiado ? ' copiado' : ''}`} onClick={copiarUrl}>
        {copiado ? (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Copiado!
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copiar link
          </>
        )}
      </button>
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SecDashboard({ stats, financeiro, loading, slug }: {
  stats: Stat[];
  financeiro: FinanceiroMes[];
  loading: boolean;
  slug?: string;
}) {
  const STAT_ICONS = [IconPackage, IconStore, IconShoppingCart, IconStar];

  return (
    <div className="gm-section-wrap">
      {slug && <CaixaUrlLoja slug={slug} />}

      <div className="gm-stats-row">
        {stats.map((s, i) => {
          const StatIcon = STAT_ICONS[i % STAT_ICONS.length];
          return (
            <div key={i} className={`gm-stat${loading ? ' gm-stat--loading' : ''}`} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
              <div className="gm-stat-icon"><StatIcon size={17} /></div>
              <div>
                <p className="gm-stat-val">{loading ? '—' : s.val}</p>
                <p className="gm-stat-lbl">{s.lbl}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="gm-divider" />

      <div className="gm-dash-grid">
        <div className="gm-chart-card">
          <p className="gm-sec-title"><IconBarChart size={15} /> Receita Mensal</p>
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
          <p className="gm-sec-title"><IconZap size={15} /> Resumo Rápido</p>
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
        <h2 className="gm-sec-title"><IconPackage size={15} /> Todos os Produtos</h2>
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
                {p.imagem ? <img src={p.imagem} alt={p.nome} /> : <IconPackage size={26} />}
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
        <h2 className="gm-sec-title"><IconShoppingCart size={15} /> Pedidos Recentes</h2>
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
        <h2 className="gm-sec-title"><IconStar size={15} /> Avaliações</h2>
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
        <h2 className="gm-sec-title"><IconCreditCard size={15} /> Financeiro</h2>
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
            <div className="gm-stat-icon"><IconBarChart size={17} /></div>
            <div>
              <p className="gm-stat-val">{s.val}</p>
              <p className="gm-stat-lbl">{s.lbl}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="gm-divider" />

      <div className="gm-chart-card gm-chart-card--full">
        <p className="gm-sec-title" style={{ marginBottom: '1.2rem' }}><IconBarChart size={15} /> Receita x Custo — Últimos 6 meses</p>

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
        <h2 className="gm-sec-title"><IconInfo size={15} /> Informações do Mercado</h2>
        <button className="gm-btn-link">Editar</button>
      </div>

      <div className="gm-info-grid">
        <div className="gm-info-card">
          <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> Endereço</span><span className="gm-info-val">{mercado.rua}, {mercado.bairro}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl"><IconPhone size={13} /> Telefone</span><span className="gm-info-val">{formatarTelefone(mercado.telefone)}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl"><IconMail size={13} /> Email</span><span className="gm-info-val">{mercado.email}</span></div>
        </div>
        <div className="gm-info-card">
          <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> Cidade</span><span className="gm-info-val">{mercado.cidade} - {mercado.estado}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> CEP</span><span className="gm-info-val">{formatarCEP(mercado.cep)}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> Bairro</span><span className="gm-info-val">{mercado.bairro}</span></div>
        </div>
        <div className="gm-info-card">
          <div className="gm-info-row"><span className="gm-info-lbl"><IconCreditCard size={13} /> CNPJ</span><span className="gm-info-val">{formatarCNPJ(mercado.cnpj)}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl"><IconStore size={13} /> Nome</span><span className="gm-info-val">{mercado.nome}</span></div>
          <div className="gm-info-row"><span className="gm-info-lbl"><IconPackage size={13} /> Categorias</span><span className="gm-info-val">—</span></div>
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
  const { tema, toggleTema } = useTheme();

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
    <SecDashboard stats={stats} financeiro={[]} loading={loading} slug={mercado?.slug} />,
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
          <div className="gm-mkt-logo"><IconShoppingCart size={24} /></div>
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
              <span className="gm-nav-icon">{item.icon}</span>
              <span className="gm-nav-label">{item.label}</span>
              {nav === i && <span className="gm-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="gm-sidebar-footer">
          <div className="gm-theme-row">
            <span className="gm-theme-label">Tema</span>
            <ThemeToggle tema={tema} onToggle={toggleTema} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="gm-main">
        <div className="gm-topbar">
          <div className="gm-topbar-left">
            <button className="gm-btn-back" onClick={onVoltar}>
              <IconArrowLeft size={14} /> Meus Mercados
            </button>
            <span className="gm-topbar-title">
              {SIDEBAR_NAV[nav].icon} {SIDEBAR_NAV[nav].label}
            </span>
          </div>
          <div className="gm-topbar-actions">
            <button className="gm-btn-sec" onClick={onAbrirVitrine}>
              <IconEye size={14} /> Ver Vitrine
            </button>
          </div>
        </div>

        <div className="gm-content" key={nav}>
          {SECTIONS[nav]}
        </div>
      </main>
    </div>
  );
}