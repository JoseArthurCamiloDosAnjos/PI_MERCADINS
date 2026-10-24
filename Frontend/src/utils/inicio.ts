/**
 * Símbolo do Mercadins (logo) — regra única do site:
 * clicar em QUALQUER símbolo do Mercadins leva o cliente para a página
 * inicial RECARREGANDO o site (o navegador carrega tudo do zero).
 *
 * • já estando na home → apenas recarrega;
 * • em qualquer outra tela → navega para "/" com carregamento completo
 *   (diferente do navigate() do React Router, que só troca a tela sem
 *   recarregar).
 */
export function irParaInicio(): void {
  if (window.location.pathname === '/') {
    window.location.reload();
  } else {
    window.location.assign('/');
  }
}
