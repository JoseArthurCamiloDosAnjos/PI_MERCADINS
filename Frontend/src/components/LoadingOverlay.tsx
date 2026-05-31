interface Props {
  mensagem?: string;
}

export default function LoadingOverlay({ mensagem = 'Carregando...' }: Props) {
  return (
    <div className="loading-overlay">
      <div className="loading-box">
        <div className="loading-spinner" />
        <p className="loading-msg">{mensagem}</p>
      </div>
    </div>
  );
}