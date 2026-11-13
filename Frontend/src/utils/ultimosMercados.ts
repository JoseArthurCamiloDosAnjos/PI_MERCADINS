const CHAVE = "mercadins:ultimos-mercados";
const MAX = 8;

export function registrarVisita(slug: string) {
  if (!slug) return;
  try {
    const atual = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    const lista: string[] = Array.isArray(atual)
      ? atual.filter((s: unknown): s is string => typeof s === "string")
      : [];
    const nova = [slug, ...lista.filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(CHAVE, JSON.stringify(nova));
  } catch { /* falha ignorada */ }
}

export function listarVisitados(): string[] {
  try {
    const atual = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(atual)
      ? atual.filter((s: unknown): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}
