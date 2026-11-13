import { IconPackage, IconPlus } from './Icons';
import './EscolhaProduto.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscolhaProdutoProps {
  /** Vendedor quer puxar um item pronto do catálogo */
  onPronto: () => void;
  /** Vendedor quer criar o produto manualmente (fluxo atual) */
  onNovo: () => void;
  onCancelar: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EscolhaProduto({
  onPronto,
  onNovo,
  onCancelar,
}: EscolhaProdutoProps) {
  return (
    <div className="ep-overlay" role="dialog" aria-modal="true" aria-label="Adicionar produto">
      <div className="ep-modal">

        <div className="ep-header">
          <h2 className="ep-titulo">Adicionar produto</h2>
          <button className="ep-btn-fechar" onClick={onCancelar} aria-label="Fechar">✕</button>
        </div>

        <div className="ep-body">
          <p className="ep-sub">Como você quer adicionar este produto à sua vitrine?</p>

          <div className="ep-opcoes">
            <button className="ep-opcao" onClick={onPronto}>
              <span className="ep-opcao-icone ep-opcao-icone--pronto">
                <IconPackage size={26} />
              </span>
              <span className="ep-opcao-textos">
                <span className="ep-opcao-titulo">Produto pronto</span>
                <span className="ep-opcao-desc">
                  Escolha um item do catálogo com fotos e descrição já feitas —
                  é só ajustar o preço e o estoque.
                </span>
              </span>
            </button>

            <button className="ep-opcao" onClick={onNovo}>
              <span className="ep-opcao-icone ep-opcao-icone--novo">
                <IconPlus size={26} />
              </span>
              <span className="ep-opcao-textos">
                <span className="ep-opcao-titulo">Criar do zero</span>
                <span className="ep-opcao-desc">
                  Cadastre nome, descrição, imagens e preço manualmente,
                  do seu jeito.
                </span>
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
