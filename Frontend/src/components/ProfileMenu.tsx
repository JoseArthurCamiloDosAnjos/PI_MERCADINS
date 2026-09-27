import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconUser, IconGear } from "./Icons";
import "./ProfileMenu.css";

function getIniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const IconLogout = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
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
);

interface ProfileMenuProps {
  onNavigate?: () => void;
  inline?: boolean;
}

export default function ProfileMenu({ onNavigate, inline = false }: ProfileMenuProps) {
  const { usuario, temMercado, logout } = useAuth();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [aberto]);

  if (!usuario) return null;

  const isAdminLogin =
    !!usuario.is_admin && localStorage.getItem("is_admin_login") === "true";

  function irPara(rota: string) {
    setAberto(false);
    onNavigate?.();
    navigate(rota);
  }

  function handleLogout() {
    setAberto(false);
    onNavigate?.();
    logout();
    navigate("/");
  }

  return (
    <div className={`pm-root${inline ? " pm-root--inline" : ""}`} ref={rootRef}>
      <button
        className="pm-btn"
        onClick={() => setAberto((v) => !v)}
        aria-label="Menu do perfil"
        aria-expanded={aberto}
        type="button"
      >
        {usuario.foto_perfil ? (
          <img src={usuario.foto_perfil} alt={usuario.nome} className="pm-avatar-img" />
        ) : (
          <span className="pm-iniciais">{getIniciais(usuario.nome) || "?"}</span>
        )}
      </button>

      {aberto && (
        <div className="pm-dropdown">
          <div className="pm-header">
            <strong>{usuario.nome}</strong>
            <span>{usuario.email}</span>
          </div>

          <button
            className="pm-item"
            type="button"
            onClick={() => irPara(temMercado ? "/vendedor" : "/perfil")}
          >
            <IconUser size={16} />
            Meu perfil
          </button>

          {isAdminLogin && (
            <button className="pm-item" type="button" onClick={() => irPara("/admin")}>
              <IconGear size={16} />
              Admin
            </button>
          )}

          <div className="pm-divider" />

          <button className="pm-item pm-item--sair" type="button" onClick={handleLogout}>
            <IconLogout size={16} />
            Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}
