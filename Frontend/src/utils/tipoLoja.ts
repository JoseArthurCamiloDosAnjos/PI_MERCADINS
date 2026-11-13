export const NOMES_TIPOS: Record<string, string> = {
  mercado: 'Mercado',
  hortifruti: 'Hortifruti',
  acougue: 'Açougue',
  padaria: 'Padaria',
  bebidas: 'Bebidas',
  organicos: 'Orgânicos',
  conveniencia: 'Conveniência',
};

export function tipoPrincipal(tipos?: string[]): string {
  const slug = (tipos?.[0] ?? '').toLowerCase();
  return NOMES_TIPOS[slug] ?? 'Loja';
}
