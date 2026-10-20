import PaginaInstitucional from "./Institucional";

export default function Termos() {
  return (
    <PaginaInstitucional
      titulo="Termos de Uso"
      subtitulo="Regras de convivência e uso da plataforma Mercadins."
    >
      <section className="inst-section inst-legal">
        <p>
          Última atualização: outubro de 2026. Ao acessar ou usar o Mercadins,
          você concorda com estes Termos de Uso. Se não concordar, não utilize a
          plataforma.
        </p>

        <h2>1. Sobre o Mercadins</h2>
        <p>
          O Mercadins é uma plataforma que conecta clientes a mercados e lojas
          parceiras. Os produtos, preços, estoques e entregas são de
          responsabilidade de cada mercado cadastrado; o Mercadins intermedia a
          compra e fornece a tecnologia da vitrine, do carrinho e do painel.
        </p>

        <h2>2. Sua conta</h2>
        <p>
          Para finalizar pedidos ou cadastrar um mercado, é necessário criar uma
          conta com dados verdadeiros (nome, e-mail, CPF e telefone). Você é
          responsável por manter a senha em segurança e por todas as atividades
          realizadas em sua conta.
        </p>

        <h2>3. Uso aceitável</h2>
        <p>
          É vedado: usar a plataforma para fins ilícitos; publicar conteúdo
          ofensivo ou enganoso; tentar invadir sistemas, explorar falhas ou
          prejudicar outros usuários; e reproduzir a plataforma sem autorização.
        </p>

        <h2>4. Pedidos, preços e pagamentos</h2>
        <p>
          Os preços e a disponibilidade dos produtos são definidos por cada
          mercado e podem mudar sem aviso. O pedido só se confirma após o aceite
          do lojista. Condições de pagamento, entrega e trocas aparecem na
          vitrine de cada mercado e no momento da finalização do pedido.
        </p>

        <h2>5. Planos e assinatura</h2>
        <p>
          Mercados pagam mensalidade conforme o plano escolhido (Básico,
          Profissional ou Personalizado), com limites de produtos, fotos e
          pedidos. A assinatura é renovada automaticamente até ser cancelada e
          pode ser cancelada a qualquer momento, valendo até o fim do período
          pago.
        </p>

        <h2>6. Responsabilidades</h2>
        <p>
          O cliente e o mercado são responsáveis entre si pela compra: qualidade,
          quantidades, prazos e eventuais problemas de entrega são tratados
          diretamente com o lojista. O Mercadins não se responsabiliza por
          condutas de usuários, mas atua para manter a plataforma segura e
          disponível.
        </p>

        <h2>7. Propriedade intelectual</h2>
        <p>
          A marca, o layout e o código do Mercadins são protegidos. As fotos e
          descrições dos produtos pertencem aos mercados que as publicam.
        </p>

        <h2>8. Alterações destes termos</h2>
        <p>
          Estes termos podem ser atualizados. Mudanças relevantes serão avisadas
          na plataforma ou por e-mail. O uso continuado após a mudança significa
          que você aceita a nova versão.
        </p>

        <h2>9. Contato</h2>
        <p>
          Dúvidas sobre estes termos: Suporte@mercadins.com.br ou WhatsApp (16)
          98875-5641.
        </p>
      </section>
    </PaginaInstitucional>
  );
}
