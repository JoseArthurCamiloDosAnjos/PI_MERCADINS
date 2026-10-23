const express = require('express');
const router = express.Router();
const { conectar } = require('../db/neon');

// ─────────────────────────────────────────────────────────────────────────────
//  Sitemap dinâmico (SEO - C6): lista as páginas institucionais e a vitrine de
//  cada mercado ativo, direto do banco. Guardado em memória por 1 hora para não
//  consultar o banco a cada acesso de robô.
//  O robots.txt do frontend aponta para esta URL.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_FRONT = (process.env.FRONTEND_URL || 'https://mercadins.com.br').replace(/\/+$/, '');
const CACHE_MS = 60 * 60 * 1000; // 1 hora

let cache = { xml: null, em: 0 };

// Páginas institucionais fixas + home
const ROTAS_FIXAS = [
  { rota: '',                     changefreq: 'daily',   priority: '1.0' },
  { rota: '/promocional',         changefreq: 'monthly', priority: '0.7' },
  { rota: '/sobre',               changefreq: 'monthly', priority: '0.6' },
  { rota: '/como-funciona',       changefreq: 'monthly', priority: '0.6' },
  { rota: '/mercados-parceiros',  changefreq: 'weekly',  priority: '0.7' },
  { rota: '/atendimento',         changefreq: 'monthly', priority: '0.5' },
];

router.get('/sitemap.xml', async (req, res) => {
  if (cache.xml && Date.now() - cache.em < CACHE_MS) {
    res.type('application/xml').send(cache.xml);
    return;
  }

  try {
    const sql = await conectar();

    const mercados = await sql`
      SELECT slug, data_cadastro
      FROM mercados
      WHERE status = 'ativo' AND slug IS NOT NULL AND slug != ''
      ORDER BY id_mercado
    `;

    const agora = new Date().toISOString();
    const escapar = (texto) =>
      String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const linhas = [
      ...ROTAS_FIXAS.map((p) =>
        `  <url>\n` +
        `    <loc>${escapar(BASE_FRONT + p.rota)}</loc>\n` +
        `    <changefreq>${p.changefreq}</changefreq>\n` +
        `    <priority>${p.priority}</priority>\n` +
        `  </url>`
      ),
      ...mercados.map((m) => {
        const ultima = m.data_cadastro ? new Date(m.data_cadastro).toISOString().slice(0, 10) : agora.slice(0, 10);
        return (
          `  <url>\n` +
          `    <loc>${escapar(`${BASE_FRONT}/vitrine/${m.slug}`)}</loc>\n` +
          `    <lastmod>${ultima}</lastmod>\n` +
          `    <changefreq>daily</changefreq>\n` +
          `    <priority>0.8</priority>\n` +
          `  </url>`
        );
      }),
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `${linhas.join('\n')}\n` +
      `</urlset>\n`;

    cache = { xml, em: Date.now() };
    res.type('application/xml').send(xml);
  } catch (err) {
    console.error('ERRO sitemap.xml:', err);
    // Nunca derruba o site por causa do sitemap: devolve vazio
    res
      .status(500)
      .type('application/xml')
      .send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
  }
});

module.exports = router;
