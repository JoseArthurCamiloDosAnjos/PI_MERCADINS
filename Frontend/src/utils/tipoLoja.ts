// Nomes amigáveis dos tipos de loja (mesmos slugs gravados em mercados.categorias).
// Fonte única usada nos chips da vitrine e nos botões de acesso.
export const NOMES_TIPOS: Record<string, string> = {
  mercado: 'Mercado',
  hortifruti: 'Hortifruti',
  acougue: 'Açougue',
  padaria: 'Padaria',
  bebidas: 'Bebidas',
  organicos: 'Orgânicos',
  conveniencia: 'Conveniência',
};

/**
 * O que a loja é, pelo primeiro tipo declarado: "Mercado", "Açougue"...
 * Loja sem tipo declarado cai em "Loja". Útil nos botões de acesso
 * ("Acessar açougue", "Ver padaria"...).
 */
export function tipoPrincipal(tipos?: string[]): string {
  const slug = (tipos?.[0] ?? '').toLowerCase();
  return NOMES_TIPOS[slug] ?? 'Loja';
}
