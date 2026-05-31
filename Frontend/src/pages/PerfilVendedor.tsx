import{ useState } from 'react';
import Sidebar from './Sidebar';
import './CSS/PerfilVendedor.css';

const STATS = [
  { val: '3',      lbl: 'Mercados Ativos' },
  { val: '4.8 ★',  lbl: 'Avaliação Média' },
  { val: '1.247',  lbl: 'Pedidos Totais' },
];

const MERCADOS = [
  { emoji: '🛒', nome: 'MercaLins Centro' },
  { emoji: '🥩', nome: 'Açougue BH' },
  { emoji: '🥦', nome: 'Hortifruti' },
];

const FAVORITOS = [
  { emoji: '🍞', nome: 'Padaria SP' },
  { emoji: '🐟', nome: 'Peixaria' },
  { emoji: '🌿', nome: 'Bio Fresh' },
  { emoji: '🧀', nome: 'Frios & Cia' },
];

const HISTORICO = [
  { emoji: '🍞', nome: 'Padaria SP', preco: 'R$ 29,00', data: '15 mai 2026 · 4 itens', status: 'pending', label: 'Pendente' },
  { emoji: '🐟', nome: 'Peixaria',   preco: 'R$ 65,00', data: '13 mai 2026 · 2 itens', status: 'done',    label: 'Entregue' },
];

const AVALIACOES = [
  { loja: 'Padaria SP', n: 5, texto: '"Entrega impecável, ótimo produto!"' },
  { loja: 'Peixaria',   n: 4, texto: '"Peixe fresco, bom atendimento."' },
];

function Stars({ n }: { n: number }) {
  return <span className="pv-stars">{Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')}</span>;
}

export default function PerfilVendedor({ onAbrirMercado }: { onAbrirMercado?: (m: { emoji: string; nome: string }) => void }) {
  const [nav, setNav] = useState(0);
  return (
    <div className="pv-shell">
      <Sidebar iniciais="ML" nome="MercaLins Shop" email="admin@mercalins.com.br" badge="VENDEDOR" navAtivo={nav} onNav={setNav} />
      <main className="pv-main">
        <div className="pv-topbar">
          <span className="pv-topbar-title">Painel do Vendedor</span>
          <button className="pv-btn-new">+ Novo Mercado</button>
        </div>
        <div className="pv-content">

          {/* STATS */}
          <div className="pv-stats-row">
            {STATS.map((s,i) => (
              <div key={i} className="pv-stat" style={{animationDelay:`${0.25+i*0.09}s`}}>
                <p className="pv-stat-val">{s.val}</p>
                <p className="pv-stat-lbl">{s.lbl}</p>
              </div>
            ))}
          </div>

          <div className="pv-divider"/>

          {/* MERCADOS GERENCIADOS */}
          <section>
            <div className="pv-sec-row">
              <h2 className="pv-sec-title">🏪 Mercados Gerenciados</h2>
              <button className="pv-btn-link">Gerenciar todos</button>
            </div>
            <div className="pv-mkt-row">
              {MERCADOS.map((m,i) => (
                <div key={i} className="pv-mkt-card" style={{animationDelay:`${0.3+i*0.09}s`}}
                  onClick={() => onAbrirMercado && onAbrirMercado(m)}>
                  <div className="pv-mkt-img">{m.emoji}</div>
                  <p className="pv-mkt-nome">{m.nome}</p>
                  <span className="pv-mkt-abrir">Gerenciar →</span>
                </div>
              ))}
              <div className="pv-mkt-card pv-mkt-add" style={{animationDelay:'0.57s'}}>
                <span className="pv-mkt-plus">+</span>
                <p className="pv-mkt-nome" style={{color:'var(--cinza-texto)'}}>Novo mercado</p>
              </div>
            </div>
          </section>

          <div className="pv-divider"/>

          {/* FAVORITOS */}
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

          {/* HISTÓRICO */}
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

          {/* AVALIAÇÕES */}
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
