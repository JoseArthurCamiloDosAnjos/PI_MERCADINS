import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { thumbUrl } from '../utils/imagens';

type ImagemProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  thumb?: boolean;
  sizes?: string;
};

export default function Imagem({
  src,
  thumb = true,
  sizes = '(max-width: 600px) 100vw, 600px',
  onError,
  loading,
  decoding,
  ...rest
}: ImagemProps) {
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
