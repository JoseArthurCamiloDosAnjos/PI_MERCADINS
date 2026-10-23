import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { api } from './services/api'
import LoadingOverlay from './components/LoadingOverlay'
import ControleRotas from './components/ControleRotas'
import { useCarrinho } from './hooks/useCarrinho'
import { useToast } from './hooks/useToast'
import ToastContainer from './components/Toast'
import CookieBanner from './components/CookieBanner/CookieBanner'

const Login = lazy(() => import('./pages/Login/Login'))
const PaginaNaoEncontrada = lazy(() => import('./pages/PaginaNaoEncontrada/PaginaNaoEncontrada'))
const Register = lazy(() => import('./pages/Register/Register'))
const PerfilUsuario = lazy(() => import('./pages/PerfilUsuario/PerfilUsuario'))
const Favoritos = lazy(() => import('./pages/Favoritos/Favoritos'))
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

const Sobre = lazy(() => import('./pages/Institucional/Sobre'))
const ComoFunciona = lazy(() => import('./pages/Institucional/ComoFunciona'))
const MercadosParceiros = lazy(() => import('./pages/Institucional/MercadosParceiros'))
const Atendimento = lazy(() => import('./pages/Institucional/Atendimento'))
const Termos = lazy(() => import('./pages/Institucional/Termos'))
const Privacidade = lazy(() => import('./pages/Institucional/Privacidade'))
const Cookies = lazy(() => import('./pages/Institucional/Cookies'))
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
  return <VitrineCliente mercadoId={mercadoId} slug={slug} onVoltar={() => navigate('/')} />
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
      onAbrirCarrinho={() => navigate(`/vitrine/${slug}/carrinho`)}
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
  const [mercadoLocal, setMercadoLocal] = useState<string>('')
  // Regras de entrega do mercado (B2) — vêm do cadastro da loja
  const [taxaEntrega, setTaxaEntrega] = useState<number>(0)
  const [pedidoMinimo, setPedidoMinimo] = useState<number>(0)
  const [ofereceEntrega, setOfereceEntrega] = useState<boolean>(true)
  const [ofereceRetirada, setOfereceRetirada] = useState<boolean>(true)
  // Estado do carrinho: como receber, cupom e agendamento (B2/B3/B10)
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada'>('entrega')
  const [cupom, setCupom] = useState<{ codigo: string; desconto: number } | null>(null)
  const [verificandoCupom, setVerificandoCupom] = useState(false)
  const [agendamento, setAgendamento] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [observacao, setObservacao] = useState('')
  const { toasts, showToast, dismissToast } = useToast()
  const carrinho = useCarrinho(mercadoId ?? 0)

  useEffect(() => {
    if (!slug) {
      navigate('/')
      return
    }
    api.buscarMercadoPorSlug(slug)
      .then(data => {
        const m = data.mercado
        setMercadoId(m.id_mercado)
        setMercadoNome(m.nome)
        setMercadoLocal([m.cidade, m.estado].filter(Boolean).join(' · '))
        setTaxaEntrega(Number(m.taxa_entrega) || 0)
        setPedidoMinimo(Number(m.pedido_minimo) || 0)
        setOfereceEntrega(m.oferece_entrega !== false)
        setOfereceRetirada(m.oferece_retirada !== false)
        // Mercado só faz entrega? já nasce em "entrega"; só retira? em "retirada"
        if (m.oferece_entrega === false && m.oferece_retirada !== false) {
          setTipoEntrega('retirada')
        }
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
    estoque: item.produto.estoque,
  }))

  const subtotal = itensConvertidos.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  // Valida o cupom no backend antes de aplicar (o desconto vem do servidor)
  async function handleAplicarCupom(codigo: string) {
    if (!mercadoId) return
    setVerificandoCupom(true)
    try {
      const resultado = await api.validarCupom(mercadoId, codigo, subtotal)
      setCupom({ codigo: resultado.codigo, desconto: Number(resultado.desconto) })
      showToast('sucesso', `Cupom ${resultado.codigo} aplicado: ${Number(resultado.desconto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto.`)
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Cupom inválido.')
    } finally {
      setVerificandoCupom(false)
    }
  }

  async function handleCheckout() {
    if (!mercadoId) return
    if (!localStorage.getItem('token')) {
      showToast('erro', 'Faça login para finalizar o pedido. Seus itens ficam salvos no carrinho.')
      // Pausa curta para o cliente ler o aviso antes de mudar de tela
      setTimeout(() => navigate('/auth'), 1600)
      return
    }
    setFinalizando(true)
    try {
      await api.criarPedido(mercadoId, {
        itens: carrinho.itens.map(i => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade })),
        observacao: observacao.trim() || undefined,
        tipo_entrega: tipoEntrega,
        cupom: cupom?.codigo || undefined,
        agendamento: agendamento || undefined,
      })
      showToast('sucesso', 'Pedido enviado com sucesso!')
      carrinho.limpar()
      setObservacao('')
      setCupom(null)
      setAgendamento('')
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
        storeLocation={mercadoLocal}
        initialItems={itensConvertidos}
        onBack={() => navigate(`/vitrine/${slug}`)}
        onCheckout={handleCheckout}
        finalizando={finalizando}
        observacao={observacao}
        onObservacaoChange={setObservacao}
        onUpdateQuantity={(id, delta) => carrinho.alterarQuantidade(Number(id), delta)}
        onRemoveItem={(id) => carrinho.remover(Number(id))}
        onClearCart={() => carrinho.limpar()}
        taxaEntrega={taxaEntrega}
        pedidoMinimo={pedidoMinimo}
        ofereceEntrega={ofereceEntrega}
        ofereceRetirada={ofereceRetirada}
        tipoEntrega={tipoEntrega}
        onTipoEntregaChange={setTipoEntrega}
        cupom={cupom}
        verificandoCupom={verificandoCupom}
        onAplicarCupom={handleAplicarCupom}
        onRemoverCupom={() => setCupom(null)}
        agendamento={agendamento}
        onAgendamentoChange={setAgendamento}
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
  const posLoginDestino = typeof window !== 'undefined'
    ? sessionStorage.getItem('posLoginDestino')
    : null
  const destino = usuario ? (posLoginDestino ?? '/') : '/auth'

  if (carregando) return <LoadingOverlay mensagem="Carregando..." />

  return (
    <Suspense fallback={<LoadingOverlay mensagem="Carregando..." />}>
      <Routes>
        <Route path="/"                  element={<MenuPrincipal/>} />
        <Route path="/promocional"       element={<MercadinsPromos />}/>
        <Route path="/sobre"             element={<Sobre />} />
        <Route path="/como-funciona"     element={<ComoFunciona />} />
        <Route path="/mercados-parceiros" element={<MercadosParceiros />} />
        <Route path="/atendimento"       element={<Atendimento />} />
        <Route path="/termos"            element={<Termos />} />
        <Route path="/privacidade"       element={<Privacidade />} />
        <Route path="/cookies"           element={<Cookies />} />
        <Route path="/auth"              element={!usuario ? <Login />    : <Navigate to={destino} />} />
        <Route path="/login"             element={!usuario ? <Login />    : <Navigate to={destino} />} />
        <Route path="/auth/login"        element={!usuario ? <Login />    : <Navigate to={destino} />} />
        <Route path="/auth/register"     element={!usuario ? <Register /> : <Navigate to={destino} />} />
        <Route path="/register"          element={!usuario ? <Register /> : <Navigate to={destino} />} />
        <Route path="/redefinir-senha"   element={<RedefinirSenha />} />
        <Route path="/verificar-email"   element={<VerificarEmail />} />
        <Route path="/perfil"            element={usuario ? <PerfilUsuario /> : <Navigate to="/auth" />} />
        <Route path="/favoritos"         element={usuario ? <Favoritos /> : <Navigate to="/auth" />} />
        <Route path="/vendedor"          element={usuario && temMercado ? <PerfilVendedor /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
        <Route path="/vendedor/mercado/:mercadoId"         element={usuario && temMercado ? <GerenciamentoMercadoWrapper /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
        <Route path="/vendedor/mercado/:mercadoId/vitrine" element={usuario && temMercado ? <VitrineVendedorWrapper /> : <Navigate to={usuario ? '/perfil' : '/auth'} />} />
        <Route path="/registrar-mercado" element={usuario ? <RegistrarMercado /> : <Navigate to="/auth" />} />
        <Route path="/planos"            element={usuario?.is_admin ? <Navigate to="/registrar-mercado" /> : <SelecionarPlano />} />
        <Route path="/vitrine/:slug"                                    element={<VitrineClienteWrapper />} />
        <Route path="/vitrine/:slug/carrinho"                           element={<CartWrapper />} />
        <Route path="/vitrine/:slug/produto/:categoriaId/:produtoId"    element={<ProdutoTelaWrapper />} />
        <Route path="/admin"             element={usuario?.is_admin ? <Administrador /> : <Navigate to={destino} />} />
        <Route path="*"                  element={<PaginaNaoEncontrada />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ControleRotas />
          <Rotas />
          <CookieBanner />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}