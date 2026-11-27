import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import { useToast } from '../../hooks/useToast'
import ToastContainer from '../../components/Toast'
import { LIMITS, bloquearEspaco, sanitizeEmail, sanitizePassword } from '../../hooks/useBlockEmojis'
import { IconCamera, IconLock, IconUser } from '../../components/Icons'
import { onAvatarError } from '../../utils/imagens'

export default function Configuracoes() {
  const { usuario, refreshUsuario } = useAuth()
  const { toasts, showToast, dismissToast } = useToast()

  const [formPerfil, setFormPerfil] = useState({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    telefone: usuario?.telefone ?? '',
    data_nascimento: usuario?.data_nascimento?.slice(0, 10) ?? '',
    foto_perfil_url: usuario?.foto_perfil ?? '',
  })
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  const [formSenha, setFormSenha] = useState({
    senha_atual: '',
    nova_senha: '',
    confirmar_senha: '',
  })
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [urlInput, setUrlInput] = useState(false)

  const iniciais = usuario?.nome
    ?.split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AD'

  async function handleSalvarPerfil() {
    if (!formPerfil.nome.trim()) {
      showToast('aviso', 'O nome é obrigatório')
      return
    }
    setSalvandoPerfil(true)
    try {
      await api.atualizar({
        nome: formPerfil.nome.trim(),
        email: formPerfil.email.trim(),
        telefone: formPerfil.telefone.trim() || undefined,
        data_nascimento: formPerfil.data_nascimento || null,
        foto_perfil_url: formPerfil.foto_perfil_url.trim() || undefined,
      })
      await refreshUsuario()
      showToast('sucesso', 'Perfil atualizado com sucesso')
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao salvar perfil')
    } finally {
      setSalvandoPerfil(false)
    }
  }

  async function handleTrocarSenha() {
    if (!formSenha.senha_atual) { showToast('aviso', 'Informe a senha atual'); return }
    if (!formSenha.nova_senha) { showToast('aviso', 'Informe a nova senha'); return }
    if (formSenha.nova_senha.length < 6) { showToast('aviso', 'A nova senha deve ter pelo menos 6 caracteres'); return }
    if (formSenha.nova_senha !== formSenha.confirmar_senha) { showToast('aviso', 'As senhas não conferem'); return }
    setSalvandoSenha(true)
    try {
      await api.trocarSenha({ senha_atual: formSenha.senha_atual, nova_senha: formSenha.nova_senha })
      setFormSenha({ senha_atual: '', nova_senha: '', confirmar_senha: '' })
      showToast('sucesso', 'Senha redefinida com sucesso')
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Erro ao redefinir senha')
    } finally {
      setSalvandoSenha(false)
    }
  }

  return (
    <div className="adm-config">

      {/* ── Hero do perfil ─────────────────────────────────────── */}
      <div className="adm-config-hero">
        <div className="adm-config-hero-bg" />
        <div className="adm-config-hero-body">
          <div className="adm-config-hero-avatar-wrap">
            <div className="adm-config-hero-avatar">
              {usuario?.foto_perfil
                ? <img src={usuario.foto_perfil} alt={usuario.nome} onError={onAvatarError} />
                : <span>{iniciais}</span>
              }
              <button
                className="adm-config-hero-cam"
                title="Alterar foto"
                onClick={() => setUrlInput(v => !v)}
                type="button"
              >
                <IconCamera size={14} />
              </button>
            </div>
          </div>
          <div className="adm-config-hero-info">
            <div className="adm-config-hero-badge">Administrador</div>
            <h2 className="adm-config-hero-nome">{usuario?.nome ?? '—'}</h2>
            <p className="adm-config-hero-email">{usuario?.email ?? '—'}</p>
          </div>
        </div>

        {urlInput && (
          <div className="adm-config-url-row">
            <input
              className="adm-config-url-input"
              type="text"
              placeholder="Cole a URL da foto de perfil aqui..."
              value={formPerfil.foto_perfil_url}
              onChange={e => setFormPerfil(p => ({ ...p, foto_perfil_url: e.target.value }))}
            />
            <button
              className="adm-config-url-ok"
              onClick={() => setUrlInput(false)}
              type="button"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* ── Dados pessoais ─────────────────────────────────────── */}
      <div className="adm-config-card">
        <div className="adm-config-card-header">
          <span className="adm-config-card-icon"><IconUser size={16} /></span>
          <div>
            <h3 className="adm-config-card-title">Dados pessoais</h3>
            <p className="adm-config-card-sub">Atualize suas informações de perfil.</p>
          </div>
        </div>

        <div className="adm-config-grid">
          <div className="adm-config-field">
            <label>Nome completo</label>
            <input
              type="text"
              placeholder="Seu nome"
              value={formPerfil.nome}
              onChange={e => setFormPerfil(p => ({ ...p, nome: e.target.value }))}
            />
          </div>
          <div className="adm-config-field">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={formPerfil.email}
              maxLength={LIMITS.email}
              onChange={e => setFormPerfil(p => ({ ...p, email: sanitizeEmail(e.target.value) }))}
              onKeyDown={bloquearEspaco}
            />
          </div>
          <div className="adm-config-field">
            <label>Telefone</label>
            <input
              type="text"
              placeholder="(XX) XXXXX-XXXX"
              value={formPerfil.telefone}
              onChange={e => setFormPerfil(p => ({ ...p, telefone: e.target.value }))}
            />
          </div>
          <div className="adm-config-field">
            <label>Data de nascimento</label>
            <input
              type="date"
              value={formPerfil.data_nascimento}
              onChange={e => setFormPerfil(p => ({ ...p, data_nascimento: e.target.value }))}
            />
          </div>
        </div>

        <div className="adm-config-footer">
          <button className="adm-config-btn-salvar" onClick={handleSalvarPerfil} disabled={salvandoPerfil}>
            {salvandoPerfil ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* ── Segurança ──────────────────────────────────────────── */}
      <div className="adm-config-card">
        <div className="adm-config-card-header">
          <span className="adm-config-card-icon adm-config-card-icon--lock"><IconLock size={16} /></span>
          <div>
            <h3 className="adm-config-card-title">Segurança da conta</h3>
            <p className="adm-config-card-sub">Altere sua senha de acesso ao painel.</p>
          </div>
        </div>

        <div className="adm-config-senha-grid">
          <div className="adm-config-field adm-config-field--full">
            <label>Senha atual</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formSenha.senha_atual}
              onChange={e => setFormSenha(p => ({ ...p, senha_atual: sanitizePassword(e.target.value) }))}
              maxLength={LIMITS.senha}
              onKeyDown={bloquearEspaco}
            />
          </div>
          <div className="adm-config-field">
            <label>Nova senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formSenha.nova_senha}
              onChange={e => setFormSenha(p => ({ ...p, nova_senha: sanitizePassword(e.target.value) }))}
              maxLength={LIMITS.senha}
              onKeyDown={bloquearEspaco}
            />
          </div>
          <div className="adm-config-field">
            <label>Confirmar nova senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formSenha.confirmar_senha}
              onChange={e => setFormSenha(p => ({ ...p, confirmar_senha: sanitizePassword(e.target.value) }))}
              maxLength={LIMITS.confirmar}
              onKeyDown={bloquearEspaco}
            />
          </div>
        </div>

        <div className="adm-config-footer">
          <button className="adm-config-btn-salvar adm-config-btn-salvar--sec" onClick={handleTrocarSenha} disabled={salvandoSenha}>
            {salvandoSenha ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
