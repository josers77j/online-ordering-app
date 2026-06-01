import http from "node:http";
import { Router } from "./infrastructure/http/Router";
import { SocketServer } from "./infrastructure/ws/SocketServer";
import { HaciendaAdapter } from "./infrastructure/hacienda/HaciendaAdapter";
import { PDFGenerator } from "./infrastructure/pdf/PDFGenerator";
import { registerProductHandlers } from "./infrastructure/http/handlers/productHandlers";
import { registerOrderHandlers } from "./infrastructure/http/handlers/orderHandlers";
import { registerCheckoutHandlers } from "./infrastructure/http/handlers/checkoutHandlers";
import { registerInvoiceHandlers } from "./infrastructure/http/handlers/invoiceHandlers";
import { registerDashboardHandlers } from "./infrastructure/http/handlers/dashboardHandlers";
import { getDb } from "./infrastructure/db/Database";

const PORT = Number(process.env.PORT ?? 3001);

getDb();
console.log("[App] Database initialized");

const haciendaAdapter = new HaciendaAdapter();
const pdfGenerator = new PDFGenerator();
const router = new Router();

const server = http.createServer(async (req, res) => {
  await router.dispatch(req, res);
});

const socketServer = new SocketServer(server);

registerProductHandlers(router, socketServer);
registerOrderHandlers(router, socketServer);
registerCheckoutHandlers(router, socketServer, haciendaAdapter, pdfGenerator);
registerInvoiceHandlers(router);
registerDashboardHandlers(router);

router.get("/api/health", (_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      wsClients: socketServer.connectedCount,
    }),
  );
});

server.listen(PORT, () => {
  console.log(`[App] API listening on http://localhost:${PORT}`);
  console.log(`[App] WebSocket on ws://localhost:${PORT}/ws`);
  console.log(`[App] Routes registered:`);
  console.log("  GET  /api/health");
  console.log("  GET  /api/products");
  console.log("  PUT  /api/products/:id/stock");
  console.log("  PUT  /api/products/:id/availability");
  console.log("  POST /api/orders");
  console.log("  GET  /api/orders");
  console.log("  GET  /api/orders/:id");
  console.log("  PUT  /api/orders/:id/status");
  console.log("  POST /api/checkout");
  console.log("  GET  /api/invoices/:id");
  console.log("  GET  /api/invoices/:id/pdf");
  console.log("  GET  /api/dashboard/metrics");
});

process.on("SIGINT", () => {
  console.log("\n[App] Shutting down...");
  server.close(() => {
    console.log("[App] Server closed");
    process.exit(0);
  });
});
