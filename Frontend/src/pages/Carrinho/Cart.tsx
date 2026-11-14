import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { removeEmojis } from "../../hooks/useBlockEmojis";
import { IconShoppingCart } from "../../components/Icons";
import Imagem from "../../components/Imagem";
import { useAuth } from "../../context/AuthContext";
import { useEnderecos } from "../../hooks/useEnderecos";
import EnderecoPopup from "../../components/EnderecoPopup/EnderecoPopup";
import QuantidadeStepper from "../../components/QuantidadeStepper/QuantidadeStepper";
import { parseHorario, estaAberto, proximaAbertura } from "../../utils/horario";
import {
  type EnderecoEntrega,
  type EnderecoSalvo,
  ENDERECO_VAZIO,
  NOMES_CAMPOS_ENDERECO,
  camposEnderecoFaltando,
  formatarEndereco,
} from "../../utils/endereco";
import "./Cart.css";

// Tipos
export interface CartItem {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
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

  // ── Pagamento (B3): pagar na entrega ou cartão ─────────────────────────────
  formaPagamento?: "presencial" | "cartao";
  onFormaPagamentoChange?: (forma: "presencial" | "cartao") => void;
}

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const OPCOES_AGENDAMENTO = [
  "Quanto antes",
  "Hoje de manhã",
  "Hoje à tarde",
  "Hoje à noite",
  "Amanhã de manhã",
  "Amanhã à tarde",
  "Amanhã à noite",
];

// Ícones (SVG inline, sem dependências externas)
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

const IconPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

// Componente principal
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
  const items = initialItems;
  const [coupon, setCoupon] = useState("");
  const [erroEndereco, setErroEndereco] = useState<string | null>(null);
  const [enderecoPopupAberto, setEnderecoPopupAberto] = useState(false);
  const [popupChave, setPopupChave] = useState(0);
  const [erroPopup, setErroPopup] = useState<string | null>(null);
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  // ── Endereços de entrega ──────────────────────────────────────────────────
  const { usuario } = useAuth();
  const logado = !!usuario;
  const navigate = useNavigate();
  const {
    enderecos,
    carregando: carregandoEnderecos,
    adicionar: adicionarEndereco,
    editar: editarEnderecoSalvo,
    remover: removerEnderecoDaConta,
    definirPrincipal,
  } = useEnderecos();

  // ── Quem ainda não tem conta ───────────────────────────────────────────────
  const irParaLogin = () => {
    sessionStorage.setItem("posLoginDestino", window.location.pathname);
    navigate("/auth");
  };

  const [principalSugerido, setPrincipalSugerido] = useState<EnderecoSalvo | null>(null);

  const [escolhaManual, setEscolhaManual] = useState<string | null>(null);
  const [enderecoEditando, setEnderecoEditando] = useState<EnderecoSalvo | null>(null);

  const semId = (e: EnderecoSalvo): EnderecoEntrega => ({
    cep: e.cep,
    rua: e.rua,
    numero: e.numero,
    bairro: e.bairro,
    complemento: e.complemento,
    cidade: e.cidade,
  });

  const enderecoSelecionadoId = useMemo(() => {
    if (escolhaManual && enderecos.some((e) => e.id === escolhaManual)) {
      return escolhaManual;
    }
    const igual = enderecos.find(
      (e) => e.rua === endereco.rua && e.numero === endereco.numero && e.cep === endereco.cep
    );
    return (igual ?? enderecos.find((e) => e.principal) ?? enderecos[0])?.id ?? null;
  }, [enderecos, escolhaManual, endereco]);

  useEffect(() => {
    const escolhido = enderecos.find((e) => e.id === enderecoSelecionadoId);
    if (!escolhido) return;
    const mesmo =
      escolhido.rua === endereco.rua &&
      escolhido.numero === endereco.numero &&
      escolhido.cep === endereco.cep;
    if (!mesmo) onEnderecoChange?.(semId(escolhido));
  }, [enderecoSelecionadoId, enderecos, endereco, onEnderecoChange]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );

  const soEntrega = ofereceEntrega && !ofereceRetirada;
  const soRetirada = !ofereceEntrega && ofereceRetirada;
  const semFormaRecebimento = !ofereceEntrega && !ofereceRetirada;
  const tipoEfetivo: "entrega" | "retirada" = soRetirada
    ? "retirada"
    : soEntrega
      ? "entrega"
      : tipoEntrega;

  const taxa = tipoEfetivo === "retirada" || subtotal === 0 ? 0 : taxaEntrega;
  const desconto = Math.min(cupom?.desconto ?? 0, subtotal);
  const total = Math.max(0, subtotal - desconto) + taxa;

  const faltaMinimo =
    tipoEfetivo === "entrega" &&
    pedidoMinimo > 0 &&
    subtotal > 0 &&
    subtotal < pedidoMinimo;

  const horarioMercado = useMemo(() => parseHorario(horario), [horario]);
  const lojaAberta = estaAberto(horarioMercado);
  const proximaAbre = proximaAbertura(horarioMercado);

  const definirQuantidade = (id: string, nova: number) => {
    const item = items.find((i) => i.id === id);
    if (!item || nova === item.quantity) return;
    onUpdateQuantity?.(id, nova - item.quantity);
  };

  const removeItem = (id: string) => {
    onRemoveItem?.(id);
  };

  const clearCart = () => onClearCart?.();

  const nomeLoja = storeName.trim() || "a loja";

  const handleCheckout = () => {
    if (faltaMinimo || semFormaRecebimento) return;
    if (tipoEfetivo === "entrega" && items.length > 0 && !logado) {
      irParaLogin();
      return;
    }
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

  const escolherEndereco = (id: string) => {
    const escolhido = enderecos.find((e) => e.id === id);
    if (!escolhido) return;
    setErroEndereco(null);
    setEscolhaManual(id);
    onEnderecoChange?.(semId(escolhido));
  };

  const removerEnderecoSalvo = async (id: string) => {
    try {
      await removerEnderecoDaConta(id);
      if (enderecoSelecionadoId === id) {
        const proximo = enderecos.find((e) => e.id !== id) ?? null;
        setEscolhaManual(proximo?.id ?? null);
        onEnderecoChange?.(proximo ? semId(proximo) : { ...ENDERECO_VAZIO });
      }
    } catch (e) {
      setErroEndereco(
        e instanceof Error ? e.message : "Não foi possível remover o endereço."
      );
    }
  };

  const abrirPopupEndereco = () => {
    setErroPopup(null);
    setEnderecoEditando(null);
    setPopupChave((c) => c + 1);
    setEnderecoPopupAberto(true);
  };

  const abrirEdicaoEndereco = (endereco: EnderecoSalvo) => {
    setErroPopup(null);
    setEnderecoEditando(endereco);
    setPopupChave((c) => c + 1);
    setEnderecoPopupAberto(true);
  };

  const salvarEnderecoPopup = async (dados: EnderecoEntrega) => {
    try {
      setSalvandoEndereco(true);
      setErroPopup(null);
      const tinhaPrincipal = enderecos.some((e) => e.principal);
      if (enderecoEditando) {
        await editarEnderecoSalvo(enderecoEditando.id, dados);
        setEscolhaManual(enderecoEditando.id);
      } else {
        const salvo = await adicionarEndereco(dados);
        setEscolhaManual(salvo.id);
        if (!tinhaPrincipal) setPrincipalSugerido(salvo);
      }
      setErroEndereco(null);
      onEnderecoChange?.(dados);
      setEnderecoPopupAberto(false);
      setEnderecoEditando(null);
    } catch (e) {
      setErroPopup(
        e instanceof Error ? e.message : "Não foi possível salvar o endereço."
      );
    } finally {
      setSalvandoEndereco(false);
    }
  };

  const confirmarEnderecoPrincipal = async () => {
    if (!principalSugerido) return;
    try {
      await definirPrincipal(principalSugerido.id);
    } catch { /* falha ignorada */ } finally {
      setPrincipalSugerido(null);
    }
  };

  const aplicarCupom = () => {
    const codigo = coupon.trim();
    if (!codigo || verificandoCupom) return;
    onAplicarCupom?.(codigo);
  };

  const textoCheckout = finalizando
    ? "Enviando…"
    : faltaMinimo
      ? "Abaixo do pedido mínimo"
      : formaPagamento === "cartao"
        ? "Ir para o pagamento do cartão"
        : "Finalizar pedido";

  const textoCheckoutCurto = finalizando
    ? "Enviando…"
    : faltaMinimo
      ? "Abaixo do mínimo"
      : formaPagamento === "cartao"
        ? "Pagar com cartão"
        : "Finalizar pedido";

  useEffect(() => {
    if (!erroEndereco) return;
    document.querySelector(".cart-endereco")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [erroEndereco]);

  return (
    <div className="cart-page">
      <div className="cart-topbar">
        <div className="cart-topbar__left">
          <button className="cart-back" onClick={onBack} type="button" aria-label="Voltar à loja">
            <IconArrowLeft />
            <span className="cart-back__texto">Voltar à loja</span>
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
            <button
              className="cart-clear"
              onClick={clearCart}
              type="button"
              aria-label="Limpar carrinho"
            >
              <IconTrash />
              <span className="cart-clear__texto">Limpar carrinho</span>
            </button>
          )}
        </div>
      </div>

      <div className="cart-body">
        <div className="cart-store-mobile">
          <strong>{storeName}</strong>
          <span>{storeLocation}</span>
        </div>

        {items.length > 0 ? (
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item__thumb">
                  {item.imageUrl ? (
                    <Imagem
                      src={item.imageUrl}
                      alt={item.name}
                      sizes="76px"
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
                    <QuantidadeStepper
                      className="qty-stepper"
                      valor={item.quantity}
                      maximo={item.estoque}
                      onMudar={(nova) => definirQuantidade(item.id, nova)}
                      iconeMenos={<IconMinus />}
                      iconeMais={<IconPlus />}
                    />
                    {item.estoque != null && item.estoque > 0 && item.quantity >= item.estoque && (
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

        <div className="cart-summary">
          <h2>
            <IconReceipt />
            Resumo do pedido
          </h2>

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
                  onClick={() => {
                    if (!logado) irParaLogin();
                  }}
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

          {items.length > 0 && (soEntrega || soRetirada || semFormaRecebimento) && (
            <p className={`cart-delivery__nota ${semFormaRecebimento ? "is-erro" : ""}`} role="status">
              {semFormaRecebimento
                ? "Esta loja não configurou entrega nem retirada. Não é possível finalizar o pedido agora."
                : soRetirada
                  ? "Esta loja não faz entrega: o seu pedido será retirado no balcão, sem taxa."
                  : "Esta loja trabalha somente com entrega. A retirada no balcão não está disponível."}
            </p>
          )}

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

          {items.length > 0 && !semFormaRecebimento && tipoEfetivo === "entrega" && (
            <fieldset className="cart-endereco">
              <legend className="cart-endereco__legenda">
                <IconMapPin />
                Onde você quer receber?
              </legend>

              {carregandoEnderecos ? (
                <p className="cart-endereco__nota">Carregando seus endereços...</p>
              ) : (
                <>
                  {logado && enderecos.map((e, i) => (
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
                            {e.principal ? "Endereço principal" : `Endereço ${i + 1}`}
                            {e.principal && (
                              <span className="cart-endereco__selo">Principal</span>
                            )}
                          </strong>
                          <span className="cart-endereco__opcao-descricao">
                            {formatarEndereco(e)}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="cart-endereco__editar"
                        onClick={() => abrirEdicaoEndereco(e)}
                        title="Editar este endereço"
                        aria-label="Editar este endereço"
                      >
                        <IconPencil />
                      </button>
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
                  ))}

                  {(!logado || enderecos.length === 0) && (
                    <p className="cart-endereco__nota">
                      Cadastre seu endereço para a gente entregar em casa.
                    </p>
                  )}
                  <button
                    type="button"
                    className="cart-endereco__btn-adicionar"
                    onClick={() => (logado ? abrirPopupEndereco() : irParaLogin())}
                  >
                    <IconPlus />
                    {logado && enderecos.length > 0
                      ? "Adicionar um endereço"
                      : "Cadastrar endereço de entrega"}
                  </button>
                </>
              )}

              {erroEndereco && (
                <p className="cart-endereco__erro" role="alert">{erroEndereco}</p>
              )}
            </fieldset>
          )}

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
                  <strong>{tipoEfetivo === "retirada" ? "Pagar na retirada" : "Pagar na entrega"}</strong>
                  <small>Dinheiro ou cartão na entrega/retirada</small>
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

          <div className="cart-summary__rodape">
            <div className="cart-summary__total">
              <span>Total</span>
              <strong>{formatBRL(total)}</strong>
            </div>

            <button
              className="cart-checkout-btn"
              onClick={handleCheckout}
              disabled={items.length === 0 || finalizando || faltaMinimo || semFormaRecebimento}
              type="button"
            >
              {textoCheckout}
              {!finalizando && !faltaMinimo && <IconArrowRight />}
            </button>

            <div className="cart-summary__secure">
              <span className="dot" />
              Conexão segura e criptografada
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="cart-mobile-bar">
          <div className="cart-mobile-bar__resumo">
            <span>Total</span>
            <strong>{formatBRL(total)}</strong>
          </div>
          <button
            className="cart-mobile-bar__btn"
            onClick={handleCheckout}
            disabled={finalizando || faltaMinimo || semFormaRecebimento}
            type="button"
          >
            {textoCheckoutCurto}
            {!finalizando && !faltaMinimo && <IconArrowRight />}
          </button>
        </div>
      )}

      <EnderecoPopup
        key={popupChave}
        aberto={enderecoPopupAberto}
        enderecoInicial={enderecoEditando ?? undefined}
        titulo={
          enderecoEditando
            ? "Editar endereço de entrega"
            : "Adicionar endereço de entrega"
        }
        salvando={salvandoEndereco}
        erro={erroPopup}
        onFechar={() => {
          setEnderecoPopupAberto(false);
          setEnderecoEditando(null);
        }}
        onSalvar={salvarEnderecoPopup}
      />

      {principalSugerido &&
        createPortal(
          <>
            <div className="cart-principal__backdrop" />
            <div
              className="cart-principal"
              role="dialog"
              aria-modal="true"
              aria-label="Definir endereço principal"
            >
              <h3 className="cart-principal__titulo">
                Definir como endereço principal?
              </h3>
              <p className="cart-principal__texto">
                Quer que <strong>{formatarEndereco(principalSugerido)}</strong>{" "}
                seja o seu endereço principal? Ele fica salvo na sua conta, em
                "Endereços", e já vem marcado quando você fecha um pedido.
              </p>
              <div className="cart-principal__acoes">
                <button
                  type="button"
                  className="cart-principal__btn cart-principal__btn--nao"
                  onClick={() => setPrincipalSugerido(null)}
                >
                  Agora não
                </button>
                <button
                  type="button"
                  className="cart-principal__btn cart-principal__btn--sim"
                  onClick={confirmarEnderecoPrincipal}
                >
                  Sim, definir principal
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
