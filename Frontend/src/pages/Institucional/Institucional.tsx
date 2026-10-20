import { useLayoutEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo2.png";
import SiteFooter from "../../components/SiteFooter/SiteFooter";
import "./Institucional.css";

type Props = {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
};

/**
 * Layout das páginas institucionais (Sobre, Como funciona, Atendimento,
 * Termos, Privacidade, Cookies...): cabeçalho com logo + botão voltar,
 * conteúdo e rodapé do site.
 */
export default function PaginaInstitucional({ titulo, subtitulo, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  // Ao trocar para uma página institucional, cai no topo na hora
  // (sem esperar a pintura — evita "piscar" no lugar antigo).
  // Se a URL tem #secao, deixa a própria página cuidar da rolagem.
  useLayoutEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.key, location.hash]);

  function voltar() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  return (
    <div className="inst-page">
      <header className="inst-header">
        <div className="inst-container inst-header-inner">
          <Link to="/" className="inst-logo" title="Voltar ao início">
            <img src={logo} alt="Mercadins" />
          </Link>
          <button className="inst-voltar" onClick={voltar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Voltar
          </button>
        </div>
      </header>

      <main className="inst-container inst-main">
        <section className="inst-hero">
          <h1>{titulo}</h1>
          {subtitulo && <p>{subtitulo}</p>}
        </section>

        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
