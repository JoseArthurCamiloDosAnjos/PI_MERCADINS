import { useMemo, useState, useEffect } from "react";
import "./MenuPrincipal.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import ProfileMenu from "../../components/ProfileMenu";
import {
  IconMapPin,
  IconStore,
  IconArrowRight,
  IconCheck,
} from "../../components/Icons";
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

type Categoria = { nome: string; palavras: string[] };

const CATEGORIAS: Categoria[] = [
  { nome: "Todos", palavras: [] },
  { nome: "Mercados", palavras: ["mercado", "supermerc", "mercadaria", "atacad", "atacado", "hiper"] },
  { nome: "Hortifruti", palavras: ["hortifruti", "fruta", "verdura", "feira", "hortali"] },
  { nome: "Açougues", palavras: ["acougue", "carnes", "carne", "frango"] },
  { nome: "Padarias", palavras: ["padaria", "pao", "paes", "panificadora", "confeitaria"] },
  { nome: "Bebidas", palavras: ["bebida", "bebidas", "sucos", "suco", "cerveja", "vinhos"] },
  { nome: "Orgânicos", palavras: ["organico", "natural", "sustentavel", "vegano"] },
  { nome: "Conveniência", palavras: ["conveniencia", "minimercado", "quitanda", "miscigena", "variedade"] },
];

const DESTAQUES = [
  { texto: "Entrega rápida na sua região" },
  { texto: "Somente mercados verificados" },
  { texto: "Sem taxa escondida" },
];

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function localizacao(m: Store) {
  if (m.bairro && m.cidade) return `${m.bairro} · ${m.cidade}`;
  if (m.cidade && m.estado) return `${m.cidade} · ${m.estado}`;
  if (m.cidade) return m.cidade;
  return "Mercado parceiro";
}

function formatrarNota(nota?: number) {
  const n = Number(nota ?? 0);
  if (Number.isNaN(n)) return "0,0";
  return n.toFixed(1).replace(".", ",");
}

function irParaSecao(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Mercadins() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [totalMercados, setTotalMercados] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [local, setLocal] = useState("");
  const [categoria, setCategoria] = useState("Todos");

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

  const lojasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    const buscaLocal = normalizar(local);
    const cat = CATEGORIAS.find((c) => c.nome === categoria);

    return stores.filter((store) => {
      const texto = normalizar(
        [store.nome, store.descricao, store.bairro, store.cidade, store.estado]
          .filter(Boolean)
          .join(" ")
      );

      if (termo && !texto.includes(termo)) return false;
      if (buscaLocal && !normalizar(localizacao(store)).includes(buscaLocal)) return false;
      if (cat && cat.palavras.length > 0 && !cat.palavras.some((p) => texto.includes(p))) {
        return false;
      }
      return true;
    });
  }, [stores, busca, local, categoria]);

  const notaMedia = useMemo(() => {
    if (stores.length === 0) return 0;
    const soma = stores.reduce((acc, s) => acc + Number(s.avaliacao ?? 0), 0);
    return soma / stores.length;
  }, [stores]);

  const filtrosAtivos = busca.trim() !== "" || local.trim() !== "" || categoria !== "Todos";

  function limparFiltros() {
    setBusca("");
    setLocal("");
    setCategoria("Todos");
  }

  function handleBuscar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    irParaSecao("mercados");
  }

  function irParaMercado(slug: string) {
    if (slug) navigate(`/vitrine/${slug}`);
  }

  return (
    <div className="mercadins-page">
      <header className="site-header" id="topo">
        <div className="container">
          <nav className="navbar">
            <a
              className="logo"
              href="#topo"
              onClick={(e) => {
                e.preventDefault();
                irParaSecao("topo");
              }}
            >
              <img src={logo} alt="Mercadins" className="mp-logo-img" />
            </a>

            <ul className="nav-links">
              <li>
                <a
                  href="#topo"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaSecao("topo");
                  }}
                >
                  Início
                </a>
              </li>
              <li>
                <a
                  href="#mercados"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaSecao("mercados");
                  }}
                >
                  Mercados
                </a>
              </li>
              <li>
                <a
                  href="#categorias"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaSecao("categorias");
                  }}
                >
                  Categorias
                </a>
              </li>
            </ul>

            <form className="search" onSubmit={handleBuscar}>
              <svg
                className="search-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar mercados"
                aria-label="Buscar mercados"
              />
            </form>

            {usuario ? (
              <div className="nav-profile">
                <ProfileMenu />
              </div>
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
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-eyebrow">
                <IconMapPin size={14} />
                Delivery de mercados perto de você
              </span>

              <h1>
                Seus mercados favoritos{" "}
                <span className="hero-highlight">em delivery!</span>
              </h1>

              <p>
                Encontre os melhores mercados da sua região e receba
                suas compras com rapidez e segurança.
              </p>

              <form className="location-form" onSubmit={handleBuscar}>
                <span className="location-icon">
                  <IconMapPin size={18} />
                </span>
                <input
                  type="text"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                  placeholder="Digite seu bairro, cidade ou CEP"
                  aria-label="Bairro, cidade ou CEP"
                />
                <button type="submit">Buscar mercados</button>
              </form>

              <ul className="hero-trust">
                {DESTAQUES.map((item) => (
                  <li key={item.texto}>
                    <IconCheck size={14} />
                    {item.texto}
                  </li>
                ))}
              </ul>
            </div>

            <aside className="store-preview">
              <div className="preview-head">
                <strong>Destaques</strong>
                <button type="button" onClick={() => irParaSecao("mercados")}>
                  Ver todos
                </button>
              </div>

              {carregando ? (
                <p className="preview-vazio">Carregando mercados...</p>
              ) : stores.length === 0 ? (
                <p className="preview-vazio">Nenhum mercado disponível.</p>
              ) : (
                stores.slice(0, 3).map((store) => (
                  <PreviewItem
                    key={store.id_mercado}
                    image={store.foto_perfil}
                    title={store.nome}
                    subtitle={
                      store.status === "ativo" ? "Aberto agora" : localizacao(store)
                    }
                    aberto={store.status === "ativo"}
                    onClick={() => irParaMercado(store.slug)}
                  />
                ))
              )}
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
            <Stat
              value={formatrarNota(notaMedia)}
              label="avaliação média"
            />
          </div>
        </div>
      </section>

      <section className="category-bar" id="categorias">
        <div className="container categories">
          {CATEGORIAS.map((cat) => (
            <button
              className={`category ${categoria === cat.nome ? "active" : ""}`}
              key={cat.nome}
              type="button"
              onClick={() => {
                setCategoria(cat.nome);
                irParaSecao("mercados");
              }}
            >
              {cat.nome}
            </button>
          ))}
        </div>
      </section>

      <main id="mercados">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Mercados em destaque</h2>
              <p className="section-sub">
                {carregando
                  ? "Carregando mercados..."
                  : `${lojasFiltradas.length} ${
                      lojasFiltradas.length === 1 ? "mercado encontrado" : "mercados encontrados"
                    }`}
              </p>
            </div>

            {filtrosAtivos && (
              <button className="clear-filters" type="button" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
          </div>

          {carregando ? (
            <section className="stores">
              <StoreSkeleton />
              <StoreSkeleton />
              <StoreSkeleton />
            </section>
          ) : lojasFiltradas.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <IconStore size={30} />
              </span>
              <h3>Nenhum mercado encontrado</h3>
              <p>Tente outra busca ou remova os filtros aplicados.</p>
              <button type="button" onClick={limparFiltros}>
                Ver todos os mercados
              </button>
            </div>
          ) : (
            <section className="stores">
              {lojasFiltradas.map((store) => (
                <article className="store-card" key={store.id_mercado}>
                  <button
                    type="button"
                    className="store-cover-btn"
                    onClick={() => irParaMercado(store.slug)}
                    aria-label={`Abrir ${store.nome}`}
                  >
                    <div
                      className="store-cover"
                      style={
                        store.cor_base ? { backgroundColor: store.cor_base } : undefined
                      }
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
                      <span
                        className={`store-status ${
                          store.status === "ativo" ? "aberto" : "fechado"
                        }`}
                      >
                        {store.status === "ativo" ? "Aberto" : "Fechado"}
                      </span>
                    </div>
                  </button>

                  <div className="store-content">
                    <div className="store-title-row">
                      <div>
                        <h3>{store.nome}</h3>
                        <p className="store-local">
                          <IconMapPin size={13} />
                          {localizacao(store)}
                        </p>
                      </div>
                    </div>

                    {store.descricao && <p className="store-desc">{store.descricao}</p>}

                    <div className="store-meta">
                      <span className="rating">
                        <Stars nota={Number(store.avaliacao ?? 0)} />
                        <strong>{formatrarNota(store.avaliacao)}</strong>
                      </span>
                      <span className="reviews">
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
                    <IconArrowRight size={16} />
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
            <div className="footer-brand">
              <img src={logo} alt="Mercadins" className="mp-logo-img" />
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

function Stars({ nota }: { nota: number }) {
  const pct = Math.max(0, Math.min(100, (nota / 5) * 100));
  return (
    <span
      className="stars"
      role="img"
      aria-label={`Nota ${formatrarNota(nota)} de 5`}
    >
      <span className="stars-layer">★★★★★</span>
      <span className="stars-layer stars-fill" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}

function PreviewItem({
  image,
  title,
  subtitle,
  aberto,
  onClick,
}: {
  image?: string;
  title: string;
  subtitle: string;
  aberto?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="preview-item" onClick={onClick}>
      <span className="preview-icon">
        {image ? (
          <img src={image} alt={title} className="preview-img" />
        ) : (
          <span>🛒</span>
        )}
      </span>
      <span className="preview-info">
        <strong>{title}</strong>
        <small>
          {aberto && <i className="preview-dot" />}
          {subtitle}
        </small>
      </span>
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StoreSkeleton() {
  return (
    <article className="store-card skeleton" aria-hidden="true">
      <div className="sk sk-cover" />
      <div className="store-content">
        <div className="sk sk-line" style={{ width: "55%", height: 16 }} />
        <div className="sk sk-line" style={{ width: "80%" }} />
        <div className="sk sk-line" style={{ width: "35%" }} />
      </div>
      <div className="sk sk-action" />
    </article>
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
