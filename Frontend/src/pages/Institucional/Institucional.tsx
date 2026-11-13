import { useLayoutEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo2.png";
import SiteFooter from "../../components/SiteFooter/SiteFooter";
import "./Institucional.css";

type Props = {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
};

export default function PaginaInstitucional({ titulo, subtitulo, children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  useLayoutEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.key, location.hash]);

  function voltar() {
    const origem = new URLSearchParams(location.search).get("origem");
    if (origem === "cadastro" || origem === "registro-mercado") {
      const destino = origem === "cadastro" ? "/auth/register" : "/registrar-mercado";
      window.close();
      navigate(destino);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  return (
    <div className="inst-page">
      <header className="inst-header">
        <div className="inst-container inst-header-inner">
          <a href="/" className="inst-logo" title="Voltar ao início">
            <img src={logo} alt="Mercadins" />
          </a>
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
