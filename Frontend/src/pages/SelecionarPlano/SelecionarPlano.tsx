import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLANOS, type Plano } from '../MercadinsPromo/planos';
import './SelecionarPlano.css';
import logo from '../../assets/logo2.png';

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#F5C000" />
    <path d="M5.5 10.5L8.5 13.5L14.5 7" stroke="#0D2251" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SelecionarPlano() {
  const navigate = useNavigate();
  const [billingAnnual, setBillingAnnual] = useState(false);

  const getPrice = (price: string): string | number => {
    if (billingAnnual) return Math.floor(parseInt(price) * 0.8);
    return price;
  };

  function escolherPlano(plano: Plano) {
    localStorage.setItem('planoSelecionado', JSON.stringify({
      id: plano.id,
      nome: plano.name,
      cobranca: billingAnnual ? 'anual' : 'mensal',
    }));
    navigate('/registrar-mercado');
  }

  return (
    <div className="sp-page">
      <header className="sp-topbar">
        <button className="sp-back" onClick={() => navigate(-1)} aria-label="Voltar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar
        </button>
        <div className="sp-logo">
          <img src={logo} alt="Mercadins" />
          <span>Mercadins</span>
        </div>
        <span className="sp-step">Passo 1 de 2</span>
      </header>

      <main className="sp-content">
        <div className="sp-head">
          <span className="sp-eyebrow">Escolha seu plano</span>
          <h1 className="sp-title">
            Selecione o plano ideal<br />
            <span>para o seu mercado</span>
          </h1>
          <p className="sp-sub">7 dias grátis para testar. Sem necessidade de cartão de crédito.</p>
        </div>

        <div className="sp-billing">
          <span className={!billingAnnual ? 'sp-billing-active' : ''}>Mensal</span>
          <button
            className={`sp-toggle ${billingAnnual ? 'sp-toggle-on' : ''}`}
            onClick={() => setBillingAnnual(!billingAnnual)}
            aria-label="Alternar cobrança"
          >
            <span className="sp-toggle-knob" />
          </button>
          <span className={billingAnnual ? 'sp-billing-active' : ''}>
            Anual <span className="sp-discount">-20%</span>
          </span>
        </div>

        <div className="sp-grid">
          {PLANOS.map(plano => (
            <div className={`sp-card ${plano.highlight ? 'sp-card-featured' : ''}`} key={plano.id}>
              {plano.badge && <div className="sp-badge">{plano.badge}</div>}
              <div className="sp-card-head">
                <h2 className="sp-card-name">{plano.name}</h2>
                <div className="sp-price">
                  <span className="sp-price-currency">R$</span>
                  <span className="sp-price-value">{getPrice(plano.price)}</span>
                  <span className="sp-price-period">{plano.period}</span>
                </div>
                {billingAnnual && <span className="sp-annual-note">cobrado anualmente</span>}
              </div>
              <ul className="sp-features">
                {plano.features.map((f, i) => (
                  <li key={i}>
                    <CheckIcon />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`sp-cta ${plano.highlight ? 'sp-cta-featured' : ''}`}
                onClick={() => escolherPlano(plano)}
              >
                Escolher {plano.name}
              </button>
            </div>
          ))}
        </div>

        <p className="sp-note">
          <span>✅</span> Você só paga depois do teste grátis. Cancele quando quiser.
        </p>
      </main>
    </div>
  );
}
