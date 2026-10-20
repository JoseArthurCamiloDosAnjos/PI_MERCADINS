import { useEffect } from "react";
import "./ConsultorModal.css";

const WHATSAPP = "5516988755641";
const EMAIL = "Suporte@mercadins.com.br";
const TELEFONE_EXIBICAO = "(16) 98875-5641";

const MENSAGEM =
  "Olá! Estou no site do Mercadins e quero saber mais sobre o plano Personalizado.";

interface ConsultorModalProps {
  aberto: boolean;
  onFechar: () => void;
}

export default function ConsultorModal({ aberto, onFechar }: ConsultorModalProps) {
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const linkWhats =
    `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAGEM)}`;
  const linkEmail =
    `mailto:${EMAIL}?subject=${encodeURIComponent("Plano Personalizado - Mercadins")}` +
    `&body=${encodeURIComponent(MENSAGEM)}`;

  return (
    <div
      className="ct-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Falar com um consultor"
    >
      <div className="ct-modal">
        <button className="ct-close" onClick={onFechar} aria-label="Fechar">
          ×
        </button>

        <span className="ct-icone">🤝</span>
        <h2 className="ct-titulo">Fale com um consultor</h2>
        <p className="ct-descricao">
          O plano Personalizado é montado sob medida para o porte do seu mercado.
          Conte o que você precisa e montamos a proposta na hora.
        </p>

        <div className="ct-acoes">
          <a
            className="ct-btn ct-btn--whats"
            href={linkWhats}
            target="_blank"
            rel="noreferrer"
            onClick={onFechar}
          >
            <span className="ct-btn-icone">📱</span>
            <span className="ct-btn-texto">
              <strong>WhatsApp</strong>
              <small>{TELEFONE_EXIBICAO}</small>
            </span>
          </a>

          <a
            className="ct-btn ct-btn--email"
            href={linkEmail}
            onClick={onFechar}
          >
            <span className="ct-btn-icone">✉️</span>
            <span className="ct-btn-texto">
              <strong>E-mail</strong>
              <small>{EMAIL}</small>
            </span>
          </a>
        </div>

        <p className="ct-nota">Respondemos em até 1 dia útil.</p>
      </div>
    </div>
  );
}
