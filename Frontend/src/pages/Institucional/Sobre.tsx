import { Link } from "react-router-dom";
import PaginaInstitucional from "./Institucional";

export default function Sobre() {
  return (
    <PaginaInstitucional
      titulo="Sobre o Mercadins"
      subtitulo="O marketplace que aproxima os mercados de bairro dos seus clientes, sem complicação para nenhum dos dois lados."
    >
      <section className="inst-section inst-legal">
        <h2>Quem somos</h2>
        <p>
          O Mercadins é uma plataforma de compras que reúne mercados, hortifrutis,
          açougues, padarias e lojas de vizinhança em um único lugar. O cliente
          navega pelos mercados da sua região, monta o carrinho como quiser e
          finaliza o pedido — tudo pelo celular ou computador.
        </p>
        <p>
          Para quem vende, o Mercadins coloca a loja na internet em minutos:
          cadastro simples, catálogo com fotos, controle de estoque e painel de
          pedidos. O comércio de bairro ganha a presença digital que antes só as
          grandes redes tinham.
        </p>
      </section>

      <div className="inst-cards">
        <div className="inst-card">
          <div className="inst-card-icon">🛒</div>
          <h3>Para você</h3>
          <p>
            Compre dos seus mercados favoritos de onde estiver. Monte o carrinho
            sem pressa, compare mercados e finalize o pedido com login apenas na
            hora de confirmar.
          </p>
        </div>

        <div className="inst-card">
          <div className="inst-card-icon">🏪</div>
          <h3>Para mercados</h3>
          <p>
            Tenha sua loja na internet com catálogo próprio, fotos de produtos,
            avaliações de clientes e um painel completo de pedidos e estoque.
          </p>
        </div>

        <div className="inst-card">
          <div className="inst-card-icon">💛</div>
          <h3>Planos para cada momento</h3>
          <p>
            Do mercado de esquina à rede com várias lojas: existe um plano com a
            medida certa de produtos, fotos e pedidos para o seu negócio crescer.
          </p>
        </div>
      </div>

      <section className="inst-section inst-legal">
        <h2>Nossa missão</h2>
        <p>
          Facilitar o dia a dia de quem compra e de quem vende: para o cliente,
          praticidade e variedade perto de casa; para o comerciante, uma vitrine
          profissional com custo justo e sem taxas escondidas.
        </p>
        <p>
          Acreditamos que o comércio de bairro é a alma das cidades — e que a
          tecnologia deve servir a ele, não substituí-lo.
        </p>
      </section>

      <div className="inst-ctas">
        <Link className="inst-cta" to="/mercados-parceiros">
          Conhecer mercados parceiros
        </Link>
        <Link className="inst-cta inst-cta--ghost" to="/como-funciona">
          Como funciona
        </Link>
      </div>
    </PaginaInstitucional>
  );
}
