import { Link, useNavigate } from 'react-router-dom';
import './PaginaNaoEncontrada.css';

// Página 404: aparece quando a URL não existe (link quebrado, erro de digitação).
export default function PaginaNaoEncontrada() {
  const navigate = useNavigate();

  return (
    <main className="nf-container">
      <p className="nf-code">404</p>
      <h1 className="nf-titulo">Página não encontrada</h1>
      <p className="nf-texto">
        O endereço que você abriu não existe ou foi movido. Que tal voltar
        para a home e explorar os mercados perto de você?
      </p>

      <div className="nf-acoes">
        <Link className="nf-btn nf-btn--primario" to="/">
          Ir para a home
        </Link>
        <button
          className="nf-btn nf-btn--secundario"
          type="button"
          onClick={() => navigate(-1)}
        >
          Voltar
        </button>
      </div>

      <p className="nf-dica">
        Dica: use a busca na home para encontrar mercados e produtos.
      </p>
    </main>
  );
}
