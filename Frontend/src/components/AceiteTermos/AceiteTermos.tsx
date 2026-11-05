import { Link } from 'react-router-dom';
import './AceiteTermos.css';

interface Props {
  marcado: boolean;
  onChange: (valor: boolean) => void;
  erro?: string;
  /** Muda só a frase de apoio: cadastro de cliente ou de mercado. */
  contexto?: 'cliente' | 'mercado';
}

/**
 * Caixa de aceite dos Termos de Uso e da Política de Privacidade.
 *
 * Aparece no cadastro de clientes e no cadastro de mercados. Os links abrem os
 * documentos em outra aba para a pessoa poder ler sem perder o formulário.
 * O aceite é gravado no banco com data, versão dos textos e IP (LGPD).
 */
export default function AceiteTermos({
  marcado,
  onChange,
  erro,
  contexto = 'cliente',
}: Props) {
  return (
    <div className={`aceite-termos ${erro ? 'aceite-termos--erro' : ''}`}>
      <div className="aceite-termos__linha">
        <input
          id="aceite-termos"
          type="checkbox"
          checked={marcado}
          onChange={(evento) => onChange(evento.target.checked)}
          aria-describedby="aceite-termos-ajuda"
        />
        <label htmlFor="aceite-termos">
          Li e aceito os{' '}
          <Link
            to="/termos"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(evento) => evento.stopPropagation()}
          >
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link
            to="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(evento) => evento.stopPropagation()}
          >
            Política de Privacidade
          </Link>
          .
        </label>
      </div>

      <p className="aceite-termos__ajuda" id="aceite-termos-ajuda">
        {contexto === 'mercado'
          ? 'O aceite é obrigatório para cadastrar o mercado. Seus dados são tratados conforme a LGPD.'
          : 'O aceite é obrigatório para criar a conta. Seus dados são tratados conforme a LGPD.'}
      </p>

      {erro && (
        <p className="aceite-termos__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
