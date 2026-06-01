



import http from 'http';
import { json } from '../Router';
import { ProductQueries } from '../../db/Database';
import { SocketServer } from '../../ws/SocketServer';

function dbRowToProduct(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    price: row.price as number,
    category: row.category as string,
    imageUrl: row.image_url as string,
    stock: row.stock as number,
    specialTaxRate: row.special_tax as number,
    isAvailable: row.is_available === 1,
  };
}

export function registerProductHandlers(
  router: { get: Function; put: Function },
  socketServer: SocketServer
): void {
  
  router.get('/api/products', (req: http.IncomingMessage, res: http.ServerResponse) => {
    const rows = ProductQueries.findAll() as Record<string, unknown>[];
    json(res, 200, rows.map(dbRowToProduct));
  });

  
  router.put(
    '/api/products/:id/stock',
    (
      req: http.IncomingMessage & { params: { id: string }; body: { stock: number } },
      res: http.ServerResponse
    ) => {
      const { id } = req.params;
      const { stock } = req.body as { stock: number };

      if (typeof stock !== 'number' || stock < 0) {
        return json(res, 400, { error: 'stock must be a non-negative number' });
      }

      ProductQueries.updateStock(id, stock);
      const updated = dbRowToProduct(ProductQueries.findById(id) as Record<string, unknown>);

      
      socketServer.broadcastInventoryUpdate(id, updated.stock, updated.isAvailable);

      json(res, 200, updated);
    }
  );

  
  router.put(
    '/api/products/:id/availability',
    (
      req: http.IncomingMessage & { params: { id: string }; body: { available: boolean } },
      res: http.ServerResponse
    ) => {
      const { id } = req.params;
      const { available } = req.body as { available: boolean };

      if (typeof available !== 'boolean') {
        return json(res, 400, { error: 'available must be boolean' });
      }

      ProductQueries.updateAvailability(id, available);
      const updated = dbRowToProduct(ProductQueries.findById(id) as Record<string, unknown>);

      socketServer.broadcastInventoryUpdate(id, updated.stock, updated.isAvailable);

      json(res, 200, updated);
    }
  );
}
