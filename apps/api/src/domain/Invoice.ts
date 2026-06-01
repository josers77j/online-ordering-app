





import { CartTotals } from './Cart';



export type InvoiceType = 'consumer' | 'credit_fiscal';

export interface ConsumerInvoiceData {
  type: 'consumer';
  orderId: string;
  tableId: string;
  fullName: string;
  documentId: string;      
  documentType: 'DUI' | 'PASSPORT';
  totals: CartTotals;
  selloHash: string;       
  issuedAt: Date;
  invoiceNumber: string;
}

export interface CreditFiscalInvoiceData {
  type: 'credit_fiscal';
  orderId: string;
  tableId: string;
  nit: string;             
  nrc: string;             
  businessName: string;    
  isGranContribuyente: boolean; 
  totals: CartTotals;
  selloHash: string;
  issuedAt: Date;
  invoiceNumber: string;
}

export type InvoiceDocument = ConsumerInvoiceData | CreditFiscalInvoiceData;



export function validateDUI(dui: string): boolean {
  
  return /^\d{8}-\d$/.test(dui);
}

export function validateNIT(nit: string): boolean {
  
  return /^\d{4}-\d{6}-\d{3}-\d$/.test(nit);
}

export function validateNRC(nrc: string): boolean {
  
  return /^\d{1,8}$/.test(nrc);
}



abstract class BaseInvoice {
  abstract readonly type: InvoiceType;
  abstract validate(): void;
  abstract toDocument(): InvoiceDocument;
}



class ConsumerInvoice extends BaseInvoice {
  readonly type: InvoiceType = 'consumer';

  constructor(private readonly data: ConsumerInvoiceData) {
    super();
    this.validate();
  }

  validate(): void {
    if (!this.data.fullName?.trim()) {
      throw new Error('Consumer invoice requires full name');
    }
    if (this.data.documentType === 'DUI' && !validateDUI(this.data.documentId)) {
      throw new Error(`Invalid DUI format: ${this.data.documentId}. Expected ########-#`);
    }
    if (!this.data.documentId?.trim()) {
      throw new Error('Consumer invoice requires document ID (DUI or Passport)');
    }
  }

  toDocument(): ConsumerInvoiceData {
    return { ...this.data };
  }
}



class CreditFiscalInvoice extends BaseInvoice {
  readonly type: InvoiceType = 'credit_fiscal';

  constructor(private readonly data: CreditFiscalInvoiceData) {
    super();
    this.validate();
  }

  validate(): void {
    if (!validateNIT(this.data.nit)) {
      throw new Error(`Invalid NIT format: ${this.data.nit}. Expected ####-######-###-#`);
    }
    if (!validateNRC(this.data.nrc)) {
      throw new Error(`Invalid NRC: ${this.data.nrc}`);
    }
    if (!this.data.businessName?.trim()) {
      throw new Error('Credit fiscal invoice requires business name (Razón Social)');
    }
    
    if (this.data.isGranContribuyente && this.data.totals.retentionCents === 0) {
      throw new Error(
        'Gran Contribuyente invoice must have retention (1% of IVA) calculated'
      );
    }
  }

  toDocument(): CreditFiscalInvoiceData {
    return { ...this.data };
  }
}



export type CreateConsumerPayload = Omit<ConsumerInvoiceData, 'type'>;
export type CreateCreditFiscalPayload = Omit<CreditFiscalInvoiceData, 'type'>;

export class InvoiceFactory {
  static createConsumer(payload: CreateConsumerPayload): ConsumerInvoiceData {
    const invoice = new ConsumerInvoice({ type: 'consumer', ...payload });
    return invoice.toDocument();
  }

  static createCreditFiscal(payload: CreateCreditFiscalPayload): CreditFiscalInvoiceData {
    const invoice = new CreditFiscalInvoice({ type: 'credit_fiscal', ...payload });
    return invoice.toDocument();
  }

  /** Método genérico que delega al factory correcto */
  static create(
    type: 'consumer',
    payload: CreateConsumerPayload
  ): ConsumerInvoiceData;
  static create(
    type: 'credit_fiscal',
    payload: CreateCreditFiscalPayload
  ): CreditFiscalInvoiceData;
  static create(
    type: InvoiceType,
    payload: CreateConsumerPayload | CreateCreditFiscalPayload
  ): InvoiceDocument {
    if (type === 'consumer') {
      return InvoiceFactory.createConsumer(payload as CreateConsumerPayload);
    }
    return InvoiceFactory.createCreditFiscal(payload as CreateCreditFiscalPayload);
  }
}
