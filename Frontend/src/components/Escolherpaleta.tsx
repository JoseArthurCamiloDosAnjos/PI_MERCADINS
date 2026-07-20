import './EscolherPaleta.css';
import { IconCheck, IconX } from './Icons';

// ─── Paletas disponíveis ────────────────────────────────────────────────────
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
    },
  },
  {
    id: 'esmeralda',
    nome: 'Verde Esmeralda',
    cores: {
      azulEscuro: '#0b2418', azulMedio: '#116b42', azulClaro: '#189256',
      azulBg: '#0e2c1c', azulCard: '#123822', azulBorda: '#1a4b2c', azulItem: '#1f5c36',
      amarelo: '#5fe3a0', amareloHover: '#7cedb3',
    },
  },
  {
    id: 'realeza',
    nome: 'Roxo Realeza',
    cores: {
      azulEscuro: '#1c0f36', azulMedio: '#5a2e9e', azulClaro: '#7238c9',
      azulBg: '#211342', azulCard: '#2a1852', azulBorda: '#3a1f6e', azulItem: '#452888',
      amarelo: '#f5a94a', amareloHover: '#f7bd6f',
    },
  },
  {
    id: 'rubi',
    nome: 'Vermelho Rubi',
    cores: {
      azulEscuro: '#2c0d10', azulMedio: '#9c1f27', azulClaro: '#c4272f',
      azulBg: '#341014', azulCard: '#3f1418', azulBorda: '#5a1a20', azulItem: '#712028',
      amarelo: '#f5c84a', amareloHover: '#f7d567',
    },
  },
  {
    id: 'grafite',
    nome: 'Grafite Neon',
    cores: {
      azulEscuro: '#111318', azulMedio: '#2b3038', azulClaro: '#3a414c',
      azulBg: '#15171c', azulCard: '#1c1f26', azulBorda: '#2a2e37', azulItem: '#343943',
      amarelo: '#4ae1f5', amareloHover: '#6fe9f7',
    },
  },
  {
    id: 'oceano',
    nome: 'Oceano',
    cores: {
      azulEscuro: '#062733', azulMedio: '#0f7a94', azulClaro: '#149cba',
      azulBg: '#083240', azulCard: '#0c3e4d', azulBorda: '#12505f', azulItem: '#186376',
      amarelo: '#f5934a', amareloHover: '#f7ab6f',
    },
  },
];

export function encontrarPaleta(id?: string): Paleta {
  return PALETAS.find(p => p.id === id) ?? PALETAS[0];
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

// ─── Componente ────────────────────────────────────────────────────────────

interface EscolherPaletaProps {
  paletaAtual: string;
  onSelecionar: (paletaId: string) => void;
  onFechar: () => void;
}

export default function EscolherPaleta({ paletaAtual, onSelecionar, onFechar }: EscolherPaletaProps) {
  return (
    <div className="ep-overlay" onClick={onFechar}>
      <div className="ep-modal" onClick={e => e.stopPropagation()}>
        <div className="ep-header">
          <h3><IconPaleta size={16} /> Personalizar cores da vitrine</h3>
          <button className="ep-fechar" onClick={onFechar}><IconX size={15} /></button>
        </div>

        <p className="ep-sub">Escolha a paleta de cores que sua loja vai usar — os clientes verão essas cores na vitrine.</p>

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
                </div>
                <span className="ep-item-nome">{p.nome}</span>
                {ativa && <span className="ep-item-check"><IconCheck size={12} /></span>}
              </button>
            );
          })}
        </div>

        <div className="ep-footer">
          <button className="ep-btn-concluir" onClick={onFechar}>Concluído</button>
        </div>
      </div>
    </div>
  );
}