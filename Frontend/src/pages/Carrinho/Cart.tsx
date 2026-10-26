import { useMemo, useState } from "react";
import { removeEmojis } from "../../hooks/useBlockEmojis";
import { IconShoppingCart } from "../../components/Icons";
import { parseHorario, estaAberto, proximaAbertura } from "../../utils/horario";
import {
  type EnderecoEntrega,
  type EnderecoSalvo,
  type CampoEndereco,
  ENDERECO_VAZIO,
  NOMES_CAMPOS_ENDERECO,
  camposEnderecoFaltando,
  mascaraCep,
  formatarEndereco,
  gerarIdEndereco,
  carregarEnderecos,
  guardarEnderecos,
} from "../../utils/endereco";
import "./Cart.css";

// ---------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------
export interface CartItem {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
  /** Unidades disponíveis em estoque — trava o "+" do carrinho */
  estoque?: number;
}

/** Cupom aplicado no carrinho (o desconto vem do backend) */
export interface CupomAplicado {
  codigo: string;
  desconto: number;
}

interface CartScreenProps {
  storeName?: string;
  storeLocation?: string;
  initialItems?: CartItem[];
  onBack?: () => void;
  onCheckout?: (items: CartItem[], total: number) => void;
  finalizando?: boolean;
  observacao?: string;
  onObservacaoChange?: (valor: string) => void;
  onUpdateQuantity?: (id: string, delta: number) => void;
  onRemoveItem?: (id: string) => void;
  onClearCart?: () => void;

  // ── Entrega e retirada (vêm do cadastro do mercado) ───────────────────────
  taxaEntrega?: number;
  pedidoMinimo?: number;
  ofereceEntrega?: boolean;
  ofereceRetirada?: boolean;
  tipoEntrega?: "entrega" | "retirada";
  onTipoEntregaChange?: (tipo: "entrega" | "retirada") => void;
  // Horário de funcionamento da loja (JSON de mercados.horario) — usado para
  // avisar, quando a loja está fechada, quando a compra poderá ser retirada
  horario?: string | null;

  // ── Cupom de desconto ─────────────────────────────────────────────────────
  cupom?: CupomAplicado | null;
  verificandoCupom?: boolean;
  onAplicarCupom?: (codigo: string) => void;
  onRemoverCupom?: () => void;

  // ── Agendamento: quando o cliente quer receber/retirar ────────────────────
  agendamento?: string;
  onAgendamentoChange?: (valor: string) => void;

  // ── Endereço de entrega: aparece quando a compra será entregue ────────────
  endereco?: EnderecoEntrega;
  onEnderecoChange?: (endereco: EnderecoEntrega) => void;

  // ── Pagamento (B3): pagar na entrega, Pix ou cartão ──────────────────────
  formaPagamento?: "presencial" | "pix" | "cartao";
  onFormaPagamentoChange?: (forma: "presencial" | "pix" | "cartao") => void;
}

// Popup para cadastrar/editar um endereço de entrega
function EnderecoPopup({
  aberto,
  enderecoInicial,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  enderecoInicial: EnderecoEntrega;
  onFechar: () => void;
  onSalvar: (endereco: EnderecoEntrega) => void;
}) {
  const [endereco, setEndereco] = useState<EnderecoEntrega>(enderecoInicial);
  // Só destaca os campos em vermelho depois que a pessoa tenta salvar
  const [tentouSalvar, setTentouSalvar] = useState(false);

  const faltando = camposEnderecoFaltando(endereco);
  const camposComErro = new Set<CampoEndereco>(tentouSalvar ? faltando : []);

  const mudarCampo = (campo: keyof EnderecoEntrega, valor: string) => {
    const novo: EnderecoEntrega = { ...endereco };
    novo[campo] = campo === "cep" ? mascaraCep(valor) : valor;
    setEndereco(novo);
  };

  const tentarSalvar = () => {
    if (faltando.length > 0) {
      setTentouSalvar(true);
      return;
    }
    onSalvar(endereco);
  };

  if (!aberto) return null;

  const nomesFaltando = faltando.map((campo) => NOMES_CAMPOS_ENDERECO[campo]);

  return (
    <>
      <div className="cart-endereco-popup__backdrop" onClick={onFechar} />
      <div className="cart-endereco-popup" onClick={(e) => e.stopPropagation()}>
        <div className="cart-endereco-popup__header">
          <h3 className="cart-endereco-popup__titulo">Adicionar endereço de entrega</h3>
          <button className="cart-endereco-popup__fechar" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className="cart-endereco-popup__body">
          <div className="cart-endereco__grid">
            <CampoEndereco
              id="popup-endereco-rua"
              label="Rua"
              campo="rua"
              valor={endereco.rua}
              placeholder="Ex.: Rua das Flores"
              autoComplete="address-line1"
              comErro={camposComErro.has("rua")}
              onMudar={(valor) => mudarCampo("rua", valor)}
            />
            <CampoEndereco
              id="popup-endereco-numero"
              label="Número"
              campo="numero"
              valor={endereco.numero}
              placeholder="Ex.: 123"
              maxLength={10}
              inputMode="numeric"
              comErro={camposComErro.has("numero")}
              onMudar={(valor) => mudarCampo("numero", valor)}
            />
            <CampoEndereco
              id="popup-endereco-bairro"
              label="Bairro"
              campo="bairro"
              valor={endereco.bairro}
              placeholder="Ex.: Centro"
              comErro={camposComErro.has("bairro")}
              onMudar={(valor) => mudarCampo("bairro", valor)}
            />
            <CampoEndereco
              id="popup-endereco-cep"
              label="CEP"
              campo="cep"
              valor={endereco.cep}
              placeholder="00000-000"
              maxLength={9}
              inputMode="numeric"
              autoComplete="postal-code"
              comErro={camposComErro.has("cep")}
              onMudar={(valor) => mudarCampo("cep", valor)}
            />
            <CampoEndereco
              id="popup-endereco-cidade"
              label="Cidade"
              campo="cidade"
              valor={endereco.cidade}
              placeholder="Ex.: Taquaritinga"
              autoComplete="address-level2"
              comErro={camposComErro.has("cidade")}
              onMudar={(valor) => mudarCampo("cidade", valor)}
            />
            <CampoEndereco
              id="popup-endereco-complemento"
              label="Complemento (opcional)"
              campo="complemento"
              valor={endereco.complemento}
              placeholder="Apto, bloco, referência…"
              onMudar={(valor) => mudarCampo("complemento", valor)}
            />
          </div>

          {tentouSalvar && faltando.length > 0 && (
            <p className="cart-endereco-popup__erro" role="alert">
              Preencha: {nomesFaltando.join(", ")}.
            </p>
          )}
        </div>

        <div className="cart-endereco-popup__footer">
          <button type="button" className="cart-endereco-popup__btn-cancelar" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="cart-endereco-popup__btn-salvar"
            onClick={tentarSalvar}
          >
            Salvar endereço
          </button>
        </div>
      </div>
    </>
  );
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Opções de agendamento (escolha simples, sem calendário)
const OPCOES_AGENDAMENTO = [
  "Quanto antes",
  "Hoje de manhã",
  "Hoje à tarde",
  "Hoje à noite",
  "Amanhã de manhã",
  "Amanhã à tarde",
  "Amanhã à noite",
];

// ---------------------------------------------------------------
// Ícones (SVG inline, sem dependências externas)
// ---------------------------------------------------------------
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
  </svg>
);

const IconMinus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <path d="M5 12h14" />
  </svg>
);

const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconCart = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const IconReceipt = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h16v20l-3-2-2 2-2-2-2 2-2-2-2 2-3-2V2Z" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

const IconTruck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const IconStore = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l1.5-5h15L21 9M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
  </svg>
);

const IconPix = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z" />
    <path d="M8 8.5 12 12.5 16 8.5M8 15.5l4-4 4 4" />
  </svg>
);

const IconCard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </svg>
);

const IconTag = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <circle cx="7" cy="7" r="1.2" />
  </svg>
);

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconMapPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// Um campo do endereço de entrega (rua, número, bairro, CEP...)
function CampoEndereco({
  id,
  label,
  campo,
  valor,
  placeholder,
  maxLength = 80,
  inputMode,
  autoComplete,
  comErro,
  onMudar,
}: {
  id: string;
  label: string;
  campo: CampoEndereco | "complemento";
  valor: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric";
  autoComplete?: string;
  comErro?: boolean;
  onMudar: (valor: string) => void;
}) {
  return (
    <div className={`cart-endereco__campo cart-endereco__campo--${campo}${comErro ? " is-erro" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={valor}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onMudar(e.target.value)}
      />
    </div>
  );
}

// ---------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------
export default function CartScreen({
  storeName = "Mercadins",
  storeLocation = "Guariba · SP",
  initialItems = [],
  onBack,
  onCheckout,
  finalizando = false,
  observacao = "",
  onObservacaoChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  taxaEntrega = 0,
  pedidoMinimo = 0,
  ofereceEntrega = true,
  ofereceRetirada = true,
  tipoEntrega = "entrega",
  onTipoEntregaChange,
  horario = null,
  cupom = null,
  verificandoCupom = false,
  onAplicarCupom,
  onRemoverCupom,
  agendamento = "",
  onAgendamentoChange,
  endereco = ENDERECO_VAZIO,
  onEnderecoChange,
  formaPagamento = "presencial",
  onFormaPagamentoChange,
}: CartScreenProps) {
  // Os itens vêm do componente pai (useCarrinho) — fonte única de verdade,
  // sincronizada com o navegador (localStorage) e com o banco.
  const items = initialItems;
  const [coupon, setCoupon] = useState("");
  // Aviso de endereço incompleto — só aparece quando o cliente tenta finalizar
  // uma entrega sem precher os campos obrigatórios
  const [erroEndereco, setErroEndereco] = useState<string | null>(null);
  // Controla se o popup de cadastro de endereço está aberto
  const [enderecoPopupAberto, setEnderecoPopupAberto] = useState(false);
  // Muda a cada abertura: assim o popup nasce zerado toda vez
  const [popupChave, setPopupChave] = useState(0);
  // Endereço sendo digitado no popup (sempre começa vazio: é um endereço novo)
  const [enderecoEditando, setEnderecoEditando] = useState<EnderecoEntrega>({ ...ENDERECO_VAZIO });

  // Carteira de endereços do cliente — fica salva no navegador, então ele não
  // digita o mesmo endereço toda vez e pode guardar mais de um
  const [enderecos, setEnderecos] = useState<EnderecoSalvo[]>(() => {
    const salvos = carregarEnderecos();
    // Migração: quem já tinha um endereço completo salvo pela chave antiga
    // passa a ter esse endereço como o primeiro da lista
    if (salvos.length === 0 && camposEnderecoFaltando(endereco).length === 0) {
      const primeiro: EnderecoSalvo = { ...endereco, id: gerarIdEndereco() };
      guardarEnderecos([primeiro]);
      return [primeiro];
    }
    return salvos;
  });

  // Qual endereço vai junto com a entrega (o que está marcado no rádio)
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<string | null>(() => {
    const igual = enderecos.find(
      (e) => e.rua === endereco.rua && e.numero === endereco.numero && e.cep === endereco.cep
    );
    return (igual ?? enderecos[0])?.id ?? null;
  });

  // O cliente já tem pelo menos um endereço cadastrado?
  const temEndereco = enderecos.length > 0;

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );

  // Apenas uma forma disponível = escolhida sozinha, sem seletor
  const soEntrega = ofereceEntrega && !ofereceRetirada;
  const soRetirada = !ofereceEntrega && ofereceRetirada;
  const tipoEfetivo: "entrega" | "retirada" = soRetirada
    ? "retirada"
    : soEntrega
      ? "entrega"
      : tipoEntrega;

  // Taxa: cobrada só na entrega; no balcão é grátis
  const taxa = tipoEfetivo === "retirada" || subtotal === 0 ? 0 : taxaEntrega;
  // Desconto do cupom (nunca passa do subtotal)
  const desconto = Math.min(cupom?.desconto ?? 0, subtotal);
  const total = Math.max(0, subtotal - desconto) + taxa;

  // Pedido mínimo: só para entrega, e só quando tem item no carrinho
  const faltaMinimo =
    tipoEfetivo === "entrega" &&
    pedidoMinimo > 0 &&
    subtotal > 0 &&
    subtotal < pedidoMinimo;

  // Loja aberta ou fechada AGORA? null = a loja ainda não cadastrou horário
  // (aí não mostramos aviso nenhum). "Abre amanhã às 08:00" etc.
  const horarioMercado = useMemo(() => parseHorario(horario), [horario]);
  const lojaAberta = estaAberto(horarioMercado);
  const proximaAbre = proximaAbertura(horarioMercado);

  const updateQuantity = (id: string, delta: number) => {
    // Mantém o mínimo de 1 unidade (mesmo comportamento de antes)
    const item = items.find((i) => i.id === id);
    if (delta < 0 && (item?.quantity ?? 1) <= 1) return;
    // Trava no estoque: não deixa passar do disponível
    if (delta > 0 && item?.estoque != null && item.quantity >= item.estoque) return;
    onUpdateQuantity?.(id, delta);
  };

  const removeItem = (id: string) => {
    onRemoveItem?.(id);
  };

  const clearCart = () => onClearCart?.();

  // Nome da loja citado no convite "Deseja adicionar mais algum item?"
  // (vazio só enquanto a tela ainda carrega o mercado)
  const nomeLoja = storeName.trim() || "a loja";

  const handleCheckout = () => {
    if (faltaMinimo) return;
    // Entrega: a loja precisa saber onde entregar — endereço é obrigatório
    if (tipoEfetivo === "entrega" && items.length > 0) {
      const faltando = camposEnderecoFaltando(endereco);
      if (faltando.length > 0) {
        const nomes = faltando.map((campo) => NOMES_CAMPOS_ENDERECO[campo]);
        setErroEndereco(
          faltando.length === 1
            ? `Para a entrega, preencha o campo ${nomes[0]}.`
            : `Para a entrega, preencha: ${nomes.join(", ")}.`
        );
        return;
      }
    }
    setErroEndereco(null);
    onCheckout?.(items, total);
  };

  // Remove o "id" interno para enviar só os campos do endereço
  const semId = (e: EnderecoSalvo): EnderecoEntrega => ({
    cep: e.cep,
    rua: e.rua,
    numero: e.numero,
    bairro: e.bairro,
    complemento: e.complemento,
    cidade: e.cidade,
  });

  // Marca um endereço da lista como o endereço da entrega
  const escolherEndereco = (id: string) => {
    const escolhido = enderecos.find((e) => e.id === id);
    if (!escolhido) return;
    setErroEndereco(null);
    setEnderecoSelecionadoId(id);
    onEnderecoChange?.(semId(escolhido));
  };

  // Apaga um endereço da carteira do cliente
  const removerEnderecoSalvo = (id: string) => {
    const lista = enderecos.filter((e) => e.id !== id);
    setEnderecos(lista);
    guardarEnderecos(lista);
    // Era o endereço escolhido? Passa para o primeiro que sobrar (ou limpa)
    if (enderecoSelecionadoId === id) {
      const proximo = lista[0] ?? null;
      setEnderecoSelecionadoId(proximo?.id ?? null);
      onEnderecoChange?.(proximo ? semId(proximo) : { ...ENDERECO_VAZIO });
    }
  };

  // Abre o popup para cadastrar um endereço novo (botão e opção "adicionar mais")
  const abrirPopupEndereco = () => {
    setEnderecoEditando({ ...ENDERECO_VAZIO });
    setPopupChave((c) => c + 1);
    setEnderecoPopupAberto(true);
  };

  // Salva o endereço feito no popup: entra na lista e já fica selecionado
  const salvarEnderecoPopup = (novoEndereco: EnderecoEntrega) => {
    const salvo: EnderecoSalvo = { ...novoEndereco, id: gerarIdEndereco() };
    const lista = [...enderecos, salvo];
    setEnderecos(lista);
    guardarEnderecos(lista);
    setEnderecoSelecionadoId(salvo.id);
    setErroEndereco(null);
    onEnderecoChange?.(novoEndereco);
    setEnderecoPopupAberto(false);
  };

  const aplicarCupom = () => {
    const codigo = coupon.trim();
    if (!codigo || verificandoCupom) return;
    onAplicarCupom?.(codigo);
  };

  return (
    <div className="cart-page">
      {/* Barra superior */}
      <div className="cart-topbar">
        <div className="cart-topbar__left">
          <button className="cart-back" onClick={onBack} type="button">
            <IconArrowLeft />
            Voltar à loja
          </button>
          <div className="cart-topbar__title">
            <h1>Carrinho</h1>
            <span className="cart-topbar__store">
              <strong>{storeName}</strong> · {storeLocation}
            </span>
          </div>
        </div>

        <div className="cart-topbar__left">
          <span className="cart-count-pill">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          {items.length > 0 && (
            <button className="cart-clear" onClick={clearCart} type="button">
              <IconTrash />
              Limpar carrinho
            </button>
          )}
        </div>
      </div>

      <div className="cart-body">
        {/* Lista de itens */}
        {items.length > 0 ? (
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item__thumb">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="cart-item__thumb-ph" aria-hidden="true"><IconShoppingCart size={26} /></span>
                  )}
                </div>

                <div className="cart-item__info">
                  <p className="cart-item__category">{item.category}</p>
                  <h3 className="cart-item__name">{item.name}</h3>
                  <div className="cart-item__bottom-row">
                    <span className="cart-item__unit-price">
                      Unid.: <b>{formatBRL(item.unitPrice)}</b>
                    </span>
                    <div className="qty-stepper">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.quantity <= 1}
                        aria-label="Diminuir quantidade"
                      >
                        <IconMinus />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.estoque != null && item.quantity >= item.estoque}
                        aria-label="Aumentar quantidade"
                      >
                        <IconPlus />
                      </button>
                    </div>
                    {item.estoque != null && item.quantity >= item.estoque && (
                      <span className="qty-max">Máx. {item.estoque}</span>
                    )}
                  </div>
                </div>

                <div className="cart-item__right">
                  <button
                    className="cart-item__remove"
                    onClick={() => removeItem(item.id)}
                    type="button"
                    aria-label={`Remover ${item.name}`}
                  >
                    <IconTrash />
                  </button>
                  <span className="cart-item__line-total">
                    {formatBRL(item.unitPrice * item.quantity)}
                  </span>
                </div>
              </div>
            ))}

            {/* Abaixo do último item: convida a adicionar mais produtos,
                citando a loja que o cliente acabou de abrir */}
            <div className="cart-addmais">
              <div className="cart-addmais__texto">
                <span className="cart-addmais__icone" aria-hidden="true"><IconStore /></span>
                <div>
                  <strong>Deseja adicionar mais algum item?</strong>
                  <p>
                    Volte para {nomeLoja} e continue comprando: os itens já
                    adicionados continuam guardados aqui no carrinho.
                  </p>
                </div>
              </div>
              <button type="button" className="cart-addmais__botao" onClick={onBack}>
                Adicionar mais itens
              </button>
            </div>
          </div>
        ) : (
          <div className="cart-empty">
            <div className="cart-empty__icon">
              <IconCart />
            </div>
            <h3>Seu carrinho está vazio</h3>
            <p>
              Você ainda não adicionou nenhum produto. Explore a vitrine de{" "}
              {storeName} e encontre o que precisa.
            </p>
            <button className="cart-empty__cta" onClick={onBack} type="button">
              Ver produtos
            </button>
          </div>
        )}

        {/* Resumo do pedido */}
        <div className="cart-summary">
          <h2>
            <IconReceipt />
            Resumo do pedido
          </h2>

          {/* Como quer receber: entrega ou retirada no balcão */}
          {items.length > 0 && ofereceEntrega && ofereceRetirada && (
            <fieldset className="cart-delivery">
              <legend className="cart-delivery__legenda">Como quer receber?</legend>
              <label className={`cart-delivery__opcao ${tipoEfetivo === "entrega" ? "is-ativa" : ""}`}>
                <input
                  type="radio"
                  name="tipo-entrega"
                  value="entrega"
                  checked={tipoEfetivo === "entrega"}
                  onChange={() => onTipoEntregaChange?.("entrega")}
                />
                <IconTruck />
                <span className="cart-delivery__texto">
                  <strong>Entrega</strong>
                  <small>{taxaEntrega > 0 ? formatBRL(taxaEntrega) : "Grátis"}</small>
                </span>
              </label>
              <label className={`cart-delivery__opcao ${tipoEfetivo === "retirada" ? "is-ativa" : ""}`}>
                <input
                  type="radio"
                  name="tipo-entrega"
                  value="retirada"
                  checked={tipoEfetivo === "retirada"}
                  onChange={() => onTipoEntregaChange?.("retirada")}
                />
                <IconStore />
                <span className="cart-delivery__texto">
                  <strong>Retirar no balcão</strong>
                  <small>Grátis</small>
                </span>
              </label>
            </fieldset>
          )}

          {/* Loja fechada: avisa quando a compra poderá ser retirada ou quando
              ela vai chegar (o pedido só é preparado quando a loja abrir) */}
          {items.length > 0 && lojaAberta === false && (
            <div className="cart-aviso-fechado" role="status">
              <IconStore />
              <p>
                <strong>A loja está fechada agora.</strong>{" "}
                {tipoEfetivo === "retirada" ? (
                  <>
                    {proximaAbre ? `${proximaAbre}. ` : ""}
                    Quando a loja abrir, o seu pedido será preparado e você poderá
                    retirar no balcão.
                  </>
                ) : (
                  <>
                    {proximaAbre ? `${proximaAbre}. ` : ""}
                    Quando a loja abrir, o seu pedido será preparado e sairá para
                    entrega — é assim que a sua compra vai chegar.
                  </>
                )}
              </p>
            </div>
          )}

          <div className="cart-summary__rows">
            <div className="cart-summary__row">
              <span>Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            {desconto > 0 && cupom && (
              <div className="cart-summary__row is-desconto">
                <span>Cupom {cupom.codigo}</span>
                <span>− {formatBRL(desconto)}</span>
              </div>
            )}
            <div className={`cart-summary__row ${taxa === 0 ? "is-free" : ""}`}>
              <span>{tipoEfetivo === "retirada" ? "Retirada no balcão" : "Entrega"}</span>
              <span>{taxa === 0 ? "Grátis" : formatBRL(taxa)}</span>
            </div>
            {faltaMinimo && (
              <div className="cart-summary__row is-aviso">
                <span>
                  Faltam {formatBRL(pedidoMinimo - subtotal)} para o pedido mínimo de{" "}
                  {formatBRL(pedidoMinimo)}
                </span>
                <span> </span>
              </div>
            )}
          </div>

          {/* Cupom de desconto */}
          {!cupom ? (
            <div className="cart-coupon">
              <label htmlFor="cart-coupon" className="sr-only">Cupom de desconto</label>
              <input
                id="cart-coupon"
                type="text"
                placeholder="Cupom de desconto"
                value={coupon}
                onChange={(e) => setCoupon(removeEmojis(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") aplicarCupom(); }}
              />
              <button
                type="button"
                onClick={aplicarCupom}
                disabled={!coupon.trim() || verificandoCupom}
              >
                {verificandoCupom ? "Verificando…" : "Aplicar"}
              </button>
            </div>
          ) : (
            <div className="cart-coupon cart-coupon--aplicado">
              <span className="cart-coupon__codigo">
                <IconTag />
                Cupom <strong>{cupom.codigo}</strong> aplicado — {formatBRL(desconto)} de desconto
              </span>
              <button type="button" onClick={onRemoverCupom} aria-label="Remover cupom">
                Remover
              </button>
            </div>
          )}

          {/* Endereço de entrega — aparece só quando a compra será entregue.
               Usa radiobuttons (igual ao pagamento), com os endereços já
               salvos do cliente e a opção de adicionar mais. */}
          {items.length > 0 && tipoEfetivo === "entrega" && (
            <fieldset className="cart-endereco">
              <legend className="cart-endereco__legenda">
                <IconMapPin />
                Onde você quer receber?
              </legend>

              {temEndereco ? (
                enderecos.map((e, i) => (
                  <div
                    key={e.id}
                    className={`cart-endereco__opcao ${
                      enderecoSelecionadoId === e.id ? "is-ativa" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="endereco-entrega"
                      id={`endereco-${e.id}`}
                      value={e.id}
                      checked={enderecoSelecionadoId === e.id}
                      onChange={() => escolherEndereco(e.id)}
                    />
                    <label
                      className="cart-endereco__opcao-conteudo"
                      htmlFor={`endereco-${e.id}`}
                    >
                      <span className="cart-endereco__opcao-icone" aria-hidden="true">
                        <IconMapPin />
                      </span>
                      <span className="cart-endereco__opcao-texto">
                        <strong className="cart-endereco__opcao-titulo">
                          {i === 0 ? "Meu endereço" : `Endereço ${i + 1}`}
                        </strong>
                        <span className="cart-endereco__opcao-descricao">
                          {formatarEndereco(e)}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="cart-endereco__remover"
                      onClick={() => removerEnderecoSalvo(e.id)}
                      title="Remover este endereço"
                      aria-label="Remover este endereço"
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))
              ) : (
                /* Sem endereço nenhum: botão que abre o popup de preenchimento */
                <button
                  type="button"
                  className="cart-endereco__btn-adicionar"
                  onClick={abrirPopupEndereco}
                >
                  <IconPlus />
                  Preencher os dados necessários
                </button>
              )}

              {/* Já tem endereço? Aparece a opção de cadastrar mais um */}
              {temEndereco && (
                <div
                  className={`cart-endereco__opcao ${
                    enderecoSelecionadoId === "novo" ? "is-ativa" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="endereco-entrega"
                    id="endereco-novo"
                    value="novo"
                    checked={enderecoSelecionadoId === "novo"}
                    onChange={() => {
                      setEnderecoSelecionadoId("novo");
                      abrirPopupEndereco();
                    }}
                  />
                  <label className="cart-endereco__opcao-conteudo" htmlFor="endereco-novo">
                    <span className="cart-endereco__opcao-icone" aria-hidden="true">
                      <IconPlus />
                    </span>
                    <span className="cart-endereco__opcao-texto">
                      <strong className="cart-endereco__opcao-titulo">Adicionar mais</strong>
                      <span className="cart-endereco__opcao-descricao">
                        Cadastrar outro endereço de entrega
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {erroEndereco && (
                <p className="cart-endereco__erro" role="alert">{erroEndereco}</p>
              )}
            </fieldset>
          )}

          {/* Quando quer receber (entrega ou retirada) */}
          {items.length > 0 && onAgendamentoChange && (
            <div className="cart-agendamento">
              <label className="cart-agendamento__label" htmlFor="cart-agendamento">
                <IconCalendar />
                {tipoEfetivo === "retirada" ? "Quando pretende retirar?" : "Quando quer receber?"}
              </label>
              <select
                id="cart-agendamento"
                className="cart-agendamento__select"
                value={agendamento}
                onChange={(e) => onAgendamentoChange(e.target.value)}
              >
                <option value="">Sem preferência</option>
                {OPCOES_AGENDAMENTO.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
          )}

          {/* Observação opcional que vai junto do pedido (ex.: "sem cebola") */}
          {onObservacaoChange && (
            <div className="cart-obs">
              <label className="cart-obs__label" htmlFor="cart-obs">
                Observação para o lojista (opcional)
              </label>
              <textarea
                id="cart-obs"
                className="cart-obs__textarea"
                rows={2}
                maxLength={300}
                placeholder="Ex.: sem cebola, entregar na portaria, trocar pela mais fresca…"
                value={observacao}
                onChange={(e) => onObservacaoChange(e.target.value)}
              />
              <span className="cart-obs__contador">{observacao.length}/300</span>
            </div>
          )}

          {/* Como quer pagar: na entrega, Pix agora ou cartão online (B3) */}
          {items.length > 0 && onFormaPagamentoChange && (
            <fieldset className="cart-payment">
              <legend className="cart-payment__legenda">Como quer pagar?</legend>
              <label className={`cart-payment__opcao ${formaPagamento === "presencial" ? "is-ativa" : ""}`}>
                <input
                  type="radio"
                  name="forma-pagamento"
                  value="presencial"
                  checked={formaPagamento === "presencial"}
                  onChange={() => onFormaPagamentoChange("presencial")}
                />
                <IconStore />
                <span className="cart-payment__texto">
                  <strong>Pagar na entrega</strong>
                  <small>Dinheiro ou cartão na entrega/retirada</small>
                </span>
              </label>
              <label className={`cart-payment__opcao ${formaPagamento === "pix" ? "is-ativa" : ""}`}>
                <input
                  type="radio"
                  name="forma-pagamento"
                  value="pix"
                  checked={formaPagamento === "pix"}
                  onChange={() => onFormaPagamentoChange("pix")}
                />
                <IconPix />
                <span className="cart-payment__texto">
                  <strong>Pix agora</strong>
                  <small>QR code na tela; confirma em segundos</small>
                </span>
              </label>
              <label className={`cart-payment__opcao ${formaPagamento === "cartao" ? "is-ativa" : ""}`}>
                <input
                  type="radio"
                  name="forma-pagamento"
                  value="cartao"
                  checked={formaPagamento === "cartao"}
                  onChange={() => onFormaPagamentoChange("cartao")}
                />
                <IconCard />
                <span className="cart-payment__texto">
                  <strong>Cartão de crédito</strong>
                  <small>Página segura do Asaas</small>
                </span>
              </label>
            </fieldset>
          )}

          <div className="cart-summary__total">
            <span>Total</span>
            <strong>{formatBRL(total)}</strong>
          </div>

          <button
            className="cart-checkout-btn"
            onClick={handleCheckout}
            disabled={items.length === 0 || finalizando || faltaMinimo}
            type="button"
          >
            {finalizando
              ? 'Enviando…'
              : faltaMinimo
                ? 'Abaixo do pedido mínimo'
                : formaPagamento === 'pix'
                  ? 'Criar pedido e pagar com Pix'
                  : formaPagamento === 'cartao'
                    ? 'Ir para o pagamento do cartão'
                    : 'Finalizar pedido'}
            {!finalizando && !faltaMinimo && <IconArrowRight />}
          </button>

          <div className="cart-summary__secure">
            <span className="dot" />
            Conexão segura e criptografada
          </div>
        </div>
      </div>

      {/* Popup de cadastro/edição de endereço de entrega */}
      <EnderecoPopup
        key={popupChave}
        aberto={enderecoPopupAberto}
        enderecoInicial={enderecoEditando}
        onFechar={() => {
          setEnderecoPopupAberto(false);
          // Cancelou o cadastro? O rádio volta para o endereço salvo (se houver)
          setEnderecoSelecionadoId((atual) =>
            atual === "novo" ? (enderecos[0]?.id ?? null) : atual
          );
        }}
        onSalvar={salvarEnderecoPopup}
      />
    </div>
  );
}
