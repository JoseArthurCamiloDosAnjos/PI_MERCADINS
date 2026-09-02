/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import './EscolherPaleta.css';
import { IconCheck, IconX } from './Icons';

// ─── Paletas prontas ────────────────────────────────────────────────────────
// Os nomes das variáveis (azulEscuro, amarelo, etc.) são só rótulos internos —
// cada paleta define seu próprio conjunto de cores, não precisa ser "azul".

export interface Paleta {
  id: string;
  nome: string;
  cores: {
    azulEscuro: string;
    azulMedio: string;
    azulClaro: string;
    azulBg: string;
    azulCard: string;
    azulBorda: string;
    azulItem: string;
    amarelo: string;
    amareloHover: string;
    corTexto: string;
    corTextoSec: string;
    corIcones: string;
  };
}

export const PALETAS: Paleta[] = [
  {
    id: 'classico',
    nome: 'Mercadins Clássico',
    cores: {
      azulEscuro: '#0d1b3e', azulMedio: '#1843a0', azulClaro: '#2a52a8',
      azulBg: '#111e42', azulCard: '#112250', azulBorda: '#1a2f60', azulItem: '#1e3a7a',
      amarelo: '#f5c84a', amareloHover: '#f7d567',
      corTexto: '#ffffff', corTextoSec: '#c8d6f0', corIcones: '#f5c84a',
    },
  },
  {
    id: 'esmeralda',
    nome: 'Verde Esmeralda',
    cores: {
      azulEscuro: '#0b2418', azulMedio: '#116b42', azulClaro: '#189256',
      azulBg: '#0e2c1c', azulCard: '#123822', azulBorda: '#1a4b2c', azulItem: '#1f5c36',
      amarelo: '#5fe3a0', amareloHover: '#7cedb3',
      corTexto: '#ffffff', corTextoSec: '#b8d8c8', corIcones: '#5fe3a0',
    },
  },
  {
    id: 'realeza',
    nome: 'Roxo Realeza',
    cores: {
      azulEscuro: '#1c0f36', azulMedio: '#5a2e9e', azulClaro: '#7238c9',
      azulBg: '#211342', azulCard: '#2a1852', azulBorda: '#3a1f6e', azulItem: '#452888',
      amarelo: '#f5a94a', amareloHover: '#f7bd6f',
      corTexto: '#ffffff', corTextoSec: '#c8b8e0', corIcones: '#f5a94a',
    },
  },
  {
    id: 'rubi',
    nome: 'Vermelho Rubi',
    cores: {
      azulEscuro: '#2c0d10', azulMedio: '#9c1f27', azulClaro: '#c4272f',
      azulBg: '#341014', azulCard: '#3f1418', azulBorda: '#5a1a20', azulItem: '#712028',
      amarelo: '#f5c84a', amareloHover: '#f7d567',
      corTexto: '#ffffff', corTextoSec: '#d8b8bc', corIcones: '#f5c84a',
    },
  },
  {
    id: 'grafite',
    nome: 'Grafite Neon',
    cores: {
      azulEscuro: '#111318', azulMedio: '#2b3038', azulClaro: '#3a414c',
      azulBg: '#15171c', azulCard: '#1c1f26', azulBorda: '#2a2e37', azulItem: '#343943',
      amarelo: '#4ae1f5', amareloHover: '#6fe9f7',
      corTexto: '#ffffff', corTextoSec: '#a8b0bc', corIcones: '#4ae1f5',
    },
  },
  {
    id: 'oceano',
    nome: 'Oceano',
    cores: {
      azulEscuro: '#062733', azulMedio: '#0f7a94', azulClaro: '#149cba',
      azulBg: '#083240', azulCard: '#0c3e4d', azulBorda: '#12505f', azulItem: '#186376',
      amarelo: '#f5934a', amareloHover: '#f7ab6f',
      corTexto: '#ffffff', corTextoSec: '#b8ccd8', corIcones: '#f5934a',
    },
  },
];

export function encontrarPaleta(id?: string): Paleta {
  return PALETAS.find(p => p.id === id) ?? PALETAS[0];
}

// ─── Paleta personalizada ───────────────────────────────────────────────────
// A partir de 2 cores escolhidas pelo usuário (base escura + destaque), gera
// automaticamente as variações de claridade que o resto da vitrine precisa.

function hexParaHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslParaHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ajustarLuz(hex: string, delta: number): string {
  try {
    const [h, s, l] = hexParaHsl(hex);
    const novaL = Math.min(96, Math.max(4, l + delta));
    return hslParaHex(h, s, novaL);
  } catch {
    return hex;
  }
}

export function gerarPaletaPersonalizada(corBase: string, corDestaque: string, corTexto?: string, corTextoSec?: string, corIcones?: string): Paleta {
  return {
    id: 'personalizada',
    nome: 'Personalizada',
    cores: {
      azulEscuro: corBase,
      azulMedio: ajustarLuz(corBase, 16),
      azulClaro: ajustarLuz(corBase, 26),
      azulBg: ajustarLuz(corBase, -4),
      azulCard: ajustarLuz(corBase, 6),
      azulBorda: ajustarLuz(corBase, 14),
      azulItem: ajustarLuz(corBase, 20),
      amarelo: corDestaque,
      amareloHover: ajustarLuz(corDestaque, 10),
      corTexto: corTexto || '#ffffff',
      corTextoSec: corTextoSec || '#c8d6f0',
      corIcones: corIcones || corDestaque,
    },
  };
}

/** Resolve a paleta final: usa a personalizada se for o caso, senão busca nas prontas. */
export function resolverPaleta(paletaId?: string, corBase?: string, corDestaque?: string, corTexto?: string, corTextoSec?: string, corIcones?: string): Paleta {
  if (paletaId === 'personalizada' && corBase && corDestaque) {
    return gerarPaletaPersonalizada(corBase, corDestaque, corTexto, corTextoSec, corIcones);
  }
  const paleta = encontrarPaleta(paletaId);
  if (corTexto) paleta.cores.corTexto = corTexto;
  if (corTextoSec) paleta.cores.corTextoSec = corTextoSec;
  if (corIcones) paleta.cores.corIcones = corIcones;
  return paleta;
}

export function IconPaleta({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h2.3c1.8 0 3.2-1.4 3.2-3.2C21 6.6 17 2 12 2Z" strokeLinejoin="round" />
      <circle cx="7" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="7" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── Funções de contraste (WCAG) ────────────────────────────────────────────

function luminanciaRelativa(hex: string): number {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const linearizar = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * linearizar(r) + 0.7152 * linearizar(g) + 0.0722 * linearizar(b);
  } catch {
    return 0;
  }
}

function calcularContraste(cor1: string, cor2: string): number {
  const l1 = luminanciaRelativa(cor1);
  const l2 = luminanciaRelativa(cor2);
  const maisClara = Math.max(l1, l2);
  const maisEscura = Math.min(l1, l2);
  return (maisClara + 0.05) / (maisEscura + 0.05);
}

function verificarContraste(corFundo: string, corTexto: string): { nivel: string; aviso: string | null } {
  const ratio = calcularContraste(corFundo, corTexto);
  if (ratio >= 7) return { nivel: 'AAA', aviso: null };
  if (ratio >= 4.5) return { nivel: 'AA', aviso: null };
  if (ratio >= 3) return { nivel: 'AA-grande', aviso: 'Contraste baixo. O texto pode ser difícil de ler em tamanhos pequenos.' };
  return { nivel: 'insuficiente', aviso: 'Contraste muito baixo! Texto pode ser invisível ou causar incômodo ao usuário.' };
}

// ─── Componente ────────────────────────────────────────────────────────────

interface EscolherPaletaProps {
  paletaAtual: string;
  corBaseAtual?: string;
  corDestaqueAtual?: string;
  corTextoAtual?: string;
  corTextoSecAtual?: string;
  corIconesAtual?: string;
  onSelecionar: (paletaId: string) => void;
  onSelecionarPersonalizada: (corBase: string, corDestaque: string, corTexto?: string, corTextoSec?: string, corIcones?: string) => void;
  onFechar: () => void;
}

export default function EscolherPaleta({
  paletaAtual, corBaseAtual, corDestaqueAtual, corTextoAtual, corTextoSecAtual, corIconesAtual, onSelecionar, onSelecionarPersonalizada, onFechar,
}: EscolherPaletaProps) {
  const [corBase, setCorBase]           = useState(corBaseAtual ?? '#0d1b3e');
  const [corDestaque, setCorDestaque]   = useState(corDestaqueAtual ?? '#f5c84a');
  const [corTexto, setCorTexto]         = useState(corTextoAtual ?? '#ffffff');
  const [corTextoSec, setCorTextoSec]   = useState(corTextoSecAtual ?? '#c8d6f0');
  const [corIcones, setCorIcones]       = useState(corIconesAtual ?? '#f5c84a');
  const [modalConfirmacao, setModalConfirmacao] = useState(false);
  const personalizadaAtiva = paletaAtual === 'personalizada';
  const previaPersonalizada = gerarPaletaPersonalizada(corBase, corDestaque, corTexto, corTextoSec, corIcones);

  // Verificar contraste
  const contrasteTexto = verificarContraste(corBase, corTexto);
  const contrasteTextoSec = verificarContraste(corBase, corTextoSec);
  const contrasteIcones = verificarContraste(corBase, corIcones);
  const temAvisoContraste = contrasteTexto.aviso || contrasteTextoSec.aviso || contrasteIcones.aviso;

  function handleAplicarCores() {
    if (temAvisoContraste) {
      setModalConfirmacao(true);
    } else {
      onSelecionarPersonalizada(corBase, corDestaque, corTexto, corTextoSec, corIcones);
    }
  }

  function handleConfirmarMesmoAssim() {
    setModalConfirmacao(false);
    onSelecionarPersonalizada(corBase, corDestaque, corTexto, corTextoSec, corIcones);
  }

  return (
    <div className="ep-overlay" onClick={onFechar}>
      <div className="ep-modal" onClick={e => e.stopPropagation()}>
        <div className="ep-header">
          <h3><IconPaleta size={16} /> Personalizar cores da vitrine</h3>
          <button className="ep-fechar" onClick={onFechar}><IconX size={15} /></button>
        </div>

        <p className="ep-sub">Escolha uma paleta pronta ou crie a sua — os clientes verão essas cores na vitrine.</p>

        <div className="ep-scroll">
          <div className="ep-grid">
            {PALETAS.map(p => {
              const ativa = p.id === paletaAtual;
              return (
                <button
                  key={p.id}
                  className={`ep-item ${ativa ? 'ep-item--ativo' : ''}`}
                  onClick={() => onSelecionar(p.id)}
                >
                  <div className="ep-swatch" style={{ background: p.cores.azulEscuro }}>
                    <span className="ep-swatch-dot" style={{ background: p.cores.amarelo }} />
                    <span className="ep-swatch-dot" style={{ background: p.cores.azulMedio }} />
                    <span className="ep-swatch-dot" style={{ background: p.cores.azulClaro }} />
                    <span className="ep-swatch-dot" style={{ background: p.cores.corTexto, border: '1.5px solid rgba(0,0,0,0.25)' }} />
                    <span className="ep-swatch-dot" style={{ background: p.cores.corTextoSec, border: '1.5px solid rgba(0,0,0,0.15)' }} />
                  </div>
                  <span className="ep-item-nome">{p.nome}</span>
                  {ativa && <span className="ep-item-check"><IconCheck size={12} /></span>}
                </button>
              );
            })}
          </div>

          {!personalizadaAtiva && paletaAtual && (() => {
            const paletaSel = PALETAS.find(p => p.id === paletaAtual);
            if (!paletaSel) return null;
            return (
              <div className="ep-preview-paleta-pre">
                <span className="ep-preview-paleta-label">Cores de texto desta paleta:</span>
                <div className="ep-preview-cores">
                  <div className="ep-preview-item" style={{ background: paletaSel.cores.azulEscuro, color: paletaSel.cores.corTexto }}>
                    <span>Texto principal</span>
                    <span style={{ color: paletaSel.cores.corIcones }}>★ Ícone</span>
                  </div>
                  <div className="ep-preview-item" style={{ background: paletaSel.cores.azulEscuro, color: paletaSel.cores.corTextoSec }}>
                    <span>Texto secundário</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="ep-divisor" />

          <div className={`ep-custom ${personalizadaAtiva ? 'ep-custom--ativo' : ''}`}>
            <div className="ep-custom-topo">
              <span className="ep-custom-titulo">Criar paleta personalizada</span>
              {personalizadaAtiva && <span className="ep-item-check ep-item-check--inline"><IconCheck size={12} /></span>}
            </div>

            <div className="ep-custom-swatch" style={{ background: previaPersonalizada.cores.azulEscuro }}>
              <span className="ep-swatch-dot" style={{ background: previaPersonalizada.cores.corIcones }} />
              <span className="ep-swatch-dot" style={{ background: previaPersonalizada.cores.azulMedio }} />
              <span className="ep-swatch-dot" style={{ background: previaPersonalizada.cores.azulClaro }} />
            </div>

            <div className="ep-custom-campos">
              <label className="ep-custom-campo">
                <span>Cor principal (fundo)</span>
                <div className="ep-custom-cor-wrap">
                  <input type="color" value={corBase} onChange={e => setCorBase(e.target.value)} />
                  <span>{corBase}</span>
                </div>
              </label>
              <label className="ep-custom-campo">
                <span>Cor de destaque</span>
                <div className="ep-custom-cor-wrap">
                  <input type="color" value={corDestaque} onChange={e => setCorDestaque(e.target.value)} />
                  <span>{corDestaque}</span>
                </div>
              </label>
            </div>

            <div className="ep-custom-campos">
              <label className="ep-custom-campo">
                <span>Cor do texto</span>
                <div className="ep-custom-cor-wrap">
                  <input type="color" value={corTexto} onChange={e => setCorTexto(e.target.value)} />
                  <span>{corTexto}</span>
                </div>
              </label>
              <label className="ep-custom-campo">
                <span>Cor do texto secundário</span>
                <div className="ep-custom-cor-wrap">
                  <input type="color" value={corTextoSec} onChange={e => setCorTextoSec(e.target.value)} />
                  <span>{corTextoSec}</span>
                </div>
              </label>
            </div>

            <div className="ep-custom-campos">
              <label className="ep-custom-campo">
                <span>Cor dos ícones/botões</span>
                <div className="ep-custom-cor-wrap">
                  <input type="color" value={corIcones} onChange={e => setCorIcones(e.target.value)} />
                  <span>{corIcones}</span>
                </div>
              </label>
            </div>

            {/* Avisos de contraste */}
            {temAvisoContraste && (
              <div className="ep-aviso-contraste">
                {contrasteTexto.aviso && (
                  <p className="ep-aviso-texto">
                    <span className="ep-aviso-icone">⚠️</span>
                    <span><strong>Texto:</strong> {contrasteTexto.aviso}</span>
                  </p>
                )}
                {contrasteTextoSec.aviso && (
                  <p className="ep-aviso-texto">
                    <span className="ep-aviso-icone">⚠️</span>
                    <span><strong>Texto secundário:</strong> {contrasteTextoSec.aviso}</span>
                  </p>
                )}
                {contrasteIcones.aviso && (
                  <p className="ep-aviso-texto">
                    <span className="ep-aviso-icone">⚠️</span>
                    <span><strong>Ícones:</strong> {contrasteIcones.aviso}</span>
                  </p>
                )}
              </div>
            )}

            {/* Preview das cores */}
            <div className="ep-preview-cores">
              <div className="ep-preview-item" style={{ background: corBase, color: corTexto }}>
                <span>Texto principal</span>
                <span style={{ color: corIcones }}>★ Ícone</span>
              </div>
              <div className="ep-preview-item" style={{ background: corBase, color: corTextoSec }}>
                <span>Texto secundário</span>
              </div>
            </div>

            <button
              className="ep-btn-aplicar-custom"
              onClick={handleAplicarCores}
            >
              Usar essas cores
            </button>
          </div>
        </div>

        <div className="ep-footer">
          <button className="ep-btn-concluir" onClick={onFechar}>Concluído</button>
        </div>
      </div>

      {modalConfirmacao && (
        <div className="ep-confirm-overlay" onClick={() => setModalConfirmacao(false)}>
          <div className="ep-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="ep-confirm-icone">⚠️</div>
            <h4 className="ep-confirm-titulo">Contraste pode estar baixo</h4>
            <p className="ep-confirm-texto">
              As cores escolhidas podem tornar o texto ou ícones difíceis de ler,
              causando incômodo aos clientes. Deseja continuar mesmo assim?
            </p>
            <div className="ep-confirm-botoes">
              <button className="ep-confirm-btn ep-confirm-btn--voltar" onClick={() => setModalConfirmacao(false)}>
                Voltar
              </button>
              <button className="ep-confirm-btn ep-confirm-btn--continuar" onClick={handleConfirmarMesmoAssim}>
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}