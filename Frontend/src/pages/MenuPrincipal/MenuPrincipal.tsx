import "./MenuPrincipal.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo2.png";
type Store = {
  name: string;
  description: string;
  distance: string;
  rating: string;
  icon: string;
  color: string;
  tags: string[];
};

const stores: Store[] = [
  {
    name: "Mercado Central",
    description: "Mercado completo para as compras do dia a dia.",
    distance: "1,2 km",
    rating: "4,9",
    icon: "🛒",
    color: "blue",
    tags: ["Entrega grátis", "30–45 min", "Aberto"],
  },
  {
    name: "Açougue do Zé",
    description: "Carnes selecionadas e cortes especiais.",
    distance: "2,1 km",
    rating: "4,8",
    icon: "🥩",
    color: "red",
    tags: ["Entrega rápida", "Aberto"],
  },
  {
    name: "Hortifruti Natural",
    description: "Frutas, legumes e verduras sempre frescos.",
    distance: "1,8 km",
    rating: "4,9",
    icon: "🌱",
    color: "green",
    tags: ["Produtos frescos", "Orgânicos"],
  },
  {
    name: "Padaria São Paulo",
    description: "Pães, doces e salgados feitos diariamente.",
    distance: "2,5 km",
    rating: "4,7",
    icon: "🍞",
    color: "orange",
    tags: ["Café da manhã", "Aberto"],
  },
  {
    name: "Peixaria do Mar",
    description: "Peixes e frutos do mar selecionados.",
    distance: "3,4 km",
    rating: "4,8",
    icon: "🐟",
    color: "dark",
    tags: ["Produtos frescos", "Entrega agendada"],
  },
];

const categories = [
  "Todos",
  "Mercados",
  "Hortifruti",
  "Açougues",
  "Padarias",
  "Bebidas",
  "Orgânicos",
  "Conveniência",
];

export default function Mercadins() {
  function handleLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="mercadins-page">
      <header className="hero">
        <div className="container">
          <nav className="navbar">
            <a className="logo" href="#">
              <img src = {logo} alt="Mercadins" className="mp-logo-img"/>
            </a>

            <ul className="nav-links">
              <li><a href="#">Início</a></li>
              <li><a href="#mercados">Mercados</a></li>
              <li><a href="#categorias">Categorias</a></li>
            </ul>

            <div className="search">
              <input
                type="search"
                placeholder="Buscar mercados e produtos"
                aria-label="Buscar mercados e produtos"
              />
            </div>

            <a className="login" href="#">Entrar</a>
            <button className="signup">Criar conta</button>
          </nav>

          <div className="hero-content">
            <div>
              <h1>Seus mercados favoritos em delivery!</h1>

              <p>
                Encontre os melhores mercados da sua região e receba
                suas compras com rapidez e segurança.
              </p>

              <form className="location-form" onSubmit={handleLocation}>
                <input
                  type="text"
                  placeholder="Digite seu endereço ou CEP"
                  aria-label="Endereço ou CEP"
                />
                <button type="submit">Buscar mercados</button>
              </form>
            </div>

            <aside className="store-preview">
              <PreviewItem
                icon="🛒"
                title="Mercado Central"
                subtitle="Entrega em 30–45 min"
              />
              <PreviewItem
                icon="🥕"
                title="Hortifruti Natural"
                subtitle="Produtos frescos"
              />
              <PreviewItem
                icon="🥖"
                title="Padaria São Paulo"
                subtitle="Aberto agora"
              />
            </aside>
          </div>

          <div className="stats">
            <Stat value="47" label="mercados parceiros" />
            <Stat value="1.2k+" label="pedidos entregues" />
            <Stat value="30 min" label="tempo médio" />
          </div>
        </div>
      </header>

      <section className="category-bar" id="categorias">
        <div className="container categories">
          {categories.map((category, index) => (
            <button
              className={`category ${index === 0 ? "active" : ""}`}
              key={category}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <main id="mercados">
        <div className="container">
          <div className="section-header">
            <h2>Mercados em destaque</h2>
            <button>Mais perto de você</button>
          </div>

          <section className="stores">
            {stores.map((store) => (
              <article className="store-card" key={store.name}>
                <div className={`store-cover ${store.color}`}>
                  {store.icon}
                </div>

                <div className="store-content">
                  <div className="store-title-row">
                    <div>
                      <h3>{store.name}</h3>
                      <p>{store.description}</p>
                    </div>

                    <span className="distance">{store.distance}</span>
                  </div>

                  <span className="rating">
                    ★★★★★ <strong>{store.rating}</strong>
                  </span>

                  <div className="tags">
                    {store.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <button className="card-action">Acessar mercado</button>
              </article>
            ))}
          </section>
        </div>
      </main>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div>
              <img src={logo} className="mp-logo-img"/>
              <p>
                Seus mercados favoritos reunidos em um único lugar.
                Compre online e receba onde estiver.
              </p>
            </div>

            <FooterColumn
              title="Mercadins"
              links={["Sobre nós", "Como funciona", "Mercados parceiros"]}
            />

            <FooterColumn
              title="Atendimento"
              links={[
                "Central de ajuda",
                "Fale conosco",
                "Perguntas frequentes",
              ]}
            />

            <FooterColumn
              title="Legal"
              links={["Termos de uso", "Privacidade", "Cookies"]}
            />
          </div>

          <div className="copyright">
            © 2026 Mercadins. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

function PreviewItem({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="preview-item">
      <div className="preview-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: string[];
}) {
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {links.map((link) => (
          <li key={link}>
            <a href="#">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
