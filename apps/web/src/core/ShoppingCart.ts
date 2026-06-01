export interface CartItem {
  productId: string;
  productName: string;
  category: string;
  unitPrice: number;
  quantity: number;
  specialTaxRate: number;
}

export interface DiscountResult {
  label: string;
  amountCents: number;
}

export interface IDiscountStrategy {
  readonly name: string;
  calculate(items: CartItem[]): DiscountResult;
}

export class PercentageDiscount implements IDiscountStrategy {
  readonly name = "PercentageDiscount";
  constructor(
    private readonly label: string,
    private readonly pct: number,
  ) {}
  calculate(items: CartItem[]): DiscountResult {
    const sub = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    return { label: this.label, amountCents: Math.round(sub * this.pct) };
  }
}

export class TwoForOneDiscount implements IDiscountStrategy {
  readonly name = "TwoForOneDiscount";
  constructor(private readonly category: string) {}
  calculate(items: CartItem[]): DiscountResult {
    let d = 0;
    for (const item of items) {
      if (item.category === this.category && item.quantity >= 2) {
        d += Math.floor(item.quantity / 2) * item.unitPrice;
      }
    }
    return { label: `2x1 en ${this.category}`, amountCents: d };
  }
}

export class HalfPriceSecondUnit implements IDiscountStrategy {
  readonly name = "HalfPriceSecondUnit";
  constructor(private readonly category?: string) {}
  calculate(items: CartItem[]): DiscountResult {
    let d = 0;
    for (const item of items) {
      const match = !this.category || item.category === this.category;
      if (match && item.quantity >= 2) {
        d += Math.floor(item.quantity / 2) * Math.round(item.unitPrice * 0.5);
      }
    }
    const categorySuffix = this.category ? `${this.category}` : "";
    return {
      label: "50% en segunda unidad " + categorySuffix,
      amountCents: d,
    };
  }
}

export interface CartTotals {
  subtotalCents: number;
  discountResults: DiscountResult[];
  totalDiscountCents: number;
  netCents: number;
  specialTaxCents: number;
  ivaBaseCents: number;
  ivaCents: number;
  retentionCents: number;
  grandTotalCents: number;
}

export class ShoppingCart {
  private readonly _items: Map<string, CartItem> = new Map();
  private _strategies: IDiscountStrategy[] = [];

  add(
    productId: string,
    productName: string,
    category: string,
    unitPrice: number,
    quantity = 1,
    specialTaxRate = 0,
  ): void {
    const existing = this._items.get(productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this._items.set(productId, {
        productId,
        productName,
        category,
        unitPrice,
        quantity,
        specialTaxRate,
      });
    }
  }

  remove(productId: string): void {
    this._items.delete(productId);
  }

  updateQuantity(productId: string, qty: number): void {
    if (qty <= 0) {
      this.remove(productId);
      return;
    }
    const item = this._items.get(productId);
    if (item) item.quantity = qty;
  }

  disableItem(productId: string): void {
    this.remove(productId);
  }

  clear(): void {
    this._items.clear();
    this._strategies = [];
  }

  addStrategy(strategy: IDiscountStrategy): void {
    this._strategies.push(strategy);
  }

  clearStrategies(): void {
    this._strategies = [];
  }

  calculateTotals(applyRetention = false): CartTotals {
    const items = this.items;
    const subtotalCents = items.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );

    const discountResults = this._strategies.map((s) => s.calculate(items));
    const totalDiscountCents = discountResults.reduce(
      (s, r) => s + r.amountCents,
      0,
    );
    const netCents = Math.max(0, subtotalCents - totalDiscountCents);

    let specialTaxCents = 0;
    for (const item of items) {
      if (item.specialTaxRate > 0) {
        const itemNet = item.unitPrice * item.quantity;
        specialTaxCents += Math.round(itemNet * item.specialTaxRate);
      }
    }

    const ivaBaseCents = netCents;
    const ivaCents = Math.round(ivaBaseCents * 0.13);
    const retentionCents = applyRetention ? Math.round(ivaCents * 0.01) : 0;
    const grandTotalCents =
      netCents + ivaCents + specialTaxCents - retentionCents;

    return {
      subtotalCents,
      discountResults,
      totalDiscountCents,
      netCents,
      specialTaxCents,
      ivaBaseCents,
      ivaCents,
      retentionCents,
      grandTotalCents,
    };
  }

  get items(): CartItem[] {
    return Array.from(this._items.values());
  }

  get isEmpty(): boolean {
    return this._items.size === 0;
  }

  get itemCount(): number {
    return this.items.reduce((s, i) => s + i.quantity, 0);
  }

  private serializeStrategies(): Array<Record<string, any>> {
    return this._strategies.map((s) => {
      if (s instanceof PercentageDiscount) {
        return {
          type: "PercentageDiscount",
          label: (s as any).label,
          percentage: (s as any).pct,
        };
      }
      if (s instanceof TwoForOneDiscount) {
        return {
          type: "TwoForOneDiscount",
          category: (s as any).category,
        };
      }
      if (s instanceof HalfPriceSecondUnit) {
        return {
          type: "HalfPriceSecondUnit",
          category: (s as any).category,
        };
      }
      return { type: "Unknown" };
    });
  }

  toOrderPayload(tableId: string) {
    return {
      tableId,
      items: this.items,
      discountStrategies: this.serializeStrategies(),
    };
  }

  serialize(): string {
    return JSON.stringify(this.items);
  }

  static deserialize(json: string): ShoppingCart {
    const cart = new ShoppingCart();
    const items: CartItem[] = JSON.parse(json);
    for (const item of items) {
      cart.add(
        item.productId,
        item.productName,
        item.category,
        item.unitPrice,
        item.quantity,
        item.specialTaxRate,
      );
    }
    return cart;
  }
}
