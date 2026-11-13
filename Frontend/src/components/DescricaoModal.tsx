import './DescricaoModal.css';

interface Props {
  titulo: string;
  descricao: string;
  onFechar: () => void;
}

export default function DescricaoModal({ titulo, descricao, onFechar }: Props) {
  return (
    <div className="dmodal-overlay">
      <div
        className="dmodal"
        role="dialog"
        aria-modal="true"
        aria-label={`Sobre ${titulo}`}
      >
        <div className="dmodal-header">
          <h2 className="dmodal-title">{titulo}</h2>
          <button className="dmodal-close" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="dmodal-body">
          <p className="dmodal-texto">{descricao || 'Nenhuma descrição informada.'}</p>
        </div>
        <div className="dmodal-footer">
          <button className="dmodal-btn" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
