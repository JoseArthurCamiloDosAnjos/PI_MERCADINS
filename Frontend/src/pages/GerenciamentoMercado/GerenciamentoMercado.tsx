import { useState, useEffect, useMemo, type ReactNode } from 'react';
import './GerenciamentoMercado.css';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { removeEmojis } from '../../hooks/useBlockEmojis';
import { parseHorario, estaAberto, type HorarioMercado } from '../../utils/horario';
import ToastContainer from '../../components/Toast';
import {
  IconBarChart,
  IconPackage,
  IconShoppingCart,
  IconStar,
  IconCreditCard,
  IconInfo,
  IconClock,
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

// Nomes curtos dos meses (gráficos do painel)
const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id_produto: number;
  nome: string;
  descricao?: string;
  imagem?: string;
  preco?: number;
  custo?: number;
  id_categoria: number;
  categoria: string;
  estoque?: number;
}

interface Pedido {
  id: number;
  num: string;
  cliente: string;
  itens: string;
  preco: string;
  valorNum: number;   // valor numérico (para o financeiro)
  data: string;       // data ISO da compra
  status: 'entregue' | 'caminho' | 'preparo' | 'novo';   // chave visual (badge)
  statusAtual: 'pendente' | 'preparo' | 'caminho' | 'entregue'; // valor real do banco
  label: string;
  observacao?: string;
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

// Resumo do mês vindo de GET /api/mercados/:id/financeiro
interface FinanceiroResumo {
  ano: number;
  mes: number;
  pedidos: number;
  faturamento: number;
  ticketMedio: number;
  custoMercadoria: number;
  custoFixo: number;
  lucro: number;           // pode ser negativo (prejuízo)
  itensSemCusto: number;   // unidades vendidas sem custo cadastrado
  porStatus: Record<string, number>;
  serieDiaria: { dia: number; pedidos: number; receita: number }[];
  topProdutos: { nome: string; qtd: number; receita: number }[];
}

// Chips dos meses do financeiro
interface OpcaoMes { ano: number; mes: number; label: string; }

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
  foto_perfil?: string;
  horario?: string | null;
}

interface ResumoDashboard {
  semEstoque: number;
  estoqueBaixo: number;
  avaliacaoMedia: number;
  avaliacoesTotal: number;
  pedidosHoje: number;
  receitaHoje: number;
}

interface DadosMercado {
  mercado: MercadoInfo | null;
  produtos: Produto[];
  totalCategorias: number;
  totalProdutos: number;
  plano: string;
  limites: { produtos: number; fotos: number };
  uso: { produtos: number; fotos: number };
  resumo: ResumoDashboard | null;
  loading: boolean;
}

const NOMES_PLANOS: Record<string, string> = {
  basico: 'Essencial',
  profissional: 'Plus',
  personalizado: 'Personalizado',
};

function formatarBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status dos pedidos ───────────────────────────────────────────────────────
// 'pendente' é o status inicial de todo pedido (chave visual: 'novo')
const STATUS_PEDIDO: Record<
  'pendente' | 'preparo' | 'caminho' | 'entregue',
  { chave: Pedido['status']; label: string }
> = {
  pendente: { chave: 'novo',     label: 'Novo' },
  preparo:  { chave: 'preparo',  label: 'Em preparo' },
  caminho:  { chave: 'caminho',  label: 'A caminho' },
  entregue: { chave: 'entregue', label: 'Entregue' },
};

const PROXIMO_STATUS: Partial<Record<'pendente' | 'preparo' | 'caminho' | 'entregue', 'pendente' | 'preparo' | 'caminho' | 'entregue'>> = {
  pendente: 'preparo',
  preparo:  'caminho',
  caminho:  'entregue',
};

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

// ─── Modal de edição de produto ──────────────────────────────────────────────

function EditarProdutoModal({
  produto,
  mercadoId,
  onFechar,
  onSalvo,
}: {
  produto: Produto;
  mercadoId: number;
  onFechar: () => void;
  onSalvo: (atualizado: Produto) => void;
}) {
  const [nome, setNome] = useState(produto.nome);
  const [descricao, setDescricao] = useState(produto.descricao ?? '');
  const [preco, setPreco] = useState(() => {
    const num = Number(produto.preco ?? 0);
    if (Number.isNaN(num) || num <= 0) return '';
    const [reais, centavos = '00'] = num.toFixed(2).split('.');
    const reaisFmt = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${reaisFmt},${centavos}`;
  });
  const [estoque, setEstoque] = useState(produto.estoque ?? 0);
  const [custo, setCusto] = useState(() => {
    const num = Number(produto.custo ?? 0);
    if (Number.isNaN(num) || num <= 0) return '';
    const [reais, centavos = '00'] = num.toFixed(2).split('.');
    const reaisFmt = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${reaisFmt},${centavos}`;
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function handleChangePreco(valor: string) {
    const apenasDigitos = valor.replace(/\D/g, '');
    if (!apenasDigitos) { setPreco(''); return; }
    setPreco(apenasDigitos);
  }

  function handleBlurPreco() {
    if (!preco) return;
    const apenasDigitos = preco.replace(/\D/g, '');
    if (!apenasDigitos) { setPreco(''); return; }
    const centavos = apenasDigitos.padStart(3, '0');
    const reais = centavos.slice(0, -2);
    const centavosFinal = centavos.slice(-2);
    const reaisFormatado = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setPreco(`${reaisFormatado},${centavosFinal}`);
  }

  function handleChangeCusto(valor: string) {
    const apenasDigitos = valor.replace(/\D/g, '');
    if (!apenasDigitos) { setCusto(''); return; }
    setCusto(apenasDigitos);
  }

  function handleBlurCusto() {
    if (!custo) return;
    const apenasDigitos = custo.replace(/\D/g, '');
    if (!apenasDigitos) { setCusto(''); return; }
    const centavos = apenasDigitos.padStart(3, '0');
    const reais = centavos.slice(0, -2);
    const centavosFinal = centavos.slice(-2);
    const reaisFormatado = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setCusto(`${reaisFormatado},${centavosFinal}`);
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      setErro('O nome é obrigatório.');
      return;
    }
    if (!preco || preco === '0,00') {
      setErro('O preço é obrigatório.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: Number(preco.replace(/\./g, '').replace(',', '.')),
        // Custo vazio = 0 (produto ainda sem custo cadastrado)
        custo: custo ? Number(custo.replace(/\./g, '').replace(',', '.')) : 0,
        estoque,
      };
      const atualizado = await api.atualizarProduto(
        mercadoId,
        produto.id_categoria,
        produto.id_produto,
        dados
      );
      onSalvo({ ...produto, ...atualizado });
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="gm-modal-overlay">
      <div className="gm-modal">
        <div className="gm-modal-header">
          <h3>Editar produto</h3>
          <button className="gm-modal-close" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className="gm-modal-body">
          <label className="gm-modal-label">
            Nome
            <input
              className="gm-modal-input"
              value={nome}
              onChange={e => setNome(removeEmojis(e.target.value))}
              placeholder="Nome do produto"
            />
          </label>

          <label className="gm-modal-label">
            Descrição
            <textarea
              className="gm-modal-textarea"
              value={descricao}
              onChange={e => setDescricao(removeEmojis(e.target.value))}
              placeholder="Descrição (opcional)"
              rows={3}
            />
          </label>

          <label className="gm-modal-label">
            Preço (R$)
            <input
              className="gm-modal-input"
              value={preco}
              onChange={e => handleChangePreco(e.target.value)}
              onBlur={handleBlurPreco}
              placeholder="0,00"
            />
          </label>

          <label className="gm-modal-label">
            Custo (R$)
            <input
              className="gm-modal-input"
              value={custo}
              onChange={e => handleChangeCusto(e.target.value)}
              onBlur={handleBlurCusto}
              placeholder="0,00"
            />
            <small className="gm-modal-dica">
              Quanto você paga pelo produto — é o que define o lucro no painel financeiro.
            </small>
          </label>

          <label className="gm-modal-label">
            Estoque
            <input
              className="gm-modal-input"
              type="number"
              value={estoque}
              min={0}
              onChange={e => setEstoque(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </label>

          {erro && <p className="gm-modal-erro">{erro}</p>}
        </div>

        <div className="gm-modal-footer">
          <button className="gm-btn-sec" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button className="gm-btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
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

function SecDashboard({ stats, financeiro, loading, slug, plano, uso, limites, resumo }: {
  stats: Stat[];
  financeiro: FinanceiroMes[];
  loading: boolean;
  slug?: string;
  plano?: string;
  uso?: { produtos: number; fotos: number };
  limites?: { produtos: number; fotos: number };
  resumo?: ResumoDashboard | null;
}) {
  const STAT_ICONS = [IconPackage, IconStore, IconShoppingCart, IconStar];

  const ticketMedio = (resumo?.pedidosHoje ?? 0) > 0
    ? (resumo!.receitaHoje / resumo!.pedidosHoje)
    : null;

  return (
    <div className="gm-section-wrap">
      {slug && <CaixaUrlLoja slug={slug} />}

      {/* Uso do plano: produtos e fotos dentro do limite contratado */}
      {plano && uso && limites && (
        <div className="gm-plan-chip">
          <IconCreditCard size={13} />
          <span>Plano <strong>{NOMES_PLANOS[plano] ?? plano}</strong></span>
          <span className="gm-plan-sep" />
          <span>Produtos: <strong>{uso.produtos}</strong>/{limites.produtos}</span>
          <span className="gm-plan-sep" />
          <span>Fotos: <strong>{uso.fotos}</strong>/{limites.fotos}</span>
        </div>
      )}

      <div className="gm-stats-row">
        {stats.map((s, i) => {
          const StatIcon = STAT_ICONS[i % STAT_ICONS.length];
          return (
            <div key={i} className={`gm-stat${loading ? ' gm-stat--loading' : ''}`} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
              <div className="gm-stat-icon"><StatIcon size={17} /></div>
              <div className="gm-stat-info">
                <p className="gm-stat-val" title={loading ? undefined : s.val}>{loading ? '—' : s.val}</p>
                <p className="gm-stat-lbl">{s.lbl}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="gm-divider" />

      <div className="gm-dash-grid">
        <div className="gm-chart-card">
          <p className="gm-sec-title"><IconBarChart size={15} /> Receita mensal</p>
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
                    <span className="gm-bar-val">
                      {f.val >= 1000 ? `R$ ${(f.val / 1000).toFixed(1)}k` : f.val > 0 ? `R$ ${f.val.toFixed(0)}` : '—'}
                    </span>
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
          <p className="gm-sec-title"><IconZap size={15} /> Resumo rápido</p>
          <div className="gm-quick-list">
            {loading ? (
              Array.from({ length: 6 }, (_, i) => <LoadingRow key={i} />)
            ) : (
              <>
                <div className="gm-quick-row"><span>Pedidos hoje</span><strong>{resumo?.pedidosHoje ?? 0}</strong></div>
                <div className="gm-quick-row"><span>Receita hoje</span><strong className="gm-yellow">{formatarBRL(resumo?.receitaHoje ?? 0)}</strong></div>
                <div className="gm-quick-row"><span>Ticket médio</span><strong>{ticketMedio != null ? formatarBRL(ticketMedio) : '—'}</strong></div>
                <div className="gm-quick-row"><span>Sem estoque</span><strong className="gm-red">{resumo?.semEstoque ?? 0}</strong></div>
                <div className="gm-quick-row"><span>Estoque baixo</span><strong className="gm-orange">{resumo?.estoqueBaixo ?? 0}</strong></div>
                <div className="gm-quick-row"><span>Avaliação média</span><strong className="gm-yellow">{(resumo?.avaliacaoMedia ?? 0).toFixed(1)} ★</strong></div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecProdutos({ produtos, loading, onEditar }: { produtos: Produto[]; loading: boolean; onEditar: (p: Produto) => void }) {
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
                {p.preco != null && <p className="gm-prod-preco">R$ {Number(p.preco).toFixed(2)}</p>}
                <p className="gm-prod-categoria">{p.categoria}</p>
                {p.descricao && <p className="gm-prod-desc">{p.descricao}</p>}
              </div>
              <button className="gm-prod-editar" onClick={() => onEditar(p)} title="Editar produto">
                ✎
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecPedidos({
  pedidos,
  loading,
  onAvancar,
  expandido,
  onAlternar,
  total,
}: {
  pedidos: Pedido[];
  loading: boolean;
  onAvancar: (p: Pedido) => void;
  expandido: boolean;
  onAlternar: () => void;
  total: number;
}) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title"><IconShoppingCart size={15} /> Pedidos recentes</h2>
        {total > 5 && (
          <button className="gm-btn-link" onClick={onAlternar}>
            {expandido ? 'Ver menos' : `Ver todos (${total})`}
          </button>
        )}
      </div>

      {loading ? (
        Array.from({ length: 4 }, (_, i) => <LoadingRow key={i} />)
      ) : pedidos.length === 0 ? (
        <EmptyState msg="Nenhum pedido ainda" />
      ) : (
        <div className="gm-pedidos-list">
          {pedidos.map((p, i) => {
            const proximo = PROXIMO_STATUS[p.statusAtual];
            return (
              <div key={p.id} className="gm-pedido-row" style={{ animationDelay: `${0.05 + i * 0.06}s` }}>
                <span className="gm-pedido-num">#{p.id}</span>
                <span className="gm-pedido-cliente">{p.cliente}</span>
                <span className="gm-pedido-itens">{p.itens}</span>
                <span className="gm-pedido-preco">{p.preco}</span>
                <span className={`gm-pedido-status gm-pedido-status--${p.status}`}>{p.label}</span>
                {proximo ? (
                  <button
                    className="gm-pedido-acao"
                    onClick={() => onAvancar(p)}
                    title={`Avançar o pedido #${p.id} para "${STATUS_PEDIDO[proximo].label}"`}
                  >
                    {STATUS_PEDIDO[proximo].label} →
                  </button>
                ) : (
                  <span className="gm-pedido-check" title="Pedido concluído">✓</span>
                )}
                {p.observacao && (
                  <span className="gm-pedido-obs" title="Observação do cliente">
                    <IconInfo size={12} /> {p.observacao}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SecAvaliacoes({
  avaliacoes,
  loading,
  expandidas,
  onAlternar,
  total,
}: {
  avaliacoes: Avaliacao[];
  loading: boolean;
  expandidas: boolean;
  onAlternar: () => void;
  total: number;
}) {
  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title"><IconStar size={15} /> Avaliações</h2>
        {total > 4 && (
          <button className="gm-btn-link" onClick={onAlternar}>
            {expandidas ? 'Ver menos' : `Ver todas (${total})`}
          </button>
        )}
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

// Rótulos dos status do pedido no quadro de demanda
const STATUS_DEMANDA: { chave: string; label: string }[] = [
  { chave: 'pendente', label: 'Pendentes' },
  { chave: 'preparo', label: 'Em preparo' },
  { chave: 'caminho', label: 'Saiu para entrega' },
  { chave: 'entregue', label: 'Entregues' },
];

// Converte "150000" (digitos) → "1.500,00" para exibir no campo
function formatarCampoMoeda(digitos: string): string {
  const limpo = digitos.replace(/\D/g, '');
  if (!limpo) return '';
  const centavos = limpo.padStart(3, '0');
  const reais = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${centavos.slice(-2)}`;
}

// Painel financeiro do mês: quanto entrou, quanto saiu, lucro/prejuízo e demanda
function SecFinanceiro({
  fin,
  loading,
  meses,
  mesAtual,
  onSelecionarMes,
  custosFixosInput,
  onCustosFixosInput,
  salvandoCustos,
  onSalvarCustos,
  onIrProdutos,
  onExportar,
}: {
  fin: FinanceiroResumo | null;
  loading: boolean;
  meses: OpcaoMes[];
  mesAtual: { ano: number; mes: number };
  onSelecionarMes: (m: OpcaoMes) => void;
  custosFixosInput: string;
  onCustosFixosInput: (v: string) => void;
  salvandoCustos: boolean;
  onSalvarCustos: () => void;
  onIrProdutos: () => void;
  onExportar: () => void;
}) {
  const carregando = loading || !fin;
  const pedidos = fin?.pedidos ?? 0;
  const lucro = fin?.lucro ?? 0;
  const prejuizo = lucro < 0;
  // Vendeu no mês, mas nenhum item tem custo → o "lucro" ainda é chute
  const avisoSemCusto =
    (fin?.faturamento ?? 0) > 0 &&
    (fin?.custoMercadoria ?? 0) === 0 &&
    (fin?.itensSemCusto ?? 0) > 0;

  const maxDia = Math.max(...(fin?.serieDiaria ?? []).map(d => d.receita), 1);
  const melhorDia = fin
    ? fin.serieDiaria.reduce((a, b) => (b.receita > a.receita ? b : a), fin.serieDiaria[0])
    : null;

  const stats: { val: string; lbl: string; classe?: string }[] = [
    { val: formatarBRL(fin?.faturamento ?? 0), lbl: 'Faturamento' },
    { val: formatarBRL(fin?.custoMercadoria ?? 0), lbl: 'Custo da mercadoria' },
    { val: formatarBRL(fin?.custoFixo ?? 0), lbl: 'Custo fixo do mês' },
    {
      val: formatarBRL(Math.abs(lucro)),
      lbl: prejuizo ? 'Prejuízo do mês' : 'Lucro do mês',
      classe: prejuizo ? 'gm-red' : 'gm-yellow',
    },
    { val: String(pedidos), lbl: 'Pedidos' },
    { val: formatarBRL(fin?.ticketMedio ?? 0), lbl: 'Ticket médio' },
  ];

  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title"><IconCreditCard size={15} /> Financeiro</h2>
        {pedidos > 0 && (
          <button className="gm-btn-link" onClick={onExportar}>Exportar relatório (CSV)</button>
        )}
      </div>

      {/* Mês analisado */}
      <div className="gm-meses-chips" role="group" aria-label="Escolher o mês do relatório">
        {meses.map(m => (
          <button
            key={`${m.ano}-${m.mes}`}
            type="button"
            className={`gm-mes-chip${mesAtual.ano === m.ano && mesAtual.mes === m.mes ? ' gm-mes-chip--ativo' : ''}`}
            aria-pressed={mesAtual.ano === m.ano && mesAtual.mes === m.mes}
            onClick={() => onSelecionarMes(m)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Custos fixos: o valor que sai todo mês (aluguel, luz, salários) */}
      <div className="gm-fixos-card">
        <div className="gm-fixos-texto">
          <strong>Custos fixos mensais</strong>
          <span>Aluguel, luz, salários e afins — o que sai todo mês mesmo sem vender.</span>
        </div>
        <div className="gm-fixos-acoes">
          <input
            className="gm-fixos-input"
            value={custosFixosInput}
            onChange={e => onCustosFixosInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => onCustosFixosInput(formatarCampoMoeda(custosFixosInput))}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Custos fixos mensais em reais"
          />
          <button className="gm-btn-primary" onClick={onSalvarCustos} disabled={salvandoCustos}>
            {salvandoCustos ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Os números do mês */}
      <div className="gm-stats-row">
        {stats.map((s, i) => (
          <div key={i} className={`gm-stat${carregando ? ' gm-stat--loading' : ''}`} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
            <div className="gm-stat-icon"><IconBarChart size={17} /></div>
            <div className="gm-stat-info">
              <p className={`gm-stat-val${s.classe ? ` ${s.classe}` : ''}`} title={carregando ? undefined : s.val}>{carregando ? '—' : s.val}</p>
              <p className="gm-stat-lbl">{s.lbl}</p>
            </div>
          </div>
        ))}
      </div>

      {avisoSemCusto && (
        <div className="gm-aviso-custo">
          <p>
            Você vendeu no mês, mas os produtos ainda estão <strong>sem custo cadastrado</strong> —
            o lucro mostrado pode não ser o real.
          </p>
          <button className="gm-btn-sec" onClick={onIrProdutos}>Informar custos dos produtos</button>
        </div>
      )}

      <div className="gm-divider" />

      {/* Demanda: receita por dia e o que mais saiu */}
      <div className="gm-dash-grid">
        <div className="gm-chart-card">
          <p className="gm-sec-title" style={{ marginBottom: '1.2rem' }}>
            <IconBarChart size={15} /> Receita por dia — {MESES_CURTO[(fin?.mes ?? 1) - 1]}/{fin?.ano ?? ''}
          </p>

          {carregando ? (
            <div className="gm-chart-loading">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="gm-bar-skeleton" style={{ height: `${SKELETON_HEIGHTS[i]}%` }} />
              ))}
            </div>
          ) : pedidos === 0 ? (
            <EmptyState msg="Nenhum pedido neste mês" />
          ) : (
            <>
              <div className="gm-bar-chart gm-bar-chart--lg gm-bar-chart--diario">
                {(fin?.serieDiaria ?? []).map(d => {
                  const pct = (d.receita / maxDia) * 100;
                  return (
                    <div
                      key={d.dia}
                      className="gm-bar-col"
                      title={`Dia ${d.dia}: ${d.pedidos} pedido${d.pedidos === 1 ? '' : 's'} · ${formatarBRL(d.receita)}`}
                    >
                      <div className="gm-bar-outer">
                        <div
                          className="gm-bar-inner"
                          style={{
                            height: `${Math.max(pct, d.receita > 0 ? 4 : 0)}%`,
                            animationDelay: `${Math.min(0.1 + d.dia * 0.01, 0.5)}s`,
                          }}
                        />
                      </div>
                      <span className="gm-bar-label">{d.dia}</span>
                    </div>
                  );
                })}
              </div>
              {melhorDia && melhorDia.receita > 0 && (
                <p className="gm-diario-resumo">
                  Melhor dia: dia {melhorDia.dia} — {melhorDia.pedidos} pedido{melhorDia.pedidos === 1 ? '' : 's'} · {formatarBRL(melhorDia.receita)}
                </p>
              )}
            </>
          )}

          <div className="gm-legend">
            <span className="gm-legend-dot gm-legend-dot--rec" /> Receita de pedidos
          </div>
        </div>

        <div className="gm-quick-card">
          <p className="gm-sec-title" style={{ marginBottom: '1rem' }}>
            <IconShoppingCart size={15} /> Demanda do mês
          </p>

          {carregando ? (
            <div className="gm-quick-list"><LoadingRow /></div>
          ) : (
            <div className="gm-quick-list">
              {STATUS_DEMANDA.map(s => (
                <div className="gm-quick-row" key={s.chave}>
                  <span>{s.label}</span>
                  <strong>{fin?.porStatus?.[s.chave] ?? 0}</strong>
                </div>
              ))}
              {(fin?.itensSemCusto ?? 0) > 0 && (
                <div className="gm-quick-row">
                  <span>Itens vendidos sem custo</span>
                  <strong className="gm-orange">{fin!.itensSemCusto}</strong>
                </div>
              )}
            </div>
          )}

          <p className="gm-sec-subtitle"><IconPackage size={14} /> Mais vendidos</p>
          {carregando ? (
            <div className="gm-quick-list"><LoadingRow /></div>
          ) : (fin?.topProdutos.length ?? 0) === 0 ? (
            <p className="gm-top-vazio">Sem vendas no mês</p>
          ) : (
            <div className="gm-quick-list">
              {fin!.topProdutos.map(tp => (
                <div className="gm-quick-row" key={tp.nome}>
                  <span className="gm-top-nome"><strong>{tp.qtd}x</strong> {tp.nome}</span>
                  <strong className="gm-yellow">{formatarBRL(tp.receita)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Dias do editor de horário (ordem comercial; id = dia do Date, 0 = domingo)
const DIAS_HORARIO: { id: string; nome: string; curto: string }[] = [
  { id: '1', nome: 'Segunda', curto: 'Seg' }, { id: '2', nome: 'Terça', curto: 'Ter' },
  { id: '3', nome: 'Quarta', curto: 'Qua' }, { id: '4', nome: 'Quinta', curto: 'Qui' },
  { id: '5', nome: 'Sexta', curto: 'Sex' }, { id: '6', nome: 'Sábado', curto: 'Sáb' },
  { id: '0', nome: 'Domingo', curto: 'Dom' },
];

// Horário em uma linha: "Seg–Sex 08:00–18:00 · Sáb 09:00–13:00 · Dom fechado"
function resumirHorario(h: HorarioMercado | null): string {
  if (!h) return 'Não configurado';
  const grupos: { faixa: string; dias: string[] }[] = [];
  for (const d of DIAS_HORARIO) {
    const f = h[d.id];
    const faixa = f ? `${f[0]}–${f[1]}` : 'fechado';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.faixa === faixa) ultimo.dias.push(d.curto);
    else grupos.push({ faixa, dias: [d.curto] });
  }
  return grupos
    .map(g => {
      const dias = g.dias.length > 1 ? `${g.dias[0]}–${g.dias[g.dias.length - 1]}` : g.dias[0];
      return g.faixa === 'fechado' ? `${dias} fechado` : `${dias} ${g.faixa}`;
    })
    .join(' · ');
}

function SecInformacoes({ mercado, onSalvo }: {
  mercado: MercadoInfo | null;
  onSalvo: (atualizado: MercadoInfo) => void;
}) {
  if (!mercado) return <EmptyState msg="Carregando informações..." />;
  return <InfoConteudo mercado={mercado} onSalvo={onSalvo} />;
}

// Modo leitura + edição em linha dos dados do mercado. O "Editar" carrega os
// valores atuais (inclusive o horário) nos campos; o "Salvar" grava no banco
// (PUT /api/mercados/:id) e atualiza a tela com a resposta; o "Cancelar"
// descarta as mudanças. O CNPJ fica somente leitura (é o documento da loja).
function InfoConteudo({ mercado, onSalvo }: {
  mercado: MercadoInfo;
  onSalvo: (atualizado: MercadoInfo) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', rua: '', bairro: '',
    cidade: '', estado: '', cep: '',
  });
  const [horario, setHorario] = useState<Record<string, [string, string] | null>>({});

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

  function set(campo: keyof typeof form, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  function iniciarEdicao() {
    setForm({
      nome: mercado.nome ?? '', telefone: mercado.telefone ?? '', email: mercado.email ?? '',
      rua: mercado.rua ?? '', bairro: mercado.bairro ?? '', cidade: mercado.cidade ?? '',
      estado: mercado.estado ?? '', cep: mercado.cep ?? '',
    });
    setHorario(parseHorario(mercado.horario) ?? {});
    setErro('');
    setEditando(true);
  }

  function alternarDia(dia: string) {
    setHorario(h => ({ ...h, [dia]: h[dia] ? null : ['08:00', '18:00'] }));
  }

  function setHora(dia: string, campo: 0 | 1, valor: string) {
    setHorario(h => {
      const faixa = h[dia] ?? ['08:00', '18:00'];
      const nova: [string, string] = [faixa[0], faixa[1]];
      nova[campo] = valor;
      return { ...h, [dia]: nova };
    });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro('O nome é obrigatório.');
      return;
    }
    // Horário: envia só os dias abertos, conferindo os horários
    const horarioEnvio = Object.fromEntries(
      Object.entries(horario).filter(([, f]) => f !== null) as [string, [string, string]][]
    );
    if (Object.values(horarioEnvio).some(f => !f[0] || !f[1] || f[0] === f[1])) {
      setErro('Confira o horário: abertura e fechamento precisam ser diferentes.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const res = await api.atualizarMercado(mercado.id_mercado, {
        nome: form.nome.trim(),
        telefone: form.telefone.replace(/\D/g, ''),
        email: form.email.trim(),
        rua: form.rua.trim(),
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado.trim(),
        cep: form.cep.replace(/\D/g, ''),
        horario: horarioEnvio,
      });
      setEditando(false);
      onSalvo({ ...mercado, ...form, ...(res.mercado ?? {}) } as MercadoInfo);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar as informações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title"><IconInfo size={15} /> Informações do Mercado</h2>
        {editando ? (
          <span className="gm-info-editando-tag">Editando…</span>
        ) : (
          <button className="gm-btn-link" onClick={iniciarEdicao}>Editar</button>
        )}
      </div>

      {editando ? (
        <div className="gm-info-edit">
          <div className="gm-info-edit-grid">
            <label className="gm-info-campo">
              Nome do mercado
              <input className="gm-modal-input" value={form.nome} maxLength={80}
                onChange={e => set('nome', removeEmojis(e.target.value))} />
            </label>
            <label className="gm-info-campo">
              E-mail
              <input className="gm-modal-input" type="email" value={form.email}
                onChange={e => set('email', e.target.value)} />
            </label>
            <label className="gm-info-campo">
              Telefone (só números, com DDD)
              <input className="gm-modal-input" value={form.telefone.replace(/\D/g, '').slice(0, 11)}
                onChange={e => set('telefone', e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </label>
            <label className="gm-info-campo">
              CEP (só números)
              <input className="gm-modal-input" value={form.cep.replace(/\D/g, '').slice(0, 8)}
                onChange={e => set('cep', e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </label>
            <label className="gm-info-campo gm-info-campo--full">
              Rua
              <input className="gm-modal-input" value={form.rua}
                onChange={e => set('rua', removeEmojis(e.target.value))} />
            </label>
            <label className="gm-info-campo">
              Bairro
              <input className="gm-modal-input" value={form.bairro}
                onChange={e => set('bairro', removeEmojis(e.target.value))} />
            </label>
            <label className="gm-info-campo">
              Cidade
              <input className="gm-modal-input" value={form.cidade}
                onChange={e => set('cidade', removeEmojis(e.target.value))} />
            </label>
            <label className="gm-info-campo">
              Estado (UF)
              <input className="gm-modal-input" value={form.estado.toUpperCase()} maxLength={2}
                onChange={e => set('estado', e.target.value.replace(/[^a-zA-Z]/g, ''))} />
            </label>
          </div>

          <p className="gm-info-subtitulo"><IconClock size={13} /> Horário de funcionamento</p>
          <div className="gm-info-horario">
            {DIAS_HORARIO.map(d => {
              const aberto = !!horario[d.id];
              const faixa = horario[d.id] ?? ['08:00', '18:00'];
              return (
                <div key={d.id} className={`gm-info-dia${aberto ? ' aberto' : ''}`}>
                  <label>
                    <input type="checkbox" checked={aberto} onChange={() => alternarDia(d.id)} />
                    {d.nome}
                  </label>
                  {aberto ? (
                    <div className="gm-info-horas">
                      <input type="time" value={faixa[0]} aria-label={`Abertura ${d.nome}`}
                        onChange={e => setHora(d.id, 0, e.target.value)} />
                      <span>às</span>
                      <input type="time" value={faixa[1]} aria-label={`Fechamento ${d.nome}`}
                        onChange={e => setHora(d.id, 1, e.target.value)} />
                    </div>
                  ) : (
                    <span className="gm-info-fechado">fechado</span>
                  )}
                </div>
              );
            })}
          </div>

          {erro && <p className="gm-info-erro">{erro}</p>}

          <div className="gm-info-acoes">
            <button className="gm-btn-link" onClick={() => setEditando(false)} disabled={salvando}>
              Cancelar
            </button>
            <button className="gm-btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      ) : (
        <div className="gm-info-grid">
          <div className="gm-info-card">
            <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> Endereço</span><span className="gm-info-val">{mercado.rua}, {mercado.bairro}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconPhone size={13} /> Telefone</span><span className="gm-info-val">{formatarTelefone(mercado.telefone)}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconMail size={13} /> E-mail</span><span className="gm-info-val">{mercado.email}</span></div>
          </div>
          <div className="gm-info-card">
            <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> Cidade</span><span className="gm-info-val">{mercado.cidade} - {mercado.estado}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> CEP</span><span className="gm-info-val">{formatarCEP(mercado.cep)}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconMapPin size={13} /> Bairro</span><span className="gm-info-val">{mercado.bairro}</span></div>
          </div>
          <div className="gm-info-card">
            <div className="gm-info-row"><span className="gm-info-lbl"><IconCreditCard size={13} /> CNPJ</span><span className="gm-info-val">{formatarCNPJ(mercado.cnpj)}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconStore size={13} /> Nome</span><span className="gm-info-val">{mercado.nome}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconClock size={13} /> Horário</span><span className="gm-info-val">{resumirHorario(parseHorario(mercado.horario))}</span></div>
          </div>
        </div>
      )}
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
  const {toasts, showToast, dismissToast } = useToast();
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [pedidosExpandidos, setPedidosExpandidos] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [avaliacoesLoading, setAvaliacoesLoading] = useState(true);
  const [avaliacoesExpandidas, setAvaliacoesExpandidas] = useState(false);

  // Painel financeiro (aba Financeiro): mês escolhido + dados do servidor
  const [finMes, setFinMes] = useState<{ ano: number; mes: number }>(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });
  const [fin, setFin] = useState<FinanceiroResumo | null>(null);
  const [finLoading, setFinLoading] = useState(true);
  const [custosFixosInput, setCustosFixosInput] = useState('');
  const [salvandoCustos, setSalvandoCustos] = useState(false);

  const [dados, setDados] = useState<DadosMercado>({
    mercado: null,
    produtos: [],
    totalCategorias: 0,
    totalProdutos: 0,
    plano: 'basico',
    limites: { produtos: 300, fotos: 600 },
    uso: { produtos: 0, fotos: 0 },
    resumo: null,
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
          plano: data.plano ?? 'basico',
          limites: data.limites ?? { produtos: 300, fotos: 600 },
          uso: data.uso ?? { produtos: data.totalProdutos ?? 0, fotos: 0 },
          resumo: data.resumo ?? null,
          loading: false,
        });
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        setDados(prev => ({ ...prev, loading: false }));
      }
    }
    carregarDashboard();

    // Pedidos reais recebidos pelo mercado (visão do vendedor)
    (async () => {
      setPedidosLoading(true);
      try {
        const data = await api.listarPedidosMercado(mercadoId);
        setPedidos(
          (data.pedidos ?? []).map((p: {
            id: number; cliente: string; itens: string; valorTotal: number;
            dataCompra: string; status: 'pendente' | 'preparo' | 'caminho' | 'entregue';
            observacao?: string;
          }): Pedido => {
            const info = STATUS_PEDIDO[p.status] ?? STATUS_PEDIDO.pendente;
            return {
              id: p.id,
              num: `#${p.id}`,
              cliente: p.cliente,
              itens: p.itens,
              preco: formatarBRL(p.valorTotal),
              valorNum: p.valorTotal,
              data: p.dataCompra,
              status: info.chave,
              statusAtual: p.status,
              label: info.label,
              observacao: (p.observacao ?? '').trim(),
            };
          })
        );
      } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
      } finally {
        setPedidosLoading(false);
      }
    })();

    // Avaliações reais recebidas pelo mercado
    (async () => {
      setAvaliacoesLoading(true);
      try {
        const data = await api.avaliacoesMercado(mercadoId);
        setAvaliacoes(
          (data.avaliacoes ?? []).map((a: { nota: number; texto: string; cliente: string }): Avaliacao => ({
            iniciais: a.cliente
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map(p => p[0]?.toUpperCase() ?? '')
              .join(''),
            nome: a.cliente,
            n: a.nota,
            texto: a.texto || 'Sem comentário.',
          }))
        );
      } catch (err) {
        console.error('Erro ao carregar avaliações:', err);
      } finally {
        setAvaliacoesLoading(false);
      }
    })();
  }, [mercadoId]);

  // Financeiro do mês escolhido (faturamento, custos, lucro e demanda)
  useEffect(() => {
    let vivo = true;
    async function carregarFinanceiro() {
      setFinLoading(true);
      try {
        const data: FinanceiroResumo = await api.financeiroMercado(mercadoId, finMes.ano, finMes.mes);
        if (!vivo) return;
        setFin(data);
        setCustosFixosInput(formatarCampoMoeda(
          String(Math.round((Number(data.custoFixo) || 0) * 100))
        ));
      } catch (err) {
        console.error('Erro ao carregar financeiro:', err);
        if (vivo) setFin(null);
      } finally {
        if (vivo) setFinLoading(false);
      }
    }
    carregarFinanceiro();
    return () => { vivo = false; };
  }, [mercadoId, finMes]);

  // Salva os custos fixos mensais do mercado (aluguel, luz, salários...)
  async function salvarCustosFixos() {
    const valor = Number(custosFixosInput.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) {
      showToast('erro', 'Informe um valor válido para os custos fixos.');
      return;
    }
    setSalvandoCustos(true);
    try {
      await api.atualizarMercado(mercadoId, { custos_fixos: valor });
      setFin(prev => prev
        ? { ...prev, custoFixo: valor, lucro: Math.round((prev.faturamento - prev.custoMercadoria - valor) * 100) / 100 }
        : prev);
      showToast('sucesso', 'Custos fixos mensais salvos.');
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível salvar os custos fixos.');
    } finally {
      setSalvandoCustos(false);
    }
  }

  // Vendedor avança o status de um pedido (pendente → preparo → caminho → entregue)
  async function handleAvancarStatus(p: Pedido) {
    const proximo = PROXIMO_STATUS[p.statusAtual];
    if (!proximo) return;
    try {
      await api.atualizarStatusPedido(p.id, proximo);
      const info = STATUS_PEDIDO[proximo];
      setPedidos(prev =>
        prev.map(x => (x.id === p.id ? { ...x, status: info.chave, statusAtual: proximo, label: info.label } : x))
      );
      showToast('sucesso', `Pedido #${p.id} agora está "${info.label}".`);
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível atualizar o pedido.');
    }
  }

  // Receita real por mês (últimos 6 meses), calculada dos pedidos recebidos
  const financeiro = useMemo<FinanceiroMes[]>(() => {
    const agora = new Date();
    const porMes: FinanceiroMes[] = [];
    for (let i = 5; i >= 0; i--) {
      const ref = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const total = pedidos
        .filter(p => {
          const d = new Date(p.data);
          return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
        })
        .reduce((soma, p) => soma + p.valorNum, 0);
      porMes.push({ mes: MESES_CURTO[ref.getMonth()], val: Math.round(total * 100) / 100 });
    }
    return porMes;
  }, [pedidos]);

  // Chips dos últimos 6 meses (para trocar o mês do painel financeiro)
  const mesesFin = useMemo<OpcaoMes[]>(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      return {
        ano: d.getFullYear(),
        mes: d.getMonth() + 1,
        label: `${MESES_CURTO[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      };
    });
  }, []);

  // Exporta os pedidos em CSV (abre no Excel/Google Planilhas)
  function handleExportarRelatorio() {
    const cabecalho = 'Pedido;Cliente;Itens;Valor (R$);Data;Status;Observação';
    const linhas = pedidos.map(p => {
      const data = new Date(p.data).toLocaleString('pt-BR');
      const obs = (p.observacao ?? '').replace(/"/g, '""');
      return `${p.num};${p.cliente};"${p.itens}";${p.valorNum.toFixed(2).replace('.', ',')};${data};${p.label};"${obs}"`;
    });
    const csv = [cabecalho, ...linhas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-${mercado?.slug ?? mercadoId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('sucesso', 'Relatório de pedidos exportado (CSV).');
  }

  const { mercado, produtos, totalCategorias, totalProdutos, plano, limites, uso, resumo, loading } = dados;

  // Status ao vivo do mercado na lateral: muda entre Aberto/Fechado sozinho,
  // sem recarregar a página, quando bate o horário configurado.
  // null = dashboard ainda carregando (chip neutro, sem mentir "Aberto")
  const [agoraMkt, setAgoraMkt] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgoraMkt(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const lojaAbertaAgora = mercado
    ? estaAberto(parseHorario(mercado.horario ?? null), agoraMkt) ?? true
    : null;

  function handleProdutoSalvo(atualizado: Produto) {
    setDados(prev => ({
      ...prev,
      produtos: prev.produtos.map(p =>
        p.id_produto === atualizado.id_produto ? { ...p, ...atualizado } : p
      ),
    }));
    setProdutoEditando(null);
    showToast('sucesso', 'Produto atualizado com sucesso!');
  }

  // edição das informações do mercado (aba Informações): atualiza a tela
  // com o que o servidor salvou e avisa o usuário
  function handleInfoSalva(atualizado: MercadoInfo) {
    setDados(prev => ({ ...prev, mercado: { ...prev.mercado!, ...atualizado } }));
    showToast('sucesso', 'Informações atualizadas com sucesso!');
  }

  const stats: Stat[] = [
    { val: String(totalProdutos), lbl: 'Produtos' },
    { val: String(totalCategorias), lbl: 'Categorias' },
    { val: String(resumo?.pedidosHoje ?? 0), lbl: 'Pedidos hoje' },
    { val: `${(resumo?.avaliacaoMedia ?? 0).toFixed(1)} ★`, lbl: 'Avaliação' },
  ];

  const SECTIONS = [
    <SecDashboard
      stats={stats}
      financeiro={financeiro}
      loading={loading}
      slug={mercado?.slug}
      plano={plano}
      uso={uso}
      limites={limites}
      resumo={resumo}
    />,
    <SecProdutos produtos={produtos} loading={loading} onEditar={setProdutoEditando} />,
    <SecPedidos
      pedidos={pedidosExpandidos ? pedidos : pedidos.slice(0, 5)}
      loading={pedidosLoading}
      onAvancar={handleAvancarStatus}
      expandido={pedidosExpandidos}
      onAlternar={() => setPedidosExpandidos(v => !v)}
      total={pedidos.length}
    />,
    <SecAvaliacoes
      avaliacoes={avaliacoesExpandidas ? avaliacoes : avaliacoes.slice(0, 4)}
      loading={avaliacoesLoading}
      expandidas={avaliacoesExpandidas}
      onAlternar={() => setAvaliacoesExpandidas(v => !v)}
      total={avaliacoes.length}
    />,
    <SecFinanceiro
      fin={fin}
      loading={finLoading}
      meses={mesesFin}
      mesAtual={finMes}
      onSelecionarMes={setFinMes}
      custosFixosInput={custosFixosInput}
      onCustosFixosInput={setCustosFixosInput}
      salvandoCustos={salvandoCustos}
      onSalvarCustos={salvarCustosFixos}
      onIrProdutos={() => setNav(1)}
      onExportar={handleExportarRelatorio}
    />,
    <SecInformacoes mercado={mercado} onSalvo={handleInfoSalva} />,
  ];

  return (
    <div className="gm-shell">

      {/* SIDEBAR */}
      <aside className="gm-sidebar">
        <div className="gm-mkt-identity">
          <div className="gm-mkt-logo">
            {mercado?.foto_perfil
              ? <img src={mercado.foto_perfil} alt={mercado.nome} className="gm-mkt-logo-img" />
              : <IconShoppingCart size={24} />
            }
          </div>
          <p className="gm-mkt-nome">{mercado?.nome ?? 'Carregando...'}</p>
          <p className="gm-mkt-sub">{mercado?.cidade ?? ''} · {mercado?.estado ?? ''}</p>
          <span
            className={`gm-status-open${
              lojaAbertaAgora === null
                ? ' gm-status-open--neutro'
                : lojaAbertaAgora
                  ? ''
                  : ' gm-status-open--fechado'
            }`}
          >
            {lojaAbertaAgora === null
              ? '● …'
              : lojaAbertaAgora
                ? '● Aberto agora'
                : '● Fechado agora'}
          </span>
        </div>
        <nav className="gm-nav">
          {SIDEBAR_NAV.map((item, i) => (
            <button
              key={i}
              className={`gm-nav-btn${nav === i ? ' active' : ''}`}
              style={{ animationDelay: `${0.18 + i * 0.06}s` }}
              aria-label={item.label}
              onClick={() => setNav(i)}
            >
              <span className="gm-nav-icon">{item.icon}</span>
              <span className="gm-nav-label">{item.label}</span>
              {nav === i && <span className="gm-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="gm-sidebar-footer">
        </div>
      </aside>

      {/* MAIN */}
      <main className="gm-main">
        <div className="gm-topbar">
          <div className="gm-topbar-left">
            <button className="gm-btn-back" onClick={onVoltar}>
              <IconArrowLeft size={14} /> Meus mercados
            </button>
            <span className="gm-topbar-title">
              {SIDEBAR_NAV[nav].icon} {SIDEBAR_NAV[nav].label}
            </span>
          </div>
          <div className="gm-topbar-actions">
            <button className="gm-btn-sec" onClick={onAbrirVitrine}>
              <IconEye size={14} /> Ver vitrine
            </button>
          </div>
        </div>

        <div className="gm-content" key={nav}>
          {SECTIONS[nav]}
        </div>
      </main>

      {produtoEditando && (
        <EditarProdutoModal
          produto={produtoEditando}
          mercadoId={mercadoId}
          onFechar={() => setProdutoEditando(null)}
          onSalvo={handleProdutoSalvo}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}