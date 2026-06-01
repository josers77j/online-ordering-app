




export type ProductCategory =
  | 'entradas'
  | 'platos_principales'
  | 'bebidas'
  | 'postres'
  | 'alcoholicas';

export interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;        
  category: ProductCategory;
  imageUrl?: string;
  stock: number;
  specialTaxRate: number; 
  isAvailable: boolean;
}

export class Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly category: ProductCategory;
  readonly imageUrl: string;
  private _stock: number;
  readonly specialTaxRate: number;
  private _isAvailable: boolean;

  constructor(data: ProductData) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = data.price;
    this.category = data.category;
    this.imageUrl = data.imageUrl ?? '';
    this._stock = data.stock;
    this.specialTaxRate = data.specialTaxRate;
    this._isAvailable = data.isAvailable;
  }

  get stock(): number {
    return this._stock;
  }

  get isAvailable(): boolean {
    return this._isAvailable && this._stock > 0;
  }

  /**
   * Reserva unidades del inventario.
   * Lanza error si no hay stock suficiente (prevención race condition).
   */
  reserve(quantity: number): void {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (this._stock < quantity) {
      throw new Error(
        `Insufficient stock for product "${this.name}": requested ${quantity}, available ${this._stock}`
      );
    }
    this._stock -= quantity;
    if (this._stock === 0) {
      this._isAvailable = false;
    }
  }

  /**
   * Devuelve unidades al inventario (ej. orden cancelada).
   */
  restock(quantity: number): void {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    this._stock += quantity;
    this._isAvailable = true;
  }

  setAvailability(available: boolean): void {
    this._isAvailable = available;
  }

  /** Precio en unidades de moneda (dólares), no centavos */
  get priceInDollars(): number {
    return this.price / 100;
  }

  toJSON(): ProductData {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      category: this.category,
      imageUrl: this.imageUrl,
      stock: this._stock,
      specialTaxRate: this.specialTaxRate,
      isAvailable: this._isAvailable,
    };
  }
}
