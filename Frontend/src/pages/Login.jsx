import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './CSS/Login.css'

export default function Login() {
  const { login } = useAuth()

  const [form, setForm] = useState({ email: '', senha: '' })
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState([])

  // ── Toast ────────────────────────────────────
  function showToast(tipo, mensagem) {
    const id = Date.now()
    setToasts(prev => [...prev, { id, tipo, mensagem }])
    setTimeout(() => dismissToast(id), 3500)
  }

  function dismissToast(id) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400)
  }

  const tipoMap = {
    sucesso: { cls: 'toast-success', icon: '✓', titulo: 'Sucesso' },
    erro:    { cls: 'toast-error',   icon: '✕', titulo: 'Erro' },
    aviso:   { cls: 'toast-warning', icon: '!', titulo: 'Atenção' },
    info:    { cls: 'toast-info',    icon: 'i', titulo: 'Aviso' },
  }

  // ── Handlers ────────────────────────────────
  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.email || !form.senha) {
      showToast('erro', 'Preencha email e senha.')
      return
    }

    setLoading(true)
    try {
      const usuario = await login(form.email, form.senha)
      showToast('sucesso', `Bem-vindo(a) de volta, ${usuario?.nome ?? ''}! 👋`)
      setTimeout(() => { window.location.href = '/dashboard' }, 1500)
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Verifique')) {
        showToast('aviso', msg)
      } else {
        showToast('erro', msg || 'Email ou senha incorretos.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────
  return (
    <>
      {/* Toast container */}
      <div id="toast-container">
        {toasts.map(t => {
          const c = tipoMap[t.tipo]
          return (
            <div
              key={t.id}
              className={`toast ${c.cls} ${t.hiding ? 'hide' : 'show'}`}
              onClick={() => dismissToast(t.id)}
            >
              <div className="toast-icon-wrap">{c.icon}</div>
              <div className="toast-body">
                <div className="toast-title">{c.titulo}</div>
                <div className="toast-msg">{t.mensagem}</div>
              </div>
              <button
                className="toast-close"
                onClick={e => { e.stopPropagation(); dismissToast(t.id) }}
              >×</button>
              <div className="toast-progress" />
            </div>
          )
        })}
      </div>

      {/* LEFT */}
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
            src="../logos/logo.jpeg"
            alt="Mercadins Logo"
            onError={e => e.target.style.background = '#1a3a7a'}
          />
          <span className="logo-tagline">Seu mercado inteligente</span>
        </div>
      </div>

      {/* RIGHT */}
      <div className="right">
        <div className="form-card">
          <div className="form-header">
            <h1>Bem Vindo<br />de Volta! 👋</h1>
            <p>Vamos te reconectar aqui abaixo!</p>
          </div>

          <form id="formLogin" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="field">
              <input
                type="email"
                name="email"
                placeholder="Email:"
                id="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                required
              />
              <span className="field-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
            </div>

            {/* Senha */}
            <div className="field">
              <input
                type="password"
                name="senha"
                placeholder="Senha:"
                id="senha"
                autoComplete="current-password"
                value={form.senha}
                onChange={handleChange}
                required
              />
              <span className="field-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
            </div>

            <a href="#" className="forgot">Esqueci Minha Senha</a>

            <button
              type="submit"
              className="btn btn-secondary"
              id="btnLogar"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Login'}
            </button>

            <div className="divider">ou</div>
          </form>

          <button
            className="btn btn-primary"
            onClick={() => window.location.href = '/auth/register'}
          >
            Cadastrar-se
          </button>

          <div className="badge">
            <span />
            Conexão segura e criptografada
          </div>
        </div>
      </div>
    </>
  )
}