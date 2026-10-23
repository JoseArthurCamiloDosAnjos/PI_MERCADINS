import { Component, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  A4 — Proteção contra erro inesperado (Error Boundary)
//
//  Se algum componente da tela falhar (bug, rede, versão nova do site ainda
//  carregando), o cliente vê esta tela amigável com botão para recarregar —
//  em vez de uma página branca sem explicação.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
}

interface State {
  erro: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: { componentStack?: string | null }) {
    console.error('Erro na tela:', erro, info?.componentStack ?? '');
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--fundo, #f0f2f7)',
          fontFamily: "'Nunito', Arial, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: '100%',
            background: 'var(--branco, #ffffff)',
            borderRadius: 16,
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          <p style={{ fontSize: 44, margin: '0 0 8px' }} aria-hidden="true">ops!</p>
          <h1
            style={{
              color: 'var(--texto, #0d2a5e)',
              fontSize: 20,
              margin: '0 0 8px',
              fontWeight: 700,
            }}
          >
            Algo deu errado por aqui
          </h1>
          <p
            style={{
              color: 'var(--texto-sec, #8892a4)',
              fontSize: 14,
              lineHeight: 1.6,
              margin: '0 0 24px',
            }}
          >
            Não se preocupe: seus itens e o seu cadastro continuam salvos.
            Recarregue a página para tentar de novo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: '#0d2a5e',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Recarregar a página
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              style={{
                background: 'transparent',
                color: '#0d2a5e',
                border: '1px solid #dde3ef',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ir para a página inicial
            </button>
          </div>
        </div>
      </div>
    );
  }
}
