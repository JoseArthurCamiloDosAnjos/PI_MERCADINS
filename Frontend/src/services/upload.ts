//  Upload de imagens — pasta local "imagens" + cópia de backup no Supabase
import { BASE_URL } from './api'
import { guardarBlob } from './imagemCache'
import { supabase } from './supabase'

const getToken = () => localStorage.getItem('token')

export const MIME_IMAGENS_VALIDOS = ['image/png', 'image/jpeg', 'image/webp']

const MAX_LADO_PX = 1200
const PULAR_OTIMIZACAO_BYTES = 400 * 1024

export function ehImagemValida(file: File): boolean {
  return MIME_IMAGENS_VALIDOS.includes(file.type)
}

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
  if (!supabase) return null // não configurado — sem backup, sem erro
  const ext = file.name.split('.').pop() || 'png'
  const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const caminho = `${categoria}/${nomeArquivo}`

  const { error } = await supabase.storage
    .from('imagens')
    .upload(caminho, file, { cacheControl: '86400', upsert: false })

  if (error) {
    throw new Error(error.message || 'Falha ao enviar a imagem para o Supabase.')
  }

  const { data } = supabase.storage.from('imagens').getPublicUrl(caminho)
  return data.publicUrl
}

export async function uploadImagem(file: File, categoria: string): Promise<string | null> {
  const arquivo = await otimizarParaUpload(file)
  const [local, backup] = await Promise.allSettled([
    uploadLocal(arquivo, categoria),
    uploadSupabase(arquivo, categoria),
  ])

  // A imagem fica no cache do navegador no mesmo momento em que é salva —
  // continua visível offline sem novo fetch.
  const indexar = (url: string) => guardarBlob(url, arquivo).catch(console.error)

  // Com Supabase configurado o backup é OBRIGATÓRIO: a URL gravada no banco
  // precisa ser permanente (o disco do Render é efêmero e URLs localhost de
  // dev não existem em produção). Sem Supabase (auto-hospedado), usa a URL
  // local mesmo.
  if (supabase) {
    if (backup.status === 'fulfilled' && backup.value) {
      if (local.status === 'fulfilled') indexar(local.value)
      indexar(backup.value)
      return backup.value
    }
    console.error('Backup da imagem no Supabase falhou:', backup.status === 'rejected' ? backup.reason : 'sem URL')
    throw new Error(
      'Não foi possível salvar a imagem no armazenamento permanente (Supabase). ' +
        'O registro não foi salvo — tente novamente.'
    )
  }

  if (local.status === 'fulfilled') {
    indexar(local.value)
    return local.value
  }
  console.error('Erro no upload local:', local.reason)
  return null
}
