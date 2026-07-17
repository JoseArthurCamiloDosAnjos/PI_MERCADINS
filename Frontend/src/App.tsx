import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import PerfilUsuario from './pages/PerfilUsuario/PerfilUsuario'
import PerfilVendedor from './pages/PerfilVendedor/PerfilVendedor'
import GerenciamentoMercado from './pages/GerenciamentoMercado/GerenciamentoMercado'
import LoadingOverlay from './components/LoadingOverlay'
import RedefinirSenha from './pages/RedefinirSenha/RedefinirSenha'
import RegistrarMercado from './pages/RegistrarMercado/RegistrarMercado'
import MercadinsPromos from './pages/MercadinsPromo/MercadinsPromo'
import Vitrine from './pages/Vitrine/Vitrine'

function Rotas() {
  const { usuario, carregando, temMercado } = useAuth()
  const [mercadoAberto, setMercadoAberto] = useState<{ id: number; nome: string } | null>(null)
  const [vitrineAberta, setVitrineAberta] = useState(false)

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />

  if (usuario && mercadoAberto && vitrineAberta) {
    return (
      <Vitrine mercadoId={mercadoAberto.id} onVoltar={() => setVitrineAberta(false)} />
    )
  }

  if (usuario && mercadoAberto) {
    return (
      <GerenciamentoMercado
        mercadoId={mercadoAberto.id}
        onVoltar={() => setMercadoAberto(null)}
        onAbrirVitrine={() => setVitrineAberta(true)}
      />
    )
  }

  const destino = usuario ? (temMercado ? '/vendedor' : '/perfil') : '/auth'

  return (
    <Routes>
      <Route path="/"                  element={<MercadinsPromos />} />
      <Route path="/auth"              element={!usuario ? <Login />    : <Navigate to={destino} />} />
      <Route path="/auth/register"     element={!usuario ? <Register /> : <Navigate to={destino} />} />
      <Route path="/redefinir-senha"   element={<RedefinirSenha />} />
      <Route path="/perfil"            element={usuario ? <PerfilUsuario /> : <Navigate to="/auth" />} />
      <Route path="/vendedor"          element={usuario && temMercado ? <PerfilVendedor onAbrirMercado={(m) => setMercadoAberto(m)} /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
      <Route path="/registrar-mercado" element={usuario ? <RegistrarMercado /> : <Navigate to="/auth" />} />
      <Route path="*"                  element={<Navigate to={destino} />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Rotas />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
