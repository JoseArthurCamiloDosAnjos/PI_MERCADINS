import { useRef, useState } from "react";

export interface Toast {
  id: number;
  tipo: "sucesso" | "erro" | "aviso" | "info";
  mensagem: string;
  hiding?: boolean;
}

let toastIdCounter = 0;

const tipoMap = {
  sucesso: { cls: "toast-success", icon: "✓", titulo: "Sucesso" },
  erro:    { cls: "toast-error",   icon: "✕", titulo: "Erro" },
  aviso:   { cls: "toast-warning", icon: "!", titulo: "Atenção" },
  info:    { cls: "toast-info",    icon: "i", titulo: "Aviso" },
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function showToast(tipo: Toast["tipo"], mensagem: string) {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, tipo, mensagem }]);
    const timer = setTimeout(() => dismissToast(id), 3500);
    toastTimers.current.set(id, timer);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }

  return { toasts, showToast, dismissToast };
}

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
          <div
            key={t.id}
            className={`toast ${c.cls} ${t.hiding ? "hide" : "show"}`}
            onClick={() => onDismiss(t.id)}
          >
            <div className="toast-icon-wrap">{c.icon}</div>
            <div className="toast-body">
              <div className="toast-title">{c.titulo}</div>
              <div className="toast-msg">{t.mensagem}</div>
            </div>
            <button
              className="toast-close"
              onClick={(ev) => { ev.stopPropagation(); onDismiss(t.id); }}
            >
              ×
            </button>
            <div className="toast-progress" />
          </div>
        );
      })}
    </div>
  );
}