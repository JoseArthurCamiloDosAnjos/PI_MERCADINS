//  URLs de imagem gravadas em dev local (http://localhost:3001/imagens/...) não
//  existem em produção — o arquivo só está no disco do desenvolvedor. Reescreve
//  para a URL pública do bucket Supabase (backup híbrido), que é permanente e
//  serve de qualquer rede. Idempotente: só toca nas linhas com o prefixo antigo.
const PREFIXO_ANTIGO = 'http://localhost:3001/imagens/';
const SUPABASE_PADRAO = 'https://bjraizqugvnwvfovphhh.supabase.co';

module.exports = {
  id: '026_reescrever_urls_imagens',
  descricao: 'Reescreve URLs localhost de imagens para a URL pública do Supabase (arquivos movidos para o bucket)',

  async up(sql) {
    const base = (process.env.STORAGE_URL_SUPABASE || SUPABASE_PADRAO).replace(/\/+$/, '');
    const novo = `${base}/storage/v1/object/public/imagens/`;
    const like = `${PREFIXO_ANTIGO}%`;

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
      UPDATE produtos SET imagem = replace(imagem, ${PREFIXO_ANTIGO}, ${novo})
      WHERE imagem LIKE ${like}
    `);
    await executar(() => sql`
      UPDATE mercados SET banner = replace(banner, ${PREFIXO_ANTIGO}, ${novo})
      WHERE banner LIKE ${like}
    `);
    await executar(() => sql`
      UPDATE mercados SET foto_perfil = replace(foto_perfil, ${PREFIXO_ANTIGO}, ${novo})
      WHERE foto_perfil LIKE ${like}
    `);
    await executar(() => sql`
      UPDATE usuarios SET foto_perfil = replace(foto_perfil, ${PREFIXO_ANTIGO}, ${novo})
      WHERE foto_perfil LIKE ${like}
    `);
    await executar(() => sql`
      UPDATE avaliacoes_produtos SET foto = replace(foto, ${PREFIXO_ANTIGO}, ${novo})
      WHERE foto LIKE ${like}
    `);
    await executar(() => sql`
      UPDATE posts_mercado SET imagem = replace(imagem, ${PREFIXO_ANTIGO}, ${novo})
      WHERE imagem LIKE ${like}
    `);

    // ── Colunas TEXT[] — reescreve elemento a elemento preservando a ordem ────
    await executar(() => sql`
      UPDATE produtos
      SET imagens = (
        SELECT coalesce(array_agg(replace(v, ${PREFIXO_ANTIGO}, ${novo}) ORDER BY ord), '{}'::text[])
        FROM unnest(produtos.imagens) WITH ORDINALITY AS t(v, ord)
      )
      WHERE produtos.imagens::text LIKE ${`%${PREFIXO_ANTIGO}%`}
    `);
    await executar(() => sql`
      UPDATE produtos_catalogo
      SET imagens = (
        SELECT coalesce(array_agg(replace(v, ${PREFIXO_ANTIGO}, ${novo}) ORDER BY ord), '{}'::text[])
        FROM unnest(produtos_catalogo.imagens) WITH ORDINALITY AS t(v, ord)
      )
      WHERE produtos_catalogo.imagens::text LIKE ${`%${PREFIXO_ANTIGO}%`}
    `);
  },
};
