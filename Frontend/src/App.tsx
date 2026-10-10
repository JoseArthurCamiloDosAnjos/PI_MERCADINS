import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { api } from './services/api'
import LoadingOverlay from './components/LoadingOverlay'
import { useCarrinho } from './hooks/useCarrinho'
import { useToast } from './hooks/useToast'
import ToastContainer from './components/Toast'

const Login = lazy(() => import('./pages/Login/Login'))
const Register = lazy(() => import('./pages/Register/Register'))
const PerfilUsuario = lazy(() => import('./pages/PerfilUsuario/PerfilUsuario'))
const PerfilVendedor = lazy(() => import('./pages/PerfilVendedor/PerfilVendedor'))
const GerenciamentoMercado = lazy(() => import('./pages/GerenciamentoMercado/GerenciamentoMercado'))
const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha/RedefinirSenha'))
const VerificarEmail = lazy(() => import('./pages/VerificarEmail/VerificarEmail'))
const RegistrarMercado = lazy(() => import('./pages/RegistrarMercado/RegistrarMercado'))
const MercadinsPromos = lazy(() => import('./pages/MercadinsPromo/MercadinsPromo'))
const SelecionarPlano = lazy(() => import('./pages/SelecionarPlano/SelecionarPlano'))
const Vitrine = lazy(() => import('./pages/Vitrine/Vitrine'))
const VitrineCliente = lazy(() => import('./pages/VitrineCliente/VitrineCliente'))
const ProdutoTelaContainer = lazy(() => import('./pages/ProdutoTela/ProdutoTelaContainer'))
const CartScreen = lazy(() => import('./pages/Carrinho/Cart'))
const Administrador = lazy(() => import('./pages/Adimin/adiministrador'))
const MenuPrincipal = lazy(() => import('./pages/MenuPrincipal/MenuPrincipal'))
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

// ─── Wrapper: resolve mercadoId da URL e renderiza o gerenciamento ────────────

function GerenciamentoMercadoWrapper() {
  const { mercadoId } = useParams<{ mercadoId: string }>()
  const navigate = useNavigate()
  const id = Number(mercadoId)

  useEffect(() => {
    if (!id || Number.isNaN(id)) navigate('/vendedor')
  }, [id, navigate])

  if (!id || Number.isNaN(id)) return null

  return (
    <GerenciamentoMercado
      mercadoId={id}
      onVoltar={() => navigate('/vendedor')}
      onAbrirVitrine={() => navigate(`/vendedor/mercado/${id}/vitrine`)}
    />
  )
}

// ─── Wrapper: resolve mercadoId da URL e renderiza a vitrine do vendedor ──────

function VitrineVendedorWrapper() {
  const { mercadoId } = useParams<{ mercadoId: string }>()
  const navigate = useNavigate()
  const id = Number(mercadoId)

  useEffect(() => {
    if (!id || Number.isNaN(id)) navigate('/vendedor')
  }, [id, navigate])

  if (!id || Number.isNaN(id)) return null

  return <Vitrine mercadoId={id} onVoltar={() => navigate(`/vendedor/mercado/${id}`)} />
}

// ─── Rotas ──────────────────────────────────────────────────────────────────

function Rotas() {
  const { usuario, carregando, temMercado } = useAuth()
  const destino = usuario ? '/' : '/auth'

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />

  return (
    <Suspense fallback={<LoadingOverlay mensagem="Carregando..." />}>
      <Routes>
        <Route path="/"                  element={<MenuPrincipal/>} />
        <Route path="/promocional"       element={<MercadinsPromos />}/>
        <Route path="/auth"              element={!usuario ? <Login />    : <Navigate to="/" />} />
        <Route path="/auth/register"     element={!usuario ? <Register /> : <Navigate to={destino} />} />
        <Route path="/redefinir-senha"   element={<RedefinirSenha />} />
        <Route path="/verificar-email"   element={<VerificarEmail />} />
        <Route path="/perfil"            element={usuario ? <PerfilUsuario /> : <Navigate to="/auth" />} />
        <Route path="/vendedor"          element={usuario && temMercado ? <PerfilVendedor /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
        <Route path="/vendedor/mercado/:mercadoId"         element={usuario && temMercado ? <GerenciamentoMercadoWrapper /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
        <Route path="/vendedor/mercado/:mercadoId/vitrine" element={usuario && temMercado ? <VitrineVendedorWrapper /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
        <Route path="/registrar-mercado" element={usuario ? <RegistrarMercado /> : <Navigate to="/auth" />} />
        <Route path="/planos"            element={usuario?.is_admin ? <Navigate to="/registrar-mercado" /> : <SelecionarPlano />} />
        <Route path="/vitrine/:slug"                                    element={<VitrineClienteWrapper />} />
        <Route path="/vitrine/:slug/carrinho"                           element={<CartWrapper />} />
        <Route path="/vitrine/:slug/produto/:categoriaId/:produtoId"    element={<ProdutoTelaWrapper />} />
        <Route path="/admin"             element={usuario?.is_admin ? <Administrador /> : <Navigate to={destino} />} />
        <Route path="*"                  element={<Navigate to={destino} />} />
      </Routes>
    </Suspense>
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