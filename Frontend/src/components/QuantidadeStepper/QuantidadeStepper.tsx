// ─────────────────────────────────────────────────────────────────────────────
//  QuantidadeStepper — controle de quantidade (−  N  +) que também aceita
//  digitação.
//
//  O desenho continua sendo o de cada tela (a classe do bloco vem de fora);
//  o que muda é que o número vira campo:
//    • entram só números;
//    • o valor é limitado na hora ao estoque disponível;
//    • apagando tudo, o campo volta ao valor válido ao sair dele.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import './QuantidadeStepper.css';

const MINIMO = 1;

type QuantidadeStepperProps = {
  /** Quantidade atual */
  valor: number;
  /** Estoque disponível; null/undefined = sem limite */
  maximo?: number | null;
  onMudar: (novo: number) => void;
  /** Classe do bloco (define o visual de cada tela) */
  className: string;
  /** Classe extra dos botões, quando a tela tem a sua própria */
  classeBotao?: string;
  /** Classe extra do campo, quando a tela tem a sua própria */
  classeCampo?: string;
  /** Produto sem estoque: desliga o controle inteiro */
  desabilitado?: boolean;
  /** Sobrescreve a regra padrão de travar o "−" no mínimo */
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
  // Texto enquanto a pessoa digita; null = mostrando a quantidade do pedido
  const [texto, setTexto] = useState<string | null>(null);

  const limitar = (n: number) => {
    const acimaDoMinimo = Math.max(MINIMO, n);
    if (maximo == null) return acimaDoMinimo;
    return Math.min(acimaDoMinimo, Math.max(maximo, MINIMO));
  };

  const bloquearMenos = desabilitado || (desabilitarMenos ?? valor <= MINIMO);
  const bloquearMais = desabilitado || (maximo != null && valor >= maximo);

  const mostrar = texto ?? String(valor);

  // Botão sempre mostra a quantidade nova (mesmo que o campo estivesse em branco)
  const clicar = (novo: number) => {
    setTexto(null);
    onMudar(novo);
  };

  const digitar = (bruto: string) => {
    const digitos = bruto.replace(/\D/g, '').slice(0, 7);
    if (digitos === '') {
      setTexto(''); // deixa em branco e valida ao sair do campo
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
