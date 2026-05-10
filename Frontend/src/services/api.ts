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
  register: (dados: Record<string, string>) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(dados) }),
  login: (dados: Record<string, string>) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(dados) }),
  perfil: () => request('/auth/perfil'),
  atualizar: (dados: Record<string, string>) =>
    request('/auth/perfil', { method: 'PUT', body: JSON.stringify(dados) }),
}