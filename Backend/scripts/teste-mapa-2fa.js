//  Testa os endpoints novos: mapa e 2FA.
const BASE = 'http://localhost:3001';

async function rota(nome, path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, options);
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* não é JSON */ }
    console.log(`${nome} -> ${res.status}`, json ? JSON.stringify(json).slice(0, 300) : texto.slice(0, 200));
    return { status: res.status, json };
  } catch (err) {
    console.log(`${nome} -> FALHA ${err.message}`);
    return { status: 0, json: null };
  }
}

(async () => {
  console.log('── Mapa ──');
  await rota('GET /api/mercados', '/api/mercados');
  await rota('GET /api/mercados/proximos', '/api/mercados/proximos?lat=-21.35&lng=-48.23&raio=10');
  await rota('GET /api/mercados/proximos (sem coords)', '/api/mercados/proximos');
  await rota('GET /api/mercados/proximos (raio grande)', '/api/mercados/proximos?lat=-23.55&lng=-46.63&raio=50');

  console.log('\n── 2FA ──');
  await rota('POST /api/auth/login (inexistente)', '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'naoexiste@x.com', senha: 'abc123' }),
  });
  await rota('POST /api/auth/2fa/verificar (sem token)', '/api/auth/2fa/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  await rota('POST /api/auth/2fa/reenviar (sem token)', '/api/auth/2fa/reenviar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  await rota('POST /api/auth/2fa/verificar (token inválido)', '/api/auth/2fa/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_parcial: 'abc.def.ghi', codigo: '123456' }),
  });

  process.exit(0);
})();
