//  Localização automática — do GPS do celular para o endereço

import { buscarCep } from "./cep";

export interface EnderecoLocalizado {
  cep: string;
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Erro com mensagem pronta para mostrar na tela. */
export class ErroLocalizacao extends Error {}

/** Fonte 1 — Photon/OSM. Aceita chamada do navegador e tem CEP no Brasil. */
interface PhotonProps {
  postcode?: string;
  street?: string;
  district?: string;
  suburb?: string;
  locality?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
}

interface RespostaPhoton {
  features?: Array<{ properties?: PhotonProps }>;
}

/** Fonte 2 — BigDataCloud (reserva). No Brasil o CEP costuma vir vazio. */
interface RespostaBigDataCloud {
  postcode?: string;
  street?: string;
  locality?: string;
  city?: string;
  principalSubdivisionCode?: string;
}

const SIGLAS_UF: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

/** Só os dígitos, do jeito que o ViaCEP e as máscaras de tela esperam */
function digitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "").slice(0, 8);
}

/** "SP" → "SP"; "São Paulo" → "SP"; qualquer outra coisa → "" */
function ufDe(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(texto)) return texto.toUpperCase();
  const normalizado = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SIGLAS_UF[normalizado] ?? "";
}

/** O navegador da pessoa oferece localização? */
export function localizacaoDisponivel(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function mensagemDoErro(erro: GeolocationPositionError): string {
  if (erro.code === erro.PERMISSION_DENIED) {
    return "Permissão de localização negada. Sem problema: digite o CEP manualmente.";
  }
  if (erro.code === erro.POSITION_UNAVAILABLE) {
    return "Não conseguimos descobrir sua localização agora. Digite o CEP manualmente.";
  }
  return "A localização demorou demais para responder. Digite o CEP manualmente.";
}

function pegarPosicao(): Promise<GeolocationPosition> {
  return new Promise<GeolocationPosition>((resolver, rejeitar) => {
    navigator.geolocation.getCurrentPosition(resolver, rejeitar, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

/** Photon/OSM: a fonte que devolve o CEP de verdade por aqui */
async function buscarPhoton(latitude: number, longitude: number): Promise<Partial<EnderecoLocalizado> | null> {
  try {
    const resposta = await fetch(
      `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&limit=1`
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as RespostaPhoton;
    const p = dados.features?.[0]?.properties;
    if (!p) return null;
    return {
      cep: digitos(p.postcode),
      rua: String(p.street ?? "").trim(),
      bairro: String(p.district ?? p.suburb ?? p.locality ?? "").trim(),
      cidade: String(p.city ?? p.town ?? p.village ?? p.county ?? "").trim(),
      estado: String(p.state ?? "").trim(),
    };
  } catch {
    return null;
  }
}

/** BigDataCloud: reserva quando o Photon não devolve endereço nenhum */
async function buscarBigDataCloud(
  latitude: number,
  longitude: number
): Promise<Partial<EnderecoLocalizado> | null> {
  try {
    const resposta = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
    );
    if (!resposta.ok) return null;
    const dados = (await resposta.json()) as RespostaBigDataCloud;
    return {
      cep: digitos(dados.postcode),
      rua: String(dados.street ?? "").trim(),
      bairro: String(dados.locality ?? "").trim(),
      cidade: String(dados.city ?? dados.locality ?? "").trim(),
      estado: String(dados.principalSubdivisionCode ?? "").split("-")[1]?.trim() ?? "",
    };
  } catch {
    return null;
  }
}

export async function obterEnderecoPorLocalizacao(): Promise<EnderecoLocalizado> {
  if (!localizacaoDisponivel()) {
    throw new ErroLocalizacao(
      "Seu navegador não oferece localização. Digite o CEP manualmente."
    );
  }

  let posicao: GeolocationPosition;
  try {
    posicao = await pegarPosicao();
  } catch (erro) {
    throw new ErroLocalizacao(
      mensagemDoErro(erro as GeolocationPositionError)
    );
  }

  const { latitude, longitude } = posicao.coords;

  const photon = await buscarPhoton(latitude, longitude);
  const temEndereco = !!(photon && (photon.cep || photon.rua || photon.cidade));
  const reserva = temEndereco ? null : await buscarBigDataCloud(latitude, longitude);

  const fonte: Partial<EnderecoLocalizado> | null = temEndereco ? photon : reserva;
  const cep = digitos(fonte?.cep);
  let rua = String(fonte?.rua ?? "").trim();
  let bairro = String(fonte?.bairro ?? "").trim();
  let cidade = String(fonte?.cidade ?? "").trim();
  let estado = ufDe(fonte?.estado);

  if (cep.length === 8) {
    const viaCep = await buscarCep(cep);
    if (viaCep) {
      rua = viaCep.rua || rua;
      bairro = viaCep.bairro || bairro;
      cidade = viaCep.cidade || cidade;
      estado = viaCep.estado || estado;
    }
  }

  if (!cep && !rua && !cidade) {
    throw new ErroLocalizacao(
      "Não conseguimos encontrar o endereço da sua localização. Digite o CEP manualmente."
    );
  }

  return { cep, rua, bairro, cidade, estado };
}
