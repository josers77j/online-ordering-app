# Sistema Web de Pedidos QR y Facturación Electrónica

Sistema de gestión de pedidos para restaurantes vía escaneo QR con facturación electrónica simulada, dashboard en tiempo real y generación de comprobantes PDF.

## 📋 Requisitos

- **Node.js**: v22.x+
- **pnpm**: v9.x+ (`npm install -g pnpm`)

## 🚀 Instalación y uso

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Iniciar Backend (Terminal 1)

```bash
pnpm dev:api
```

Servidor disponible en: `http://localhost:3001`

### 3. Iniciar Frontend (Terminal 2)

```bash
pnpm dev:web
```

Aplicación disponible en: `http://localhost:5173`

## 🌐 Rutas de acceso

- **Menú de cliente**: `http://localhost:5173/?table=1`
  - Reemplaza `1` con el número de mesa
  - El parámetro `?table=X` es obligatorio

- **Panel admin**: `http://localhost:5173/admin`
  - Visualización de órdenes en tiempo real
  - Control de inventario
  - Métricas financieras

- **Health check**: `GET http://localhost:3001/api/health`

## 🗄️ Base de datos

- **Motor**: SQLite3 (better-sqlite3)
- **Ubicación**: `apps/api/data/orders.db`
- **Tablas**: products, orders, invoices
# online-ordering-app
