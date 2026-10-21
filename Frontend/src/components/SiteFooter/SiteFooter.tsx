import { Link } from "react-router-dom";
import logo from "../../assets/logo2.png";
import "./SiteFooter.css";

type LinkFooter = { texto: string; para: string };

const COLUNAS: { titulo: string; links: LinkFooter[] }[] = [
  {
    titulo: "Mercadins",
    links: [
      { texto: "Sobre nós", para: "/sobre" },
      { texto: "Como funciona", para: "/como-funciona" },
      { texto: "Mercados parceiros", para: "/mercados-parceiros" },
    ],
  },
  {
    titulo: "Atendimento",
    links: [
      { texto: "Central de ajuda", para: "/atendimento" },
      { texto: "Fale conosco", para: "/atendimento#contato" },
      { texto: "Perguntas frequentes", para: "/atendimento#faq" },
    ],
  },
  {
    titulo: "Legal",
    links: [
      { texto: "Termos de uso", para: "/termos" },
      { texto: "Privacidade", para: "/privacidade" },
      { texto: "Cookies", para: "/cookies" },
    ],
  },
];

/** Rodapé do site — usado na home e nas páginas institucionais. */
export default function SiteFooter() {
  return (
    <footer className="sf-footer">
      <div className="sf-container">
        <div className="sf-grid">
          <div className="sf-brand">
            <Link to="/" title="Voltar ao início">
              <img src={logo} alt="Mercadins" className="sf-logo" />
            </Link>
            <p>
              Seus mercados favoritos reunidos em um único lugar.
              Compre online e receba onde estiver.
            </p>
          </div>

          {COLUNAS.map((coluna) => (
            <div key={coluna.titulo}>
              <h4>{coluna.titulo}</h4>
              <ul>
                {coluna.links.map((link) => (
                  <li key={link.texto}>
                    <Link to={link.para}>{link.texto}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="sf-contato">
          Atendimento:
          <a href="https://wa.me/5516988755641" target="_blank" rel="noreferrer">(16) 98875-5641</a>
          <span className="sf-sep">·</span>
          <a href="mailto:Suporte@mercadins.com.br">Suporte@mercadins.com.br</a>
        </div>

        <div className="sf-copyright">
          © 2026 Mercadins. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
