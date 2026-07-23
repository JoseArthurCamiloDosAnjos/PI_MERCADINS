export const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const getToken = () => localStorage.getItem('token')

async function request(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers as Record<string, string> ?? {}),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição')
  return data
}

export const api = {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  register:    (dados: Record<string, string>) =>
    request('/auth/register',     { method: 'POST', body: JSON.stringify(dados) }),
  login:       (dados: Record<string, string>) =>
    request('/auth/login',        { method: 'POST', body: JSON.stringify(dados) }),
  perfil:      () =>
    request('/auth/perfil'),
  atualizar:   (dados: Record<string, string>) =>
    request('/auth/perfil',       { method: 'PUT',  body: JSON.stringify(dados) }),
  trocarSenha: (dados: Record<string, string>) =>
    request('/auth/trocar-senha', { method: 'POST', body: JSON.stringify(dados) }),

  // ── Mercados ─────────────────────────────────────────────────────────────────
  meusMercados: () =>
    request('/usuarios-mercados/meus'),
  buscarMercado: (mercadoId: string | number) =>
    request(`/mercados/${mercadoId}`),
  buscarMercadoPorSlug: (slug: string) =>
    request(`/mercados/slug/${slug}`),
  listarMercados: (busca?: string) =>
    request(`/mercados${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  atualizarMercado: (mercadoId: string | number, dados: Record<string, string>) =>
    request(`/mercados/${mercadoId}`, { method: 'PUT', body: JSON.stringify(dados) }),
  dashboardMercado: (mercadoId: string | number) =>
    request(`/mercados/${mercadoId}/dashboard`),

  // ── Categorias ───────────────────────────────────────────────────────────────
  listarCategorias: (mercadoId: string | number) =>
    request(`/mercados/${mercadoId}/categorias`),

  criarCategoria: (
    mercadoId: string | number,
    dados: { nome: string }
  ) =>
    request(`/mercados/${mercadoId}/categorias`, {
      method: 'POST',
      body:   JSON.stringify(dados),
    }),

  atualizarCategoria: (
    mercadoId: string | number,
    categoriaId: string | number,
    dados: { nome: string }
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}`, {
      method: 'PUT',
      body:   JSON.stringify(dados),
    }),

  deletarCategoria: (
    mercadoId: string | number,
    categoriaId: string | number
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}`, {
      method: 'DELETE',
    }),

  // ── Produtos ─────────────────────────────────────────────────────────────────
  listarProdutos: (
    mercadoId:   string | number,
    categoriaId: string | number
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos`),

  criarProduto: (
    mercadoId:   string | number,
    categoriaId: string | number,
    dados: { nome: string; descricao?: string; imagem?: string | null; imagens?: string[]; preco?: number }
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos`, {
      method: 'POST',
      body:   JSON.stringify(dados),
    }),

  atualizarProduto: (
    mercadoId:   string | number,
    categoriaId: string | number,
    produtoId:   string | number,
    dados: { nome: string; descricao?: string; imagem?: string | null; imagens?: string[]; preco?: number }
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos/${produtoId}`, {
      method: 'PUT',
      body:   JSON.stringify(dados),
    }),

  deletarProduto: (
    mercadoId:   string | number,
    categoriaId: string | number,
    produtoId:   string | number
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos/${produtoId}`, {
      method: 'DELETE',
    }),

  // ── Vitrine (visão do cliente) ─────────────────────────────────────────────
  favoritarMercado: (
    mercadoId: string | number,
    favoritado: boolean
  ) =>
    request(`/mercados/${mercadoId}/favoritar`, {
      method: favoritado ? 'POST' : 'DELETE',
    }),

  criarPedido: (
    mercadoId: string | number,
    dados: { itens: { id_produto: number; quantidade: number }[] }
  ) =>
    request(`/mercados/${mercadoId}/pedidos`, {
      method: 'POST',
      body:   JSON.stringify(dados),
    }),

  // ── Usuario (Perfil) ────────────────────────────────────────────────────────
  listarFavoritos:  () => request('/usuario/favoritos'),
  listarAvaliacoes: () => request('/usuario/avaliacoes'),
  listarHistorico:  () => request('/usuario/historico'),
}