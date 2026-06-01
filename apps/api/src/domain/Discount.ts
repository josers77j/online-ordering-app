export interface CartItemSnapshot {
  productId: string;
  productName: string;
  category: string;
  unitPrice: number;
  quantity: number;
}

export interface DiscountResult {
  label: string;
  amountCents: number;
}

export interface IDiscountStrategy {
  readonly name: string;
  calculate(items: CartItemSnapshot[]): DiscountResult;
}

export class PercentageDiscount implements IDiscountStrategy {
  readonly name = "PercentageDiscount";

  constructor(
    private readonly label: string,
    private readonly percentage: number,
  ) {
    if (percentage < 0 || percentage > 1) {
      throw new Error("Percentage must be between 0 and 1");
    }
  }

  calculate(items: CartItemSnapshot[]): DiscountResult {
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const discountAmount = Math.round(subtotal * this.percentage);
    return { label: this.label, amountCents: discountAmount };
  }
}

export class TwoForOneDiscount implements IDiscountStrategy {
  readonly name = "TwoForOneDiscount";

  constructor(private readonly targetCategory: string) {}

  calculate(items: CartItemSnapshot[]): DiscountResult {
    let discountCents = 0;

    for (const item of items) {
      if (item.category === this.targetCategory && item.quantity >= 2) {
        const freeUnits = Math.floor(item.quantity / 2);
        discountCents += freeUnits * item.unitPrice;
      }
    }

    return {
      label: `2x1 en ${this.targetCategory}`,
      amountCents: discountCents,
    };
  }
}

export class HalfPriceSecondUnit implements IDiscountStrategy {
  readonly name = "HalfPriceSecondUnit";

  constructor(private readonly targetCategory?: string) {}

  calculate(items: CartItemSnapshot[]): DiscountResult {
    let discountCents = 0;

    for (const item of items) {
      const matchesCategory =
        !this.targetCategory || item.category === this.targetCategory;

      if (matchesCategory && item.quantity >= 2) {
        const discountUnits = Math.floor(item.quantity / 2);
        discountCents += discountUnits * Math.round(item.unitPrice * 0.5);
      }
    }

    const category = this.targetCategory ? ` (${this.targetCategory})` : "";

    return {
      label: `50% descuento en segunda unidad${category}`,
      amountCents: discountCents,
    };
  }
}

export class NoDiscount implements IDiscountStrategy {
  readonly name = "NoDiscount";

  calculate(_items: CartItemSnapshot[]): DiscountResult {
    return { label: "Sin descuento", amountCents: 0 };
  }
}

export class DiscountFactory {
  static reconstruct(
    discountStrategies: Array<Record<string, any>>,
  ): IDiscountStrategy[] {
    if (!discountStrategies || !Array.isArray(discountStrategies)) {
      return [];
    }

    const strategies: IDiscountStrategy[] = [];

    for (const serialized of discountStrategies) {
      const { type, ...params } = serialized;

      switch (type) {
        case "PercentageDiscount":
          strategies.push(
            new PercentageDiscount(
              params.label || "Descuento",
              params.percentage || 0,
            ),
          );
          break;

        case "TwoForOneDiscount":
          strategies.push(new TwoForOneDiscount(params.category || ""));
          break;

        case "HalfPriceSecondUnit":
          strategies.push(new HalfPriceSecondUnit(params.category));
          break;

        case "NoDiscount":
          strategies.push(new NoDiscount());
          break;

        default:
          console.warn(`Unknown discount strategy type: ${type}`);
          break;
      }
    }

    return strategies;
  }
}
