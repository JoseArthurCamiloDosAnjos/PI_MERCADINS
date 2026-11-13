//  SEO por página (C6)

interface SeoOpcoes {
  titulo: string;
  descricao?: string;
  imagem?: string;
  url?: string;
}

function definirMeta(chave: string, atributo: 'name' | 'property', conteudo: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${chave}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(atributo, chave);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', conteudo);
}

function definirCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

/** Aplica título, descrição, canonical e etiquetas de compartilhamento. */
export function aplicarSeo({ titulo, descricao, imagem, url }: SeoOpcoes) {
  const urlCompleta = url ?? window.location.href;

  document.title = titulo;
  definirCanonical(urlCompleta);

  definirMeta('og:title', 'property', titulo);
  definirMeta('og:url', 'property', urlCompleta);
  definirMeta('twitter:title', 'name', titulo);

  if (descricao) {
    definirMeta('description', 'name', descricao);
    definirMeta('og:description', 'property', descricao);
    definirMeta('twitter:description', 'name', descricao);
  }
  if (imagem) {
    definirMeta('og:image', 'property', imagem);
    definirMeta('twitter:image', 'name', imagem);
  }
}
