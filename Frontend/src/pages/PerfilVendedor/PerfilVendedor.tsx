import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/Toast';
import LoadingOverlay from '../../components/LoadingOverlay';
import PasswordStrength from '../../components/PasswordStrength';
import AdicionarMercadoFavorito from '../../components/AdicionarMercadoFavorito';
import './PerfilVendedor.css';
import '../PerfilUsuario/PerfilUsuario.css';
import {
  IconUser,
  IconLock,
  IconMapPin,
  IconCreditCard,
  IconReceipt,
  IconBell,
  IconStore,
  IconHeart,
  IconShoppingBag,
  IconStar,
  IconPackage,
  IconShoppingCart,
  IconArrowRight,
  IconMail,
  IconInbox,
} from '../../components/Icons';

interface Mercado {
  id_mercado: number;
  nome: string;
  email: string;
  cidade: string;
  estado: string;
  papel: string;
}

interface Favorito { id: number; id_mercado: number; nome: string; data_cadastro: string; }
interface Historico { id: number; id_mercado: number; mercado: string; produtos: string; valor_total: string; data_compra: string; status: string; }
interface Avaliacao { id: number; id_mercado: number; loja: string; nota: number; texto: string; data_cadastro: string; }

// ícones que giram nos cards de mercado (na falta de uma imagem real da loja)
const MKT_ICONS = [IconShoppingCart, IconStore, IconShoppingBag, IconPackage];

const NAV_ITEMS = [
  { icon: <IconUser size={18} />, label: 'Perfil' },
  { icon: <IconLock size={18} />, label: 'Segurança' },
  { icon: <IconMapPin size={18} />, label: 'Endereços' },
  { icon: <IconCreditCard size={18} />, label: 'Cartões' },
  { icon: <IconReceipt size={18} />, label: 'Fatura' },
  { icon: <IconBell size={18} />, label: 'Comunicação' },
];

const TITULOS = ['Painel do Vendedor', 'Segurança', 'Endereços', 'Cartões', 'Fatura', 'Comunicação'];

function Stars({ n }: { n: number }) {
  return <span className="pu-stars">{Array.from({ length: 5 }, (_, i) => i < n ? '★' : '☆').join('')}</span>;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function BtnOlho({ visivel, onToggle }: { visivel: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="pu-input-eye" onClick={onToggle} tabIndex={-1}>
      {visivel ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

// ─── Telas ────────────────────────────────────────────────────────────────────

function TelaPerfil({ mercados, carregando, onAbrirMercado, favoritos, historico, avaliacoes, onAtualizarFavoritos }: {
  mercados: Mercado[];
  carregando: boolean;
  onAbrirMercado?: (m: { id: number; nome: string }) => void;
  favoritos: Favorito[];
  historico: Historico[];
  avaliacoes: Avaliacao[];
  onAtualizarFavoritos: (favoritos: Favorito[]) => void;
}) {
  const navigate = useNavigate();
  const [modalFavoritoAberto, setModalFavoritoAberto] = useState(false);

  const stats = [
    { Icon: IconStore, cls: 'navy', val: String(mercados.length), lbl: 'Mercados Ativos' },
    { Icon: IconStar, cls: 'gold', val: '0 ★', lbl: 'Avaliação Média' },
    { Icon: IconPackage, cls: 'green', val: '0', lbl: 'Pedidos Totais' },
  ];

  return (
    <>
      <div className="pv-stats-row">
        {stats.map((s, i) => (
          <div key={i} className="pv-stat" style={{ animationDelay: `${0.25 + i * 0.09}s` }}>
            <div className={`pv-stat-icon ${s.cls}`}><s.Icon size={20} /></div>
            <div className="pv-stat-body">
              <p className="pv-stat-val">{s.val}</p>
              <p className="pv-stat-lbl">{s.lbl}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconStore size={15} /></span>Mercados Gerenciados</h2>
          <button className="pu-btn-link">Gerenciar todos</button>
        </div>
        <div className="pv-mkt-row">
          {carregando ? (
            <p className="pv-mkt-loading">Carregando...</p>
          ) : mercados.length === 0 ? (
            <div className="pu-empty">
              <div className="pu-empty-icon"><IconStore size={22} /></div>
              <p>Nenhum mercado cadastrado ainda</p>
              <span>Crie seu primeiro mercado e comece a vender.</span>
            </div>
          ) : mercados.map((m, i) => {
            const MktIcon = MKT_ICONS[i % MKT_ICONS.length];
            return (
              <div key={m.id_mercado} className="pv-mkt-card" style={{ animationDelay: `${0.3 + i * 0.09}s` }}
                onClick={() => onAbrirMercado && onAbrirMercado({ id: m.id_mercado, nome: m.nome })}>
                <div className="pv-mkt-img"><MktIcon size={20} /></div>
                <div className="pv-mkt-body">
                  <p className="pv-mkt-nome">{m.nome}</p>
                  <p className="pv-mkt-loc"><IconMapPin size={11} />{m.cidade} · {m.estado}</p>
                </div>
                <span className="pv-mkt-abrir">Gerenciar <IconArrowRight size={13} className="pv-mkt-arrow" /></span>
              </div>
            );
          })}
          <div className="pv-mkt-card pv-mkt-add" style={{ animationDelay: '0.57s' }}
            onClick={() => navigate('/registrar-mercado')}>
            <span className="pv-mkt-plus">+</span>
            <p className="pv-mkt-nome pv-mkt-add-label">Novo mercado</p>
          </div>
        </div>
      </section>

      <div className="pu-divider" />

      <section>
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconHeart size={14} /></span>Mercados Favoritos</h2>
        <div className="pu-circles">
          <div className="pu-circ-item" style={{ animationDelay: '0.3s' }}>
            <div
              className="pu-circ pu-circ-add"
              onClick={() => setModalFavoritoAberto(true)}
              role="button"
              tabIndex={0}
              title="Adicionar mercado favorito"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setModalFavoritoAberto(true); }}
            >+</div>
            <span className="pu-circ-label pu-circ-muted">Adicionar</span>
          </div>
          {favoritos.map((f, i) => (
            <div key={f.id} className="pu-circ-item" style={{ animationDelay: `${0.38 + i * 0.08}s` }}>
              <div className="pu-circ"><IconStore size={22} /></div>
              <span className="pu-circ-label">{f.nome}</span>
            </div>
          ))}
        </div>
        {favoritos.length === 0 && (
          <p className="pu-empty-inline">Você ainda não favoritou nenhum mercado. Explore e adicione seus preferidos aqui.</p>
        )}
      </section>

      {modalFavoritoAberto && (
        <AdicionarMercadoFavorito
          favoritosAtuais={favoritos}
          onAtualizarFavoritos={onAtualizarFavoritos}
          onFechar={() => setModalFavoritoAberto(false)}
        />
      )}

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconShoppingBag size={14} /></span>Histórico de Compras</h2>
          <button className="pu-btn-link">Ver todos</button>
        </div>
        {historico.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconShoppingBag size={22} /></div>
            <p>Nenhuma compra realizada ainda</p>
            <span>Seus pedidos aparecerão aqui assim que você comprar em um mercado.</span>
          </div>
        ) : (
          <div className="pu-hist-grid">
            {historico.map((p, i) => (
              <div key={p.id} className="pu-hcard" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
                <div className="pu-hcard-img"><IconShoppingBag size={26} /></div>
                <div className="pu-hcard-body">
                  <p className="pu-hcard-nome">{p.mercado}</p>
                  <p className="pu-hcard-preco">R$ {p.valor_total}</p>
                  <p className="pu-hcard-data">{new Date(p.data_compra).toLocaleDateString('pt-BR')}</p>
                  <span className={`pu-status ${p.status}`}>● {p.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconStar size={14} /></span>Avaliações Feitas</h2>
          <button className="pu-btn-link">Ver todas</button>
        </div>
        {avaliacoes.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconStar size={22} /></div>
            <p>Você ainda não avaliou nenhum mercado</p>
            <span>Suas avaliações ajudam outros compradores a escolher melhor.</span>
          </div>
        ) : (
          <div className="pu-rev-grid">
            {avaliacoes.map((a, i) => (
              <div key={a.id} className="pu-rev-card" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
                <p className="pu-rev-store">{a.loja}</p>
                <Stars n={a.nota} />
                <p className="pu-rev-text">{a.texto}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TelaSeguranca() {
  const { usuario } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [etapa, setEtapa] = useState<'form' | 'enviado'>('form');
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ novaSenha: '', confirmarSenha: '' });
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  async function enviarConfirmacao() {
    if (!form.novaSenha) return showToast('erro', 'Digite a nova senha.');
    if (form.novaSenha.length < 6) return showToast('erro', 'A senha deve ter ao menos 6 caracteres.');
    if (form.novaSenha !== form.confirmarSenha) return showToast('erro', 'As senhas não coincidem.');

    setEnviando(true);
    try {
      const { api } = await import('../../services/api');
      await api.trocarSenha({ novaSenha: form.novaSenha });
      setEtapa('enviado');
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao enviar email.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {enviando && <LoadingOverlay mensagem="Enviando email..." />}
      <section>
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconLock size={14} /></span>Segurança</h2>
        {etapa === 'form' ? (
          <div className="pu-form-block">
            <div className="pu-modal-group">
              <label className="pu-modal-label">Nova Senha</label>
              <div className="pu-input-wrap">
                <input
                  className="pu-modal-input"
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  value={form.novaSenha}
                  onChange={e => setForm(f => ({ ...f, novaSenha: e.target.value }))}
                  placeholder="••••••••"
                />
                <BtnOlho visivel={mostrarNovaSenha} onToggle={() => setMostrarNovaSenha(v => !v)} />
              </div>
              <PasswordStrength senha={form.novaSenha} />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Confirmar Nova Senha</label>
              <div className="pu-input-wrap">
                <input
                  className="pu-modal-input"
                  type={mostrarConfirmar ? 'text' : 'password'}
                  value={form.confirmarSenha}
                  onChange={e => setForm(f => ({ ...f, confirmarSenha: e.target.value }))}
                  placeholder="••••••••"
                />
                <BtnOlho visivel={mostrarConfirmar} onToggle={() => setMostrarConfirmar(v => !v)} />
              </div>
            </div>
            <button
              className="pu-modal-btn-save pu-form-btn"
              onClick={enviarConfirmacao}
              disabled={enviando}
            >
              <IconMail size={15} /> Salvar e Confirmar por Email
            </button>
          </div>
        ) : (
          <div className="pu-confirm-card">
            <div className="pu-confirm-icon"><IconInbox size={30} /></div>
            <p className="pu-confirm-title">Verifique seu email</p>
            <p className="pu-confirm-text">
              Enviamos um link de confirmação para{' '}
              <strong className="pu-confirm-highlight">{usuario?.email}</strong>.
              Clique no link para confirmar a troca de senha.
            </p>
            <button
              className="pu-modal-btn-cancel"
              onClick={() => { setEtapa('form'); setForm({ novaSenha: '', confirmarSenha: '' }); }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </section>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function TelaEnderecos() {
  return (
    <section>
      <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconMapPin size={14} /></span>Endereços</h2>
      <p className="pu-sec-desc">Gerencie seus endereços de entrega.</p>
    </section>
  );
}

function TelaCartoes() {
  return (
    <section>
      <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconCreditCard size={14} /></span>Cartões</h2>
      <p className="pu-sec-desc">Gerencie seus cartões de pagamento.</p>
    </section>
  );
}

function TelaFatura() {
  return (
    <section>
      <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconReceipt size={14} /></span>Fatura</h2>
      <p className="pu-sec-desc">Visualize e baixe suas faturas.</p>
    </section>
  );
}

function TelaComunicacao() {
  return (
    <section>
      <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconBell size={14} /></span>Comunicação</h2>
      <p className="pu-sec-desc">Configure suas preferências de notificação.</p>
    </section>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PerfilVendedor({ onAbrirMercado }: { onAbrirMercado?: (m: { id: number; nome: string }) => void }) {
  const [nav, setNav] = useState(0);
  const [telaAtiva, setTelaAtiva] = useState(0);
  const [visivel, setVisivel] = useState(true);
  const anteriorNav = useRef(0);
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  useEffect(() => {
    async function carregarDados() {
      const [mercadosRes, favRes, histRes, avalRes] = await Promise.allSettled([
        api.meusMercados(),
        api.listarFavoritos(),
        api.listarHistorico(),
        api.listarAvaliacoes(),
      ]);
      if (mercadosRes.status === 'fulfilled') setMercados(mercadosRes.value.mercados ?? []);
      if (favRes.status === 'fulfilled') setFavoritos(favRes.value.favoritos ?? []);
      if (histRes.status === 'fulfilled') setHistorico(histRes.value.historico ?? []);
      if (avalRes.status === 'fulfilled') setAvaliacoes(avalRes.value.avaliacoes ?? []);
      setCarregando(false);
    }
    carregarDados();
  }, []);

  // ✅ Troca de tela com animação — igual ao PerfilUsuario
  useEffect(() => {
    if (anteriorNav.current === nav) return;
    setVisivel(false);
    const t = setTimeout(() => {
      setTelaAtiva(nav);
      setVisivel(true);
      anteriorNav.current = nav;
    }, 180);
    return () => clearTimeout(t);
  }, [nav]);

  const TELAS = [
    <TelaPerfil mercados={mercados} carregando={carregando} onAbrirMercado={onAbrirMercado} favoritos={favoritos} historico={historico} avaliacoes={avaliacoes} onAtualizarFavoritos={setFavoritos} />,
    <TelaSeguranca />,
    <TelaEnderecos />,
    <TelaCartoes />,
    <TelaFatura />,
    <TelaComunicacao />,
  ];

  return (
    <div className="pv-shell">
      <Sidebar
        iniciais={iniciais}
        nome={usuario?.nome ?? 'Carregando...'}
        email={usuario?.email ?? ''}
        badge="VENDEDOR"
        navAtivo={nav}
        onNav={setNav}
        navItems={NAV_ITEMS}
      />
      <main className="pv-main">
        <div className="pv-topbar">
          <span className="pv-topbar-title">{TITULOS[nav]}</span>
          <button className="pv-btn-new" onClick={() => navigate('/registrar-mercado')}>+ Novo Mercado</button>
        </div>
        <div className="pv-content">
          <div className={`pu-tela-fade ${visivel ? 'pu-tela-visivel' : 'pu-tela-oculta'}`}>
            {TELAS[telaAtiva]}
          </div>
        </div>
      </main>
    </div>
  );
}