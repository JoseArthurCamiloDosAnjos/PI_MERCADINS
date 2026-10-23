import { useMemo, useState } from "react";
import { removeEmojis } from "../../hooks/useBlockEmojis";
import { IconShoppingCart } from "../../components/Icons";
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

  // ── Cupom de desconto ─────────────────────────────────────────────────────
  cupom?: CupomAplicado | null;
  verificandoCupom?: boolean;
  onAplicarCupom?: (codigo: string) => void;
  onRemoverCupom?: () => void;

  // ── Agendamento: quando o cliente quer receber/retirar ────────────────────
  agendamento?: string;
  onAgendamentoChange?: (valor: string) => void;

  // ── Pagamento (B3): pagar na entrega, Pix ou cartão ──────────────────────
  formaPagamento?: "presencial" | "pix" | "cartao";
  onFormaPagamentoChange?: (forma: "presencial" | "pix" | "cartao") => void;
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
  cupom = null,
  verificandoCupom = false,
  onAplicarCupom,
  onRemoverCupom,
  agendamento = "",
  onAgendamentoChange,
  formaPagamento = "presencial",
  onFormaPagamentoChange,
}: CartScreenProps) {
  // Os itens vêm do componente pai (useCarrinho) — fonte única de verdade,
  // sincronizada com o navegador (localStorage) e com o banco.
  const items = initialItems;
  const [coupon, setCoupon] = useState("");

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

  const handleCheckout = () => {
    if (faltaMinimo) return;
    onCheckout?.(items, total);
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
    </div>
  );
}
