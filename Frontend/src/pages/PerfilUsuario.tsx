import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import ModalEditarPerfil from '../components/ModalEditarPerfil';
import ToastContainer from '../components/Toast';
import LoadingOverlay from '../components/LoadingOverlay';
import PasswordStrength from '../components/PasswordStrength';
import '../pages/CSS/PerfilUsuario.css';
import {
  IconLock,
  IconMapPin,
  IconCreditCard,
  IconReceipt,
  IconBell,
  IconStore,
  IconShoppingBag,
  IconStar,
  IconPencil,
  IconMail,
  IconInbox,
} from '../components/Icons';

interface Favorito  { nome: string; }
interface Historico { nome: string; preco: string; data: string; status: string; label: string; }
interface Avaliacao { loja: string; n: number; texto: string; }

const FAVORITOS: Favorito[] = [];
const HISTORICO: Historico[] = [];
const AVALIACOES: Avaliacao[] = [];

const TITULOS = ['Meu Perfil', 'Segurança', 'Endereços', 'Cartões', 'Fatura', 'Comunicação'];

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

function TelaPerfil() {
  return (
    <>
      <section>
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconStore size={15} /></span>Mercados Favoritos</h2>
        <div className="pu-circles">
          <div className="pu-circ-item" style={{ animationDelay: '0.3s' }}>
            <div className="pu-circ pu-circ-add">+</div>
            <span className="pu-circ-label pu-circ-muted">Adicionar</span>
          </div>
          {FAVORITOS.map((f, i) => (
            <div key={i} className="pu-circ-item" style={{ animationDelay: `${0.38 + i * 0.07}s` }}>
              <div className="pu-circ"><IconStore size={22} /></div>
              <span className="pu-circ-label">{f.nome}</span>
            </div>
          ))}
        </div>
        {FAVORITOS.length === 0 && (
          <p className="pu-empty-inline">Você ainda não favoritou nenhum mercado. Explore e adicione seus preferidos aqui.</p>
        )}
      </section>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconShoppingBag size={14} /></span>Histórico de Compras</h2>
          <button className="pu-btn-link">Ver todos</button>
        </div>
        {HISTORICO.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconShoppingBag size={22} /></div>
            <p>Nenhuma compra realizada ainda</p>
            <span>Seus pedidos aparecerão aqui assim que você comprar em um mercado.</span>
          </div>
        ) : (
          <div className="pu-hist-grid">
            {HISTORICO.map((p, i) => (
              <div key={i} className="pu-hcard" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
                <div className="pu-hcard-img"><IconShoppingBag size={26} /></div>
                <div className="pu-hcard-body">
                  <p className="pu-hcard-nome">{p.nome}</p>
                  <p className="pu-hcard-preco">{p.preco}</p>
                  <p className="pu-hcard-data">{p.data}</p>
                  <span className={`pu-status ${p.status}`}>● {p.label}</span>
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
        {AVALIACOES.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconStar size={22} /></div>
            <p>Você ainda não avaliou nenhum mercado</p>
            <span>Suas avaliações ajudam outros compradores a escolher melhor.</span>
          </div>
        ) : (
          <div className="pu-rev-grid">
            {AVALIACOES.map((a, i) => (
              <div key={i} className="pu-rev-card" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
                <p className="pu-rev-store">{a.loja}</p>
                <Stars n={a.n} />
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

export default function PerfilUsuario() {
  const [nav, setNav] = useState<number>(0);
  const [telaAtiva, setTelaAtiva] = useState(0);
  const [visivel, setVisivel] = useState(true);
  const anteriorNav = useRef(0);
  const [modalAberto, setModalAberto] = useState(false);
  const { usuario } = useAuth();

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  const TELAS = [
    <TelaPerfil />,
    <TelaSeguranca />,
    <TelaEnderecos />,
    <TelaCartoes />,
    <TelaFatura />,
    <TelaComunicacao />,
  ];

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

  return (
   <div className="pu-shell">
      <Sidebar
        iniciais={iniciais}
        nome={usuario?.nome ?? 'Carregando...'}
        email={usuario?.email ?? ''}
        navAtivo={nav}
        onNav={setNav}
      />
      <main className="pu-main">
        <div className="pu-topbar">
          <span className="pu-topbar-title">{TITULOS[nav]}</span>
          <div className="pu-topbar-actions">
            {nav === 0 && (
              <button className="pu-btn-edit" onClick={() => setModalAberto(true)}>
                <IconPencil size={14} /> Editar Perfil
              </button>
            )}
          </div>
        </div> 
        <div className="pu-content">
          <div className={`pu-tela-fade ${visivel ? 'pu-tela-visivel' : 'pu-tela-oculta'}`}>
            {TELAS[telaAtiva]}
          </div>
        </div>
      </main>

      {modalAberto && <ModalEditarPerfil onFechar={() => setModalAberto(false)} />}
    </div>
  );
}