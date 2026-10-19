import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../../services/api'

interface MetricasRelatorio {
  totalMercados: number
  pedidosConcluidos: number
  pedidosMes: number
  entregasConcluidas: number
  receitaTotal: number
}

interface PeriodoItem {
  mes: string
  total: number
}

interface TipoItem {
  tipo: string
  total: number
}

interface StatusItem {
  status: string
  total: number
}

interface RelatorioData {
  metricas: MetricasRelatorio
  pedidosPorPeriodo: PeriodoItem[]
  mercadosPorTipo: TipoItem[]
  entregasPorTipo: StatusItem[]
}

const PERIODO_OPTIONS = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'dia', label: 'Escolher Dia' },
  { value: 'mes', label: 'Escolher Mes' },
  { value: 'ano', label: 'Escolher Ano' },
]

const STATUS_COR: Record<string, string> = {
  entregue: '#22c55e',
  caminho: '#f59e0b',
  preparo: '#4a7fd4',
  novo: '#8b5cf6',
  cancelado: '#ef4444',
}

const METRICAS_CONFIG: { key: keyof MetricasRelatorio; label: string; color: string; prefix?: string }[] = [
  { key: 'totalMercados', label: 'Total Mercados', color: '#4a7fd4' },
  { key: 'pedidosConcluidos', label: 'Pedidos Concluidos', color: '#22c55e' },
  { key: 'pedidosMes', label: 'Pedidos no Mes', color: '#f59e0b' },
  { key: 'entregasConcluidas', label: 'Entregas Concluidas', color: '#06b6d4' },
  { key: 'receitaTotal', label: 'Receita Total', color: '#8b5cf6', prefix: 'R$ ' },
]

export default function Relatorios() {
  const [dados, setDados] = useState<RelatorioData | null>(null)
  const [periodo, setPeriodo] = useState('tudo')
  const [dataInicio, setDataInicio] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
  }, [periodo, dataInicio])

  function carregar() {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('periodo', periodo)
    if (dataInicio) params.set('data_inicio', dataInicio)
    api.adminRelatorios(params.toString())
      .then(setDados)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function handleAplicar(e: React.FormEvent) {
    e.preventDefault()
    carregar()
  }

  function formatarValor(v: number) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading && !dados) {
    return (
      <div className="adm-loading-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="adm-skeleton-card" />
        ))}
      </div>
    )
  }

  if (!dados) return <p className="adm-erro">Erro ao carregar relatorios</p>

  return (
    <div className="adm-relatorios">
      <form className="adm-filtros" onSubmit={handleAplicar}>
        <div className="adm-filtro-botoes">
          {PERIODO_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`adm-filtro-btn${periodo === opt.value ? ' active' : ''}`}
              onClick={() => setPeriodo(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {periodo !== 'tudo' && (
          <input
            type={periodo === 'ano' ? 'number' : periodo === 'mes' ? 'month' : 'date'}
            className="adm-filtro-data"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
            placeholder={periodo === 'ano' ? 'AAAA' : undefined}
          />
        )}
        <button type="submit" className="adm-btn-aplicar">Aplicar Filtros</button>
      </form>

      <div className="adm-stats-grid">
        {METRICAS_CONFIG.map(({ key, label, color, prefix }) => (
          <div key={key} className="adm-stat-card" style={{ borderTopColor: color }}>
            <div className="adm-stat-info">
              <span className="adm-stat-val">{prefix ?? ''}{typeof dados.metricas[key] === 'number' ? formatarValor(dados.metricas[key]) : dados.metricas[key]}</span>
              <span className="adm-stat-lbl">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-charts-col">
        <div className="adm-chart-box">
          <h3>Pedidos por Periodo</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dados.pedidosPorPeriodo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--azul-borda)" />
              <XAxis type="number" stroke="var(--cinza-texto)" fontSize={12} />
              <YAxis dataKey="mes" type="category" stroke="var(--cinza-texto)" fontSize={12} width={60} />
              <Tooltip
                contentStyle={{ background: 'var(--azul-card)', border: '1px solid var(--azul-borda)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--branco)' }}
              />
              <Bar dataKey="total" fill="#4a7fd4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="adm-chart-box">
          <h3>Mercados por Tipo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dados.mercadosPorTipo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--azul-borda)" />
              <XAxis type="number" stroke="var(--cinza-texto)" fontSize={12} />
              <YAxis dataKey="tipo" type="category" stroke="var(--cinza-texto)" fontSize={12} width={80} />
              <Tooltip
                contentStyle={{ background: 'var(--azul-card)', border: '1px solid var(--azul-borda)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--branco)' }}
              />
              <Bar dataKey="total" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="adm-chart-box">
          <h3>Entregas por Tipo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dados.entregasPorTipo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--azul-borda)" />
              <XAxis type="number" stroke="var(--cinza-texto)" fontSize={12} />
              <YAxis dataKey="status" type="category" stroke="var(--cinza-texto)" fontSize={12} width={80} />
              <Tooltip
                contentStyle={{ background: 'var(--azul-card)', border: '1px solid var(--azul-borda)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--branco)' }}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {dados.entregasPorTipo.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COR[entry.status] ?? '#888'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
