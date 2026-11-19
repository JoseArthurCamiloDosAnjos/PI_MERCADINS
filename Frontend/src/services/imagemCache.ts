//  Cache offline de imagens (IndexedDB) — ver Planos/plano-cache-imagens-supabase.md
//  Banco `mercadins-cache`, store `imagens` com registros { url, blob, tamanho, acessoEm }.
import { BASE_URL } from './api'

const NOME_BANCO = 'mercadins-cache'
const NOME_STORE = 'imagens'
const VERSAO_BANCO = 1
const TETO_BYTES = 50 * 1024 * 1024 // ~50 MB
const TETO_OBJECT_URLS = 120 // LRU em memória (revoga na evicção)

interface RegistroImagem {
  url: string
  blob: Blob
  tamanho: number
  acessoEm: number
}

let abrindoBanco: Promise<IDBDatabase | null> | null = null
const objectUrls = new Map<string, string>() // url → blob: URL (ordem = recência)

function abrirBanco(): Promise<IDBDatabase | null> {
  if (abrindoBanco) return abrindoBanco
  abrindoBanco = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(NOME_BANCO, VERSAO_BANCO)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(NOME_STORE)) {
        const store = db.createObjectStore(NOME_STORE, { keyPath: 'url' })
        store.createIndex('acessoEm', 'acessoEm')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      console.error('Falha ao abrir o cache de imagens:', req.error)
      abrindoBanco = null
      resolve(null)
    }
    req.onblocked = () => {
      abrindoBanco = null
      resolve(null)
    }
  })
  return abrindoBanco
}

let origensCache: Set<string> | null = null

/** Domínios cacheáveis: origin do Backend (BASE_URL), do Supabase e da própria página (imagens relativas via proxy do Vite). */
function origensPermitidas(): Set<string> {
  if (origensCache) return origensCache
  const lista = new Set<string>()
  const adicionar = (valor?: string | null) => {
    if (!valor) return
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : undefined
      lista.add(new URL(valor, base).origin)
    } catch {
      // URL inválida — ignora
    }
  }
  adicionar(BASE_URL)
  adicionar(import.meta.env.VITE_SUPABASE_URL)
  if (typeof window !== 'undefined') lista.add(window.location.origin)
  origensCache = lista
  return lista
}

function urlCacheavel(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return false
  if (typeof window === 'undefined') return false
  try {
    const u = new URL(url, window.location.origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return origensPermitidas().has(u.origin)
  } catch {
    return false
  }
}

function promover<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Erro no cache de imagens.'))
  })
}

function esperarTransacao(transacao: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => resolve()
    transacao.onerror = () => reject(transacao.error)
    transacao.onabort = () => reject(transacao.error ?? new Error('Transação abortada.'))
  })
}

function lerRegistro(db: IDBDatabase, url: string): Promise<RegistroImagem | undefined> {
  const store = db.transaction(NOME_STORE, 'readonly').objectStore(NOME_STORE)
  return promover(store.get(url) as IDBRequest<RegistroImagem | undefined>)
}

function percorrer(
  db: IDBDatabase,
  modo: IDBTransactionMode,
  aoVisitar: (curso: IDBCursorWithValue) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(NOME_STORE, modo)
    const req = transacao.objectStore(NOME_STORE).openCursor()
    req.onsuccess = () => {
      const curso = req.result
      if (!curso) return
      aoVisitar(curso)
      curso.continue()
    }
    req.onerror = () => reject(req.error)
    transacao.oncomplete = () => resolve()
    transacao.onerror = () => reject(transacao.error)
    transacao.onabort = () => reject(transacao.error)
  })
}

/** Teto de ~50 MB: remove os registros com `acessoEm` mais antigo. */
async function eviccaoInterna(db: IDBDatabase): Promise<void> {
  let total = 0
  const registros: { url: string; tamanho: number; acessoEm: number }[] = []
  await percorrer(db, 'readonly', (curso) => {
    const reg = curso.value as RegistroImagem
    total += reg.tamanho
    registros.push({ url: reg.url, tamanho: reg.tamanho, acessoEm: reg.acessoEm })
  })
  if (total <= TETO_BYTES || registros.length <= 1) return

  registros.sort((a, b) => a.acessoEm - b.acessoEm)
  const remover: string[] = []
  for (const reg of registros) {
    if (total <= TETO_BYTES || registros.length - remover.length <= 1) break
    remover.push(reg.url)
    total -= reg.tamanho
  }
  if (!remover.length) return

  const transacao = db.transaction(NOME_STORE, 'readwrite')
  const store = transacao.objectStore(NOME_STORE)
  for (const url of remover) store.delete(url)
  await esperarTransacao(transacao)
}

/**
 * Hit: cria `URL.createObjectURL(blob)` e guarda num LRU em memória
 * (~120 entradas, com `revokeObjectURL` na evicção). Miss: `null`.
 */
export async function objectUrlPara(url: string): Promise<string | null> {
  if (!urlCacheavel(url)) return null

  const emMemoria = objectUrls.get(url)
  if (emMemoria) {
    objectUrls.delete(url) // reordena no LRU
    objectUrls.set(url, emMemoria)
    return emMemoria
  }

  try {
    const db = await abrirBanco()
    if (!db) return null
    const registro = await lerRegistro(db, url)
    if (!registro?.blob) return null

    const objetoUrl = URL.createObjectURL(registro.blob)
    objectUrls.set(url, objetoUrl)
    while (objectUrls.size > TETO_OBJECT_URLS) {
      const maisAntiga = objectUrls.keys().next().value
      if (maisAntiga === undefined) break
      const antiga = objectUrls.get(maisAntiga)
      if (antiga) URL.revokeObjectURL(antiga)
      objectUrls.delete(maisAntiga)
    }
    return objetoUrl
  } catch (err) {
    console.error('Falha ao ler imagem do cache:', err)
    return null
  }
}

/** Grava/atualiza o registro e atualiza `acessoEm`. */
export async function guardarBlob(url: string, blob: Blob): Promise<void> {
  if (!urlCacheavel(url)) return
  try {
    const db = await abrirBanco()
    if (!db) return
    const registro: RegistroImagem = { url, blob, tamanho: blob.size, acessoEm: Date.now() }
    const transacao = db.transaction(NOME_STORE, 'readwrite')
    transacao.objectStore(NOME_STORE).put(registro)
    await esperarTransacao(transacao)
    await eviccaoInterna(db)
  } catch (err) {
    console.error('Falha ao salvar imagem no cache:', err)
  }
}

/** Evita refetch de algo já salvo. */
export async function jaIndexada(url: string): Promise<boolean> {
  if (!urlCacheavel(url)) return false
  try {
    const db = await abrirBanco()
    if (!db) return false
    const registro = await lerRegistro(db, url)
    return !!registro
  } catch {
    return false
  }
}

export async function eviccao(): Promise<void> {
  try {
    const db = await abrirBanco()
    if (!db) return
    await eviccaoInterna(db)
  } catch (err) {
    console.error('Falha na evicção do cache de imagens:', err)
  }
}
