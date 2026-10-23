import PaginaInstitucional from "./Institucional";

export default function Privacidade() {
  return (
    <PaginaInstitucional
      titulo="Política de privacidade"
      subtitulo="Como coletamos, usamos e protegemos seus dados pessoais, na linguagem simples."
    >
      <section className="inst-section inst-legal">
        <p>
          Última atualização: outubro de 2026. Esta política explica o que
          acontece com os dados que você informa no Mercadins, em conformidade
          com a Lei Geral de Proteção de Dados (LGPD).
        </p>

        <h2>1. Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail, CPF, telefone e senha
            (guardada de forma protegida, ilegível).
          </li>
          <li>
            <strong>Entrega:</strong> endereço e CEP informados para receber os
            pedidos.
          </li>
          <li>
            <strong>Compras:</strong> itens pedidos, mercados, valores e
            histórico de pedidos.
          </li>
          <li>
            <strong>Uso da plataforma:</strong> preferências salvas no
            navegador (como o carrinho e o estado de login) — veja a
            Política de Cookies.
          </li>
        </ul>

        <h2>2. Para que usamos seus dados</h2>
        <ul>
          <li>Criar e manter sua conta;</li>
          <li>Processar e entregar seus pedidos;</li>
          <li>Mostrar seu nome e suas avaliações para outros clientes;</li>
          <li>Enviar avisos do seu pedido ou da sua conta;</li>
          <li>Prevenir fraudes e melhorar a plataforma.</li>
        </ul>

        <h2>3. Com quem compartilhamos</h2>
        <p>
          Seus dados de pedido (nome, itens e endereço de entrega) são enviados
          ao mercado em que você comprou, para que ele possa separar e entregar.
          Não vendemos seus dados a terceiros.
        </p>

        <h2>4. Segurança</h2>
        <p>
          Os dados são trafegados em conexão criptografada (HTTPS) e armazenados
          em servidores protegidos. A senha nunca é guardada em texto puro.
        </p>

        <h2>5. Seus direitos (LGPD)</h2>
        <p>
          Você pode pedir a qualquer momento: acesso aos seus dados, correção de
          informações desatualizadas, exclusão da conta e dos dados, e revogação
          de consentimentos. Basta pedir pelo e-mail Suporte@mercadins.com.br —
          respondemos em até 1 dia útil.
        </p>

        <h2>6. Retenção</h2>
        <p>
          Dados de conta ficam enquanto a conta existir. Pedidos e notas fiscais
          podem ser mantidos por obrigação legal mesmo após a exclusão da conta.
        </p>

        <h2>7. Contato</h2>
        <p>
          Encarregado de dados: Suporte@mercadins.com.br · WhatsApp (16)
          98875-5641.
        </p>
      </section>
    </PaginaInstitucional>
  );
}
