import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/Toast';
import {
  IconArrowLeft,
  IconMapPin,
  IconStore,
} from '../../components/Icons';
import './Favoritos.css';

// Estrela preenchida (mesmo desenho das vitrines)
function IconStar({ size = 14, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 2.5l2.9 6.3 6.8.7-5.1 4.6 1.5 6.8L12 17.7 5.9 20.9l1.5-6.8-5.1-4.6 6.8-.7L12 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}

// Coração cheio (mesmo desenho das vitrines)
function IconHeart({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Página "Meus favoritos" (B5): lista as lojas que o cliente favoritou,
//  com foto, cidade e nota — e permite remover direto daqui.
// ─────────────────────────────────────────────────────────────────────────────

interface Favorito {
  id: number;
  id_mercado: number;
  nome: string;
  slug: string | null;
  foto_perfil: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  avaliacao: number;
  num_avaliacoes: number;
}

export default function Favoritos() {
  const navigate = useNavigate();
  const { toasts, showToast, dismissToast } = useToast();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [removendo, setRemovendo] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    api.listarFavoritos()
      .then((dados) => {
        if (vivo) setFavoritos(dados.favoritos ?? []);
      })
      .catch(() => {
        if (vivo) showToast('erro', 'Não foi possível carregar seus favoritos.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => { vivo = false; };
  }, [showToast]);

  async function removerFavorito(f: Favorito) {
    setRemovendo(f.id_mercado);
    try {
      await api.favoritarMercado(f.id_mercado, false);
      setFavoritos((lista) => lista.filter((x) => x.id_mercado !== f.id_mercado));
      showToast('sucesso', `${f.nome} foi removido dos favoritos.`);
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível remover o favorito.');
    } finally {
      setRemovendo(null);
    }
  }

  function abrirLoja(f: Favorito) {
    if (f.slug) navigate(`/vitrine/${f.slug}`);
  }

  return (
    <div className="favoritos-page">
      <div className="favoritos-topbar">
        <button className="favoritos-voltar" onClick={() => navigate('/')} type="button">
          <IconArrowLeft size={16} />
          Início
        </button>
        <div className="favoritos-titulo">
          <h1>Meus favoritos</h1>
          <p>
            {carregando
              ? 'Suas lojas salvas'
              : `${favoritos.length} ${favoritos.length === 1 ? 'loja salva' : 'lojas salvas'}`}
          </p>
        </div>
      </div>

      <main className="favoritos-conteudo">
        {carregando ? (
          <div className="favoritos-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="favorito-card favorito-card--skeleton" aria-hidden="true">
                <div className="favorito-foto favorito-foto--skeleton" />
                <div className="favorito-corpo">
                  <div className="favorito-linha-skel" style={{ width: '70%' }} />
                  <div className="favorito-linha-skel" style={{ width: '45%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : favoritos.length === 0 ? (
          <div className="favoritos-vazio">
            <div className="favoritos-vazio-icone">
              <IconHeart size={30} />
            </div>
            <h2>Você ainda não favoritou nenhuma loja</h2>
            <p>
              Toque no coração de um mercado na vitrine para salvá-lo aqui e
              encontrar as suas lojas preferidas em um só lugar.
            </p>
            <button className="favoritos-cta" onClick={() => navigate('/')} type="button">
              Explorar mercados
            </button>
          </div>
        ) : (
          <div className="favoritos-grid">
            {favoritos.map((f) => {
              const local = [f.cidade, f.estado].filter(Boolean).join(' · ');
              return (
                <article key={f.id} className="favorito-card">
                  <button
                    className="favorito-foto"
                    onClick={() => abrirLoja(f)}
                    type="button"
                    aria-label={`Abrir a loja ${f.nome}`}
                  >
                    {f.foto_perfil ? (
                      <img src={f.foto_perfil} alt={f.nome} loading="lazy" />
                    ) : (
                      <IconStore size={30} />
                    )}
                  </button>
                  <div className="favorito-corpo">
                    <h3 className="favorito-nome">{f.nome}</h3>
                    {local && (
                      <p className="favorito-local">
                        <IconMapPin size={13} /> {local}
                      </p>
                    )}
                    <p className="favorito-nota">
                      <IconStar size={13} filled />
                      <strong>{Number(f.avaliacao ?? 0).toFixed(1)}</strong>
                      <span>
                        ({f.num_avaliacoes} {f.num_avaliacoes === 1 ? 'avaliação' : 'avaliações'})
                      </span>
                    </p>
                    {f.status !== 'ativo' && (
                      <span className="favorito-chip">Loja temporariamente inativa</span>
                    )}
                    <div className="favorito-acoes">
                      <button
                        className="favorito-ver"
                        onClick={() => abrirLoja(f)}
                        type="button"
                        disabled={!f.slug}
                      >
                        Ver loja
                      </button>
                      <button
                        className="favorito-remover"
                        onClick={() => removerFavorito(f)}
                        type="button"
                        disabled={removendo === f.id_mercado}
                        title="Remover dos favoritos"
                        aria-label={`Remover ${f.nome} dos favoritos`}
                      >
                        <IconHeart size={15} filled />
                        {removendo === f.id_mercado ? 'Removendo…' : 'Remover'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
