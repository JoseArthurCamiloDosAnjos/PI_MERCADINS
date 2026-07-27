import './ThemeToggle.css';
import { IconSun, IconMoon } from './Icons';

interface Props {
  tema: 'escuro' | 'claro';
  onToggle: () => void;
  corEscura?: string;
  corClara?: string;
}

export default function ThemeToggle({ tema, onToggle, corEscura, corClara }: Props) {
  const estilo = {
    ...(corEscura && tema === 'escuro' ? { background: corEscura } : {}),
    ...(corClara && tema === 'claro' ? { background: corClara } : {}),
  };

  return (
    <button
      className="tt-root"
      onClick={onToggle}
      data-tema={tema}
      style={Object.keys(estilo).length > 0 ? estilo : undefined}
      title="Alternar tema"
    >
      <span className="tt-icons">
        <IconSun size={14} />
        <IconMoon size={14} />
      </span>
      <span className="tt-thumb" />
    </button>
  );
}