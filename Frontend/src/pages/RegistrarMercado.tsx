import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';
import './CSS/RegistrarMercado.css';
import { useAuth } from '../context/AuthContext';

interface Form {
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return <span className="field-icon-register">{children}</span>;
}

export default function RegistrarMercado() {
  const navigate = useNavigate();
  const { refreshMercados } = useAuth(); // ✅ corrigido: era refreshUsuario
  const { toasts, showToast, dismissToast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [form, setForm] = useState<Form>({
    nome: '', email: '', telefone: '', cnpj: '',
    cep: '', estado: '', cidade: '', bairro: '', rua: '',
  });

  function set(campo: keyof Form, valor: string) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  function formatarCNPJ(v: string) {
    return v.replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .slice(0, 18);
  }

  function formatarTelefone(v: string) {
    return v.replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2')
      .slice(0, 15);
  }

  function formatarCEP(v: string) {
    return v.replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  }

  async function buscarCEP() {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) return showToast('erro', 'CEP deve ter 8 dígitos.');
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) return showToast('erro', 'CEP não encontrado.');
      setForm(f => ({
        ...f,
        estado: data.uf,
        cidade: data.localidade,
        bairro: data.bairro,
        rua: data.logradouro,
      }));
      showToast('sucesso', 'Endereço preenchido automaticamente!');
    } catch {
      showToast('erro', 'Erro ao buscar CEP.');
    } finally {
      setBuscandoCep(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.telefone || !form.cnpj || !form.cep || !form.estado || !form.cidade || !form.bairro || !form.rua)
      return showToast('erro', 'Preencha todos os campos.');

    const token = localStorage.getItem('token');
    if (!token) return showToast('erro', 'Sessão expirada. Faça login novamente.');

    setSalvando(true);
    try {
      const res = await fetch('/api/mercados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone.replace(/\D/g, ''),
          cnpj: form.cnpj.replace(/\D/g, ''),
          cep: form.cep.replace(/\D/g, ''),
          estado: form.estado,
          cidade: form.cidade,
          bairro: form.bairro,
          rua: form.rua,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao cadastrar mercado.');

      showToast('sucesso', 'Mercado cadastrado com sucesso!');
      await refreshMercados(); // ✅ atualiza temMercado antes de navegar
      setTimeout(() => navigate('/vendedor'), 1500);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao cadastrar.');
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
        <button className="btn-back" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="logo-wrap">
          <img className="logo-img" src="../src/assets/logo.jpeg" alt="Mercadins"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span className="logo-tagline">Seu mercado inteligente</span>
        </div>
      </div>

      <div className="right">
        <div className="form-card">
          <div className="form-header">
            <h1>Seu Mercado<br />Começa Aqui! 🛒</h1>
            <p>Preencha os dados do seu estabelecimento.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>

            <p className="rm-section-label">Dados do Mercado</p>

            <div className="field">
              <input placeholder="Nome do mercado" value={form.nome}
                onChange={e => set('nome', e.target.value)} />
              <FieldIcon>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </FieldIcon>
            </div>

            <div className="field">
              <input placeholder="Email do mercado" type="email" value={form.email}
                onChange={e => set('email', e.target.value)} />
              <FieldIcon>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </FieldIcon>
            </div>

            <div className="rm-grid">
              <div className="field">
                <input placeholder="Telefone" value={form.telefone}
                  onChange={e => set('telefone', formatarTelefone(e.target.value))} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l.97-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="CNPJ" value={form.cnpj}
                  onChange={e => set('cnpj', formatarCNPJ(e.target.value))} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  </svg>
                </FieldIcon>
              </div>
            </div>

            <p className="rm-section-label">Endereço</p>

            <div className="rm-cep-row">
              <div className="field">
                <input placeholder="CEP" value={form.cep}
                  onChange={e => set('cep', formatarCEP(e.target.value))} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                </FieldIcon>
              </div>
              <button type="button" className="rm-cep-btn" onClick={buscarCEP} disabled={buscandoCep}>
                {buscandoCep ? '...' : '🔍 Buscar'}
              </button>
            </div>

            <div className="rm-grid">
              <div className="field">
                <input placeholder="Estado (UF)" value={form.estado}
                  onChange={e => set('estado', e.target.value)} maxLength={2} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="Cidade" value={form.cidade}
                  onChange={e => set('cidade', e.target.value)} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="Bairro" value={form.bairro}
                  onChange={e => set('bairro', e.target.value)} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="Rua" value={form.rua}
                  onChange={e => set('rua', e.target.value)} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/>
                  </svg>
                </FieldIcon>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : '🛒 Criar Mercado'}
            </button>

          </form>

          <div className="badge">
            <span />
            Conexão segura e criptografada
          </div>
        </div>
      </div>
    </>
  );
}