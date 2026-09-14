import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  IconBarChart,
  IconUser,
  IconReceipt,
  IconGear,
  IconMenu,
  IconX,
} from '../../components/Icons'

interface AdminSidebarProps {
  navAtivo: number
  onNav: (index: number) => void
}

const NAV_ITEMS = [
  { icon: <IconBarChart size={18} />, label: 'Dashboard' },
  { icon: <IconUser size={18} />, label: 'Usuarios' },
  { icon: <IconReceipt size={18} />, label: 'Relatorios' },
  { icon: <IconGear size={18} />, label: 'Configuracoes' },
]

export default function AdminSidebar({ navAtivo, onNav }: AdminSidebarProps) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const iniciais = usuario?.nome
    ?.split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AD'

  function handleNav(i: number) {
    onNav(i)
    setOpen(false)
  }

  function handleLogout() {
    logout()
    navigate('/auth')
  }

  return (
    <>
      <button className="adm-hamburger" onClick={() => setOpen(true)} aria-label="Abrir menu">
        <IconMenu size={20} />
      </button>

      {open && <div className="adm-overlay" onClick={() => setOpen(false)} />}

      <aside className={`adm-sidebar${open ? ' adm-open' : ''}`}>
        <button className="adm-close" onClick={() => setOpen(false)} aria-label="Fechar menu">
          <IconX size={18} />
        </button>

        <div className="adm-profile">
          <div className="adm-avatar">
            {usuario?.foto_perfil
              ? <img src={usuario.foto_perfil} alt={usuario.nome} className="adm-avatar-img" />
              : iniciais
            }
          </div>
          <p className="adm-nome">{usuario?.nome ?? 'Administrador'}</p>
          <p className="adm-email">{usuario?.email_admin || (usuario?.email ?? '')}</p>
          <span className="adm-badge">Admin</span>
        </div>

        <nav className="adm-nav">
          {NAV_ITEMS.map((item, i) => (
            <button
              key={i}
              className={`adm-nav-btn${navAtivo === i ? ' active' : ''}`}
              onClick={() => handleNav(i)}
            >
              <span className="adm-nav-icon">{item.icon}</span>
              <span className="adm-nav-label">{item.label}</span>
              {navAtivo === i && <span className="adm-nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="adm-footer">
          <button className="adm-logout-btn" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair da conta
          </button>
        </div>
      </aside>
    </>
  )
}
