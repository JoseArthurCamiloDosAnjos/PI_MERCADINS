import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';
import LoadingOverlay from '../components/LoadingOverlay';
import PasswordStrength from '../components/PasswordStrength';
import './CSS/PerfilVendedor.css';
import './CSS/PerfilUsuario.css'; // ✅ importa os estilos do usuário para reutilizar

interface Mercado {
  id_mercado: number;
  nome: string;
  email: string;
  cidade: string;
  estado: string;
  papel: string;
}

interface Favorito  { emoji: string; nome: string; }
interface Historico { emoji: string; nome: string; preco: string; data: string; status: string; label: string; }
interface Avaliacao { loja: string; n: number; texto: string; }

const FAVORITOS: Favorito[] = [];
const HISTORICO: Historico[] = [];
const AVALIACOES: Avaliacao[] = [];

const EMOJIS = ['🛒', '🥩', '🥦', '🍞', '🏪', '🧺', '🐟', '🌿'];

const NAV_ITEMS = [
  { emoji: '👤', label: 'Perfil' },
  { emoji: '🔒', label: 'Segurança' },
  { emoji: '📍', label: 'Endereços' },
  { emoji: '💳', label: 'Cartões' },
  { emoji: '🧾', label: 'Fatura' },
  { emoji: '🔔', label: 'Comunicação' },
];

const TITULOS = ['Painel do Vendedor', 'Segurança', 'Endereços', 'Cartões', 'Fatura', 'Comunicação'];

function Stars({ n }: { n: number }) {
  return <span className="pu-stars">{Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')}</span>;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function BtnOlho({ visivel, onToggle }: { visivel: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="pu-input-eye" onClick={onToggle} tabIndex={-1}>
      {visivel ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

// ─── Telas ────────────────────────────────────────────────────────────────────

function TelaPerfil({ mercados, carregando, onAbrirMercado }: {
  mercados: Mercado[];
  carregando: boolean;
  onAbrirMercado?: (m: { id: number; emoji: string; nome: string }) => void;
}) {
  const navigate = useNavigate();

  const stats = [
    { val: String(mercados.length), lbl: 'Mercados Ativos' },
    { val: '0 ★',                 lbl: 'Avaliação Média' },
    { val: '0',                  lbl: 'Pedidos Totais' },
  ];

  return (
    <>
      <div className="pv-stats-row">
        {stats.map((s, i) => (
          <div key={i} className="pv-stat" style={{ animationDelay: `${0.25 + i * 0.09}s` }}>
            <p className="pv-stat-val">{s.val}</p>
            <p className="pv-stat-lbl">{s.lbl}</p>
          </div>
        ))}
      </div>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title">🏪 Mercados Gerenciados</h2>
          <button className="pu-btn-link">Gerenciar todos</button>
        </div>
        <div className="pv-mkt-row">
          {carregando ? (
            <p style={{ color: 'var(--cinza-texto)', fontSize: 13 }}>Carregando...</p>
          ) : mercados.length === 0 ? (
            <p style={{ color: 'var(--cinza-texto)', fontSize: 13 }}>Nenhum mercado cadastrado ainda.</p>
          ) : mercados.map((m, i) => (
            <div key={m.id_mercado} className="pv-mkt-card" style={{ animationDelay: `${0.3 + i * 0.09}s` }}
              onClick={() => onAbrirMercado && onAbrirMercado({ id: m.id_mercado, emoji: EMOJIS[i % EMOJIS.length], nome: m.nome })}>
              <div className="pv-mkt-img">{EMOJIS[i % EMOJIS.length]}</div>
              <p className="pv-mkt-nome">{m.nome}</p>
              <p style={{ fontSize: 11, color: 'var(--cinza-texto)' }}>{m.cidade} · {m.estado}</p>
              <span className="pv-mkt-abrir">Gerenciar →</span>
            </div>
          ))}
          <div className="pv-mkt-card pv-mkt-add" style={{ animationDelay: '0.57s' }}
            onClick={() => navigate('/registrar-mercado')}>
            <span className="pv-mkt-plus">+</span>
            <p className="pv-mkt-nome" style={{ color: 'var(--cinza-texto)' }}>Novo mercado</p>
          </div>
        </div>
      </section>

      <div className="pu-divider" />

      <section>
        <h2 className="pu-sec-title">❤️ Mercados Favoritos</h2>
        <div className="pu-circles">
          {FAVORITOS.map((f, i) => (
            <div key={i} className="pu-circ-item" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
              <div className="pu-circ">{f.emoji}</div>
              <span className="pu-circ-label">{f.nome}</span>
            </div>
          ))}
          <div className="pu-circ-item" style={{ animationDelay: '0.62s' }}>
            <div className="pu-circ pu-circ-add">+</div>
            <span className="pu-circ-label pu-circ-muted">Adicionar</span>
          </div>
        </div>
      </section>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title">🛍️ Histórico de Compras</h2>
          <button className="pu-btn-link">Ver todos</button>
        </div>
        <div className="pu-hist-grid">
          {HISTORICO.map((p, i) => (
            <div key={i} className="pu-hcard" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
              <div className="pu-hcard-img">{p.emoji}</div>
              <div className="pu-hcard-body">
                <p className="pu-hcard-nome">{p.nome}</p>
                <p className="pu-hcard-preco">{p.preco}</p>
                <p className="pu-hcard-data">{p.data}</p>
                <span className={`pu-status ${p.status}`}>● {p.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title">⭐ Avaliações Feitas</h2>
          <button className="pu-btn-link">Ver todas</button>
        </div>
        <div className="pu-rev-grid">
          {AVALIACOES.map((a, i) => (
            <div key={i} className="pu-rev-card" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
              <p className="pu-rev-store">{a.loja}</p>
              <Stars n={a.n} />
              <p className="pu-rev-text">{a.texto}</p>
            </div>
          ))}
        </div>
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
      const { api } = await import('../services/api');
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
        <h2 className="pu-sec-title">🔒 Segurança</h2>
        {etapa === 'form' ? (
          <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
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
              className="pu-modal-btn-save"
              onClick={enviarConfirmacao}
              disabled={enviando}
              style={{ alignSelf: 'flex-start', marginTop: 4 }}
            >
              📧 Salvar e Confirmar por Email
            </button>
          </div>
        ) : (
          <div style={{
            marginTop: 24,
            background: 'var(--azul-card)',
            border: '1px solid var(--azul-item)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 48 }}>📬</span>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--branco)' }}>Verifique seu email</p>
            <p style={{ fontSize: 13, color: 'var(--cinza-texto)', lineHeight: 1.6 }}>
              Enviamos um link de confirmação para{' '}
              <strong style={{ color: 'var(--amarelo)' }}>{usuario?.email}</strong>.
              Clique no link para confirmar a troca de senha.
            </p>
            <button
              className="pu-modal-btn-cancel"
              onClick={() => { setEtapa('form'); setForm({ novaSenha: '', confirmarSenha: '' }); }}
              style={{ marginTop: 8 }}
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
      <h2 className="pu-sec-title">📍 Endereços</h2>
      <p className="pu-sec-desc">Gerencie seus endereços de entrega.</p>
    </section>
  );
}

function TelaCartoes() {
  return (
    <section>
      <h2 className="pu-sec-title">💳 Cartões</h2>
      <p className="pu-sec-desc">Gerencie seus cartões de pagamento.</p>
    </section>
  );
}

function TelaFatura() {
  return (
    <section>
      <h2 className="pu-sec-title">🧾 Fatura</h2>
      <p className="pu-sec-desc">Visualize e baixe suas faturas.</p>
    </section>
  );
}

function TelaComunicacao() {
  return (
    <section>
      <h2 className="pu-sec-title">🔔 Comunicação</h2>
      <p className="pu-sec-desc">Configure suas preferências de notificação.</p>
    </section>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PerfilVendedor({ onAbrirMercado }: { onAbrirMercado?: (m: { id: number; emoji: string; nome: string }) => void }) {
  const [nav, setNav] = useState(0);
  const [telaAtiva, setTelaAtiva] = useState(0);
  const [visivel, setVisivel] = useState(true);
  const anteriorNav = useRef(0);
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  useEffect(() => {
    async function carregarMercados() {
      const token = localStorage.getItem('token');
      if (!token) { setCarregando(false); return; }
      try {
        const res = await fetch('/api/usuarios-mercados/meus', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setMercados(data.mercados ?? []);
      } catch {
        console.error('Erro ao carregar mercados');
      } finally {
        setCarregando(false);
      }
    }
    carregarMercados();
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
    <TelaPerfil mercados={mercados} carregando={carregando} onAbrirMercado={onAbrirMercado} />,
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