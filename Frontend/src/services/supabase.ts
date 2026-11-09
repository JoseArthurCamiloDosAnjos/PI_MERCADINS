import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// O Supabase é apenas o BACKUP das imagens: o arquivo em si é salvo na pasta
// "imagens/" do backend. Sem as variáveis o app continua funcionando normal —
// só o backup fica desativado (services/upload.ts trata o cliente nulo).
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
