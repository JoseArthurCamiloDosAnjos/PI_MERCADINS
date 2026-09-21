import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import { useToast } from '../../hooks/useToast'
import ToastContainer from '../../components/Toast'
import { IconCamera, IconLock, IconUser } from '../../components/Icons'

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

  const iniciais = usuario?.nome
    ?.split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'AD'

  async function handleSalvarPerfil() {
    if (!formPerfil.nome.trim()) {
      showToast('aviso', 'O nome e obrigatorio')
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
    if (!formSenha.senha_atual) {
      showToast('aviso', 'Informe a senha atual')
      return
    }
    if (!formSenha.nova_senha) {
      showToast('aviso', 'Informe a nova senha')
      return
    }
    if (formSenha.nova_senha.length < 6) {
      showToast('aviso', 'A nova senha deve ter pelo menos 6 caracteres')
      return
    }
    if (formSenha.nova_senha !== formSenha.confirmar_senha) {
      showToast('aviso', 'As senhas nao conferem')
      return
    }
    setSalvandoSenha(true)
    try {
      await api.trocarSenha({
        senha_atual: formSenha.senha_atual,
        nova_senha: formSenha.nova_senha,
      })
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

      {/* ─── Perfil ────────────────────────────────────────────── */}
      <div className="adm-config-section">
        <h3><IconUser size={18} /> Perfil do Administrador</h3>
        <p className="adm-config-desc">Atualize suas informacoes pessoais.</p>

        <div className="adm-config-avatar-area">
          <div className="adm-config-avatar">
            {usuario?.foto_perfil
              ? <img src={usuario.foto_perfil} alt={usuario.nome} />
              : iniciais
            }
            <label className="adm-config-avatar-overlay">
              <IconCamera size={18} />
              <input
                type="text"
                placeholder="URL da foto"
                value={formPerfil.foto_perfil_url}
                onChange={e => setFormPerfil(p => ({ ...p, foto_perfil_url: e.target.value }))}
                className="adm-config-avatar-input"
              />
            </label>
          </div>
        </div>

        <div className="adm-config-form">
          <div className="adm-config-field">
            <label>Nome completo</label>
            <input
              type="text"
              value={formPerfil.nome}
              onChange={e => setFormPerfil(p => ({ ...p, nome: e.target.value }))}
            />
          </div>
          <div className="adm-config-field">
            <label>E-mail</label>
            <input
              type="email"
              value={formPerfil.email}
              onChange={e => setFormPerfil(p => ({ ...p, email: e.target.value }))}
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

        <div className="adm-config-actions">
          <button className="adm-btn-salvar" onClick={handleSalvarPerfil} disabled={salvandoPerfil}>
            {salvandoPerfil ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </div>
      </div>

      {/* ─── Senha ─────────────────────────────────────────────── */}
      <div className="adm-config-section">
        <h3><IconLock size={18} /> Redefinir Senha</h3>
        <p className="adm-config-desc">Altere sua senha de acesso.</p>

        <div className="adm-config-form">
          <div className="adm-config-field">
            <label>Senha atual</label>
            <input
              type="password"
              placeholder="Digite sua senha atual"
              value={formSenha.senha_atual}
              onChange={e => setFormSenha(p => ({ ...p, senha_atual: e.target.value }))}
            />
          </div>
          <div className="adm-config-field">
            <label>Nova senha</label>
            <input
              type="password"
              placeholder="Digite a nova senha"
              value={formSenha.nova_senha}
              onChange={e => setFormSenha(p => ({ ...p, nova_senha: e.target.value }))}
            />
          </div>
          <div className="adm-config-field">
            <label>Confirmar nova senha</label>
            <input
              type="password"
              placeholder="Confirme a nova senha"
              value={formSenha.confirmar_senha}
              onChange={e => setFormSenha(p => ({ ...p, confirmar_senha: e.target.value }))}
            />
          </div>
        </div>

        <div className="adm-config-actions">
          <button className="adm-btn-salvar" onClick={handleTrocarSenha} disabled={salvandoSenha}>
            {salvandoSenha ? 'Redefinindo...' : 'Redefinir senha'}
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
