import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { useToast } from '../../hooks/useToast'
import ToastContainer from '../../components/Toast'

// ─────────────────────────────────────────────────────────────────────────────
//  Aba "Mercados" do painel do administrador
//
//  Antes só dava para ver loja por loja dentro do cadastro de um usuário, e a
//  lista pública do site traz só 20 por vez — quando uma loja "não aparecia"
//  ninguém conseguia descobrir o motivo. Aqui o administrador enxerga TODAS
//  as lojas da plataforma (inclusive as bloqueadas), com busca, filtro de
//  status, contagens e o botão de bloquear/desbloquear.
// ─────────────────────────────────────────────────────────────────────────────

interface Mercado {
  id_mercado: number
  nome: string
  slug?: string
  cidade?: string
  estado?: string
  status: string
  plano?: string
  cnpj?: string
  email?: string
  telefone?: string
  data_cadastro: string
  dono?: string | null
  total_categorias?: number
  total_produtos?: number
  total_cupons?: number
  total_cupons_ativos?: number
  total_pedidos?: number
}

interface Metricas {
  total: number
  ativos: number
  bloqueados: number
}

interface CategoriaDetalhe {
  id_categoria: number
  nome: string
  total_produtos: number
}

interface CupomDetalhe {
  id: number
  codigo: string
  tipo: 'percentual' | 'valor'
  valor: number
  min_pedido: number
  usos: number
  max_usos: number | null
  ativo: boolean
  categorias: { id: number; nome: string }[]
}

interface Membro {
  id_usuario: number
  nome: string
  email: string
  papel: string
}

interface Detalhe {
  mercado: Mercado & {
    faturamento?: number | string
    descricao?: string
    horario?: unknown
  }
  categorias: CategoriaDetalhe[]
  cupons: CupomDetalhe[]
  equipe: Membro[]
}

const METRICAS: { key: keyof Metricas; label: string; filtro: string; cor: string }[] = [
  { key: 'total', label: 'Mercados', filtro: '', cor: '#4a7fd4' },
  { key: 'ativos', label: 'Ativos no site', filtro: 'ativo', cor: '#22c55e' },
  { key: 'bloqueados', label: 'Bloqueados', filtro: 'bloqueado', cor: '#ef4444' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'bloqueado', label: 'Bloqueado' },
]

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function statusInfo(status: string) {
  if (status === 'bloqueado') return { label: 'Bloqueado', cor: '#ef4444' }
  if (status === 'suspenso') return { label: 'Suspenso', cor: '#f59e0b' }
  return { label: 'Ativo', cor: '#22c55e' }
}

function formatarData(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('pt-BR')
}

function formatarMoeda(valor: number | string | undefined) {
  const n = Number(valor ?? 0)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Mercados() {
  const { toasts, showToast, dismissToast } = useToast()
  const [mercados, setMercados] = useState<Mercado[]>([])
  const [metricas, setMetricas] = useState<Metricas>({ total: 0, ativos: 0, bloqueados: 0 })
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [bloqueandoId, setBloqueandoId] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const params = new URLSearchParams()
      if (busca.trim()) params.set('busca', busca.trim())
      if (filtroStatus) params.set('status', filtroStatus)
      const data = await api.adminMercados(params.toString())
      setMercados(data.mercados ?? [])
      setMetricas(data.metricas ?? { total: 0, ativos: 0, bloqueados: 0 })
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar os mercados')
    } finally {
      setLoading(false)
    }
  }, [busca, filtroStatus])

  useEffect(() => {
    // Adia um instante: assim o carregamento não dispara setState de forma
    // síncrona dentro do efeito (mesmo comportamento, sem o alerta do React)
    Promise.resolve().then(carregar)
  }, [carregar])

  async function abrirDetalhe(id: number) {
    setCarregandoDetalhe(true)
    try {
      const data = await api.adminMercadoDetalhe(id)
      setDetalhe({
        mercado: data.mercado,
        categorias: data.categorias ?? [],
        cupons: data.cupons ?? [],
        equipe: data.equipe ?? [],
      })
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao carregar o mercado')
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  // Bloqueia/desbloqueia a loja: some do site do público quando bloqueada
  async function alternarBloqueio(id: number) {
    setBloqueandoId(id)
    try {
      const data = await api.adminBloquearMercado(id)
      showToast('sucesso', data.mensagem)
      if (detalhe && detalhe.mercado.id_mercado === id) {
        setDetalhe({ ...detalhe, mercado: { ...detalhe.mercado, status: data.status } })
      }
      await carregar()
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao alterar o status do mercado')
    } finally {
      setBloqueandoId(null)
    }
  }

  return (
    <div className="adm-usuarios">
      <div className="adm-stats-grid">
        {METRICAS.map(({ key, label, filtro, cor }) => (
          <div
            key={key}
            className={`adm-stat-card${filtroStatus === filtro ? ' adm-stat-active' : ''}`}
            style={{ borderTopColor: cor }}
            onClick={() => {
              setFiltroStatus(filtro === filtroStatus ? '' : filtro)
            }}
          >
            <div className="adm-stat-info">
              <span className="adm-stat-val">{metricas[key]}</span>
              <span className="adm-stat-lbl">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-toolbar">
        <form
          className="adm-search"
          onSubmit={e => {
            e.preventDefault()
            carregar()
          }}
        >
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Pesquisar por nome, cidade, CNPJ ou slug..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </form>
        <div className="adm-filtros-row">
          <select
            className="adm-select"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="adm-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="adm-skeleton-card" />
          ))}
        </div>
      ) : erro ? (
        <p className="adm-erro">{erro}</p>
      ) : (
        <>
          <p className="adm-dica-rolagem">Arraste a tabela para o lado para ver todas as colunas</p>
          <div className="adm-table-wrapper">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mercado</th>
                <th>Cidade</th>
                <th>Plano</th>
                <th>Produtos</th>
                <th>Cupons</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mercados.length === 0 && (
                <tr><td colSpan={8} className="adm-empty">Nenhum mercado encontrado</td></tr>
              )}
              {mercados.map(m => {
                const st = statusInfo(m.status)
                return (
                  <tr key={m.id_mercado}>
                    <td>
                      <div className="adm-celula-dupla">
                        <span className="adm-user-name">{m.nome}</span>
                        {m.dono && <span className="adm-muted">{m.dono}</span>}
                      </div>
                    </td>
                    <td>{m.cidade ? `${m.cidade}${m.estado ? `/${m.estado}` : ''}` : '-'}</td>
                    <td>{m.plano ? m.plano : '-'}</td>
                    <td>{m.total_produtos ?? 0}</td>
                    <td>{m.total_cupons ?? 0}</td>
                    <td>
                      <span className="adm-badge-status" style={{ background: `${st.cor}22`, color: st.cor }}>
                        <span className="adm-status-dot" style={{ background: st.cor }} />
                        {st.label}
                      </span>
                    </td>
                    <td>{formatarData(m.data_cadastro)}</td>
                    <td>
                      <div className="adm-acoes-cell">
                        <button
                          className={m.status === 'ativo' ? 'adm-btn-remover-admin' : 'adm-btn-promover'}
                          disabled={bloqueandoId === m.id_mercado}
                          onClick={() => alternarBloqueio(m.id_mercado)}
                        >
                          {m.status === 'ativo' ? 'Bloquear' : 'Desbloquear'}
                        </button>
                        <button className="adm-btn-detalhes" onClick={() => abrirDetalhe(m.id_mercado)}>
                          Mais informacoes
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      {/* ─── Modal de detalhes do mercado ──────────────────────────────── */}
      {carregandoDetalhe && (
        <div className="adm-modal-overlay">
          <div className="adm-modal">
            <div className="adm-loading-grid">
              <div className="adm-skeleton-card" />
              <div className="adm-skeleton-card" />
            </div>
          </div>
        </div>
      )}

      {detalhe && !carregandoDetalhe && (
        <div className="adm-modal-overlay" onClick={() => setDetalhe(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <button className="adm-modal-close" aria-label="Fechar" onClick={() => setDetalhe(null)}>
              <CloseIcon />
            </button>

            <div className="adm-modal-header">
              <div>
                <h2>{detalhe.mercado.nome}</h2>
                <p>
                  {detalhe.mercado.cidade
                    ? `${detalhe.mercado.cidade}${detalhe.mercado.estado ? `/${detalhe.mercado.estado}` : ''}`
                    : 'Local não informado'}
                  {detalhe.mercado.dono ? ` · dono: ${detalhe.mercado.dono}` : ''}
                </p>
              </div>
            </div>

            <section className="adm-modal-section">
              <h3>Situação</h3>
              <div className="adm-modal-info-grid">
                <div>
                  <label>Status</label>
                  <span>{statusInfo(detalhe.mercado.status).label}</span>
                </div>
                <div>
                  <label>Plano</label>
                  <span>{detalhe.mercado.plano || 'sem plano'}</span>
                </div>
                <div>
                  <label>CNPJ</label>
                  <span>{detalhe.mercado.cnpj || '-'}</span>
                </div>
                <div>
                  <label>Cadastro</label>
                  <span>{formatarData(detalhe.mercado.data_cadastro)}</span>
                </div>
                <div>
                  <label>Produtos</label>
                  <span>{detalhe.mercado.total_produtos ?? 0}</span>
                </div>
                <div>
                  <label>Pedidos</label>
                  <span>{detalhe.mercado.total_pedidos ?? 0}</span>
                </div>
                <div>
                  <label>Faturamento</label>
                  <span>R$ {formatarMoeda(detalhe.mercado.faturamento)}</span>
                </div>
                <div>
                  <label>E-mail</label>
                  <span>{detalhe.mercado.email || '-'}</span>
                </div>
              </div>
            </section>

            <section className="adm-modal-section">
              <h3>Categorias ({detalhe.categorias.length})</h3>
              {detalhe.categorias.length === 0 ? (
                <p className="adm-muted">Nenhuma categoria cadastrada.</p>
              ) : (
                <div className="adm-modal-info-grid">
                  {detalhe.categorias.map(c => (
                    <div key={c.id_categoria}>
                      <label>{c.nome}</label>
                      <span>{c.total_produtos} produto{c.total_produtos === 1 ? '' : 's'}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="adm-modal-section">
              <h3>Cupons ({detalhe.cupons.length})</h3>
              {detalhe.cupons.length === 0 ? (
                <p className="adm-muted">Nenhum cupom criado.</p>
              ) : (
                <ul className="adm-lista-simples">
                  {detalhe.cupons.map(c => (
                    <li key={c.id}>
                      <strong>{c.codigo}</strong>
                      <span>
                        {c.tipo === 'percentual' ? `${c.valor}% de desconto` : `R$ ${formatarMoeda(c.valor)} de desconto`}
                        {' · '}
                        {c.categorias.length === 0
                          ? 'todos os produtos'
                          : `só em ${c.categorias.map(x => x.nome).join(', ')}`}
                      </span>
                      <span className={c.ativo ? 'adm-badge-tipo' : 'adm-muted'}>
                        {c.ativo ? 'ativo' : 'inativo'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="adm-modal-section">
              <h3>Equipe ({detalhe.equipe.length})</h3>
              {detalhe.equipe.length === 0 ? (
                <p className="adm-muted">Nenhum usuário vinculado.</p>
              ) : (
                <ul className="adm-lista-simples">
                  {detalhe.equipe.map(m => (
                    <li key={m.id_usuario}>
                      <strong>{m.nome}</strong>
                      <span>{m.email}</span>
                      <span className="adm-badge-tipo">{m.papel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="adm-modal-actions">
              <button
                className={detalhe.mercado.status === 'ativo' ? 'adm-btn-remover-admin' : 'adm-btn-promover'}
                disabled={bloqueandoId === detalhe.mercado.id_mercado}
                onClick={() => alternarBloqueio(detalhe.mercado.id_mercado)}
              >
                {detalhe.mercado.status === 'ativo' ? 'Bloquear mercado' : 'Desbloquear mercado'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
