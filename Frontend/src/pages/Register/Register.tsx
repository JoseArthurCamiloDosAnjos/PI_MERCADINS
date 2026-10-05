import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./Register.css";
import "../common/Modais.css";
import { BASE_URL } from '../../services/api';

import { useToast } from '../../hooks/useToast';
import { removeEmojis, LIMITS, bloquearEspaco, sanitizeEmail, sanitizeName, sanitizePassword } from '../../hooks/useBlockEmojis';
import ToastContainer from '../../components/Toast';
import PasswordStrength from "../../components/PasswordStrength";
import logoImg from "../../assets/logo.jpeg";
import logo2Img from "../../assets/logo2.png";

interface FieldState {
  status: "" | "error" | "success";
  msg: string;
}

const emptyField: FieldState = { status: "", msg: "" };

function Contador({ atual, max }: { atual: number; max: number }) {
  return (
    <span className={`field-counter ${atual >= max ? "is-full" : ""}`}>
      {atual}/{max}
    </span>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();

  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    cpf: "",
    data_nascimento: "",
    data_display: "",
    email: "",
    senha: "",
    confirmar: "",
  });

  const [fields, setFields] = useState({
    nome:      { ...emptyField },
    telefone:  { ...emptyField },
    cpf:       { ...emptyField },
    data_nascimento: { ...emptyField },
    email:     { ...emptyField },
    senha:     { ...emptyField },
    confirmar: { ...emptyField },
  });

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

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
    let filtered: string;
    if (name === "email") {
      filtered = sanitizeEmail(value);
    } else if (name === "senha" || name === "confirmar") {
      filtered = sanitizePassword(value);
    } else {
      filtered = sanitizeName(value);
    }
    setForm((prev) => ({ ...prev, [name]: filtered }));
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
    const formatted = formatTelefone(removeEmojis(e.target.value)).slice(0, LIMITS.telefone);
    setForm((prev) => ({ ...prev, telefone: formatted }));
    setField("telefone", "", "");
  }

  function formatCPF(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  function handleCPF(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCPF(removeEmojis(e.target.value)).slice(0, LIMITS.cpf);
    setForm((prev) => ({ ...prev, cpf: formatted }));
    setField("cpf", "", "");
  }

  // ── Data de nascimento ──
  function aplicarData(digits: string) {
    let display = digits;
    if (digits.length > 2) display = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 5) display = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);

    if (digits.length === 8) {
      const d = digits.slice(0, 2);
      const m = digits.slice(2, 4);
      const y = digits.slice(4, 8);
      const parsed = new Date(`${y}-${m}-${d}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        setForm((prev) => ({ ...prev, data_nascimento: `${y}-${m}-${d}`, data_display: display }));
        setField("data_nascimento", "", "");
        return;
      }
    }
    setForm((prev) => ({ ...prev, data_nascimento: "", data_display: display }));
  }

  function handleData(e: React.ChangeEvent<HTMLInputElement>) {
    aplicarData(e.target.value.replace(/\D/g, "").slice(0, 8));
  }

  function selecionarData(date: Date | null) {
    if (!date) return;
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = String(date.getFullYear());
    setDataSelecionada(date);
    setCalendarioAberto(false);
    setForm((prev) => ({ ...prev, data_nascimento: `${y}-${m}-${d}`, data_display: `${d}/${m}/${y}` }));
    setField("data_nascimento", "", "");
  }

  function limparData() {
    setDataSelecionada(null);
    setForm((prev) => ({ ...prev, data_nascimento: "", data_display: "" }));
    setField("data_nascimento", "", "");
  }

  function validarCPF(cpf: string): boolean {
    const numeros = cpf.replace(/\D/g, "");
    if (numeros.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(numeros)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(numeros[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(numeros[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(numeros[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(numeros[10])) return false;

    return true;
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

    const cpfDigitos = form.cpf.replace(/\D/g, "");
    if (!cpfDigitos) {
      setField("cpf", "error", "CPF é obrigatório.");
      ok = false;
    } else if (!validarCPF(form.cpf)) {
      setField("cpf", "error", "CPF inválido.");
      ok = false;
    } else {
      setField("cpf", "success", "");
    }

    if (!form.data_nascimento) {
      setField("data_nascimento", "error", "Data de aniversário é obrigatória.");
      ok = false;
    } else {
      const data = new Date(form.data_nascimento);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      if (isNaN(data.getTime()) || data >= hoje) {
        setField("data_nascimento", "error", "Data de aniversário inválida.");
        ok = false;
      } else {
        setField("data_nascimento", "success", "");
      }
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
    } else {
      const regrasSenha: Array<[boolean, string]> = [
        [form.senha.length >= 8, "Mínimo de 8 caracteres."],
        [/[A-Z]/.test(form.senha), "Inclua uma letra maiúscula."],
        [/[a-z]/.test(form.senha), "Inclua uma letra minúscula."],
        [/[0-9]/.test(form.senha), "Inclua um número."],
        [/[!@#$%^&*(),.?":{}|<>]/.test(form.senha), "Inclua um caractere especial."],
      ];
      const falhou = regrasSenha.find(([passou]) => !passou);
      if (falhou) {
        setField("senha", "error", falhou[1]);
        ok = false;
      } else {
        setField("senha", "success", "");
      }
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
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome.trim(),
          telefone: form.telefone.trim(),
          cpf: form.cpf.trim(),
          data_nascimento: form.data_nascimento || null,
          email: form.email.trim(),
          senha: form.senha,
          confirmarSenha: form.confirmar,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        navigate(`/verificar-email?email=${encodeURIComponent(form.email.trim())}`);
      } else {
        if (Array.isArray(data.erros)) {
          showToast("erro", data.erros.join(" • "));
        } else {
          showToast("erro", data.erro || "Erro ao cadastrar. Tente novamente.");
        }
      }
    } catch {
      showToast("erro", "Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="register-page">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
            src={logoImg}
            alt="Mercadins Logo"
          />
          <span className="logo-tagline">Seu mercado inteligente</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="right">
        <div className="form-card">
          <div className="mobile-logo">
            <img className="mobile-logo-img" src={logo2Img} alt="Mercadins" />
          </div>
          <div className="form-header">
            <h1>Vamos<br />Começar! 🚀</h1>
            <p>Crie a sua conta aqui abaixo!</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            {/* Nome */}
            <div className={fieldClass("nome")}>
              <div className="field-input-wrap">
                <input
                  type="text"
                  name="nome"
                  placeholder="Nome completo"
                  autoComplete="name"
                  maxLength={LIMITS.nome}
                  value={form.nome}
                  onChange={handleChange}
                />
                <span className="field-icon-register">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
              </div>
              <div className="field-foot">
                <span className="field-msg">{fields.nome.msg}</span>
                <Contador atual={form.nome.length} max={LIMITS.nome} />
              </div>
            </div>

            {/* Telefone */}
            <div className={fieldClass("telefone")}>
              <div className="field-input-wrap">
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
              </div>
              <span className="field-msg">{fields.telefone.msg}</span>
            </div>

            {/* CPF */}
            <div className={fieldClass("cpf")}>
              <div className="field-input-wrap">
                <input
                  type="text"
                  name="cpf"
                  placeholder="CPF"
                  autoComplete="off"
                  value={form.cpf}
                  onChange={handleCPF}
                  maxLength={LIMITS.cpf}
                />
                <span className="field-icon-register">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </span>
              </div>
              <span className="field-msg">{fields.cpf.msg}</span>
            </div>

            {/* Data de Nascimento */}
            <div className={fieldClass("data_nascimento")}>
              <div className="field-input-wrap date-input-wrap">
                <input
                  ref={dateInputRef}
                  type="text"
                  name="data_nascimento"
                  className="date-input"
                  placeholder="DD/MM/AAAA"
                  maxLength={LIMITS.data_nascimento}
                  autoComplete="bday"
                  value={form.data_display}
                  onKeyDown={(e) => {
                    if (!/[0-9]/.test(e.key) && e.key !== "Backspace" && e.key !== "Tab" && e.key !== "Enter") {
                      e.preventDefault();
                    }
                  }}
                  onChange={handleData}
                />
                <span className="field-icon-register">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <button
                  type="button"
                  className="date-picker-trigger"
                  onClick={() => setCalendarioAberto(true)}
                  aria-label="Abrir calendário"
                  title="Abrir calendário"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
                {calendarioAberto && (
                  <DatePicker
                    open
                    selected={dataSelecionada}
                    onChange={selecionarData}
                    onClickOutside={() => setCalendarioAberto(false)}
                    onCalendarClose={() => setCalendarioAberto(false)}
                    dateFormat="dd/MM/yyyy"
                    maxDate={new Date()}
                    openToDate={dataSelecionada ?? undefined}
                    popperTargetRef={dateInputRef}
                    popperPlacement="bottom-end"
                    showIcon={false}
                    locale="pt-BR"
                  />
                )}
              </div>
              <div className="field-foot">
                <span className="field-msg">{fields.data_nascimento.msg}</span>
                {form.data_display && (
                  <button type="button" className="field-counter is-clear" onClick={limparData}>
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div className={fieldClass("email")}>
              <div className="field-input-wrap">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  autoComplete="email"
                  maxLength={LIMITS.email}
                  value={form.email}
                  onChange={handleChange}
                  onKeyDown={bloquearEspaco}
                />
                <span className="field-icon-register">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
              </div>
              <div className="field-foot">
                <span className="field-msg">{fields.email.msg}</span>
                <Contador atual={form.email.length} max={LIMITS.email} />
              </div>
            </div>

            {/* Senha */}
            <div className={fieldClass("senha")}>
              <div className="field-input-wrap">
                <input
                  type={showSenha ? "text" : "password"}
                  name="senha"
                  placeholder="Senha"
                  autoComplete="new-password"
                  maxLength={LIMITS.senha}
                  onKeyDown={bloquearEspaco}
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
              </div>
              <span className="field-msg">{fields.senha.msg}</span>
              <PasswordStrength senha={form.senha} />
            </div>

            {/* Confirmar Senha */}
            <div className={fieldClass("confirmar")}>
              <div className="field-input-wrap">
                <input
                  type={showConfirmar ? "text" : "password"}
                  name="confirmar"
                  placeholder="Confirmar Senha"
                  autoComplete="new-password"
                  maxLength={LIMITS.confirmar}
                  onKeyDown={bloquearEspaco}
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
              </div>
              <span className="field-msg">{fields.confirmar.msg}</span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <span className="register-spinner" />
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
    </div>
  );
}