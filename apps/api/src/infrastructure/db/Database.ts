import Database from "better-sqlite3";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.resolve(__dirname, "../../data/orders.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require("node:fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    seedIfEmpty(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL,
      price         INTEGER NOT NULL,  -- en centavos
      category      TEXT NOT NULL,
      image_url     TEXT DEFAULT '',
      stock         INTEGER NOT NULL DEFAULT 50,
      special_tax   REAL NOT NULL DEFAULT 0.0,
      is_available  INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id            TEXT PRIMARY KEY,
      table_id      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'CREATED',
      items_json    TEXT NOT NULL,  -- JSON serializado de CartItem[]
      totals_json   TEXT NOT NULL,  -- JSON serializado de CartTotals
      invoice_type  TEXT,
      invoice_id    TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id            TEXT PRIMARY KEY,
      order_id      TEXT NOT NULL REFERENCES orders(id),
      type          TEXT NOT NULL,  -- 'consumer' | 'credit_fiscal'
      document_json TEXT NOT NULL,  -- JSON del documento fiscal completo
      sello_hash    TEXT NOT NULL,
      pdf_path      TEXT,
      issued_at     TEXT NOT NULL
    );
  `);
}

function seedIfEmpty(db: Database.Database): void {
  const count = (
    db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }
  ).c;
  if (count > 0) return;

  const products = [
    {
      id: uuidv4(),
      name: "Ceviche Clásico",
      description:
        "Camarón fresco marinado en limón con tomate, cebolla y cilantro",
      price: 850,
      category: "entradas",
      stock: 20,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Alitas BBQ",
      description: "12 alitas crujientes con salsa BBQ ahumada y aderezo ranch",
      price: 950,
      category: "entradas",
      stock: 15,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Lomo Saltado",
      description:
        "Lomo de res salteado con papas fritas, cebolla y tomate en salsa de soya",
      price: 1450,
      category: "platos_principales",
      stock: 10,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Pollo a la Plancha",
      description: "Pechuga de pollo a la plancha con arroz y ensalada fresca",
      price: 1200,
      category: "platos_principales",
      stock: 12,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Pasta Carbonara",
      description: "Fettuccine con tocino, huevo, parmesano y pimienta negra",
      price: 1100,
      category: "platos_principales",
      stock: 8,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Agua Natural",
      description: "Agua purificada 500ml",
      price: 150,
      category: "bebidas",
      stock: 50,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Limonada Natural",
      description: "Limonada fresca con hierbabuena",
      price: 300,
      category: "bebidas",
      stock: 30,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Refresco",
      description: "Coca-Cola, Pepsi o Sprite",
      price: 200,
      category: "bebidas",
      stock: 40,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Cerveza Artesanal",
      description: "Cerveza artesanal IPA 355ml",
      price: 450,
      category: "alcoholicas",
      stock: 25,
      special_tax: 0.05,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Vino de la Casa",
      description: "Copa de vino tinto o blanco",
      price: 600,
      category: "alcoholicas",
      stock: 20,
      special_tax: 0.05,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Tiramisú",
      description: "Clásico tiramisú italiano con café y mascarpone",
      price: 500,
      category: "postres",
      stock: 10,
      special_tax: 0,
      image_url: "",
    },
    {
      id: uuidv4(),
      name: "Brownie con Helado",
      description:
        "Brownie de chocolate caliente con bola de helado de vainilla",
      price: 450,
      category: "postres",
      stock: 15,
      special_tax: 0,
      image_url: "",
    },
  ];

  const insert = db.prepare(`
    INSERT INTO products (id, name, description, price, category, image_url, stock, special_tax, is_available)
    VALUES (@id, @name, @description, @price, @category, @image_url, @stock, @special_tax, 1)
  `);

  const insertMany = db.transaction((items: typeof products) => {
    for (const item of items) insert.run(item);
  });

  insertMany(products);
  console.log(`[DB] Seeded ${products.length} products`);
}

export const ProductQueries = {
  findAll: () => getDb().prepare("SELECT * FROM products").all(),

  findById: (id: string) =>
    getDb().prepare("SELECT * FROM products WHERE id = ?").get(id),

  updateStock: (id: string, stock: number) =>
    getDb()
      .prepare("UPDATE products SET stock = ?, is_available = ? WHERE id = ?")
      .run(stock, stock > 0 ? 1 : 0, id),

  updateAvailability: (id: string, available: boolean) =>
    getDb()
      .prepare("UPDATE products SET is_available = ? WHERE id = ?")
      .run(available ? 1 : 0, id),

  /** Decrementa stock atómicamente — previene race conditions */
  reserveStock: (id: string, quantity: number) => {
    const stmt = getDb().prepare(`
      UPDATE products
      SET stock = stock - ?,
          is_available = CASE WHEN stock - ? <= 0 THEN 0 ELSE 1 END
      WHERE id = ? AND stock >= ?
    `);
    const result = stmt.run(quantity, quantity, id, quantity);
    return result.changes > 0;
  },
};

export const OrderQueries = {
  create: (data: {
    id: string;
    tableId: string;
    itemsJson: string;
    totalsJson: string;
    createdAt: string;
    updatedAt: string;
  }) =>
    getDb()
      .prepare(
        `
      INSERT INTO orders (id, table_id, status, items_json, totals_json, created_at, updated_at)
      VALUES (@id, @tableId, 'CREATED', @itemsJson, @totalsJson, @createdAt, @updatedAt)
    `,
      )
      .run(data),

  findById: (id: string) =>
    getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id),

  findByTable: (tableId: string) =>
    getDb()
      .prepare(
        "SELECT * FROM orders WHERE table_id = ? ORDER BY created_at DESC",
      )
      .all(tableId),

  findAll: () =>
    getDb().prepare("SELECT * FROM orders ORDER BY created_at DESC").all(),

  updateStatus: (id: string, status: string, updatedAt: string) =>
    getDb()
      .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, updatedAt, id),

  updateInvoice: (id: string, invoiceType: string, invoiceId: string) =>
    getDb()
      .prepare(
        "UPDATE orders SET invoice_type = ?, invoice_id = ? WHERE id = ?",
      )
      .run(invoiceType, invoiceId, id),
};

export const InvoiceQueries = {
  create: (data: {
    id: string;
    orderId: string;
    type: string;
    documentJson: string;
    selloHash: string;
    pdfPath: string;
    issuedAt: string;
  }) =>
    getDb()
      .prepare(
        `
      INSERT INTO invoices (id, order_id, type, document_json, sello_hash, pdf_path, issued_at)
      VALUES (@id, @orderId, @type, @documentJson, @selloHash, @pdfPath, @issuedAt)
    `,
      )
      .run(data),

  findById: (id: string) =>
    getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(id),

  findByOrderId: (orderId: string) =>
    getDb().prepare("SELECT * FROM invoices WHERE order_id = ?").get(orderId),
};

export const DashboardQueries = {
  getMetrics: () => {
    const db = getDb();
    return {
      totalOrders: (
        db
          .prepare(
            `SELECT COUNT(*) as c FROM orders WHERE status != 'CANCELLED'`,
          )
          .get() as { c: number }
      ).c,
      paidOrders: (
        db
          .prepare(
            `SELECT COUNT(*) as c FROM orders WHERE status IN ('PAID','IN_KITCHEN','DELIVERED')`,
          )
          .get() as { c: number }
      ).c,
      totalsByType: db
        .prepare(
          `
        SELECT invoice_type, COUNT(*) as count
        FROM orders WHERE invoice_type IS NOT NULL
        GROUP BY invoice_type
      `,
        )
        .all(),
      allPaidTotals: db
        .prepare(
          `
        SELECT totals_json FROM orders
        WHERE status IN ('PAID','IN_KITCHEN','DELIVERED')
      `,
        )
        .all() as Array<{ totals_json: string }>,
    };
  },
};
