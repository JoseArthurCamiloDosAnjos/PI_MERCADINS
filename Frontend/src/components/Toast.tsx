import type { Toast } from "../hooks/useToast";

const tipoMap = {
  sucesso: { cls: "toast-success", icon: "✓", titulo: "Sucesso" },
  erro:    { cls: "toast-error",   icon: "✕", titulo: "Erro"    },
  aviso:   { cls: "toast-warning", icon: "!", titulo: "Atenção"  },
  info:    { cls: "toast-info",    icon: "i", titulo: "Aviso"    },
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div id="toast-container">
      {toasts.map((t) => {
        const c = tipoMap[t.tipo];
        return (
          <div key={t.id} className={`toast ${c.cls} ${t.hiding ? "hide" : "show"}`}
            onClick={() => onDismiss(t.id)}>
            <div className="toast-icon-wrap">{c.icon}</div>
            <div className="toast-body">
              <div className="toast-title">{c.titulo}</div>
              <div className="toast-msg">{t.mensagem}</div>
            </div>
            <button className="toast-close"
              onClick={(ev) => { ev.stopPropagation(); onDismiss(t.id); }}>×</button>
            <div className="toast-progress" />
          </div>
        );
      })}
    </div>
  );
}