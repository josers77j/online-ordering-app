




import http from "node:http";
import { v4 as uuidv4 } from "uuid";
import { json } from "../Router";
import { OrderQueries, InvoiceQueries } from "../../db/Database";
import { SocketServer } from "../../ws/SocketServer";
import { HaciendaAdapter } from "../../hacienda/HaciendaAdapter";
import { PDFGenerator } from "../../pdf/PDFGenerator";
import { InvoiceFactory } from "../../../domain/Invoice";
import { ShoppingCart } from "../../../domain/Cart";
import { Order } from "../../../domain/Order";
import { DiscountFactory } from "../../../domain/Discount";

function parseOrder(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    tableId: row.table_id as string,
    status: row.status as string,
    items: JSON.parse(row.items_json as string),
    totals: JSON.parse(row.totals_json as string),
    invoiceType: row.invoice_type as string | undefined,
    invoiceId: row.invoice_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export function registerCheckoutHandlers(
  router: { post: Function },
  socketServer: SocketServer,
  hacienda: HaciendaAdapter,
  pdfGenerator: PDFGenerator,
): void {
  /**
   * POST /api/checkout
   * Body: {
   *   orderId: string,
   *   invoiceType: 'consumer' | 'credit_fiscal',
   *   discountStrategies?: Array<{type, ...params}>,
   *   Si consumer:
   *   fullName?: string, documentId?: string, documentType?: 'DUI'|'PASSPORT',
   *   Si credit_fiscal:
   *   nit?: string, nrc?: string, businessName?: string, isGranContribuyente?: boolean
   * }
   */
  router.post(
    "/api/checkout",
    async (
      req: http.IncomingMessage & { body: unknown },
      res: http.ServerResponse,
    ) => {
      const body = req.body as Record<string, unknown>;
      const { orderId, invoiceType, discountStrategies } = body;

      if (!orderId || !invoiceType) {
        return json(res, 400, {
          error: "orderId and invoiceType are required",
        });
      }

      const row = OrderQueries.findById(orderId as string) as
        | Record<string, unknown>
        | undefined;
      if (!row) return json(res, 404, { error: "Order not found" });

      const orderData = parseOrder(row);

      if (orderData.status !== "CREATED") {
        return json(res, 422, {
          error: `Order cannot be checked out in status: ${orderData.status}`,
        });
      }

      if (orderData.invoiceId) {
        return json(res, 409, {
          error: "Order already has an invoice — no duplicate charges",
        });
      }

      
      const isGranContribuyente =
        invoiceType === "credit_fiscal" && !!body.isGranContribuyente;
      const cart = new ShoppingCart();
      for (const item of orderData.items) {
        cart.add(
          item.productId,
          item.productName,
          item.category,
          item.unitPrice,
          item.quantity,
          item.specialTaxRate || 0,
        );
      }

      
      if (Array.isArray(discountStrategies) && discountStrategies.length > 0) {
        const reconstructedStrategies =
          DiscountFactory.reconstruct(discountStrategies);
        for (const strategy of reconstructedStrategies) {
          cart.addStrategy(strategy);
        }
      }

      const finalTotals = cart.calculateTotals(isGranContribuyente);

      
      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceId = uuidv4();
      let invoiceDoc:
        | ReturnType<typeof InvoiceFactory.createConsumer>
        | ReturnType<typeof InvoiceFactory.createCreditFiscal>;

      try {
        if (invoiceType === "consumer") {
          invoiceDoc = InvoiceFactory.createConsumer({
            orderId: orderId as string,
            tableId: orderData.tableId,
            fullName: body.fullName as string,
            documentId: body.documentId as string,
            documentType: (body.documentType as "DUI" | "PASSPORT") ?? "DUI",
            totals: finalTotals,
            selloHash: "", 
            issuedAt: new Date(),
            invoiceNumber,
          });
        } else {
          invoiceDoc = InvoiceFactory.createCreditFiscal({
            orderId: orderId as string,
            tableId: orderData.tableId,
            nit: body.nit as string,
            nrc: body.nrc as string,
            businessName: body.businessName as string,
            isGranContribuyente,
            totals: finalTotals,
            selloHash: "",
            issuedAt: new Date(),
            invoiceNumber,
          });
        }
      } catch (validationError) {
        return json(res, 400, {
          error:
            validationError instanceof Error
              ? validationError.message
              : "Invoice validation failed",
        });
      }

      
      let haciendaResponse;
      try {
        haciendaResponse = await hacienda.submitInvoice(invoiceDoc);
      } catch (haciendaError) {
        return json(res, 503, {
          error: "Hacienda service unavailable after retries",
          detail:
            haciendaError instanceof Error
              ? haciendaError.message
              : String(haciendaError),
        });
      }

      
      (invoiceDoc as any).selloHash = haciendaResponse.selloHash;
      
      (invoiceDoc as any).items = orderData.items;

      
      let pdfPath = "";
      try {
        pdfPath = await pdfGenerator.generate(invoiceDoc);
      } catch (pdfError) {
        console.error("[Checkout] PDF generation failed:", pdfError);
        
      }

      
      InvoiceQueries.create({
        id: invoiceId,
        orderId: orderId as string,
        type: invoiceType as string,
        documentJson: JSON.stringify(invoiceDoc),
        selloHash: haciendaResponse.selloHash,
        pdfPath,
        issuedAt: new Date().toISOString(),
      });

      OrderQueries.updateInvoice(
        orderId as string,
        invoiceType as string,
        invoiceId,
      );

      
      const order = new Order({
        ...orderData,
        invoiceType: orderData.invoiceType as
          | "consumer"
          | "credit_fiscal"
          | undefined,
        status: "CREATED",
      });
      order.pay();
      OrderQueries.updateStatus(
        orderId as string,
        order.status,
        new Date().toISOString(),
      );

      
      const updatedOrder = parseOrder(
        OrderQueries.findById(orderId as string) as Record<string, unknown>,
      );
      socketServer.broadcastToTable(updatedOrder.tableId, {
        type: "ORDER_STATUS",
        payload: updatedOrder,
      });
      socketServer.broadcastToAdmin({
        type: "ORDER_UPDATE",
        payload: updatedOrder,
      });

      json(res, 200, {
        success: true,
        orderId,
        invoiceId,
        invoiceNumber,
        selloHash: haciendaResponse.selloHash,
        numeroControl: haciendaResponse.numeroControl,
        totals: finalTotals,
        pdfUrl: pdfPath ? `/api/invoices/${invoiceId}/pdf` : null,
        hacienda: {
          codigoGeneracion: haciendaResponse.codigoGeneracion,
          fechaProcesamiento: haciendaResponse.fechaHoraProcesamiento,
        },
      });
    },
  );
}
