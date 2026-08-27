export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

const getToken = () => localStorage.getItem('token')

async function request(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${BASE_URL}/api${path}`, {
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

async function requestFormData(path: string, formData: FormData, method: string = 'POST') {
  const token = getToken()
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
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
  atualizar:   (dados: { nome?: string; email?: string; telefone?: string; foto_perfil?: File }) => {
    const formData = new FormData()
    if (dados.nome) formData.append('nome', dados.nome)
    if (dados.email) formData.append('email', dados.email)
    if (dados.telefone) formData.append('telefone', dados.telefone)
    if (dados.foto_perfil) formData.append('foto_perfil', dados.foto_perfil)
    return requestFormData('/auth/perfil', formData, 'PUT')
  },
  trocarSenha: (dados: Record<string, string>) =>
    request('/auth/trocar-senha', { method: 'POST', body: JSON.stringify(dados) }),
  confirmarTrocaSenha: (dados: Record<string, string>) =>
    request('/auth/confirmar-troca-senha', { method: 'POST', body: JSON.stringify(dados) }),

  // ── Mercados ─────────────────────────────────────────────────────────────────
  meusMercados: () =>
    request('/usuarios-mercados/meus'),
  buscarMercado: (mercadoId: string | number) =>
    request(`/mercados/${mercadoId}`),
  buscarMercadoPorSlug: (slug: string) =>
    request(`/mercados/slug/${slug}`),
  listarMercados: (busca?: string) =>
    request(`/mercados${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
  atualizarMercado: (mercadoId: string | number, dados: { nome?: string; descricao?: string; logo?: File; banner?: File; [key: string]: unknown }) => {
    const formData = new FormData()
    if (dados.nome) formData.append('nome', dados.nome)
    if (dados.descricao) formData.append('descricao', dados.descricao)
    if (dados.logo) formData.append('foto_perfil', dados.logo)
    if (dados.banner) formData.append('banner', dados.banner)
    return requestFormData(`/mercados/${mercadoId}`, formData, 'PUT')
  },
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
    dados: { nome: string; descricao?: string; imagem?: string | null; imagens?: string[]; preco?: number; estoque?: number; files?: File[] }
  ) => {
    const formData = new FormData()
    formData.append('nome', dados.nome)
    if (dados.descricao) formData.append('descricao', dados.descricao)
    if (dados.preco !== undefined) formData.append('preco', String(dados.preco))
    if (dados.estoque !== undefined) formData.append('estoque', String(dados.estoque))
    if (dados.files) {
      dados.files.forEach(f => formData.append('imagens', f))
    }
    return requestFormData(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos`, formData)
  },

  atualizarProduto: (
    mercadoId:   string | number,
    categoriaId: string | number,
    produtoId:   string | number,
    dados: { nome: string; descricao?: string; imagem?: string | null; imagens?: string[]; preco?: number; estoque?: number; files?: File[] }
  ) => {
    const formData = new FormData()
    formData.append('nome', dados.nome)
    if (dados.descricao) formData.append('descricao', dados.descricao)
    if (dados.preco !== undefined) formData.append('preco', String(dados.preco))
    if (dados.estoque !== undefined) formData.append('estoque', String(dados.estoque))
    if (dados.files) {
      dados.files.forEach(f => formData.append('imagens', f))
    }
    return requestFormData(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos/${produtoId}`, formData, 'PUT')
  },

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

  // ── Carrinho ────────────────────────────────────────────────────────────────
  buscarCarrinho: (mercadoId: string | number) =>
    request(`/carrinho/${mercadoId}`),
  salvarCarrinho: (mercadoId: string | number, itens: { id_produto: number; quantidade: number }[]) =>
    request(`/carrinho/${mercadoId}`, {
      method: 'PUT',
      body: JSON.stringify({ itens }),
    }),
  limparCarrinho: (mercadoId: string | number) =>
    request(`/carrinho/${mercadoId}`, { method: 'DELETE' }),

  // ── Usuario (Perfil) ────────────────────────────────────────────────────────
  listarFavoritos:  () => request('/usuario/favoritos'),
  listarAvaliacoes: () => request('/usuario/avaliacoes'),
  listarHistorico:  () => request('/usuario/historico'),
}