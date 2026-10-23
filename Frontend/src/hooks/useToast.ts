import { useCallback, useRef, useState } from "react";

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

  // useCallback mantém a referência estável entre renderizações: os efeitos que
  // dependem de showToast podem listá-lo nas dependências sem reexecutar à toa.
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, hiding: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }, []);

  const showToast = useCallback((tipo: Toast["tipo"], mensagem: string) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, tipo, mensagem }]);
    const timer = setTimeout(() => dismissToast(id), 3500);
    toastTimers.current.set(id, timer);
  }, [dismissToast]);

  return { toasts, showToast, dismissToast };
}