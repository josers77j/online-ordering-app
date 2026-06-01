import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  ShoppingCart,
  CartItem,
  CartTotals,
  IDiscountStrategy,
} from "../core/ShoppingCart";

const CART_STORAGE_KEY = "cart_items";

interface CartContextValue {
  cart: ShoppingCart;
  items: CartItem[];
  itemCount: number;
  totals: CartTotals;
  addItem: (
    productId: string,
    productName: string,
    category: string,
    unitPrice: number,
    qty?: number,
    specialTaxRate?: number,
  ) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  disableItem: (productId: string) => void;
  clearCart: () => void;
  applyStrategy: (strategy: IDiscountStrategy) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function buildCart(): ShoppingCart {
  try {
    const stored = sessionStorage.getItem(CART_STORAGE_KEY);
    if (stored) return ShoppingCart.deserialize(stored);
  } catch {
    /* ignore */
  }
  return new ShoppingCart();
}

export function CartProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [cart] = useState<ShoppingCart>(buildCart);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    sessionStorage.setItem(CART_STORAGE_KEY, cart.serialize());
  }, [tick, cart]);

  const addItem = useCallback(
    (
      productId: string,
      productName: string,
      category: string,
      unitPrice: number,
      qty = 1,
      specialTaxRate = 0,
    ) => {
      cart.add(
        productId,
        productName,
        category,
        unitPrice,
        qty,
        specialTaxRate,
      );
      refresh();
    },
    [cart, refresh],
  );

  const removeItem = useCallback(
    (productId: string) => {
      cart.remove(productId);
      refresh();
    },
    [cart, refresh],
  );

  const updateQty = useCallback(
    (productId: string, qty: number) => {
      cart.updateQuantity(productId, qty);
      refresh();
    },
    [cart, refresh],
  );

  const disableItem = useCallback(
    (productId: string) => {
      cart.disableItem(productId);
      refresh();
    },
    [cart, refresh],
  );

  const clearCart = useCallback(() => {
    cart.clear();
    sessionStorage.removeItem(CART_STORAGE_KEY);
    refresh();
  }, [cart, refresh]);

  const applyStrategy = useCallback(
    (strategy: IDiscountStrategy) => {
      cart.addStrategy(strategy);
      refresh();
    },
    [cart, refresh],
  );

  const items = cart.items;
  const itemCount = cart.itemCount;
  const totals = cart.calculateTotals(false);

  const value = useMemo(
    () => ({
      cart,
      items,
      itemCount,
      totals,
      addItem,
      removeItem,
      updateQty,
      disableItem,
      clearCart,
      applyStrategy,
    }),
    [
      cart,
      items,
      itemCount,
      totals,
      addItem,
      removeItem,
      updateQty,
      disableItem,
      clearCart,
      applyStrategy,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
