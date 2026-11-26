import { useCallback, useRef, useState } from "react";

export interface Toast {
  id: number;
  tipo: "sucesso" | "erro" | "aviso" | "info";
  mensagem: string;
  hiding?: boolean;
}

/** Máximo de toasts visíveis ao mesmo tempo. */
const MAX_TOASTS = 3;
/** Tempo de exibição de cada toast (ms). */
const DURACAO_TOAST = 3500;
/** Tempo da animação de saída antes de o toast sumir do DOM (ms). */
const SAIDA_TOAST = 400;

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Espelho síncrono de `toasts`: dispensar/criar no mesmo tick não depende do render.
  const toastsRef = useRef<Toast[]>([]);

  const aplicar = useCallback((novos: Toast[]) => {
    toastsRef.current = novos;
    setToasts(novos);
  }, []);

  const limparTimer = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback((id: number) => {
    const alvo = toastsRef.current.find((t) => t.id === id);
    if (!alvo || alvo.hiding) return;

    limparTimer(id);
    aplicar(toastsRef.current.map((t) => (t.id === id ? { ...t, hiding: true } : t)));

    setTimeout(() => {
      aplicar(toastsRef.current.filter((t) => t.id !== id));
    }, SAIDA_TOAST);
  }, [aplicar, limparTimer]);

  const agendarDismiss = useCallback((id: number) => {
    limparTimer(id);
    toastTimers.current.set(id, setTimeout(() => dismissToast(id), DURACAO_TOAST));
  }, [dismissToast, limparTimer]);

  const showToast = useCallback((tipo: Toast["tipo"], mensagem: string) => {
    const texto = mensagem.trim();
    if (!texto) return;

    // Mesmo aviso em sequência: não empilha duplicado, só renova o tempo dele.
    const existente = toastsRef.current.find((t) => !t.hiding && t.mensagem === texto);
    if (existente) {
      agendarDismiss(existente.id);
      return;
    }

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
