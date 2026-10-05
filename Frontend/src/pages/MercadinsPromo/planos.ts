export interface Plano {
  id: string;
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  badge: string | null;
  features: string[];
  cta: string;
}

export const PLANOS: Plano[] = [
  {
    id: "basico",
    name: "Básico",
    price: "49",
    period: "/mês",
    highlight: false,
    badge: null,
    features: [
      "Loja virtual completa",
      "Até 100 produtos",
      "Pedidos online",
      "Suporte por e-mail",
      "Domínio incluso",
    ],
    cta: "Começar agora",
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "97",
    period: "/mês",
    highlight: true,
    badge: "Mais popular",
    features: [
      "Tudo do Básico",
      "Produtos ilimitados",
      "IA para decisões de venda",
      "Relatórios de desempenho",
      "Suporte prioritário",
      "Integração WhatsApp",
    ],
    cta: "Escolher Profissional",
  },
  {
    id: "premium",
    name: "Premium",
    price: "197",
    period: "/mês",
    highlight: false,
    badge: null,
    features: [
      "Tudo do Profissional",
      "Múltiplas lojas",
      "API personalizada",
      "Gerente de conta dedicado",
      "Onboarding exclusivo",
      "SLA garantido",
    ],
    cta: "Falar com vendas",
  },
];
