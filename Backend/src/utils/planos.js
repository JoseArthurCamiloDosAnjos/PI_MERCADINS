// Limites de cada plano Mercadins.
// Fonte única de verdade no servidor: usada no cadastro de mercados,
// no cadastro de produtos e no painel do vendedor.

const LIMITES_PLANOS = {
  basico: {
    nome: 'Básico',
    produtos: 300,
    fotos: 600,
  },
  profissional: {
    nome: 'Profissional',
    produtos: 1500,
    fotos: 3000,
  },
  personalizado: {
    nome: 'Personalizado',
    produtos: 5000,
    fotos: 10000,
  },
};

// Retorna os limites do plano; valores desconhecidos caem no Básico
// (plano mais restritivo) para nunca ultrapassar o combinado.
function limitesDoPlano(plano) {
  return LIMITES_PLANOS[plano] || LIMITES_PLANOS.basico;
}

// Normaliza o plano vindo do cadastro; se não for um plano válido, usa 'basico'
function normalizarPlano(plano) {
  return Object.prototype.hasOwnProperty.call(LIMITES_PLANOS, plano) ? plano : 'basico';
}

module.exports = { LIMITES_PLANOS, limitesDoPlano, normalizarPlano };
