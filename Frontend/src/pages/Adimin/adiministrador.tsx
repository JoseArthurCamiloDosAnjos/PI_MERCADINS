import { Suspense, lazy, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AdminSidebar from './AdminSidebar'
import { IconEye } from '../../components/Icons'
import './Admin.css'

const Dashboard = lazy(() => import('./Dashboard'))
const Usuarios = lazy(() => import('./Usuarios'))
const Mercados = lazy(() => import('./Mercados'))
const Catalogo = lazy(() => import('./Catalogo'))
const Relatorios = lazy(() => import('./Relatorios'))
const Configuracoes = lazy(() => import('./Configuracoes'))

const ABAS = [
  { nome: 'Dashboard', desc: 'Visão geral da plataforma em tempo real' },
  { nome: 'Usuários', desc: 'Contas cadastradas e permissões de acesso' },
  { nome: 'Mercados', desc: 'Lojas parceiras e a situação de cada uma' },
  { nome: 'Catálogo', desc: 'Produtos e categorias cadastrados nas lojas' },
  { nome: 'Relatórios', desc: 'Pedidos, entregas e faturamento por período' },
  { nome: 'Configurações', desc: 'Perfil do administrador e segurança da conta' },
]

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
          <div className="adm-header-texto">
            <h1>{ABAS[abaAtiva].nome}</h1>
            <p>{ABAS[abaAtiva].desc}</p>
          </div>
          <a className="adm-header-site" href="/" target="_blank" rel="noreferrer">
            <IconEye size={15} /> Ver site
          </a>
        </header>
        <section className="adm-content">
          <Suspense fallback={<p className="adm-carregando">Carregando…</p>}>
            {abaAtiva === 0 && <Dashboard />}
            {abaAtiva === 1 && <Usuarios />}
            {abaAtiva === 2 && <Mercados />}
            {abaAtiva === 3 && <Catalogo />}
            {abaAtiva === 4 && <Relatorios />}
            {abaAtiva === 5 && <Configuracoes />}
          </Suspense>
        </section>
      </main>
    </div>
  )
}
