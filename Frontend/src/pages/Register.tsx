import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./CSS/register.css";

interface Toast {
  id: number;
  tipo: "sucesso" | "erro" | "aviso" | "info";
  mensagem: string;
  hiding?: boolean;
}

let toastIdCounter = 0;

const tipoMap = {
  sucesso: { cls: "toast-success", icon: "✓", titulo: "Sucesso" },
  erro:    { cls: "toast-error",   icon: "✕", titulo: "Erro" },
  aviso:   { cls: "toast-warning", icon: "!", titulo: "Atenção" },
  info:    { cls: "toast-info",    icon: "i", titulo: "Aviso" },
};

interface FieldState {
  status: "" | "error" | "success";
  msg: string;
}

const emptyField: FieldState = { status: "", msg: "" };

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    senha: "",
    confirmar: "",
  });

  const [fields, setFields] = useState({
    nome:      { ...emptyField },
    telefone:  { ...emptyField },
    email:     { ...emptyField },
    senha:     { ...emptyField },
    confirmar: { ...emptyField },
  });

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // ── Toast helpers ──
  function showToast(tipo: Toast["tipo"], mensagem: string) {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, tipo, mensagem }]);
    const timer = setTimeout(() => dismissToast(id), 3500);
    toastTimers.current.set(id, timer);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }

  // ── Field helpers ──
  function setField(name: string, status: FieldState["status"], msg: string) {
    setFields((prev) => ({ ...prev, [name]: { status, msg } }));
  }

  function fieldClass(name: keyof typeof fields) {
    const s = fields[name].status;
    if (s === "error") return "field has-error";
    if (s === "success") return "field has-success";
    return "field";
  }

  // ── Handlers ──
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setField(name, "", "");
  }

  function formatTelefone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11)
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return value;
  }

  function handleTelefone(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatTelefone(e.target.value);
    setForm((prev) => ({ ...prev, telefone: formatted }));
    setField("telefone", "", "");
  }

  function validate() {
    let ok = true;

    if (!form.nome.trim()) {
      setField("nome", "error", "Nome é obrigatório.");
      ok = false;
    } else if (form.nome.trim().length < 3) {
      setField("nome", "error", "Nome muito curto.");
      ok = false;
    } else {
      setField("nome", "success", "");
    }

    const digits = form.telefone.replace(/\D/g, "");
    if (!digits) {
      setField("telefone", "error", "Telefone é obrigatório.");
      ok = false;
    } else if (digits.length < 10) {
      setField("telefone", "error", "Telefone inválido.");
      ok = false;
    } else {
      setField("telefone", "success", "");
    }

    if (!form.email) {
      setField("email", "error", "Email é obrigatório.");
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setField("email", "error", "Email inválido.");
      ok = false;
    } else {
      setField("email", "success", "");
    }

    if (!form.senha) {
      setField("senha", "error", "Senha é obrigatória.");
      ok = false;
    } else if (form.senha.length < 6) {
      setField("senha", "error", "Mínimo de 6 caracteres.");
      ok = false;
    } else {
      setField("senha", "success", "");
    }

    if (!form.confirmar) {
      setField("confirmar", "error", "Confirme a senha.");
      ok = false;
    } else if (form.confirmar !== form.senha) {
      setField("confirmar", "error", "As senhas não coincidem.");
      ok = false;
    } else {
      setField("confirmar", "success", "");
    }

    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome.trim(),
          telefone: form.telefone.trim(),
          email: form.email.trim(),
          senha: form.senha,
          confirmarSenha: form.confirmar,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('sucesso', 'Verifique seu email para concluir o cadastro! 🎉');
        setTimeout(() => navigate('/auth'), 2000);
      } else {
        if (Array.isArray(data.erros)) {
          showToast('erro', data.erros.join(' • '));
        } else {
          showToast('erro', data.erro || 'Erro ao cadastrar. Tente novamente.');
        }
      }
    } catch {
      showToast('erro', 'Falha na conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  }

  // ── Strength meter ──
  function senhaStrength(senha: string) {
    let score = 0;
    if (senha.length >= 8) score++;
    if (/[A-Z]/.test(senha)) score++;
    if (/[0-9]/.test(senha)) score++;
    if (/[^A-Za-z0-9]/.test(senha)) score++;
    const map = [
      { pct: "25%", color: "#ef4444", label: "Fraca" },
      { pct: "50%", color: "#f59e0b", label: "Razoável" },
      { pct: "75%", color: "#3b82f6", label: "Boa" },
      { pct: "100%", color: "#22c55e", label: "Forte" },
    ];
    return score > 0 ? map[score - 1] : null;
  }

  const strength = form.senha ? senhaStrength(form.senha) : null;

  return (
    <>
      {/* Toast container */}
      <div id="toast-container">
        {toasts.map((t) => {
          const c = tipoMap[t.tipo];
          return (
            <div
              key={t.id}
              className={`toast ${c.cls} ${t.hiding ? "hide" : "show"}`}
              onClick={() => dismissToast(t.id)}
            >
              <div className="toast-icon-wrap">{c.icon}</div>
              <div className="toast-body">
                <div className="toast-title">{c.titulo}</div>
                <div className="toast-msg">{t.mensagem}</div>
              </div>
              <button
                className="toast-close"
                onClick={(ev) => { ev.stopPropagation(); dismissToast(t.id); }}
              >
                ×
              </button>
              <div className="toast-progress" />
            </div>
          );
        })}
      </div>

      {/* Left panel */}
      <div className="left">
        <div className="left-bg" />
        <div className="circle circle-1" />
        <div className="circle circle-2" />
        <div className="circle circle-3" />
        <button className="btn-back" onClick={() => history.back()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="logo-wrap">
          <img
            className="logo-img"
            src="../src/assets/logo.jpeg"
            alt="Mercadins Logo"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="logo-tagline">Seu mercado inteligente</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="right">
        <div className="form-card">
          <div className="form-header">
            <h1>Vamos<br />Começar! 🚀</h1>
            <p>Crie a sua conta aqui abaixo!</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Nome */}
            <div className={fieldClass("nome")}>
              <input
                type="text"
                name="nome"
                placeholder="Nome completo"
                autoComplete="name"
                value={form.nome}
                onChange={handleChange}
              />
              <span className="field-icon-register">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="field-msg">{fields.nome.msg}</span>
            </div>

            {/* Telefone */}
            <div className={fieldClass("telefone")}>
              <input
                type="tel"
                name="telefone"
                placeholder="Telefone"
                autoComplete="tel"
                value={form.telefone}
                onChange={handleTelefone}
              />
              <span className="field-icon-register">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <span className="field-msg">{fields.telefone.msg}</span>
            </div>

            {/* Email */}
            <div className={fieldClass("email")}>
              <input
                type="email"
                name="email"
                placeholder="Email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
              />
              <span className="field-icon-register">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <span className="field-msg">{fields.email.msg}</span>
            </div>

            {/* Senha */}
            <div className={fieldClass("senha")}>
              <input
                type={showSenha ? "text" : "password"}
                name="senha"
                placeholder="Senha"
                autoComplete="new-password"
                value={form.senha}
                onChange={handleChange}
              />
              <span className="field-icon-register">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <button type="button" className="toggle-senha" onClick={() => setShowSenha((v) => !v)}>
                {showSenha ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
              <span className="field-msg">{fields.senha.msg}</span>
              {strength && (
                <div className="senha-strength show">
                  <div className="strength-bar">
                    <div className="strength-fill" style={{ width: strength.pct, background: strength.color }} />
                  </div>
                  <span className="strength-label" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            {/* Confirmar Senha */}
            <div className={fieldClass("confirmar")}>
              <input
                type={showConfirmar ? "text" : "password"}
                name="confirmar"
                placeholder="Confirmar Senha"
                autoComplete="new-password"
                value={form.confirmar}
                onChange={handleChange}
              />
              <span className="field-icon-register">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              <button type="button" className="toggle-senha" onClick={() => setShowConfirmar((v) => !v)}>
                {showConfirmar ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
              <span className="field-msg">{fields.confirmar.msg}</span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <span className="btn-loader">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </span>
              ) : "Cadastrar-se"}
            </button>

          </form>

          <div className="login-link">
            Já tem uma conta?{" "}
            <a onClick={() => navigate("/auth")} style={{ cursor: "pointer" }}>
              Faça login
            </a>
          </div>

          <div className="badge">
            <span />
            Conexão segura e criptografada
          </div>
        </div>
      </div>
    </>
  );
}