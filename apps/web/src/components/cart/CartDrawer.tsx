import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import CheckoutModal from '../checkout/CheckoutModal';

export default function CartDrawer({ tableId, onClose }: { tableId: string, onClose: () => void }) {
  const { items, totals, updateQty, clearCart } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <>
      <div className="cart-overlay" onClick={onClose} />
      <div className="cart-drawer">
        <div className="cart-drawer__handle" />
        
        <div className="cart-drawer__header">
          <h2 className="cart-drawer__title">Tu Orden</h2>
          <button className="btn btn-ghost btn-sm" onClick={clearCart}>Vaciar</button>
        </div>

        <div className="cart-drawer__body">
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--clr-muted)', padding: '2rem 0' }}>
              Tu carrito está vacío
            </div>
          ) : (
            items.map(item => (
              <div key={item.productId} className="cart-item">
                <div className="cart-item__name">{item.productName}</div>
                <div className="product-card__qty-control">
                  <button className="product-card__qty-btn" onClick={() => updateQty(item.productId, item.quantity - 1)}>-</button>
                  <span className="product-card__qty-num">{item.quantity}</span>
                  <button className="product-card__qty-btn" onClick={() => updateQty(item.productId, item.quantity + 1)}>+</button>
                </div>
                <div className="cart-item__price">{formatPrice(item.unitPrice * item.quantity)}</div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer__footer">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotalCents)}</span>
            </div>
            {totals.discountResults.map((dr, idx) => dr.amountCents > 0 && (
              <div key={idx} className="totals-row discount">
                <span>{dr.label}</span>
                <span>-{formatPrice(dr.amountCents)}</span>
              </div>
            ))}
            <div className="totals-row total">
              <span>Total Estimado</span>
              <span>{formatPrice(totals.netCents)}</span>
            </div>
            
            <p style={{ fontSize: '10px', color: 'var(--clr-muted)', textAlign: 'center', margin: '12px 0' }}>
              Impuestos (IVA, turismo, etc.) se calcularán en el pago.
            </p>

            <button 
              className="btn btn-primary btn-full btn-lg"
              onClick={() => setIsCheckoutOpen(true)}
            >
              Proceder al Pago
            </button>
          </div>
        )}
      </div>

      {isCheckoutOpen && (
        <CheckoutModal 
          tableId={tableId}
          onClose={() => setIsCheckoutOpen(false)}
          onSuccess={() => {
            setIsCheckoutOpen(false);
            onClose();
            clearCart();
          }}
        />
      )}
    </>
  );
}
