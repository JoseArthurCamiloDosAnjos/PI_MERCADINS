import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../services/api'
import {
  IconStore,
  IconUser,
  IconPackage,
  IconShoppingCart,
  IconZap,
  IconInfo,
  IconBell,
} from '../../components/Icons'

interface Metricas {
  totalMercados: number 
  totalUsuarios: number
  totalProdutos: number
  totalPedidos: number
  mercadosAtivos: number
  totalEntregadores: number
}

interface CrescimentoItem {
  mes: string
  total: number
}

interface AtividadeItem {
  descricao: string
  tipo: string
  data: string
}

interface AlertaItem {
  titulo: string
  descricao: string
  tipo: string
  data: string
}

interface DashboardData {
  metricas: Metricas
  crescimentoMercados: CrescimentoItem[]
  crescimentoUsuarios: CrescimentoItem[]
  atividade: AtividadeItem[]
}

function TruckIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  )
}

const STAT_CARDS: { key: keyof Metricas; label: string; icon: ReactNode; color: string }[] = [
  { key: 'totalMercados', label: 'Total Mercados', icon: <IconStore size={22} />, color: '#4a7fd4' },
  { key: 'totalUsuarios', label: 'Total Usuarios', icon: <IconUser size={22} />, color: '#22c55e' },
  { key: 'totalProdutos', label: 'Total Produtos', icon: <IconPackage size={22} />, color: '#f59e0b' },
  { key: 'totalPedidos', label: 'Total Pedidos', icon: <IconShoppingCart size={22} />, color: '#ef4444' },
  { key: 'mercadosAtivos', label: 'Mercados Ativos', icon: <IconZap size={22} />, color: '#8b5cf6' },
  { key: 'totalEntregadores', label: 'Total Entregadores', icon: <TruckIcon size={22} />, color: '#06b6d4' },
]

const TIPO_COR: Record<string, string> = {
  mercado: '#4a7fd4',
  usuario: '#22c55e',
  avaliacao: '#f59e0b',
  pedido: '#8b5cf6',
}

const ALERTA_ICONE: Record<string, ReactNode> = {
  aviso: <IconBell size={18} />,
  info: <IconInfo size={18} />,
  critico: <span style={{ color: '#ef4444' }}>!</span>,
  sucesso: <span style={{ color: '#22c55e' }}>✓</span>,
}

export default function Dashboard() {
  const [dados, setDados] = useState<DashboardData | null>(null)
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.adminDashboard(), api.adminAlertas()])
      .then(([dash, al]) => {
        setDados(dash)
        setAlertas(al.alertas)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="adm-loading-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="adm-skeleton-card" />
        ))}
      </div>
    )
  }

  if (!dados) return <p className="adm-erro">Erro ao carregar dashboard</p>

  return (
    <div className="adm-dashboard">
      <div className="adm-stats-grid">
        {STAT_CARDS.map(({ key, label, icon, color }) => (
          <div key={key} className="adm-stat-card" style={{ borderTopColor: color }}>
            <div className="adm-stat-icon" style={{ color }}>{icon}</div>
            <div className="adm-stat-info">
              <span className="adm-stat-val">{dados.metricas[key]}</span>
              <span className="adm-stat-lbl">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-charts-row">
        <div className="adm-chart-box">
          <h3>Crescimento de Mercados</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dados.crescimentoMercados}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--azul-borda)" />
              <XAxis dataKey="mes" stroke="var(--cinza-texto)" fontSize={12} />
              <YAxis stroke="var(--cinza-texto)" fontSize={12} />
              <Tooltip
                contentStyle={{ background: 'var(--azul-card)', border: '1px solid var(--azul-borda)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--branco)' }}
              />
              <Bar dataKey="total" fill="#4a7fd4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="adm-chart-box">
          <h3>Crescimento de Usuarios</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dados.crescimentoUsuarios}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--azul-borda)" />
              <XAxis dataKey="mes" stroke="var(--cinza-texto)" fontSize={12} />
              <YAxis stroke="var(--cinza-texto)" fontSize={12} />
              <Tooltip
                contentStyle={{ background: 'var(--azul-card)', border: '1px solid var(--azul-borda)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--branco)' }}
              />
              <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="adm-bottom-row">
        <div className="adm-box">
          <h3><IconInfo size={16} /> Atividade Recente</h3>
          <div className="adm-list">
            {dados.atividade.length === 0 && <p className="adm-empty">Nenhuma atividade recente</p>}
            {dados.atividade.map((item, i) => (
              <div key={i} className="adm-list-item">
                <span className="adm-tipo-dot" style={{ background: TIPO_COR[item.tipo] ?? '#888' }} />
                <div className="adm-list-text">
                  <span>{item.descricao}</span>
                  <small>{new Date(item.data).toLocaleDateString('pt-BR')}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="adm-box">
          <h3><IconBell size={16} /> Alertas Importantes</h3>
          <div className="adm-list">
            {alertas.length === 0 && <p className="adm-empty">Nenhum alerta no momento</p>}
            {alertas.map((item, i) => (
              <div key={i} className="adm-list-item adm-alerta">
                <span className="adm-alerta-icone">
                  {ALERTA_ICONE[item.tipo] ?? <IconInfo size={18} />}
                </span>
                <div className="adm-list-text">
                  <span className="adm-alerta-titulo">{item.titulo}</span>
                  <span>{item.descricao}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
