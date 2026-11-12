import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { TIPOS_LOJA, ORDEM_TIPOS } from '../utils/tiposLoja';
import Imagem from './Imagem';
import './CatalogoModal.css';

// Ícone local (mesmo desenho usado na busca da home/vitrine)
function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemCatalogo {
  id: number;
  nome: string;
  descricao: string;
  imagens: string[];
  preco_sugerido: string | number;
  tipo_loja: string;
}

interface CatalogoModalProps {
  /** Tipos de loja da vitrine — pré-seleciona o chip mais relevante */
  tiposLoja?: string[];
  onSelecionar: (item: ItemCatalogo) => void;
  onCancelar: () => void;
}

function formatarPreco(valor: string | number) {
  const n = Number(valor);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ────────────────────────────────────────────────────────────────
// Modal de seleção do catálogo de produtos prontos: busca + filtro por tipo
// de loja + grid de cards. Ao escolher, devolve o item para o CadastroProduto
// pré-preenchido (fotos, descrição, nome e preço sugerido).

export default function CatalogoModal({
  tiposLoja,
  onSelecionar,
  onCancelar,
}: CatalogoModalProps) {
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [tipoAtivo, setTipoAtivo] = useState<string>(() => {
    // Pré-seleciona o primeiro tipo da loja (evita mostrar itens que não
    // fazem sentido para o tipo de estabelecimento); senão, "todos".
    const primeiro = tiposLoja?.find(t => ORDEM_TIPOS.includes(t));
    return primeiro ?? 'todos';
  });

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const dados: ItemCatalogo[] = await api.listarCatalogo();
        if (vivo) setItens(Array.isArray(dados) ? dados : []);
      } catch (e: unknown) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Erro ao carregar o catálogo.');
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter(item => {
      const okTipo =
        tipoAtivo === 'todos' ||
        item.tipo_loja === tipoAtivo ||
        item.tipo_loja === 'geral';
      const okBusca =
        !termo ||
        item.nome.toLowerCase().includes(termo) ||
        (item.descricao ?? '').toLowerCase().includes(termo);
      return okTipo && okBusca;
    });
  }, [itens, tipoAtivo, busca]);

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-label="Catálogo de produtos prontos">
      <div className="cm-modal">

        <div className="cm-header">
          <div className="cm-header-textos">
            <h2 className="cm-titulo">Produtos prontos</h2>
            <p className="cm-sub">Escolha um item — fotos e descrição vêm prontas. Você ajusta preço e estoque depois.</p>
          </div>
          <button className="cm-btn-fechar" onClick={onCancelar} aria-label="Fechar">✕</button>
        </div>

        <div className="cm-filtros">
          <div className="cm-busca">
            <IconSearch size={14} />
            <input
              className="cm-busca-input"
              placeholder="Buscar no catálogo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <div className="cm-chips" role="tablist" aria-label="Filtrar por tipo de loja">
            <button
              className={`cm-chip ${tipoAtivo === 'todos' ? 'cm-chip--ativo' : ''}`}
              onClick={() => setTipoAtivo('todos')}
            >
              Todos
            </button>
            {ORDEM_TIPOS.map(tipo => (
              <button
                key={tipo}
                className={`cm-chip ${tipoAtivo === tipo ? 'cm-chip--ativo' : ''}`}
                onClick={() => setTipoAtivo(tipo)}
              >
                {TIPOS_LOJA[tipo] ?? tipo}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-body">
          {carregando && <p className="cm-status">Carregando catálogo…</p>}

          {!carregando && erro && <p className="cm-status cm-status--erro">{erro}</p>}

          {!carregando && !erro && filtrados.length === 0 && (
            <p className="cm-status">
              Nenhum produto encontrado. Tente outra busca ou filtro.
            </p>
          )}

          {!carregando && !erro && filtrados.length > 0 && (
            <div className="cm-grid">
              {filtrados.map(item => {
                const img = item.imagens?.[0];
                return (
                  <button
                    key={item.id}
                    className="cm-card"
                    onClick={() => onSelecionar(item)}
                    title={`Usar "${item.nome}"`}
                  >
                    <div className="cm-card-img">
                      {img
                        ? <Imagem src={img} alt={item.nome} sizes="(max-width: 600px) 50vw, 240px" />
                        : <span className="cm-card-placeholder">Sem imagem</span>
                      }
                      <span className="cm-card-tipo">
                        {TIPOS_LOJA[item.tipo_loja] ?? item.tipo_loja}
                      </span>
                    </div>
                    <div className="cm-card-info">
                      <p className="cm-card-nome">{item.nome}</p>
                      {item.descricao && (
                        <p className="cm-card-desc">{item.descricao}</p>
                      )}
                      <div className="cm-card-rodape">
                        {Number(item.preco_sugerido) > 0 && (
                          <span className="cm-card-preco">
                            sugestão R$ {formatarPreco(item.preco_sugerido)}
                          </span>
                        )}
                        <span className="cm-card-usar">Usar produto →</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="cm-footer">
          <button className="cm-btn cm-btn--secundario" onClick={onCancelar}>
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
}
