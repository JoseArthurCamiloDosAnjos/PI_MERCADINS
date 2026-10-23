import PaginaInstitucional from "./Institucional";

export default function Cookies() {
  return (
    <PaginaInstitucional
      titulo="Política de cookies"
      subtitulo="O que guardamos no seu navegador para a plataforma funcionar — sem rastreamento de anúncios."
    >
      <section className="inst-section inst-legal">
        <h2>1. O que são cookies?</h2>
        <p>
          Cookies são pequenos arquivos que o site salva no seu navegador para
          lembrar informações entre uma visita e outra. O Mercadins também usa o
          armazenamento local do navegador (localStorage), que cumpre a mesma
          função de forma mais moderna.
        </p>

        <h2>2. O que guardamos</h2>
        <ul>
          <li>
            <strong>Sessão:</strong> um código que mantém você logado entre as
            visitas, para não digitar senha toda hora.
          </li>
          <li>
            <strong>Carrinho:</strong> os itens que você adicionou, para que
            nada se perca se você fechar a página ou fizer login depois.
          </li>
          <li>
            <strong>Preferências:</strong> escolhas simples, como filtros da
            página e o plano selecionado no cadastro de mercado.
          </li>
        </ul>

        <h2>3. O que NÃO usamos</h2>
        <p>
          Não usamos cookies de publicidade, não rastreamos você em outros sites
          e não vendemos dados de navegação a terceiros.
        </p>

        <h2>4. Como gerenciar</h2>
        <p>
          Você pode apagar essas informações a qualquer momento nas
          configurações do seu navegador (limpar dados do site). Atenção: isso
          fará você sair da conta e esvaziar o carrinho salvo.
        </p>

        <h2>5. Mudanças nesta política</h2>
        <p>
          Atualizações serão publicadas nesta página. Dúvidas: Suporte@mercadins.com.br.
        </p>
      </section>
    </PaginaInstitucional>
  );
}
