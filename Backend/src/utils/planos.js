// Limites de cada plano Mercadins.
// Fonte única de verdade no servidor: usada no cadastro de mercados,
// no cadastro de produtos e no painel do vendedor.

// Nomes comerciais: Essencial (entrada) → Plus (crescimento) → Personalizado
// (rede e consultoria). As chaves ('basico' etc.) são as gravadas no banco
// e não mudam.
const LIMITES_PLANOS = {
  basico: {
    nome: 'Essencial',
    produtos: 300,
    fotos: 600,
  },
  profissional: {
    nome: 'Plus',
    produtos: 1500,
    fotos: 3000,
  },
  personalizado: {
    nome: 'Personalizado',
    produtos: 5000,
    fotos: 10000,
  },
};

// Retorna os limites do plano; valores desconhecidos caem no Essencial
// (plano mais restritivo) para nunca ultrapassar o combinado.
function limitesDoPlano(plano) {
  return LIMITES_PLANOS[plano] || LIMITES_PLANOS.basico;
}

// Normaliza o plano vindo do cadastro; se não for um plano válido, usa 'basico'
function normalizarPlano(plano) {
  return Object.prototype.hasOwnProperty.call(LIMITES_PLANOS, plano) ? plano : 'basico';
}

module.exports = { LIMITES_PLANOS, limitesDoPlano, normalizarPlano };
