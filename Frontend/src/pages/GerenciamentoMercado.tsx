import { useState } from 'react';
import './CSS/GerenciamentoMercado.css';

const SIDEBAR_NAV = [
  { emoji: '📊', label: 'Visão Geral' },
  { emoji: '📦', label: 'Produtos' },
  { emoji: '🛒', label: 'Pedidos' },
  { emoji: '⭐', label: 'Avaliações' },
  { emoji: '📈', label: 'Relatórios' },
  { emoji: '📍', label: 'Endereço' },
  { emoji: '🕐', label: 'Horários' },
  { emoji: '⚙️', label: 'Configurações' },
  { emoji: '',   label: 'voltar'}
];

const STATS = [
  { val: 'R$ 4.280', lbl: 'Faturamento Mensal' },
  { val: '138',      lbl: 'Pedidos no Mês' },
  { val: '4.8 ★',   lbl: 'Avaliação Média' },
  { val: '42',       lbl: 'Produtos Ativos' },
  { val: '7',        lbl: 'Pedidos Hoje' },
];

const PRODUTOS = [
  { emoji: '🥩', nome: 'Picanha 1kg',    preco: 'R$ 59,90', stock: 'in',  stockLabel: 'Em estoque' },
  { emoji: '🥛', nome: 'Leite Integral', preco: 'R$ 5,49',  stock: 'in',  stockLabel: 'Em estoque' },
  { emoji: '🍅', nome: 'Tomate kg',      preco: 'R$ 7,90',  stock: 'low', stockLabel: 'Estoque baixo' },
  { emoji: '🍗', nome: 'Frango 2kg',     preco: 'R$ 24,90', stock: 'in',  stockLabel: 'Em estoque' },
];

const PEDIDOS = [
  { num: '#00247', cliente: 'João Watanabe', itens: 'Picanha 1kg, Leite x2, Tomate — 3 itens', preco: 'R$ 78,78', status: 'new',     label: 'Novo' },
  { num: '#00246', cliente: 'Maria Souza',   itens: 'Frango 2kg, Leite x4 — 2 itens',          preco: 'R$ 46,86', status: 'transit', label: 'A caminho' },
  { num: '#00245', cliente: 'Carlos Lima',   itens: 'Picanha 1kg x2 — 1 item',                 preco: 'R$119,80', status: 'done',    label: 'Entregue' },
  { num: '#00244', cliente: 'Ana Ferreira',  itens: 'Frango 2kg, Tomate x3 — 4 itens',         preco: 'R$ 48,60', status: 'done',    label: 'Entregue' },
];

const AVALIACOES = [
  { iniciais: 'JW', nome: 'João Watanabe', n: 5, texto: '"Carne de ótima qualidade, entrega super rápida!"' },
  { iniciais: 'MS', nome: 'Maria Souza',   n: 4, texto: '"Produtos frescos, atendimento muito bom."' },
  { iniciais: 'CL', nome: 'Carlos Lima',   n: 5, texto: '"Picanha chegou no ponto certo. Recomendo!"' },
  { iniciais: 'AF', nome: 'Ana Ferreira',  n: 3, texto: '"Tomate veio um pouco machucado, o resto ok."' },
];

function Stars({ n }: { n: number }) {
  return <span className="gm-stars">{Array.from({length:5},(_,i)=>i<n?'★':'☆').join('')}</span>;
}

export default function GerenciamentoMercado({ onVoltar }: { onVoltar: () => void }) {
  const [nav, setNav] = useState(0);
  return (
    <div className="gm-shell">

      {/* SIDEBAR */}
      <aside className="gm-sidebar">
        <div className="gm-mkt-identity">
          <div className="gm-mkt-logo">🛒</div>
          <p className="gm-mkt-nome">MercaLins Centro</p>
          <p className="gm-mkt-sub">São Paulo · SP</p>
          <span className="gm-status-open">● Aberto</span>
        </div>
        <nav className="gm-nav">
          {SIDEBAR_NAV.map((item,i) => (
            <button
              key={i}
              className={`gm-nav-btn${nav===i?' active':''}`}
              style={{animationDelay:`${0.25+i*0.06}s`}}
              onClick={() => setNav(i)}
            >
              <span className="gm-nav-emoji">{item.emoji}</span>
              <span className="gm-nav-label">{item.label}</span>
              {nav===i && <span className="gm-nav-dot"/>}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className="gm-main">
        {/* TOP BAR */}
        <div className="gm-topbar">
          <div className="gm-topbar-left">
            <button className="gm-btn-back" onClick={onVoltar}>← Meus Mercados</button>
            <span className="gm-topbar-title">MercaLins Centro</span>
          </div>
          <div className="gm-topbar-actions">
            <button className="gm-btn-sec">👁 Ver Vitrine</button>
            <button className="gm-btn-primary">+ Adicionar Produto</button>
          </div>
        </div>

        <div className="gm-content">

          {/* STATS */}
          <div className="gm-stats-row">
            {STATS.map((s,i) => (
              <div key={i} className="gm-stat" style={{animationDelay:`${0.25+i*0.08}s`}}>
                <p className="gm-stat-val">{s.val}</p>
                <p className="gm-stat-lbl">{s.lbl}</p>
              </div>
            ))}
          </div>

          <div className="gm-divider"/>

          {/* PRODUTOS */}
          <section>
            <div className="gm-sec-row">
              <h2 className="gm-sec-title">📦 Produtos em Destaque</h2>
              <button className="gm-btn-link">Ver todos (42)</button>
            </div>
            <div className="gm-prod-row">
              {PRODUTOS.map((p,i) => (
                <div key={i} className="gm-prod-card" style={{animationDelay:`${0.3+i*0.08}s`}}>
                  <div className="gm-prod-img">{p.emoji}</div>
                  <div className="gm-prod-body">
                    <p className="gm-prod-nome">{p.nome}</p>
                    <p className="gm-prod-preco">{p.preco}</p>
                    <span className={`gm-stock ${p.stock}`}>
                      <span className="gm-stock-dot"/>
                      {p.stockLabel}
                    </span>
                  </div>
                </div>
              ))}
              <div className="gm-prod-card gm-prod-add" style={{animationDelay:'0.62s'}}>
                <span className="gm-prod-add-icon">+</span>
                <span className="gm-prod-add-label">Novo produto</span>
              </div>
            </div>
          </section>

          <div className="gm-divider"/>

          {/* PEDIDOS */}
          <section>
            <div className="gm-sec-row">
              <h2 className="gm-sec-title">🛒 Pedidos Recentes</h2>
              <button className="gm-btn-link">Ver todos</button>
            </div>
            <div className="gm-orders-list">
              {PEDIDOS.map((p,i) => (
                <div key={i} className="gm-order-row" style={{animationDelay:`${0.3+i*0.08}s`}}>
                  <span className="gm-order-num">{p.num}</span>
                  <div className="gm-order-info">
                    <p className="gm-order-cliente">{p.cliente}</p>
                    <p className="gm-order-itens">{p.itens}</p>
                  </div>
                  <p className="gm-order-preco">{p.preco}</p>
                  <span className={`gm-status ${p.status}`}>● {p.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="gm-divider"/>

          {/* AVALIAÇÕES */}
          <section>
            <div className="gm-sec-row">
              <h2 className="gm-sec-title">⭐ Avaliações Recentes</h2>
              <button className="gm-btn-link">Ver todas (89)</button>
            </div>
            <div className="gm-rev-grid">
              {AVALIACOES.map((a,i) => (
                <div key={i} className="gm-rev-card" style={{animationDelay:`${0.3+i*0.09}s`}}>
                  <div className="gm-rev-user">
                    <div className="gm-rev-avatar">{a.iniciais}</div>
                    <p className="gm-rev-nome">{a.nome}</p>
                  </div>
                  <Stars n={a.n}/>
                  <p className="gm-rev-text">{a.texto}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="gm-divider"/>

          {/* INFO */}
          <section>
            <div className="gm-sec-row">
              <h2 className="gm-sec-title">ℹ️ Informações do Mercado</h2>
              <button className="gm-btn-link">Editar</button>
            </div>
            <div className="gm-info-grid">
              <div className="gm-info-card">
                <div className="gm-info-row"><span className="gm-info-lbl">📍 Endereço</span><span className="gm-info-val">Av. Paulista, 1000 — SP</span></div>
                <div className="gm-info-row"><span className="gm-info-lbl">📞 Telefone</span><span className="gm-info-val">(11) 91234-5678</span></div>
                <div className="gm-info-row"><span className="gm-info-lbl">✉️ Email</span><span className="gm-info-val">mercalins@email.com</span></div>
              </div>
              <div className="gm-info-card">
                <div className="gm-info-row"><span className="gm-info-lbl">🕐 Seg–Sex</span><span className="gm-info-val">08h às 20h</span></div>
                <div className="gm-info-row"><span className="gm-info-lbl">🕐 Sábado</span><span className="gm-info-val">08h às 18h</span></div>
                <div className="gm-info-row"><span className="gm-info-lbl">🕐 Domingo</span><span className="gm-info-val">Fechado</span></div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
