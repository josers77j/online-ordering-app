import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useSocket } from "./SocketContext";
import { API_BASE } from "../config/env";

export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "IN_KITCHEN"
  | "DELIVERED"
  | "CANCELLED";

export interface Order {
  id: string;
  tableId: string;
  status: OrderStatus;
  items: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
  }>;
  totals: {
    grandTotalCents: number;
    ivaCents: number;
    totalDiscountCents: number;
  };
  invoiceType?: string;
  invoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  specialTaxRate: number;
}

interface AdminContextValue {
  orders: Order[];
  products: Product[];
  isLoading: boolean;
  fetchOrders: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  changeOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateStock: (productId: string, stock: number) => Promise<void>;
  toggleAvailability: (productId: string, available: boolean) => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const baseUrl = API_BASE ?? "http://localhost:3001";

export function AdminProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { addListener, joinRoom } = useSocket();

  useEffect(() => {
    joinRoom("admin");
  }, [joinRoom]);

  useEffect(() => {
    return addListener((msg) => {});
  }, [addListener]);

  const handleOrderNew = useCallback((payload: Order) => {
    setOrders((prev) => [payload, ...prev]);
  }, []);

  const handleOrderUpdate = useCallback((payload: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === payload.id ? payload : o)));
  }, []);

  const handleInventoryUpdate = useCallback(
    (payload: { productId: string; stock: number; isAvailable: boolean }) => {
      const { productId, stock, isAvailable } = payload;
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, stock, isAvailable } : p,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    return addListener((msg) => {
      if (msg.type === "ORDER_NEW") return handleOrderNew(msg.payload as Order);
      if (msg.type === "ORDER_UPDATE")
        return handleOrderUpdate(msg.payload as Order);
      if (msg.type === "INVENTORY_UPDATE")
        return handleInventoryUpdate(
          msg.payload as {
            productId: string;
            stock: number;
            isAvailable: boolean;
          },
        );
      return undefined;
    });
  }, [addListener, handleOrderNew, handleOrderUpdate, handleInventoryUpdate]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/orders`);
      const data = await res.json();
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/products`);
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, []);

  const changeOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    },
    [],
  );

  const updateStock = useCallback(async (productId: string, stock: number) => {
    await fetch(`${baseUrl}/api/products/${productId}/stock`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
  }, []);

  const toggleAvailability = useCallback(
    async (productId: string, available: boolean) => {
      await fetch(`${baseUrl}/api/products/${productId}/availability`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available }),
      });
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      orders,
      products,
      isLoading,
      fetchOrders,
      fetchProducts,
      changeOrderStatus,
      updateStock,
      toggleAvailability,
    }),
    [
      orders,
      products,
      isLoading,
      fetchOrders,
      fetchProducts,
      changeOrderStatus,
      updateStock,
      toggleAvailability,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
