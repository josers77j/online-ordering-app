import { CartItem, CartTotals } from "./Cart";

export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "IN_KITCHEN"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderData {
  id: string;
  tableId: string;
  status: OrderStatus;
  items: CartItem[];
  totals: CartTotals;
  invoiceType?: "consumer" | "credit_fiscal";
  invoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IOrderState {
  readonly status: OrderStatus;
  pay(order: Order): void;
  sendToKitchen(order: Order): void;
  deliver(order: Order): void;
  cancel(order: Order): void;
}

class CreatedState implements IOrderState {
  readonly status: OrderStatus = "CREATED";

  pay(order: Order): void {
    order.transitionTo(new PaidState());
  }
  sendToKitchen(_order: Order): void {
    throw new Error("Order must be paid before sending to kitchen");
  }
  deliver(_order: Order): void {
    throw new Error("Order must be paid and in kitchen before delivery");
  }
  cancel(order: Order): void {
    order.transitionTo(new CancelledState());
  }
}

class PaidState implements IOrderState {
  readonly status: OrderStatus = "PAID";

  pay(_order: Order): void {
    throw new Error("Order is already paid");
  }
  sendToKitchen(order: Order): void {
    order.transitionTo(new InKitchenState());
  }
  deliver(_order: Order): void {
    throw new Error("Order must be in kitchen before delivery");
  }
  cancel(order: Order): void {
    order.transitionTo(new CancelledState());
  }
}

class InKitchenState implements IOrderState {
  readonly status: OrderStatus = "IN_KITCHEN";

  pay(_order: Order): void {
    throw new Error("Order is already paid");
  }
  sendToKitchen(_order: Order): void {
    throw new Error("Order is already in kitchen");
  }
  deliver(order: Order): void {
    order.transitionTo(new DeliveredState());
  }
  cancel(order: Order): void {
    order.transitionTo(new CancelledState());
  }
}

class DeliveredState implements IOrderState {
  readonly status: OrderStatus = "DELIVERED";

  pay(_order: Order): void {
    throw new Error("Order is already delivered");
  }
  sendToKitchen(_order: Order): void {
    throw new Error("Order is already delivered");
  }
  deliver(_order: Order): void {
    throw new Error("Order is already delivered");
  }
  cancel(_order: Order): void {
    throw new Error("Cannot cancel a delivered order");
  }
}

class CancelledState implements IOrderState {
  readonly status: OrderStatus = "CANCELLED";

  pay(_order: Order): void {
    throw new Error("Cannot pay a cancelled order");
  }
  sendToKitchen(_order: Order): void {
    throw new Error("Cannot process a cancelled order");
  }
  deliver(_order: Order): void {
    throw new Error("Cannot deliver a cancelled order");
  }
  cancel(_order: Order): void {
    throw new Error("Order is already cancelled");
  }
}

export function createStateFromStatus(status: OrderStatus): IOrderState {
  switch (status) {
    case "CREATED":
      return new CreatedState();
    case "PAID":
      return new PaidState();
    case "IN_KITCHEN":
      return new InKitchenState();
    case "DELIVERED":
      return new DeliveredState();
    case "CANCELLED":
      return new CancelledState();
    default:
      throw new Error(`Unknown order status: ${status}`);
  }
}

export class Order {
  readonly id: string;
  readonly tableId: string;
  readonly items: CartItem[];
  readonly totals: CartTotals;
  private _state: IOrderState;
  invoiceType?: "consumer" | "credit_fiscal";
  invoiceId?: string;
  readonly createdAt: Date;
  private _updatedAt: Date;
  private _onTransition?: (order: Order) => void;

  constructor(data: OrderData) {
    this.id = data.id;
    this.tableId = data.tableId;
    this.items = data.items;
    this.totals = data.totals;
    this.invoiceType = data.invoiceType;
    this.invoiceId = data.invoiceId;
    this.createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._state = createStateFromStatus(data.status);
  }

  /** Hook que se llama en cada transición de estado */
  onTransition(callback: (order: Order) => void): void {
    this._onTransition = callback;
  }

  /** Llamado internamente por los estados concretos */
  transitionTo(newState: IOrderState): void {
    this._state = newState;
    this._updatedAt = new Date();
    this._onTransition?.(this);
  }

  pay(): void {
    this._state.pay(this);
  }
  sendToKitchen(): void {
    this._state.sendToKitchen(this);
  }
  deliver(): void {
    this._state.deliver(this);
  }
  cancel(): void {
    this._state.cancel(this);
  }

  get status(): OrderStatus {
    return this._state.status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  toJSON(): OrderData {
    return {
      id: this.id,
      tableId: this.tableId,
      status: this.status,
      items: this.items,
      totals: this.totals,
      invoiceType: this.invoiceType,
      invoiceId: this.invoiceId,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
