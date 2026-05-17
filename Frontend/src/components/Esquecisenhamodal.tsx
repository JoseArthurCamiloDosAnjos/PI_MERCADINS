import { useState } from "react";

interface EsqueciSenhaModalProps {
  onClose: () => void;
}

type Etapa = "email" | "enviado";

export default function EsqueciSenhaModal({ onClose }: EsqueciSenhaModalProps) {
  const [etapa, setEtapa] = useState<Etapa>("email");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  function mascaraEmail(e: string) {
    const [user, domain] = e.split("@");
    if (!domain) return e;
    const visivel = user.slice(0, 2);
    return `${visivel}${"*".repeat(Math.max(user.length - 2, 2))}@${domain}`;
  }

  async function handleEnviar() {
    if (!email) {
      setErro("Informe seu e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErro("E-mail inválido.");
      return;
    }
    setErro("");
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Sempre mostra a tela de sucesso (segurança: não revelar se email existe)
      setEtapa("enviado");
    } catch {
      setErro("Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        {etapa === "email" ? (
          <>
            {/* Ícone */}
            <div className="modal-icon-wrap modal-icon-lock">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <div className="modal-badge modal-badge-warning">Recuperar acesso</div>

            <h2 className="modal-title">Esqueceu sua senha?</h2>
            <p className="modal-desc">
              Sem problema! Digite o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
            </p>

            <div className={`modal-field ${erro ? "modal-field-error" : ""}`}>
              <span className="modal-field-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                type="email"
                placeholder="Seu e-mail cadastrado"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErro(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleEnviar()}
                autoFocus
              />
            </div>
            {erro && <span className="modal-field-msg">{erro}</span>}

            <button
              className="modal-btn modal-btn-primary"
              onClick={handleEnviar}
              disabled={loading}
            >
              {loading ? (
                <svg className="modal-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ) : "Enviar link de recuperação"}
            </button>

            <button className="modal-btn modal-btn-ghost" onClick={onClose}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            {/* Tela de sucesso */}
            <div className="modal-icon-wrap modal-icon-success">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>

            <div className="modal-badge modal-badge-success">E-mail enviado!</div>

            <h2 className="modal-title">Verifique sua caixa de entrada</h2>
            <p className="modal-desc">
              Enviamos o link de recuperação para:
            </p>

            <div className="modal-email-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>{mascaraEmail(email)}</span>
            </div>

            <p className="modal-hint">
              O link expira em <strong>15 minutos</strong>. Verifique também a pasta de spam caso não encontre o e-mail.
            </p>

            <button className="modal-btn modal-btn-primary" onClick={onClose}>
              Voltar ao login
            </button>

            <p className="modal-footer-text">
              Não recebeu?{" "}
              <button className="modal-link" onClick={() => { setEtapa("email"); setEmail(""); }}>
                Tentar novamente
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}