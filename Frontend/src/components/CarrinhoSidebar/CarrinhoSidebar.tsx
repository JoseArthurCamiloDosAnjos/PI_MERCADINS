import { IconShoppingCart, IconX, IconArrowRight } from '../Icons';
import { useCarrinho } from '../../hooks/useCarrinho';
import './CarrinhoSidebar.css';

interface CarrinhoSidebarProps {
  aberto: boolean;
  onFechar: () => void;
  carrinho: ReturnType<typeof useCarrinho>;
  /** Navega para a página completa do carrinho */
  onIrParaCarrinho?: () => void;
  storeName?: string;
  tema?: string;
}

const formatBRL = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function IconMinus() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function IconPlusMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}

/**
 * Gaveta lateral com os itens do carrinho: abre por cima da tela atual
 * (produto, vitrine...) sem trocar de página. O botão "Ir para o carrinho"
 * leva para a página completa (/vitrine/:slug/carrinho).
 */
export default function CarrinhoSidebar({
  aberto,
  onFechar,
  carrinho,
  onIrParaCarrinho,
  storeName,
  tema,
}: CarrinhoSidebarProps) {
  if (!aberto) return null;

  return (
    <div
      className="cs-overlay"
      data-tema={tema}
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho"
    >
      <aside className="cs-painel" onClick={e => e.stopPropagation()}>
        <header className="cs-topo">
          <div className="cs-topo-titulo">
            <IconShoppingCart size={18} />
            <h2>Carrinho</h2>
            {carrinho.totalItens > 0 && (
              <span className="cs-contador">{carrinho.totalItens}</span>
            )}
          </div>
          <button className="cs-fechar" onClick={onFechar} aria-label="Fechar carrinho">
            <IconX size={16} />
          </button>
        </header>

        {storeName && <p className="cs-loja">Loja: <strong>{storeName}</strong></p>}

        <div className="cs-lista">
          {carrinho.itens.length > 0 ? (
            carrinho.itens.map(item => {
              const preco = Number(item.produto.preco ?? 0);
              const imagem = item.produto.imagem ?? item.produto.imagens?.[0] ?? '';
              return (
                <div className="cs-item" key={item.produto.id_produto}>
                  <div className="cs-item-thumb">
                    {imagem
                      ? <img src={imagem} alt={item.produto.nome} />
                      : <IconShoppingCart size={18} />
                    }
                  </div>

                  <div className="cs-item-info">
                    <p className="cs-item-nome">{item.produto.nome}</p>
                    <p className="cs-item-preco">Unid.: <b>{formatBRL(preco)}</b></p>

                    <div className="cs-item-pe">
                      <div className="cs-stepper">
                        <button
                          type="button"
                          onClick={() => carrinho.alterarQuantidade(item.produto.id_produto, -1)}
                          disabled={item.quantidade <= 1}
                          aria-label="Diminuir quantidade"
                        >
                          <IconMinus />
                        </button>
                        <span>{item.quantidade}</span>
                        <button
                          type="button"
                          onClick={() => carrinho.alterarQuantidade(item.produto.id_produto, 1)}
                          disabled={item.produto.estoque != null && item.quantidade >= item.produto.estoque}
                          aria-label="Aumentar quantidade"
                        >
                          <IconPlusMini />
                        </button>
                      </div>
                      {item.produto.estoque != null && item.quantidade >= item.produto.estoque && (
                        <span className="cs-max">Máx. {item.produto.estoque}</span>
                      )}
                      <span className="cs-item-total">{formatBRL(preco * item.quantidade)}</span>
                    </div>
                  </div>

                  <button
                    className="cs-item-remover"
                    onClick={() => carrinho.remover(item.produto.id_produto)}
                    aria-label={`Remover ${item.produto.nome}`}
                  >
                    <IconTrash />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="cs-vazio">
              <div className="cs-vazio-icone"><IconShoppingCart size={30} /></div>
              <h3>Seu carrinho está vazio</h3>
              <p>Adicione produtos para vê-los aqui.</p>
            </div>
          )}
        </div>

        <footer className="cs-rodape">
          <div className="cs-subtotal">
            <span>Subtotal</span>
            <strong>{formatBRL(carrinho.totalValor)}</strong>
          </div>

          {onIrParaCarrinho && (
            <button
              className="cs-btn-ir"
              onClick={onIrParaCarrinho}
              disabled={carrinho.itens.length === 0}
              type="button"
            >
              Ir para o carrinho <IconArrowRight size={15} />
            </button>
          )}

          <button className="cs-btn-continuar" onClick={onFechar} type="button">
            Continuar comprando
          </button>
        </footer>
      </aside>
    </div>
  );
}
