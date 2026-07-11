import { useState, type ReactNode } from "react";
import "./Sidebar.css";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import {
  IconUser,
  IconLock,
  IconMapPin,
  IconCreditCard,
  IconReceipt,
  IconBell,
  IconPlus,
  IconMenu,
  IconX,
} from "./Icons";

interface NavItem {
  icon: ReactNode;
  label: string;
}

interface SidebarProps {
  iniciais: string;
  nome: string;
  email: string;
  badge?: string;
  navAtivo: number;
  onNav?: (index: number) => void;
  navItems?: NavItem[]; // ✅ opcional — se não passar, usa o padrão do usuário
}

const NAV_ITEMS_PADRAO: NavItem[] = [
  { icon: <IconUser size={18} />, label: "Perfil" },
  { icon: <IconLock size={18} />, label: "Segurança" },
  { icon: <IconMapPin size={18} />, label: "Endereços" },
  { icon: <IconCreditCard size={18} />, label: "Cartões" },
  { icon: <IconReceipt size={18} />, label: "Fatura" },
  { icon: <IconBell size={18} />, label: "Comunicação" },
];

export default function Sidebar({
  iniciais,
  nome,
  email,
  badge,
  navAtivo,
  onNav,
  navItems,
}: SidebarProps) {
  const { logout } = useAuth();
  const { tema, toggleTema } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Usa os itens passados ou o padrão do usuário
  const itens = navItems ?? NAV_ITEMS_PADRAO;

  function handleLogout() {
    logout();
    navigate("/auth");
  }

  function handleNav(i: number) {
    onNav && onNav(i);
    setOpen(false);
  }

  return (
    <>
      <button
        className="sb-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
      >
        <IconMenu size={20} />
      </button>

      {open && <div className="sb-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sb-root${open ? " sb-open" : ""}`}>
        <button
          className="sb-close"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        >
          <IconX size={18} />
        </button>

        <div className="sb-profile">
          <div className="sb-avatar">{iniciais}</div>
          <p className="sb-nome">{nome}</p>
          <p className="sb-email">{email}</p>
          {badge && <span className="sb-badge">{badge}</span>}
        </div>

        <nav className="sb-nav">
          {itens.map((item, i) => (
            <button
              key={i}
              className={`sb-nav-btn${navAtivo === i ? " active" : ""}`}
              style={{ animationDelay: `${0.25 + i * 0.07}s` }}
              onClick={() => handleNav(i)}
            >
              <span className="sb-nav-icon">{item.icon}</span>
              <span className="sb-nav-label">{item.label}</span>
              {navAtivo === i && <span className="sb-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sb-footer">
          <div className="sb-theme-row">
            <span className="sb-theme-label">Tema</span>
            <ThemeToggle tema={tema} onToggle={toggleTema} />
          </div>
          <button
            className="sb-create-btn"
            onClick={() => { navigate("/registrar-mercado"); setOpen(false); }}
          >
            <IconPlus size={16} />
            Criar Mercado
          </button>

          <button className="sb-logout-btn" onClick={handleLogout}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair da conta
          </button>
        </div>
      </aside>
    </>
  );
}