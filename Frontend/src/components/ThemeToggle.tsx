import './ThemeToggle.css';

interface Props {
  tema: 'escuro' | 'claro';
  onToggle: () => void;
}

export default function ThemeToggle({ tema, onToggle }: Props) {
  return (
    <button
      className="tt-root"
      onClick={onToggle}
      data-tema={tema}
      title="Alternar tema"
    >
      <span className="tt-icons">
        <span>☀️</span>
        <span>🌙</span>
      </span>
      <span className="tt-thumb" />
    </button>
  );
}