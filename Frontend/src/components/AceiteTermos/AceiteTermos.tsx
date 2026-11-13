import { Link } from 'react-router-dom';
import './AceiteTermos.css';

interface Props {
  marcado: boolean;
  onChange: (valor: boolean) => void;
  erro?: string;
  contexto?: 'cliente' | 'mercado';
}

export default function AceiteTermos({
  marcado,
  onChange,
  erro,
  contexto = 'cliente',
}: Props) {
  const origem = contexto === 'mercado' ? 'registro-mercado' : 'cadastro';
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
            to={`/termos?origem=${origem}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(evento) => evento.stopPropagation()}
          >
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link
            to={`/privacidade?origem=${origem}`}
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
