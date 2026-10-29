import { useMemo, useState, useEffect, useRef } from "react";
import "./MenuPrincipal.css";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import ProfileMenu from "../../components/ProfileMenu";
import SiteFooter from "../../components/SiteFooter/SiteFooter";
import {
  IconMapPin,
  IconStore,
  IconShoppingCart,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconHeart,
  IconHeartFilled,
  IconClock,
  IconX,
  IconLeaf,
  IconSprout,
  IconBread,
  IconBottle,
  IconCutlery,
} from "../../components/Icons";
import logo from "../../assets/logo2.png";
import { registrarVisita, listarVisitados } from "../../utils/ultimosMercados";
import { irParaInicio } from "../../utils/inicio";
import { tipoPrincipal } from "../../utils/tipoLoja";
import { localizacao } from "../../utils/localizacao";
import HorarioSemana from "../../components/HorarioSemana";
import {
  estaAberto,
  horarioDeHoje,
  parseHorario,
  proximaAbertura,
} from "../../utils/horario";

type Store = {
  id_mercado: number;
  nome: string;
  slug: string;
  cidade?: string;
  estado?: string;
  bairro?: string;
  cep?: string;
  descricao?: string;
  foto_perfil?: string;
  cor_base?: string;
  status?: string;
  horario?: string | null;
  avaliacao?: number;
  avaliacoes_count?: number;
  categorias?: string[];
};

type Categoria = { nome: string; palavras: string[]; slug?: string };

const EMPTY_FAVORITOS = new Set<number>();

const CATEGORIAS: Categoria[] = [
  { nome: "Todos", palavras: [] },
  { nome: "Mercados", palavras: ["mercado", "supermerc", "mercadaria", "atacad", "atacado", "hiper"], slug: "mercado" },
  { nome: "Hortifruti", palavras: ["hortifruti", "fruta", "verdura", "feira", "hortali"], slug: "hortifruti" },
  { nome: "Açougues", palavras: ["acougue", "carnes", "carne", "frango"], slug: "acougue" },
  { nome: "Padarias", palavras: ["padaria", "pao", "paes", "panificadora", "confeitaria"], slug: "padaria" },
  { nome: "Bebidas", palavras: ["bebida", "bebidas", "sucos", "suco", "cerveja", "vinhos"], slug: "bebidas" },
  { nome: "Orgânicos", palavras: ["organico", "natural", "sustentavel", "vegano"], slug: "organicos" },
  { nome: "Conveniência", palavras: ["conveniencia", "minimercado", "quitanda", "miscigena", "variedade"], slug: "conveniencia" },
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

// Nota da avaliação: "4,8" (vírgula brasileira)
function formatrarNota(nota?: number) {
  const n = Number(nota ?? 0);
  if (Number.isNaN(n)) return "0,0";
  return n.toFixed(1).replace(".", ",");
}

// Tipos que o mercado declarou no cadastro (protege contra o banco
// devolver em texto "{mercado,padaria}" em vez de lista)
function tiposDoMercado(store: Store): string[] {
  const valor = store.categorias as unknown;
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === "string") return valor.replace(/[{}"]/g, "").split(",").filter(Boolean);
  return [];
}

// Visual de cada tipo de loja pro bloco de categoria do card:
// quadrado escuro com ícone + nome legível (o banco guarda minúsculo sem acento)
const TIPO_VISUAL: Record<string, { label: string; Ico: typeof IconStore }> = {
  mercado:      { label: "Mercado",      Ico: IconShoppingCart },
  hortifruti:   { label: "Hortifruti",   Ico: IconLeaf },
  acougue:      { label: "Açougue",      Ico: IconCutlery },
  padaria:      { label: "Padaria",      Ico: IconBread },
  bebidas:      { label: "Bebidas",      Ico: IconBottle },
  organicos:    { label: "Orgânicos",    Ico: IconSprout },
  conveniencia: { label: "Conveniência", Ico: IconStore },
};

// Busca por CEP:
// - parcial (5 a 7 dígitos) → mesma região, ex.: "15900" pega 15900-010, 15900-023...
// - completo (8 dígitos) → só o mercado daquele CEP exato, ex.: "15900-013"
function cepBate(store: Store, buscaLocal: string) {
  const digitosBusca = buscaLocal.replace(/\D/g, "");
  if (digitosBusca.length < 5) return false;
  const digitosCep = (store.cep ?? "").replace(/\D/g, "");
  if (digitosCep.length < 5) return false;
  return digitosCep.startsWith(digitosBusca.slice(0, 8));
}

// Sugestão de produto no dropdown da busca da home
type ProdutoBusca = {
  id_produto: number;
  nome: string;
  preco: number;
  imagem: string;
  estoque: number;
  categoria: string;
  id_categoria: number;
  id_mercado: number;
  mercado: string;
  slug: string;
  cidade: string;
  estado: string;
};

function irParaSecao(id: string) {
  if (id === "topo") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Volta pro topo da página na hora, sem animação
function irParaTopo() {
  window.scrollTo(0, 0);
}

export default function Mercadins() {
  const navigate = useNavigate();
  const { usuario, temMercado } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [totalMercados, setTotalMercados] = useState(0);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [local, setLocal] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  // Sugestões de produtos no dropdown da busca
  const [produtosBusca, setProdutosBusca] = useState<ProdutoBusca[]>([]);
  const [buscandoProdutos, setBuscandoProdutos] = useState(false);
  const [dropdownProdutos, setDropdownProdutos] = useState(false);
  // Menu compacto do topo (celular): abre e fecha o painel com os links
  const [menuAberto, setMenuAberto] = useState(false);
  const buscaFormRef = useRef<HTMLFormElement | null>(null);
  const [favoritosData, setFavoritosData] = useState<{
    usuarioId: number;
    ids: Set<number>;
  } | null>(null);
  // Mercados que o cliente já visitou (localStorage) — bloco "Continue explorando"
  const [visitados] = useState<string[]>(listarVisitados);

  // Relógio dos cards: recalcula Aberto/Fechado a cada 15 segundos, sem recarregar
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Card de loja FECHADA clicada: aviso antes de entrar (o cliente escolhe)
  const [lojaFechada, setLojaFechada] = useState<Store | null>(null);
  useEffect(() => {
    if (!lojaFechada) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLojaFechada(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lojaFechada]);

  // Status de funcionamento agora: pelo horário quando a loja configurou;
  // sem horário, ativo = aberto (compatível com mercados ainda sem rotina)
  const lojaAberta = (store: Store) =>
    estaAberto(parseHorario(store.horario), agora) ?? store.status === "ativo";

  // Setas de rolagem da barra de categorias: aparecem só quando existe chip
  // escondido (testa o espaço real da barra em cada mudança de tela/rolagem)
  const categoriasRef = useRef<HTMLDivElement | null>(null);
  const [setasCategorias, setSetasCategorias] = useState({ esq: false, dir: false });

  useEffect(() => {
    const ref = categoriasRef.current;
    if (!ref) return;
    const barra: HTMLDivElement = ref;
    function atualizar() {
      setSetasCategorias({
        esq: barra.scrollLeft > 4,
        dir: barra.scrollLeft < barra.scrollWidth - barra.clientWidth - 4,
      });
    }
    atualizar();
    barra.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);
    return () => {
      barra.removeEventListener("scroll", atualizar);
      window.removeEventListener("resize", atualizar);
    };
  }, []);

  function rolarCategorias(dir: -1 | 1) {
    const el = categoriasRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
  }

  useEffect(() => {
    let ativo = true;
    api
      // limit=100: a API padrão traz só 20 mercados e "escondia" os que
      // vinham depois disso (a lista daqui é a da home, sem paginação)
      .listarMercados(undefined, 100)
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

  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    api
      .listarFavoritos()
      .then((data) => {
        if (!ativo) return;
        const ids = new Set<number>(
          (data.favoritos ?? []).map((f: { id_mercado: number }) => f.id_mercado)
        );
        setFavoritosData({ usuarioId: usuario.id_usuario, ids });
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [usuario]);

  const favoritos =
    favoritosData && favoritosData.usuarioId === usuario?.id_usuario
      ? favoritosData.ids
      : EMPTY_FAVORITOS;

  // Favoritar direto no card da home, sem entrar no mercado. A troca aparece
  // na hora e volta se a rede falhar.
  const alternarFavorito = async (store: Store) => {
    if (!usuario) {
      navigate("/auth");
      return;
    }
    const id = store.id_mercado;
    const jaFavoritado = favoritos.has(id);
    const proximo = new Set(favoritos);
    if (jaFavoritado) proximo.delete(id);
    else proximo.add(id);

    setFavoritosData({ usuarioId: usuario.id_usuario, ids: proximo });
    try {
      await api.favoritarMercado(id, !jaFavoritado);
    } catch {
      setFavoritosData({ usuarioId: usuario.id_usuario, ids: favoritos });
    }
  };

  const lojasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    const buscaLocal = normalizar(local);
    const cat = CATEGORIAS.find((c) => c.nome === categoria);

    return stores
      .filter((store) => {
        const texto = normalizar(
          [store.nome, store.descricao, store.bairro, store.cidade, store.estado]
            .filter(Boolean)
            .join(" ")
        );

        if (termo && !texto.includes(termo)) return false;
        if (
          buscaLocal &&
          !normalizar(localizacao(store)).includes(buscaLocal) &&
          !cepBate(store, buscaLocal)
        )
          return false;
        if (cat && (cat.palavras.length > 0 || cat.slug)) {
          const bateuTipo = !!cat.slug && tiposDoMercado(store).includes(cat.slug);
          const bateuPalavra = cat.palavras.some((p) => texto.includes(p));
          if (!bateuTipo && !bateuPalavra) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const favA = favoritos.has(a.id_mercado) ? 1 : 0;
        const favB = favoritos.has(b.id_mercado) ? 1 : 0;
        return favB - favA;
      });
  }, [stores, busca, local, categoria, favoritos]);

  const notaMedia = useMemo(() => {
    // Só entra na média quem já tem avaliação — mercado sem nota não
    // deveria puxar a média pra baixo
    const avaliados = stores.filter(s => Number(s.avaliacao ?? 0) > 0);
    if (avaliados.length === 0) return 0;
    const soma = avaliados.reduce((acc, s) => acc + Number(s.avaliacao ?? 0), 0);
    return soma / avaliados.length;
  }, [stores]);

  const filtrosAtivos = busca.trim() !== "" || local.trim() !== "" || categoria !== "Todos";

  // Melhores avaliados: top 3 notas (desempate por quantidade de avaliações)
  const melhoresAvaliados = useMemo(
    () =>
      [...stores]
        .filter((s) => Number(s.avaliacao ?? 0) > 0)
        .sort((a, b) => {
          const diff = Number(b.avaliacao ?? 0) - Number(a.avaliacao ?? 0);
          if (diff !== 0) return diff;
          return (b.avaliacoes_count ?? 0) - (a.avaliacoes_count ?? 0);
        })
        .slice(0, 3),
    [stores]
  );

  // Continue explorando: mercados abertos pelo cliente, mais recentes primeiro
  const continueExplorando = useMemo(() => {
    const porSlug = new Map(stores.map((s) => [s.slug, s]));
    return visitados
      .map((slug) => porSlug.get(slug))
      .filter((s): s is Store => Boolean(s))
      .slice(0, 6);
  }, [stores, visitados]);

  // Sugestões de produtos: busca com 300ms de espera em todos os mercados
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    const timer = window.setTimeout(() => {
      setBuscandoProdutos(true);
      api.buscarProdutos(termo)
        .then(d => setProdutosBusca(d.produtos ?? []))
        .catch(() => setProdutosBusca([]))
        .finally(() => setBuscandoProdutos(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [busca]);

  // Fecha o dropdown quando o clique fica fora da área de busca
  useEffect(() => {
    if (!dropdownProdutos) return;
    function foraDoCampo(e: MouseEvent) {
      if (buscaFormRef.current && !buscaFormRef.current.contains(e.target as Node)) {
        setDropdownProdutos(false);
      }
    }
    document.addEventListener("mousedown", foraDoCampo);
    return () => document.removeEventListener("mousedown", foraDoCampo);
  }, [dropdownProdutos]);

  // Aviso de CEP no contador: parcial = mesma região; completo = CEP exato
  const digitosLocal = local.replace(/\D/g, "");
  const avisoCep =
    digitosLocal.length < 5
      ? ""
      : digitosLocal.length >= 8
        ? ` · no CEP ${digitosLocal.slice(0, 5)}-${digitosLocal.slice(5, 8)}`
        : ` · na região do CEP ${digitosLocal.slice(0, 5)}`;

  function limparFiltros() {
    setBusca("");
    setLocal("");
    setCategoria("Todos");
  }

  function handleBuscar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    irParaSecao("mercados");
  }

  // Abre o mercado direto (chamado depois que o cliente confirma)
  function abrirMercado(slug: string) {
    registrarVisita(slug);
    navigate(`/vitrine/${slug}`);
  }

  function irParaMercado(slug: string) {
    if (!slug) return;
    const store = stores.find(s => s.slug === slug);
    // Loja fechada agora: mostra o aviso antes de entrar — o cliente decide
    if (store && !lojaAberta(store)) {
      setLojaFechada(store);
      return;
    }
    abrirMercado(slug);
  }

  // Aviso de "loja fechada" (aberto pelo card fechado)
  const proximaLoja = lojaFechada
    ? proximaAbertura(parseHorario(lojaFechada.horario))
    : null;

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
                irParaInicio();
              }}
              title="Voltar ao início"
            >
              <img src={logo} alt="Mercadins" className="mp-logo-img" />
            </a>

            <ul
              className={`nav-links${menuAberto ? " nav-links--aberto" : ""}`}
              onClick={() => setMenuAberto(false)}
            >
              <li>
                <a
                  href="#topo"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaTopo();
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
              <li>
                {/* Vai para a página promocional já parando em cima dos planos */}
                <Link to="/promocional#planos">Crie seu mercado</Link>
              </li>
              {!usuario && (
                <li className="nav-links__entrar">
                  <Link to="/auth">Entrar</Link>
                </li>
              )}
              {!usuario && (
                <li className="nav-links__cadastrar">
                  <Link to="/auth/register">Criar conta</Link>
                </li>
              )}
            </ul>

            <form className="search" onSubmit={handleBuscar} ref={buscaFormRef}>
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
                onChange={(e) => {
                  const valor = e.target.value;
                  setBusca(valor);
                  if (valor.trim().length < 2) {
                    setProdutosBusca([]);
                    setDropdownProdutos(false);
                  } else {
                    setDropdownProdutos(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDropdownProdutos(false);
                }}
                placeholder="Buscar mercados e produtos"
                aria-label="Buscar mercados e produtos"
              />

              {/* Sugestões de produtos de todos os mercados */}
              {dropdownProdutos && (buscandoProdutos || produtosBusca.length > 0) && (
                <div className="search-dd" role="listbox" aria-label="Sugestões de produtos">
                  <p className="search-dd-titulo">
                    {buscandoProdutos ? "Buscando produtos..." : "Produtos"}
                  </p>
                  {!buscandoProdutos &&
                    produtosBusca.slice(0, 6).map((p) => (
                      <button
                        type="button"
                        className="search-dd-item"
                        key={p.id_produto}
                        role="option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setDropdownProdutos(false);
                          registrarVisita(p.slug);
                          navigate(
                            `/vitrine/${p.slug}/produto/${p.id_categoria}/${p.id_produto}`
                          );
                        }}
                      >
                        {p.imagem ? (
                          <img className="search-dd-img" src={p.imagem} alt="" loading="lazy" />
                        ) : (
                          <span className="search-dd-img search-dd-img--vazio" aria-hidden="true" />
                        )}
                        <span className="search-dd-info">
                          <span className="search-dd-nome">{p.nome}</span>
                          <span className="search-dd-mercado">
                            {p.mercado}
                            {p.cidade ? ` · ${p.cidade}` : ""}
                          </span>
                        </span>
                        <span className="search-dd-preco">
                          R$ {p.preco.toFixed(2).replace(".", ",")}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </form>

            {usuario ? (
              <div className="nav-profile">
                <ProfileMenu />
              </div>
            ) : (
              <>
                <Link className="login" to="/auth">
                  Entrar
                </Link>
                <Link className="signup" to="/auth/register">
                  Criar conta
                </Link>
              </>
            )}

            {/* Menu compacto — abaixo de 600px os links do topo somem,
                então este botão (hambúrguer) abre o painel de navegação */}
            <button
              type="button"
              className="nav-toggle"
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
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
                [...stores]
                  .sort(
                    (a, b) =>
                      (favoritos.has(b.id_mercado) ? 1 : 0) -
                      (favoritos.has(a.id_mercado) ? 1 : 0)
                  )
                  .slice(0, 3)
                  .map((store) => (
                    <PreviewItem
                      key={store.id_mercado}
                      image={store.foto_perfil}
                      title={store.nome}
                      subtitle={lojaAberta(store) ? "Aberto agora" : localizacao(store)}
                      aberto={lojaAberta(store)}
                      favoritado={favoritos.has(store.id_mercado)}
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
        <div className="container categories-wrap">
          {setasCategorias.esq && (
            <button
              type="button"
              className="category-arrow"
              aria-label="Ver categorias anteriores"
              onClick={() => rolarCategorias(-1)}
            >
              <IconArrowLeft size={16} />
            </button>
          )}

          <div className="categories" ref={categoriasRef}>
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

          {setasCategorias.dir && (
            <button
              type="button"
              className="category-arrow"
              aria-label="Ver mais categorias"
              onClick={() => rolarCategorias(1)}
            >
              <IconArrowRight size={16} />
            </button>
          )}
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
                    }${avisoCep}`}
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
                  <div className="store-cover-wrap">
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
                          <span className="store-cover-icon" aria-hidden="true">
                            <IconStore size={36} />
                          </span>
                        )}
                        <span
                          className={`store-status ${
                            lojaAberta(store) ? "aberto" : "fechado"
                          }`}
                        >
                          {lojaAberta(store) ? "Aberto" : "Fechado"}
                        </span>
                      </div>
                    </button>

                    {/* Favoritar/desfavoritar sem precisar entrar no mercado */}
                    <button
                      type="button"
                      className={`store-favorito-badge store-favorito-badge--btn${
                        favoritos.has(store.id_mercado) ? " ativo" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void alternarFavorito(store);
                      }}
                      title={
                        favoritos.has(store.id_mercado)
                          ? "Remover dos favoritos"
                          : "Favoritar mercado"
                      }
                      aria-pressed={favoritos.has(store.id_mercado)}
                      aria-label={
                        favoritos.has(store.id_mercado)
                          ? `Remover ${store.nome} dos favoritos`
                          : `Favoritar ${store.nome}`
                      }
                    >
                      {favoritos.has(store.id_mercado) ? (
                        <IconHeartFilled size={13} />
                      ) : (
                        <IconHeart size={13} />
                      )}
                    </button>
                  </div>

                  <div className="store-content">
                    {/* Bloco visual da categoria do estabelecimento */}
                    <BlocoTipo store={store} />

                    <div className="store-title-row">
                      <div>
                        <h3 title={store.nome}>{store.nome}</h3>
                        <p className="store-local">
                          <IconMapPin size={13} />
                          {localizacao(store)}
                          {store.cep ? ` · CEP ${store.cep}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Horário de hoje, quando o mercado configurou */}
                    <LinhaHorario store={store} agora={agora} />

                    {/* Semana inteira visível: dias abertos e fechados */}
                    <HorarioSemana horario={store.horario} />

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
                    Acessar {tipoPrincipal(tiposDoMercado(store)).toLowerCase()}
                    <IconArrowRight size={16} />
                  </button>
                </article>
              ))}

              {/* Criar mercado — só para quem não tem loja própria ou não está logado */}
              {(!usuario || !temMercado) && (
                <button
                  type="button"
                  className="store-card store-card--criar"
                  onClick={() => {
                    if (usuario) {
                      navigate("/promocional");
                    } else {
                      sessionStorage.setItem("posLoginDestino", "/promocional");
                      navigate("/auth");
                    }
                  }}
                >
                  <span className="criar-mercado-icon">+</span>
                  <strong className="criar-mercado-titulo">Criar seu mercado</strong>
                  <span className="criar-mercado-sub">
                    {usuario
                      ? "Cadastre sua loja e comece a vender hoje mesmo"
                      : "Entre ou crie sua conta para começar"}
                  </span>
                </button>
              )}
            </section>
          )}

          {/* Melhores avaliados — top 3 notas dos clientes */}
          {!carregando && !filtrosAtivos && melhoresAvaliados.length > 0 && (
            <section className="home-secao" id="melhores-avaliados">
              <div className="home-secao-head">
                <h2>Melhores avaliados</h2>
                <p>Os mercados com maior nota dos nossos clientes</p>
              </div>
              <div className="home-rank-lista">
                {melhoresAvaliados.map((store, indice) => (
                  <button
                    type="button"
                    className="home-rank-item"
                    key={store.id_mercado}
                    onClick={() => irParaMercado(store.slug)}
                  >
                    <span className="home-rank-pos">{indice + 1}</span>
                    {store.foto_perfil ? (
                      <img
                        src={store.foto_perfil}
                        alt=""
                        className="home-rank-img"
                        loading="lazy"
                      />
                    ) : (
                      <span className="home-rank-img home-rank-img--vazio" aria-hidden="true">
                        <IconStore size={24} />
                      </span>
                    )}
                    <span className="home-rank-info">
                      <strong>{store.nome}</strong>
                      <span className="home-rank-local">{localizacao(store)}</span>
                    </span>
                    <span className="home-rank-nota">
                      <Stars nota={Number(store.avaliacao ?? 0)} />
                      <strong>{formatrarNota(store.avaliacao)}</strong>
                      <small>
                        {store.avaliacoes_count ?? 0}{" "}
                        {(store.avaliacoes_count ?? 0) === 1 ? "avaliação" : "avaliações"}
                      </small>
                    </span>
                    <IconArrowRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Continue explorando — mercados que o cliente já visitou */}
          {!carregando && !filtrosAtivos && continueExplorando.length > 0 && (
            <section className="home-secao" id="continue-explorando">
              <div className="home-secao-head">
                <h2>Continue explorando</h2>
                <p>Mercados que você visitou recentemente</p>
              </div>
              <div className="home-vistos-lista">
                {continueExplorando.map((store) => (
                  <button
                    type="button"
                    className="home-visto-item"
                    key={store.id_mercado}
                    onClick={() => irParaMercado(store.slug)}
                  >
                    {store.foto_perfil ? (
                      <img
                        src={store.foto_perfil}
                        alt=""
                        className="home-visto-img"
                        loading="lazy"
                      />
                    ) : (
                      <span className="home-visto-img home-visto-img--vazio" aria-hidden="true">
                        <IconStore size={24} />
                      </span>
                    )}
                    <strong className="home-visto-nome">{store.nome}</strong>
                    <span className="home-visto-local">{localizacao(store)}</span>
                    <span className="home-visto-cta">
                      Ver {tipoPrincipal(tiposDoMercado(store)).toLowerCase()} <IconArrowRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* ── Convite a lojistas da região: captação de parceiros ─────── */}
      <section className="home-parceiro">
        <div className="container home-parceiro-inner">
          <div className="home-parceiro-texto">
            <h2>Tem um mercado, padaria ou açougue?</h2>
            <p>
              Chegue a mais clientes na sua cidade: vitrine profissional, pedidos
              online e gestão completa, no mesmo padrão das lojas desta página.
            </p>
          </div>
          <Link to="/promocional" className="home-parceiro-btn">
            Conheça os planos <IconArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Aviso: loja fechada (o card foi clicado fora do horário) ── */}
      {lojaFechada && (
        <div className="mp-aviso-overlay" onClick={() => setLojaFechada(null)}>
          <div
            className="mp-aviso"
            role="alertdialog"
            aria-modal="true"
            aria-label={`${lojaFechada.nome} está fechada agora`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mp-aviso-icone"><IconClock size={22} /></div>
            <h3 className="mp-aviso-titulo">{lojaFechada.nome} está fechada agora</h3>
            <p className="mp-aviso-hora">
              {horarioDeHoje(parseHorario(lojaFechada.horario)) ?? "Horário de funcionamento não informado"}
            </p>
            {proximaLoja && <p className="mp-aviso-prox">{proximaLoja}</p>}
            <div className="mp-aviso-botoes">
              <button
                type="button"
                className="mp-aviso-btn mp-aviso-btn-sec"
                onClick={() => setLojaFechada(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="mp-aviso-btn mp-aviso-btn-pri"
                onClick={() => {
                  const slug = lojaFechada.slug;
                  setLojaFechada(null);
                  abrirMercado(slug);
                }}
              >
                Entrar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

// Bloco visual da categoria no card de mercado: quadrado escuro com ícone
// + etiqueta com o nome da categoria (e "+N" quando tem mais tipos).
// Linha de horário de hoje no card: "Hoje: 08:00 – 18:00" ou
// "Fechado hoje". Mercado sem horário configurado não mostra nada.
function LinhaHorario({ store, agora }: { store: Store; agora: Date }) {
  const texto = horarioDeHoje(parseHorario(store.horario), agora);
  if (!texto) return null;
  const fechado = texto.startsWith("Fechado");
  return (
    <p className={`store-horario ${fechado ? "off" : ""}`}>
      {fechado ? <IconX size={13} /> : <IconClock size={13} />} {texto}
    </p>
  );
}

function BlocoTipo({ store }: { store: Store }) {
  const tipos = tiposDoMercado(store);
  const principal = (tipos[0] ?? "mercado").toLowerCase();
  const visual = TIPO_VISUAL[principal] ?? { label: "Mercado", Ico: IconStore };
  const extras = tipos.length - 1;
  return (
    <span className="store-tipo">
      <span className="store-tipo-quadro" aria-hidden="true">
        <visual.Ico size={18} />
      </span>
      <span className="store-tipo-nome">{visual.label}</span>
      {extras > 0 && <span className="store-tipo-extra">+{extras}</span>}
    </span>
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
  favoritado,
  onClick,
}: {
  image?: string;
  title: string;
  subtitle: string;
  aberto?: boolean;
  favoritado?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="preview-item" onClick={onClick}>
      <span className="preview-icon">
        {image ? (
          <img src={image} alt={title} className="preview-img" />
        ) : (
          <IconShoppingCart size={18} />
        )}
      </span>
      <span className="preview-info">
        <strong>
          <span>{title}</span>
          {favoritado && (
            <span className="preview-fav" title="Seu favorito">
              <IconHeartFilled size={12} />
            </span>
          )}
        </strong>
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


