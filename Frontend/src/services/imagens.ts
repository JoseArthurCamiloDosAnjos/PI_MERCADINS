import { BASE_URL } from './api';

const LIMITE_FINAL = 3 * 1024 * 1024;

type OpcoesImagem = {
  maxLado?: number;
  qualidade?: number;
};

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () =>
      reject(new Error('Não foi possível ler esta imagem. Tente outro arquivo.'));
    imagem.src = url;
  });
}

async function comprimir(
  arquivo: File,
  maxLado: number,
  qualidade: number,
): Promise<Blob> {
  if (arquivo.type === 'image/gif') return arquivo;

  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = await carregarImagem(url);
    const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
    const escala = maiorLado > maxLado ? maxLado / maiorLado : 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));

    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('Não foi possível preparar a imagem.');
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

    const comprimida = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', qualidade),
    );

    if (!comprimida) return arquivo;
    return comprimida.size < arquivo.size ? comprimida : arquivo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepararImagem(
  arquivo: File,
  maxLado: number,
  qualidade: number,
): Promise<Blob> {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem.');
  }

  let lado = maxLado;
  let qualidadeAtual = qualidade;
  let resultado = await comprimir(arquivo, lado, qualidadeAtual);

  while (resultado.size > LIMITE_FINAL && lado > 320) {
    lado = Math.round(lado * 0.75);
    qualidadeAtual = Math.max(0.55, qualidadeAtual - 0.08);
    resultado = await comprimir(arquivo, lado, qualidadeAtual);
  }

  if (resultado.size > LIMITE_FINAL) {
    throw new Error('A imagem continua grande demais. Escolha um arquivo menor.');
  }

  return resultado;
}

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const texto = String(leitor.result || '');
      resolve(texto.slice(texto.indexOf(',') + 1));
    };
    leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    leitor.readAsDataURL(blob);
  });
}

export async function enviarImagem(
  arquivo: File,
  opcoes: OpcoesImagem = {},
): Promise<string> {
  const preparada = await prepararImagem(
    arquivo,
    opcoes.maxLado ?? 1400,
    opcoes.qualidade ?? 0.82,
  );
  const dados = await blobParaBase64(preparada);
  const token = localStorage.getItem('token');

  const resposta = await fetch(`${BASE_URL}/api/imagens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ dados }),
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(corpo.erro || 'Não foi possível enviar a imagem.');
  }
  if (!corpo.url) {
    throw new Error('O servidor não devolveu o endereço da imagem.');
  }

  return String(corpo.url);
}
