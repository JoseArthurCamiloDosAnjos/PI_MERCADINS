//  Teste end-to-end do login com verificação em duas etapas (2FA).
//  Cria um usuário de teste, faz login, lê o código no banco e confirma.
//  Uso: node scripts/teste-2fa.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { conectar } = require('../src/db/neon');

const BASE = process.env.BASE_URL_TESTE || 'http://localhost:3001';
const EMAIL = `teste-2fa-${Date.now()}@exemplo.com`;
const SENHA = 'SenhaForte#123';

async function rota(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function post(path, body, token) {
  return rota(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  const sql = await conectar();
  let falhas = 0;

  function checar(nome, condicao, detalhe) {
    if (condicao) console.log(`  ✓ ${nome}`);
    else {
      falhas++;
      console.log(`  ✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
    }
  }

  // ── Cria usuário de teste já verificado ────────────────────────────────────
  const hash = await bcrypt.hash(SENHA, 10);
  const [novo] = await sql`
    INSERT INTO usuarios (nome, email, senha, telefone, email_verificado, status, dois_fatores)
    VALUES ('Teste 2FA', ${EMAIL}, ${hash}, '11999999999', TRUE, 'ativo', FALSE)
    RETURNING id_usuario
  `;
  console.log(`Usuário de teste criado: id ${novo.id_usuario} (${EMAIL})\n`);

  try {
    // ── 1. Login pede o código ───────────────────────────────────────────────
    console.log('── Login ──');
    const login = await post('/api/auth/login', { email: EMAIL, senha: SENHA });
    checar('login responde 200', login.status === 200, `status ${login.status}`);
    checar('retorna requer_2fa', login.json?.requer_2fa === true, JSON.stringify(login.json));
    checar('retorna token_parcial', typeof login.json?.token_parcial === 'string');
    checar('NÃO retorna token definitivo', login.json?.token === undefined);

    const tokenParcial = login.json?.token_parcial;

    // ── 2. Token parcial é de curta duração e marcado como 2fa ───────────────
    console.log('\n── Token parcial ──');
    const payload = jwt.decode(tokenParcial);
    checar('payload tem etapa 2fa', payload?.etapa === '2fa');
    checar('expira em até 11 min', payload && payload.exp - payload.iat <= 660, String(payload?.exp - payload?.iat));

    // ── 3. Código foi gravado e é de 6 dígitos ────────────────────────────────
    console.log('\n── Código ──');
    const [u1] = await sql`
      SELECT dois_fatores_codigo, dois_fatores_expiracao, dois_fatores_tentativas
      FROM usuarios WHERE id_usuario = ${novo.id_usuario}
    `;
    checar('código tem 6 dígitos', /^\d{6}$/.test(u1.dois_fatores_codigo ?? ''), String(u1.dois_fatores_codigo));
    checar('expiração definida', !!u1.dois_fatores_expiracao);
    checar('tentativas zeradas', u1.dois_fatores_tentativas === 0);

    // ── 4. Código errado é rejeitado ──────────────────────────────────────────
    console.log('\n── Código errado ──');
    const errado = await post('/api/auth/2fa/verificar', {
      token_parcial: tokenParcial,
      codigo: u1.dois_fatores_codigo === '000000' ? '111111' : '000000',
    });
    checar('rejeita código errado', errado.status === 400, `status ${errado.status}`);
    const [u2] = await sql`SELECT dois_fatores_tentativas FROM usuarios WHERE id_usuario = ${novo.id_usuario}`;
    checar('incrementa tentativa', u2.dois_fatores_tentativas === 1, String(u2.dois_fatores_tentativas));

    // ── 5. Código certo conclui o login ──────────────────────────────────────
    console.log('\n── Código certo ──');
    const certo = await post('/api/auth/2fa/verificar', {
      token_parcial: tokenParcial,
      codigo: u1.dois_fatores_codigo,
    });
    checar('responde 200', certo.status === 200, `status ${certo.status} ${JSON.stringify(certo.json)}`);
    checar('retorna token definitivo', typeof certo.json?.token === 'string');
    checar('retorna usuário', !!certo.json?.usuario?.id_usuario);
    checar('email bate', certo.json?.usuario?.email === EMAIL);
    checar('marca dois_fatores como ativo', certo.json?.usuario !== undefined);

    // ── 6. Código não pode ser reutilizado ───────────────────────────────────
    console.log('\n── Reuso de código ──');
    const reuso = await post('/api/auth/2fa/verificar', {
      token_parcial: tokenParcial,
      codigo: u1.dois_fatores_codigo,
    });
    checar('bloqueia reuso', reuso.status !== 200, `status ${reuso.status}`);

    // ── 7. Token parcial vira definitivo e serve nas rotas autenticadas ──────
    console.log('\n── Sessão ──');
    if (certo.json?.token) {
      const perfil = await rota('/api/auth/perfil', {
        headers: { Authorization: `Bearer ${certo.json.token}` },
      });
      checar('token acessa /auth/perfil', perfil.status === 200, `status ${perfil.status}`);
      checar('perfil expõe dois_fatores', perfil.json?.dois_fatores === true, JSON.stringify(perfil.json?.dois_fatores));
    }

    // ── 8. Reenviar código ───────────────────────────────────────────────────
    console.log('\n── Reenviar código ──');
    const login2 = await post('/api/auth/login', { email: EMAIL, senha: SENHA });
    const reenvio = await post('/api/auth/2fa/reenviar', { token_parcial: login2.json?.token_parcial });
    checar('reenvia com sucesso', reenvio.status === 200, `status ${reenvio.status}`);

    // ── 9. Limites de tentativas ─────────────────────────────────────────────
    console.log('\n── Limite de tentativas ──');
    const [u3] = await sql`
      SELECT dois_fatores_codigo, dois_fatores_tentativas FROM usuarios WHERE id_usuario = ${novo.id_usuario}
    `;
    const token2 = login2.json?.token_parcial;
    if (token2 && u3.dois_fatores_codigo) {
      // Força 5 tentativas erradas já usadas para disparar o bloqueio.
      await sql`
        UPDATE usuarios SET dois_fatores_tentativas = 5
        WHERE id_usuario = ${novo.id_usuario}
      `;
      const outra = u3.dois_fatores_codigo === '000000' ? '111111' : '000000';
      const bloqueio = await post('/api/auth/2fa/verificar', { token_parcial: token2, codigo: outra });
      checar('bloqueia após 5 tentativas', bloqueio.status === 429, `status ${bloqueio.status}`);
    }
  } finally {
    await sql`DELETE FROM usuarios WHERE id_usuario = ${novo.id_usuario}`;
    console.log('\nUsuário de teste removido.');
  }

  console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} TESTE(S) FALHARAM`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
