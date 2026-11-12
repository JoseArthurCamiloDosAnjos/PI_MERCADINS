import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { thumbUrl } from '../utils/imagens';

type ImagemProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** URL da imagem (a original enviada no upload). */
  src: string;
  /**
   * Usa a miniatura (300w) via srcset nas caixas pequenas — o navegador
   * escolhe entre miniatura e original conforme o `sizes`. Padrão: true.
   */
  thumb?: boolean;
  /** Tamanho exibido da imagem (atributo sizes do srcset). */
  sizes?: string;
};

/**
 * <img> responsivo: serve a miniatura gerada no upload para caixas pequenas
 * (card, miniatura, carrinho) e o original para as grandes (galeria, banner),
 * com fallback automático para o original quando a miniatura não existe
 * (imagens enviadas antes deste recurso). Por padrão carrega lazy.
 */
export default function Imagem({
  src,
  thumb = true,
  sizes = '(max-width: 600px) 100vw, 600px',
  onError,
  loading,
  decoding,
  ...rest
}: ImagemProps) {
  // Guarda por src: se a miniatura falhar para esta imagem, para de tentá-la
  // (e volta a tentar quando o src trocar, ex.: carrossel).
  const [semMiniatura, setSemMiniatura] = useState<string | null>(null);
  const miniatura = thumb && semMiniatura !== src ? thumbUrl(src) : null;

  function falhou(e: SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    const candidato = el.currentSrc || el.src;
    if (miniatura && semMiniatura !== src && candidato.includes('/thumbs/')) {
      setSemMiniatura(src);
      el.removeAttribute('srcset');
      el.removeAttribute('sizes');
      el.src = src;
      return;
    }
    onError?.(e);
  }

  return (
    <img
      {...rest}
      src={src}
      srcSet={miniatura ? `${miniatura} 300w, ${src} 1200w` : undefined}
      sizes={miniatura ? sizes : undefined}
      loading={loading ?? 'lazy'}
      decoding={decoding ?? 'async'}
      onError={falhou}
    />
  );
}
