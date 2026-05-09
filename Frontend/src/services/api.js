const BASE_URL = '/api'

const getToken = () => localStorage.getItem('token')

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição')
  return data
}

export const api = {
  register: (dados)  => request('/auth/register', { method: 'POST', body: JSON.stringify(dados) }),
  login:    (dados)  => request('/auth/login',    { method: 'POST', body: JSON.stringify(dados) }),
  perfil:   ()       => request('/auth/perfil'),
  atualizar: (dados) => request('/auth/perfil',   { method: 'PUT',  body: JSON.stringify(dados) }),
}