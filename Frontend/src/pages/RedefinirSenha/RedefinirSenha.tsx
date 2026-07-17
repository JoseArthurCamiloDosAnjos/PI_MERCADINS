import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { BASE_URL } from '../../services/api';
import ToastContainer from '../../components/Toast';
import PasswordStrength from '../../components/PasswordStrength';
import './RedefinirSenha.css';

function BtnOlho({ visivel, onToggle }: { visivel: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="toggle-senha" onClick={onToggle}>
      {visivel ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

export default function RedefinirSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();

  const [form, setForm] = useState({ novaSenha: '', confirmarSenha: '' });
  const [mostrarNova, setMostrarNova] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.novaSenha) return showToast('erro', 'Digite a nova senha.');
    if (form.novaSenha.length < 6) return showToast('erro', 'Mínimo 6 caracteres.');
    if (form.novaSenha !== form.confirmarSenha) return showToast('erro', 'As senhas não coincidem.');
    if (!token) return showToast('erro', 'Token inválido. Solicite um novo link.');

    setSalvando(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/redefinir-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, novaSenha: form.novaSenha, confirmarSenha: form.confirmarSenha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao redefinir senha.');
      setConcluido(true);
      setTimeout(() => navigate('/auth'), 2500);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao redefinir senha.');
    } finally {
      setSalvando(false);
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
          {concluido ? (
            <div className="rs-sucesso">
              <div className="rs-sucesso-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h1>Senha redefinida!</h1>
              <p>Redirecionando para o login...</p>
              <div className="rs-sucesso-dots">
                <span/><span/><span/>
              </div>
            </div>
          ) : (
            <>
              <div className="form-header">
                <h1>Nova Senha 🔒</h1>
                <p>Digite e confirme sua nova senha abaixo.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <input
                    type={mostrarNova ? 'text' : 'password'}
                    placeholder="Nova senha"
                    value={form.novaSenha}
                    onChange={e => setForm(f => ({ ...f, novaSenha: e.target.value }))}
                  />
                  <span className="field-icon-login">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <BtnOlho visivel={mostrarNova} onToggle={() => setMostrarNova(v => !v)} />
                </div>

                <PasswordStrength senha={form.novaSenha} />

                <div className="field">
                  <input
                    type={mostrarConfirmar ? 'text' : 'password'}
                    placeholder="Confirmar nova senha"
                    value={form.confirmarSenha}
                    onChange={e => setForm(f => ({ ...f, confirmarSenha: e.target.value }))}
                  />
                  <span className="field-icon-login">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <BtnOlho visivel={mostrarConfirmar} onToggle={() => setMostrarConfirmar(v => !v)} />
                </div>

                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Redefinir Senha'}
                </button>

                <button type="button" className="btn btn-secondary"
                  onClick={() => navigate('/auth')}>
                  Voltar ao login
                </button>
              </form>

              <div className="badge">
                <span />
                Conexão segura e criptografada
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}