const validarSenha = (senha) => {
  if (typeof senha !== 'string') return ['senha inválida']
  const erros = []
  if (senha.length < 8)                          erros.push('A senha deve ter pelo menos 8 caracteres')
  if (!/[A-Z]/.test(senha))                      erros.push('A senha deve conter pelo menos uma letra maiúscula')
  if (!/[a-z]/.test(senha))                      erros.push('A senha deve conter pelo menos uma letra minúscula')
  if (!/[0-9]/.test(senha))                      erros.push('A senha deve conter pelo menos um número')
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(senha))     erros.push('A senha deve conter pelo menos um caractere especial')
  return erros
}

const validarTelefone = (telefone) => {
  // ✅ código morto removido — só uma return pode existir
  const isString = typeof telefone === 'string' && telefone.trim() !== ''
  if (!isString) return false
  const numeros = telefone.replace(/\D/g, '')
  return /^[1-9]{2}[0-9]{8,9}$/.test(numeros)
}

const emailValidator = require('email-validator')
const dns = require('dns').promises

const validarEmail = async (email) => {
  if (!emailValidator.validate(email)) return false

  const dominio = email.split('@')[1]
  try {
    const registros = await Promise.race([
      dns.resolveMx(dominio),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ])
    return Array.isArray(registros) && registros.length > 0
  } catch {
    return true // timeout ou erro → aceita o email
  }
}

const validarCPF = (cpf) => {
  if (typeof cpf !== 'string') return false
  const numeros = cpf.replace(/\D/g, '')
  if (numeros.length !== 11) return false
  if (/^(\d)\1{10}$/.test(numeros)) return false

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(numeros[i]) * (10 - i)
  let resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(numeros[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(numeros[i]) * (11 - i)
  resto = (soma * 10) % 11
  if (resto === 10) resto = 0
  if (resto !== parseInt(numeros[10])) return false

  return true
}

module.exports = { validarSenha, validarEmail, validarTelefone, validarCPF }