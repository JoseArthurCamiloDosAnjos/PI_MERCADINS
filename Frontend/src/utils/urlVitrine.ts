//  Endereço da vitrine enxuto — mercadins.com.br/nome_mercado

const DOMINIO_PADRAO = 'mercadins.com.br';

/** Host sem protocolo e sem "www." — o que aparece na tela. */
function hostExibido(): string {
  if (typeof window === 'undefined') return DOMINIO_PADRAO;
  return window.location.host.replace(/^www\./, '') || DOMINIO_PADRAO;
}

function origem(): string {
  if (typeof window === 'undefined') return `https://${DOMINIO_PADRAO}`;
  return window.location.origin;
}

/** Forma curta: mercadins.com.br/nome_mercado (rota /:slug). */
export function urlVitrineCurta(slug: string): string {
  return `${origem()}/${slug}`;
}

/** Forma tradicional: mercadins.com.br/vitrine/nome_mercado. */
export function urlVitrineCompleta(slug: string): string {
  return `${origem()}/vitrine/${slug}`;
}

/** Texto enxuto exibido na interface (sem protocolo e sem www). */
export function urlVitrineExibida(slug: string): string {
  return `${hostExibido()}/${slug}`;
}

/** Copia a forma curta para a área de transferência. */
export async function copiarUrlVitrine(slug: string): Promise<boolean> {
  const url = urlVitrineCurta(slug);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = url;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}
