import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { removeEmojis } from '../hooks/useBlockEmojis';
import './EditarMercado.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditarMercadoProps {
  nome: string;
  descricao: string;
  logo?: string;
  banner?: string;
  salvando?: boolean;
  onSalvar: (dados: { nome: string; descricao: string; logo?: File; banner?: File }) => void;
  onCancelar: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditarMercado({
  nome: nomeInicial,
  descricao: descricaoInicial,
  logo: logoInicial,
  banner: bannerInicial,
  salvando = false,
  onSalvar,
  onCancelar,
}: EditarMercadoProps) {
  const [nome, setNome]         = useState(nomeInicial);
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [logo, setLogo]         = useState<string | undefined>(logoInicial);
  const [banner, setBanner]     = useState<string | undefined>(bannerInicial);
  const [logoFile, setLogoFile] = useState<File | undefined>();
  const [bannerFile, setBannerFile] = useState<File | undefined>();
  const [erros, setErros]       = useState<{ nome?: string }>({});
  const inputLogoRef            = useRef<HTMLInputElement>(null);
  const inputBannerRef          = useRef<HTMLInputElement>(null);

  function handleLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (typeof url === 'string') setLogo(url);
    };
    reader.readAsDataURL(file);
  }

  function handleBanner(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (typeof url === 'string') setBanner(url);
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
    onSalvar({ nome: nome.trim(), descricao: descricao.trim(), logo: logoFile, banner: bannerFile });
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
            <p className="em-recomendacao">📐 Tamanho recomendado para a foto de perfil: <strong>300×300px</strong> (formato quadrado, ideal para visualização nítida)</p>
          </div>

          {/* ── Banner ─────────────────────────────────────────────────── */}
          <div className="em-banner-wrap">
            <label className="em-label">Imagem de fundo (banner)</label>
            <button
              className="em-banner-btn"
              onClick={() => inputBannerRef.current?.click()}
              title="Alterar banner"
              type="button"
            >
              {banner
                ? <img src={banner} alt="Banner" className="em-banner-img" />
                : <div className="em-banner-placeholder">
                    <span className="em-banner-placeholder-text">Clique para adicionar uma imagem de fundo</span>
                  </div>
              }
              <span className="em-banner-overlay">Alterar</span>
            </button>
            <input
              ref={inputBannerRef}
              type="file"
              accept="image/*"
              className="em-input-file"
              onChange={handleBanner}
            />
            {banner && (
              <button
                type="button"
                className="em-banner-remover"
                onClick={() => setBanner(undefined)}
              >
                Remover banner
              </button>
            )}
            <p className="em-recomendacao">📐 Tamanho recomendado para a imagem de fundo: <strong>1200×400px</strong> (proporção 3:1, preenche toda a área)</p>
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
              onChange={(e) => { setNome(removeEmojis(e.target.value)); setErros({}); }}
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
              onChange={(e) => setDescricao(removeEmojis(e.target.value))}
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