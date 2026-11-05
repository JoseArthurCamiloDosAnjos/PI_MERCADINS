// ─────────────────────────────────────────────────────────────────────────────
//  Localização automática — do GPS do celular para o endereço
//
//  Quando a pessoa toca em "Usar minha localização", o navegador pede
//  autorização e devolve as coordenadas. Aí:
//    1) BigDataCloud (serviço gratuito) transforma as coordenadas em CEP,
//       rua, bairro, cidade e estado;
//    2) ViaCEP confirma e completa os dados do CEP no padrão brasileiro.
//
//  Se qualquer etapa falhar, quem chamou recebe uma mensagem clara e o
//  preenchimento manual do CEP continua funcionando normalmente. Nada é
//  enviado para os serviços sem a pessoa autorizar.
// ─────────────────────────────────────────────────────────────────────────────

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

interface RespostaBigDataCloud {
  postcode?: string;
  street?: string;
  locality?: string;
  city?: string;
  principalSubdivisionCode?: string;
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

/**
 * Pede autorização ao navegador e devolve o endereço aproximado.
 * Lança ErroLocalizacao com uma frase amigável quando não dá certo.
 */
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

  let dados: RespostaBigDataCloud | null = null;
  try {
    const resposta = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`
    );
    if (resposta.ok) {
      dados = (await resposta.json()) as RespostaBigDataCloud;
    }
  } catch {
    // Sem internet ou serviço fora do ar: seguimos com o que o navegador deu.
  }

  const cep = String(dados?.postcode ?? "").replace(/\D/g, "").slice(0, 8);
  let rua = String(dados?.street ?? "").trim();
  let bairro = String(dados?.locality ?? "").trim();
  let cidade = String(dados?.city ?? dados?.locality ?? "").trim();
  let estado =
    String(dados?.principalSubdivisionCode ?? "").split("-")[1]?.trim() ?? "";

  // O ViaCEP é a fonte brasileira mais confiável para rua/bairro/cidade.
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
