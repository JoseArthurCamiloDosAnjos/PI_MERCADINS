import PaginaInstitucional from "./Institucional";

export default function Privacidade() {
  return (
    <PaginaInstitucional
      titulo="Política de privacidade"
      subtitulo="Como coletamos, usamos e protegemos seus dados pessoais, na linguagem simples."
    >
      <section className="inst-section inst-legal">
        <p>
          Última atualização: novembro de 2026. Esta política explica o que
          acontece com os dados que você informa no Mercadins, em conformidade
          com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018) e com o
          Código de Defesa do Consumidor. Ao criar a conta, você aceita estas
          regras. O aceite fica registrado com data, hora, versão do texto e IP.
        </p>

        <h2>1. Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Cadastro de cliente:</strong> nome, e-mail, CPF, telefone,
            data de nascimento e senha (guardada de forma protegida, ilegível).
          </li>
          <li>
            <strong>Cadastro de mercado:</strong> nome do mercado, e-mail,
            telefone, CNPJ, endereço, descrição, categorias e horário de
            funcionamento.
          </li>
          <li>
            <strong>Entrega:</strong> endereço e CEP informados para receber os
            pedidos, incluindo o endereço principal escolhido por você.
          </li>
          <li>
            <strong>Compras:</strong> itens pedidos, mercados, valores, forma de
            pagamento, status e histórico de pedidos.
          </li>
          <li>
            <strong>Localização:</strong> quando você toca em "Usar minha
            localização", o navegador pede autorização e envia as coordenadas
            para descobrir o CEP e o endereço aproximado. Sem a sua autorização,
            nada é enviado; você pode digitar o CEP manualmente.
          </li>
          <li>
            <strong>Uso da plataforma:</strong> preferências salvas no
            navegador (como o carrinho e o estado de login) — veja a Política de
            Cookies.
          </li>
        </ul>

        <h2>2. Para que usamos seus dados</h2>
        <ul>
          <li>Criar, manter e proteger sua conta;</li>
          <li>Processar, cobrar e entregar seus pedidos;</li>
          <li>Enviar avisos da conta e do pedido pelo telefone cadastrado;</li>
          <li>Mostrar seu nome e suas avaliações para outros clientes;</li>
          <li>Prestar atendimento e resolver problemas;</li>
          <li>Prevenir fraudes, cumprir obrigações legais e melhorar a plataforma.</li>
        </ul>

        <h2>3. Bases legais (LGPD)</h2>
        <p>
          Tratamos dados para executar o contrato de compra e uso da plataforma
          (art. 7º, V), cumprir obrigações legais, como guarda de notas fiscais
          (art. 7º, II), atender interesses legítimos de segurança e prevenção a
          fraudes (art. 7º, IX) e, quando necessário, com o seu consentimento
          (art. 7º, I). Você pode revogar o consentimento a qualquer momento,
          sem prejuízo dos usos já realizados.
        </p>

        <h2>4. Avisos pelo telefone</h2>
        <p>
          O telefone informado no cadastro é usado para avisos operacionais:
          confirmação de cadastro, confirmação de e-mail, criação do mercado e
          andamento do pedido (recebido, em preparo, saiu para entrega, entregue
          ou cancelado). Esses avisos fazem parte do serviço contratado. Não
          enviamos propaganda sem o seu consentimento e você pode pedir para não
          receber avisos não essenciais pelo e-mail Suporte@mercadins.com.br.
        </p>

        <h2>5. Com quem compartilhamos</h2>
        <p>
          Seus dados de pedido (nome, itens, telefone e endereço de entrega) são
          enviados ao mercado em que você comprou, para que ele possa separar,
          entregar e entrar em contato. Também usamos empresas especializadas
          para processar pagamentos, enviar e-mails e hospedar a plataforma, que
          tratam os dados apenas para essas finalidades. Não vendemos seus dados
          a terceiros.
        </p>
        <p>
          Alguns desses fornecedores podem manter servidores fora do Brasil. A
          transferência segue as regras da LGPD e é feita apenas para prestadores
          com medidas de segurança adequadas.
        </p>

        <h2>6. Segurança</h2>
        <p>
          Os dados são trafegados em conexão criptografada (HTTPS) e armazenados
          em servidores protegidos. A senha nunca é guardada em texto puro. O
          acesso interno é limitado às pessoas que precisam dele para operar a
          plataforma. Em caso de incidente de segurança relevante, comunicaremos
          os titulares e a Autoridade Nacional de Proteção de Dados (ANPD) nos
          prazos legais.
        </p>

        <h2>7. Por quanto tempo guardamos</h2>
        <p>
          Dados de conta ficam enquanto a conta existir. Pedidos, notas fiscais
          e registros de acesso podem ser mantidos por obrigação legal mesmo
          após a exclusão da conta. Depois do prazo legal, os dados são
          eliminados ou anonimizados.
        </p>

        <h2>8. Seus direitos (LGPD)</h2>
        <p>
          Você pode pedir a qualquer momento: confirmação de que tratamos seus
          dados; acesso aos dados; correção de informações desatualizadas;
          anonimização, bloqueio ou eliminação de dados desnecessários;
          portabilidade; eliminação dos dados tratados com consentimento;
          informação sobre compartilhamentos; e revogação do consentimento.
        </p>
        <p>
          Basta pedir pelo e-mail Suporte@mercadins.com.br. Respondemos em até 1
          dia útil e podemos pedir uma confirmação de identidade para proteger
          seus dados. Se não ficar satisfeito, você pode reclamar à ANPD.
        </p>

        <h2>9. Crianças e adolescentes</h2>
        <p>
          A plataforma é destinada a maiores de 18 anos. Menores só podem usar
          com autorização e acompanhamento de um responsável legal, que responde
          pelos dados informados.
        </p>

        <h2>10. Cookies e preferências</h2>
        <p>
          Usamos cookies e armazenamento local para manter o login, o carrinho,
          o tema e o aviso de cookies. Você pode limpar esses dados no navegador,
          mas algumas funções deixam de funcionar. Detalhes na Política de
          Cookies.
        </p>

        <h2>11. Contato do encarregado de dados</h2>
        <p>
          Encarregado de dados (DPO): Suporte@mercadins.com.br · WhatsApp (16)
          98875-5641.
        </p>
      </section>
    </PaginaInstitucional>
  );
}
