import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { api } from './services/api'
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
import VitrineCliente from './pages/VitrineCliente/Vitrinecliente'

function VitrineClienteWrapper() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [mercadoId, setMercadoId] = useState<number | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!slug) {
      navigate('/')
      return
    }
    api.buscarMercadoPorSlug(slug)
      .then(data => setMercadoId(data.mercado.id_mercado))
      .catch(() => navigate('/'))
      .finally(() => setCarregando(false))
  }, [slug, navigate])

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />
  if (!mercadoId) return null
  return <VitrineCliente mercadoId={mercadoId} onVoltar={() => navigate(-1)} />
}

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
      <Route path="/vitrine/:slug" element={<VitrineClienteWrapper />} />
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
