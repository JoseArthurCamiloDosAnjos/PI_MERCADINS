//  Helpers de imagens — miniaturas geradas pelo backend

import type { SyntheticEvent } from 'react'

// Avatar padrão usado quando a foto do usuário/mercado não existe mais
// (ex.: imagens antigas hospedadas em disco efêmero que sumiram).
export const AVATAR_PADRAO = '/avatar-padrao.svg'

export function onAvatarError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset.avatarFallback === '1') return // evita loop se o fallback falhar
  img.dataset.avatarFallback = '1'
  img.src = AVATAR_PADRAO
}

export function thumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.pathname.includes('/imagens/')) return null;

    // URLs do Supabase Storage não têm miniaturas — inserir /thumbs/ geraria
    // um 404 a cada imagem pequena (a imagem original é usada direto).
    if (u.hostname.endsWith('.supabase.co') || u.pathname.includes('/storage/')) return null;

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
