import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { removeEmojis, removeSpecialChars, removeSpecialCharsEmail, bloquearEspaco } from '../../hooks/useBlockEmojis';
import { BASE_URL, api } from '../../services/api';
import ToastContainer from '../../components/Toast';
import './RegistrarMercado.css';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo.jpeg';
import { irParaInicio } from '../../utils/inicio';
import {
  IconShoppingCart,
  IconStore,
  IconLeaf,
  IconSprout,
  IconBread,
  IconBottle,
  IconCutlery,
} from '../../components/Icons';

interface Form {
  nome: string;
  email: string;
  telefone: string;
  cnpj: string;
  descricao: string;
  cep: string;
  estado: string;
  cidade: string;
  bairro: string;
  rua: string;
}

// Tipos de loja que o mercado pode declarar (os mesmos atalhos da home).
// O lojista pode marcar quantos quiser — ex.: Hortifruti E Padaria.
const TIPOS_LOJA = [
  { id: 'mercado', nome: 'Mercado', icone: IconShoppingCart },
  { id: 'hortifruti', nome: 'Hortifruti', icone: IconLeaf },
  { id: 'acougue', nome: 'Açougue', icone: IconCutlery },
  { id: 'padaria', nome: 'Padaria', icone: IconBread },
  { id: 'bebidas', nome: 'Bebidas', icone: IconBottle },
  { id: 'organicos', nome: 'Orgânicos', icone: IconSprout },
  { id: 'conveniencia', nome: 'Conveniência', icone: IconStore },
];

// Dias da semana do formulário de horário (id = valor do Date: 0 = domingo)
const DIAS = [
  { id: '1', nome: 'Segunda' }, { id: '2', nome: 'Terça' }, { id: '3', nome: 'Quarta' },
  { id: '4', nome: 'Quinta' }, { id: '5', nome: 'Sexta' }, { id: '6', nome: 'Sábado' },
  { id: '0', nome: 'Domingo' },
];

function FieldIcon({ children }: { children: React.ReactNode }) {
  return <span className="field-icon-register">{children}</span>;
}

export default function RegistrarMercado() {
  const navigate = useNavigate();
  const { refreshMercados, usuario } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [categorias, setCategorias] = useState<string[]>([]);
  // Flag persistida no localStorage OU vinda do redirect do Asaas (?pagamento=1)
  const [aguardandoPagamento, setAguardandoPagamento] = useState(() => {
    if (new URLSearchParams(window.location.search).get('pagamento') === '1') {
      localStorage.setItem('aguardandoPagamento', '1');
      return true;
    }
    return localStorage.getItem('aguardandoPagamento') === '1';
  });
  const [urlPagamento, setUrlPagamento] = useState<string | null>(null);
  const [statusAtual, setStatusAtual] = useState<'pendente' | 'ativa' | 'erro' | null>(null);

  function alternarCategoria(id: string) {
    setCategorias(atual =>
      atual.includes(id) ? atual.filter(c => c !== id) : [...atual, id]
    );
  }

  // Horário de funcionamento: dia 0..6 (0 = domingo); null = fechado no dia.
  // Começa com a semana comercial preenchida (o lojista ajusta como quiser).
  const [horario, setHorario] = useState<Record<string, [string, string] | null>>({
    '1': ['08:00', '18:00'], '2': ['08:00', '18:00'], '3': ['08:00', '18:00'],
    '4': ['08:00', '18:00'], '5': ['08:00', '18:00'],
  });

  function alternarDia(dia: string) {
    setHorario(h => ({ ...h, [dia]: h[dia] ? null : ['08:00', '18:00'] }));
  }

  function setHora(dia: string, campo: 0 | 1, valor: string) {
    setHorario(h => {
      const faixa = h[dia] ?? ['08:00', '18:00'];
      const nova: [string, string] = [faixa[0], faixa[1]];
      nova[campo] = valor;
      return { ...h, [dia]: nova };
    });
  }

  const [planoSelecionado] = useState<{ id?: string; nome: string; cobranca: string } | null>(() => {
    try {
      const salvo = localStorage.getItem('planoSelecionado');
      return salvo ? JSON.parse(salvo) : null;
    } catch {
      return null;
    }
  });

  // Plano que será salvo no banco: o escolhido na tela de planos
  // (ids conhecidos pelo servidor); sem escolha, começa no Essencial
  const planoId = ['basico', 'profissional', 'personalizado'].includes(planoSelecionado?.id ?? '')
    ? planoSelecionado!.id!
    : 'basico';

  const [form, setForm] = useState<Form>({
    nome: '', email: '', telefone: '', cnpj: '', descricao: '',
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

  // Admin sem plano: cria direto (paga de volta pelo webhook, mas não precisa)
  async function criarDireto() {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Sessão expirada. Faça login novamente.');

    const res = await fetch(`${BASE_URL}/api/mercados`, {
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
        descricao: form.descricao.trim(),
        cep: form.cep.replace(/\D/g, ''),
        estado: form.estado,
        cidade: form.cidade,
        bairro: form.bairro,
        rua: form.rua,
        plano: planoId,
        categorias,
        horario: horarioEnvioLocal(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro ao cadastrar mercado.');
    showToast('sucesso', 'Mercado cadastrado com sucesso!');
    await refreshMercados();
    setTimeout(() => navigate('/vendedor'), 1200);
  }

  function horarioEnvioLocal() {
    return Object.fromEntries(
      Object.entries(horario).filter(([, faixa]) => faixa !== null) as [string, [string, string]][]
    );
  }

  // Usuário comum: cria assinatura + retorna link de pagamento (mercado vem depois)
  async function criarCheckout() {
    const checkout = await api.criarCheckout({
      codigo_plano: planoId,
      ciclo: planoSelecionado?.cobranca === 'anual' ? 'anual' : 'mensal',
      mercado: {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone.replace(/\D/g, ''),
        cnpj: form.cnpj.replace(/\D/g, ''),
        descricao: form.descricao.trim(),
        cep: form.cep.replace(/\D/g, ''),
        estado: form.estado,
        cidade: form.cidade,
        bairro: form.bairro,
        rua: form.rua,
        plano: planoId,
        categorias,
        horario: horarioEnvioLocal(),
      },
    });
    if (!checkout?.urlCheckout) throw new Error('Link de pagamento não recebido.');
    localStorage.setItem('aguardandoPagamento', '1');
    setUrlPagamento(checkout.urlCheckout);
    setStatusAtual('pendente');
    setAguardandoPagamento(true);
    showToast('sucesso', 'Redirecionando para o pagamento...');
    // Redirect automático é conveniência; se não abrir, a tela de status
    // já exibe o botão manual "Ir para o pagamento"
    setTimeout(() => { window.location.href = checkout.urlCheckout; }, 1200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.telefone || !form.cnpj || !form.cep || !form.estado || !form.cidade || !form.bairro || !form.rua)
      return showToast('erro', 'Preencha todos os campos.');

    if (categorias.length === 0)
      return showToast('erro', 'Escolha ao menos um tipo de loja.');

    const horarioEnvio = horarioEnvioLocal();
    const diaRuim = Object.values(horarioEnvio).find(f => !f[0] || !f[1] || f[0] === f[1]);
    if (diaRuim)
      return showToast('erro', 'Confira o horário: abertura e fechamento precisam ser diferentes.');

    const token = localStorage.getItem('token');
    if (!token) return showToast('erro', 'Sessão expirada. Faça login novamente.');

    setSalvando(true);
    try {
      // Admin sem plano escolhido: cria direto sem pagamento
      if (usuario?.is_admin && !planoSelecionado) {
        await criarDireto();
        return;
      }

      // Usuário comum (ou admin com plano): só cria após o pagamento
      await criarCheckout();
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao cadastrar.');
    } finally {
      setSalvando(false);
    }
  }

  // Ao abrir com a flag de pagamento pendente (ou voltando do Asaas com
  // ?pagamento=1), verifica o status da assinatura
  useEffect(() => {
    if (!aguardandoPagamento) return;

    let cancelado = false;

    async function verificar() {
      try {
        const r = await api.minhaAssinatura();
        if (cancelado) return;
        if (r?.assinatura?.status === 'ativa') {
          // Pagamento confirmou → mercado já criado pelo webhook
          localStorage.removeItem('aguardandoPagamento');
          setStatusAtual('ativa');
          showToast('sucesso', 'Pagamento confirmado! Mercado criado.');
          await refreshMercados();
          // Vai direto para o gerenciador do mercado criado
          const idMercado = r.assinatura.id_mercado ?? r.mercado?.id_mercado;
          setTimeout(() => {
            navigate(idMercado ? `/vendedor/mercado/${idMercado}` : '/vendedor');
          }, 1200);
        } else if (r?.assinatura?.status === 'pendente') {
          setStatusAtual('pendente');
          setUrlPagamento(r.urlPagamento || null);
        } else {
          // Sem assinatura ou outro status → volta ao formulário
          localStorage.removeItem('aguardandoPagamento');
          setAguardandoPagamento(false);
        }
      } catch {
        if (!cancelado) setStatusAtual('erro');
      }
    }

    verificar();
    return () => { cancelado = true; };
  }, [aguardandoPagamento, navigate, refreshMercados, showToast]);

  // ── Tela de status (aguardando pagamento) ────────────────────────────────
  if (aguardandoPagamento) {
    return (
      <div className="register-page">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="left">
          <div className="left-bg" />
          <div className="circle circle-1" />
          <div className="circle circle-2" />
          <div className="circle circle-3" />
          <div className="logo-wrap">
            <img className="logo-img" src={logoImg} alt="Mercadins"
              title="Voltar ao início"
              onClick={irParaInicio}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <span className="logo-tagline">Seu mercado inteligente</span>
          </div>
        </div>
        <div className="right">
          <div className="form-card rm-status-card">
            <h1>Aguardando pagamento</h1>
            <p className="rm-status-sub">
              Seu mercado será criado automaticamente assim que o pagamento for confirmado.
            </p>

            {/* Link do pagamento — sempre visível enquanto não confirmado,
                caso o redirect automático não abra o Asaas */}
            {urlPagamento && statusAtual !== 'ativa' && (
              <div className="rm-status-acoes">
                <a href={urlPagamento} className="btn btn-primary">
                  <IconShoppingCart size={16} /> Ir para o pagamento
                </a>
                <p className="rm-status-dica">
                  Se a página não abrir automaticamente, use o botão acima.
                </p>
              </div>
            )}

            {statusAtual === 'pendente' && (
              <div className="rm-status-acoes">
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    try {
                      const r = await api.minhaAssinatura();
                      if (r?.assinatura?.status === 'ativa') {
                        localStorage.removeItem('aguardandoPagamento');
                        showToast('sucesso', 'Pagamento confirmado! Mercado criado.');
                        await refreshMercados();
                        const idM = r.assinatura.id_mercado ?? r.mercado?.id_mercado;
                        setTimeout(() => navigate(idM ? `/vendedor/mercado/${idM}` : '/vendedor'), 1200);
                      } else if (r?.assinatura?.status === 'pendente') {
                        // O backend consulta o Asaas na hora (fallback do
                        // webhook): dá o estado real da cobrança
                        const cobranca = r.pagamento_asaas?.status;
                        showToast(
                          'info',
                          cobranca === 'PENDING'
                            ? 'Pagamento identificado no Asaas, aguardando a confirmação do banco. Tente novamente em instantes.'
                            : 'Pagamento ainda não confirmado. Tente novamente em instantes.'
                        );
                      } else {
                        showToast('info', 'Pagamento ainda não confirmado. Tente novamente em instantes.');
                      }
                    } catch {
                      showToast('erro', 'Erro ao verificar pagamento.');
                    }
                  }}
                >
                  Já paguei — atualizar status
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    localStorage.removeItem('aguardandoPagamento');
                    setAguardandoPagamento(false);
                    setStatusAtual(null);
                  }}
                >
                  Cancelar e voltar ao formulário
                </button>
              </div>
            )}

            {statusAtual === 'ativa' && (
              <p className="rm-status-ok">Pagamento confirmado! Redirecionando para o gerenciador do mercado…</p>
            )}

            {statusAtual === 'erro' && (
              <div className="rm-status-acoes">
                <p className="rm-status-erro">Não foi possível verificar o status do pagamento.</p>
                <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    localStorage.removeItem('aguardandoPagamento');
                    setAguardandoPagamento(false);
                    setStatusAtual(null);
                  }}
                >
                  Voltar ao formulário
                </button>
              </div>
            )}

            {!statusAtual && (
              <p className="rm-status-carregando">Verificando status do pagamento…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Formulário de cadastro ───────────────────────────────────────────────
  return (
    <div className="register-page">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="left">
        <div className="left-bg" />
        <div className="circle circle-1" />
        <div className="circle circle-2" />
        <div className="circle circle-3" />
        <button className="btn-back" aria-label="Voltar" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="logo-wrap">
          <img className="logo-img" src={logoImg} alt="Mercadins"
            title="Voltar ao início"
            onClick={irParaInicio}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span className="logo-tagline">Seu mercado inteligente</span>
        </div>
      </div>

      <div className="right">
        <div className="form-card">
          <div className="form-header">
            <h1>Seu mercado<br />começa aqui!</h1>
            <p>Preencha os dados do seu estabelecimento.</p>
            {planoSelecionado && (
              <span className="rm-plano-chip">
                Plano {planoSelecionado.nome}
                <small> · {planoSelecionado.cobranca === 'anual' ? 'cobrança anual' : 'cobrança mensal'}</small>
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate>

            <p className="rm-section-label">Dados do Mercado</p>

            <div className="field">
              <input placeholder="Nome do mercado" value={form.nome}
                onChange={e => set('nome', removeSpecialChars(removeEmojis(e.target.value)))} />
              <FieldIcon>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </FieldIcon>
            </div>

            <div className="field">
              <input placeholder="E-mail do mercado" type="email" value={form.email}
                onKeyDown={bloquearEspaco}
                onChange={e => set('email', removeSpecialCharsEmail(removeEmojis(e.target.value)))} />
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

            <p className="rm-section-label">Descrição</p>

            <div className="rm-desc-wrap">
              <textarea
                className="rm-textarea"
                placeholder="Conte um pouco sobre o seu mercado: especialidades, horário de atendimento, diferenciais..."
                value={form.descricao}
                rows={3}
                maxLength={300}
                onChange={e => set('descricao', removeEmojis(e.target.value))}
              />
              <span className={`rm-char-count ${form.descricao.length >= 300 ? 'is-full' : ''}`}>
                {form.descricao.length}/300
              </span>
            </div>

            <p className="rm-section-label">
              Tipos de loja <small>escolha quantos quiser</small>
            </p>

            <div className="rm-categorias">
              {TIPOS_LOJA.map(tipo => {
                const ativa = categorias.includes(tipo.id);
                return (
                  <button
                    key={tipo.id}
                    type="button"
                    className={`rm-categoria-chip${ativa ? ' rm-categoria-chip--ativa' : ''}`}
                    aria-pressed={ativa}
                    onClick={() => alternarCategoria(tipo.id)}
                  >
                    <span aria-hidden="true"><tipo.icone size={17} /></span>
                    {tipo.nome}
                  </button>
                );
              })}
            </div>

            <p className="rm-section-label">Horário de funcionamento</p>

            <div className="rm-horario">
              {DIAS.map(dia => {
                const aberto = !!horario[dia.id];
                const faixa = horario[dia.id] ?? ['08:00', '18:00'];
                return (
                  <div key={dia.id} className={`rm-horario-dia${aberto ? ' aberto' : ''}`}>
                    <label className="rm-horario-dia-nome">
                      <input type="checkbox" checked={aberto} onChange={() => alternarDia(dia.id)} />
                      {dia.nome}
                    </label>
                    {aberto ? (
                      <div className="rm-horario-horas">
                        <input type="time" value={faixa[0]} aria-label={`Abertura ${dia.nome}`}
                          onChange={e => setHora(dia.id, 0, e.target.value)} />
                        <span>às</span>
                        <input type="time" value={faixa[1]} aria-label={`Fechamento ${dia.nome}`}
                          onChange={e => setHora(dia.id, 1, e.target.value)} />
                      </div>
                    ) : (
                      <span className="rm-horario-fechado">fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="rm-horario-dica">
              Fechar depois da meia-noite? Marque a hora de fechar menor que a de abrir
              (ex.: abre 18:00, fecha 02:00).
            </p>

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
                {buscandoCep ? '...' : 'Buscar'}
              </button>
            </div>

            <div className="rm-grid">
              <div className="field">
                <input placeholder="Estado (UF)" value={form.estado}
                  onChange={e => set('estado', removeSpecialChars(removeEmojis(e.target.value)))} maxLength={2} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="Cidade" value={form.cidade}
                  onChange={e => set('cidade', removeSpecialChars(removeEmojis(e.target.value)))} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="Bairro" value={form.bairro}
                  onChange={e => set('bairro', removeSpecialChars(removeEmojis(e.target.value)))} />
                <FieldIcon>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  </svg>
                </FieldIcon>
              </div>

              <div className="field">
                <input placeholder="Rua" value={form.rua}
                  onChange={e => set('rua', removeSpecialChars(removeEmojis(e.target.value)))} />
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
              ) : <><IconShoppingCart size={16} /> {usuario?.is_admin && !planoSelecionado ? 'Criar mercado' : 'Ir para pagamento'}</>}
            </button>

          </form>

          <div className="badge">
            <span />
            Conexão segura e criptografada
          </div>
        </div>
      </div>
    </div>
  );
}
