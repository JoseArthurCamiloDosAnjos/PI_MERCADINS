//  Geocoding — converte endereço em coordenadas usando Nominatim (OSM)
//  Grátis, sem chave de API. Limitação: 1 requisição/segundo (respeitada).
//
//  Estratégia: tenta o endereço completo e, se não achar, vai simplificando
//  (tira bairro, depois rua, depois CEP) até obter um resultado.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Mercadins/1.0 (contato@mercadins.com.br)';

/** Formata o CEP como 12345-678 (o Nominatim ignora o CEP sem hífen). */
function formatarCep(cep) {
  const digitos = String(cep || '').replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  return `${digitos.slice(0, 3)}-${digitos.slice(3)}`;
}

async function buscarNominatim(query) {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=br`;
  const resposta = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
    signal: AbortSignal.timeout(5000),
  });

  if (!resposta.ok) return null;

  const dados = await resposta.json();
  if (!Array.isArray(dados) || dados.length === 0) return null;

  const lat = parseFloat(dados[0].lat);
  const lng = parseFloat(dados[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
}

/**
 * Converte um endereço em latitude/longitude.
 * @param {object} end - { rua, bairro, cidade, estado, cep }
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
async function geocodificar(end) {
  const cep = formatarCep(end.cep);
  const partes = [
    end.rua,
    end.bairro,
    end.cidade,
    end.estado,
    cep ? `CEP ${cep}` : null,
  ].filter(Boolean);

  if (partes.length === 0) return null;

  // Consultas do mais completo para o mais genérico
  const tentativas = [partes.join(', ')];
  if (end.rua && end.cidade) tentativas.push([end.rua, end.cidade, end.estado].filter(Boolean).join(', '));
  if (end.cidade && end.estado) tentativas.push(`${end.cidade}, ${end.estado}`);
  if (end.estado) tentativas.push(`${end.estado}, Brasil`);

  for (const query of tentativas) {
    try {
      const coords = await buscarNominatim(query);
      if (coords) return coords;
    } catch {
      // continua na próxima tentativa
    }
    // Nominatim exige no máximo 1 req/s
    await new Promise((r) => setTimeout(r, 1100));
  }

  return null;
}

/**
 * Calcula a distância em km entre dois pontos (fórmula de Haversine).
 */
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { geocodificar, distanciaKm };
