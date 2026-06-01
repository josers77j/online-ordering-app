import React, { useEffect, useState } from "react";
import { useAdmin } from "../context/AdminContext";
import { useSocket } from "../context/SocketContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { API_BASE } from "../config/env";

interface DashboardMetrics {
  grossRevenueCents: number;
  netRevenueCents: number;
  totalDiscountsCents: number;
  paidOrders: number;
  totalOrders: number;
  totalIvaCents: number;
  totalRetentionCents: number;
  totalSpecialTaxCents: number;
  ordersByInvoiceType: Array<{ invoiceType: string; count: number }>;
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatDate = (isoStr: string) =>
  new Date(isoStr).toLocaleTimeString("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
  });

const baseUrl = API_BASE ?? "http://localhost:3001";

export default function AdminPage() {
  const {
    orders,
    products,
    isLoading,
    fetchOrders,
    fetchProducts,
    changeOrderStatus,
    updateStock,
    toggleAvailability,
  } = useAdmin();
  const { isConnected } = useSocket();

  const [activeTab, setActiveTab] = useState<
    "orders" | "inventory" | "dashboard"
  >("orders");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [fetchOrders, fetchProducts]);

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetch(`${baseUrl}/api/dashboard/metrics`)
        .then((res) => res.json())
        .then(setMetrics)
        .catch((error: unknown) => {
          console.error("Error fetching dashboard metrics:", error);
        });
    }
  }, [activeTab, orders]); 

  return (
    <div className="admin-layout">
      {/* Topbar */}
      <header className="admin-topbar">
        <div className="admin-topbar__logo">Restaurant Admin</div>
        <div className="admin-topbar__right">
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--clr-muted)" }}>
            Estado del Servidor:
          </span>
          <div
            className={`ws-indicator ${isConnected ? "connected" : ""}`}
            title="WebSocket Connection"
          />
        </div>
      </header>

      {/* Sidebar */}
      <nav className="admin-sidebar">
        <button
          className={`sidebar-item ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          <span className="sidebar-item__icon">📋</span> Órdenes en Vivo
        </button>
        <button
          className={`sidebar-item ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          <span className="sidebar-item__icon">📦</span> Inventario
        </button>
        <button
          className={`sidebar-item ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <span className="sidebar-item__icon">📈</span> Dashboard Financiero
        </button>
      </nav>

      {/* Main Content */}
      <main className="admin-main">
        {isLoading && orders.length === 0 ? (
          <div className="spinner" style={{ margin: "auto" }} />
        ) : (
          <>
            {/* ── Vista de Órdenes ── */}
            {activeTab === "orders" && (
              <div>
                <h1 className="page-title">Monitor de Comandas</h1>
                <p className="page-subtitle" style={{ marginBottom: "2rem" }}>
                  Órdenes entrantes en tiempo real. Los cambios notifican
                  automáticamente a la mesa.
                </p>

                <div className="orders-panel">
                  {orders.map((order) => (
                    <div key={order.id} className="order-card">
                      <div className="order-card__header">
                        <span className="order-card__table">
                          Mesa {order.tableId}
                        </span>
                        <span className="order-card__time">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>

                      <div className="order-card__body">
                        <div style={{ marginBottom: "1rem" }}>
                          <span className={`status-badge ${order.status}`}>
                            {order.status}
                          </span>
                          {order.invoiceType && (
                            <span
                              className="badge badge-gray"
                              style={{ marginLeft: "8px" }}
                            >
                              Facturado ({order.invoiceType})
                            </span>
                          )}
                        </div>

                        {order.items.map((item) => (
                          <div key={item.productId} className="order-item-row">
                            <span>
                              {item.quantity}x {item.productName}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="order-card__footer">
                        <span className="order-card__total">
                          {formatPrice(order.totals.grandTotalCents)}
                        </span>

                        <div className="status-actions">
                          {order.status === "CREATED" && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "var(--clr-muted)",
                              }}
                            >
                              Esperando Pago...
                            </span>
                          )}
                          {order.status === "PAID" && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() =>
                                changeOrderStatus(order.id, "IN_KITCHEN")
                              }
                            >
                              A Cocina
                            </button>
                          )}
                          {order.status === "IN_KITCHEN" && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() =>
                                changeOrderStatus(order.id, "DELIVERED")
                              }
                            >
                              Entregar
                            </button>
                          )}
                          {order.status === "DELIVERED" && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "var(--clr-success)",
                                fontWeight: "bold",
                              }}
                            >
                              ✔ Completada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Vista de Inventario ── */}
            {activeTab === "inventory" && (
              <div>
                <h1 className="page-title">Control de Inventario</h1>
                <p className="page-subtitle" style={{ marginBottom: "2rem" }}>
                  Sincronización en tiempo real con los clientes conectados.
                </p>

                <div
                  className="card"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <table className="inv-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th style={{ textAlign: "center" }}>
                          Stock Disponible
                        </th>
                        <th style={{ textAlign: "right" }}>
                          Disponibilidad Manual
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr
                          key={p.id}
                          style={{ opacity: p.isAvailable ? 1 : 0.5 }}
                        >
                          <td style={{ fontWeight: 600 }}>{p.name}</td>
                          <td style={{ textTransform: "capitalize" }}>
                            {p.category.replace("_", " ")}
                          </td>
                          <td>{formatPrice(p.price)}</td>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="number"
                              className="inv-stock-input"
                              defaultValue={p.stock}
                              onBlur={(e) =>
                                updateStock(
                                  p.id,
                                  Number.parseInt(e.target.value) || 0,
                                )
                              }
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className={`btn btn-sm ${p.isAvailable ? "btn-danger" : "btn-secondary"}`}
                              onClick={() =>
                                toggleAvailability(p.id, !p.isAvailable)
                              }
                            >
                              {p.isAvailable ? "Desactivar" : "Activar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Vista Dashboard ── */}
            {activeTab === "dashboard" && metrics && (
              <div>
                <h1 className="page-title">Dashboard Analítico</h1>
                <p className="page-subtitle" style={{ marginBottom: "2rem" }}>
                  Métricas en tiempo real basadas en órdenes pagadas y
                  entregadas.
                </p>

                <div className="stats-grid" style={{ marginBottom: "2rem" }}>
                  <div className="stat-card">
                    <span className="stat-card__label">Ingresos Brutos</span>
                    <span className="stat-card__value accent">
                      {formatPrice(metrics.grossRevenueCents)}
                    </span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card__label">Ingresos Netos</span>
                    <span className="stat-card__value green">
                      {formatPrice(metrics.netRevenueCents)}
                    </span>
                    <span className="stat-card__sub">Subtotal - Impuestos</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card__label">
                      Pérdida por Descuentos
                    </span>
                    <span className="stat-card__value red">
                      -{formatPrice(metrics.totalDiscountsCents)}
                    </span>
                    <span className="stat-card__sub">Subsidios dinámicos</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card__label">Órdenes Pagadas</span>
                    <span className="stat-card__value">
                      {metrics.paidOrders} / {metrics.totalOrders}
                    </span>
                  </div>
                </div>

                <div className="charts-grid">
                  <div className="chart-card">
                    <h3 className="chart-card__title">
                      Desglose Impositivo Riguroso
                    </h3>
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              name: "Neto",
                              amount: metrics.netRevenueCents / 100,
                            },
                            {
                              name: "IVA (13%)",
                              amount: metrics.totalIvaCents / 100,
                            },
                            {
                              name: "Retención (1%)",
                              amount: metrics.totalRetentionCents / 100,
                            },
                            {
                              name: "Imp. Especial",
                              amount: metrics.totalSpecialTaxCents / 100,
                            },
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <XAxis
                            dataKey="name"
                            stroke="var(--clr-muted)"
                            fontSize={12}
                          />
                          <YAxis
                            stroke="var(--clr-muted)"
                            fontSize={12}
                            tickFormatter={(val) => `$${val}`}
                          />
                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.05)" }}
                            contentStyle={{
                              background: "var(--clr-surface)",
                              border: "1px solid var(--clr-border)",
                              borderRadius: "8px",
                              color: "var(--clr-text)",
                              fontSize: "0.85rem",
                            }}
                            itemStyle={{ color: "var(--clr-text)" }}
                            labelStyle={{ color: "var(--clr-text)" }}
                            formatter={(value: number) => [
                              `$${value.toFixed(2)}`,
                              "Monto",
                            ]}
                          />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {[
                              "var(--clr-success)",
                              "var(--clr-warning)",
                              "var(--clr-error)",
                              "var(--clr-accent)",
                            ].map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="chart-card">
                    <h3 className="chart-card__title">
                      Tipos de Comprobante Emitidos
                    </h3>
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.ordersByInvoiceType.map((m: any) => ({
                              name:
                                m.invoiceType === "consumer"
                                  ? "Consumidor Final"
                                  : m.invoiceType === "credit_fiscal"
                                    ? "Crédito Fiscal"
                                    : "Sin Factura",
                              value: m.count,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                          >
                            <Cell fill="var(--clr-accent)" />
                            <Cell fill="var(--clr-warning)" />
                            <Cell fill="var(--clr-muted)" />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--clr-surface)",
                              border: "1px solid var(--clr-border)",
                              borderRadius: "8px",
                              color: "var(--clr-text)",
                              fontSize: "0.85rem",
                            }}
                            itemStyle={{ color: "var(--clr-text)" }}
                            labelStyle={{ color: "var(--clr-text)" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
