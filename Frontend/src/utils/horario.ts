
export type HorarioMercado = Record<string, [string, string] | null>;

export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function parseHorario(bruto: unknown): HorarioMercado | null {
  if (!bruto) return null;
  if (typeof bruto === "object" && !Array.isArray(bruto))
    return bruto as HorarioMercado;
  if (typeof bruto !== "string") return null;
  try {
    const obj: unknown = JSON.parse(bruto);
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj))
      return obj as HorarioMercado;
  } catch { /* falha ignorada */ }
  return null;
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function estaAberto(
  horario: HorarioMercado | null,
  agora = new Date()
): boolean | null {
  if (!horario) return null;

  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const dia = agora.getDay();

  const hj = horario[String(dia)];
  if (hj) {
    const mAbre = paraMinutos(hj[0]);
    const mFecha = paraMinutos(hj[1]);
    if (mAbre < mFecha && minutos >= mAbre && minutos < mFecha) return true;
    if (mAbre > mFecha && minutos >= mAbre) return true;
  }

  const ont = horario[String((dia + 6) % 7)];
  if (ont && paraMinutos(ont[0]) > paraMinutos(ont[1]) && minutos < paraMinutos(ont[1]))
    return true;

  return false;
}

export function horarioDeHoje(
  horario: HorarioMercado | null,
  hoje = new Date()
): string | null {
  if (!horario) return null;
  const faixa = horario[String(hoje.getDay())];
  if (!faixa) return "Fechado hoje";
  return `Hoje: ${faixa[0]} – ${faixa[1]}`;
}

// ─── Semana explícita (sem tooltip) ──────────────────────────────────────────

export interface GrupoHorario {
  dias: number[];
  faixa: [string, string] | null;
}

export function gruposDaSemana(horario: HorarioMercado | null): GrupoHorario[] {
  if (!horario) return [];
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const grupos: GrupoHorario[] = [];
  for (const dia of ordem) {
    const faixa = horario[String(dia)] ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && JSON.stringify(ultimo.faixa) === JSON.stringify(faixa)) {
      ultimo.dias.push(dia);
    } else {
      grupos.push({ dias: [dia], faixa });
    }
  }
  return grupos;
}

export function rotuloDias(dias: number[]): string {
  if (dias.length === 1) return DIAS_CURTO[dias[0]];
  return `${DIAS_CURTO[dias[0]]} a ${DIAS_CURTO[dias[dias.length - 1]]}`;
}

export const DIAS_LONGO = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

export function proximaAbertura(
  horario: HorarioMercado | null,
  agora = new Date()
): string | null {
  if (!horario) return null;
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const dia = agora.getDay();

  const hoje = horario[String(dia)];
  if (hoje && minutos < paraMinutos(hoje[0])) {
    return `Abre hoje às ${hoje[0]}`;
  }

  for (let i = 1; i <= 7; i++) {
    const prox = horario[String((dia + i) % 7)];
    if (prox) {
      const quando = i === 1 ? "amanhã" : DIAS_LONGO[(dia + i) % 7];
      return `Abre ${quando} às ${prox[0]}`;
    }
  }
  return null;
}
