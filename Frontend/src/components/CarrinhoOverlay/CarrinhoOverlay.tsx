import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CartScreen from '../../pages/Carrinho/Cart';
import { useCarrinho } from '../../hooks/useCarrinho';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Toast';
import { api } from '../../services/api';
import './CarrinhoOverlay.css';

interface CarrinhoOverlayProps {
  mercadoId: number;
  aberto: boolean;
  onFechar: () => void;
  storeName?: string;
  /**
   * Permite a tela que chama reutilizar o próprio carrinho (useCarrinho)
   * para que contadores/badges fiquem atualizados em tempo real.
   * Se não for informado, o overlay cria o seu.
   */
  carrinho?: ReturnType<typeof useCarrinho>;
}

/**
 * Carrinho como componente: pode ser aberto de qualquer tela
 * (vitrine, produto, perfil...) com apenas uma linha:
 *
 *   <CarrinhoOverlay mercadoId={id} slug={slug} aberto={aberto} onFechar={fechar} />
 */
export default function CarrinhoOverlay({
  mercadoId,
  aberto,
  onFechar,
  storeName,
  carrinho: carrinhoExterno,
}: CarrinhoOverlayProps) {
  const navigate = useNavigate();
  const carrinhoInterno = useCarrinho(mercadoId);
  const carrinho = carrinhoExterno ?? carrinhoInterno;
  const [finalizando, setFinalizando] = useState(false);
  const { toasts, showToast, dismissToast } = useToast();

  const itensConvertidos = carrinho.itens.map(item => ({
    id: String(item.produto.id_produto),
    name: item.produto.nome,
    category: String(item.produto.id_categoria),
    unitPrice: Number(item.produto.preco ?? 0),
    quantity: item.quantidade,
    imageUrl: item.produto.imagem ?? item.produto.imagens?.[0] ?? '',
    estoque: item.produto.estoque,
  }));

  async function handleCheckout() {
    // Compra exige login: sem token, manda pra tela de login
    // (os itens continuam salvos no carrinho)
    if (!localStorage.getItem('token')) {
      showToast('erro', 'Faça login para finalizar o pedido.');
      onFechar();
      navigate('/auth');
      return;
    }
    setFinalizando(true);
    try {
      await api.criarPedido(mercadoId, {
        itens: carrinho.itens.map(i => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade })),
      });
      showToast('sucesso', 'Pedido enviado com sucesso!');
      carrinho.limpar();
      onFechar();
    } catch (e: unknown) {
      showToast('erro', e instanceof Error ? e.message : 'Erro ao enviar pedido.');
    } finally {
      setFinalizando(false);
    }
  }

  if (!aberto) return null;

  return (
    <div
      className="co-overlay"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho"
    >
      <div className="co-painel" onClick={e => e.stopPropagation()}>
        <button className="co-fechar" onClick={onFechar} aria-label="Fechar carrinho">✕</button>
        <CartScreen
          storeName={storeName}
          initialItems={itensConvertidos}
          onBack={onFechar}
          onCheckout={handleCheckout}
          finalizando={finalizando}
          onUpdateQuantity={(id, delta) => carrinho.alterarQuantidade(Number(id), delta)}
          onRemoveItem={(id) => carrinho.remover(Number(id))}
          onClearCart={() => carrinho.limpar()}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </div>
  );
}
