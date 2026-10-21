// Horário de funcionamento dos mercados.
//
// O backend guarda na coluna "mercados.horario" um texto com JSON dentro:
//   {"1":["08:00","18:00"],"6":["09:00","14:00"]}
// Chave = dia da semana (0 = domingo ... 6 = sábado, igual ao Date do JS).
// Dia ausente da lista = fechado naquele dia. Se a hora de FECHAR for menor
// que a de ABRIR, o mercado fecha depois da meia-noite (ex.: 18:00 → 02:00).
// Valor nulo = a loja ainda não configurou o horário.

export type HorarioMercado = Record<string, [string, string] | null>;

export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Converte o que veio do banco em objeto (ou null se estiver vazio/corrompido)
export function parseHorario(bruto: unknown): HorarioMercado | null {
  if (!bruto) return null;
  if (typeof bruto === "object" && !Array.isArray(bruto))
    return bruto as HorarioMercado;
  if (typeof bruto !== "string") return null;
  try {
    const obj: unknown = JSON.parse(bruto);
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj))
      return obj as HorarioMercado;
  } catch {
    /* texto corrompido: loja fica "sem horário" */
  }
  return null;
}

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Está aberto AGORA? true / false — ou null quando a loja não tem horário
// (aí quem chula decide o comportamento: sem horário, ativo = aberto).
export function estaAberto(
  horario: HorarioMercado | null,
  agora = new Date()
): boolean | null {
  if (!horario) return null;

  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const dia = agora.getDay();

  // Janela de hoje: abre e fecha no mesmo dia, ou começa hoje e passa da
  // meia-noite (ex.: 18:00 → 02:00 de amanhã)
  const hj = horario[String(dia)];
  if (hj) {
    const mAbre = paraMinutos(hj[0]);
    const mFecha = paraMinutos(hj[1]);
    if (mAbre < mFecha && minutos >= mAbre && minutos < mFecha) return true;
    if (mAbre > mFecha && minutos >= mAbre) return true;
  }

  // Janela de ONTEM que atravessou a meia-noite: ex. ontem 18:00 → hoje
  // 02:00. Às 01:00 de hoje a loja ainda está aberta pelo horário de ontem.
  const ont = horario[String((dia + 6) % 7)];
  if (ont && paraMinutos(ont[0]) > paraMinutos(ont[1]) && minutos < paraMinutos(ont[1]))
    return true;

  return false;
}

// Horário de hoje pros cards: "08:00 – 18:00" / "Fechado hoje" / null sem horário
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

// Um grupo = dias consecutivos com o MESMO resultado (aberto com a mesma
// faixa, ou fechado). Ex.: {"1..5":08-18, "6":09-13, ausente domingo}
//   → Seg a Sex 08:00 – 18:00 / Sáb 09:00 – 13:00 / Dom Fechado
export interface GrupoHorario {
  dias: number[];
  faixa: [string, string] | null;
}

// Ordem comercial: começa na segunda e termina no domingo
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

// Rótulo do grupo: "Sáb" (1 dia) ou "Seg a Sex" (faixa de dias)
export function rotuloDias(dias: number[]): string {
  if (dias.length === 1) return DIAS_CURTO[dias[0]];
  return `${DIAS_CURTO[dias[0]]} a ${DIAS_CURTO[dias[dias.length - 1]]}`;
}
