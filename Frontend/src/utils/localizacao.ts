// Formatação padrão da localização de um mercado — fonte única usada nos
// cards da home, na página de parceiros e nas duas vitrines, para o site
// inteiro mostrar o endereço do mesmo jeito.

export interface LocalMercado {
  rua?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

/** Resumo curto pros cards: "Centro · Taquaritinga". */
export function localizacao(m: LocalMercado): string {
  if (m.bairro && m.cidade) return `${m.bairro} · ${m.cidade}`;
  if (m.cidade && m.estado) return `${m.cidade} · ${m.estado}`;
  if (m.cidade) return m.cidade;
  return 'Mercado parceiro';
}

/** Linha completa pras vitrines: "Rua das Palmeiras, Centro · Taquaritinga · SP". */
export function localizacaoCompleta(m: LocalMercado): string {
  const endereco = [m.rua, m.bairro].filter(Boolean).join(', ');
  const cidade = [m.cidade, m.estado].filter(Boolean).join(' · ');
  const partes = [endereco, cidade].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : 'Mercado parceiro';
}
