import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { useToast } from '../../hooks/useToast'
import ToastContainer from '../../components/Toast'

interface Usuario {
  id_usuario: number
  nome: string
  email: string
  telefone?: string
  data_cadastro: string
  foto_perfil?: string
  is_admin: boolean
  is_vendedor: boolean
  papel: string
  status: string
  ultimo_acesso?: string
}

interface Metricas {
  total: number
  administradores: number
  vendedores: number
  clientes: number
}

interface MercadoVinculado {
  id_mercado: number
  nome: string
  slug: string
  cidade: string
  estado: string
  status: string
  papel: string
  total_pedidos: number
}

interface Atividade {
  descricao: string
  data: string
  tipo: string
}

interface DetalhesUsuario {
  usuario: {
    id_usuario: number
    nome: string
    email: string
    cpf?: string
    telefone?: string
    data_nascimento?: string
    data_cadastro: string
    foto_perfil?: string
    is_admin: boolean
    status: string
    email_verificado: boolean
    email_admin?: string
  }
  mercados: MercadoVinculado[]
  atividades: Atividade[]
}

const METRICAS_CONFIG: { key: keyof Metricas; label: string; color: string; filtro?: string }[] = [
  { key: 'total', label: 'Total', color: '#4a7fd4' },
  { key: 'clientes', label: 'Clientes', color: '#22c55e', filtro: 'cliente' },
  { key: 'vendedores', label: 'Vendedores', color: '#f59e0b', filtro: 'vendedor' },
  { key: 'administradores', label: 'Administradores', color: '#8b5cf6', filtro: 'admin' },
]

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo', cor: '#22c55e' },
  { value: 'bloqueado', label: 'Bloqueado', cor: '#ef4444' },
  { value: 'inativo', label: 'Inativo', cor: '#6b7280' },
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

function mascararCPF(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11)
  return nums
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function mascararCNPJ(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 14)
  return nums
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function mascararCEP(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 8)
  return nums.replace(/(\d{5})(\d{1,3})$/, '$1-$2')
}

function mascararTelefone(valor: string): string {
  const nums = valor.replace(/\D/g, '').slice(0, 11)
  if (nums.length <= 10) {
    return nums
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return nums
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export default function Usuarios() {
  const { toasts, showToast, dismissToast } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [metricas, setMetricas] = useState<Metricas>({ total: 0, administradores: 0, vendedores: 0, clientes: 0 })
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)

  // Modais
  const [detalhes, setDetalhes] = useState<DetalhesUsuario | null>(null)
  const [editando, setEditando] = useState<DetalhesUsuario | null>(null)
  const [formEdit, setFormEdit] = useState({ nome: '', email: '', telefone: '', data_nascimento: '', is_admin: false })
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<number | null>(null)
  const [mercadoDetalhes, setMercadoDetalhes] = useState<{ mercado: Record<string, unknown>; papel: string } | null>(null)
  const [mercadosVisiveis, setMercadosVisiveis] = useState(3)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (busca) params.set('busca', busca)
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroStatus) params.set('status', filtroStatus)
      params.set('pagina', String(pagina))
      const data = await api.adminUsuarios(params.toString())
      setUsuarios(data.usuarios)
      setMetricas(data.metricas)
    } catch (err) {
      console.error('Erro ao carregar usuarios:', err)
    } finally {
      setLoading(false)
    }
  }, [busca, filtroTipo, filtroStatus, pagina])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function abrirDetalhes(id: number) {
    try {
      const data = await api.adminDetalhesUsuario(id)
      setDetalhes(data)
    } catch {
      showToast('erro', 'Erro ao carregar detalhes do usuário')
    }
  }

  function abrirEditar(usuario: DetalhesUsuario) {
    setEditando(usuario)
    setFormEdit({
      nome: usuario.usuario.nome,
      email: usuario.usuario.email,
      telefone: usuario.usuario.telefone ?? '',
      data_nascimento: usuario.usuario.data_nascimento?.slice(0, 10) ?? '',
      is_admin: usuario.usuario.is_admin,
    })
  }

  async function salvarEdicao() {
    if (!editando) return
    try {
      await api.adminEditarUsuario(editando.usuario.id_usuario, formEdit)
      showToast('sucesso', 'Usuário editado com sucesso!')
      setEditando(null)
      carregar()
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao editar usuário')
    }
  }

  async function handleBloquear(id: number) {
    try {
      const data = await api.adminBloquearUsuario(id)
      showToast('sucesso', data.mensagem)
      carregar()
      if (detalhes?.usuario.id_usuario === id) {
        setDetalhes(prev => prev ? { ...prev, usuario: { ...prev.usuario, status: data.status } } : null)
      }
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao bloquear usuário')
    }
  }

  async function handleStatus(id: number, status: string) {
    try {
      await api.adminStatusUsuario(id, status)
      showToast('sucesso', `Status alterado para ${status}`)
      carregar()
      if (detalhes?.usuario.id_usuario === id) {
        setDetalhes(prev => prev ? { ...prev, usuario: { ...prev.usuario, status } } : null)
      }
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao alterar status')
    }
  }

  async function handleExcluir(id: number) {
    try {
      await api.adminExcluirUsuario(id)
      showToast('sucesso', 'Usuário excluído com sucesso!')
      setConfirmandoExclusao(null)
      setDetalhes(null)
      carregar()
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao excluir usuário')
    }
  }

  async function abrirMercadoDetalhes(idMercado: number, papel: string) {
    try {
      const data = await api.buscarMercado(idMercado)
      setMercadoDetalhes({ mercado: data.mercado, papel })
    } catch {
      showToast('erro', 'Erro ao carregar detalhes do mercado')
    }
  }

  async function handleBloquearMercado(idMercado: number) {
    try {
      const data = await api.adminBloquearMercado(idMercado)
      showToast('sucesso', data.mensagem)
      setMercadoDetalhes(prev => prev ? { ...prev, mercado: { ...prev.mercado, status: data.status } } : null)
      if (editando) {
        const mercadosAtualizados = editando.mercados.map(m =>
          m.id_mercado === idMercado ? { ...m, status: data.status } : m
        )
        setEditando({ ...editando, mercados: mercadosAtualizados })
      }
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao bloquear mercado')
    }
  }

  function tipoLabel(u: Usuario) {
    if (u.is_admin) return 'Administrador'
    if (u.is_vendedor || u.papel === 'dono' || u.papel === 'admin') return 'Vendedor'
    return 'Comprador'
  }

  function tipoCor(u: Usuario) {
    if (u.is_admin) return '#8b5cf6'
    if (u.is_vendedor || u.papel === 'dono' || u.papel === 'admin') return '#f59e0b'
    return '#3b82f6'
  }

  function statusInfo(s: string) {
    return STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0]
  }

  function formatarData(d: string) {
    return new Date(d).toLocaleDateString('pt-BR')
  }

  function iniciais(nome: string) {
    return nome?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  }

  return (
    <div className="adm-usuarios">
      <div className="adm-stats-grid">
        {METRICAS_CONFIG.map(({ key, label, color, filtro }) => (
          <div
            key={key}
            className={`adm-stat-card${filtroTipo === (filtro ?? '') ? ' adm-stat-active' : ''}`}
            style={{ borderTopColor: color }}
            onClick={() => {
              setFiltroTipo(filtro === filtroTipo ? '' : (filtro ?? ''))
              setPagina(1)
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
        <form className="adm-search" onSubmit={e => { e.preventDefault(); setPagina(1); carregar() }}>
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Pesquisar por nome ou e-mail..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </form>
        <div className="adm-filtros-row">
          <select className="adm-select" value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPagina(1) }}>
            <option value="">Tipo de usuario</option>
            <option value="admin">Administrador</option>
            <option value="vendedor">Vendedor</option>
            <option value="cliente">Comprador</option>
          </select>
          <select className="adm-select" value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); setPagina(1) }}>
            <option value="">Status</option>
            <option value="ativo">Ativo</option>
            <option value="bloqueado">Bloqueado</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="adm-loading-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="adm-skeleton-row" />
          ))}
        </div>
      ) : (
        <>
          <div className="adm-table-wrapper">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>NOME</th>
                  <th>E-MAIL</th>
                  <th>TIPO</th>
                  <th>STATUS</th>
                  <th>CADASTRO</th>
                  <th>ULTIMO ACESSO</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 && (
                  <tr><td colSpan={7} className="adm-empty">Nenhum usuario encontrado</td></tr>
                )}
                {usuarios.map(u => {
                  const st = statusInfo(u.status ?? 'ativo')
                  return (
                    <tr key={u.id_usuario}>
                      <td>
                        <div className="adm-user-cell">
                          <div className="adm-user-avatar" style={{ borderColor: tipoCor(u) }}>
                            {u.foto_perfil
                              ? <img src={u.foto_perfil} alt={u.nome} />
                              : iniciais(u.nome)
                            }
                          </div>
                          <span className="adm-user-name">{u.nome}</span>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="adm-badge-tipo" style={{ background: `${tipoCor(u)}22`, color: tipoCor(u) }}>
                          {tipoLabel(u)}
                        </span>
                      </td>
                      <td>
                        <span className="adm-badge-status" style={{ background: `${st.cor}22`, color: st.cor }}>
                          <span className="adm-status-dot" style={{ background: st.cor }} />
                          {st.label}
                        </span>
                      </td>
                      <td>{formatarData(u.data_cadastro)}</td>
                      <td>{u.ultimo_acesso ? formatarData(u.ultimo_acesso) : '-'}</td>
                      <td>
                        <button className="adm-btn-detalhes" onClick={() => abrirDetalhes(u.id_usuario)}>
                          Mais informacoes
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="adm-pagination">
            <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
            <span>Pagina {pagina}</span>
            <button disabled={usuarios.length < 20} onClick={() => setPagina(p => p + 1)}>Proxima</button>
          </div>
        </>
      )}

      {/* ─── Modal Detalhes ──────────────────────────────────────── */}
      {detalhes && (
        <div className="adm-modal-overlay" onClick={() => setDetalhes(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <button className="adm-modal-close" onClick={() => setDetalhes(null)}>
              <CloseIcon />
            </button>

            <div className="adm-modal-header">
              <div className="adm-modal-avatar">
                {detalhes.usuario.foto_perfil
                  ? <img src={detalhes.usuario.foto_perfil} alt={detalhes.usuario.nome} />
                  : iniciais(detalhes.usuario.nome)
                }
              </div>
              <div>
                <h2>{detalhes.usuario.nome}</h2>
                <p>{detalhes.usuario.email}</p>
              </div>
            </div>

            <div className="adm-modal-section">
              <h3>Informacoes Pessoais</h3>
              <div className="adm-modal-info-grid">
                <div>
                  <label>Nome completo</label>
                  <span>{detalhes.usuario.nome}</span>
                </div>
                <div>
                  <label>Tipo de conta</label>
                  <span className="adm-badge-tipo" style={{ background: `${tipoCor(detalhes.usuario as unknown as Usuario)}22`, color: tipoCor(detalhes.usuario as unknown as Usuario) }}>
                    {detalhes.usuario.is_admin ? 'Administrador' : 'Vendedor'}
                  </span>
                </div>
                <div>
                  <label>E-mail</label>
                  <span>{detalhes.usuario.email}</span>
                </div>
                {detalhes.usuario.is_admin && detalhes.usuario.email_admin && (
                  <div>
                    <label>E-mail Admin</label>
                    <span className="adm-email-admin">{detalhes.usuario.email_admin}</span>
                  </div>
                )}
                <div>
                  <label>Telefone</label>
                  <span>{detalhes.usuario.telefone || '-'}</span>
                </div>
                <div>
                  <label>Status da conta</label>
                  <span className="adm-badge-status" style={{ background: `${statusInfo(detalhes.usuario.status).cor}22`, color: statusInfo(detalhes.usuario.status).cor }}>
                    <span className="adm-status-dot" style={{ background: statusInfo(detalhes.usuario.status).cor }} />
                    {statusInfo(detalhes.usuario.status).label}
                  </span>
                </div>
                <div>
                  <label>Data de cadastro</label>
                  <span>{formatarData(detalhes.usuario.data_cadastro)}</span>
                </div>
                <div>
                  <label>E-mail</label>
                  <span>{detalhes.usuario.email}</span>
                </div>
              </div>
            </div>

            {detalhes.mercados.length > 0 && (
              <div className="adm-modal-section">
                <h3>Mercados Vinculados ({detalhes.mercados.length})</h3>
                {detalhes.mercados.map(m => (
                  <div key={m.id_mercado} className="adm-mercado-card">
                    <div className="adm-mercado-info">
                      <span className="adm-mercado-nome">{m.nome}</span>
                      <span className="adm-mercado-local">{m.cidade}/{m.estado} - {m.total_pedidos} pedidos</span>
                    </div>
                    <div className="adm-mercado-acoes">
                      <span className="adm-badge-tipo" style={{ background: '#22c55e22', color: '#22c55e' }}>{m.papel}</span>
                      <button className="adm-btn-detalhes" onClick={() => abrirMercadoDetalhes(m.id_mercado, m.papel)}>
                        Ver mais detalhes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {detalhes.atividades.length > 0 && (
              <div className="adm-modal-section">
                <h3>Historico de Atividades</h3>
                <div className="adm-atividade-lista">
                  {detalhes.atividades.map((a, i) => (
                    <div key={i} className="adm-atividade-item">
                      <span className="adm-atividade-dot" />
                      <div>
                        <span>{a.descricao}</span>
                        <small>{formatarData(a.data)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="adm-modal-actions">
              <button className="adm-btn-editar" onClick={() => abrirEditar(detalhes)}>
                Editar usuario
              </button>
              <button
                className={detalhes.usuario.status === 'bloqueado' ? 'adm-btn-desbloquear' : 'adm-btn-bloquear'}
                onClick={() => handleBloquear(detalhes.usuario.id_usuario)}
              >
                {detalhes.usuario.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear usuario'}
              </button>
              <button
                className="adm-btn-desativar"
                onClick={() => handleStatus(detalhes.usuario.id_usuario, detalhes.usuario.status === 'inativo' ? 'ativo' : 'inativo')}
              >
                {detalhes.usuario.status === 'inativo' ? 'Ativar conta' : 'Desativar conta'}
              </button>
              <button
                className="adm-btn-excluir"
                onClick={() => setConfirmandoExclusao(detalhes.usuario.id_usuario)}
              >
                Excluir usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar ────────────────────────────────────────── */}
      {editando && (
        <div className="adm-modal-overlay" onClick={() => setEditando(null)}>
          <div className="adm-modal adm-modal-editar" onClick={e => e.stopPropagation()}>
            <button className="adm-modal-close" onClick={() => setEditando(null)}>
              <CloseIcon />
            </button>
            <h2>Editar Usuario</h2>

            <div className="adm-form-group">
              <label>Nome</label>
              <input
                type="text"
                value={formEdit.nome}
                onChange={e => setFormEdit(p => ({ ...p, nome: e.target.value }))}
              />
            </div>
            <div className="adm-form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={formEdit.email}
                onChange={e => setFormEdit(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            {editando.usuario.is_admin && editando.usuario.email_admin && (
              <div className="adm-form-group">
                <label>E-mail Admin</label>
                <input type="text" value={editando.usuario.email_admin} disabled className="adm-input-disabled" />
              </div>
            )}
            <div className="adm-form-group">
              <label>Telefone</label>
              <input
                type="text"
                value={formEdit.telefone}
                onChange={e => setFormEdit(p => ({ ...p, telefone: e.target.value }))}
              />
            </div>
            <div className="adm-form-group">
              <label>Data de nascimento</label>
              <input
                type="date"
                value={formEdit.data_nascimento}
                onChange={e => setFormEdit(p => ({ ...p, data_nascimento: e.target.value }))}
              />
            </div>
            <div className="adm-form-group adm-form-check">
              <label>
                <input
                  type="checkbox"
                  checked={formEdit.is_admin}
                  onChange={e => setFormEdit(p => ({ ...p, is_admin: e.target.checked }))}
                />
                Administrador
              </label>
            </div>

            {editando.usuario.cpf && (
              <div className="adm-form-group">
                <label>CPF</label>
                <input type="text" value={mascararCPF(editando.usuario.cpf)} disabled className="adm-input-disabled" />
              </div>
            )}

            <div className="adm-form-group">
              <label>Status</label>
              <input type="text" value={editando.usuario.status} disabled className="adm-input-disabled" />
            </div>

            {editando.mercados.length > 0 && (
              <div className="adm-form-group">
                <label>Mercados Vinculados ({editando.mercados.length})</label>
                <div className="adm-editar-mercados">
                  {editando.mercados.slice(0, mercadosVisiveis).map(m => (
                    <div key={m.id_mercado} className="adm-editar-mercado-item">
                      <div className="adm-editar-mercado-info">
                        <span className="adm-editar-mercado-nome">{m.nome}</span>
                        <span className="adm-editar-mercado-local">{m.cidade}/{m.estado}</span>
                      </div>
                      <div className="adm-editar-mercado-meta">
                        <span className="adm-badge-tipo" style={{ background: '#22c55e22', color: '#22c55e' }}>{m.papel}</span>
                        <span className="adm-editar-mercado-pedidos">{m.total_pedidos} pedidos</span>
                        <button className="adm-btn-detalhes" onClick={() => abrirMercadoDetalhes(m.id_mercado, m.papel)}>
                          Detalhes
                        </button>
                        <button
                          className={m.status === 'bloqueado' ? 'adm-btn-desbloquear' : 'adm-btn-bloquear'}
                          onClick={() => handleBloquearMercado(m.id_mercado)}
                        >
                          {m.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {editando.mercados.length > mercadosVisiveis && (
                  <button className="adm-btn-ver-mais" onClick={() => setMercadosVisiveis(p => p + 3)}>
                    Ver mais ({editando.mercados.length - mercadosVisiveis} restantes)
                  </button>
                )}
                {mercadosVisiveis > 3 && (
                  <button className="adm-btn-ver-menos" onClick={() => setMercadosVisiveis(3)}>
                    Ver menos
                  </button>
                )}
              </div>
            )}

            <div className="adm-modal-actions">
              <button className="adm-btn-cancelar" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="adm-btn-salvar" onClick={salvarEdicao}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Detalhes Mercado ──────────────────────────────── */}
      {mercadoDetalhes && (
        <div className="adm-modal-overlay" onClick={() => setMercadoDetalhes(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <button className="adm-modal-close" onClick={() => setMercadoDetalhes(null)}>
              <CloseIcon />
            </button>
            <h2>Detalhes do Mercado</h2>

            <div className="adm-modal-section">
              <div className="adm-modal-info-grid">
                <div>
                  <label>Nome</label>
                  <span>{String(mercadoDetalhes.mercado.nome ?? '')}</span>
                </div>
                <div>
                  <label>Slug</label>
                  <span>{String(mercadoDetalhes.mercado.slug ?? '')}</span>
                </div>
                <div>
                  <label>CNPJ</label>
                  <span>{mascararCNPJ(String(mercadoDetalhes.mercado.cnpj ?? ''))}</span>
                </div>
                <div>
                  <label>Email</label>
                  <span>{String(mercadoDetalhes.mercado.email ?? '')}</span>
                </div>
                <div>
                  <label>Telefone</label>
                  <span>{mascararTelefone(String(mercadoDetalhes.mercado.telefone ?? ''))}</span>
                </div>
                <div>
                  <label>CEP</label>
                  <span>{mascararCEP(String(mercadoDetalhes.mercado.cep ?? ''))}</span>
                </div>
                <div>
                  <label>Estado</label>
                  <span>{String(mercadoDetalhes.mercado.estado ?? '')}</span>
                </div>
                <div>
                  <label>Cidade</label>
                  <span>{String(mercadoDetalhes.mercado.cidade ?? '')}</span>
                </div>
                <div>
                  <label>Bairro</label>
                  <span>{String(mercadoDetalhes.mercado.bairro ?? '')}</span>
                </div>
                <div>
                  <label>Rua</label>
                  <span>{String(mercadoDetalhes.mercado.rua ?? '')}</span>
                </div>
                <div>
                  <label>Papel do usuario</label>
                  <span className="adm-badge-tipo" style={{ background: '#22c55e22', color: '#22c55e' }}>{mercadoDetalhes.papel}</span>
                </div>
                <div>
                  <label>Status</label>
                  <span className="adm-badge-status" style={{
                    background: (mercadoDetalhes.mercado.status === 'bloqueado' ? '#ef4444' : '#22c55e') + '22',
                    color: mercadoDetalhes.mercado.status === 'bloqueado' ? '#ef4444' : '#22c55e'
                  }}>
                    <span className="adm-status-dot" style={{ background: mercadoDetalhes.mercado.status === 'bloqueado' ? '#ef4444' : '#22c55e' }} />
                    {String(mercadoDetalhes.mercado.status ?? 'ativo')}
                  </span>
                </div>
              </div>
            </div>

            <div className="adm-modal-actions">
              <button
                className={mercadoDetalhes.mercado.status === 'bloqueado' ? 'adm-btn-desbloquear' : 'adm-btn-bloquear'}
                onClick={() => handleBloquearMercado(Number(mercadoDetalhes.mercado.id_mercado))}
              >
                {mercadoDetalhes.mercado.status === 'bloqueado' ? 'Desbloquear mercado' : 'Bloquear mercado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Confirmar Exclusão ────────────────────────────── */}
      {confirmandoExclusao && (
        <div className="adm-modal-overlay" onClick={() => setConfirmandoExclusao(null)}>
          <div className="adm-modal adm-modal-confirmar" onClick={e => e.stopPropagation()}>
            <h2>Excluir Usuario</h2>
            <p>Tem certeza que deseja excluir este usuario? Esta acao nao pode ser desfeita.</p>
            <div className="adm-modal-actions">
              <button className="adm-btn-cancelar" onClick={() => setConfirmandoExclusao(null)}>Cancelar</button>
              <button className="adm-btn-excluir" onClick={() => handleExcluir(confirmandoExclusao)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
