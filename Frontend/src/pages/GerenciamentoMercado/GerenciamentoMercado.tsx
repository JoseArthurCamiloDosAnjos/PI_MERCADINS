import { useState, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './GerenciamentoMercado.css';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { removeEmojis } from '../../hooks/useBlockEmojis';
import { parseHorario, estaAberto, type HorarioMercado } from '../../utils/horario';
import { buscarCep } from '../../utils/cep';
import ToastContainer from '../../components/Toast';
import Imagem from '../../components/Imagem';
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
  IconTag,
  IconTruck,
  IconReceipt,
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
  status: 'entregue' | 'caminho' | 'preparo' | 'novo' | 'aguardando' | 'cancelado';   // chave visual (badge)
  statusAtual: 'pendente' | 'preparo' | 'caminho' | 'entregue' | 'aguardando_pagamento' | 'cancelado'; // valor real do banco
  label: string;
  observacao?: string;
  // Entrega, retirada, cupom e agendamento (B2/B3/B10)
  tipoEntrega: 'entrega' | 'retirada';
  // Endereço para entregar (item 1) — só quando a compra é entregue
  enderecoEntrega?: string;
  taxaEntrega: number;
  agendamento?: string;
  cupom?: string;
  desconto: number;
  // Como o cliente vai pagar (B3): na entrega, Pix ou cartão
  formaPagamento: 'presencial' | 'pix' | 'cartao';
}

interface Avaliacao {
  id: number;
  iniciais: string;
  nome: string;
  n: number;
  texto: string;
  oculta: boolean;      // B6 — ocultada pelo vendedor (some do site)
  produto?: string;     // avaliações de produtos mostram o nome do item
  produtoId?: number;
  categoriaId?: number;
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
  // Repasses do mês (Asaas Split): dinheiro dos pedidos online
  recebimento?: {
    walletCadastrado: boolean;
    liquidado: number;          // já caiu na conta do vendedor
    pendente: number;           // split em análise/pendente
    retidoPlataforma: number;   // ficou na conta da plataforma
  };
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
  descricao?: string;
  foto_perfil?: string;
  horario?: string | null;
  // Entrega e retirada (B2)
  taxa_entrega?: number | string | null;
  pedido_minimo?: number | string | null;
  oferece_entrega?: boolean | null;
  oferece_retirada?: boolean | null;
  // Carteira Asaas do vendedor (pedidos online pagos direto pra conta dele)
  asaas_wallet_id?: string | null;
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
// 'pendente' é o status inicial de todo pedido pago/na entrega (chave: 'novo');
// pagamentos online entram como 'aguardando_pagamento' e só viram 'pendente'
// quando o Asaas confirma o Pix/cartão
const STATUS_PEDIDO: Record<string, { chave: Pedido['status']; label: string }> = {
  aguardando_pagamento: { chave: 'aguardando', label: 'Aguardando pagamento' },
  pendente: { chave: 'novo',     label: 'Novo' },
  preparo:  { chave: 'preparo',  label: 'Em preparo' },
  caminho:  { chave: 'caminho',  label: 'A caminho' },
  entregue: { chave: 'entregue', label: 'Entregue' },
  cancelado: { chave: 'cancelado', label: 'Cancelado' },
};

// Próximo passo de cada status de fluxo normal. Aguardando pagamento e
// cancelado não têm próximo passo (o pagamento confirma ou o pedido cai fora).
const PROXIMO_STATUS: Partial<Record<Pedido['statusAtual'], 'pendente' | 'preparo' | 'caminho' | 'entregue'>> = {
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
  { icon: <IconTag size={18} />, label: 'Cupons' },
  { icon: <IconCreditCard size={18} />, label: 'Financeiro' },
  { icon: <IconReceipt size={18} />, label: 'Recebimento' },
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

// ─── Máscara de moeda ─────────────────────────────────────────────────────────
// Formata o valor a cada tecla (não só no blur): aceita a vírgula como
// decimal — digitar "7,50" mostra 7,50 na hora — separa os milhares com
// ponto e limita a 2 casas decimais. Devolve também onde o cursor deve
// ficar, para a formatação não puxar o ponteiro para o fim do campo.
function formatarMoedaDigitando(entrada: string, cursor: number): { texto: string; cursor: number } {
  // O que é decimal? A vírgula manda; o ponto só é decimal quando não é
  // padrão de milhar ("1.500") nem está seguido de nada ("1500.")
  let inteiro: string;
  let decimal: string | null = null;
  let sepIdx = -1; // índice do separador decimal em `entrada`

  const virgula = entrada.indexOf(',');
  if (virgula !== -1) {
    sepIdx = virgula;
    inteiro = entrada.slice(0, virgula).replace(/\D/g, '');
    decimal = entrada.slice(virgula + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    const ponto = entrada.lastIndexOf('.');
    const depois = ponto === -1 ? '' : entrada.slice(ponto + 1);
    const ehMilhar = /^\d{1,3}(\.\d{3})+$/.test(entrada);
    if (ponto !== -1 && !ehMilhar && depois.replace(/\D/g, '').length <= 2) {
      sepIdx = ponto;
      inteiro = entrada.slice(0, ponto).replace(/\D/g, '');
      decimal = depois.replace(/\D/g, '').slice(0, 2);
    } else {
      inteiro = entrada.replace(/\D/g, '');
    }
  }

  // Zero à esquerda só atrapalha ("07" → "7"), mas o zero sozinho fica
  if (inteiro.length > 1) inteiro = inteiro.replace(/^0+(?=\d)/, '');
  if (inteiro.length > 9) inteiro = inteiro.slice(0, 9);

  const inteiroFmt = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Sem reais ainda, a vírgula ganha um "0" para se apoiar (",5" → "0,5")
  const sintetizouZero = decimal !== null && inteiro === '';
  const texto = decimal === null ? inteiroFmt : `${inteiroFmt || '0'},${decimal}`;

  // Caracteres com peso antes do cursor: dígitos + o separador decimal.
  // Os pontos de milhar não contam, senão o cursor anda errado por eles.
  let alvo = 0;
  for (let i = 0; i < cursor && i < entrada.length; i++) {
    const c = entrada[i];
    if (c >= '0' && c <= '9') alvo++;
    else if (i === sepIdx) alvo++;
  }
  if (sintetizouZero && alvo > 0) alvo++; // o "0" inventado desloca tudo

  // Anda pelo texto formatado até achar a mesma quantidade de pesos
  let pos = texto.length;
  if (alvo === 0) {
    pos = 0;
  } else {
    let vistos = 0;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if ((c >= '0' && c <= '9') || c === ',') {
        vistos++;
        if (vistos === alvo) { pos = i + 1; break; }
      }
    }
  }

  return { texto, cursor: pos };
}

// No blur o valor ganha as casas que faltam: "7" → "7,00" e "7,5" → "7,50"
function completarMoeda(valor: string): string {
  if (!valor) return '';
  const { texto } = formatarMoedaDigitando(valor, valor.length);
  if (!texto) return '';
  if (!texto.includes(',')) return `${texto},00`;
  const [inteiro, decimal = ''] = texto.split(',');
  return `${inteiro},${decimal.padEnd(2, '0')}`;
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

  // Campos de preço/custo: a máscara formata a cada tecla e o cursor volta
  // para onde a pessoa estava digitando (o React reescreve o valor ao
  // renderizar e, sem este passo, ele pularia para o fim do campo).
  const precoRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);
  const cursorPreco = useRef<number | null>(null);
  const cursorCusto = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (cursorPreco.current !== null && precoRef.current) {
      precoRef.current.setSelectionRange(cursorPreco.current, cursorPreco.current);
      cursorPreco.current = null;
    }
  }, [preco]);

  useLayoutEffect(() => {
    if (cursorCusto.current !== null && custoRef.current) {
      custoRef.current.setSelectionRange(cursorCusto.current, cursorCusto.current);
      cursorCusto.current = null;
    }
  }, [custo]);

  function handleChangePreco(e: ChangeEvent<HTMLInputElement>) {
    const alvo = e.target;
    const { texto, cursor } = formatarMoedaDigitando(alvo.value, alvo.selectionStart ?? alvo.value.length);
    cursorPreco.current = cursor;
    setPreco(texto);
  }

  // Saiu do campo: completa as casas decimais que faltam ("7" → "7,00")
  function handleBlurPreco() {
    setPreco(atual => completarMoeda(atual));
  }

  function handleChangeCusto(e: ChangeEvent<HTMLInputElement>) {
    const alvo = e.target;
    const { texto, cursor } = formatarMoedaDigitando(alvo.value, alvo.selectionStart ?? alvo.value.length);
    cursorCusto.current = cursor;
    setCusto(texto);
  }

  function handleBlurCusto() {
    setCusto(atual => completarMoeda(atual));
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      setErro('O nome é obrigatório.');
      return;
    }
    // Valida pelo número (não pela string): cobre "0", "0,00" e "0,0"
    const precoNum = Number(preco.replace(/\./g, '').replace(',', '.'));
    if (!preco || !Number.isFinite(precoNum) || precoNum <= 0) {
      setErro('O preço é obrigatório.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        preco: precoNum,
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
              ref={precoRef}
              className="gm-modal-input"
              value={preco}
              onChange={handleChangePreco}
              onBlur={handleBlurPreco}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>

          <label className="gm-modal-label">
            Custo (R$)
            <input
              ref={custoRef}
              className="gm-modal-input"
              value={custo}
              onChange={handleChangeCusto}
              onBlur={handleBlurCusto}
              inputMode="decimal"
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
          {produtos.map((p) => {
            // Margem sobre o custo cadastrado (B6): o lojista vê o quanto cada
            // unidade dá de lucro; sem custo, não calcula.
            const preco = Number(p.preco) || 0;
            const custo = Number(p.custo) || 0;
            const temCusto = custo > 0 && preco > 0;
            const margem = temCusto ? preco - custo : 0;
            const margemPct = temCusto ? (margem / custo) * 100 : 0;
            const estoque = p.estoque ?? 0;
            return (
            <div key={p.id_produto} className="gm-prod-card">
              <div className="gm-prod-img">
                {p.imagem ? <Imagem src={p.imagem} alt={p.nome} sizes="(max-width: 600px) 50vw, 160px" /> : <IconPackage size={26} />}
              </div>
              <div className="gm-prod-body">
                <p className="gm-prod-nome">{p.nome}</p>
                {p.preco != null && <p className="gm-prod-preco">R$ {Number(p.preco).toFixed(2)}</p>}
                <p className="gm-prod-categoria">{p.categoria}</p>
                {/* Estoque: avisa quando está acabando ou esgotado */}
                {estoque <= 0 ? (
                  <span className="gm-prod-estoque gm-prod-estoque--esgotado">Esgotado</span>
                ) : estoque <= 5 ? (
                  <span className="gm-prod-estoque gm-prod-estoque--baixo">Estoque baixo: {estoque} un.</span>
                ) : null}
                {/* Margem de lucro por unidade */}
                {temCusto && (
                  <p className="gm-prod-margem" title={`Custo: ${formatarBRL(custo)} por unidade`}>
                    Margem: {formatarBRL(margem)} ({margemPct.toFixed(0)}%)
                  </p>
                )}
                {p.descricao && <p className="gm-prod-desc">{p.descricao}</p>}
              </div>
              <button className="gm-prod-editar" onClick={() => onEditar(p)} title="Editar produto">
                ✎
              </button>
            </div>
            );
          })}
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
                ) : p.statusAtual === 'entregue' ? (
                  <span className="gm-pedido-check" title="Pedido concluído">✓</span>
                ) : (
                  // Aguardando pagamento ou cancelado: sem ação para o vendedor
                  <span className="gm-pedido-check" title="Sem ação disponível">—</span>
                )}
                {p.observacao && (
                  <span className="gm-pedido-obs" title="Observação do cliente">
                    <IconInfo size={12} /> {p.observacao}
                  </span>
                )}
                {p.enderecoEntrega && (
                  <span className="gm-pedido-obs" title="Endereço de entrega do cliente">
                    <IconMapPin size={12} /> {p.enderecoEntrega}
                  </span>
                )}
                {(p.tipoEntrega === 'retirada' || p.taxaEntrega > 0 || p.cupom || p.agendamento || p.formaPagamento !== 'presencial') && (
                  <span className="gm-pedido-obs" title="Entrega, agendamento, pagamento e cupom do pedido">
                    <IconTruck size={12} />{' '}
                    {p.tipoEntrega === 'retirada'
                      ? 'Retirada no balcão'
                      : p.taxaEntrega > 0
                        ? `Entrega ${formatarBRL(p.taxaEntrega)}`
                        : 'Entrega grátis'}
                    {p.agendamento ? ` · ${p.agendamento}` : ''}
                    {p.formaPagamento === 'pix' ? ' · Pago com Pix' : p.formaPagamento === 'cartao' ? ' · Pago com cartão' : ''}
                    {p.cupom ? ` · Cupom ${p.cupom} (− ${formatarBRL(p.desconto)})` : ''}
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

// B6 — Iniciais do cliente para o avatar (reaproveitado nas duas listas)
function iniciaisDe(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Cartão de avaliação com o botão de moderação (B6): quem modera vê
// "Ocultar do site"; as ocultas aparecem marcadas e com "Exibir no site"
function CartaoAvaliacao({ a, onAlternar }: { a: Avaliacao; onAlternar?: () => void }) {
  return (
    <div className={`gm-review-card${a.oculta ? ' gm-review-card--oculta' : ''}`}>
      <div className="gm-rev-header">
        <div className="gm-rev-avatar">{a.iniciais}</div>
        <p className="gm-rev-nome">{a.nome}</p>
        {a.oculta && <span className="gm-rev-oculta-badge">Oculta do site</span>}
      </div>
      <Stars n={a.n} />
      {a.produto && <p className="gm-rev-produto">{a.produto}</p>}
      <p className="gm-rev-text">{a.texto}</p>
      {onAlternar && (
        <button
          className={`gm-rev-moderar${a.oculta ? ' is-exibir' : ''}`}
          onClick={onAlternar}
          type="button"
        >
          {a.oculta ? 'Exibir no site' : 'Ocultar do site'}
        </button>
      )}
    </div>
  );
}

function SecAvaliacoes({
  avaliacoes,
  avaliacoesProdutos,
  loading,
  expandidas,
  onAlternar,
  total,
  moderando,
  onModerar,
  onModerarProduto,
}: {
  avaliacoes: Avaliacao[];
  avaliacoesProdutos: Avaliacao[];
  loading: boolean;
  expandidas: boolean;
  onAlternar: () => void;
  total: number;
  moderando: boolean;
  onModerar: (a: Avaliacao) => void;
  onModerarProduto: (a: Avaliacao) => void;
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
          {avaliacoes.map((a) => (
            <CartaoAvaliacao
              key={a.id}
              a={a}
              onAlternar={moderando ? () => onModerar(a) : undefined}
            />
          ))}
        </div>
      )}

      {/* B6 — Moderação das avaliações de PRODUTOS da loja (só o dono vê) */}
      {moderando && avaliacoesProdutos.length > 0 && (
        <>
          <div className="gm-sec-row" style={{ marginTop: 22 }}>
            <h2 className="gm-sec-title"><IconStar size={15} /> Avaliações de produtos</h2>
          </div>
          <div className="gm-reviews-grid">
            {avaliacoesProdutos.map((a) => (
              <CartaoAvaliacao
                key={`p${a.id}`}
                a={a}
                onAlternar={() => onModerarProduto(a)}
              />
            ))}
          </div>
        </>
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
  onIrRecebimento,
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
  onIrRecebimento: () => void;
  onExportar: () => void;
}) {
  // Mesma máscara do modal de produto: formata a cada tecla e devolve o
  // cursor para onde a pessoa estava digitando
  const fixosRef = useRef<HTMLInputElement>(null);
  const cursorFixos = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (cursorFixos.current !== null && fixosRef.current) {
      fixosRef.current.setSelectionRange(cursorFixos.current, cursorFixos.current);
      cursorFixos.current = null;
    }
  }, [custosFixosInput]);

  function handleChangeFixos(e: ChangeEvent<HTMLInputElement>) {
    const alvo = e.target;
    const { texto, cursor } = formatarMoedaDigitando(alvo.value, alvo.selectionStart ?? alvo.value.length);
    cursorFixos.current = cursor;
    onCustosFixosInput(texto);
  }

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
            ref={fixosRef}
            className="gm-fixos-input"
            value={custosFixosInput}
            onChange={handleChangeFixos}
            onBlur={() => onCustosFixosInput(completarMoeda(custosFixosInput))}
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

      {/* Repasse dos pedidos online (Asaas Split) */}
      {!carregando && fin?.recebimento && (
        <div className="gm-fixos-card">
          <div className="gm-fixos-texto">
            <strong>
              {fin.recebimento.walletCadastrado
                ? 'Recebimento direto na sua conta Asaas'
                : 'Pedidos online na conta da plataforma'}
            </strong>
            <span>
              {fin.recebimento.walletCadastrado
                ? 'O Pix/cartão dos pedidos é repassado automaticamente para a sua carteira Asaas (100%, sem comissão).'
                : 'Cadastre o Wallet ID do Asaas em Informações para o dinheiro dos pedidos online cair direto na sua conta.'}
            </span>
          </div>
          <div className="gm-fixos-acoes" style={{ gap: '1.2rem', flexWrap: 'wrap' }}>
            <div className="gm-stat-info">
              <p className="gm-stat-val gm-yellow">{formatarBRL(fin.recebimento.liquidado)}</p>
              <p className="gm-stat-lbl">Liquidado no mês</p>
            </div>
            <div className="gm-stat-info">
              <p className="gm-stat-val">{formatarBRL(fin.recebimento.pendente)}</p>
              <p className="gm-stat-lbl">Pendente</p>
            </div>
            {fin.recebimento.retidoPlataforma > 0 && (
              <div className="gm-stat-info">
                <p className="gm-stat-val gm-red">{formatarBRL(fin.recebimento.retidoPlataforma)}</p>
                <p className="gm-stat-lbl">Retido na plataforma</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sem Wallet ID: o Pix/cartão dos pedidos online fica na conta da
          plataforma em vez de cair direto na conta do vendedor */}
      {!carregando && fin?.recebimento && !fin.recebimento.walletCadastrado && (
        <div className="gm-aviso-custo">
          <p>
            Seus pagamentos online estão caindo <strong>na conta da plataforma</strong> —
            crie sua conta Asaas na aba Recebimento (automático, um clique) para o valor
            das vendas cair direto na sua conta.
          </p>
          <button className="gm-btn-sec" onClick={onIrRecebimento}>Criar conta Asaas</button>
        </div>
      )}

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
  // aviso null = atualiza a tela sem mostrar o toast padrão (usado pela
  // criação automática da conta Asaas, que tem aviso próprio)
  onSalvo: (atualizado: MercadoInfo, aviso?: string | null) => void;
}) {
  if (!mercado) return <EmptyState msg="Carregando informações..." />;
  return <InfoConteudo mercado={mercado} onSalvo={onSalvo} />;
}

// ─── Recebimento dos pedidos online (aba própria) ─────────────────────────────
// Status do split + criação automática da conta Asaas (wallet) + campo
// manual para quem já tem carteira. Fica FORA de Informações de propósito:
// é configuração de pagamento, não dado cadastrais nem de entrega.

// Tipos de empresa aceitos pelo Asaas em companyType (exigido na criação
// da subconta para CNPJ) — o vendedor escolhe no painel antes de criar
const TIPOS_EMPRESA = [
  { valor: 'MEI', nome: 'MEI' },
  { valor: 'LIMITED', nome: 'Ltda' },
  { valor: 'INDIVIDUAL', nome: 'Empresário individual' },
  { valor: 'ASSOCIATION', nome: 'Associação' },
] as const;

function SecRecebimento({ mercado, onSalvo }: {
  mercado: MercadoInfo | null;
  onSalvo: (atualizado: MercadoInfo, aviso?: string | null) => void;
}) {
  if (!mercado) return <EmptyState msg="Carregando recebimento..." />;
  return <RecebimentoConteudo mercado={mercado} onSalvo={onSalvo} />;
}

function RecebimentoConteudo({ mercado, onSalvo }: {
  mercado: MercadoInfo;
  onSalvo: (atualizado: MercadoInfo, aviso?: string | null) => void;
}) {
  const [empresa, setEmpresa] = useState<string>('LIMITED');
  const [gerandoWallet, setGerandoWallet] = useState(false);
  const [walletManual, setWalletManual] = useState(mercado.asaas_wallet_id ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const { toasts, showToast, dismissToast } = useToast();

  const walletAtual = mercado.asaas_wallet_id ?? '';
  const alterado = walletManual.trim() !== walletAtual;

  // Cria a subconta do vendedor no Asaas (POST /:id/asaas/subconta) e
  // preenche o Wallet ID sozinho — sem precisar copiar nada do painel do Asaas
  async function gerarWallet() {
    setGerandoWallet(true);
    setErro('');
    try {
      const res = await api.criarSubcontaAsaas(mercado.id_mercado, empresa);
      const walletId = String(res.walletId ?? '').trim();
      if (!walletId) throw new Error('O Asaas não devolveu o Wallet ID da subconta.');
      setWalletManual(walletId);
      onSalvo({ ...mercado, asaas_wallet_id: walletId }, null);
      showToast('sucesso', 'Conta Asaas criada! Os pedidos online passam a cair direto na sua conta.');
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar a conta Asaas.');
    } finally {
      setGerandoWallet(false);
    }
  }

  // Wallet manual: para quem já tem conta Asaas (ou para limpar e voltar
  // a deixar o valor na plataforma). PUT parcial — só o wallet muda.
  async function salvarManual() {
    const wallet = walletManual.trim();
    if (wallet && !/^[A-Za-z0-9_-]{4,64}$/.test(wallet)) {
      setErro('Wallet ID do Asaas inválido (confira o valor no painel do Asaas).');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const res = await api.atualizarMercado(mercado.id_mercado, { asaas_wallet_id: wallet });
      onSalvo({ ...mercado, ...(res.mercado ?? { asaas_wallet_id: wallet }) } as MercadoInfo, null);
      showToast('sucesso', wallet
        ? 'Wallet ID salvo — os pedidos online passam a cair na sua conta.'
        : 'Carteira removida — o valor dos pedidos fica na plataforma.');
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar a carteira.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title"><IconReceipt size={15} /> Recebimento dos pedidos online</h2>
      </div>

      <div className="gm-info-grid">
        <div className="gm-info-card">
          <div className="gm-info-row">
            <span className="gm-info-lbl"><IconCreditCard size={13} /> Recebimento</span>
            <span className="gm-info-val" title={walletAtual || undefined}>
              {walletAtual
                ? `direto na conta Asaas (${walletAtual.slice(0, 8)}…)`
                : 'na conta da plataforma'}
            </span>
          </div>
          <div className="gm-info-row">
            <span className="gm-info-lbl"><IconInfo size={13} /> Como funciona</span>
            <span className="gm-info-val">100% do Pix/cartão online para você, sem comissão</span>
          </div>
        </div>
      </div>

      {!walletAtual && (
        <>
          <div className="gm-aviso-custo">
            <p>
              Seus pagamentos online estão caindo <strong>na conta da plataforma</strong> —
              crie sua conta Asaas aqui (automático, um clique) para o valor das vendas
              cair direto na sua conta.
            </p>
          </div>
          <div className="gm-wallet-auto">
            <label className="gm-info-campo gm-wallet-empresa">
              Tipo de empresa
              <select
                className="gm-modal-input"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
              >
                {TIPOS_EMPRESA.map(t => (
                  <option key={t.valor} value={t.valor}>{t.nome}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="gm-btn-sec"
              onClick={gerarWallet}
              disabled={gerandoWallet || salvando}
            >
              {gerandoWallet ? 'Criando conta no Asaas…' : 'Criar conta automaticamente'}
            </button>
          </div>
        </>
      )}

      <p className="gm-info-subtitulo"><IconCreditCard size={13} /> Carteira Asaas (manual)</p>
      <div className="gm-info-entrega">
        <label className="gm-info-campo gm-info-campo--full">
          Wallet ID do Asaas (opcional)
          <input
            className="gm-modal-input"
            value={walletManual}
            maxLength={64}
            placeholder="Ex.: 48548710-9baa-4ec1-a11f-9010193527c6"
            onChange={e => setWalletManual(e.target.value.trim())}
          />
          <small className="gm-info-dica-cep">
            Já tem conta no Asaas? Cole o Wallet ID aqui. Deixe vazio para manter o valor
            na plataforma.
          </small>
        </label>
      </div>

      {erro && <p className="gm-info-erro">{erro}</p>}

      <div className="gm-info-acoes">
        <button
          className="gm-btn-primary"
          onClick={salvarManual}
          disabled={salvando || gerandoWallet || !alterado}
        >
          {salvando ? 'Salvando…' : 'Salvar carteira'}
        </button>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// ─── Cupons de desconto (B3) ─────────────────────────────────────────────────
// O vendedor cria cupons (percentual ou valor fixo) com pedido mínimo, limite
// de usos e validade. O cliente digita o código no carrinho e o backend
// confere se ainda vale antes de aplicar o desconto.

interface Cupom {
  id: number;
  codigo: string;
  tipo: 'percentual' | 'valor';
  valor: number;
  minPedido: number;
  maxUsos: number | null;
  usos: number;
  validade: string | null;
  ativo: boolean;
  // Escopo do cupom (as duas vazias = vale para tudo)
  categorias: { id: number; nome: string }[];
  produtos: { id: number; nome: string }[];
}

// Máximo de itens no escopo — espelho do backend (cupomController.lerProdutos/lerCategorias)
const MAX_ESCOPO_CUPOM = 20;

function SecCupons({ mercadoId, produtos }: { mercadoId: number; produtos: Produto[] }) {
  const { toasts, showToast, dismissToast } = useToast();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [selecionandoProdutos, setSelecionandoProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [form, setForm] = useState({
    codigo: '', tipo: 'percentual' as 'percentual' | 'valor',
    valor: '', min_pedido: '', max_usos: '', validade: '',
    // Escopo: vazias as duas = o cupom vale para todos os produtos
    categorias: [] as number[],
    produtos: [] as number[],
  });

  // Categorias do mercado — é delas que o vendedor escolhe o escopo do cupom
  useEffect(() => {
    let vivo = true;
    api.listarCategorias(mercadoId)
      .then((lista: unknown) => {
        if (vivo && Array.isArray(lista)) setCategorias(lista as { id: number; nome: string }[]);
      })
      .catch(() => {
        // sem categoria não dá para restringir: o formulário fica só com "todos"
      });
    return () => { vivo = false; };
  }, [mercadoId]);

  // Carrega os cupons do mercado (padrão do painel: async dentro do efeito)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const data = await api.cuponsMercado(mercadoId);
        if (vivo) setCupons(data.cupons ?? []);
      } catch {
        // silencioso: a seção mostra a lista vazia
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [mercadoId]);

  // Recarrega após criar/ativar/apagar (fora do efeito, direto nas ações)
  async function recarregar() {
    try {
      const data = await api.cuponsMercado(mercadoId);
      setCupons(data.cupons ?? []);
    } catch {
      // silencioso
    }
  }

  async function criar() {
    const codigo = form.codigo.trim().toUpperCase();
    const valor = Number(form.valor);
    if (codigo.length < 3) { setErro('O código precisa de pelo menos 3 letras ou números.'); return; }
    if (!Number.isFinite(valor) || valor <= 0) { setErro('Informe um valor maior que zero.'); return; }
    if (form.tipo === 'percentual' && valor > 100) { setErro('Cupom percentual não pode passar de 100%.'); return; }
    if (form.categorias.length > MAX_ESCOPO_CUPOM || form.produtos.length > MAX_ESCOPO_CUPOM) {
      setErro(`Um cupom pode cobrir no máximo ${MAX_ESCOPO_CUPOM} categorias e ${MAX_ESCOPO_CUPOM} produtos.`);
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await api.criarCupom(mercadoId, {
        codigo,
        tipo: form.tipo,
        valor,
        min_pedido: form.min_pedido ? Number(form.min_pedido) : undefined,
        max_usos: form.max_usos ? Number(form.max_usos) : null,
        validade: form.validade || null,
        categorias: form.categorias,
        produtos: form.produtos,
      });
      showToast('sucesso', `Cupom ${codigo} criado com sucesso.`);
      setForm({ codigo: '', tipo: 'percentual', valor: '', min_pedido: '', max_usos: '', validade: '', categorias: [], produtos: [] });
      setMostrarForm(false);
      setSelecionandoProdutos(false);
      setBuscaProduto('');
      recarregar();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar o cupom.');
    } finally {
      setSalvando(false);
    }
  }

  /** Marca/desmarca uma categoria no escopo do cupom */
  function alternarCategoria(id: number) {
    setForm(f => ({
      ...f,
      categorias: f.categorias.includes(id)
        ? f.categorias.filter(c => c !== id)
        : [...f.categorias, id],
    }));
  }

  /** Marca/desmarca um produto específico no escopo do cupom */
  function alternarProduto(id: number) {
    setForm(f => {
      const jaTem = f.produtos.includes(id);
      if (!jaTem && f.produtos.length >= MAX_ESCOPO_CUPOM) return f;
      return {
        ...f,
        produtos: jaTem ? f.produtos.filter(p => p !== id) : [...f.produtos, id],
      };
    });
  }

  async function alternarAtivo(c: Cupom) {
    try {
      await api.atualizarCupom(mercadoId, c.id, { ativo: !c.ativo });
      showToast('sucesso', c.ativo ? `Cupom ${c.codigo} desativado.` : `Cupom ${c.codigo} ativado.`);
      recarregar();
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao atualizar o cupom.');
    }
  }

  async function remover(c: Cupom) {
    if (!window.confirm(`Apagar o cupom ${c.codigo}? Quem já usou mantém o histórico.`)) return;
    try {
      await api.deletarCupom(mercadoId, c.id);
      showToast('sucesso', `Cupom ${c.codigo} removido.`);
      recarregar();
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao remover o cupom.');
    }
  }

  function formatarValidade(v: string | null) {
    if (!v) return 'sem prazo';
    // A API pode devolver "2026-12-31" ou um timestamp completo; concatenar
    // horário em cima de um timestamp gerava "até Invalid Date"
    const data = new Date(v.length > 10 ? v : `${v}T12:00:00`);
    if (Number.isNaN(data.getTime())) return 'sem prazo';
    return `até ${data.toLocaleDateString('pt-BR')}`;
  }

  // Nomes das categorias/produtos marcados no formulário (avisos e badge)
  const nomesCategorias = form.categorias
    .map(id => categorias.find(c => c.id === id)?.nome ?? '')
    .filter(Boolean)
    .join(', ');
  const nomesProdutos = form.produtos
    .map(id => produtos.find(p => p.id_produto === id)?.nome ?? '')
    .filter(Boolean)
    .join(', ');

  // Lista de produtos pra busca do seletor (filtra por nome)
  const produtosFiltrados = buscaProduto.trim()
    ? produtos.filter(p => p.nome.toLowerCase().includes(buscaProduto.trim().toLowerCase()))
    : produtos;

  return (
    <div className="gm-section-wrap">
      <div className="gm-sec-row">
        <h2 className="gm-sec-title"><IconTag size={15} /> Cupons de desconto</h2>
        <button className="gm-btn-link" onClick={() => { setErro(''); setMostrarForm(v => !v); }}>
          {mostrarForm ? 'Fechar' : 'Novo cupom'}
        </button>
      </div>

      {mostrarForm && (
        <div className="gm-cupom-form">
          <div className="gm-info-edit-grid">
            <label className="gm-info-campo">
              Código
              <input className="gm-modal-input" value={form.codigo} maxLength={30}
                placeholder="Ex.: BEMVINDO10"
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
            </label>
            <label className="gm-info-campo">
              Tipo
              <select className="gm-modal-input" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as 'percentual' | 'valor' }))}>
                <option value="percentual">Percentual (%)</option>
                <option value="valor">Valor fixo (R$)</option>
              </select>
            </label>
            <label className="gm-info-campo">
              {form.tipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}
              <input className="gm-modal-input" type="number" min="0" step="0.01" value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </label>
            <label className="gm-info-campo">
              Pedido mínimo (R$, opcional)
              <input className="gm-modal-input" type="number" min="0" step="0.01" value={form.min_pedido}
                onChange={e => setForm(f => ({ ...f, min_pedido: e.target.value }))} />
            </label>
            <label className="gm-info-campo">
              Limite de usos (opcional)
              <input className="gm-modal-input" type="number" min="1" step="1" value={form.max_usos}
                onChange={e => setForm(f => ({ ...f, max_usos: e.target.value }))} />
            </label>
            <label className="gm-info-campo">
              Válido até (opcional)
              <input className="gm-modal-input" type="date" value={form.validade}
                onChange={e => setForm(f => ({ ...f, validade: e.target.value }))} />
            </label>
          </div>

          {/* Escopo do cupom: categorias e/ou produtos específicos */}
          <div className="gm-cupom-categorias">
            <span className="gm-cupom-categorias-titulo">Categorias do cupom</span>
            <div className="gm-cupom-chips">
              <button
                type="button"
                className={`gm-cupom-chip${form.categorias.length === 0 ? ' gm-cupom-chip--ativo' : ''}`}
                onClick={() => setForm(f => ({ ...f, categorias: [] }))}
              >
                Todas as categorias
              </button>
              {categorias.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`gm-cupom-chip${form.categorias.includes(c.id) ? ' gm-cupom-chip--ativo' : ''}`}
                  onClick={() => alternarCategoria(c.id)}
                >
                  {c.nome}
                </button>
              ))}
            </div>
            <p className="gm-cupom-categorias-dica">
              {categorias.length === 0
                ? 'Cadastre categorias de produtos para aplicar o cupom só em um tipo de produto.'
                : form.categorias.length === 0
                  ? 'Nenhuma categoria marcada: o desconto não é limitado por categoria.'
                  : `Desconto também nas categorias: ${nomesCategorias}.`}
            </p>
          </div>

          {/* Produtos específicos: o vendedor pode marcar um ou mais produtos */}
          <div className="gm-cupom-categorias">
            <span className="gm-cupom-categorias-titulo">Produtos específicos (opcional)</span>
            <div className="gm-cupom-chips">
              <button
                type="button"
                className="gm-cupom-chip"
                onClick={() => { setSelecionandoProdutos(v => !v); setBuscaProduto(''); }}
              >
                {selecionandoProdutos ? 'Fechar seleção' : `Escolher produtos (${form.produtos.length})`}
              </button>
              {form.produtos.map(id => (
                <button
                  key={id}
                  type="button"
                  className="gm-cupom-chip gm-cupom-chip--ativo"
                  onClick={() => alternarProduto(id)}
                  title="Remover produto do escopo"
                >
                  {produtos.find(p => p.id_produto === id)?.nome ?? `#${id}`} ×
                </button>
              ))}
            </div>

            {selecionandoProdutos && (
              <div className="gm-cupom-produtos-painel">
                <input
                  className="gm-modal-input"
                  placeholder="Buscar produto pelo nome…"
                  value={buscaProduto}
                  onChange={e => setBuscaProduto(e.target.value)}
                />
                <div className="gm-cupom-produtos-lista">
                  {produtosFiltrados.length === 0 ? (
                    <p className="gm-cupom-categorias-dica">Nenhum produto encontrado.</p>
                  ) : (
                    produtosFiltrados.map(p => (
                      <label key={p.id_produto} className="gm-cupom-produto-item">
                        <input
                          type="checkbox"
                          checked={form.produtos.includes(p.id_produto)}
                          onChange={() => alternarProduto(p.id_produto)}
                        />
                        <span className="gm-cupom-produto-nome">{p.nome}</span>
                        <span className="gm-cupom-produto-cat">{p.categoria}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <p className="gm-cupom-categorias-dica">
              {form.produtos.length === 0 && form.categorias.length === 0
                ? 'Nada marcado: o cupom vale para o pedido inteiro.'
                : `O desconto vale para itens das categorias e/ou dos produtos escolhidos (união). Produtos: ${nomesProdutos || 'nenhum'}.`}
            </p>
          </div>

          {erro && <p className="gm-info-erro">{erro}</p>}
          <div className="gm-info-acoes">
            <button className="gm-btn-link" onClick={() => setMostrarForm(false)} disabled={salvando}>
              Cancelar
            </button>
            <button className="gm-btn-primary" onClick={criar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Criar cupom'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        Array.from({ length: 3 }, (_, i) => <LoadingRow key={i} />)
      ) : cupons.length === 0 ? (
        <EmptyState msg="Nenhum cupom criado ainda — crie o primeiro para atrair clientes" />
      ) : (
        <div className="gm-cupom-lista">
          {cupons.map((c, i) => {
            const escopoItens = [
              ...c.categorias.map(x => x.nome),
              ...c.produtos.map(x => x.nome),
            ];
            const escopoTexto = escopoItens.length > 0 ? escopoItens.join(', ') : 'todos os produtos';
            return (
            <div key={c.id} className={`gm-cupom-row${c.ativo ? '' : ' gm-cupom-row--inativo'}`} style={{ animationDelay: `${0.05 + i * 0.05}s` }}>
              <span className="gm-cupom-codigo"><IconTag size={13} /> {c.codigo}</span>
              <span className="gm-cupom-desconto">
                {c.tipo === 'percentual' ? `${c.valor}% de desconto` : `${formatarBRL(c.valor)} de desconto`}
              </span>
              <span
                className={`gm-cupom-escopo${escopoItens.length === 0 ? '' : ' gm-cupom-escopo--restrito'}`}
                title={escopoItens.length === 0 ? 'Vale para todos os produtos' : escopoTexto}
              >
                {escopoTexto}
              </span>
              <span className="gm-cupom-info">
                {c.minPedido > 0 ? `mínimo ${formatarBRL(c.minPedido)}` : 'sem pedido mínimo'}
              </span>
              <span className="gm-cupom-info">
                {c.usos} {c.maxUsos != null ? `de ${c.maxUsos} usos` : 'usos'}
              </span>
              <span className="gm-cupom-info">{formatarValidade(c.validade)}</span>
              <span className={`gm-cupom-status${c.ativo ? ' gm-cupom-status--ativo' : ''}`}>
                {c.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button className="gm-pedido-acao" onClick={() => alternarAtivo(c)}>
                {c.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button className="gm-cupom-apagar" onClick={() => remover(c)} title="Apagar cupom">
                Apagar
              </button>
            </div>
            );
          })}
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

// Modo leitura + edição em linha dos dados do mercado. O "Editar" carrega os
// valores atuais (inclusive o horário) nos campos; o "Salvar" grava no banco
// (PUT /api/mercados/:id) e atualiza a tela com a resposta; o "Cancelar"
// descarta as mudanças. O CNPJ fica somente leitura (é o documento da loja).
// O recebimento (Wallet Asaas) tem aba própria — ver SecRecebimento acima.
function InfoConteudo({ mercado, onSalvo }: {
  mercado: MercadoInfo;
  onSalvo: (atualizado: MercadoInfo, aviso?: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', rua: '', bairro: '',
    cidade: '', estado: '', cep: '',
  });
  // Entrega e retirada (B2): taxa, pedido mínimo e quais formas a loja aceita
  const [entrega, setEntrega] = useState({
    taxa: '', minimo: '', ofereceEntrega: true, ofereceRetirada: true,
  });
  const [horario, setHorario] = useState<Record<string, [string, string] | null>>({});

  // Aviso do preenchimento automático do endereço pelo CEP
  const [dicaCep, setDicaCep] = useState<string | null>(null);
  // CEP que já foi consultado — evita buscar a mesma coisa duas vezes
  const cepJaBuscado = useRef<string | null>(
    mercado.cep ? mercado.cep.replace(/\D/g, '') : null
  );
  // Guarda se o endereço veio do ViaCEP (aí apagar o CEP apaga ele junto)
  const enderecoPeloCep = useRef(false);

  // CEP completo → rua, bairro, cidade e estado vêm sozinhos (ViaCEP).
  // Só na edição: fora dela os campos ficam apenas para leitura.
  useEffect(() => {
    if (!editando) return;

    const digitos = form.cep.replace(/\D/g, '');
    if (digitos.length !== 8) {
      cepJaBuscado.current = null;
      // o aviso só muda depois desta tecla, nunca dentro do efeito na hora
      Promise.resolve().then(() => setDicaCep(null));
      return;
    }
    if (digitos === cepJaBuscado.current) return;
    cepJaBuscado.current = digitos;

    let vivo = true;
    buscarCep(form.cep).then((dados) => {
      if (!vivo) return;
      if (!dados) {
        setDicaCep('CEP não encontrado. Confira os campos manualmente.');
        return;
      }
      setForm((f) => ({
        ...f,
        rua: dados.rua || f.rua,
        bairro: dados.bairro || f.bairro,
        cidade: dados.cidade || f.cidade,
        estado: dados.estado || f.estado,
      }));
      enderecoPeloCep.current = true;
      setDicaCep('Endereço preenchido pelo CEP.');
    });

    return () => {
      vivo = false;
    };
  }, [form.cep, editando]);

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
    setEntrega({
      taxa: mercado.taxa_entrega != null ? String(Number(mercado.taxa_entrega)) : '0',
      minimo: mercado.pedido_minimo != null ? String(Number(mercado.pedido_minimo)) : '0',
      ofereceEntrega: mercado.oferece_entrega !== false,
      ofereceRetirada: mercado.oferece_retirada !== false,
    });
    setHorario(parseHorario(mercado.horario) ?? {});
    setErro('');
    setDicaCep(null);
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
    // Entrega e retirada: a loja precisa oferecer pelo menos uma forma
    if (!entrega.ofereceEntrega && !entrega.ofereceRetirada) {
      setErro('A loja precisa oferecer entrega ou retirada no balcão (marque pelo menos uma).');
      return;
    }
    const taxa = Number(entrega.taxa.replace(',', '.')) || 0;
    const minimo = Number(entrega.minimo.replace(',', '.')) || 0;
    if (taxa < 0 || minimo < 0) {
      setErro('Taxa de entrega e pedido mínimo não podem ser negativos.');
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
        taxa_entrega: taxa,
        pedido_minimo: minimo,
        oferece_entrega: entrega.ofereceEntrega,
        oferece_retirada: entrega.ofereceRetirada,
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
                onChange={e => {
                  const cep = e.target.value.replace(/\D/g, '').slice(0, 8);
                  set('cep', cep);
                  // Apagou o CEP: o endereço que ele preencheu sai junto
                  if (cep === '' && enderecoPeloCep.current) {
                    enderecoPeloCep.current = false;
                    setForm(f => ({ ...f, rua: '', bairro: '', cidade: '', estado: '' }));
                    setDicaCep(null);
                  }
                }} />
              {dicaCep && <small className="gm-info-dica-cep">{dicaCep}</small>}
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

          <p className="gm-info-subtitulo"><IconTruck size={13} /> Entrega e retirada</p>
          <div className="gm-info-entrega">
            <label className="gm-info-campo">
              Taxa de entrega (R$)
              <input className="gm-modal-input" type="number" min="0" step="0.01" value={entrega.taxa}
                onChange={e => setEntrega(x => ({ ...x, taxa: e.target.value }))} />
            </label>
            <label className="gm-info-campo">
              Pedido mínimo para entrega (R$, 0 = sem mínimo)
              <input className="gm-modal-input" type="number" min="0" step="0.01" value={entrega.minimo}
                onChange={e => setEntrega(x => ({ ...x, minimo: e.target.value }))} />
            </label>
            <label className="gm-info-check">
              <input type="checkbox" checked={entrega.ofereceEntrega}
                onChange={e => setEntrega(x => ({ ...x, ofereceEntrega: e.target.checked }))} />
              Faz entrega
            </label>
            <label className="gm-info-check">
              <input type="checkbox" checked={entrega.ofereceRetirada}
                onChange={e => setEntrega(x => ({ ...x, ofereceRetirada: e.target.checked }))} />
              Aceita retirada no balcão
            </label>
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
            <div className="gm-info-row"><span className="gm-info-lbl"><IconInfo size={13} /> Descrição</span><span className="gm-info-val">{mercado.descricao || '—'}</span></div>
            <div className="gm-info-row"><span className="gm-info-lbl"><IconClock size={13} /> Horário</span><span className="gm-info-val">{resumirHorario(parseHorario(mercado.horario))}</span></div>
          </div>
          <div className="gm-info-card">
            <div className="gm-info-row">
              <span className="gm-info-lbl"><IconTruck size={13} /> Entrega</span>
              <span className="gm-info-val">
                {mercado.oferece_entrega === false
                  ? 'não faz'
                  : Number(mercado.taxa_entrega) > 0
                    ? formatarBRL(Number(mercado.taxa_entrega))
                    : 'grátis'}
              </span>
            </div>
            <div className="gm-info-row">
              <span className="gm-info-lbl"><IconShoppingCart size={13} /> Mínimo entrega</span>
              <span className="gm-info-val">
                {Number(mercado.pedido_minimo) > 0 ? formatarBRL(Number(mercado.pedido_minimo)) : 'sem mínimo'}
              </span>
            </div>
            <div className="gm-info-row">
              <span className="gm-info-lbl"><IconStore size={13} /> Retirada</span>
              <span className="gm-info-val">{mercado.oferece_retirada === false ? 'não aceita' : 'aceita no balcão'}</span>
            </div>
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
  const navigate = useNavigate();
  const {toasts, showToast, dismissToast } = useToast();
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  // Quem tem mais de uma loja troca de painel pelo seletor da sidebar (B9)
  const [meusMercados, setMeusMercados] = useState<{ id_mercado: number; nome: string }[]>([]);
  useEffect(() => {
    api.meusMercados()
      .then(data => setMeusMercados((data.mercados ?? []).map((m: { id_mercado: number; nome: string }) => ({ id_mercado: m.id_mercado, nome: m.nome }))))
      .catch(() => setMeusMercados([]));
  }, [mercadoId]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosLoading, setPedidosLoading] = useState(true);
  const [pedidosExpandidos, setPedidosExpandidos] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [avaliacoesProdutos, setAvaliacoesProdutos] = useState<Avaliacao[]>([]);
  const [avaliacoesModerando, setAvaliacoesModerando] = useState(false);
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
            dataCompra: string; status: 'pendente' | 'preparo' | 'caminho' | 'entregue' | 'aguardando_pagamento' | 'cancelado';
            observacao?: string;
            tipoEntrega?: 'entrega' | 'retirada'; taxaEntrega?: number;
            enderecoEntrega?: string;
            agendamento?: string; cupom?: string; desconto?: number;
            formaPagamento?: 'presencial' | 'pix' | 'cartao';
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
              tipoEntrega: p.tipoEntrega === 'retirada' ? 'retirada' : 'entrega',
              enderecoEntrega: (p.enderecoEntrega ?? '').trim(),
              taxaEntrega: Number(p.taxaEntrega) || 0,
              agendamento: (p.agendamento ?? '').trim(),
              cupom: (p.cupom ?? '').trim(),
              desconto: Number(p.desconto) || 0,
              formaPagamento: p.formaPagamento ?? 'presencial',
            };
          })
        );
      } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
      } finally {
        setPedidosLoading(false);
      }
    })();

    // Avaliações reais recebidas pelo mercado (com moderação B6)
    (async () => {
      setAvaliacoesLoading(true);
      try {
        const data = await api.avaliacoesMercado(mercadoId);
        setAvaliacoesModerando(!!data.moderando);
        setAvaliacoes(
          (data.avaliacoes ?? []).map((a: {
            id: number; nota: number; texto: string; cliente: string; oculta?: boolean;
          }): Avaliacao => ({
            id: a.id,
            iniciais: iniciaisDe(a.cliente),
            nome: a.cliente,
            n: a.nota,
            texto: a.texto || 'Sem comentário.',
            oculta: !!a.oculta,
          }))
        );
        // B6 — Avaliações de produtos (só chegam para quem modera)
        if (data.moderando) {
          const produtos = await api.avaliacoesProdutosMercado(mercadoId);
          setAvaliacoesProdutos(
            (produtos.avaliacoes ?? []).map((a: {
              id: number; nota: number; texto: string; cliente: string;
              oculta?: boolean; produto?: string; produtoId?: number; categoriaId?: number;
            }): Avaliacao => ({
              id: a.id,
              iniciais: iniciaisDe(a.cliente),
              nome: a.cliente,
              n: a.nota,
              texto: a.texto || 'Sem comentário.',
              oculta: !!a.oculta,
              produto: a.produto || '',
              produtoId: a.produtoId,
              categoriaId: a.categoriaId,
            }))
          );
        }
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

  // B6 — Vendedor oculta ou exibe uma avaliação da loja no site
  async function handleModerarAvaliacao(a: Avaliacao) {
    try {
      const resultado = await api.moderarAvaliacao(mercadoId, a.id, !a.oculta);
      setAvaliacoes(prev => prev.map(x => (x.id === a.id ? { ...x, oculta: resultado.oculta } : x)));
      showToast('sucesso', resultado.mensagem);
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível moderar a avaliação.');
    }
  }

  // B6 — Vendedor oculta ou exibe uma avaliação de produto no site
  async function handleModerarAvaliacaoProduto(a: Avaliacao) {
    if (!a.produtoId || !a.categoriaId) return;
    try {
      const resultado = await api.moderarAvaliacaoProduto(mercadoId, a.categoriaId, a.produtoId, a.id, !a.oculta);
      setAvaliacoesProdutos(prev => prev.map(x => (x.id === a.id ? { ...x, oculta: resultado.oculta } : x)));
      showToast('sucesso', resultado.mensagem);
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível moderar a avaliação.');
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
          // Cancelados e ainda não pagos não entram no faturamento
          if (p.statusAtual === 'cancelado' || p.statusAtual === 'aguardando_pagamento') return false;
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
  function handleInfoSalva(atualizado: MercadoInfo, aviso?: string | null) {
    setDados(prev => ({ ...prev, mercado: { ...prev.mercado!, ...atualizado } }));
    if (aviso !== null) showToast('sucesso', aviso ?? 'Informações atualizadas com sucesso!');
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
      avaliacoesProdutos={avaliacoesProdutos}
      loading={avaliacoesLoading}
      expandidas={avaliacoesExpandidas}
      onAlternar={() => setAvaliacoesExpandidas(v => !v)}
      total={avaliacoes.length}
      moderando={avaliacoesModerando}
      onModerar={handleModerarAvaliacao}
      onModerarProduto={handleModerarAvaliacaoProduto}
    />,
    <SecCupons mercadoId={mercadoId} produtos={produtos} />,
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
      // Sem cupons o filtro encolhe a lista: Recebimento fica no 5 ou no 6
      onIrRecebimento={() => setNav(plano !== 'basico' ? 6 : 5)}
      onExportar={handleExportarRelatorio}
    />,
    <SecRecebimento mercado={mercado} onSalvo={handleInfoSalva} />,
    <SecInformacoes mercado={mercado} onSalvo={handleInfoSalva} />,
  ];

  // Cupons são recurso dos planos Plus e Personalizado: no Essencial a aba
  // some da sidebar e o índice da seção acompanha o filtro.
  const temCupons = plano !== 'basico';
  const navItens = SIDEBAR_NAV.filter((_, i) => temCupons || i !== 4);
  const secoes = SECTIONS.filter((_, i) => temCupons || i !== 4);
  // Defesa: se o conjunto encolheu (plano carregou como Essencial), volta ao início
  const navAtual = nav < secoes.length ? nav : 0;

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
        {/* Troca de loja para quem gerencia mais de um mercado (B9) */}
        {meusMercados.length > 1 && (
          <label className="gm-trocar-loja">
            <span className="gm-trocar-loja__lbl">Minha loja</span>
            <select
              className="gm-trocar-loja__select"
              value={mercadoId}
              onChange={e => navigate(`/vendedor/mercado/${e.target.value}`)}
              aria-label="Trocar de loja"
            >
              {meusMercados.map(m => (
                <option key={m.id_mercado} value={m.id_mercado}>{m.nome}</option>
              ))}
            </select>
          </label>
        )}
        <nav className="gm-nav">
          {navItens.map((item, i) => (
            <button
              key={i}
              className={`gm-nav-btn${navAtual === i ? ' active' : ''}`}
              style={{ animationDelay: `${0.18 + i * 0.06}s` }}
              aria-label={item.label}
              onClick={() => setNav(i)}
            >
              <span className="gm-nav-icon">{item.icon}</span>
              <span className="gm-nav-label">{item.label}</span>
              {navAtual === i && <span className="gm-nav-dot" />}
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
              {navItens[navAtual].icon} {navItens[navAtual].label}
            </span>
          </div>
          <div className="gm-topbar-actions">
            <button
              className="gm-btn-sec gm-btn-vitrine"
              onClick={onAbrirVitrine}
              title="Abrir a loja do jeito que o cliente vê"
            >
              <IconEye size={14} /> Ver vitrine
            </button>
          </div>
        </div>

        <div className="gm-content" key={navAtual}>
          {secoes[navAtual]}
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