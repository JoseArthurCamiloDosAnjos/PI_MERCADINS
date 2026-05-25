import React, { useState } from 'react';
import Sidebar from './Sidebar';
import './PerfilUsuario.css';

interface Favorito {
  emoji: string;
  nome: string;
}

interface Historico {
  emoji: string;
  nome: string;
  preco: string;
  data: string;
  status: string;
  label: string;
}

interface Avaliacao {
  loja: string;
  n: number;
  texto: string;
}

const FAVORITOS: Favorito[] = [
  { emoji: '🥩', nome: 'Açougue BH' },
  { emoji: '🛒', nome: 'MercaLins' },
  { emoji: '🥦', nome: 'Hortifruti' },
  { emoji: '🍞', nome: 'Padaria SP' },
  { emoji: '🐟', nome: 'Peixaria' },
  { emoji: '🌿', nome: 'Bio Fresh' },
  { emoji: '🧀', nome: 'Frios & Cia' },
];

const HISTORICO: Historico[] = [
  { emoji: '🥩', nome: 'Açougue BH',  preco: 'R$ 87,50',  data: '12 mai 2026 · 3 itens',  status: 'done',      label: 'Entregue'   },
  { emoji: '🛒', nome: 'MercaLins',   preco: 'R$ 134,00', data: '10 mai 2026 · 12 itens', status: 'transit',   label: 'A caminho'  },
  { emoji: '🥦', nome: 'Hortifruti',  preco: 'R$ 42,30',  data: '08 mai 2026 · 7 itens',  status: 'cansel',    label: 'Cancelado'  },
  { emoji: '🍞', nome: 'Padaria SP',  preco: 'R$ 29,00',  data: '05 mai 2026 · 4 itens',  status: 'preparate', label: 'Preparando' },
];

const AVALIACOES: Avaliacao[] = [
  { loja: 'Açougue BH', n: 5, texto: '"Carne de ótima qualidade, entrega rápida!"' },
  { loja: 'MercaLins',  n: 4, texto: '"Bom atendimento, produtos frescos."'         },
  { loja: 'Padaria SP', n: 5, texto: '"Pão chegou quentinho!"'                      },
  { loja: 'Hortifruti', n: 3, texto: '"Produto ok, embalagem poderia ser melhor."'  },
];

function Stars({ n }: { n: number }) {
  return <span className="pu-stars">{Array.from({ length: 5 }, (_, i) => i < n ? '★' : '☆').join('')}</span>;
}

export default function PerfilUsuario() {
  const [nav, setNav] = useState<number>(0);

  return (
    <div className="pu-shell">
      <Sidebar iniciais="JW" nome="João Watanabe" email="joao.w@email.com" navAtivo={nav} onNav={setNav} />
      <main className="pu-main">
        <div className="pu-topbar">
          <span className="pu-topbar-title">Meu Perfil</span>
          <button className="pu-btn-edit">✏️ Editar Perfil</button>
        </div>
        <div className="pu-content">

          {/* FAVORITOS */}
          <section>
            <h2 className="pu-sec-title">🏪 Mercados Favoritos</h2>
            <div className="pu-circles">
              {FAVORITOS.map((f, i) => (
                <div key={i} className="pu-circ-item" style={{ animationDelay: `${0.3 + i * 0.07}s` }}>
                  <div className="pu-circ">{f.emoji}</div>
                  <span className="pu-circ-label">{f.nome}</span>
                </div>
              ))}
              <div className="pu-circ-item" style={{ animationDelay: '0.82s' }}>
                <div className="pu-circ pu-circ-add">+</div>
                <span className="pu-circ-label pu-circ-muted">Adicionar</span>
              </div>
            </div>
          </section>

          <div className="pu-divider" />

          {/* HISTÓRICO */}
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

          {/* AVALIAÇÕES */}
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

        </div>
      </main>
    </div>
  );
}