// App.tsx
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import PerfilUsuario from './pages/PerfilUsuario'
import PerfilVendedor from './pages/PerfilVendedor'
import GerenciamentoMercado from './pages/GerenciamentoMercado'
import LoadingOverlay from './components/LoadingOverlay'
import RedefinirSenha from './pages/RedefinirSenha'
import RegistrarMercado from './pages/RegistrarMercado'

function Rotas({ tema, toggleTema }: { tema: 'escuro' | 'claro'; toggleTema: () => void }) {
  const { usuario, carregando, temMercado } = useAuth()
  const [mercadoAberto, setMercadoAberto] = useState<{ emoji: string; nome: string } | null>(null)

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />

  if (usuario && mercadoAberto) {
    return <GerenciamentoMercado onVoltar={() => setMercadoAberto(null)} />
  }

  const destino = usuario ? (temMercado ? '/vendedor' : '/perfil') : '/auth'

  return (
    <Routes>
      <Route path="/auth"              element={!usuario ? <Login />    : <Navigate to={destino} />} />
      <Route path="/auth/register"     element={!usuario ? <Register /> : <Navigate to={destino} />} />
      <Route path="/redefinir-senha"   element={<RedefinirSenha />} />
      <Route path="/perfil"            element={ usuario ? <PerfilUsuario tema={tema} toggleTema={toggleTema} /> : <Navigate to="/auth" />} />
      <Route path="/vendedor" element={ usuario && temMercado ? <PerfilVendedor onAbrirMercado={setMercadoAberto} /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
      <Route path="/registrar-mercado" element={ usuario ? <RegistrarMercado /> : <Navigate to="/auth" />} />
      <Route path="*"                  element={<Navigate to={destino} />} />
    </Routes>
  )
}

export default function App() {
  const [tema, setTema] = useState<'escuro' | 'claro'>(() => {
    return (localStorage.getItem('tema') as 'escuro' | 'claro') ?? 'escuro'
  })

  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    if (tema === 'claro') {
      root.classList.add('tema-claro')
    } else {
      root.classList.remove('tema-claro')
    }
    localStorage.setItem('tema', tema)
  }, [tema])

  const toggleTema = () => setTema(t => t === 'escuro' ? 'claro' : 'escuro')

  return (
    <BrowserRouter>
      <AuthProvider>
        <Rotas tema={tema} toggleTema={toggleTema} />
      </AuthProvider>
    </BrowserRouter>
  )
}