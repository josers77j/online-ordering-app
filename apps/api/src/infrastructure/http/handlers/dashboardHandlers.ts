




import http from 'http';
import { json } from '../Router';
import { DashboardQueries } from '../../db/Database';
import { CartTotals } from '../../../domain/Cart';

interface DashboardMetrics {
  totalOrders: number;
  paidOrders: number;
  grossRevenueCents: number;       
  totalIvaCents: number;
  totalRetentionCents: number;
  totalSpecialTaxCents: number;
  totalDiscountsCents: number;     
  netRevenueCents: number;         
  ordersByInvoiceType: Array<{ invoiceType: string; count: number }>;
}

export function registerDashboardHandlers(
  router: { get: Function }
): void {

  
  router.get('/api/dashboard/metrics', (_req: http.IncomingMessage, res: http.ServerResponse) => {
    const raw = DashboardQueries.getMetrics();

    
    let grossRevenue = 0;
    let totalIva = 0;
    let totalRetention = 0;
    let totalSpecialTax = 0;
    let totalDiscounts = 0;

    for (const row of raw.allPaidTotals) {
      const totals: CartTotals = JSON.parse(row.totals_json);
      grossRevenue    += totals.grandTotalCents;
      totalIva        += totals.ivaCents;
      totalRetention  += totals.retentionCents;
      totalSpecialTax += totals.specialTaxCents;
      totalDiscounts  += totals.totalDiscountCents;
    }

    const netRevenue = grossRevenue - totalIva - totalRetention - totalSpecialTax;

    const metrics: DashboardMetrics = {
      totalOrders: raw.totalOrders,
      paidOrders: raw.paidOrders,
      grossRevenueCents: grossRevenue,
      totalIvaCents: totalIva,
      totalRetentionCents: totalRetention,
      totalSpecialTaxCents: totalSpecialTax,
      totalDiscountsCents: totalDiscounts,
      netRevenueCents: netRevenue,
      ordersByInvoiceType: (raw.totalsByType as Array<{ invoice_type: string; count: number }>).map(r => ({
        invoiceType: r.invoice_type ?? 'Sin factura',
        count: r.count,
      })),
    };

    json(res, 200, metrics);
  });
}
