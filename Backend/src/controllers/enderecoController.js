// ─────────────────────────────────────────────────────────────────────────────
//  Endereços de entrega do cliente (carteira de endereços)
//
//  O cliente cadastra no perfil e escolhe no carrinho qual endereço recebe
//  a entrega. Tudo ligado ao usuário logado (req.usuarioId).
//
//  Um dos endereços pode ser o PRINCIPAL: é ele que já vem marcado no
//  carrinho e no checkout. Só existe um principal por conta — trocar o
//  principal desmarca os outros.
// ─────────────────────────────────────────────────────────────────────────────

const { conectar } = require("../db/neon");

// Teto de segurança: evita que alguém encha a conta com endereços
const LIMITE_POR_USUARIO = 10;

const LIMITES = {
  cep: 9,
  rua: 120,
  numero: 10,
  bairro: 80,
  cidade: 80,
  complemento: 120,
};

const CAMPOS_OBRIGATORIOS = [
  ["cep", "CEP"],
  ["rua", "rua"],
  ["numero", "número"],
  ["bairro", "bairro"],
  ["cidade", "cidade"],
];

// Colunas devolvidas para a tela. A camada de banco só aceita valor como
// parâmetro (não texto de coluna), então o nome das colunas é escrito em
// cada consulta — todas devolvem o mesmo formato.

/** Corta espaços sobrando e derruba acentos de emoji que venham no texto */
function limpar(valor) {
  return String(valor ?? "").trim().replace(/\s+/g, " ");
}

function montarEndereco(corpo) {
  const dados = {};
  for (const campo of Object.keys(LIMITES)) {
    dados[campo] = limpar(corpo?.[campo]).slice(0, LIMITES[campo]);
  }
  return dados;
}

/** Devolve { dados } quando está tudo certo ou { erro } para a tela mostrar */
function conferir(corpo) {
  const dados = montarEndereco(corpo);

  const faltando = CAMPOS_OBRIGATORIOS.filter(([campo]) => !dados[campo]).map(
    ([, nome]) => nome
  );
  if (faltando.length > 0) {
    return { erro: `Preencha: ${faltando.join(", ")}.` };
  }

  // CEP sempre no formato 12345-678 (a tela já máscara, aqui garantimos)
  if (!/^\d{5}-\d{3}$/.test(dados.cep)) {
    return { erro: "CEP inválido. Use o formato 00000-000." };
  }

  return { dados };
}

/** Marca só o endereço escolhido como principal da conta */
async function tornarUnicoPrincipal(sql, usuarioId, id) {
  await sql`
    UPDATE enderecos_usuario
    SET principal = (id_endereco = ${id})
    WHERE id_usuario = ${usuarioId}
  `;
}

// GET /api/enderecos
// O principal vem primeiro: é ele que a tela marca por padrão.
const listarEnderecos = async (req, res) => {
  try {
    const sql = await conectar();

    const enderecos = await sql`
      SELECT id_endereco AS id, cep, rua, numero, bairro, cidade, complemento, principal
      FROM enderecos_usuario
      WHERE id_usuario = ${req.usuarioId}
      ORDER BY principal DESC, criado_em ASC, id_endereco ASC
    `;

    res.status(200).json({ enderecos });
  } catch (err) {
    console.error("ERRO listarEnderecos:", err);
    res.status(500).json({ erro: "Não foi possível carregar seus endereços." });
  }
};

// POST /api/enderecos
const criarEndereco = async (req, res) => {
  try {
    const conferido = conferir(req.body);
    if (conferido.erro) return res.status(400).json({ erro: conferido.erro });
    const dados = conferido.dados;

    const sql = await conectar();

    const total = await sql`
      SELECT COUNT(*) AS total FROM enderecos_usuario WHERE id_usuario = ${req.usuarioId}
    `;
    if (Number(total[0].total) >= LIMITE_POR_USUARIO) {
      return res.status(400).json({
        erro: `Você já tem ${LIMITE_POR_USUARIO} endereços salvos. Remova algum para cadastrar outro.`,
      });
    }

    // Primeiro endereço da conta já nasce como principal
    const criados = await sql`
      INSERT INTO enderecos_usuario
        (id_usuario, cep, rua, numero, bairro, cidade, complemento, principal)
      SELECT
        ${req.usuarioId}, ${dados.cep}, ${dados.rua}, ${dados.numero},
        ${dados.bairro}, ${dados.cidade}, ${dados.complemento},
        NOT EXISTS (
          SELECT 1 FROM enderecos_usuario WHERE id_usuario = ${req.usuarioId}
        )
      RETURNING id_endereco AS id, cep, rua, numero, bairro, cidade, complemento, principal
    `;

    res.status(201).json({ endereco: criados[0] });
  } catch (err) {
    console.error("ERRO criarEndereco:", err);
    res.status(500).json({ erro: "Não foi possível salvar o endereço." });
  }
};

// PUT /api/enderecos/:id — edita os dados (e, se pedir, também o principal)
const atualizarEndereco = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Endereço inválido." });
    }

    const conferido = conferir(req.body);
    if (conferido.erro) return res.status(400).json({ erro: conferido.erro });
    const dados = conferido.dados;

    const sql = await conectar();

    const atualizados = await sql`
      UPDATE enderecos_usuario SET
        cep = ${dados.cep},
        rua = ${dados.rua},
        numero = ${dados.numero},
        bairro = ${dados.bairro},
        cidade = ${dados.cidade},
        complemento = ${dados.complemento}
      WHERE id_endereco = ${id} AND id_usuario = ${req.usuarioId}
      RETURNING id_endereco AS id, cep, rua, numero, bairro, cidade, complemento, principal
    `;

    if (atualizados.length === 0) {
      return res.status(404).json({ erro: "Endereço não encontrado." });
    }

    if (req.body.principal === true) {
      await tornarUnicoPrincipal(sql, req.usuarioId, id);
    }

    const [final] = atualizados;
    res.status(200).json({
      endereco: { ...final, principal: req.body.principal === true ? true : final.principal },
    });
  } catch (err) {
    console.error("ERRO atualizarEndereco:", err);
    res.status(500).json({ erro: "Não foi possível atualizar o endereço." });
  }
};

// PUT /api/enderecos/:id/principal — define como endereço principal da conta
const definirPrincipal = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Endereço inválido." });
    }

    const sql = await conectar();

    const [existe] = await sql`
      SELECT 1 FROM enderecos_usuario
      WHERE id_endereco = ${id} AND id_usuario = ${req.usuarioId}
    `;
    if (!existe) return res.status(404).json({ erro: "Endereço não encontrado." });

    await tornarUnicoPrincipal(sql, req.usuarioId, id);

    const enderecos = await sql`
      SELECT id_endereco AS id, cep, rua, numero, bairro, cidade, complemento, principal
      FROM enderecos_usuario
      WHERE id_usuario = ${req.usuarioId}
      ORDER BY principal DESC, criado_em ASC, id_endereco ASC
    `;

    res.status(200).json({ ok: true, enderecos });
  } catch (err) {
    console.error("ERRO definirPrincipal:", err);
    res.status(500).json({ erro: "Não foi possível definir o endereço principal." });
  }
};

// DELETE /api/enderecos/:id
const removerEndereco = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ erro: "Endereço inválido." });
    }

    const sql = await conectar();

    // O WHERE com id_usuario garante que ninguém apague o endereço de outro
    const removidos = await sql`
      DELETE FROM enderecos_usuario
      WHERE id_endereco = ${id} AND id_usuario = ${req.usuarioId}
      RETURNING id_endereco, principal
    `;

    if (removidos.length === 0) {
      return res.status(404).json({ erro: "Endereço não encontrado." });
    }

    // Apagou o principal? O mais antigo que sobrou assume o lugar
    if (removidos[0].principal) {
      const [proximo] = await sql`
        SELECT id_endereco FROM enderecos_usuario
        WHERE id_usuario = ${req.usuarioId}
        ORDER BY criado_em ASC, id_endereco ASC
        LIMIT 1
      `;
      if (proximo) await tornarUnicoPrincipal(sql, req.usuarioId, proximo.id_endereco);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("ERRO removerEndereco:", err);
    res.status(500).json({ erro: "Não foi possível remover o endereço." });
  }
};

module.exports = {
  listarEnderecos,
  criarEndereco,
  atualizarEndereco,
  definirPrincipal,
  removerEndereco,
};
