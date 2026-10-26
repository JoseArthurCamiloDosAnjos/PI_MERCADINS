
import { useState } from "react";
import "./MenuMobile.css";

export default function MenuMobile() {
  const [menuAberto, setMenuAberto] = useState(false);

  const fecharMenu = () => setMenuAberto(false);

  return (
    <div className="menu-mobile-container">
      <button
        type="button"
        className="menu-sanduiche"
        aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuAberto}
        aria-controls="menu-mobile"
        onClick={() => setMenuAberto(!menuAberto)}
      >
        {menuAberto ? (
          <svg viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {menuAberto && (
        <nav
          id="menu-mobile"
          className="menu-mobile"
          aria-label="Menu principal"
        >
          <a href="#topo" onClick={fecharMenu}>Início</a>
          <a href="#mercados" onClick={fecharMenu}>Mercados</a>
          <a href="#categorias" onClick={fecharMenu}>Categorias</a>
          <a href="#login" onClick={fecharMenu}>entrar</a>
          <a href="#serch" onClick={fecharMenu}> pesquisar </a>
          
        </nav>
      )}
    </div>
  );
}
