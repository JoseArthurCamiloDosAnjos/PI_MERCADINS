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

module.exports = { validarSenha, validarEmail, validarTelefone }