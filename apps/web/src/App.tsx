import { Routes, Route, useSearchParams, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AdminProvider } from './context/AdminContext'
import MenuPage from './pages/MenuPage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'


function MenuRoute() {
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table');

  if (!tableId) {
    return <Navigate to="/error" replace />;
  }

  return (
    <CartProvider>
      <MenuPage tableId={tableId} />
    </CartProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<MenuRoute />} />
      <Route path="/admin" element={
        <AdminProvider>
          <AdminPage />
        </AdminProvider>
      } />
      <Route path="/error" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/error" replace />} />
    </Routes>
  )
}

export default App
