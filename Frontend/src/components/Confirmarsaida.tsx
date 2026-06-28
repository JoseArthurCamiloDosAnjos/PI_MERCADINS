import '../pages/CSS/Confirmarsaida.css';

interface ConfirmarSaidaProps {
  onSalvarESair: () => void;
  onSairSemSalvar: () => void;
  onCancelar: () => void;
  salvando?: boolean;
}

export default function ConfirmarSaida({
  onSalvarESair,
  onSairSemSalvar,
  onCancelar,
  salvando = false,
}: ConfirmarSaidaProps) {
  return (
    <div className="cs-overlay" role="dialog" aria-modal="true" aria-label="Alterações não salvas">
      <div className="cs-modal">

        <div className="cs-icone-wrap">
          <span className="cs-icone">⚠</span>
        </div>

        <div className="cs-conteudo">
          <h2 className="cs-titulo">Alterações não salvas</h2>
          <p className="cs-descricao">
            Você fez alterações na vitrine que ainda não foram salvas.
            O que deseja fazer?
          </p>
        </div>

        <div className="cs-acoes">

          {/* 1º — Continuar editando (ação segura, destaque neutro) */}
          <button
            className="cs-btn cs-btn--cancelar"
            onClick={onCancelar}
            disabled={salvando}
          >
            Continuar editando
          </button>

          {/* 2º — Salvar e sair (ação recomendada, destaque amarelo) */}
          <button
            className={`cs-btn cs-btn--salvar ${salvando ? 'cs-btn--carregando' : ''}`}
            onClick={onSalvarESair}
            disabled={salvando}
          >
            {salvando
              ? <><span className="cs-spinner" /> Salvando…</>
              : <>✓ Salvar e sair</>
            }
          </button>

          {/* 3º — Sair sem salvar (ação destrutiva, vermelho) */}
          <button
            className="cs-btn cs-btn--sair"
            onClick={onSairSemSalvar}
            disabled={salvando}
          >
            Sair sem salvar
          </button>

        </div>
      </div>
    </div>
  );
}