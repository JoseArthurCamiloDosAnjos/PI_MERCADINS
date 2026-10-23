import { parseHorario, gruposDaSemana, rotuloDias } from '../utils/horario';
import { IconClock, IconX } from './Icons';
import './HorarioSemana.css';

/**
 * Horário da semana em campo VISÍVEL (não escondido em tooltip).
 * Agrupa dias iguais ("Seg a Sex 08:00 – 18:00") e lista os fechados
 * explicitamente ("Dom Fechado"). Loja sem horário configurado não renderiza.
 */
export default function HorarioSemana({
  horario,
  className = '',
}: {
  horario: unknown;
  className?: string;
}) {
  const grupos = gruposDaSemana(parseHorario(horario));
  if (grupos.length === 0) return null;

  return (
    <div className={`hs-box ${className}`.trim()}>
      <span className="hs-titulo">
        <IconClock size={13} /> Horário da semana
      </span>
      <dl className="hs-lista">
        {grupos.map(grupo => (
          <div className="hs-linha" key={grupo.dias.join('-')}>
            <dt>{rotuloDias(grupo.dias)}</dt>
            <dd className={grupo.faixa ? '' : 'hs-fechado'}>
              {grupo.faixa ? (
                <>{grupo.faixa[0]} – {grupo.faixa[1]}</>
              ) : (
                <><IconX size={11} /> Fechado</>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
