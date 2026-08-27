import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { removeEmojis } from '../hooks/useBlockEmojis';
import ToastContainer from './Toast';
import LoadingOverlay from './LoadingOverlay';
import { IconCamera, IconCheck, IconX } from './Icons';

interface Props {
  onFechar: () => void;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

export default function ModalEditarPerfil({ onFechar }: Props) {
  const { usuario, refreshUsuario } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    telefone: usuario?.telefone ?? '',
  });

  const [foto, setFoto] = useState<string | undefined>(
    usuario?.foto_perfil ?? undefined
  );
  const [fotoFile, setFotoFile] = useState<File | undefined>();

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('erro', 'Imagem muito grande. Máximo 5MB.');
      return;
    }
    setFotoFile(file);
    const canvas = document.createElement('canvas');
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const MAX = 512;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        setFoto(canvas.toDataURL('image/webp', 0.92));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function salvar() {
    if (!form.nome.trim()) return showToast('erro', 'Nome é obrigatório.');

    setSalvando(true);
    try {
      await api.atualizar({
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        foto_perfil: fotoFile,
      });
      await refreshUsuario();
      showToast('sucesso', 'Perfil atualizado com sucesso!');
      setTimeout(() => onFechar(), 1200);
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
            <h2 className="pu-modal-title">Editar Perfil</h2>
            <button className="pu-modal-close" onClick={onFechar}>✕</button>
          </div>

          <div className="pu-modal-avatar">
            <div className="pu-modal-photo-wrap">
              {foto
                ? <img src={foto} alt="Foto de perfil" className="pu-modal-photo-img" />
                : <span className="pu-modal-av-circle">{iniciais}</span>
              }
              <button
                type="button"
                className="pu-modal-photo-btn"
                onClick={() => inputFotoRef.current?.click()}
                title="Alterar foto"
              >
                <IconCamera size={16} />
              </button>
            </div>
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFoto}
            />
          </div>

          <div className="pu-modal-body">
            <div className="pu-modal-group">
              <label className="pu-modal-label">Nome</label>
              <input className="pu-modal-input" value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: removeEmojis(e.target.value) }))} placeholder="Seu nome" />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Email</label>
              <input className="pu-modal-input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: removeEmojis(e.target.value) }))} placeholder="seu@email.com" />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Telefone</label>
              <input className="pu-modal-input" value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: removeEmojis(e.target.value) }))} placeholder="(11) 99999-9999" />
            </div>

            <div className="pu-status-section">
              <label className="pu-modal-label">Status do Perfil</label>
              <div className="pu-status-grid">
                <div className="pu-status-item">
                  {usuario?.nome ? <IconCheck size={14} className="pu-status-ok" /> : <IconX size={14} className="pu-status-fail" />}
                  <span>Nome preenchido</span>
                </div>
                <div className="pu-status-item">
                  {usuario?.email ? <IconCheck size={14} className="pu-status-ok" /> : <IconX size={14} className="pu-status-fail" />}
                  <span>Email cadastrado</span>
                </div>
                <div className="pu-status-item">
                  {usuario?.telefone ? <IconCheck size={14} className="pu-status-ok" /> : <IconX size={14} className="pu-status-fail" />}
                  <span>Telefone informado</span>
                </div>
                <div className="pu-status-item">
                  {foto ? <IconCheck size={14} className="pu-status-ok" /> : <IconX size={14} className="pu-status-fail" />}
                  <span>Foto de perfil</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pu-modal-footer">
            <button className="pu-modal-btn-cancel" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button className="pu-modal-btn-save" onClick={salvar} disabled={salvando}>
              Salvar
            </button>
          </div>

        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
