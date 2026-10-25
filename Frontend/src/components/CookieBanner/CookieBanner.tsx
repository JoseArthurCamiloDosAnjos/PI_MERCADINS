import { useState } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Aviso de cookies (LGPD - C7)
//
//  Aparece no canto inferior de TODA visita enquanto a pessoa não clicar em
//  "Entendi" — ou seja, se ela fechar o site sem aceitar, o aviso volta a
//  aparecer na próxima entrada. Assim que ela aceita, a escolha fica guardada
//  no navegador e o aviso não volta mais. O site usa cookies apenas para
//  manter a pessoa logada e guardar o carrinho — sem rastreamento de anúncios.
// ─────────────────────────────────────────────────────────────────────────────

const CHAVE = 'mercadins:cookies-aceitos';

export default function CookieBanner() {
  // O estado nasce já sabendo se a pessoa aceitou antes (sem efeito)
  const [visivel, setVisivel] = useState(() => !localStorage.getItem(CHAVE));

  function aceitar() {
    localStorage.setItem(CHAVE, 'sim');
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <aside className="cookie-banner" role="dialog" aria-live="polite" aria-label="Aviso sobre cookies">
      <p className="cookie-banner__texto">
        Usamos cookies para manter você conectado e guardar seu carrinho de compras.
        Ao continuar navegando, você concorda com o uso de cookies.{' '}
        <Link to="/cookies" className="cookie-banner__link">
          Saiba mais na Política de Cookies
        </Link>
        .
      </p>
      <button className="cookie-banner__btn" onClick={aceitar} type="button">
        Entendi
      </button>
    </aside>
  );
}
