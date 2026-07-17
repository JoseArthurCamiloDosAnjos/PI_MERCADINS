import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import ThemeToggle from "../../components/ThemeToggle";
import "./MercadinsPromo.css";
import logo from "../../assets/logo2.png";

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill="#F5C000" />
    <path d="M5.5 10.5L8.5 13.5L14.5 7" stroke="#0D2251" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="#F5C000">
    <path d="M9 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L9 13.27l-4.78 2.53.91-5.32L1.27 6.62l5.34-.78z" />
  </svg>
);

const plans = [
  {
    name: "Básico",
    price: "49",
    period: "/mês",
    highlight: false,
    badge: null,
    features: [
      "Loja virtual completa",
      "Até 100 produtos",
      "Pedidos online",
      "Suporte por e-mail",
      "Domínio incluso",
    ],
    cta: "Começar agora",
  },
  {
    name: "Profissional",
    price: "97",
    period: "/mês",
    highlight: true,
    badge: "Mais popular",
    features: [
      "Tudo do Básico",
      "Produtos ilimitados",
      "IA para decisões de venda",
      "Relatórios de desempenho",
      "Suporte prioritário",
      "Integração WhatsApp",
    ],
    cta: "Escolher Profissional",
  },
  {
    name: "Premium",
    price: "197",
    period: "/mês",
    highlight: false,
    badge: null,
    features: [
      "Tudo do Profissional",
      "Múltiplas lojas",
      "API personalizada",
      "Gerente de conta dedicado",
      "Onboarding exclusivo",
      "SLA garantido",
    ],
    cta: "Falar com vendas",
  },
];

const benefits = [
  {
    icon: "🛒",
    title: "Venda mais",
    desc: "Seus produtos disponíveis online 24h por dia, 7 dias por semana, alcançando mais clientes.",
  },
  {
    icon: "📍",
    title: "Alcance clientes próximos",
    desc: "Quem está perto encontra seu mercado rapidamente com nossa geolocalização inteligente.",
  },
  {
    icon: "⚙️",
    title: "Tudo automatizado",
    desc: "Pedidos e pagamentos processados com facilidade, sem complicação para você.",
  },
  {
    icon: "🤖",
    title: "Inteligência Artificial",
    desc: "Tome decisões mais embasadas com análises e sugestões geradas por IA para seu negócio.",
  },
];

export default function MercadinsPromo() {
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { usuario, temMercado } = useAuth();
  const { tema, toggleTema } = useTheme();

  useEffect(() => {
    const sections = document.querySelectorAll(
      ".mp-about, .mp-benefits, .mp-plans, .mp-testimonials, .mp-cta-final"
    );
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("mp-visible");
        }),
      { threshold: 0.12 }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const getPrice = (price: string): string | number => {
    if (billingAnnual) return Math.floor(parseInt(price) * 0.8);
    return price;
  };

  const handleCTA = () => {
    if (!usuario) {
      navigate("/auth/register");
    } else {
      navigate(temMercado ? "/vendedor" : "/perfil");
    }
  };

  return (
    <div className="mp-root">
      {/* NAVBAR */}
      <nav className={`mp-nav ${mobileMenuOpen ? "mp-nav-open" : ""}`}>
        <div className="mp-nav-inner">
          <div className="mp-logo">
            <img src={logo} alt="Mercadins" className="mp-logo-img" />
          </div>
          <div className={`mp-nav-links ${mobileMenuOpen ? "mp-nav-links--open" : ""}`}>
            <a href="#beneficios" onClick={() => setMobileMenuOpen(false)}>Benefícios</a>
            <a href="#planos" onClick={() => setMobileMenuOpen(false)}>Planos</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <div className="mp-nav-mobile-actions">
              <ThemeToggle tema={tema} onToggle={toggleTema} />
              <button className="mp-btn-nav" onClick={() => { setMobileMenuOpen(false); handleCTA(); }}>Criar minha loja grátis</button>
            </div>
          </div>
          <div className="mp-nav-right">
            <ThemeToggle tema={tema} onToggle={toggleTema} />
            <button className="mp-btn-nav" onClick={handleCTA}>Criar minha loja grátis</button>
          </div>
          <button
            className={`mp-hamburger ${mobileMenuOpen ? "mp-hamburger--open" : ""}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="mp-hero">
        <div className="mp-hero-bg-circles">
          <div className="mp-circle mp-circle-1" />
          <div className="mp-circle mp-circle-2" />
          <div className="mp-circle mp-circle-3" />
        </div>
        <div className="mp-hero-content">
          <div className="mp-hero-text">
            <span className="mp-eyebrow">Plataforma para mercados e mercearias</span>
            <h1 className="mp-hero-title">
              Seu mercado<br />
              <span className="mp-hero-highlight">vendendo online</span><br />
              em minutos.
            </h1>
            <p className="mp-hero-sub">
              Cadastre sua loja, receba pedidos e aumente suas vendas sem complicação.
              Sem mensalidade para começar — você só paga quando vender.
            </p>
            <div className="mp-hero-checks">
              <span><CheckIcon /> Sem mensalidade inicial</span>
              <span><CheckIcon /> Comece em menos de 5 minutos</span>
              <span><CheckIcon /> Suporte simples e rápido</span>
            </div>
            <div className="mp-hero-actions">
              <button className="mp-btn-primary" onClick={handleCTA}>Criar mercado grátis</button>
              <button className="mp-btn-ghost">Ver como funciona →</button>
            </div>
          </div>
          <div className="mp-hero-visual">
            <div className="mp-phone-mockup">
              <div className="mp-phone-screen">
                <div className="mp-screen-header">
                  <span className="mp-screen-dot" />
                  <span className="mp-screen-title">Minha Loja</span>
                  <span className="mp-screen-badge">● Online</span>
                </div>
                <div className="mp-screen-stats">
                  <div className="mp-stat-card">
                    <span className="mp-stat-value">R$ 3.240</span>
                    <span className="mp-stat-label">Vendas hoje</span>
                    <span className="mp-stat-up">↑ +18%</span>
                  </div>
                  <div className="mp-stat-card">
                    <span className="mp-stat-value">47</span>
                    <span className="mp-stat-label">Pedidos</span>
                    <span className="mp-stat-up">↑ +5</span>
                  </div>
                </div>
                <div className="mp-screen-products">
                  <div className="mp-product-row">
                    <span className="mp-prod-icon">🥛</span>
                    <span className="mp-prod-name">Leite Integral</span>
                    <span className="mp-prod-price">R$ 5,49</span>
                  </div>
                  <div className="mp-product-row">
                    <span className="mp-prod-icon">🍞</span>
                    <span className="mp-prod-name">Pão Francês</span>
                    <span className="mp-prod-price">R$ 0,79</span>
                  </div>
                  <div className="mp-product-row">
                    <span className="mp-prod-icon">🧃</span>
                    <span className="mp-prod-name">Suco de Laranja</span>
                    <span className="mp-prod-price">R$ 8,90</span>
                  </div>
                </div>
                <div className="mp-screen-ai">
                  <span className="mp-ai-label">🤖 IA Mercadins sugere:</span>
                  <span className="mp-ai-tip">Aumente estoque de leite — alta demanda prevista</span>
                </div>
              </div>
            </div>
            <div className="mp-hero-floater mp-floater-1">
              <span>📦</span> +12 pedidos hoje
            </div>
            <div className="mp-hero-floater mp-floater-2">
              <span>⭐</span> 4.9 avaliação
            </div>
          </div>
        </div>
        <div className="mp-hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#F4F6FB" />
          </svg>
        </div>
      </section>

      {/* SOBRE O MERCADINS */}
      <section className="mp-about" id="sobre">
        <div className="mp-container">
          <div className="mp-about-grid">
            <div className="mp-about-text">
              <span className="mp-eyebrow mp-eyebrow-dark">O que é o Mercadins?</span>
              <h2 className="mp-section-title">
                A plataforma digital feita para o<br />
                <span className="mp-text-accent">pequeno comércio de bairro</span>
              </h2>
              <p className="mp-about-desc">
                O Mercadins é uma plataforma digital criada especialmente para supermercados,
                mercadinhos e comércios de bairro que desejam ter presença online de forma
                simples e acessível.
              </p>
              <p className="mp-about-desc">
                Com o Mercadins, o dono do negócio consegue montar sua loja virtual de forma
                intuitiva, gerenciar produtos, acompanhar vendas e, com o auxílio da
                Inteligência Artificial, tomar decisões mais embasadas para crescer.
              </p>
              <div className="mp-about-tags">
                <span className="mp-tag">Sem conhecimento técnico</span>
                <span className="mp-tag">Fácil de usar</span>
                <span className="mp-tag">IA integrada</span>
              </div>
            </div>
            <div className="mp-about-cards">
              <div className="mp-info-card mp-info-card-blue">
                <span className="mp-info-icon">🏪</span>
                <strong>Para quem é?</strong>
                <p>Pequenos e médios comerciantes que precisam competir no mercado digital sem gastar com desenvolvedores.</p>
              </div>
              <div className="mp-info-card mp-info-card-yellow">
                <span className="mp-info-icon">🎯</span>
                <strong>Nosso objetivo</strong>
                <p>Facilitar ao máximo a criação de um site profissional para seu estabelecimento começar a vender online.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="mp-benefits" id="beneficios">
        <div className="mp-container">
          <div className="mp-section-head">
            <span className="mp-eyebrow">Por que escolher o Mercadins?</span>
            <h2 className="mp-section-title mp-title-white">
              Mais clientes. Mais vendas.<br />Menos esforço.
            </h2>
          </div>
          <div className="mp-benefits-grid">
            {benefits.map((b, i) => (
              <div className="mp-benefit-card" key={i}>
                <div className="mp-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section className="mp-plans" id="planos">
        <div className="mp-container">
          <div className="mp-section-head">
            <span className="mp-eyebrow mp-eyebrow-dark">Preços simples e transparentes</span>
            <h2 className="mp-section-title">
              Escolha o plano ideal<br />
              <span className="mp-text-accent">para o seu mercado</span>
            </h2>
            <p className="mp-plans-sub">Sem taxas escondidas. Cancele quando quiser.</p>
          </div>

          <div className="mp-billing-toggle">
            <span className={!billingAnnual ? "mp-toggle-active" : ""}>Mensal</span>
            <button
              className={`mp-toggle-btn ${billingAnnual ? "mp-toggle-on" : ""}`}
              onClick={() => setBillingAnnual(!billingAnnual)}
            >
              <span className="mp-toggle-knob" />
            </button>
            <span className={billingAnnual ? "mp-toggle-active" : ""}>
              Anual <span className="mp-discount-badge">-20%</span>
            </span>
          </div>

          <div className="mp-plans-grid">
            {plans.map((plan, i) => (
              <div
                className={`mp-plan-card ${plan.highlight ? "mp-plan-featured" : ""}`}
                key={i}
              >
                {plan.badge && (
                  <div className="mp-plan-badge">{plan.badge}</div>
                )}
                <div className="mp-plan-header">
                  <h3 className="mp-plan-name">{plan.name}</h3>
                  <div className="mp-plan-price">
                    <span className="mp-price-currency">R$</span>
                    <span className="mp-price-value">{getPrice(plan.price)}</span>
                    <span className="mp-price-period">{plan.period}</span>
                  </div>
                  {billingAnnual && (
                    <span className="mp-annual-note">cobrado anualmente</span>
                  )}
                </div>
                <ul className="mp-plan-features">
                  {plan.features.map((f, j) => (
                    <li key={j}>
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mp-plan-cta ${plan.highlight ? "mp-plan-cta-featured" : ""}`}
                  onClick={handleCTA}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          <div className="mp-plans-note">
            <span>✅</span>
            Todos os planos incluem 7 dias grátis para testar. Sem necessidade de cartão de crédito.
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="mp-testimonials">
        <div className="mp-container">
          <div className="mp-section-head">
            <span className="mp-eyebrow">Depoimentos</span>
            <h2 className="mp-section-title mp-title-white">
              Quem já usa o Mercadins
            </h2>
          </div>
          <div className="mp-testi-grid">
            {[
              {
                name: "Carlos Souza",
                role: "Dono do Mercadinho Central",
                text: "Em menos de 10 minutos minha loja estava no ar. Nunca imaginei que fosse tão fácil vender pela internet.",
                stars: 5,
              },
              {
                name: "Ana Paula Lima",
                role: "Mercado Bom Preço",
                text: "As sugestões da IA me ajudaram a não deixar faltar produto na prateleira. Minhas vendas subiram 35% no primeiro mês.",
                stars: 5,
              },
              {
                name: "João Ferreira",
                role: "Supermercado JF",
                text: "Finalmente consigo competir com as grandes redes. O Mercadins é simples e funciona de verdade.",
                stars: 5,
              },
            ].map((t, i) => (
              <div className="mp-testi-card" key={i}>
                <div className="mp-testi-stars">
                  {Array(t.stars).fill(0).map((_, s) => <StarIcon key={s} />)}
                </div>
                <p className="mp-testi-text">"{t.text}"</p>
                <div className="mp-testi-author">
                  <div className="mp-testi-avatar">{t.name[0]}</div>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mp-cta-final">
        <div className="mp-cta-circles">
          <div className="mp-cta-circle mp-cta-c1" />
          <div className="mp-cta-circle mp-cta-c2" />
        </div>
        <div className="mp-container mp-cta-content">
          <h2 className="mp-cta-title">
            Pronto para levar seu mercado<br />para o digital?
          </h2>
          <p className="mp-cta-sub">
            Comece sem pagar nada. Você só paga quando vender. Sem risco.
          </p>
          <div className="mp-cta-actions">
            <button className="mp-btn-primary mp-btn-large" onClick={handleCTA}>
              Criar meu mercado grátis →
            </button>
          </div>
          <div className="mp-cta-checks">
            <span><CheckIcon /> Sem mensalidade inicial</span>
            <span><CheckIcon /> Setup em 5 minutos</span>
            <span><CheckIcon /> Suporte incluso</span>
          </div>
          <p className="mp-cta-secure">🔒 Conexão segura e criptografada</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mp-footer">
        <div className="mp-container mp-footer-inner">
          <div className="mp-logo">
            <img src={logo} alt="Mercadins" className="mp-logo-img" />
          </div>
          <p className="mp-footer-tagline">Seu mercado inteligente</p>
          <p className="mp-footer-copy">© 2025 Mercadins. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}