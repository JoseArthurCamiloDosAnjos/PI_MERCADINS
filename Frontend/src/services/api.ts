const BASE_URL = '/api'

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

  // ── Categorias ───────────────────────────────────────────────────────────────
  criarCategoria: (
    mercadoId: string | number,
    dados: { nome: string }
  ) =>
    request(`/mercados/${mercadoId}/categorias`, {
      method: 'POST',
      body:   JSON.stringify(dados),
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
    dados: { nome: string; descricao?: string; imagem?: string | null }
  ) =>
    request(`/mercados/${mercadoId}/categorias/${categoriaId}/produtos`, {
      method: 'POST',
      body:   JSON.stringify(dados),
    }),

  atualizarProduto: (
    mercadoId:   string | number,
    categoriaId: string | number,
    produtoId:   string | number,
    dados: { nome: string; descricao?: string; imagem?: string | null }
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
}