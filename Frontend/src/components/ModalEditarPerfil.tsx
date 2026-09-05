import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { removeEmojis } from '../hooks/useBlockEmojis';
import { api } from '../services/api';
import { supabase } from '../services/supabase';
import ToastContainer from './Toast';
import LoadingOverlay from './LoadingOverlay';
import { IconCamera, IconCheck, IconX } from './Icons';

interface Props {
  onFechar: () => void;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function formatarCPF(cpf: string) {
  const nums = cpf.replace(/\D/g, '');
  if (nums.length !== 11) return cpf;
  return `${nums.slice(0,3)}.${nums.slice(3,6)}.${nums.slice(6,9)}-${nums.slice(9)}`;
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
    data_nascimento: usuario?.data_nascimento ?? '',
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
      let foto_perfil_url: string | undefined;

      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop() || 'webp';
        const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const caminho = `usuarios/${nomeArquivo}`;

        const { error } = await supabase.storage
          .from('imagens')
          .upload(caminho, fotoFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Erro ao enviar foto:', error);
          showToast('erro', 'Erro ao enviar foto de perfil.');
          setSalvando(false);
          return;
        }

        const { data } = supabase.storage
          .from('imagens')
          .getPublicUrl(caminho);

        foto_perfil_url = data.publicUrl;
      }

      await api.atualizar({
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        data_nascimento: form.data_nascimento || null,
        foto_perfil_url,
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
              <input
                className="pu-modal-input"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: removeEmojis(e.target.value) }))}
                placeholder="Seu nome completo"
                maxLength={150}
                autoComplete="name"
              />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Email</label>
              <input
                className="pu-modal-input"
                type="email"
                value={form.email}
                readOnly
                placeholder="seu@email.com"
                autoComplete="email"
              />
              <span className="pu-input-hint">O email não pode ser alterado</span>
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">CPF</label>
              <input
                className="pu-modal-input"
                value={usuario?.cpf ? formatarCPF(usuario.cpf) : 'Não informado'}
                readOnly
                placeholder="000.000.000-00"
              />
              <span className="pu-input-hint">O CPF não pode ser alterado</span>
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Telefone</label>
              <input
                className="pu-modal-input"
                type="tel"
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: removeEmojis(e.target.value) }))}
                placeholder="(00) 00000-0000"
                maxLength={15}
                autoComplete="tel"
              />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Data de Aniversário</label>
              <input
                className="pu-modal-input"
                value={form.data_nascimento ? (() => {
                  const raw = form.data_nascimento.slice(0, 10);
                  const [y, m, d] = raw.split("-");
                  return `${d}/${m}/${y}`;
                })() : 'Não informado'}
                readOnly
              />
              <span className="pu-input-hint">A data de nascimento não pode ser alterada</span>
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
