// Diagnóstico: testa o detalharPedido com um pedido real (somente leitura)
require('dotenv').config();
const { conectar } = require('../src/db/neon');
const { detalharPedido } = require('../src/controllers/pedidoController');

function fakeRes() {
  return {
    code: 200,
    status(c) { this.code = c; return this; },
    json(obj) {
      console.log('HTTP', this.code);
      console.log(JSON.stringify(obj, null, 2).slice(0, 2500));
      return this;
    },
  };
}

(async () => {
  const sql = await conectar();

  const pedidos = await sql`
    SELECT id, id_mercado, id_usuario, status FROM historico_compras
    ORDER BY id DESC LIMIT 5
  `;
  console.log('Pedidos encontrados:', pedidos.length ? pedidos : 'nenhum');
  if (!pedidos.length) process.exit(0);

  for (const p of pedidos) {
    const [dono] = await sql`
      SELECT 1 FROM usuarios_mercados
      WHERE id_mercado = ${p.id_mercado} LIMIT 1
    `;
    const [donoReal] = await sql`
      SELECT id_usuario FROM usuarios_mercados WHERE id_mercado = ${p.id_mercado} LIMIT 1
    `;
    const gestor = donoReal?.id_usuario ?? p.id_usuario;
    console.log(`\n── Pedido #${p.id} (mercado ${p.id_mercado}, status ${p.status}) — chamando como usuário ${gestor} (usuarios_mercados: ${dono ? 'sim' : 'não'})`);
    const res = fakeRes();
    try {
      await detalharPedido({ params: { id: String(p.id) }, usuarioId: gestor }, res);
    } catch (e) {
      console.log('EXCEÇÃO:', e.message);
    }
  }
  process.exit(0);
})().catch((e) => { console.error('Falha:', e.message); process.exit(1); });
