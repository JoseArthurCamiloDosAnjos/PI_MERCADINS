import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useToast, type Toast } from '../../hooks/useToast';
import { LIMITS, bloquearEspaco, sanitizeEmail, sanitizePassword, removeEmojis } from '../../hooks/useBlockEmojis';
import ModalEditarPerfil from '../../components/ModalEditarPerfil';
import ToastContainer from '../../components/Toast';
import LoadingOverlay from '../../components/LoadingOverlay';
import PasswordStrength from '../../components/PasswordStrength';
import AdicionarMercadoFavorito from '../../components/AdicionarMercadoFavorito';
import TelaAssinaturas from '../../components/TelaAssinaturas/TelaAssinaturas';
import EnderecoPopup from '../../components/EnderecoPopup/EnderecoPopup';
import { useEnderecos } from '../../hooks/useEnderecos';
import { formatarEndereco, type EnderecoEntrega, type EnderecoSalvo } from '../../utils/endereco';
import './PerfilUsuario.css';
import {
  IconLock,
  IconStore,
  IconShoppingBag,
  IconStar,
  IconMail,
  IconInbox,
  IconInfo,
  IconMessage,
  IconMapPin,
  IconPlus,
  IconPencil,
} from '../../components/Icons';

interface Favorito  { id: number; id_mercado: number; nome: string; data_cadastro: string; }
// slug: leva o cliente de volta à loja quando ele clica em "Comprar de novo"
// forma_pagamento: a tela só oferece cancelar enquanto o cliente ainda não pagou
interface Historico { id: number; id_mercado: number; mercado: string; slug?: string; produtos: string; valor_total: string; data_compra: string; status: string; observacao?: string; forma_pagamento?: string; }
interface Avaliacao { id: number; id_mercado: number; loja: string; nota: number; texto: string; data_cadastro: string; }
interface Depoimento { id: number; nota: number; texto: string; cliente: string; data_cadastro: string; minha: boolean; }

type ShowToast = (tipo: Toast['tipo'], mensagem: string) => void;

// Formato de um item salvo no navegador pelo useCarrinho (localStorage)
interface ItemCarrinhoLocal {
  produto: {
    id_produto: number;
    id_categoria?: number;
    nome?: string;
    descricao?: string;
    preco?: string;
    imagem?: string;
    estoque?: number;
  };
  quantidade: number;
}

const TITULOS = ['Meu perfil', 'Segurança', 'Endereços', 'Depoimentos', 'Assinaturas'];

function Stars({ n }: { n: number }) {
  return <span className="pu-stars">{Array.from({ length: 5 }, (_, i) => i < n ? '★' : '☆').join('')}</span>;
}

function getIniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function BtnOlho({ visivel, onToggle }: { visivel: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="pu-input-eye" onClick={onToggle} aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'} tabIndex={-1}>
      {visivel ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

// ─── Telas ────────────────────────────────────────────────────────────────────

// Linha do tempo do pedido: pendente → preparo → caminho → entregue.
// Mostra em que etapa o pedido está e o que já foi concluído.
const ETAPAS_PEDIDO = [
  { chave: 'pendente', label: 'Pedido recebido' },
  { chave: 'preparo',  label: 'Em preparo' },
  { chave: 'caminho',  label: 'A caminho' },
  { chave: 'entregue', label: 'Entregue' },
] as const;

// Nomes amigáveis dos status (inclusive os novos: aguardando pagamento e cancelado)
const NOMES_STATUS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pendente: 'Recebido pela loja',
  preparo: 'Em preparo',
  caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

function PilhaStatus({ status }: { status: string }) {
  const idxAtual = ETAPAS_PEDIDO.findIndex(e => e.chave === status);
  // Fora do fluxo normal (aguardando pagamento/cancelado) não há etapas a marcar
  if (idxAtual < 0) return null;
  const atual = idxAtual;
  return (
    <ol className="pu-timeline" aria-label="Etapas do pedido">
      {ETAPAS_PEDIDO.map((etapa, i) => {
        const feita = i < atual;
        const ativa = i === atual;
        return (
          <li
            key={etapa.chave}
            className={`pu-timeline-item${feita ? ' feita' : ''}${ativa ? ' ativa' : ''}`}
          >
            <span className="pu-timeline-ponto" aria-hidden="true">{feita ? '✓' : ''}</span>
            <span className="pu-timeline-label">{etapa.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Card de uma compra no histórico ──────────────────────────────────────────
// Mostra o que foi comprado, o status e os botões de ação:
//   • "Acompanhar pedido" — leva para a tela de acompanhamento ao vivo
//   • "Comprar de novo"   — reconstrói o carrinho com os itens da compra
//   • "Cancelar pedido"   — só enquanto a loja ainda não começou o preparo
function CardPedido({ p, showToast, onPedidoCancelado }: {
  p: Historico;
  showToast: ShowToast;
  onPedidoCancelado: (id: number) => void;
}) {
  const navigate = useNavigate();
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [recomprando, setRecomprando] = useState(false);

  // Dá para cancelar enquanto a loja não começou o preparo e o cliente ainda
  // não pagou (pedido pago por Pix/cartão é resolvido com a loja)
  const pago = p.status === 'pendente' && ['pix', 'cartao'].includes(p.forma_pagamento ?? 'presencial');
  const podeCancelar = ['pendente', 'aguardando_pagamento'].includes(p.status) && !pago;

  async function confirmarCancelamento() {
    setCancelando(true);
    try {
      const res = await api.cancelarPedido(p.id);
      showToast('sucesso', res.mensagem || 'Pedido cancelado.');
      onPedidoCancelado(p.id);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Não foi possível cancelar o pedido.');
    } finally {
      setCancelando(false);
      setConfirmando(false);
    }
  }

  async function recomprar() {
    if (!p.slug) {
      showToast('erro', 'Não foi possível encontrar a loja deste pedido.');
      return;
    }
    setRecomprando(true);
    try {
      const res = await api.itensRecompra(p.id);
      const itens: {
        id_produto: number; id_categoria: number; nome: string; descricao?: string;
        preco?: string; imagem?: string; estoque?: number; quantidade: number;
      }[] = res.itens ?? [];

      if (itens.length === 0) {
        showToast('erro', 'Os itens deste pedido não estão mais disponíveis.');
        return;
      }

      // Grava os itens no carrinho desta loja (mesmo formato do useCarrinho)
      // e abre a tela do carrinho. O que já estava lá é mantido.
      const chave = `carrinho_${p.id_mercado}`;
      let atuais: ItemCarrinhoLocal[] = [];
      try { atuais = JSON.parse(localStorage.getItem(chave) ?? '[]'); } catch { atuais = []; }

      const novos = [...atuais];
      for (const item of itens) {
        const idx = novos.findIndex(i => i.produto.id_produto === item.id_produto);
        if (idx >= 0) {
          novos[idx] = { ...novos[idx], quantidade: item.quantidade };
        } else {
          novos.push({
            produto: {
              id_produto: item.id_produto,
              id_categoria: item.id_categoria,
              nome: item.nome,
              descricao: item.descricao,
              preco: item.preco,
              imagem: item.imagem,
              estoque: item.estoque,
            },
            quantidade: item.quantidade,
          });
        }
      }
      localStorage.setItem(chave, JSON.stringify(novos));

      showToast('sucesso', 'Itens adicionados ao carrinho. Confira antes de finalizar.');
      navigate(`/vitrine/${p.slug}/carrinho`);
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Não foi possível montar o carrinho.');
    } finally {
      setRecomprando(false);
    }
  }

  return (
    <div className="pu-hcard" style={{ animationDelay: '0.3s' }}>
      <div className="pu-hcard-img"><IconShoppingBag size={26} /></div>
      <div className="pu-hcard-body">
        <p className="pu-hcard-nome">{p.mercado}</p>
        <p className="pu-hcard-preco">R$ {p.valor_total}</p>
        <p className="pu-hcard-itens" title="Itens comprados">{p.produtos}</p>
        <p className="pu-hcard-data">{new Date(p.data_compra).toLocaleDateString('pt-BR')}</p>
        <span className={`pu-status ${p.status}`}>● {NOMES_STATUS[p.status] ?? p.status}</span>
        <PilhaStatus status={p.status} />
        <button
          className="pu-hcard-acompanhar"
          type="button"
          onClick={() => navigate(`/pedidos/${p.id}`)}
        >
          Acompanhar pedido
        </button>
        <div className="pu-hcard-acoes">
          <button
            className="pu-hcard-recomprar"
            type="button"
            onClick={recomprar}
            disabled={recomprando}
          >
            {recomprando ? 'Montando carrinho…' : 'Comprar de novo'}
          </button>
          {podeCancelar && !confirmando && (
            <button
              className="pu-hcard-cancelar"
              type="button"
              onClick={() => setConfirmando(true)}
            >
              Cancelar pedido
            </button>
          )}
        </div>
        {confirmando && (
          <div className="pu-hcard-confirma" role="alertdialog" aria-label="Confirmar cancelamento">
            <span>Cancelar este pedido?</span>
            <div className="pu-hcard-confirma-botoes">
              <button
                className="pu-hcard-confirma-sim"
                type="button"
                onClick={confirmarCancelamento}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
              </button>
              <button
                className="pu-hcard-confirma-nao"
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={cancelando}
              >
                Não
              </button>
            </div>
          </div>
        )}
        {p.observacao && (
          <p className="pu-hcard-obs" title="Sua observação neste pedido"><IconInfo size={12} /> {p.observacao}</p>
        )}
      </div>
    </div>
  );
}

// Ícone de lixeira dos endereços salvos
function IconLixeira({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

// ─── Endereços de entrega (aba própria do perfil) ─────────────────────────────
// O cliente cadastra, edita, apaga e escolhe o endereço principal aqui. O
// principal é o que já vem marcado na hora de fechar o pedido no carrinho.
function TelaEnderecos() {
  const { enderecos, carregando, adicionar, editar, remover, definirPrincipal } = useEnderecos();
  const { toasts, showToast, dismissToast } = useToast();
  const [popupAberto, setPopupAberto] = useState(false);
  // Guarda o endereço em edição (null = cadastrando um novo)
  const [editando, setEditando] = useState<EnderecoSalvo | null>(null);
  // Muda a cada abertura: o pop-up nasce zerado toda vez
  const [popupChave, setPopupChave] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erroPopup, setErroPopup] = useState<string | null>(null);

  function abrirNovo() {
    setEditando(null);
    setErroPopup(null);
    setPopupChave(c => c + 1);
    setPopupAberto(true);
  }

  function abrirEdicao(endereco: EnderecoSalvo) {
    setEditando(endereco);
    setErroPopup(null);
    setPopupChave(c => c + 1);
    setPopupAberto(true);
  }

  function fecharPopup() {
    setPopupAberto(false);
    setEditando(null);
  }

  async function salvarEndereco(dados: EnderecoEntrega) {
    const eraEdicao = editando;
    try {
      setSalvando(true);
      setErroPopup(null);
      if (eraEdicao) await editar(eraEdicao.id, dados);
      else await adicionar(dados);
      setPopupAberto(false);
      setEditando(null);
      showToast('sucesso', eraEdicao ? 'Endereço atualizado com sucesso.' : 'Endereço salvo com sucesso.');
    } catch (e) {
      setErroPopup(e instanceof Error ? e.message : 'Não foi possível salvar o endereço.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagarEndereco(id: string) {
    try {
      await remover(id);
      showToast('sucesso', 'Endereço removido.');
    } catch (e) {
      showToast('erro', e instanceof Error ? e.message : 'Não foi possível remover o endereço.');
    }
  }

  async function marcarPrincipal(id: string) {
    try {
      await definirPrincipal(id);
      showToast('sucesso', 'Endereço principal alterado.');
    } catch (e) {
      showToast('erro', e instanceof Error ? e.message : 'Não foi possível definir o endereço principal.');
    }
  }

  return (
    <section>
      <div className="pu-sec-row">
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconMapPin size={14} /></span>Endereços de entrega</h2>
        <button className="pu-btn-link" onClick={abrirNovo}>Adicionar endereço</button>
      </div>

      <p className="pu-endereco-dica">
        O endereço marcado como <strong>principal</strong> já vem selecionado
        automaticamente na hora de fechar o pedido.
      </p>

      {carregando ? (
        <p className="pu-empty-inline">Carregando seus endereços...</p>
      ) : enderecos.length === 0 ? (
        <div className="pu-empty">
          <div className="pu-empty-icon"><IconMapPin size={22} /></div>
          <p>Nenhum endereço cadastrado</p>
          <span>Adicione um endereço para receber seus pedidos em casa.</span>
          <button className="pu-btn-endereco" onClick={abrirNovo}>
            <IconPlus size={15} /> Adicionar endereço
          </button>
        </div>
      ) : (
        <div className="pu-endereco-lista">
          {enderecos.map(e => (
            <div className={`pu-endereco-item${e.principal ? ' pu-endereco-item--principal' : ''}`} key={e.id}>
              <span className="pu-endereco-icone"><IconMapPin size={16} /></span>
              <span className="pu-endereco-texto">
                <strong>
                  {e.principal ? 'Endereço principal' : 'Endereço de entrega'}
                  {e.principal && <span className="pu-endereco-badge">Principal</span>}
                </strong>
                <span>{formatarEndereco(e)}</span>
              </span>
              <span className="pu-endereco-acoes">
                {!e.principal && (
                  <button
                    className="pu-endereco-principal"
                    onClick={() => marcarPrincipal(e.id)}
                    title="Usar este endereço como principal"
                  >
                    Definir como principal
                  </button>
                )}
                <button
                  className="pu-endereco-acao"
                  onClick={() => abrirEdicao(e)}
                  title="Editar este endereço"
                  aria-label="Editar este endereço"
                >
                  <IconPencil size={14} />
                </button>
                <button
                  className="pu-endereco-remover"
                  onClick={() => apagarEndereco(e.id)}
                  title="Remover este endereço"
                  aria-label="Remover este endereço"
                >
                  <IconLixeira />
                </button>
              </span>
            </div>
          ))}
          <button className="pu-btn-endereco" onClick={abrirNovo}>
            <IconPlus size={15} /> Adicionar endereço
          </button>
        </div>
      )}

      <EnderecoPopup
        key={popupChave}
        aberto={popupAberto}
        enderecoInicial={editando ?? undefined}
        titulo={editando ? 'Editar endereço de entrega' : 'Adicionar endereço de entrega'}
        salvando={salvando}
        erro={erroPopup}
        onFechar={fecharPopup}
        onSalvar={salvarEndereco}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
}

function TelaPerfil({ favoritos, historico, avaliacoes, onAtualizarFavoritos, onPedidoCancelado }: {
  favoritos: Favorito[];
  historico: Historico[];
  avaliacoes: Avaliacao[];
  onAtualizarFavoritos: (favoritos: Favorito[]) => void;
  onPedidoCancelado: (id: number) => void;
}) {
  const [modalFavoritoAberto, setModalFavoritoAberto] = useState(false);
  // Avisos (sucesso/erro) das ações do histórico: recomprar e cancelar pedido
  const { toasts, showToast, dismissToast } = useToast();

  return (
    <>
      <section>
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconStore size={15} /></span>Mercados favoritos</h2>
        <div className="pu-circles">
          <div className="pu-circ-item" style={{ animationDelay: '0.3s' }}>
            <div
              className="pu-circ pu-circ-add"
              onClick={() => setModalFavoritoAberto(true)}
              role="button"
              tabIndex={0}
              title="Adicionar mercado favorito"
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setModalFavoritoAberto(true); }}
            >+</div>
            <span className="pu-circ-label pu-circ-muted">Adicionar</span>
          </div>
          {favoritos.map((f, i) => (
            <div key={f.id} className="pu-circ-item" style={{ animationDelay: `${0.38 + i * 0.07}s` }}>
              <div className="pu-circ"><IconStore size={22} /></div>
              <span className="pu-circ-label">{f.nome}</span>
            </div>
          ))}
        </div>
        {favoritos.length === 0 && (
          <p className="pu-empty-inline">Você ainda não favoritou nenhum mercado. Explore e adicione seus preferidos aqui.</p>
        )}
      </section>

      {modalFavoritoAberto && (
        <AdicionarMercadoFavorito
          favoritosAtuais={favoritos}
          onAtualizarFavoritos={onAtualizarFavoritos}
          onFechar={() => setModalFavoritoAberto(false)}
        />
      )}

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconShoppingBag size={14} /></span>Histórico de Compras</h2>
          <button className="pu-btn-link">Ver todos</button>
        </div>
        {historico.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconShoppingBag size={22} /></div>
            <p>Nenhuma compra realizada ainda</p>
            <span>Seus pedidos aparecerão aqui assim que você comprar em um mercado.</span>
          </div>
        ) : (
          <div className="pu-hist-grid">
            {historico.map(p => (
              <CardPedido
                key={p.id}
                p={p}
                showToast={showToast}
                onPedidoCancelado={onPedidoCancelado}
              />
            ))}
          </div>
        )}
      </section>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconStar size={14} /></span>Avaliações feitas</h2>
          <button className="pu-btn-link">Ver todas</button>
        </div>
        {avaliacoes.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconStar size={22} /></div>
            <p>Você ainda não avaliou nenhum mercado</p>
            <span>Suas avaliações ajudam outros compradores a escolher melhor.</span>
          </div>
        ) : (
          <div className="pu-rev-grid">
            {avaliacoes.map((a, i) => (
              <div key={a.id} className="pu-rev-card" style={{ animationDelay: `${0.3 + i * 0.09}s` }}>
                <p className="pu-rev-store">{a.loja}</p>
                <Stars n={a.nota} />
                <p className="pu-rev-text">{a.texto}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function TelaSeguranca() {
  const { usuario } = useAuth();
  const { toasts, showToast, dismissToast } = useToast();
  const [etapa, setEtapa] = useState<'form' | 'codigo' | 'sucesso'>('form');
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ senhaAtual: '', novaSenha: '', confirmarSenha: '', emailConfirmacao: '' });
  const [codigo, setCodigo] = useState('');
  const [mostrarAtual, setMostrarAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  async function enviarConfirmacao() {
    if (!form.senhaAtual) return showToast('erro', 'Digite a senha atual.');
    if (!form.novaSenha) return showToast('erro', 'Digite a nova senha.');
    if (form.novaSenha.length < 6) return showToast('erro', 'A senha deve ter ao menos 6 caracteres.');
    if (form.novaSenha !== form.confirmarSenha) return showToast('erro', 'As senhas não coincidem.');
    if (!form.emailConfirmacao) return showToast('erro', 'Digite o email de confirmação.');
    if (form.emailConfirmacao !== usuario?.email) return showToast('erro', 'O email digitado deve ser o mesmo da sua conta.');

    setEnviando(true);
    try {
      await api.trocarSenha({ senhaAtual: form.senhaAtual, novaSenha: form.novaSenha, emailConfirmacao: form.emailConfirmacao });
      setEtapa('codigo');
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao enviar email.');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo() {
    if (!codigo) return showToast('erro', 'Digite o código.');
    if (codigo.length !== 6) return showToast('erro', 'O código deve ter 6 dígitos.');

    setEnviando(true);
    try {
      await api.confirmarTrocaSenha({ codigo, emailConfirmacao: form.emailConfirmacao });
      setEtapa('sucesso');
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao confirmar código.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {enviando && <LoadingOverlay mensagem={etapa === 'codigo' ? 'Confirmando código...' : 'Enviando email...'} />}

      <section>
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconLock size={14} /></span>Segurança</h2>

        {etapa === 'form' ? (
          <div className="pu-form-block">
            <div className="pu-modal-group">
              <label className="pu-modal-label">Senha atual</label>
              <div className="pu-input-wrap">
                <input
                  className="pu-modal-input"
                  type={mostrarAtual ? 'text' : 'password'}
                  value={form.senhaAtual}
                  onChange={e => setForm(f => ({ ...f, senhaAtual: sanitizePassword(e.target.value) }))}
                  maxLength={LIMITS.senha}
                  onKeyDown={bloquearEspaco}
                  placeholder="••••••••"
                />
                <BtnOlho visivel={mostrarAtual} onToggle={() => setMostrarAtual(v => !v)} />
              </div>
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Nova senha</label>
              <div className="pu-input-wrap">
                <input
                  className="pu-modal-input"
                  type={mostrarNovaSenha ? 'text' : 'password'}
                  value={form.novaSenha}
                  onChange={e => setForm(f => ({ ...f, novaSenha: sanitizePassword(e.target.value) }))}
                  maxLength={LIMITS.senha}
                  onKeyDown={bloquearEspaco}
                  placeholder="••••••••"
                />
                <BtnOlho visivel={mostrarNovaSenha} onToggle={() => setMostrarNovaSenha(v => !v)} />
              </div>
              <PasswordStrength senha={form.novaSenha} />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Confirmar nova senha</label>
              <div className="pu-input-wrap">
                <input
                  className="pu-modal-input"
                  type={mostrarConfirmar ? 'text' : 'password'}
                  value={form.confirmarSenha}
                  onChange={e => setForm(f => ({ ...f, confirmarSenha: sanitizePassword(e.target.value) }))}
                  maxLength={LIMITS.confirmar}
                  onKeyDown={bloquearEspaco}
                  placeholder="••••••••"
                />
                <BtnOlho visivel={mostrarConfirmar} onToggle={() => setMostrarConfirmar(v => !v)} />
              </div>
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">E-mail de confirmação</label>
              <input
                className="pu-modal-input"
                type="email"
                value={form.emailConfirmacao}
                onChange={e => setForm(f => ({ ...f, emailConfirmacao: sanitizeEmail(e.target.value) }))}
                maxLength={LIMITS.email}
                onKeyDown={bloquearEspaco}
                placeholder="Digite o email da sua conta"
              />
              <span className="pu-input-hint">Digite o email da sua conta para confirmar a alteração de senha.</span>
            </div>
            <button
              className="pu-modal-btn-save pu-form-btn"
              onClick={enviarConfirmacao}
              disabled={enviando}
            >
              <IconMail size={15} /> Enviar código de confirmação
            </button>
          </div>
        ) : etapa === 'codigo' ? (
          <div className="pu-confirm-card">
            <div className="pu-confirm-icon"><IconInbox size={30} /></div>
            <p className="pu-confirm-title">Verifique seu email</p>
            <p className="pu-confirm-text">
              Enviamos um código de 6 dígitos para{' '}
              <strong className="pu-confirm-highlight">{usuario?.email}</strong>.
              Digite o código e o email da sua conta para confirmar a troca de senha.
            </p>
            <div className="pu-modal-group">
              <label className="pu-modal-label">Código de Confirmação</label>
              <input
                className="pu-modal-input"
                type="text"
                placeholder="Digite o código de 6 dígitos"
                value={codigo}
                onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
            </div>
            <div className="pu-modal-group">
              <label className="pu-modal-label">E-mail de confirmação</label>
              <input
                className="pu-modal-input"
                type="email"
                value={form.emailConfirmacao}
                readOnly
              />
            </div>
            <button
              className="pu-modal-btn-save pu-form-btn"
              onClick={confirmarCodigo}
              disabled={enviando}
            >
              Confirmar Código
            </button>
            <button
              className="pu-modal-btn-cancel"
              onClick={() => { setEtapa('form'); setCodigo(''); setForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '', emailConfirmacao: '' }); }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="pu-confirm-card">
            <div className="pu-confirm-icon"><IconInbox size={30} /></div>
            <p className="pu-confirm-title">Senha atualizada!</p>
            <p className="pu-confirm-text">
              Sua senha foi alterada com sucesso. Use a nova senha no próximo login.
            </p>
            <button
              className="pu-modal-btn-save pu-form-btn"
              onClick={() => { setEtapa('form'); setCodigo(''); setForm({ senhaAtual: '', novaSenha: '', confirmarSenha: '', emailConfirmacao: '' }); }}
            >
              Alterar novamente
            </button>
          </div>
        )}
      </section>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ─── Tela de depoimentos ──────────────────────────────────────────────────────
// O cliente conta o que achou da plataforma: uma nota de 1 a 5 estrelas e um
// texto. Cada cliente deixa um depoimento — se escrever de novo, o anterior é
// atualizado. Abaixo do formulário, ficam os depoimentos recentes de quem já
// usa o Mercadins (inclusive o dele, marcado com "Seu depoimento").
function TelaDepoimentos() {
  const { toasts, showToast, dismissToast } = useToast();
  const [lista, setLista] = useState<Depoimento[]>([]);
  const [media, setMedia] = useState(0);
  const [total, setTotal] = useState(0);
  const [nota, setNota] = useState(5);
  const [texto, setTexto] = useState('');
  const [jaPublicou, setJaPublicou] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    api.listarDepoimentos()
      .then(res => {
        const depoimentos: Depoimento[] = res.depoimentos ?? [];
        setLista(depoimentos);
        setMedia(Number(res.media) || 0);
        setTotal(Number(res.total) || 0);

        // Já escreveu antes? Carrega no formulário para poder editar
        const meu = depoimentos.find(d => d.minha);
        if (meu) {
          setJaPublicou(true);
          setNota(meu.nota);
          setTexto(meu.texto);
        }
      })
      .catch(() => { /* sem conexão: a tela apenas fica sem a lista */ })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const textoLimpo = removeEmojis(texto).trim();
    if (textoLimpo.length < 10) {
      showToast('erro', 'Escreva pelo menos algumas palavras sobre a sua experiência.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.criarDepoimento({ nota, texto: textoLimpo });
      showToast('sucesso', res.mensagem || 'Depoimento registrado com sucesso.');
      carregar();
    } catch (err: unknown) {
      showToast('erro', err instanceof Error ? err.message : 'Não foi possível registrar o depoimento.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <section>
        <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconMessage size={15} /></span>O que você achou do Mercadins?</h2>
        <p className="pu-dep-intro">
          Conte como foi a sua experiência com a plataforma. O seu depoimento ajuda outras
          pessoas e melhora o Mercadins.
        </p>

        <form className="pu-dep-form" onSubmit={enviar}>
          <div className="pu-dep-nota">
            <span className="pu-modal-label">Sua nota</span>
            <div className="pu-dep-estrelas" role="group" aria-label="Nota de 1 a 5 estrelas">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`pu-dep-estrela${n <= nota ? ' ativa' : ''}`}
                  onClick={() => setNota(n)}
                  aria-label={`Dar ${n} estrela${n > 1 ? 's' : ''}`}
                  aria-pressed={n <= nota}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div className="pu-modal-group">
            <label className="pu-modal-label" htmlFor="pu-depoimento-texto">Seu depoimento</label>
            <textarea
              id="pu-depoimento-texto"
              className="pu-dep-texto"
              rows={4}
              maxLength={600}
              value={texto}
              onChange={e => setTexto(removeEmojis(e.target.value))}
              placeholder="Ex.: O Mercadins facilitou minhas compras, achei tudo rápido e os produtos chegaram certinhos."
            />
            <span className="pu-input-hint">{texto.length}/600 caracteres</span>
          </div>

          <button className="pu-modal-btn-save pu-form-btn" type="submit" disabled={enviando}>
            {enviando ? 'Enviando...' : jaPublicou ? 'Atualizar depoimento' : 'Publicar depoimento'}
          </button>
        </form>
      </section>

      <div className="pu-divider" />

      <section>
        <div className="pu-sec-row">
          <h2 className="pu-sec-title"><span className="pu-sec-icon"><IconStar size={14} /></span>Depoimentos de quem já usa</h2>
          {total > 0 && <span className="pu-dep-resumo">{media.toFixed(1)} ★ · {total} depoimento{total > 1 ? 's' : ''}</span>}
        </div>

        {carregando ? (
          <p className="pu-empty-inline">Carregando depoimentos…</p>
        ) : lista.length === 0 ? (
          <div className="pu-empty">
            <div className="pu-empty-icon"><IconMessage size={22} /></div>
            <p>Nenhum depoimento ainda</p>
            <span>Seja o primeiro a contar como foi a sua experiência no Mercadins.</span>
          </div>
        ) : (
          <div className="pu-dep-grid">
            {lista.map((d, i) => (
              <article key={d.id} className="pu-dep-card" style={{ animationDelay: `${0.3 + i * 0.07}s` }}>
                <header className="pu-dep-card-topo">
                  <span className="pu-dep-avatar" aria-hidden="true">{getIniciais(d.cliente || '?')}</span>
                  <span className="pu-dep-nome">{d.cliente}</span>
                  {d.minha && <span className="pu-dep-eu">Seu depoimento</span>}
                </header>
                <Stars n={d.nota} />
                <p className="pu-dep-texto-lista">{d.texto}</p>
                <time className="pu-dep-data">{new Date(d.data_cadastro).toLocaleDateString('pt-BR')}</time>
              </article>
            ))}
          </div>
        )}
      </section>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PerfilUsuario() {
  const [nav, setNav] = useState<number>(0);
  const [telaAtiva, setTelaAtiva] = useState(0);
  const [visivel, setVisivel] = useState(true);
  const anteriorNav = useRef(0);
  const [modalAberto, setModalAberto] = useState(false);
  const { usuario } = useAuth();

  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);

  useEffect(() => {
    async function carregarDados() {
      const [favRes, histRes, avalRes] = await Promise.allSettled([
        api.listarFavoritos(),
        api.listarHistorico(),
        api.listarAvaliacoes(),
      ]);
      if (favRes.status === 'fulfilled') setFavoritos(favRes.value.favoritos ?? []);
      if (histRes.status === 'fulfilled') setHistorico(histRes.value.historico ?? []);
      if (avalRes.status === 'fulfilled') setAvaliacoes(avalRes.value.avaliacoes ?? []);
    }
    carregarDados();
  }, []);

  const iniciais = usuario ? getIniciais(usuario.nome) : '?';

  // Depois de cancelar, o cartão muda de status na mesma hora (sem recarregar)
  function marcarPedidoCancelado(id: number) {
    setHistorico(atual =>
      atual.map(h => (h.id === id ? { ...h, status: 'cancelado' } : h))
    );
  }

  const TELAS = [
    <TelaPerfil
      key="perfil"
      favoritos={favoritos}
      historico={historico}
      avaliacoes={avaliacoes}
      onAtualizarFavoritos={setFavoritos}
      onPedidoCancelado={marcarPedidoCancelado}
    />,
    <TelaSeguranca key="seguranca" />,
    <TelaEnderecos key="enderecos" />,
    <TelaDepoimentos key="depoimentos" />,
    <TelaAssinaturas key="assinaturas" />,
  ];

  useEffect(() => {
    if (anteriorNav.current === nav) return;
    setVisivel(false);
    const t = setTimeout(() => {
      setTelaAtiva(nav);
      setVisivel(true);
      anteriorNav.current = nav;
    }, 180);
    return () => clearTimeout(t);
  }, [nav]);

  return (
   <div className="pu-shell">
      <Sidebar
        iniciais={iniciais}
        nome={usuario?.nome ?? 'Carregando...'}
        email={usuario?.email ?? ''}
        navAtivo={nav}
        onNav={setNav}
        onEditarPerfil={() => setModalAberto(true)}
        foto={usuario?.foto_perfil}
      />
      <main className="pu-main">
        <div className="pu-topbar">
          <span className="pu-topbar-title">{TITULOS[nav]}</span>
        </div> 
        <div className="pu-content">
          <div className={`pu-tela-fade ${visivel ? 'pu-tela-visivel' : 'pu-tela-oculta'}`}>
            {TELAS[telaAtiva]}
          </div>
        </div>
      </main>

      {modalAberto && <ModalEditarPerfil onFechar={() => setModalAberto(false)} />}
    </div>
  );
}