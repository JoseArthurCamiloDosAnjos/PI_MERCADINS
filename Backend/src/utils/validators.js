const validarSenha = (senha) => {
  if (typeof senha !== "string") {
    return ["senha inválida"];
  }

  const erros = [];

  if (senha.length < 8) erros.push("A senha deve ter pelo menos 8 caracteres");

  if (!/[A-Z]/.test(senha))
    erros.push("A senha deve conter pelo menos uma letra maiúscula");

  if (!/[a-z]/.test(senha))
    erros.push("A senha deve conter pelo menos uma letra minúscula");

  if (!/[0-9]/.test(senha))
    erros.push("A senha deve conter pelo menos um número");

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(senha))
    erros.push("A senha deve conter pelo menos um caractere especial");

  return erros;
};

const validarTelefone = (telefone) => {
  const isString = (v) => typeof v === "string" && v.trim() !== "";
  return isString(telefone);
  const numeros = telefone.replace(/\D/g, "");
  return /^[1-9]{2}[0-9]{8,9}$/.test(numeros);
};
const emailValidator = require("email-validator");
const dns = require("dns").promises;

const validarEmail = async (email) => {
  // 1. Valida formato básico
  if (!emailValidator.validate(email)) return false;

  // 2. Extrai o domínio e verifica MX records
  const dominio = email.split("@")[1];
  try {
    const registros = await dns.resolveMx(dominio);
    return registros && registros.length > 0;
  } catch {
    return false; // domínio inexistente ou sem servidor de email
  }
};

module.exports = { validarSenha, validarEmail, validarTelefone };
