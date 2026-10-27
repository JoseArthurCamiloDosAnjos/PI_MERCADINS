import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { localizacao } from "../../utils/localizacao";
import PaginaInstitucional from "./Institucional";

type Mercado = {
  id_mercado: number;
  nome: string;
  slug: string;
  cidade?: string;
  estado?: string;
  avaliacao?: number;
  avaliacoes_count?: number;
};

function notaFormatada(nota?: number) {
  const n = Number(nota ?? 0);
  if (Number.isNaN(n)) return "0,0";
  return n.toFixed(1).replace(".", ",");
}

export default function MercadosParceiros() {
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    api
      // limit=100: a API padrão traz só 20 mercados (padrão da paginação)
      .listarMercados(undefined, 100)
      .then((data) => {
        if (ativo) setMercados(data.mercados ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <PaginaInstitucional
      titulo="Mercados parceiros"
      subtitulo="Todos os mercados que já vendem pelo Mercadins, prontos para receber seu pedido."
    >
      {carregando && <div className="inst-vazio">Carregando mercados…</div>}

      {!carregando && mercados.length === 0 && (
        <div className="inst-vazio">
          Ainda não há mercados cadastrados. Que tal ser o primeiro?
        </div>
      )}

      {!carregando && mercados.length > 0 && (
        <div className="inst-lojas">
          {mercados.map((mercado) => (
            <Link
              key={mercado.id_mercado}
              className="inst-loja-card"
              to={`/vitrine/${mercado.slug}`}
            >
              <h3>{mercado.nome}</h3>
              <p>{localizacao(mercado)}</p>
              <span className="inst-nota">
                ★ {notaFormatada(mercado.avaliacao)} · {mercado.avaliacoes_count ?? 0} avaliação(ões)
              </span>
              <div className="inst-loja-visitar">Visitar loja →</div>
            </Link>
          ))}
        </div>
      )}

      <div className="inst-ctas">
        <Link className="inst-cta" to="/promocional">
          Quero meu mercado no Mercadins
        </Link>
      </div>
    </PaginaInstitucional>
  );
}
