import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import './CSS/PerfilVendedor.css';

interface Mercado {
  id_mercado: number;
  nome: string;
  email: string;
  cidade: string;
  estado: string;
}

interface Favorito  { emoji: string; nome: string; }
interface Historico { emoji: string; nome: string; preco: string; data: string; status: string; label: string; }
interface Avaliacao { loja: string; n: number; texto: string; }

const FAVORITOS: Favorito[] = [];
const HISTORICO: Historico[] = [];
const AVALIACOES: Avaliacao[] = [];

const EMOJIS = ['🛒', '🥩', '🥦', '🍞', '🏪', '🧺', '🐟', '🌿'];

function Stars({ n }: { n: number }) {
  return <span className="pv-stars">{Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')}</span>;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

export default function PerfilVendedor({ onAbrirMercado }: { onAbrirMercado?: (m: { emoji: string; nome: string }) => void }) {
  const [nav, setNav] = useState(0);
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  useEffect(() => {
    async function carregarMercados() {
      try {
        const res = await fetch('/api/mercados');
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

  const stats = [
    { val: String(mercados.length), lbl: 'Mercados Ativos' },
    { val: '4.8 ★',                 lbl: 'Avaliação Média' },
    { val: '1.247',                  lbl: 'Pedidos Totais' },
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
      />
      <main className="pv-main">
        <div className="pv-topbar">
          <span className="pv-topbar-title">Painel do Vendedor</span>
          <button className="pv-btn-new" onClick={() => navigate('/registrar-mercado')}>+ Novo Mercado</button>
        </div>
        <div className="pv-content">

          <div className="pv-stats-row">
            {stats.map((s,i) => (
              <div key={i} className="pv-stat" style={{animationDelay:`${0.25+i*0.09}s`}}>
                <p className="pv-stat-val">{s.val}</p>
                <p className="pv-stat-lbl">{s.lbl}</p>
              </div>
            ))}
          </div>

          <div className="pv-divider"/>

          <section>
            <div className="pv-sec-row">
              <h2 className="pv-sec-title">🏪 Mercados Gerenciados</h2>
              <button className="pv-btn-link">Gerenciar todos</button>
            </div>
            <div className="pv-mkt-row">
              {carregando ? (
                <p style={{ color: 'var(--cinza-texto)', fontSize: 13 }}>Carregando...</p>
              ) : mercados.map((m, i) => (
                <div key={m.id_mercado} className="pv-mkt-card" style={{animationDelay:`${0.3+i*0.09}s`}}
                  onClick={() => onAbrirMercado && onAbrirMercado({ emoji: EMOJIS[i % EMOJIS.length], nome: m.nome })}>
                  <div className="pv-mkt-img">{EMOJIS[i % EMOJIS.length]}</div>
                  <p className="pv-mkt-nome">{m.nome}</p>
                  <p style={{ fontSize: 11, color: 'var(--cinza-texto)' }}>{m.cidade} · {m.estado}</p>
                  <span className="pv-mkt-abrir">Gerenciar →</span>
                </div>
              ))}
              <div className="pv-mkt-card pv-mkt-add" style={{animationDelay:'0.57s'}}
                onClick={() => navigate('/registrar-mercado')}>
                <span className="pv-mkt-plus">+</span>
                <p className="pv-mkt-nome" style={{color:'var(--cinza-texto)'}}>Novo mercado</p>
              </div>
            </div>
          </section>

          <div className="pv-divider"/>

          <section>
            <h2 className="pv-sec-title">❤️ Mercados Favoritos</h2>
            <div className="pv-circles">
              {FAVORITOS.map((f,i) => (
                <div key={i} className="pv-circ-item" style={{animationDelay:`${0.3+i*0.08}s`}}>
                  <div className="pv-circ">{f.emoji}</div>
                  <span className="pv-circ-label">{f.nome}</span>
                </div>
              ))}
              <div className="pv-circ-item" style={{animationDelay:'0.62s'}}>
                <div className="pv-circ pv-circ-add">+</div>
                <span className="pv-circ-label pv-circ-muted">Adicionar</span>
              </div>
            </div>
          </section>

          <div className="pv-divider"/>

          <section>
            <div className="pv-sec-row">
              <h2 className="pv-sec-title">🛍️ Histórico de Compras</h2>
              <button className="pv-btn-link">Ver todos</button>
            </div>
            <div className="pv-hist-grid">
              {HISTORICO.map((p,i) => (
                <div key={i} className="pv-hcard" style={{animationDelay:`${0.3+i*0.09}s`}}>
                  <div className="pv-hcard-img">{p.emoji}</div>
                  <div className="pv-hcard-body">
                    <p className="pv-hcard-nome">{p.nome}</p>
                    <p className="pv-hcard-preco">{p.preco}</p>
                    <p className="pv-hcard-data">{p.data}</p>
                    <span className={`pv-status ${p.status}`}>● {p.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="pv-divider"/>

          <section>
            <div className="pv-sec-row">
              <h2 className="pv-sec-title">⭐ Avaliações Feitas</h2>
              <button className="pv-btn-link">Ver todas</button>
            </div>
            <div className="pv-rev-grid">
              {AVALIACOES.map((a,i) => (
                <div key={i} className="pv-rev-card" style={{animationDelay:`${0.3+i*0.09}s`}}>
                  <p className="pv-rev-store">{a.loja}</p>
                  <Stars n={a.n}/>
                  <p className="pv-rev-text">{a.texto}</p>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}