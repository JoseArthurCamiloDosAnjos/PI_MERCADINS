import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../../components/Toast';
import './MeusPedidos.css';

// ─────────────────────────────────────────────────────────────────────────────
//  B4 — Acompanhamento do pedido (visão do cliente)
//
//  Duas telas na mesma página:
//    • /pedidos        → lista dos pedidos que o cliente fez
//    • /pedidos/:id    → detalhe com a linha do tempo do status ATUALIZANDO
//      sozinho (a página consulta o servidor a cada 10 segundos enquanto o
//      pedido está em andamento, sem precisar recarregar nada)
//  Se o pedido ainda aguarda Pix, o QR code aparece na própria tela e a
//  página fica verificando se o pagamento caiu.
// ─────────────────────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const NOMES_STATUS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pendente: 'Recebido pela loja',
  preparo: 'Em preparo',
  caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const PASSOS_NORMAL = ['pendente', 'preparo', 'caminho', 'entregue'];

type ToastTipo = 'sucesso' | 'erro' | 'aviso' | 'info';

// Tira acento e deixa minúsculo para a busca funcionar com ou sem acento
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface PedidoLista {
  id: number;
  mercado: string;
  mercadoSlug: string;
  itens: string;
  valorTotal: number;
  taxaEntrega: number;
  desconto: number;
  cupom: string;
  tipoEntrega: 'entrega' | 'retirada';
  agendamento: string;
  status: string;
  formaPagamento: string;
  dataCompra: string;
}

interface PedidoDetalhe extends PedidoLista {
  cliente: string;
  observacao: string;
  // Endereço de entrega (item 1) — preenchido só quando a compra foi entregue
  enderecoEntrega?: string;
  gerencia: boolean;
}

interface PagamentoPix {
  id: string;
  status: string;
  vencimento: string | null;
  qrCodeBase64: string;
  copiaEcola: string;
  urlPagamento: string;
}

const IconArrowLeft = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

// Lupa da busca de pedidos (canto superior direito)
const IconLupa = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

// Lixeira do pedido (remover do histórico)
const IconLixeira = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

// Fecha / limpa a busca
const IconFechar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// ── Tela 1: lista dos pedidos ────────────────────────────────────────────────
function ListaPedidos({
  busca,
  onAbrir,
  showToast,
}: {
  busca: string;
  onAbrir: (id: number) => void;
  showToast: (tipo: ToastTipo, mensagem: string) => void;
}) {
  const [pedidos, setPedidos] = useState<PedidoLista[] | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.meusPedidos()
      .then(data => { if (vivo) setPedidos(data.pedidos ?? []); })
      .catch(() => { if (vivo) setPedidos([]); });
    return () => { vivo = false; };
  }, []);

  // Busca no canto superior direito: procura por loja, produto, nº do pedido,
  // data, status ou forma de entrega/pagamento (ignora acento e maiúscula)
  const filtrados = useMemo(() => {
    if (!pedidos) return null;
    const termo = normalizar(busca.trim());
    if (!termo) return pedidos;
    return pedidos.filter(p => {
      const campos = [
        p.mercado,
        p.itens,
        `pedido nº ${p.id}`,
        String(p.id),
        new Date(p.dataCompra).toLocaleDateString('pt-BR'),
        NOMES_STATUS[p.status] ?? p.status,
        p.tipoEntrega === 'retirada' ? 'retirada no balcão' : 'entrega',
        p.formaPagamento === 'pix' ? 'pix' : p.formaPagamento === 'cartao' ? 'cartão' : '',
        p.cupom,
      ];
      return campos.some(c => normalizar(String(c)).includes(termo));
    });
  }, [pedidos, busca]);

  // Lixeira: apaga o registro da listagem do cliente (o pedido continua
  // gravado e a loja continua vendo no painel dela)
  async function removerPedido(p: PedidoLista) {
    setRemovendo(true);
    try {
      await api.removerPedidoHistorico(p.id);
      setPedidos(lista => (lista ?? []).filter(x => x.id !== p.id));
      showToast('sucesso', `Pedido nº ${p.id} foi removido do seu histórico.`);
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível remover o pedido.');
    } finally {
      setRemovendo(false);
      setConfirmando(null);
    }
  }

  if (pedidos === null) {
    return (
      <>
        <div className="mp-skeleton" />
        <div className="mp-skeleton" />
        <div className="mp-skeleton" />
      </>
    );
  }

  if (filtrados && filtrados.length === 0) {
    return (
      <div className="mp-vazio">
        <h3>{busca.trim() ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}</h3>
        <p>
          {busca.trim()
            ? `Nada corresponde a “${busca.trim()}”. Tente o nome da loja, do produto ou o nº do pedido.`
            : 'Quando você fizer um pedido, ele aparece aqui com o status atualizado.'}
        </p>
      </div>
    );
  }

  return (
    <>
      {filtrados?.map(p => {
        const emAndamento = !['entregue', 'cancelado'].includes(p.status);
        return (
          <div
            key={p.id}
            className="mp-card"
            onClick={() => onAbrir(p.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbrir(p.id); }}
            role="button"
            tabIndex={0}
          >
            <div className="mp-card__linha1">
              <div>
                <p className="mp-card__mercado">{p.mercado}</p>
                <p className="mp-card__numero">Pedido nº {p.id}</p>
              </div>
              <span className={`mp-status mp-status--${p.status}`}>
                {NOMES_STATUS[p.status] ?? p.status}
              </span>
              <span className="mp-card__total">{formatBRL(p.valorTotal)}</span>
              <button
                className="mp-card__lixo"
                type="button"
                title="Remover este pedido do histórico"
                aria-label={`Remover o pedido nº ${p.id} do histórico`}
                onClick={(e) => { e.stopPropagation(); setConfirmando(p.id); }}
              >
                <IconLixeira />
              </button>
            </div>
            <p className="mp-card__itens">{p.itens}</p>
            <div className="mp-card__rodape">
              <span>{new Date(p.dataCompra).toLocaleDateString('pt-BR')}</span>
              <span>·</span>
              <span>{p.tipoEntrega === 'retirada' ? 'Retirada no balcão' : 'Entrega'}</span>
              {p.formaPagamento === 'pix' && <><span>·</span><span>Pix</span></>}
              {p.formaPagamento === 'cartao' && <><span>·</span><span>Cartão</span></>}
            </div>

            {confirmando === p.id && (
              <div
                className="mp-remover"
                role="alertdialog"
                aria-label="Confirmar remoção do pedido"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="mp-remover__texto">
                  <strong>Remover este pedido do seu histórico?</strong>
                  <span>
                    {emAndamento
                      ? 'Este pedido ainda está em andamento: ao remover, você não poderá mais acompanhá-lo por aqui. A loja continua com o registro da compra.'
                      : 'Ele deixa de aparecer nesta lista. A loja continua com o registro da compra.'}
                  </span>
                </div>
                <div className="mp-remover__botoes">
                  <button
                    className="mp-remover__sim"
                    type="button"
                    disabled={removendo}
                    onClick={() => removerPedido(p)}
                  >
                    {removendo ? 'Removendo…' : 'Sim, remover'}
                  </button>
                  <button
                    className="mp-remover__nao"
                    type="button"
                    disabled={removendo}
                    onClick={() => setConfirmando(null)}
                  >
                    Manter pedido
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── Tela 2: detalhe com acompanhamento ao vivo ──────────────────────────────
function DetalhePedido({
  id,
  onVoltar,
  showToast,
}: {
  id: number;
  onVoltar: () => void;
  showToast: (tipo: ToastTipo, mensagem: string) => void;
}) {
  const [pedido, setPedido] = useState<PedidoDetalhe | null>(null);
  const [pagamento, setPagamento] = useState<PagamentoPix | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const data = await api.detalharPedido(id);
      setPedido(data.pedido);
      setPagamento(data.pagamento ?? null);
    } catch {
      // Erro pontual: mantém o que já estava na tela
    } finally {
      setCarregado(true);
    }
  }, [id]);

  // Carga inicial do pedido
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const data = await api.detalharPedido(id);
        if (!vivo) return;
        setPedido(data.pedido);
        setPagamento(data.pagamento ?? null);
      } catch {
        // Erro pontual: a tela mostra "não encontrado" abaixo
      } finally {
        if (vivo) setCarregado(true);
      }
    })();
    return () => { vivo = false; };
  }, [id]);

  // Atualização automática: enquanto o pedido está em andamento (ou aguardando
  // pagamento), a página consulta o servidor a cada 10 segundos sozinha.
  const statusPedido = pedido?.status;
  useEffect(() => {
    if (!statusPedido) return;
    const emAndamento = !['entregue', 'cancelado'].includes(statusPedido);
    if (!emAndamento) return;
    const timer = setInterval(() => { carregar(); }, 10000);
    return () => clearInterval(timer);
  }, [statusPedido, carregar]);

  async function copiarCodigo() {
    if (!pagamento?.copiaEcola) return;
    try {
      await navigator.clipboard.writeText(pagamento.copiaEcola);
      setCopiado(true);
      showToast('sucesso', 'Código Pix copiado.');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      showToast('erro', 'Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  }

  // Item 4 — o cliente cancela o próprio pedido (só quando ainda dá tempo)
  async function cancelarPedido() {
    setCancelando(true);
    try {
      const res = await api.cancelarPedido(id);
      showToast('sucesso', res.mensagem || 'Pedido cancelado.');
      await carregar();
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Não foi possível cancelar o pedido.');
    } finally {
      setCancelando(false);
      setConfirmando(false);
    }
  }

  if (!carregado) {
    return (
      <>
        <div className="mp-skeleton" />
        <div className="mp-skeleton" style={{ height: 260 }} />
      </>
    );
  }

  if (!pedido) {
    return (
      <div className="mp-vazio">
        <h3>Pedido não encontrado</h3>
        <p>Pode ser que ele não exista mais ou que você não tenha acesso a ele.</p>
      </div>
    );
  }

  const total = pedido.valorTotal - pedido.desconto + pedido.taxaEntrega;
  const aguardandoPix = pedido.status === 'aguardando_pagamento' && !!pagamento;
  // Cancelar só quando: quem olha é o cliente (não a loja), a loja ainda não
  // começou o preparo e o pedido ainda não foi pago
  const pagoJa = pedido.status === 'pendente' && ['pix', 'cartao'].includes(pedido.formaPagamento);
  const podeCancelar =
    !pedido.gerencia &&
    ['pendente', 'aguardando_pagamento'].includes(pedido.status) &&
    !pagoJa;

  // Linha do tempo: pedidos cancelados/que aguardam pagamento mostram o caminho normal
  const passos = PASSOS_NORMAL;
  const indiceAtual = passos.indexOf(pedido.status);

  return (
    <>
      <button className="mp-detalhe-voltar" onClick={onVoltar} type="button">
        <IconArrowLeft /> Voltar aos pedidos
      </button>

      <div className="mp-painel">
        <div className="mp-painel__topo">
          <div>
            <h2>{pedido.mercado}</h2>
            <p className="mp-painel__sub">
              Pedido nº {pedido.id} · {new Date(pedido.dataCompra).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <span className={`mp-status mp-status--${pedido.status}`}>
            {NOMES_STATUS[pedido.status] ?? pedido.status}
          </span>
        </div>

        {pedido.status !== 'cancelado' && (
          <ol className="mp-timeline">
            {passos.map((p, i) => (
              <li
                key={p}
                className={
                  'mp-timeline__passo' +
                  (indiceAtual > i || pedido.status === 'entregue' ? ' is-feito' : '') +
                  (indiceAtual === i ? ' is-atual' : '')
                }
              >
                {NOMES_STATUS[p]}
              </li>
            ))}
          </ol>
        )}

        {aguardandoPix && (
          <div className="mp-pix">
            <h3>Pague com Pix para a loja iniciar o preparo</h3>
            <p className="mp-pix__aviso">
              Assim que o pagamento for confirmado, esta página atualiza sozinha.
            </p>

            {pagamento.qrCodeBase64 && (
              <div className="mp-pix__qr">
                <img
                  src={`data:image/png;base64,${pagamento.qrCodeBase64}`}
                  alt="QR code do pagamento Pix"
                />
              </div>
            )}

            {pagamento.copiaEcola && (
              <div className="mp-pix__codigo">
                <label htmlFor="mp-pix-codigo" style={{ position: 'absolute', left: -9999 }}>
                  Código Pix copia e cola
                </label>
                <input id="mp-pix-codigo" readOnly value={pagamento.copiaEcola} />
                <button className="mp-pix__copiar" onClick={copiarCodigo} type="button">
                  {copiado ? 'Copiado!' : 'Copiar código'}
                </button>
              </div>
            )}

            {!pagamento.qrCodeBase64 && pagamento.urlPagamento && (
              <p style={{ marginTop: 14 }}>
                <a href={pagamento.urlPagamento} target="_blank" rel="noreferrer">
                  Abrir a página de pagamento
                </a>
              </p>
            )}

            {pagamento.vencimento && (
              <p className="mp-pix__vencimento">
                Pagamento até {new Date(`${pagamento.vencimento}T12:00:00`).toLocaleDateString('pt-BR')}
              </p>
            )}

            <span className="mp-pix__status">Aguardando a confirmação do pagamento…</span>
          </div>
        )}

        {/* Pedido cancelado: explica o que aconteceu com a compra */}
        {pedido.status === 'cancelado' && (
          <div className="mp-cancelado">
            <strong>Esta compra foi cancelada.</strong>
            <p>
              Os produtos voltaram para o estoque da loja e este pedido não será
              preparado. Se você tiver alguma dúvida, fale com a loja.
            </p>
          </div>
        )}

        {/* Cancelar pedido (cliente, enquanto ainda dá tempo) */}
        {podeCancelar && !confirmando && (
          <div className="mp-cancelar">
            <button
              className="mp-cancelar__botao"
              type="button"
              onClick={() => setConfirmando(true)}
            >
              Cancelar pedido
            </button>
            <p className="mp-cancelar__dica">
              Dá para cancelar enquanto a loja ainda não começou o preparo.
            </p>
          </div>
        )}

        {confirmando && (
          <div className="mp-cancelar-confirmacao" role="alertdialog" aria-label="Confirmar cancelamento">
            <span>Cancelar este pedido?</span>
            <div className="mp-cancelar-confirmacao__botoes">
              <button
                className="mp-cancelar-confirmacao__sim"
                type="button"
                onClick={cancelarPedido}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
              </button>
              <button
                className="mp-cancelar-confirmacao__nao"
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={cancelando}
              >
                Não
              </button>
            </div>
          </div>
        )}

        <div className="mp-info">
          <div className="mp-info__linha">
            <span>Itens</span>
            <span>{pedido.itens}</span>
          </div>          <div className="mp-info__linha">
            <span>Produtos</span>
            <span>{formatBRL(pedido.valorTotal)}</span>
          </div>
          {pedido.desconto > 0 && (
            <div className="mp-info__linha">
              <span>Cupom {pedido.cupom}</span>
              <span style={{ color: '#1a8e4a' }}>− {formatBRL(pedido.desconto)}</span>
            </div>
          )}
          <div className="mp-info__linha">
            <span>{pedido.tipoEntrega === 'retirada' ? 'Retirada no balcão' : 'Entrega'}</span>
            <span>{pedido.taxaEntrega > 0 ? formatBRL(pedido.taxaEntrega) : 'Grátis'}</span>
          </div>
          {pedido.enderecoEntrega && (
            <div className="mp-info__linha">
              <span>Endereço de entrega</span>
              <span>{pedido.enderecoEntrega}</span>
            </div>
          )}
          {pedido.agendamento && (
            <div className="mp-info__linha">
              <span>Quando</span>
              <span>{pedido.agendamento}</span>
            </div>
          )}
          {pedido.observacao && (
            <div className="mp-info__linha">
              <span>Observação</span>
              <span>{pedido.observacao}</span>
            </div>
          )}
          <div className="mp-info__linha is-total">
            <strong>Total</strong>
            <strong>{formatBRL(total)}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Componente principal (escolhe a tela pela URL) ──────────────────────────
export default function MeusPedidos() {
  const navigate = useNavigate();
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const id = Number(pedidoId);
  const [busca, setBusca] = useState('');
  const { toasts, showToast, dismissToast } = useToast();

  return (
    <div className="meuspedidos-page">
      <div className="meuspedidos-topbar">
        <button className="meuspedidos-voltar" onClick={() => navigate('/')} type="button">
          <IconArrowLeft /> Início
        </button>
        <div className="meuspedidos-titulo">
          <h1>{id ? 'Acompanhar pedido' : 'Meus pedidos'}</h1>
          <p>{id ? 'Acompanhe o status em tempo real' : 'Todos os pedidos que você fez'}</p>
        </div>

        {/* Busca de pedidos — só aparece na listagem */}
        {!id && (
          <div className="mp-busca">
            <span className="mp-busca__icone" aria-hidden="true"><IconLupa /></span>
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pedidos (loja, produto, nº…)"
              aria-label="Buscar pedidos"
            />
            {busca && (
              <button
                className="mp-busca__limpar"
                type="button"
                onClick={() => setBusca('')}
                aria-label="Limpar a busca"
                title="Limpar a busca"
              >
                <IconFechar />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="meuspedidos-conteudo">
        {id ? (
          <DetalhePedido
            id={id}
            onVoltar={() => navigate('/pedidos')}
            showToast={showToast}
          />
        ) : (
          <ListaPedidos
            busca={busca}
            onAbrir={(idPedido) => navigate(`/pedidos/${idPedido}`)}
            showToast={showToast}
          />
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
