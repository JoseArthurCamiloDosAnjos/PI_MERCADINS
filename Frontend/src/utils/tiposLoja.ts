// Tipos de loja da plataforma — mesmos valores de CATEGORIAS_VALIDAS do
// backend (marketController) + 'geral' (catálogo que serve a qualquer tipo).

export const TIPOS_LOJA: Record<string, string> = {
  geral: 'Todas as lojas',
  mercado: 'Mercado',
  hortifruti: 'Hortifruti',
  acougue: 'Açougue',
  padaria: 'Padaria',
  bebidas: 'Bebidas',
  organicos: 'Orgânicos',
  conveniencia: 'Conveniência',
};

/** Ordem de exibição dos chips (o 'geral' fica por último) */
export const ORDEM_TIPOS = [
  'mercado', 'hortifruti', 'acougue', 'padaria', 'bebidas', 'organicos', 'conveniencia', 'geral',
];

/**
 * Normaliza o campo `mercados.categorias` (pode vir como array do driver
 * PostgreSQL ou como literal "{mercado,padaria}" dependendo do driver).
 */
export function parseTiposLoja(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(v => String(v).trim().toLowerCase()).filter(Boolean);
  if (typeof valor === 'string') {
    return valor
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}
