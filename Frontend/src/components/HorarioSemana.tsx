import { parseHorario, gruposDaSemana, rotuloDias } from '../utils/horario';
import { IconClock, IconX } from './Icons';
import './HorarioSemana.css';

export default function HorarioSemana({
  horario,
  className = '',
  semTitulo = false,
}: {
  horario: unknown;
  className?: string;
  semTitulo?: boolean;
}) {
  const grupos = gruposDaSemana(parseHorario(horario));
  if (grupos.length === 0) return null;

  return (
    <div className={`hs-box ${className}`.trim()}>
      {!semTitulo && (
        <span className="hs-titulo">
          <IconClock size={13} /> Horário da semana
        </span>
      )}
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
