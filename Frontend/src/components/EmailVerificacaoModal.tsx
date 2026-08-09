import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { BASE_URL } from "../services/api";

interface EmailVerificacaoModalProps {
  email: string;
  onClose: () => void;
}

export default function EmailVerificacaoModal({ email, onClose }: EmailVerificacaoModalProps) {
  const [codigo, setCodigo] = useState(["", "", "", "", "", ""]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  function mascaraEmail(e: string) {
    const [user, domain] = e.split("@");
    if (!domain) return e;
    const visivel = user.slice(0, 2);
    return `${visivel}${"*".repeat(Math.max(user.length - 2, 2))}@${domain}`;
  }

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const novo = [...codigo];
    novo[index] = value.slice(-1);
    setCodigo(novo);
    setErro("");
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !codigo[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleVerificar();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const colado = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!colado) return;
    const novo = [...codigo];
    for (let i = 0; i < 6; i++) {
      novo[i] = colado[i] || "";
    }
    setCodigo(novo);
    setErro("");
    const proximoVazio = novo.findIndex((c) => !c);
    inputsRef.current[proximoVazio === -1 ? 5 : proximoVazio]?.focus();
  }

  async function handleVerificar() {
    const codigoStr = codigo.join("");
    if (codigoStr.length !== 6) {
      setErro("Digite o código completo de 6 dígitos.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`${BASE_URL}/api/auth/verificar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigoStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Código inválido.");
        return;
      }
      setSucesso(true);
      setTimeout(onClose, 2000);
    } catch {
      setErro("Erro ao verificar código.");
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-icon-wrap modal-icon-email" style={{ background: "#2ecc71" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="modal-title">Email verificado!</h2>
          <p className="modal-desc">Você já pode fazer login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-icon-wrap modal-icon-email">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <div className="modal-badge">Verifique seu e-mail</div>

        <h2 className="modal-title">Confirme seu cadastro</h2>
        <p className="modal-desc">
          Enviamos um código de 6 dígitos para:
        </p>

        <div className="modal-email-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <span>{mascaraEmail(email)}</span>
        </div>

        <div className="modal-code-inputs">
          {codigo.map((digito, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digito}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              className="modal-code-input"
            />
          ))}
        </div>

        {erro && <p className="modal-error">{erro}</p>}

        <button
          className="modal-btn modal-btn-primary"
          onClick={handleVerificar}
          disabled={carregando}
        >
          {carregando ? "Verificando..." : "Verificar código"}
        </button>

        <p className="modal-footer-text">
          Não recebeu?{" "}
          <button className="modal-link" onClick={onClose}>
            Reenviar código
          </button>
        </p>
      </div>
    </div>
  );
}
