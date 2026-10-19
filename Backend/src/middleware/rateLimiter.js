const rateLimit = new Map();

function limiter(maxRequisicoes = 10, janelaMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const chave = req.ip + req.path;
    const agora = Date.now();

    if (!rateLimit.has(chave)) {
      rateLimit.set(chave, { count: 1, inicio: agora });
      return next();
      }

    const registro = rateLimit.get(chave);

    if (agora - registro.inicio > janelaMs) {
      registro.count = 1;
      registro.inicio = agora;
      return next();
    }

    registro.count++;

    if (registro.count > maxRequisicoes) {
      const segundosRestantes = Math.ceil((janelaMs - (agora - registro.inicio)) / 1000);
      return res.status(429).json({
        erro: `Muitas tentativas. Tente novamente em ${segundosRestantes} segundos.`
      });
    }

    next();
  };
}

setInterval(() => {
  const agora = Date.now();
  for (const [chave, registro] of rateLimit) {
    if (agora - registro.inicio > 30 * 60 * 1000) {
      rateLimit.delete(chave);
    }
  }
}, 10 * 60 * 1000);

module.exports = limiter;