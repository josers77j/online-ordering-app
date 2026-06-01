



import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { json } from '../Router';
import { OrderQueries, ProductQueries } from '../../db/Database';
import { SocketServer } from '../../ws/SocketServer';
import { Order, OrderStatus, createStateFromStatus } from '../../../domain/Order';
import { ShoppingCart } from '../../../domain/Cart';

function parseOrder(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    tableId: row.table_id as string,
    status: row.status as OrderStatus,
    items: JSON.parse(row.items_json as string),
    totals: JSON.parse(row.totals_json as string),
    invoiceType: row.invoice_type as 'consumer' | 'credit_fiscal' | undefined,
    invoiceId: row.invoice_id as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export function registerOrderHandlers(
  router: { get: Function; post: Function; put: Function },
  socketServer: SocketServer
): void {

  
  router.post('/api/orders', async (
    req: http.IncomingMessage & { body: unknown },
    res: http.ServerResponse
  ) => {
    const body = req.body as {
      tableId: string;
      items: Array<{
        productId: string; productName: string; category: string;
        unitPrice: number; quantity: number; specialTaxRate?: number;
      }>;
      discountCode?: string;
    };

    if (!body.tableId || !Array.isArray(body.items) || body.items.length === 0) {
      return json(res, 400, { error: 'tableId and items are required' });
    }

    
    const reservations: Array<{ productId: string; quantity: number }> = [];
    for (const item of body.items) {
      const ok = ProductQueries.reserveStock(item.productId, item.quantity);
      if (!ok) {
        
        for (const r of reservations) {
          const row = ProductQueries.findById(r.productId) as Record<string, unknown>;
          ProductQueries.updateStock(r.productId, (row.stock as number) + r.quantity);
        }
        return json(res, 409, {
          error: `Insufficient stock for product: ${item.productId}`,
          productId: item.productId,
        });
      }
      reservations.push({ productId: item.productId, quantity: item.quantity });

      
      const updated = ProductQueries.findById(item.productId) as Record<string, unknown>;
      socketServer.broadcastInventoryUpdate(
        item.productId,
        updated.stock as number,
        (updated.is_available as number) === 1
      );
    }

    
    const cart = new ShoppingCart();
    for (const item of body.items) {
      cart.add(
        item.productId, item.productName, item.category,
        item.unitPrice, item.quantity, item.specialTaxRate ?? 0
      );
    }
    const totals = cart.calculateTotals(false); 

    const now = new Date().toISOString();
    const orderId = uuidv4();

    OrderQueries.create({
      id: orderId,
      tableId: body.tableId,
      itemsJson: JSON.stringify(body.items),
      totalsJson: JSON.stringify(totals),
      createdAt: now,
      updatedAt: now,
    });

    const order = parseOrder(OrderQueries.findById(orderId) as Record<string, unknown>);

    
    socketServer.broadcastToAdmin({ type: 'ORDER_NEW', payload: order });

    json(res, 201, order);
  });

  
  router.get('/api/orders', (_req: http.IncomingMessage, res: http.ServerResponse) => {
    const rows = OrderQueries.findAll() as Record<string, unknown>[];
    json(res, 200, rows.map(parseOrder));
  });

  
  router.get('/api/orders/:id', (
    req: http.IncomingMessage & { params: { id: string } },
    res: http.ServerResponse
  ) => {
    const row = OrderQueries.findById(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return json(res, 404, { error: 'Order not found' });
    json(res, 200, parseOrder(row));
  });

  
  router.put('/api/orders/:id/status', (
    req: http.IncomingMessage & { params: { id: string }; body: unknown },
    res: http.ServerResponse
  ) => {
    const { id } = req.params;
    const { status } = req.body as { status: OrderStatus };

    const validStatuses: OrderStatus[] = ['CREATED', 'PAID', 'IN_KITCHEN', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return json(res, 400, { error: `Invalid status: ${status}` });
    }

    const row = OrderQueries.findById(id) as Record<string, unknown> | undefined;
    if (!row) return json(res, 404, { error: 'Order not found' });

    const order = new Order(parseOrder(row));

    
    try {
      switch (status) {
        case 'PAID':       order.pay(); break;
        case 'IN_KITCHEN': order.sendToKitchen(); break;
        case 'DELIVERED':  order.deliver(); break;
        case 'CANCELLED':  order.cancel(); break;
        default:
          return json(res, 400, { error: `Cannot manually set status to ${status}` });
      }
    } catch (err) {
      return json(res, 422, {
        error: err instanceof Error ? err.message : 'Invalid transition',
      });
    }

    const now = new Date().toISOString();
    OrderQueries.updateStatus(id, order.status, now);
    const updated = parseOrder(OrderQueries.findById(id) as Record<string, unknown>);

    
    socketServer.broadcastToTable(updated.tableId as string, {
      type: 'ORDER_STATUS',
      payload: updated,
    });
    socketServer.broadcastToAdmin({ type: 'ORDER_UPDATE', payload: updated });

    json(res, 200, updated);
  });
}
