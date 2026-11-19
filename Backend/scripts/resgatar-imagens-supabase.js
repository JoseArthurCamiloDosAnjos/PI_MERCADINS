//  Resgata imagens locais para o bucket público do Supabase Storage.
//
//  Por que existe: uploads feitos em dev gravavam http://localhost:3001/...
//  no banco de produção e o disco do Render é efêmero (imagens somem a cada
//  redeploy). O bucket Supabase é o único lugar permanente.
//
//  Uso:  node scripts/resgatar-imagens-supabase.js
//
//  Idempotente: pula arquivos que já existem no bucket (HTTP 200 no HEAD).
//  Precisa das chaves VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (lidas de
//  Frontend/.env.local, Frontend/.env ou do ambiente).
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PASTA_IMAGENS = path.join(RAIZ, 'imagens');
const BUCKET = 'imagens';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function lerEnvFrontend() {
  const valores = {};
  for (const arquivo of [
    path.join(RAIZ, '..', 'Frontend', '.env.local'),
    path.join(RAIZ, '..', 'Frontend', '.env'),
  ]) {
    if (!fs.existsSync(arquivo)) continue;
    for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in valores)) valores[m[1]] = m[2];
    }
  }
  return valores;
}

function listarArquivos(dir, base = '') {
  if (!fs.existsSync(dir)) return [];
  const saida = [];
  for (const nome of fs.readdirSync(dir)) {
    const cheio = path.join(dir, nome);
    const rel = base ? `${base}/${nome}` : nome;
    if (fs.statSync(cheio).isDirectory()) {
      // Miniaturas não são usadas pelo Supabase (thumbUrl pula URLs de lá).
      if (nome === 'thumbs') continue;
      saida.push(...listarArquivos(cheio, rel));
    } else {
      saida.push({ absoluto: cheio, relativo: rel });
    }
  }
  return saida;
}

async function existeNoBucket(baseSupabase, anon, caminho) {
  const url = `${baseSupabase}/storage/v1/object/public/${BUCKET}/${caminho}`;
  const res = await fetch(url, { method: 'HEAD' });
  return res.ok;
}

async function enviarParaBucket(baseSupabase, anon, caminho, arquivo) {
  const ext = path.extname(caminho).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const res = await fetch(`${baseSupabase}/storage/v1/object/${BUCKET}/${caminho}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
      'Content-Type': mime,
      'x-upsert': 'false',
    },
    body: fs.readFileSync(arquivo),
  });
  if (!res.ok) {
    const corpo = (await res.text()).slice(0, 300);
    const erro = new Error(`HTTP ${res.status}: ${corpo}`);
    erro.status = res.status;
    throw erro;
  }
  return true;
}

async function main() {
  const env = lerEnvFrontend();
  const baseSupabase = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  if (!baseSupabase || !anon) {
    console.error('FALHA: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não encontradas.');
    console.error('       Defina no ambiente ou em Frontend/.env');
    process.exit(1);
  }

  const arquivos = listarArquivos(PASTA_IMAGENS);
  if (arquivos.length === 0) {
    console.log('Nenhuma imagem local encontrada em Backend/imagens — nada a resgatar.');
    return;
  }

  console.log(`Bucket: ${BUCKET} em ${baseSupabase}`);
  console.log(`Arquivos locais: ${arquivos.length}\n`);

  let enviados = 0;
  let jaExistiam = 0;
  let falhas = 0;

  for (const { absoluto, relativo } of arquivos) {
    const destino = `${BUCKET}/${relativo}`;
    try {
      if (await existeNoBucket(baseSupabase, anon, relativo)) {
        console.log(`  = já existe  ${destino}`);
        jaExistiam += 1;
        continue;
      }
      await enviarParaBucket(baseSupabase, anon, relativo, absoluto);
      console.log(`  + enviado    ${destino}`);
      enviados += 1;
    } catch (err) {
      falhas += 1;
      console.error(`  ! FALHOU     ${destino}`);
      console.error(`      ${err.message}`);
      if (err.status === 400 || err.status === 403) {
        console.error(
          '\nO Supabase recusou o envio. Libere a política de INSERT para a chave anônima:\n' +
            '  Dashboard → Storage → Policies → nova política no bucket "imagens":\n' +
            '    USING (true) / WITH CHECK (true)  para "anon" (INSERT)\n' +
            'Ou rode o script com VITE_SUPABASE_ANON_KEY de uma service role key.'
        );
        process.exit(1);
      }
    }
  }

  console.log(`\nResumo: ${enviados} enviado(s), ${jaExistiam} já existiam, ${falhas} falha(s).`);
  if (falhas > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Erro no resgate:', err.message);
  process.exit(1);
});
