



import http from 'http';
import fs from 'fs';
import path from 'path';
import { json } from '../Router';
import { InvoiceQueries } from '../../db/Database';

export function registerInvoiceHandlers(
  router: { get: Function }
): void {

  
  router.get('/api/invoices/:id', (
    req: http.IncomingMessage & { params: { id: string } },
    res: http.ServerResponse
  ) => {
    const row = InvoiceQueries.findById(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return json(res, 404, { error: 'Invoice not found' });

    json(res, 200, {
      id: row.id,
      orderId: row.order_id,
      type: row.type,
      document: JSON.parse(row.document_json as string),
      selloHash: row.sello_hash,
      issuedAt: row.issued_at,
      hasPdf: !!row.pdf_path,
    });
  });

  
  router.get('/api/invoices/:id/pdf', (
    req: http.IncomingMessage & { params: { id: string } },
    res: http.ServerResponse
  ) => {
    const row = InvoiceQueries.findById(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return json(res, 404, { error: 'Invoice not found' });

    const pdfPath = row.pdf_path as string;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      return json(res, 404, { error: 'PDF not available for this invoice' });
    }

    const filename = path.basename(pdfPath);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': fs.statSync(pdfPath).size,
    });

    fs.createReadStream(pdfPath).pipe(res);
  });
}
