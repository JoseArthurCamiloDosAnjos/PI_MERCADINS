import { useState } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Aviso de cookies (LGPD - C7) — BLOQUEANTE
//
//  Enquanto a pessoa não clicar em "Aceitar e continuar", o aviso cobre a tela
//  inteira e impede qualquer interação com o site (navegar, clicar, rolar por
//  trás). Assim que ela aceita, a escolha fica guardada no navegador e o aviso
//  não volta mais. Se fechar o site sem aceitar, o bloqueio volta na próxima
//  entrada. O site usa cookies apenas para manter a pessoa logada e guardar o
//  carrinho — sem rastreamento de anúncios.
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
    <div
      className="cookie-banner"
      role="dialog"
      aria-modal="true"
      aria-label="Aviso sobre cookies"
    >
      <div className="cookie-banner__cartao">
        <h2 className="cookie-banner__titulo">Este site usa cookies</h2>
        <p className="cookie-banner__texto">
          Usamos cookies para manter você conectado e guardar seu carrinho de
          compras. Você precisa aceitar para continuar navegando.{' '}
          <Link
            to="/cookies"
            className="cookie-banner__link"
            target="_blank"
            rel="noreferrer"
          >
            Saiba mais na Política de Cookies
          </Link>
          .
        </p>
        <button
          className="cookie-banner__btn"
          onClick={aceitar}
          type="button"
          autoFocus
        >
          Aceitar e continuar
        </button>
      </div>
    </div>
  );
}
