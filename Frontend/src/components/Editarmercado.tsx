import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import '../pages/CSS/Editarmercado.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditarMercadoProps {
  nome: string;
  descricao: string;
  logo?: string;
  salvando?: boolean;
  onSalvar: (dados: { nome: string; descricao: string; logo?: string }) => void;
  onCancelar: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditarMercado({
  nome: nomeInicial,
  descricao: descricaoInicial,
  logo: logoInicial,
  salvando = false,
  onSalvar,
  onCancelar,
}: EditarMercadoProps) {
  const [nome, setNome]         = useState(nomeInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [logo, setLogo]         = useState<string | undefined>(logoInicial);
  const [erros, setErros]       = useState<{ nome?: string }>({});
  const inputLogoRef            = useRef<HTMLInputElement>(null);

  function handleLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (typeof url === 'string') setLogo(url);
    };
    reader.readAsDataURL(file);
  }

  function validar() {
    const e: { nome?: string } = {};
    if (!nome.trim()) e.nome = 'O nome do mercado é obrigatório.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function handleSalvar() {
    if (!validar()) return;
    onSalvar({ nome: nome.trim(), descricao: descricao.trim(), logo });
  }

  return (
    <div className="em-overlay" role="dialog" aria-modal="true" aria-label="Editar mercado">
      <div className="em-modal">

        <div className="em-header">
          <h2 className="em-titulo">Editar mercado</h2>
          <button className="em-btn-fechar" onClick={onCancelar} disabled={salvando} aria-label="Fechar">✕</button>
        </div>

        <div className="em-body">

          {/* ── Logo ─────────────────────────────────────────────────── */}
          <div className="em-logo-wrap">
            <button
              className="em-logo-btn"
              onClick={() => inputLogoRef.current?.click()}
              title="Alterar logo"
              type="button"
            >
              {logo
                ? <img src={logo} alt="Logo" className="em-logo-img" />
                : <div className="em-logo-placeholder"><span>+</span></div>
              }
              <span className="em-logo-overlay">Alterar</span>
            </button>
            <input
              ref={inputLogoRef}
              type="file"
              accept="image/*"
              className="em-input-file"
              onChange={handleLogo}
            />
            <p className="em-logo-hint">Clique na imagem para trocar a logo</p>
          </div>

          {/* ── Nome ─────────────────────────────────────────────────── */}
          <div className="em-campo">
            <label htmlFor="em-nome" className="em-label">Nome do mercado</label>
            <input
              id="em-nome"
              type="text"
              className={`em-input ${erros.nome ? 'em-input--erro' : ''}`}
              value={nome}
              maxLength={150}
              onChange={(e) => { setNome(e.target.value); setErros({}); }}
              placeholder="Ex: Mercado do João"
            />
            {erros.nome && <span className="em-erro">{erros.nome}</span>}
          </div>

          {/* ── Descrição ─────────────────────────────────────────────── */}
          <div className="em-campo">
            <label htmlFor="em-descricao" className="em-label">Descrição</label>
            <textarea
              id="em-descricao"
              className="em-textarea"
              value={descricao}
              rows={3}
              maxLength={300}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Uma frase curta sobre o seu mercado"
            />
            <span className="em-char-count">{descricao.length}/300</span>
          </div>

        </div>

        <div className="em-footer">
          <button className="em-btn em-btn--secundario" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button
            className={`em-btn em-btn--primario ${salvando ? 'em-btn--carregando' : ''}`}
            onClick={handleSalvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

      </div>
    </div>
  );
}