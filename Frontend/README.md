# Mercadins — frontend

Site do Mercadins em React + TypeScript + Vite. Este README cobre só a pasta
`Frontend/`; o guia completo do projeto está no [README da raiz](../README.md).

## Comandos

```bash
npm install     # dependências
npm run dev     # site em http://localhost:5173 (usa a API em :3001)
npm run build   # build de produção em dist/ (com checagem de tipos)
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. Obrigatórias: `VITE_SUPABASE_URL`
e `VITE_SUPABASE_ANON_KEY` (sem elas o app aborta); opcional: `VITE_API_URL`
(vazia = caminhos relativos, usado no Docker). Detalhes em
[docs/ambientes.md](../docs/ambientes.md).

## Estrutura

```
src/
├── assets/        # imagens e ícones
├── components/    # botões, modais, carrinho lateral, aviso de cookies
├── context/       # estado global (carrinho, autenticação)
├── hooks/         # hooks reutilizáveis
├── pages/         # login, home, vitrine, produto, carrinho, painel, admin
├── services/      # api.ts (comunicação com a API) e supabase.ts (fotos)
└── utils/         # SEO por página, tipos de loja, paletas
```

Documentação da API consumida: [docs/API.md](../docs/API.md).
