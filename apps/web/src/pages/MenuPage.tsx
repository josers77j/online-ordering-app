import React, { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useCart } from "../context/CartContext";
import CartDrawer from "../components/cart/CartDrawer";
import { API_BASE } from "../config/env";

interface OrderStatus {
  status: string;
  invoiceId?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
  isAvailable: boolean;
  specialTaxRate: number;
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const baseUrl = API_BASE ?? "http://localhost:3001";

export default function MenuPage({ tableId }: { readonly tableId: string }) {
  const { isConnected, joinRoom, addListener } = useSocket();
  const { itemCount, items, addItem, updateQty, disableItem } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrderStatus | null>(null); 

  useEffect(() => {
    fetch(`${baseUrl}/api/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((error: unknown) => {
        console.error("Error fetching products:", error);
      });

    joinRoom(`table:${tableId}`);
  }, [tableId, joinRoom]);

  useEffect(() => {
    return addListener((msg) => {
      if (msg.type === "INVENTORY_UPDATE") {
        const { productId, stock, isAvailable } = msg.payload as {
          productId: string;
          stock: number;
          isAvailable: boolean;
        };
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, stock, isAvailable } : p,
          ),
        );

        if (stock <= 0 || !isAvailable) {
          disableItem(productId);
        }
      } else if (msg.type === "ORDER_STATUS") {
        setActiveOrder(msg.payload as OrderStatus);
      }
    });
  }, [addListener, disableItem]);

  const categories = [
    "todos",
    ...Array.from(new Set(products.map((p) => p.category))),
  ];

  const filteredProducts =
    activeCategory === "todos"
      ? products
      : products.filter((p) => p.category === activeCategory);

  const handleAddToCart = (product: Product) => {
    addItem(
      product.id,
      product.name,
      product.category,
      product.price,
      1,
      product.specialTaxRate,
    );
  };

  const handleChangeQty = (productId: string, newQty: number) => {
    updateQty(productId, newQty);
  };

  const renderQtyControl = (product: Product, qtyInCart: number) => {
    if (qtyInCart === 0) {
      return (
        <button
          className="product-card__add-btn"
          onClick={() => handleAddToCart(product)}
        >
          +
        </button>
      );
    }

    return (
      <div className="product-card__qty-control">
        <button
          className="product-card__qty-btn"
          onClick={() => handleChangeQty(product.id, qtyInCart - 1)}
        >
          -
        </button>
        <span className="product-card__qty-num">{qtyInCart}</span>
        <button
          className="product-card__qty-btn"
          onClick={() => {
            if (qtyInCart < product.stock) {
              handleChangeQty(product.id, qtyInCart + 1);
            }
          }}
          disabled={qtyInCart >= product.stock}
        >
          +
        </button>
      </div>
    );
  };

  const renderProductCard = (product: Product) => {
    const cartItem = items.find((i) => i.productId === product.id);
    const qtyInCart = cartItem?.quantity || 0;
    const disabled = !product.isAvailable || product.stock <= 0;

    return (
      <div
        key={product.id}
        className={`product-card ${disabled ? "unavailable" : ""}`}
      >
        <div className="product-card__image-placeholder">🍽️</div>
        {product.specialTaxRate > 0 && (
          <div className="product-card__special-tax">
            +{(product.specialTaxRate * 100).toFixed(0)}% Tax
          </div>
        )}

        <div className="product-card__body">
          <h3 className="product-card__name">{product.name}</h3>
          <p className="product-card__desc">{product.description}</p>

          <div className="product-card__footer">
            <div>
              <div className="product-card__price">
                {formatPrice(product.price)}
              </div>
              <div
                className={`product-card__stock ${product.stock <= 5 ? "low" : ""} ${disabled ? "out" : ""}`}
              >
                {disabled ? "Agotado" : `${product.stock} disponibles`}
              </div>
            </div>

            {!disabled && renderQtyControl(product, qtyInCart)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="menu-shell">
      <header className="menu-header">
        <div className="menu-header__inner">
          <div className="menu-header__logo">QR Order</div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="menu-header__table">Mesa {tableId}</span>
            <div
              className={`ws-indicator ${isConnected ? "connected" : ""}`}
              title={isConnected ? "Conectado" : "Reconectando..."}
            />
          </div>
        </div>
      </header>

      {activeOrder &&
        activeOrder.status !== "DELIVERED" &&
        activeOrder.status !== "CANCELLED" && (
          <div className="container" style={{ marginTop: "16px" }}>
            <div
              className="card"
              style={{
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "var(--clr-muted)" }}>
                  Estado de tu orden
                </div>
                <div style={{ fontWeight: "bold" }}>{activeOrder.status}</div>
              </div>
              {activeOrder.invoiceId && (
                <a
                  href={`${baseUrl}/api/invoices/${activeOrder.invoiceId}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-secondary"
                >
                  Ver Factura PDF
                </a>
              )}
            </div>
          </div>
        )}

      <div className="category-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-chip ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {filteredProducts.map((product) => renderProductCard(product))}
      </div>

      {itemCount > 0 && !isCartOpen && (
        <button className="cart-fab" onClick={() => setIsCartOpen(true)}>
          <span>Ver Orden</span>
          <span className="cart-fab__badge">{itemCount}</span>
        </button>
      )}

      {isCartOpen && (
        <CartDrawer tableId={tableId} onClose={() => setIsCartOpen(false)} />
      )}
    </div>
  );
}
