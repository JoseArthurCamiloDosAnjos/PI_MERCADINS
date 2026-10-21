import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import PaginaInstitucional from "./Institucional";
import { IconMessage, IconMail } from "../../components/Icons";

type Pergunta = {
  pergunta: string;
  resposta: string;
  link?: { texto: string; para: string };
};

const PERGUNTAS: Pergunta[] = [
  {
    pergunta: "Como faço para comprar?",
    resposta:
      "Escolha o mercado na página inicial, adicione os produtos ao carrinho e finalize. Você pode montar o carrinho sem estar logado — o login é pedido só na hora de confirmar o pedido.",
  },
  {
    pergunta: "Meu carrinho some se eu não fizer login?",
    resposta:
      "Não. Os itens ficam salvos no seu navegador e também na sua conta. Ao entrar com sua conta, o carrinho é sincronizado automaticamente.",
  },
  {
    pergunta: "Como cadastro meu mercado no Mercadins?",
    resposta:
      "Clique em “Criar seu mercado”, escolha o plano, preencha os dados da loja e publique seus produtos. Em poucos minutos sua vitrine já está no ar.",
  },
  {
    pergunta: "Quais são os planos?",
    resposta:
      "Essencial por R$ 79/mês (até 300 produtos e 600 fotos), Plus por R$ 149/mês (até 1.500 produtos e 3.000 fotos) e Premium a partir de R$ 399/mês, com atendimento do consultor.",
    link: { texto: "Ver planos completos", para: "/promocional" },
  },
  {
    pergunta: "Esqueci minha senha, e agora?",
    resposta:
      "Na tela de login, clique em “Esqueci minha senha” e siga as instruções que chegam no seu e-mail. Se não receber, fale com o atendimento.",
  },
  {
    pergunta: "Como avalio um mercado?",
    resposta:
      "Abra a loja, clique em “Avaliar” no topo e dê de 1 a 5 estrelas. Você pode atualizar sua avaliação quando quiser — ela vale para todos os produtos do mercado.",
  },
];

export default function Atendimento() {
  const { hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const alvo = document.querySelector(hash);
    if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [key, hash]);

  return (
    <PaginaInstitucional
      titulo="Atendimento"
      subtitulo="Estamos aqui para ajudar você e seu mercado. Escolha o canal que preferir."
    >
      <section className="inst-section" id="contato">
        <h2>Fale conosco</h2>
        <div className="inst-contato-grid">
          <div className="inst-contato-card">
            <div className="inst-card-icon" style={{ margin: "0 auto" }}><IconMessage size={22} /></div>
            <h3>WhatsApp</h3>
            <p>Respostas rápidas, de segunda a sábado.</p>
            <a
              className="inst-contato-valor"
              href="https://wa.me/5516988755641"
              target="_blank"
              rel="noreferrer"
            >
              (16) 98875-5641
            </a>
          </div>

          <div className="inst-contato-card">
            <div className="inst-card-icon" style={{ margin: "0 auto" }}><IconMail size={22} /></div>
            <h3>E-mail</h3>
            <p>Para assuntos que precisam de anexos ou protocolo.</p>
            <a className="inst-contato-valor" href="mailto:Suporte@mercadins.com.br">
              Suporte@mercadins.com.br
            </a>
          </div>
        </div>
        <p style={{ color: "#9fb2d4", fontSize: 14 }}>
          Respondemos em até 1 dia útil.
        </p>
      </section>

      <section className="inst-section" id="faq">
        <h2>Perguntas frequentes</h2>
        <div className="inst-faq">
          {PERGUNTAS.map((item) => (
            <details key={item.pergunta}>
              <summary>{item.pergunta}</summary>
              <p>
                {item.resposta}{" "}
                {item.link && (
                  <Link to={item.link.para}>{item.link.texto} →</Link>
                )}
              </p>
            </details>
          ))}
        </div>
      </section>
    </PaginaInstitucional>
  );
}
