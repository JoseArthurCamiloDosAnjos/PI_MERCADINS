import "./Sidebar.css";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

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
  navItems?: NavItem[]; // ✅ opcional — se não passar, usa o padrão do usuário
}

const NAV_ITEMS_PADRAO: NavItem[] = [
  { emoji: "👤", label: "Perfil" },
  { emoji: "🔒", label: "Segurança" },
  { emoji: "📍", label: "Endereços" },
  { emoji: "💳", label: "Cartões" },
  { emoji: "🧾", label: "Fatura" },
  { emoji: "🔔", label: "Comunicação" },
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
  const navigate = useNavigate();

  // Usa os itens passados ou o padrão do usuário
  const itens = navItems ?? NAV_ITEMS_PADRAO;

  function handleLogout() {
    logout();
    navigate("/auth");
  }

  return (
    <aside className="sb-root">
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
            onClick={() => onNav && onNav(i)}
          >
            <span className="sb-nav-emoji">{item.emoji}</span>
            <span className="sb-nav-label">{item.label}</span>
            {navAtivo === i && <span className="sb-nav-dot" />}
          </button>
        ))}
      </nav>

      <div className="sb-footer">
        <button
          className="sb-create-btn"
          onClick={() => navigate("/registrar-mercado")}
        >
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
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
  );
}