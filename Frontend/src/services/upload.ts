// ─────────────────────────────────────────────────────────────────────────────
//  Upload de imagens — pasta local "imagens" + cópia de backup no Supabase
//
//  uploadImagem(file, categoria):
//   1. envia para o backend (POST /api/upload/:categoria), que salva em
//      imagens/<categoria>/ e devolve a URL — é essa URL que vai para o banco;
//   2. em paralelo, mantém a cópia no Supabase Storage (bucket "imagens")
//      como backup (best effort — falha do Supabase não derruba o upload);
//   3. se o backend falhar, usa a URL do Supabase como fallback.
// ─────────────────────────────────────────────────────────────────────────────
import { BASE_URL } from './api'
import { supabase } from './supabase'

const getToken = () => localStorage.getItem('token')

// Formatos aceitos na pasta imagens/ (backend valida de novo no servidor)
export const MIME_IMAGENS_VALIDOS = ['image/png', 'image/jpeg', 'image/webp']

export function ehImagemValida(file: File): boolean {
  return MIME_IMAGENS_VALIDOS.includes(file.type)
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
 * Envia a imagem para a pasta local imagens/ (URL que vai para o banco) e
 * mantém uma cópia no Supabase como backup. Retorna a URL ou null se tudo
 * falhar.
 */
export async function uploadImagem(file: File, categoria: string): Promise<string | null> {
  const [local, backup] = await Promise.allSettled([
    uploadLocal(file, categoria),
    uploadSupabase(file, categoria),
  ])

  if (local.status === 'fulfilled') return local.value
  console.error('Erro no upload local:', local.reason)

  if (backup.status === 'fulfilled' && backup.value) return backup.value
  return null
}
