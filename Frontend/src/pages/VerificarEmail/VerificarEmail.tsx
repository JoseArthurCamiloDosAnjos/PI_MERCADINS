import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { BASE_URL } from '../../services/api';
import ToastContainer from '../../components/Toast';
import './VerificarEmail.css';

export default function VerificarEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toasts, dismissToast } = useToast();

  const emailParam = searchParams.get('email') ?? '';
  const codigoParam = searchParams.get('codigo') ?? '';

  const [codigo, setCodigo] = useState(["", "", "", "", "", ""]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (codigoParam && codigoParam.length === 6) {
      const digits = codigoParam.split("");
      setCodigo(digits);
      handleVerificarCodigo(digits.join(""));
    }
  }, []);

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
      handleVerificarCodigo();
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

  async function handleVerificarCodigo(codigoStr?: string) {
    const code = codigoStr || codigo.join("");
    if (code.length !== 6) {
      setErro("Digite o código completo de 6 dígitos.");
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`${BASE_URL}/api/auth/verificar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.erro || "Código inválido.");
        return;
      }
      setSucesso(true);
      setTimeout(() => navigate("/auth"), 2500);
    } catch {
      setErro("Erro ao verificar código.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="left">
        <div className="left-bg" />
        <div className="circle circle-1" />
        <div className="circle circle-2" />
        <div className="circle circle-3" />
        <div className="logo-wrap">
          <img className="logo-img" src="../src/assets/logo.jpeg" alt="Mercadins Logo"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span className="logo-tagline">Seu mercado inteligente</span>
        </div>
      </div>

      <div className="right">
        <div className="form-card">
          {sucesso ? (
            <div className="rs-sucesso">
              <div className="rs-sucesso-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h1>Email verificado!</h1>
              <p>Você já pode fazer login. Redirecionando...</p>
              <div className="rs-sucesso-dots">
                <span/><span/><span/>
              </div>
            </div>
          ) : (
            <>
              <div className="form-header">
                <h1>Verifique seu e-mail 📩</h1>
                <p>Enviamos um código de 6 dígitos para:</p>
              </div>

              {emailParam && (
                <div className="ve-email-box">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <span>{mascaraEmail(emailParam)}</span>
                </div>
              )}

              <div className="ve-code-inputs">
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
                    className="ve-code-input"
                  />
                ))}
              </div>

              {erro && <p className="ve-error">{erro}</p>}

              <button
                className="btn btn-primary"
                onClick={() => handleVerificarCodigo()}
                disabled={carregando}
              >
                {carregando ? "Verificando..." : "Verificar código"}
              </button>

              <button type="button" className="btn btn-secondary"
                onClick={() => navigate('/auth')}>
                Voltar ao login
              </button>

              <div className="badge">
                <span />
                Código válido por 24 horas
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
