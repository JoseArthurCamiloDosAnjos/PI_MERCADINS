import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminSidebar from './AdminSidebar'
import './Admin.css'

// Cada aba carrega em seu próprio arquivo: os gráficos (recharts, ~350 KB)
// só baixam quando a aba correspondente é aberta, e não junto com a rota.
const Dashboard = lazy(() => import('./Dashboard'))
const Usuarios = lazy(() => import('./Usuarios'))
const Mercados = lazy(() => import('./Mercados'))
const Relatorios = lazy(() => import('./Relatorios'))
const Configuracoes = lazy(() => import('./Configuracoes'))

const ABAS = ['Dashboard', 'Usuários', 'Mercados', 'Relatórios', 'Configurações']

export default function Adiministrador() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [abaAtiva, setAbaAtiva] = useState(0)

  if (!usuario?.is_admin) {
    return (
      <div className="adm-denied">
        <h1>Acesso negado</h1>
        <p>Você não tem permissão para acessar esta página.</p>
        <button onClick={() => navigate('/')}>Voltar</button>
      </div>
    )
  }

  return (
    <div className="adm-root">
      <AdminSidebar navAtivo={abaAtiva} onNav={setAbaAtiva} />
      <main className="adm-main">
        <header className="adm-header">
          <h1>{ABAS[abaAtiva]}</h1>
        </header>
        <section className="adm-content">
          <Suspense fallback={<p className="adm-carregando">Carregando…</p>}>
            {abaAtiva === 0 && <Dashboard />}
            {abaAtiva === 1 && <Usuarios />}
            {abaAtiva === 2 && <Mercados />}
            {abaAtiva === 3 && <Relatorios />}
            {abaAtiva === 4 && <Configuracoes />}
          </Suspense>
        </section>
      </main>
    </div>
  )
}
