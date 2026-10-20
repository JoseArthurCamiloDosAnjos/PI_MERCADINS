import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import ToastContainer from './Toast';
import { api } from '../services/api';
import './AvaliacoesModal.css';

interface Avaliacao {
  id: number;
  nota: number;
  texto: string;
  data_cadastro: string;
  cliente: string;
  minha: boolean;
}

interface AvaliacoesModalProps {
  mercadoId: number;
  onFechar: () => void;
  /** Atualiza a média exibida no cabeçalho da vitrine após enviar */
  onAtualizar?: (media: number, total: number) => void;
}

function Estrelas({ nota, tamanho = 14, interativas = false, onEscolher, onHover }: {
  nota: number;
  tamanho?: number;
  interativas?: boolean;
  onEscolher?: (n: number) => void;
  onHover?: (n: number) => void;
}) {
  return (
    <div className={`avm-estrelas ${interativas ? 'avm-estrelas--interativas' : ''}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        const cheia = n <= nota;
        return (
          <button
            key={n}
            type="button"
            className={`avm-estrela ${cheia ? 'cheia' : ''}`}
            disabled={!interativas}
            onClick={interativas && onEscolher ? () => onEscolher(n) : undefined}
            onMouseEnter={interativas && onHover ? () => onHover(n) : undefined}
            onMouseLeave={interativas && onHover ? () => onHover(0) : undefined}
            title={interativas ? `${n} estrela${n > 1 ? 's' : ''}` : undefined}
            aria-label={interativas ? `Avaliar com ${n} estrela${n > 1 ? 's' : ''}` : undefined}
          >
            <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={cheia ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
              <path d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.8L12 17.7 5.9 20.9l1.5-6.8-5.1-4.6 6.8-.7L12 2.5Z" strokeLinejoin="round" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

export default function AvaliacoesModal({ mercadoId, onFechar, onAtualizar }: AvaliacoesModalProps) {
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();

  const logado = !!localStorage.getItem('token');

  const [carregando, setCarregando] = useState(true);
  const [media, setMedia] = useState(0);
  const [total, setTotal] = useState(0);
  const [lista, setLista] = useState<Avaliacao[]>([]);

  const [nota, setNota] = useState(0);
  const [notaHover, setNotaHover] = useState(0);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const notaExibida = notaHover || nota;

  const carregar = useCallback(() =>
    api.avaliacoesMercado(mercadoId)
      .then(data => {
        setMedia(data.media ?? 0);
        setTotal(data.total ?? 0);
        setLista(data.avaliacoes ?? []);

        // Minha avaliação já existente vira o valor inicial do formulário
        const minha = (data.avaliacoes ?? []).find((a: Avaliacao) => a.minha);
        if (minha) {
          setNota(minha.nota);
          setTexto(minha.texto ?? '');
        }
      })
      .catch(err => {
        console.error('Erro ao carregar avaliações:', err);
      })
      .finally(() => {
        setCarregando(false);
      }),
    [mercadoId]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const jaAvaliou = lista.some(a => a.minha);

  async function enviar() {
    if (nota < 1) {
      showToast('erro', 'Escolha de 1 a 5 estrelas.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.criarAvaliacao(mercadoId, { nota, texto });
      showToast('sucesso', jaAvaliou ? 'Avaliação atualizada!' : 'Avaliação enviada. Obrigado!');
      setMedia(res.media ?? 0);
      setTotal(res.total ?? 0);
      onAtualizar?.(res.media ?? 0, res.total ?? 0);
      await carregar();
    } catch (err) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível enviar a avaliação.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="avm-overlay" onClick={onFechar}>
        <div className="avm-modal" onClick={e => e.stopPropagation()}>
          <div className="avm-header">
            <h2 className="avm-title">Avaliações do mercado</h2>
            <button className="avm-close" onClick={onFechar} aria-label="Fechar">✕</button>
          </div>

          {/* Média geral */}
          <div className="avm-media">
            <span className="avm-media-num">{media.toFixed(1)}</span>
            <div className="avm-media-info">
              <Estrelas nota={Math.round(media)} />
              <span className="avm-media-total">
                {total} avaliaç{total === 1 ? 'ão' : 'ões'}
              </span>
            </div>
          </div>

          {/* Formulário */}
          {logado ? (
            <div className="avm-form">
              <p className="avm-form-label">
                {jaAvaliou ? 'Sua avaliação' : 'Deixe sua avaliação'}
              </p>
              <Estrelas
                nota={notaExibida}
                tamanho={26}
                interativas
                onEscolher={setNota}
                onHover={setNotaHover}
              />
              <textarea
                className="avm-textarea"
                placeholder="Conte como foi sua experiência nesta loja (opcional)"
                maxLength={500}
                rows={3}
                value={texto}
                onChange={e => setTexto(e.target.value)}
              />
              <button className="avm-btn-enviar" onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando...' : jaAvaliou ? 'Atualizar avaliação' : 'Enviar avaliação'}
              </button>
            </div>
          ) : (
            <div className="avm-login">
              <p>Faça login para avaliar este mercado.</p>
              <button className="avm-btn-enviar" onClick={() => navigate('/auth')}>
                Fazer login
              </button>
            </div>
          )}

          {/* Lista de avaliações */}
          <div className="avm-lista">
            {carregando ? (
              <p className="avm-vazio">Carregando avaliações...</p>
            ) : lista.length === 0 ? (
              <p className="avm-vazio">Este mercado ainda não recebeu avaliações. Seja o primeiro!</p>
            ) : (
              lista.map(a => (
                <div key={a.id} className={`avm-item ${a.minha ? 'avm-item--minha' : ''}`}>
                  <div className="avm-item-topo">
                    <span className="avm-item-nome">
                      {a.cliente.split(' ')[0]}
                      {a.minha && <em className="avm-badge">Sua avaliação</em>}
                    </span>
                    <Estrelas nota={a.nota} tamanho={13} />
                  </div>
                  {a.texto && <p className="avm-item-texto">{a.texto}</p>}
                  <span className="avm-item-data">{formatarData(a.data_cadastro)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
