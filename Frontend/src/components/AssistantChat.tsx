
import { useState, type FormEvent } from 'react'
import './AssistantChat.css'

type Mensagem = {
  texto: string
  autor: 'usuario' | 'assistente'
}

export default function AssistantChat() {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      texto: 'Olá! Como posso ajudar no Mercadins?',
      autor: 'assistente',
    },
  ])

  async function enviarMensagem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const mensagem = texto.trim()
    if (!mensagem || carregando) return

    setMensagens((anteriores) => [
      ...anteriores,
      { texto: mensagem, autor: 'usuario' },
    ])
    setTexto('')
    setCarregando(true)

    try {
      const resposta = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: mensagem }),
      })

      const conteudo = await resposta.text()

let dados: { error?: string; reply?: string } = {}

try {
  dados = JSON.parse(conteudo)
} catch {
  // A resposta não veio em JSON.
}

if (!resposta.ok) {
  throw new Error(
    `HTTP ${resposta.status}: ${
      dados.error || conteudo || 'Resposta sem detalhes do servidor.'
    }`
  )
}

if (!dados.reply) {
  throw new Error('O servidor respondeu, mas não retornou o campo reply.')
}

      setMensagens((anteriores) => [
        ...anteriores,
        {
          texto: dados.reply || 'O assistente não retornou uma resposta.',
          autor: 'assistente',
        },
      ])
    } catch (erro) {
      setMensagens((anteriores) => [
        ...anteriores,
        {
          texto:
            erro instanceof Error
              ? `Erro ao conectar: ${erro.message}`
              : 'Não foi possível conectar ao assistente.',
          autor: 'assistente',
        },
      ])
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="assistant-chat">
      {aberto && (
        <section className="assistant-chat-panel">
          <header className="assistant-chat-header">
            <div>
              <strong>Assistente Mercadins</strong>
              <span>Como posso ajudar você hoje?</span>
            </div>
            <button
              type="button"
              className="assistant-close"
              onClick={() => setAberto(false)}
              aria-label="Fechar chat"
            >
              ×
            </button>
          </header>

          <div className="assistant-chat-messages">
            {mensagens.map((mensagem, indice) => (
              <div
                key={indice}
                className={`assistant-message ${
                  mensagem.autor === 'usuario'
                    ? 'assistant-message-user'
                    : 'assistant-message-bot'
                }`}
              >
                {mensagem.texto}
              </div>
            ))}

            {carregando && (
              <div className="assistant-message assistant-message-bot">
                Digitando...
              </div>
            )}
          </div>

          <form
            className="assistant-chat-form"
            onSubmit={enviarMensagem}
          >
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Digite sua mensagem..."
              aria-label="Digite sua mensagem"
              disabled={carregando}
            />
            <button
              type="submit"
              disabled={carregando || !texto.trim()}
            >
              {carregando ? '...' : 'Enviar'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="assistant-chat-toggle"
        onClick={() => setAberto((anterior) => !anterior)}
      >
        {aberto ? 'Fechar chat' : 'Falar com assistente'}
      </button>
    </div>
  )
}
