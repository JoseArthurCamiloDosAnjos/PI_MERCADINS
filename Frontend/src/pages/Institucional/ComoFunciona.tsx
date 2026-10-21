import { Link } from "react-router-dom";
import PaginaInstitucional from "./Institucional";

const PASSOS_CLIENTE = [
  {
    titulo: "Escolha o mercado",
    texto:
      "Na página inicial, procure mercados por nome, cidade ou categoria e abra a loja que preferir.",
  },
  {
    titulo: "Monte seu carrinho",
    texto:
      "Adicione os produtos que quiser — pode navegar por vários mercados. Você não precisa estar logado para isso.",
  },
  {
    titulo: "Faça login e confirme",
    texto:
      "O login é pedido só na hora de finalizar o pedido. Seus itens ficam salvos no carrinho enquanto isso.",
  },
  {
    titulo: "Acompanhe com o mercado",
    texto:
      "O pedido chega direto no painel do mercado. Em caso de dúvidas, o atendimento fica por conta do próprio lojista.",
  },
];

const PASSOS_VENDEDOR = [
  {
    titulo: "Escolha seu plano",
    texto:
      "Os planos Essencial, Plus e Premium atendem desde o mercado de bairro até a rede com várias lojas.",
  },
  {
    titulo: "Cadastre seu mercado",
    texto:
      "Preencha os dados da loja, endereço e logo. Em poucos minutos sua vitrine já está no ar.",
  },
  {
    titulo: "Publique seus produtos",
    texto:
      "Cadastre produtos com nome, preço, fotos e quantidade em estoque — respeitando o limite do seu plano.",
  },
  {
    titulo: "Receba os pedidos",
    texto:
      "Cada pedido aparece no seu painel com os itens, quantidades e valores. É só separar e despachar.",
  },
];

export default function ComoFunciona() {
  return (
    <PaginaInstitucional
      titulo="Como funciona"
      subtitulo="Do clique do cliente ao painel do lojista: em poucos passos, a compra está feita."
    >
      <section className="inst-section">
        <h2>Para quem compra</h2>
        <div className="inst-steps">
          {PASSOS_CLIENTE.map((passo, i) => (
            <div className="inst-step" key={passo.titulo}>
              <div className="inst-step-num">{i + 1}</div>
              <div>
                <h3>{passo.titulo}</h3>
                <p>{passo.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="inst-section">
        <h2>Para quem vende</h2>
        <div className="inst-steps">
          {PASSOS_VENDEDOR.map((passo, i) => (
            <div className="inst-step" key={passo.titulo}>
              <div className="inst-step-num">{i + 1}</div>
              <div>
                <h3>{passo.titulo}</h3>
                <p>{passo.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="inst-ctas">
        <Link className="inst-cta" to="/">
          Começar a comprar
        </Link>
        <Link className="inst-cta inst-cta--ghost" to="/promocional">
          Criar meu mercado
        </Link>
      </div>
    </PaginaInstitucional>
  );
}
