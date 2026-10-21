import './DescricaoModal.css';

interface Props {
  titulo: string;
  descricao: string;
  onFechar: () => void;
}

// Modal "Sobre a loja": mostra a descrição completa do mercado.
// Tem estilo próprio (DescricaoModal.css) para funcionar igual na
// vitrine do cliente e na do vendedor.
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
