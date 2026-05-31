import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import ToastContainer from './Toast';
import LoadingOverlay from './LoadingOverlay';

interface Props {
  onFechar: () => void;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

export default function ModalEditarPerfil({ onFechar }: Props) {
  const { usuario } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    telefone: usuario?.telefone ?? '',
  });

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  async function salvar() {
    if (!form.nome.trim()) return showToast('erro', 'Nome é obrigatório.');

    setSalvando(true);
    try {
      const { api } = await import('../services/api');
      const dados: Record<string, string> = {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
      };
      await api.atualizar(dados);
      showToast('sucesso', 'Perfil atualizado com sucesso!');
      setTimeout(() => {
        onFechar();
        window.location.reload();
      }, 1200);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <>
      {salvando && <LoadingOverlay mensagem="Salvando perfil..." />}

      <div className="pu-modal-overlay" onClick={onFechar}>
        <div className="pu-modal" onClick={e => e.stopPropagation()}>

          <div className="pu-modal-header">
            <h2 className="pu-modal-title">✏️ Editar Perfil</h2>
            <button className="pu-modal-close" onClick={onFechar}>✕</button>
          </div>

          <div className="pu-modal-avatar">
            <div className="pu-modal-av-circle">{iniciais}</div>
          </div>

          <div className="pu-modal-body">
            <div className="pu-modal-group">
              <label className="pu-modal-label">Nome</label>
              <input className="pu-modal-input" value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome" />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Email</label>
              <input className="pu-modal-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Telefone</label>
              <input className="pu-modal-input" value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="pu-modal-footer">
            <button className="pu-modal-btn-cancel" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button className="pu-modal-btn-save" onClick={salvar} disabled={salvando}>
              💾 Salvar
            </button>
          </div>

        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}