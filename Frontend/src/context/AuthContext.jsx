import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.perfil()
        .then(setUsuario)
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setCarregando(false))
    } else {
      setCarregando(false)
    }
  }, [])

  async function login(email, senha) {
    const { usuario, token } = await api.login({ email, senha })
    localStorage.setItem('token', token)
    setUsuario(usuario)
    return usuario
  }

  async function register(nome, email, senha, telefone) {
    const { usuario, token } = await api.register({ nome, email, senha, telefone })
    localStorage.setItem('token', token)
    setUsuario(usuario)
    return usuario
  }

  async function atualizar(dados) {
    const atualizado = await api.atualizar(dados)
    setUsuario(atualizado)
    return atualizado
  }

  function logout() {
    localStorage.removeItem('token')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, login, register, atualizar, logout, carregando }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)