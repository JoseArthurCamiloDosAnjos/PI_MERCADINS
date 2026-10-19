export interface Plano {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  badge: string | null;
  features: string[];
  cta: string;
  /** Plano sem preço fixo: valor cotado caso a caso pelo consultor. */
  sobConsulta?: boolean;
  /** Preço mínimo exibido como "a partir de R$ X/mês". */
  aPartirDe?: string;
}

export const PLANOS: Plano[] = [
  {
    id: "basico",
    name: "Básico",
    price: "79",
    period: "/mês",
    highlight: false,
    badge: null,
    features: [
      "1 loja com até 300 produtos",
      "Até 100 pedidos por mês",
      "2 operadores e 600 fotos",
      "Avaliações de clientes",
      "Domínio próprio incluso",
      "Suporte por e-mail em 48h",
    ],
    cta: "Começar agora",
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "149",
    period: "/mês",
    highlight: true,
    badge: "Mais popular",
    features: [
      "Tudo do Básico, com mais:",
      "Até 1.500 produtos e 3.000 fotos",
      "Até 500 pedidos por mês e 6 operadores",
      "Cupons e promoções ativos",
      "Relatórios avançados e alertas de estoque",
      "Integração com WhatsApp e suporte em 24h",
    ],
    cta: "Escolher Profissional",
  },
  {
    id: "personalizado",
    name: "Personalizado",
    price: "399",
    period: "/mês",
    highlight: false,
    badge: null,
    sobConsulta: true,
    aPartirDe: "399",
    features: [
      "Tudo do Profissional, com mais:",
      "Até 5 lojas com painel consolidado",
      "Até 5.000 produtos e 10.000 fotos",
      "Gerente de conta dedicado no WhatsApp",
      "Implantação assistida e migração inclusa",
      "0% de comissão nas vendas",
    ],
    cta: "Falar com um consultor",
  },
];
