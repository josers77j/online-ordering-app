import React from 'react';

export default function NotFoundPage() {
  return (
    <div className="error-page">
      <div className="error-page__icon">🍽️</div>
      <h1 className="error-page__title">Acceso Denegado</h1>
      <p className="error-page__msg">
        Para ver el menú y realizar tu pedido, por favor escanea el código QR que se encuentra en tu mesa.
      </p>
    </div>
  );
}
