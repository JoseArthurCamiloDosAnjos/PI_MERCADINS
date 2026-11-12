// ─────────────────────────────────────────────────────────────────────────────
//  Upload de imagens — pasta local "imagens" + cópia de backup no Supabase
//
//  uploadImagem(file, categoria):
//   0. otimiza o arquivo no cliente (máx. 1200px do maior lado, WebP) —
//      uma foto de celular de vários MB vira algo leve que serve bem
//      tanto a miniatura quanto a visão geral;
//   1. envia para o backend (POST /api/upload/:categoria), que salva em
//      imagens/<categoria>/ + imagens/<categoria>/thumbs/ e devolve as URLs
//      — é a URL original que vai para o banco;
//   2. em paralelo, mantém a cópia no Supabase Storage (bucket "imagens")
//      como backup (best effort — falha do Supabase não derruba o upload);
//   3. se o backend falhar, usa a URL do Supabase como fallback.
// ─────────────────────────────────────────────────────────────────────────────
import { BASE_URL } from './api'
import { supabase } from './supabase'

const getToken = () => localStorage.getItem('token')

// Formatos aceitos na pasta imagens/ (backend valida de novo no servidor)
export const MIME_IMAGENS_VALIDOS = ['image/png', 'image/jpeg', 'image/webp']

// Otimização antes do upload: reduz para no máximo 1200px no maior lado.
// Acima disso o navegador só precisaria escalar para baixo em qualquer
// exibição do projeto (a maior é a galeria do produto).
const MAX_LADO_PX = 1200
const PULAR_OTIMIZACAO_BYTES = 400 * 1024

export function ehImagemValida(file: File): boolean {
  return MIME_IMAGENS_VALIDOS.includes(file.type)
}

/**
 * Redimensiona a imagem para caber em 1200px (lado maior) e reencoda em
 * WebP ~85%. Devolve o arquivo original quando já está pequeno, quando o
 * navegador não suporta ou quando qualquer etapa falha.
 */
async function otimizarParaUpload(file: File): Promise<File> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    if (width <= MAX_LADO_PX && height <= MAX_LADO_PX && file.size <= PULAR_OTIMIZACAO_BYTES) {
      bitmap.close?.()
      return file
    }

    const escala = Math.min(1, MAX_LADO_PX / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * escala))
    canvas.height = Math.max(1, Math.round(height * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85)
    )
    // Encoder WebP indisponível (navegador antigo) → mantém o original.
    if (!blob || blob.type !== 'image/webp') return file

    const nome = `${file.name.replace(/\.[^.]+$/, '') || 'imagem'}.webp`
    return new File([blob], nome, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return file
  }
}

async function uploadLocal(file: File, categoria: string): Promise<string> {
  const formData = new FormData()
  formData.append('imagem', file)

  const token = getToken()
  const res = await fetch(`${BASE_URL}/api/upload/${categoria}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.url) {
    throw new Error(data.erro || 'Falha ao enviar a imagem para o servidor.')
  }
  return data.url as string
}

async function uploadSupabase(file: File, categoria: string): Promise<string | null> {
  // Sem Supabase configurado não há backup — o upload local continua valendo.
  if (!supabase) return null
  try {
    const ext = file.name.split('.').pop() || 'png'
    const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const caminho = `${categoria}/${nomeArquivo}`

    const { error } = await supabase.storage
      .from('imagens')
      .upload(caminho, file, { cacheControl: '3600', upsert: false })

    if (error) {
      console.error('Erro ao enviar imagem (Supabase):', error)
      return null
    }

    const { data } = supabase.storage.from('imagens').getPublicUrl(caminho)
    return data.publicUrl
  } catch (falha) {
    console.error('Erro no upload Supabase:', falha)
    return null
  }
}

/**
 * Envia a imagem (otimizada para no máx. 1200px) para a pasta local
 * imagens/ (URL que vai para o banco) e mantém uma cópia no Supabase como
 * backup. Retorna a URL ou null se tudo falhar.
 */
export async function uploadImagem(file: File, categoria: string): Promise<string | null> {
  const arquivo = await otimizarParaUpload(file)
  const [local, backup] = await Promise.allSettled([
    uploadLocal(arquivo, categoria),
    uploadSupabase(arquivo, categoria),
  ])

  if (local.status === 'fulfilled') return local.value
  console.error('Erro no upload local:', local.reason)

  if (backup.status === 'fulfilled' && backup.value) return backup.value
  return null
}
