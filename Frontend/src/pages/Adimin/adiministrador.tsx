import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminSidebar from './AdminSidebar'
import Dashboard from './Dashboard'
import Usuarios from './Usuarios'
import Relatorios from './Relatorios'
import Configuracoes from './Configuracoes'
import './Admin.css'

const ABAS = ['Dashboard', 'Usuarios', 'Relatorios', 'Configuracoes']

export default function Adiministrador() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [abaAtiva, setAbaAtiva] = useState(0)

  if (!usuario?.is_admin) {
    return (
      <div className="adm-denied">
        <h1>Acesso Negado</h1>
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
          {abaAtiva === 0 && <Dashboard />}
          {abaAtiva === 1 && <Usuarios />}
          {abaAtiva === 2 && <Relatorios />}
          {abaAtiva === 3 && <Configuracoes />}
        </section>
      </main>
    </div>
  )
}
