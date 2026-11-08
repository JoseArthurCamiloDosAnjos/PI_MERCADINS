import { Link } from "react-router-dom";
import PaginaInstitucional from "./Institucional";
import { IconShoppingCart, IconStore, IconCreditCard } from "../../components/Icons";

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
          <div className="inst-card-icon"><IconShoppingCart size={22} /></div>
          <h3>Para você</h3>
          <p>
            Compre dos seus mercados favoritos de onde estiver. Monte o carrinho
            sem pressa, compare mercados e finalize o pedido com login apenas na
            hora de confirmar.
          </p>
        </div>

        <div className="inst-card">
          <div className="inst-card-icon"><IconStore size={22} /></div>
          <h3>Para mercados</h3>
          <p>
            Tenha sua loja na internet com catálogo próprio, fotos de produtos,
            avaliações de clientes e um painel completo de pedidos e estoque.
          </p>
        </div>

        <div className="inst-card">
          <div className="inst-card-icon"><IconCreditCard size={22} /></div>
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

      <section className="inst-section inst-legal">
        <h2>Equipe de desenvolvimento</h2>
        <p>
          O Mercadins nasceu como projeto de integração e é mantido por um grupo
          de desenvolvedores que projetou e construiu a plataforma de ponta a
          ponta — do banco de dados à interface que você está usando agora.
        </p>

        <div className="inst-team">
          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">JA</span>
            <div>
              <h3>José Arthur Camilo dos Anjos</h3>
              <p>Desenvolvedor</p>
              <p className="inst-team-desc">
                Líder técnico do projeto. Atuou em toda a stack — do banco de
                dados à interface — e cuidou da arquitetura e da publicação
                do site.
              </p>
            </div>
          </div>

          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">JM</span>
            <div>
              <h3>Juan de Oliveira Marcondes Xavier</h3>
              <p>Desenvolvedor</p>
              <p className="inst-team-desc">
                Desenvolvedor full-stack. Trabalhou nas telas do site e na
                integração entre front-end e API, além de boa parte das
                funcionalidades do painel do vendedor.
              </p>
            </div>
          </div>

          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">RV</span>
            <div>
              <h3>Raul Diaz Vitoria</h3>
              <p>Desenvolvedor</p>
              <p className="inst-team-desc">
                Desenvolvedor front-end. Participou da construção das telas
                do Mercadins e na experiência de compra do cliente.
              </p>
            </div>
          </div>

          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">CB</span>
            <div>
              <h3>Cayo Barroso dos Santos</h3>
              <p>Desenvolvedor</p>
              <p className="inst-team-desc">
                Desenvolvedor front-end. Contribuiu com a interface do site
                e com melhorias na usabilidade do Mercadins.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="inst-section inst-legal">
        <h2>Agradecimento especial</h2>
        <p>
          A quem contribuiu de forma decisiva para a construção deste projeto,
          nosso sincero agradecimento:
        </p>

        <div className="inst-team">
          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">GD</span>
            <div>
              <h3>Professor Gustavo Del Vechio</h3>
              <p>Orientador da PI</p>
              <p className="inst-team-desc">
                Nosso orientador no Projeto Integrador: pela paciência,
                orientação e apoio do início ao fim deste projeto.
              </p>
            </div>
          </div>

          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">RC</span>
            <div>
              <h3>Raiane de Oliveira Cecilio</h3>
              <p>Agradecimento especial</p>
              <p className="inst-team-desc">
                Nosso agradecimento especial pelo apoio, incentivo e
                contribuição que foram essenciais para a construção deste
                projeto.
              </p>
            </div>
          </div>

          <div className="inst-team-card">
            <span className="inst-team-avatar" aria-hidden="true">CC</span>
            <div>
              <h3>Professor Carlos Pereira De Castro Filho</h3>
              <p>Professor de IoT e Programação Mobile</p>
              <p className="inst-team-desc">
                Nosso agradecimento especial pelas ótimas ideias e possíveis
                melhorias que trouxe para o projeto.
              </p>
            </div>
          </div>
        </div>
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
