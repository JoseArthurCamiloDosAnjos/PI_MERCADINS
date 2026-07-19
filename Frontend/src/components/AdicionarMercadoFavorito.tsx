import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import ToastContainer from './Toast';
import { IconStore, IconX, IconHeart } from './Icons';
import './AdicionarMercadoFavorito.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MercadoBusca {
  id_mercado: number;
  nome: string;
  cidade?: string;
  estado?: string;
  foto_perfil?: string;
}

interface Favorito {
  id: number;
  id_mercado: number;
  nome: string;
  data_cadastro: string;
}

interface AdicionarMercadoFavoritoProps {
  onFechar: () => void;
  onAtualizarFavoritos: (favoritos: Favorito[]) => void;
  favoritosAtuais: Favorito[];
}

// ─── Componente ────────────────────────────────────────────────────────────────

export default function AdicionarMercadoFavorito({
  onFechar, onAtualizarFavoritos, favoritosAtuais,
}: AdicionarMercadoFavoritoProps) {
  const [busca, setBusca]           = useState('');
  const [mercados, setMercados]     = useState<MercadoBusca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<number | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toasts, showToast, dismissToast } = useToast();

  const idsFavoritados = new Set(favoritosAtuais.map(f => f.id_mercado));

  useEffect(() => {
    inputRef.current?.focus();
    carregarMercados('');
  }, []);

  async function carregarMercados(termo: string) {
    setCarregando(true);
    try {
      const dados = await api.listarMercados(termo);
      setMercados(dados.mercados ?? []);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao buscar mercados.');
    } finally {
      setCarregando(false);
    }
  }

  function handleBusca(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => carregarMercados(valor), 350);
  }

  async function toggleFavorito(mercado: MercadoBusca) {
    const jaFavoritado = idsFavoritados.has(mercado.id_mercado);
    setProcessando(mercado.id_mercado);
    try {
      await api.favoritarMercado(mercado.id_mercado, !jaFavoritado);
      const dados = await api.listarFavoritos();
      onAtualizarFavoritos(dados.favoritos ?? []);
      showToast('sucesso', jaFavoritado
        ? `${mercado.nome} removido dos favoritos.`
        : `${mercado.nome} adicionado aos favoritos!`);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao atualizar favoritos.');
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="amf-overlay" onClick={onFechar}>
      <div className="amf-modal" onClick={e => e.stopPropagation()}>

        <div className="amf-header">
          <h3><IconStore size={16} /> Adicionar mercado favorito</h3>
          <button className="amf-fechar" onClick={onFechar}><IconX size={15} /></button>
        </div>

        <div className="amf-busca-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="amf-busca-input"
            placeholder="Buscar mercado por nome ou cidade..."
            value={busca}
            onChange={e => handleBusca(e.target.value)}
          />
        </div>

        <div className="amf-lista">
          {carregando ? (
            <p className="amf-msg">Carregando mercados...</p>
          ) : mercados.length === 0 ? (
            <p className="amf-msg">Nenhum mercado encontrado{busca ? ` para "${busca}"` : ''}.</p>
          ) : (
            mercados.map(m => {
              const favoritado = idsFavoritados.has(m.id_mercado);
              return (
                <div className="amf-item" key={m.id_mercado}>
                  <div className="amf-item-icone">
                    {m.foto_perfil
                      ? <img src={m.foto_perfil} alt={m.nome} />
                      : <IconStore size={18} />
                    }
                  </div>
                  <div className="amf-item-info">
                    <p className="amf-item-nome">{m.nome}</p>
                    {(m.cidade || m.estado) && (
                      <p className="amf-item-loc">{m.cidade}{m.cidade && m.estado ? ' · ' : ''}{m.estado}</p>
                    )}
                  </div>
                  <button
                    className={`amf-item-btn ${favoritado ? 'amf-item-btn--ativo' : ''}`}
                    onClick={() => toggleFavorito(m)}
                    disabled={processando === m.id_mercado}
                    title={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <IconHeart size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="amf-footer">
          <button className="amf-btn-concluir" onClick={onFechar}>Concluído</button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}