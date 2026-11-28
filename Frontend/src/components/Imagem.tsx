import { useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { thumbUrl } from '../utils/imagens';
import { guardarBlob, jaIndexada, objectUrlPara } from '../services/imagemCache';

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
  const [cacheado, setCacheado] = useState<{ src: string; url: string } | null>(null);
  // Derivado: muda de src automaticamente invalida o hit anterior (sem reset em efeito).
  const urlCacheado = cacheado && cacheado.src === src ? cacheado.url : null;

  // Hit: usa a cópia offline antes de ir à rede (sem srcSet/thumb — a versão
  // cacheada já é a otimizada). Miss: renderiza normalmente e indexa em
  // background para as próximas vezes.
  useEffect(() => {
    let ativo = true;

    (async () => {
      const hit = await objectUrlPara(src);
      if (!ativo) return;
      if (hit) {
        setCacheado({ src, url: hit });
        return;
      }
      try {
        if (await jaIndexada(src)) return;
        const res = await fetch(src);
        if (!res.ok) return;
        const tipo = res.headers.get('content-type') ?? '';
        if (!tipo.startsWith('image/')) return;
        await guardarBlob(src, await res.blob());
      } catch {
        // offline ou rede indisponível — silencioso
      }
    })();

    return () => {
      ativo = false;
    };
  }, [src]);

  const miniatura = !urlCacheado && thumb && semMiniatura !== src ? thumbUrl(src) : null;
  const fonte = urlCacheado ?? src;

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
    // Rede falhou → tenta o cache offline; miss propaga o erro como hoje.
    if (!urlCacheado && !candidato.startsWith('blob:')) {
      objectUrlPara(src)
        .then((url) => {
          if (!url) {
            onError?.(e);
            return;
          }
          setCacheado({ src, url });
          el.removeAttribute('srcset');
          el.removeAttribute('sizes');
          el.src = url;
        })
        .catch(() => onError?.(e));
      return;
    }
    onError?.(e);
  }

  return (
    <img
      {...rest}
      src={fonte}
      srcSet={miniatura ? `${miniatura} 300w, ${src} 1200w` : undefined}
      sizes={miniatura ? sizes : undefined}
      loading={loading ?? 'lazy'}
      decoding={decoding ?? 'async'}
      onError={falhou}
    />
  );
}
