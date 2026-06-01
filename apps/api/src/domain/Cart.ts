import {
  IDiscountStrategy,
  CartItemSnapshot,
  DiscountResult,
} from "./Discount";

export interface CartItem {
  productId: string;
  productName: string;
  category: string;
  unitPrice: number;
  quantity: number;
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
  private readonly _specialTaxRates: Map<string, number> = new Map();

  add(
    productId: string,
    productName: string,
    category: string,
    unitPrice: number,
    quantity: number = 1,
    specialTaxRate: number = 0,
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
      });
      this._specialTaxRates.set(productId, specialTaxRate);
    }
  }

  remove(productId: string): void {
    this._items.delete(productId);
    this._specialTaxRates.delete(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.remove(productId);
      return;
    }
    const item = this._items.get(productId);
    if (item) item.quantity = quantity;
  }

  disableItem(productId: string): void {
    this.remove(productId);
  }

  clear(): void {
    this._items.clear();
    this._strategies = [];
    this._specialTaxRates.clear();
  }

  addStrategy(strategy: IDiscountStrategy): void {
    this._strategies.push(strategy);
  }

  clearStrategies(): void {
    this._strategies = [];
  }

  private getSnapshots(): CartItemSnapshot[] {
    return Array.from(this._items.values()).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    }));
  }

  /**
   * Calcula todos los totales del carrito.
   * @param applyRetention true si el cliente es Gran Contribuyente (Crédito Fiscal)
   */
  calculateTotals(applyRetention: boolean = false): CartTotals {
    const snapshots = this.getSnapshots();

    const subtotalCents = snapshots.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const discountResults: DiscountResult[] = this._strategies.map((s) =>
      s.calculate(snapshots),
    );
    const totalDiscountCents = discountResults.reduce(
      (sum, r) => sum + r.amountCents,
      0,
    );

    const netCents = Math.max(0, subtotalCents - totalDiscountCents);

    let specialTaxCents = 0;
    for (const [productId, rate] of this._specialTaxRates) {
      const item = this._items.get(productId);
      if (item && rate > 0) {
        const itemSubtotal = item.unitPrice * item.quantity;
        const discountRatio =
          subtotalCents > 0 ? itemSubtotal / subtotalCents : 0;
        const itemNet =
          itemSubtotal - Math.round(totalDiscountCents * discountRatio);
        specialTaxCents += Math.round(itemNet * rate);
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
    return Array.from(this._items.values()).reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
  }

  /** Serializa el carrito para guardarlo en BD o enviarlo por WS */
  toPayload(): { items: CartItem[] } {
    return { items: this.items };
  }
}
