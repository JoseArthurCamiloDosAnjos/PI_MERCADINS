//  Consulta de CEP — preenche rua, bairro, cidade e estado sozinho

export interface DadosCep {
  rua: string;
  bairro: string;
  cidade: string;
  estado: string;
}

/** Só números, para comparar e montar a URL */
export function digitosCep(cep: string): string {
  return (cep ?? "").replace(/\D/g, "");
}

/** Busca o endereço do CEP. Devolve null quando não achou ou falhou. */
export async function buscarCep(cep: string): Promise<DadosCep | null> {
  const digitos = digitosCep(cep);
  if (digitos.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.erro) return null;
    return {
      rua: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      estado: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
