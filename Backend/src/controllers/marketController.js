const { conectar } = require("../db/neon");
const express = require('express');
const router = express.Router();
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function limparMascara(valor) {
  return valor.replace(/\D/g, "");
}

function validarCNPJ(cnpj) {
  const nums = limparMascara(cnpj);
  if (nums.length !== 14) return false;
  if (/^(\d)\1+$/.test(nums)) return false;

  const calcDigito = (base, pesos) => {
    const soma = base
      .split("")
      .reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigito(nums.slice(0, 12), pesos1);
  const d2 = calcDigito(nums.slice(0, 13), pesos2);

  return parseInt(nums[12]) === d1 && parseInt(nums[13]) === d2;
}

function validarCEP(cep) {
  return /^\d{8}$/.test(limparMascara(cep));
}

function validarEmailSimples(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefone(telefone) {
  const nums = limparMascara(telefone);
  return nums.length === 10 || nums.length === 11;
}

// ─────────────────────────────────────────────
// POST /mercado — Criar novo mercado
// ─────────────────────────────────────────────

const criarMercado = async (req, res) => {
  const { nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua } =
    req.body;

  if (!nome || !email || !telefone || !cnpj || !cep || !estado || !cidade || !bairro || !rua)
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });

  if (!validarEmailSimples(email))
    return res.status(400).json({ erro: "Email inválido" });

  if (!validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });

  if (!validarCNPJ(cnpj))
    return res.status(400).json({ erro: "CNPJ inválido" });

  if (!validarCEP(cep))
    return res.status(400).json({ erro: "CEP inválido" });

  const cnpjLimpo     = limparMascara(cnpj);
  const cepLimpo      = limparMascara(cep);
  const telefoneLimpo = limparMascara(telefone);

  try {
    const sql = await conectar();

    // Verifica duplicidade de CNPJ ou email
    const existente = await sql`
      SELECT id_mercado FROM mercados
      WHERE cnpj = ${cnpjLimpo} OR email = ${email}
    `;

    if (existente.length > 0)
      return res.status(409).json({ erro: "CNPJ ou email já cadastrado" });

    const [novoMercado] = await sql`
      INSERT INTO mercados (nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua)
      VALUES (
        ${nome.trim()},
        ${email.trim().toLowerCase()},
        ${telefoneLimpo},
        ${cnpjLimpo},
        ${cepLimpo},
        ${estado.trim().toUpperCase()},
        ${cidade.trim()},
        ${bairro.trim()},
        ${rua.trim()}
      )
      RETURNING *
    `;

    res.status(201).json({
      mensagem: "Mercado criado com sucesso!",
      mercado: novoMercado,
    });
 } catch (err) {
  console.error("ERRO COMPLETO:", err);

  res.status(500).json({
    erro: err.message
  });
}
};

// ─────────────────────────────────────────────
// GET /mercado — Listar todos os mercados
// ─────────────────────────────────────────────

const listarMercados = async (req, res) => {
  try {
    const sql = await conectar();

    const mercados = await sql`
      SELECT * FROM mercados
      ORDER BY data_cadastro DESC
    `;

    res.status(200).json({ mercados });
   } catch (err) {
  console.error("ERRO COMPLETO:", err);

  res.status(500).json({
    erro: err.message
  });
}
};

// ─────────────────────────────────────────────
// GET /mercado/:id — Buscar mercado por ID
// ─────────────────────────────────────────────

const buscarMercadoPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = await conectar();

    const [mercado] = await sql`
      SELECT * FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!mercado)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    res.status(200).json({ mercado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar mercado" });
  }
};

// ─────────────────────────────────────────────
// PUT /mercado/:id — Atualizar mercado
// ─────────────────────────────────────────────

const atualizarMercado = async (req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, cnpj, cep, estado, cidade, bairro, rua } =
    req.body;

  if (email && !validarEmailSimples(email))
    return res.status(400).json({ erro: "Email inválido" });

  if (telefone && !validarTelefone(telefone))
    return res.status(400).json({ erro: "Telefone inválido" });

  if (cnpj && !validarCNPJ(cnpj))
    return res.status(400).json({ erro: "CNPJ inválido" });

  if (cep && !validarCEP(cep))
    return res.status(400).json({ erro: "CEP inválido" });

  try {
    const sql = await conectar();

    const [existente] = await sql`
      SELECT id_mercado FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    const [mercadoAtualizado] = await sql`
      UPDATE mercados SET
        nome = COALESCE(${nome?.trim()              ?? null}, nome),
        email        = COALESCE(${email?.trim().toLowerCase()      ?? null}, email),
        telefone     = COALESCE(${telefone ? limparMascara(telefone) : null}, telefone),
        cnpj         = COALESCE(${cnpj    ? limparMascara(cnpj)     : null}, cnpj),
        cep          = COALESCE(${cep     ? limparMascara(cep)      : null}, cep),
        estado       = COALESCE(${estado?.trim().toUpperCase()      ?? null}, estado),
        cidade       = COALESCE(${cidade?.trim()                    ?? null}, cidade),
        bairro       = COALESCE(${bairro?.trim()                    ?? null}, bairro),
        rua          = COALESCE(${rua?.trim()                       ?? null}, rua)
      WHERE id_mercado = ${Number(id)}
      RETURNING *
    `;

    res.status(200).json({
      mensagem: "Mercado atualizado com sucesso!",
      mercado: mercadoAtualizado,
    });
} catch (err) {
  console.error("ERRO COMPLETO:", err);

  res.status(500).json({
    erro: err.message
  });
}
};

// ─────────────────────────────────────────────
// DELETE /mercado/:id — Deletar mercado
// ─────────────────────────────────────────────

const deletarMercado = async (req, res) => {
  const { id } = req.params;

  try {
    const sql = await conectar();

    const [existente] = await sql`
      SELECT id_mercado FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    if (!existente)
      return res.status(404).json({ erro: "Mercado não encontrado" });

    await sql`
      DELETE FROM mercados
      WHERE id_mercado = ${Number(id)}
    `;

    res.status(200).json({ mensagem: "Mercado deletado com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao deletar mercado" });
  }
};

module.exports = {
  criarMercado,
  listarMercados,
  buscarMercadoPorId,
  atualizarMercado,
  deletarMercado,
};