import { useToast } from '../hooks/useToast';
import ToastContainer from './Toast';

interface Props {
  titulo: string;
  descricao: string;
  onFechar: () => void;
}

export default function DescricaoModal({ titulo, descricao, onFechar }: Props) {
  const { toasts, dismissToast } = useToast();

  return (
    <>
      <div className="pu-modal-overlay" onClick={onFechar}>
        <div className="pu-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="pu-modal-header">
            <h2 className="pu-modal-title">{titulo}</h2>
            <button className="pu-modal-close" onClick={onFechar}>✕</button>
          </div>
          <div className="pu-modal-body">
            <p style={{ fontSize: 14, color: 'var(--vt-cinza)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {descricao || 'Nenhuma descrição informada.'}
            </p>
          </div>
          <div className="pu-modal-footer">
            <button className="pu-modal-btn-cancel" onClick={onFechar}>Fechar</button>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
