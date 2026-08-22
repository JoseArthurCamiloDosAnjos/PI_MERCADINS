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
import VitrineCliente from './pages/VitrineCliente/VitrineCliente'
import ProdutoTelaContainer from './pages/ProdutoTela/ProdutoTelaContainer'
import CartScreen from './pages/Carrrinho/Cart'
import { useCarrinho } from './hooks/useCarrinho'
import { useToast } from './hooks/useToast'
import ToastContainer from './components/Toast'

// ─── Wrapper: resolve slug -> mercadoId e renderiza a vitrine do cliente ───────

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
  return <VitrineCliente mercadoId={mercadoId} slug={slug} onVoltar={() => navigate(-1)} />
}

// ─── Wrapper: resolve slug -> mercadoId e renderiza a tela cheia do produto ────

function ProdutoTelaWrapper() {
  const { slug, categoriaId, produtoId } = useParams<{ slug: string; categoriaId: string; produtoId: string }>()
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
  if (!mercadoId || !categoriaId || !produtoId) return null

  return (
    <ProdutoTelaContainer
      mercadoId={mercadoId}
      categoriaId={Number(categoriaId)}
      produtoId={Number(produtoId)}
      onVoltar={() => navigate(-1)}
      onAbrirCarrinho={() => navigate(`/vitrine/${slug}`)}
      onAbrirProduto={(catId, prodId) => navigate(`/vitrine/${slug}/produto/${catId}/${prodId}`)}
    />
  )
}

// ─── Wrapper: resolve slug -> mercadoId e renderiza a tela de carrinho ───────

function CartWrapper() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [mercadoId, setMercadoId] = useState<number | null>(null)
  const [mercadoNome, setMercadoNome] = useState<string>('')
  const [carregando, setCarregando] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const { toasts, showToast, dismissToast } = useToast()
  const carrinho = useCarrinho(mercadoId ?? 0)

  useEffect(() => {
    if (!slug) {
      navigate('/')
      return
    }
    api.buscarMercadoPorSlug(slug)
      .then(data => {
        setMercadoId(data.mercado.id_mercado)
        setMercadoNome(data.mercado.nome)
      })
      .catch(() => navigate('/'))
      .finally(() => setCarregando(false))
  }, [slug, navigate])

  const itensConvertidos = carrinho.itens.map(item => ({
    id: String(item.produto.id_produto),
    name: item.produto.nome,
    category: String(item.produto.id_categoria),
    unitPrice: Number(item.produto.preco ?? 0),
    quantity: item.quantidade,
    imageUrl: item.produto.imagem ?? item.produto.imagens?.[0] ?? '',
  }))

  async function handleCheckout() {
    if (!mercadoId) return
    setFinalizando(true)
    try {
      await api.criarPedido(mercadoId, {
        itens: carrinho.itens.map(i => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade })),
      })
      showToast('sucesso', 'Pedido enviado com sucesso!')
      carrinho.limpar()
      navigate(`/vitrine/${slug}`)
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao enviar pedido.')
    } finally {
      setFinalizando(false)
    }
  }

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />
  if (!mercadoId) return null

  return (
    <>
      <CartScreen
        storeName={mercadoNome}
        initialItems={itensConvertidos}
        onBack={() => navigate(`/vitrine/${slug}`)}
        onCheckout={handleCheckout}
        finalizando={finalizando}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

// ─── Rotas ──────────────────────────────────────────────────────────────────

function Rotas() {
  const { usuario, carregando, temMercado } = useAuth()
  const [mercadoAberto, setMercadoAberto] = useState<{ id: number; nome: string } | null>(() => {
    try {
      const salvo = localStorage.getItem('mercadoAberto')
      return salvo ? JSON.parse(salvo) : null
    } catch { return null }
  })
  const [vitrineAberta, setVitrineAberta] = useState(() => {
    try {
      return localStorage.getItem('vitrineAberta') === 'true'
    } catch { return false }
  })

  function handleSetMercadoAberto(valor: { id: number; nome: string } | null) {
    setMercadoAberto(valor)
    if (valor) localStorage.setItem('mercadoAberto', JSON.stringify(valor))
    else localStorage.removeItem('mercadoAberto')
  }

  function handleSetVitrineAberta(valor: boolean) {
    setVitrineAberta(valor)
    localStorage.setItem('vitrineAberta', String(valor))
  }

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />

  if (usuario && mercadoAberto && vitrineAberta) {
    return (
      <Vitrine mercadoId={mercadoAberto.id} onVoltar={() => handleSetVitrineAberta(false)} />
    )
  }

  if (usuario && mercadoAberto) {
    return (
      <GerenciamentoMercado
        mercadoId={mercadoAberto.id}
        onVoltar={() => handleSetMercadoAberto(null)}
        onAbrirVitrine={() => handleSetVitrineAberta(true)}
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
      <Route path="/vendedor"          element={usuario && temMercado ? <PerfilVendedor onAbrirMercado={(m) => handleSetMercadoAberto(m)} /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
      <Route path="/registrar-mercado" element={usuario ? <RegistrarMercado /> : <Navigate to="/auth" />} />
      <Route path="/vitrine/:slug"                                    element={<VitrineClienteWrapper />} />
      <Route path="/vitrine/:slug/carrinho"                           element={<CartWrapper />} />
      <Route path="/vitrine/:slug/produto/:categoriaId/:produtoId"    element={<ProdutoTelaWrapper />} />
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