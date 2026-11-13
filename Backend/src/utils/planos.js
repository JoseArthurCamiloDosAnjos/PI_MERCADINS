
const LIMITES_PLANOS = {
  basico: {
    nome: 'Essencial',
    produtos: 300,
    fotos: 600,
    pedidosMes: 100,
    cupons: false,
  },
  profissional: {
    nome: 'Plus',
    produtos: 1500,
    fotos: 3000,
    pedidosMes: 500,
    cupons: true,
  },
  personalizado: {
    nome: 'Personalizado',
    produtos: 5000,
    fotos: 10000,
    pedidosMes: 5000,
    cupons: true,
  },
};

function limitesDoPlano(plano) {
  return LIMITES_PLANOS[plano] || LIMITES_PLANOS.basico;
}

function normalizarPlano(plano) {
  return Object.prototype.hasOwnProperty.call(LIMITES_PLANOS, plano) ? plano : 'basico';
}

module.exports = { LIMITES_PLANOS, limitesDoPlano, normalizarPlano };
