import { useCallback, useRef, useState } from "react";

const MAX_TOASTS = 3;

export interface Toast {
  id: number;
  tipo: "sucesso" | "erro" | "aviso" | "info";
  mensagem: string;
  hiding?: boolean;
}

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }, []);

  const showToast = useCallback((tipo: Toast["tipo"], mensagem: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => {
      const next = [...prev, { id, tipo, mensagem }];
      if (next.length > MAX_TOASTS) {
        const removeId = next[0].id;
        clearTimeout(toastTimers.current.get(removeId));
        toastTimers.current.delete(removeId);
        return next.slice(1);
      }
      return next;
    });
    const timer = setTimeout(() => dismissToast(id), 3500);
    toastTimers.current.set(id, timer);
  }, [dismissToast]);

  return { toasts, showToast, dismissToast };
}