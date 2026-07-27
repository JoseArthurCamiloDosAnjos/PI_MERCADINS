import { useEffect, useMemo, useState } from "react";
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
}

interface CartScreenProps {
  storeName?: string;
  storeLocation?: string;
  initialItems?: CartItem[];
  freeShippingThreshold?: number;
  shippingFee?: number;
  onBack?: () => void;
  onCheckout?: (items: CartItem[], total: number) => void;
  finalizando?: boolean;
}

// ---------------------------------------------------------------
// Dados de exemplo (mesmos produtos da vitrine "Mercadins")
// ---------------------------------------------------------------
const DEFAULT_ITEMS: CartItem[] = [
  {
    id: "1",
    name: "Galacia",
    category: "Bebida",
    unitPrice: 21.0,
    quantity: 2,
    imageUrl:
      "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=200&h=200&fit=crop",
  },
  {
    id: "2",
    name: "Esqueleto do grau",
    category: "Bebida",
    unitPrice: 30.2,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=200&h=200&fit=crop",
  },
  {
    id: "3",
    name: "Bebida do ney",
    category: "Comida",
    unitPrice: 231.24,
    quantity: 1,
    imageUrl:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=200&h=200&fit=crop",
  },
];

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

// ---------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------
export default function CartScreen({
  storeName = "Mercadins",
  storeLocation = "Guariba · SP",
  initialItems = DEFAULT_ITEMS,
  freeShippingThreshold = 100,
  shippingFee = 8.9,
  onBack,
  onCheckout,
  finalizando = false,
}: CartScreenProps) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [coupon, setCoupon] = useState("");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );
  const shipping = subtotal === 0 || subtotal >= freeShippingThreshold ? 0 : shippingFee;
  const total = subtotal + shipping;
  const missingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const handleCheckout = () => {
    onCheckout?.(items, total);
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
                  <img src={item.imageUrl} alt={item.name} />
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
                        aria-label="Aumentar quantidade"
                      >
                        <IconPlus />
                      </button>
                    </div>
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

          <div className="cart-summary__rows">
            <div className="cart-summary__row">
              <span>Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            <div className={`cart-summary__row ${shipping === 0 ? "is-free" : ""}`}>
              <span>Entrega</span>
              <span>{shipping === 0 ? "Grátis" : formatBRL(shipping)}</span>
            </div>
            {shipping > 0 && missingForFreeShipping > 0 && (
              <div className="cart-summary__row">
                <span>Faltam {formatBRL(missingForFreeShipping)} p/ frete grátis</span>
                <span> </span>
              </div>
            )}
          </div>

          <div className="cart-coupon">
            <input
              type="text"
              placeholder="Cupom de desconto"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
            />
            <button type="button">Aplicar</button>
          </div>

          <div className="cart-summary__total">
            <span>Total</span>
            <strong>{formatBRL(total)}</strong>
          </div>

          <button
            className="cart-checkout-btn"
            onClick={handleCheckout}
            disabled={items.length === 0 || finalizando}
            type="button"
          >
            {finalizando ? 'Enviando…' : 'Finalizar pedido'}
            {!finalizando && <IconArrowRight />}
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