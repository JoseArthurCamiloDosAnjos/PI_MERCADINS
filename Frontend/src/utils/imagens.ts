//  Helpers de imagens — miniaturas geradas pelo backend

export function thumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.pathname.includes('/imagens/')) return null;

    const partes = u.pathname.split('/');
    const nome = partes.pop();
    if (!nome || !/\.(jpe?g|png|webp)$/i.test(nome)) return null;
    if (partes[partes.length - 1] === 'thumbs') return null;

    partes.push('thumbs', nome);
    u.pathname = partes.join('/');
    return u.toString();
  } catch {
    return null;
  }
}
