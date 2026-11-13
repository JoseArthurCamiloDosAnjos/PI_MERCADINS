require('dotenv').config();
const { conectar } = require('../src/db/neon');

async function criarFuncao() {
  const sql = await conectar();

  await sql`
    CREATE OR REPLACE FUNCTION sem_acento(txt TEXT)
    RETURNS TEXT
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT lower(translate(
        txt,
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
      ))
    $$
  `;

  console.log('Função sem_acento() criada com sucesso!');
  process.exit(0);
}

criarFuncao().catch(err => {
  console.error('Erro ao criar função:', err.message);
  process.exit(1);
});
