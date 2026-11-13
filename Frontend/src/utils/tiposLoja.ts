
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

export const ORDEM_TIPOS = [
  'mercado', 'hortifruti', 'acougue', 'padaria', 'bebidas', 'organicos', 'conveniencia', 'geral',
];

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
