//  URLs de imagem gravadas em dev local (http://localhost:3001/imagens/... ou
//  http://192.168.x.x:3001/imagens/...) não existem em produção — o arquivo
//  só está no disco do desenvolvedor. Reescreve para a URL pública do bucket
//  Supabase (único armazenamento permanente; o disco do Render é efêmero).
//  Idempotente: só toca nas linhas com o prefixo antigo.
//
//  Pré-requisito: rodar `node scripts/resgatar-imagens-supabase.js` antes,
//  para que os arquivos existam no bucket com o mesmo nome.
const SUPABASE_PADRAO = 'https://bjraizqugvnwvfovphhh.supabase.co';

// localhost, 127.0.0.1 ou IP 192.168.x.x na porta 3001 (porta do backend em dev)
const PADRAO_ANTIGO =
  '^https?://(localhost|127\\.0\\.0\\.1|192\\.168\\.[0-9]+(\\.[0-9]+){2}):3001/imagens/';
const LIKE_ANTIGO = '%:3001/imagens/%';

module.exports = {
  id: '027_corrigir_urls_localhost',
  descricao:
    'Reescreve URLs de imagem localhost/192.168 (dev) para a URL pública do Supabase',

  async up(sql) {
    const base = (process.env.STORAGE_URL_SUPABASE || SUPABASE_PADRAO).replace(/\/+$/, '');
    const novo = `${base}/storage/v1/object/public/imagens/`;

    // O executor só aceita valores parametrizados — tabelas/colunas ficam literais
    // no SQL. O guarda pula alvos que não existam em algum banco.
    const executar = async (rotina) => {
      try {
        await rotina();
      } catch (err) {
        if (err.code === '42P01' || err.code === '42703') {
          console.log(`  (pulado — alvo inexistente neste banco: ${err.message.split('\n')[0]})`);
          return;
        }
        throw err;
      }
    };

    // ── Colunas TEXT ──────────────────────────────────────────────────────────
    await executar(() => sql`
      UPDATE produtos SET imagem = regexp_replace(imagem, ${PADRAO_ANTIGO}, ${novo}, 'g')
      WHERE imagem ~ ${PADRAO_ANTIGO}
    `);
    await executar(() => sql`
      UPDATE mercados SET banner = regexp_replace(banner, ${PADRAO_ANTIGO}, ${novo}, 'g')
      WHERE banner ~ ${PADRAO_ANTIGO}
    `);
    await executar(() => sql`
      UPDATE mercados SET foto_perfil = regexp_replace(foto_perfil, ${PADRAO_ANTIGO}, ${novo}, 'g')
      WHERE foto_perfil ~ ${PADRAO_ANTIGO}
    `);
    await executar(() => sql`
      UPDATE usuarios SET foto_perfil = regexp_replace(foto_perfil, ${PADRAO_ANTIGO}, ${novo}, 'g')
      WHERE foto_perfil ~ ${PADRAO_ANTIGO}
    `);
    await executar(() => sql`
      UPDATE avaliacoes_produtos SET foto = regexp_replace(foto, ${PADRAO_ANTIGO}, ${novo}, 'g')
      WHERE foto ~ ${PADRAO_ANTIGO}
    `);
    await executar(() => sql`
      UPDATE posts_mercado SET imagem = regexp_replace(imagem, ${PADRAO_ANTIGO}, ${novo}, 'g')
      WHERE imagem ~ ${PADRAO_ANTIGO}
    `);

    // ── Colunas TEXT[] — reescreve elemento a elemento preservando a ordem ────
    await executar(() => sql`
      UPDATE produtos
      SET imagens = (
        SELECT coalesce(array_agg(
          CASE WHEN v ~ ${PADRAO_ANTIGO}
               THEN regexp_replace(v, ${PADRAO_ANTIGO}, ${novo}, 'g')
               ELSE v END
          ORDER BY ord), '{}'::text[])
        FROM unnest(produtos.imagens) WITH ORDINALITY AS t(v, ord)
      )
      WHERE produtos.imagens::text LIKE ${LIKE_ANTIGO}
    `);
    await executar(() => sql`
      UPDATE produtos_catalogo
      SET imagens = (
        SELECT coalesce(array_agg(
          CASE WHEN v ~ ${PADRAO_ANTIGO}
               THEN regexp_replace(v, ${PADRAO_ANTIGO}, ${novo}, 'g')
               ELSE v END
          ORDER BY ord), '{}'::text[])
        FROM unnest(produtos_catalogo.imagens) WITH ORDINALITY AS t(v, ord)
      )
      WHERE produtos_catalogo.imagens::text LIKE ${LIKE_ANTIGO}
    `);
  },
};
