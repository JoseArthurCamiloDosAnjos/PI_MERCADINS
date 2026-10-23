// A3 (guarda permanente): procura no backend consultas montadas por texto
// (padrões que fogem do template marcado do Neon, o único parametrizado).
// Uso: npm run auditar-sql   → sai com código 1 se achar algo.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', 'src');
const PADROES = [
  { nome: 'query com crase (string montada)', re: /\.query\(\s*`/ },
  { nome: 'query com concatenação', re: /\.query\([^)]*\+/ },
  { nome: 'sql.unsafe', re: /sql\.unsafe/ },
  { nome: 'concatenação dentro de SQL (SELECT/INSERT/UPDATE/DELETE)', re: /(SELECT|INSERT INTO|UPDATE |DELETE FROM)[^;]*?\+\s*[a-zA-Z$]/ },
  { nome: 'ordenacao por identificador montado', re: /ORDER BY\s*[`'"]?\s*\$\{\s*(req\.|order|sort|coluna|campo)/i },
];

const arquivos = [];
(function varrer(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, item.name);
    if (item.isDirectory()) varrer(completo);
    else if (item.name.endsWith('.js')) arquivos.push(completo);
  }
})(RAIZ);

let achados = 0;
for (const arquivo of arquivos) {
  const linhas = fs.readFileSync(arquivo, 'utf8').split('\n');
  linhas.forEach((linha, i) => {
    // ignora comentários simples
    const semComentario = linha.replace(/\/\/.*$/, '');
    for (const { nome, re } of PADROES) {
      if (re.test(semComentario)) {
        achados++;
        console.log(`${path.relative(RAIZ, arquivo)}:${i + 1}  [${nome}]`);
        console.log(`   ${semComentario.trim().slice(0, 140)}`);
      }
    }
  });
}

if (achados === 0) {
  console.log(`Auditoria de SQL: OK — ${arquivos.length} arquivos verificados, nenhuma consulta montada por texto.`);
} else {
  console.log(`\nAuditoria de SQL: ${achados} ponto(s) para revisar. O padrão seguro é o template marcado: sql\`... \${valor} ...\``);
  process.exitCode = 1;
}
