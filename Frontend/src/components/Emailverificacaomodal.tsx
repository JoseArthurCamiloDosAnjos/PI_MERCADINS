interface EmailVerificacaoModalProps {
  email: string;
  onClose: () => void;
}

export default function EmailVerificacaoModal({ email, onClose }: EmailVerificacaoModalProps) {
  // Mascara o email: ex. jo**@gmail.com
  function mascaraEmail(e: string) {
    const [user, domain] = e.split("@");
    if (!domain) return e;
    const visivel = user.slice(0, 2);
    return `${visivel}${"*".repeat(Math.max(user.length - 2, 2))}@${domain}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        {/* Ícone animado */}
        <div className="modal-icon-wrap modal-icon-email">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <div className="modal-badge">Verifique seu e-mail</div>

        <h2 className="modal-title">Confirme seu cadastro</h2>
        <p className="modal-desc">
          Enviamos um link de ativação para:
        </p>

        <div className="modal-email-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span>{mascaraEmail(email)}</span>
        </div>

        <p className="modal-hint">
          Acesse sua caixa de entrada e clique no link para ativar sua conta. Verifique também a pasta de spam.
        </p>

        <div className="modal-steps">
          <div className="modal-step">
            <div className="step-num">1</div>
            <span>Abra seu e-mail</span>
          </div>
          <div className="modal-step-arrow">→</div>
          <div className="modal-step">
            <div className="step-num">2</div>
            <span>Clique no link</span>
          </div>
          <div className="modal-step-arrow">→</div>
          <div className="modal-step">
            <div className="step-num">3</div>
            <span>Conta ativada!</span>
          </div>
        </div>

        <button className="modal-btn modal-btn-primary" onClick={onClose}>
          Entendido
        </button>

        <p className="modal-footer-text">
          Não recebeu?{" "}
          <button className="modal-link" onClick={onClose}>
            Reenviar e-mail
          </button>
        </p>
      </div>
    </div>
  );
}