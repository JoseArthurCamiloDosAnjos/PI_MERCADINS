import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// ─── Ajustes que valem para qualquer navegação ────────────────────────────────
// 1) Título da aba do navegador por rota (padrão "X — Mercadins").
// 2) Voltar ao topo da página quando o endereço muda (mantém a posição
//    quando a troca é só de âncora, ex.: #contato no Atendimento).
// As páginas com nome dinâmico (vitrine e produto) sobrescrevem o título
// depois que os dados chegam.

const TITULO_PADRAO = 'Mercadins — Delivery de mercados perto de você';

const TITULOS: Array<[RegExp, string]> = [
  [/^\/$/, TITULO_PADRAO],
  [/^\/promocional/, 'Planos e preços — Mercadins'],
  [/^\/sobre/, 'Sobre nós — Mercadins'],
  [/^\/como-funciona/, 'Como funciona — Mercadins'],
  [/^\/mercados-parceiros/, 'Mercados parceiros — Mercadins'],
  [/^\/atendimento/, 'Atendimento — Mercadins'],
  [/^\/termos/, 'Termos de uso — Mercadins'],
  [/^\/privacidade/, 'Política de privacidade — Mercadins'],
  [/^\/cookies/, 'Política de cookies — Mercadins'],
  [/^\/(auth\/register|register)/, 'Criar conta — Mercadins'],
  [/^\/(auth|login)(\/|$)/, 'Entrar — Mercadins'],
  [/^\/redefinir-senha/, 'Redefinir senha — Mercadins'],
  [/^\/verificar-email/, 'Verificar e-mail — Mercadins'],
  [/^\/perfil/, 'Minha conta — Mercadins'],
  [/^\/vendedor\/mercado\/\d+\/vitrine/, 'Minha vitrine — Mercadins'],
  [/^\/vendedor\/mercado\/\d+/, 'Gerenciamento do mercado — Mercadins'],
  [/^\/vendedor/, 'Painel do vendedor — Mercadins'],
  [/^\/registrar-mercado/, 'Cadastrar mercado — Mercadins'],
  [/^\/planos/, 'Escolher plano — Mercadins'],
  [/^\/admin/, 'Administração — Mercadins'],
  [/\/carrinho/, 'Carrinho — Mercadins'],
  [/\/produto\//, 'Produto — Mercadins'],
  [/^\/vitrine\//, 'Loja — Mercadins'],
];

function tituloDaRota(pathname: string): string {
  for (const [padrao, titulo] of TITULOS) {
    if (padrao.test(pathname)) return titulo;
  }
  // Qualquer endereço fora da lista cai na rota "*" = página 404
  return 'Página não encontrada — Mercadins';
}

export default function ControleRotas() {
  const { pathname, hash } = useLocation();
  const caminhoAnterior = useRef(pathname);

  useEffect(() => {
    document.title = tituloDaRota(pathname);
    if (caminhoAnterior.current !== pathname && !hash) {
      window.scrollTo(0, 0);
    }
    caminhoAnterior.current = pathname;
  }, [pathname, hash]);

  return null;
}
