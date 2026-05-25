import React from 'react';
import './Sidebar.css';

interface NavItem {
  emoji: string;
  label: string;
}

interface SidebarProps {
  iniciais: string;
  nome: string;
  email: string;
  badge?: string;
  navAtivo: number;
  onNav?: (index: number) => void;
}

const NAV_ITEMS: NavItem[] = [
  { emoji: '👤', label: 'Perfil' },
  { emoji: '🔒', label: 'Segurança' },
  { emoji: '📍', label: 'Endereços' },
  { emoji: '💳', label: 'Cartões' },
  { emoji: '🧾', label: 'Fatura' },
  { emoji: '🔔', label: 'Comunicação' },
];

export default function Sidebar({ iniciais, nome, email, badge, navAtivo, onNav }: SidebarProps) {
  return (
    <aside className="sb-root">
      <div className="sb-profile">
        <div className="sb-avatar">{iniciais}</div>
        <p className="sb-nome">{nome}</p>
        <p className="sb-email">{email}</p>
        {badge && <span className="sb-badge">{badge}</span>}
      </div>

      <nav className="sb-nav">
        {NAV_ITEMS.map((item, i) => (
          <button
            key={i}
            className={`sb-nav-btn${navAtivo === i ? ' active' : ''}`}
            style={{ animationDelay: `${0.25 + i * 0.07}s` }}
            onClick={() => onNav && onNav(i)}
          >
            <span className="sb-nav-emoji">{item.emoji}</span>
            <span className="sb-nav-label">{item.label}</span>
            {navAtivo === i && <span className="sb-nav-dot" />}
          </button>
        ))}
      </nav>
    </aside>
  );
}