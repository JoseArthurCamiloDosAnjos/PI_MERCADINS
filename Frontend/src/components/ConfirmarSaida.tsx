import './ConfirmarSaida.css';
import { IconAlert } from './Icons';

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
    <div className="cfs-overlay" role="dialog" aria-modal="true" aria-label="Alterações não salvas">
      <div className="cfs-modal">

        <div className="cfs-icone-wrap">
          <span className="cfs-icone"><IconAlert size={40} /></span>
        </div>

        <div className="cfs-conteudo">
          <h2 className="cfs-titulo">Alterações não salvas</h2>
          <p className="cfs-descricao">
            Você fez alterações na vitrine que ainda não foram salvas.
            O que deseja fazer?
          </p>
        </div>

        <div className="cfs-acoes">

          {/* 1º — Continuar editando (ação segura, destaque neutro) */}
          <button
            className="cfs-btn cfs-btn--cancelar"
            onClick={onCancelar}
            disabled={salvando}
          >
            Continuar editando
          </button>

          {/* 2º — Salvar e sair (ação recomendada, destaque amarelo) */}
          <button
            className={`cfs-btn cfs-btn--salvar ${salvando ? 'cfs-btn--carregando' : ''}`}
            onClick={onSalvarESair}
            disabled={salvando}
          >
            {salvando
              ? <><span className="cfs-spinner" /> Salvando…</>
              : <>✓ Salvar e sair</>
            }
          </button>

          {/* 3º — Sair sem salvar (ação destrutiva, vermelho) */}
          <button
            className="cfs-btn cfs-btn--sair"
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