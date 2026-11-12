import { useState, useEffect, useCallback, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { api } from '../../services/api'
import { useToast } from '../../hooks/useToast'
import ToastContainer from '../../components/Toast'
import { uploadImagem, ehImagemValida } from '../../services/upload'
import Imagem from '../../components/Imagem'
import { TIPOS_LOJA, ORDEM_TIPOS } from '../../utils/tiposLoja'

// ─────────────────────────────────────────────────────────────────────────────
//  Aba "Catálogo" do painel do administrador
//
//  CRUD dos produtos genéricos prontos que o vendedor escolhe no card "＋"
//  da vitrine (junto com "criar do zero"). Cada item guarda nome, descrição,
//  fotos, preço sugerido e o tipo de loja em que faz sentido aparecer
//  ('geral' = serve a qualquer tipo).
// ─────────────────────────────────────────────────────────────────────────────

interface ItemCatalogo {
  id: number
  nome: string
  descricao: string
  imagens: string[]
  preco_sugerido: string | number
  tipo_loja: string
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

interface ImagemForm {
  url: string
  file: File | null
}

interface FormState {
  id: number | null
  nome: string
  descricao: string
  preco: string
  tipo_loja: string
  ativo: boolean
}

const MAX_IMAGENS = 8
const MAX_TAMANHO_MB = 5

const FORM_VAZIO: FormState = {
  id: null,
  nome: '',
  descricao: '',
  preco: '',
  tipo_loja: 'geral',
  ativo: true,
}

function formatarMoeda(valor: number | string | undefined) {
  const n = Number(valor ?? 0)
  if (Number.isNaN(n)) return '0,00'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Catalogo() {
  const { toasts, showToast, dismissToast } = useToast()

  const [itens, setItens] = useState<ItemCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const [form, setForm] = useState<FormState | null>(null)
  const [imagens, setImagens] = useState<ImagemForm[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState('')
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const dados: ItemCatalogo[] = await api.adminCatalogo()
      setItens(Array.isArray(dados) ? dados : [])
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o catálogo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Adia um instante: assim o carregamento não dispara setState de forma
    // síncrona dentro do efeito (mesmo comportamento, sem o alerta do React)
    Promise.resolve().then(carregar)
  }, [carregar])

  // ── Filtros (client-side: o catálogo é pequeno) ────────────────────────────
  const filtrados = itens.filter(item => {
    const termo = busca.trim().toLowerCase()
    const okBusca =
      !termo ||
      item.nome.toLowerCase().includes(termo) ||
      (item.descricao ?? '').toLowerCase().includes(termo)
    const okTipo = !filtroTipo || item.tipo_loja === filtroTipo
    return okBusca && okTipo
  })

  const totalAtivos = itens.filter(i => i.ativo).length

  // ── Formulário ─────────────────────────────────────────────────────────────
  function abrirNovo() {
    setForm({ ...FORM_VAZIO })
    setImagens([])
    setErroForm('')
  }

  function abrirEdicao(item: ItemCatalogo) {
    setForm({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao ?? '',
      preco: Number(item.preco_sugerido) > 0 ? String(item.preco_sugerido) : '',
      tipo_loja: item.tipo_loja,
      ativo: item.ativo,
    })
    setImagens((item.imagens ?? []).map(url => ({ url, file: null })))
    setErroForm('')
  }

  function fecharForm() {
    if (salvando) return
    setForm(null)
    setImagens([])
  }

  function adicionarArquivos(files: FileList | null) {
    if (!files) return
    const lista = Array.from(files)
    const validas = lista.filter(
      f => ehImagemValida(f) && f.size <= MAX_TAMANHO_MB * 1024 * 1024
    )
    if (validas.length !== lista.length) {
      showToast('erro', `Só imagens de até ${MAX_TAMANHO_MB} MB foram aceitas.`)
    }
    const vagas = MAX_IMAGENS - imagens.length
    if (validas.length > vagas) {
      showToast('erro', `Máximo de ${MAX_IMAGENS} imagens por item.`)
    }
    validas.slice(0, Math.max(0, vagas)).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => {
        const url = e.target?.result
        if (typeof url === 'string') {
          setImagens(prev => [...prev, { url, file }])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function removerImagem(idx: number) {
    setImagens(prev => prev.filter((_, i) => i !== idx))
  }

  // Salva na pasta imagens/catalogo/ do backend (URL que vai para o banco)
  // e mantém cópia de backup no Supabase.
  async function uploadParaSupabase(file: File): Promise<string | null> {
    return uploadImagem(file, 'catalogo')
  }

  async function salvar() {
    if (!form) return
    const nome = form.nome.trim()
    if (!nome) {
      setErroForm('Informe o nome do produto.')
      return
    }

    setSalvando(true)
    setErroForm('')

    try {
      // Upload apenas das imagens novas (as já salvas mantêm a URL)
      const urls: string[] = []
      for (const img of imagens) {
        if (img.file) {
          const url = await uploadParaSupabase(img.file)
          if (!url) {
            setErroForm('Não foi possível enviar uma das imagens. Tente novamente.')
            return
          }
          urls.push(url)
        } else {
          urls.push(img.url)
        }
      }

      const precoNum = Number(form.preco.replace(/\./g, '').replace(',', '.'))
      const dados = {
        nome,
        descricao: form.descricao.trim(),
        imagens: urls,
        preco_sugerido: Number.isFinite(precoNum) && precoNum >= 0 ? precoNum : 0,
        tipo_loja: form.tipo_loja,
      }

      if (form.id === null) {
        const novo: ItemCatalogo = await api.adminCriarCatalogo(dados)
        setItens(prev => [novo, ...prev])
        showToast('sucesso', 'Item adicionado ao catálogo!')
      } else {
        const atualizado: ItemCatalogo = await api.adminAtualizarCatalogo(form.id, {
          ...dados,
          ativo: form.ativo,
        })
        setItens(prev => prev.map(i => (i.id === atualizado.id ? atualizado : i)))
        showToast('sucesso', 'Item do catálogo atualizado!')
      }

      setForm(null)
      setImagens([])
    } catch (e: unknown) {
      setErroForm(e instanceof Error ? e.message : 'Erro ao salvar o item.')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(item: ItemCatalogo) {
    try {
      const atualizado: ItemCatalogo = await api.adminAtualizarCatalogo(item.id, {
        ativo: !item.ativo,
      })
      setItens(prev => prev.map(i => (i.id === atualizado.id ? atualizado : i)))
      showToast(
        'sucesso',
        atualizado.ativo ? `"${item.nome}" reativado.` : `"${item.nome}" ocultado do catálogo.`
      )
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao alterar o item.')
    }
  }

  async function excluir(item: ItemCatalogo) {
    try {
      await api.adminExcluirCatalogo(item.id)
      setItens(prev => prev.filter(i => i.id !== item.id))
      showToast('sucesso', 'Item removido do catálogo.')
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao excluir o item.')
    } finally {
      setConfirmandoId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="adm-catalogo">
      <div className="adm-stats-grid">
        <div className="adm-stat-card" style={{ borderTopColor: '#4a7fd4' }}>
          <div className="adm-stat-info">
            <span className="adm-stat-val">{itens.length}</span>
            <span className="adm-stat-lbl">Itens no catálogo</span>
          </div>
        </div>
        <div className="adm-stat-card" style={{ borderTopColor: '#22c55e' }}>
          <div className="adm-stat-info">
            <span className="adm-stat-val">{totalAtivos}</span>
            <span className="adm-stat-lbl">Visíveis ao vendedor</span>
          </div>
        </div>
        <div className="adm-stat-card" style={{ borderTopColor: '#94a3b8' }}>
          <div className="adm-stat-info">
            <span className="adm-stat-val">{itens.length - totalAtivos}</span>
            <span className="adm-stat-lbl">Ocultos</span>
          </div>
        </div>
      </div>

      <div className="adm-toolbar">
        <div className="adm-search">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar por nome ou descrição..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <div className="adm-filtros-row">
          <select
            className="adm-select"
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {ORDEM_TIPOS.map(tipo => (
              <option key={tipo} value={tipo}>{TIPOS_LOJA[tipo] ?? tipo}</option>
            ))}
          </select>
          <button className="adm-btn-promover" onClick={abrirNovo}>
            + Novo item
          </button>
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
        <div className="adm-table-wrapper">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Tipo de loja</th>
                <th>Preço sugerido</th>
                <th>Fotos</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="adm-empty">
                    {itens.length === 0
                      ? 'Nenhum item no catálogo ainda — clique em "Novo item" para começar.'
                      : 'Nenhum item encontrado para os filtros atuais.'}
                  </td>
                </tr>
              )}
              {filtrados.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="adm-catalogo-celula">
                      {item.imagens?.[0] ? (
                        <Imagem src={item.imagens[0]} alt="" className="adm-catalogo-thumb" sizes="42px" />
                      ) : (
                        <span className="adm-catalogo-thumb adm-catalogo-thumb--vazio">S/F</span>
                      )}
                      <div className="adm-celula-dupla">
                        <span className="adm-user-name">{item.nome}</span>
                        {item.descricao && (
                          <span className="adm-muted">
                            {item.descricao.length > 60
                              ? `${item.descricao.slice(0, 60)}…`
                              : item.descricao}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{TIPOS_LOJA[item.tipo_loja] ?? item.tipo_loja}</td>
                  <td>
                    {Number(item.preco_sugerido) > 0
                      ? `R$ ${formatarMoeda(item.preco_sugerido)}`
                      : '-'}
                  </td>
                  <td>{item.imagens?.length ?? 0}</td>
                  <td>
                    <span
                      className="adm-badge-status"
                      style={{
                        background: item.ativo ? '#22c55e22' : '#94a3b822',
                        color: item.ativo ? '#22c55e' : '#64748b',
                      }}
                    >
                      <span
                        className="adm-status-dot"
                        style={{ background: item.ativo ? '#22c55e' : '#64748b' }}
                      />
                      {item.ativo ? 'Visível' : 'Oculto'}
                    </span>
                  </td>
                  <td>
                    <div className="adm-acoes-cell">
                      <button className="adm-btn-detalhes" onClick={() => abrirEdicao(item)}>
                        Editar
                      </button>
                      <button
                        className={item.ativo ? 'adm-btn-remover-admin' : 'adm-btn-promover'}
                        onClick={() => alternarAtivo(item)}
                      >
                        {item.ativo ? 'Ocultar' : 'Ativar'}
                      </button>
                      {confirmandoId === item.id ? (
                        <button className="adm-btn-remover-admin" onClick={() => excluir(item)}>
                          Confirmar exclusão?
                        </button>
                      ) : (
                        <button
                          className="adm-btn-remover-admin"
                          onClick={() => setConfirmandoId(item.id)}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modal de criação/edição ─────────────────────────────────────────── */}
      {form && (
        <div className="adm-modal-overlay">
          <div className="adm-modal adm-modal--form" onClick={e => e.stopPropagation()}>
            <button className="adm-modal-close" aria-label="Fechar" onClick={fecharForm}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="adm-modal-header">
              <div>
                <h2>{form.id === null ? 'Novo item do catálogo' : 'Editar item do catálogo'}</h2>
                <p>Este conteúdo aparece para o vendedor escolher como "produto pronto".</p>
              </div>
            </div>

            <section className="adm-modal-section">
              <div className="adm-form-group">
                <label>Nome do produto *</label>
                <input
                  type="text"
                  className="adm-input"
                  value={form.nome}
                  maxLength={150}
                  placeholder="Ex: Arroz integral 1 kg"
                  onChange={e => setForm(f => (f ? { ...f, nome: e.target.value } : f))}
                />
              </div>

              <div className="adm-form-group">
                <label>Descrição</label>
                <textarea
                  className="adm-textarea"
                  rows={3}
                  maxLength={500}
                  placeholder="Detalhes: marca, quantidade, variante…"
                  value={form.descricao}
                  onChange={e => setForm(f => (f ? { ...f, descricao: e.target.value } : f))}
                />
                <span className="adm-form-hint">{form.descricao.length}/500</span>
              </div>

              <div className="adm-form-campos-linha">
                <div className="adm-form-group">
                  <label>Preço sugerido (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="adm-input"
                    placeholder="0,00"
                    value={form.preco}
                    onChange={e => setForm(f => (f ? { ...f, preco: e.target.value } : f))}
                  />
                </div>
                <div className="adm-form-group">
                  <label>Tipo de loja</label>
                  <select
                    className="adm-select"
                    value={form.tipo_loja}
                    onChange={e => setForm(f => (f ? { ...f, tipo_loja: e.target.value } : f))}
                  >
                    {ORDEM_TIPOS.map(tipo => (
                      <option key={tipo} value={tipo}>{TIPOS_LOJA[tipo] ?? tipo}</option>
                    ))}
                  </select>
                </div>
                {form.id !== null && (
                  <div className="adm-form-group">
                    <label>Visível no catálogo</label>
                    <label className="adm-form-check">
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={e => setForm(f => (f ? { ...f, ativo: e.target.checked } : f))}
                      />
                      Item aparece para o vendedor
                    </label>
                  </div>
                )}
              </div>

              <div className="adm-form-group">
                <label>Imagens (máx. {MAX_IMAGENS})</label>
                <div
                  className="adm-catalogo-upload"
                  onClick={() => inputFileRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && inputFileRef.current?.click()}
                >
                  <input
                    ref={inputFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    hidden
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      adicionarArquivos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  + Adicionar imagens
                </div>
                {imagens.length > 0 && (
                  <div className="adm-catalogo-miniaturas">
                    {imagens.map((img, i) => (
                      <div key={i} className="adm-catalogo-miniatura">
                        <Imagem src={img.url} alt={`Imagem ${i + 1}`} sizes="64px" />
                        <button
                          type="button"
                          onClick={() => removerImagem(i)}
                          aria-label="Remover imagem"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {erroForm && <p className="adm-erro adm-erro--form">{erroForm}</p>}
            </section>

            <div className="adm-modal-actions">
              <button
                className="adm-btn-detalhes"
                onClick={fecharForm}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button
                className="adm-btn-promover"
                onClick={salvar}
                disabled={salvando}
              >
                {salvando ? 'Salvando…' : form.id === null ? 'Adicionar ao catálogo' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
