// Referência da aba do checkout Asaas aberta em nova aba.
// Módulo compartilhado: o App.tsx abre, MeusPedidos fecha quando o pagamento
// é confirmado (a referência sobrevive ao unmount das rotas).
let janelaAsaas: Window | null = null;

export function abrirAbaAsaas(url: string): Window | null {
  const janela = window.open(url, '_blank');
  if (!janela) return null;
  try {
    janela.opener = null;
  } catch { /* cross-origin não permite — segue mesmo assim */ }
  janelaAsaas = janela;
  return janela;
}

export function fecharAbaAsaas() {
  try {
    janelaAsaas?.close();
  } catch { /* aba já fechada pelo usuário */ }
  janelaAsaas = null;
}

export function temAbaAsaasAberta(): boolean {
  return janelaAsaas !== null && !janelaAsaas.closed;
}
