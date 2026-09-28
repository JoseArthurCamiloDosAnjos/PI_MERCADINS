import { useState, useEffect } from "react";
import "./MenuPrincipal.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import logo from "../../assets/logo2.png";

type Store = {
  id_mercado: number;
  nome: string;
  slug: string;
  cidade?: string;
  estado?: string;
  bairro?: string;
  descricao?: string;
  foto_perfil?: string;
  cor_base?: string;
  status?: string;
  avaliacao?: number;
  avaliacoes_count?: number;
};

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

function formatrarNota(nota?: number) {
  const n = Number(nota ?? 0);
  if (Number.isNaN(n)) return "0,0";
  return n.toFixed(1).replace(".", ",");
}

export default function Mercadins() {
  const navigate = useNavigate();
  const { usuario, temMercado, logout } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [totalMercados, setTotalMercados] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api
      .listarMercados()
      .then((data) => {
        if (!ativo) return;
        setStores(data.mercados ?? []);
        setTotalMercados(data.stats?.totalMercados ?? 0);
        setTotalPedidos(data.stats?.totalPedidos ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const destinoUsuario = usuario
    ? usuario.is_admin && localStorage.getItem("is_admin_login") === "true"
      ? "/admin"
      : temMercado
        ? "/vendedor"
        : "/perfil"
    : "/auth";

  function handleLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  function handleSair() {
    logout();
    navigate("/");
  }

  function irParaMercado(slug: string) {
    if (slug) navigate(`/vitrine/${slug}`);
  }

  function localizacao(m: Store) {
    if (m.bairro && m.cidade) return `${m.bairro} · ${m.cidade}`;
    if (m.cidade && m.estado) return `${m.cidade} · ${m.estado}`;
    if (m.cidade) return m.cidade;
    return "Mercado parceiro";
  }

  return (
    <div className="mercadins-page">
      <header className="hero">
        <div className="container">
          <nav className="navbar">
            <a className="logo" href="#">
              <img src={logo} alt="Mercadins" className="mp-logo-img" />
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

            {usuario ? (
              <>
                <a
                  className="login"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(destinoUsuario);
                  }}
                >
                  Olá, {usuario.nome?.split(" ")[0] ?? "usuário"}
                </a>
                <button className="signup" onClick={handleSair}>
                  Sair
                </button>
              </>
            ) : (
              <>
                <a
                  className="login"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("/auth");
                  }}
                >
                  Entrar
                </a>
                <button className="signup" onClick={() => navigate("/auth/register")}>
                  Criar conta
                </button>
              </>
            )}
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
              {carregando
                ? <p className="preview-vazio">Carregando mercados...</p>
                : stores.length === 0
                  ? <p className="preview-vazio">Nenhum mercado disponível.</p>
                  : stores.slice(0, 3).map((store) => (
                      <PreviewItem
                        key={store.id_mercado}
                        image={store.foto_perfil}
                        title={store.nome}
                        subtitle={store.status === "ativo" ? "Aberto agora" : localizacao(store)}
                      />
                    ))}
            </aside>
          </div>

          <div className="stats">
            <Stat
              value={totalMercados.toLocaleString("pt-BR")}
              label="mercados parceiros"
            />
            <Stat
              value={totalPedidos.toLocaleString("pt-BR")}
              label="pedidos entregues"
            />
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
          </div>

          {carregando ? (
            <p className="lista-vazio">Carregando mercados...</p>
          ) : stores.length === 0 ? (
            <p className="lista-vazio">
              Nenhum mercado cadastrado no momento.
            </p>
          ) : (
            <section className="stores">
              {stores.map((store) => (
                <article className="store-card" key={store.id_mercado}>
                  <div
                    className="store-cover"
                    style={store.cor_base ? { backgroundColor: store.cor_base } : undefined}
                  >
                    {store.foto_perfil ? (
                      <img
                        src={store.foto_perfil}
                        alt={store.nome}
                        className="store-cover-img"
                      />
                    ) : (
                      <span className="store-cover-icon">🏪</span>
                    )}
                  </div>

                  <div className="store-content">
                    <div className="store-title-row">
                      <div>
                        <h3>{store.nome}</h3>
                        <p>{store.descricao || localizacao(store)}</p>
                      </div>

                      <span className="distance">{localizacao(store)}</span>
                    </div>

                    <span className="rating">
                      ★★★★★ <strong>{formatrarNota(store.avaliacao)}</strong>
                    </span>

                    <div className="tags">
                      <span className="tag">
                        {store.status === "ativo" ? "Aberto" : "Indisponível"}
                      </span>
                      <span className="tag">
                        {store.avaliacoes_count ?? 0}{" "}
                        {store.avaliacoes_count === 1 ? "avaliação" : "avaliações"}
                      </span>
                    </div>
                  </div>

                  <button
                    className="card-action"
                    onClick={() => irParaMercado(store.slug)}
                  >
                    Acessar mercado
                  </button>
                </article>
              ))}
            </section>
          )}
        </div>
      </main>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div>
              <img src={logo} className="mp-logo-img" />
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
  image,
  title,
  subtitle,
}: {
  image?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="preview-item">
      <div className="preview-icon">
        {image ? (
          <img src={image} alt={title} className="preview-img" />
        ) : (
          <span>🛒</span>
        )}
      </div>
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