//  QuantidadeStepper — controle de quantidade (−  N  +) que também aceita
import { useState, type ReactNode } from 'react';
import './QuantidadeStepper.css';

const MINIMO = 1;

type QuantidadeStepperProps = {
  valor: number;
  maximo?: number | null;
  onMudar: (novo: number) => void;
  className: string;
  classeBotao?: string;
  classeCampo?: string;
  desabilitado?: boolean;
  desabilitarMenos?: boolean;
  iconeMenos: ReactNode;
  iconeMais: ReactNode;
};

export default function QuantidadeStepper({
  valor,
  maximo,
  onMudar,
  className,
  classeBotao,
  classeCampo,
  desabilitado = false,
  desabilitarMenos,
  iconeMenos,
  iconeMais,
}: QuantidadeStepperProps) {
  const [texto, setTexto] = useState<string | null>(null);

  const limitar = (n: number) => {
    const acimaDoMinimo = Math.max(MINIMO, n);
    if (maximo == null) return acimaDoMinimo;
    return Math.min(acimaDoMinimo, Math.max(maximo, MINIMO));
  };

  const bloquearMenos = desabilitado || (desabilitarMenos ?? valor <= MINIMO);
  const bloquearMais = desabilitado || (maximo != null && valor >= maximo);

  const mostrar = texto ?? String(valor);

  const clicar = (novo: number) => {
    setTexto(null);
    onMudar(novo);
  };

  const digitar = (bruto: string) => {
    const digitos = bruto.replace(/\D/g, '').slice(0, 7);
    if (digitos === '') {
      setTexto('');
      return;
    }
    const novo = limitar(parseInt(digitos, 10));
    setTexto(String(novo));
    if (novo !== valor) onMudar(novo);
  };

  return (
    <div className={className}>
      <button
        type="button"
        className={classeBotao}
        onClick={() => clicar(limitar(valor - 1))}
        disabled={bloquearMenos}
        aria-label="Diminuir quantidade"
      >
        {iconeMenos}
      </button>

      <input
        className={['qs-campo', classeCampo].filter(Boolean).join(' ')}
        type="text"
        inputMode="numeric"
        value={mostrar}
        onChange={(e) => digitar(e.target.value)}
        onBlur={() => setTexto(null)}
        disabled={desabilitado}
        aria-label="Quantidade"
      />

      <button
        type="button"
        className={classeBotao}
        onClick={() => clicar(limitar(valor + 1))}
        disabled={bloquearMais}
        aria-label="Aumentar quantidade"
      >
        {iconeMais}
      </button>
    </div>
  );
}
