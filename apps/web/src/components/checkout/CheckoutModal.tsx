import React, { useState, useMemo } from "react";
import { useCart } from "../../context/CartContext";
import {
  DUIFormatter,
  NITFormatter,
  ExpiryFormatter,
  CVCFormatter,
  CardNumberFormatter,
} from "../../core/Formatters";
import { validationService } from "../../core/Validators";

import { LuhnValidator } from "../../core/LuhnValidator";
import { API_BASE } from "../../config/env";

const baseUrl = API_BASE ?? "http://localhost:3001";

export default function CheckoutModal({
  tableId,
  onClose,
  onSuccess,
}: Readonly<{
  tableId: string;
  onClose: () => void;
  onSuccess: () => void;
}>) {
  const { cart, totals } = useCart();

  const [step, setStep] = useState(1);

  const [invoiceType, setInvoiceType] = useState<"consumer" | "credit_fiscal">(
    "consumer",
  );
  const [formData, setFormData] = useState({
    fullName: "",
    documentId: "",
    businessName: "",
    nit: "",
    nrc: "",
    isGranContribuyente: false,
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [cardError, setCardError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [checkoutResult, setCheckoutResult] = useState<{
    selloHash: string;
    pdfUrl: string;
  } | null>(null);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleDUIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = DUIFormatter.format(e.target.value);
    setFormData((prev) => ({ ...prev, documentId: formatted }));

    if (formatted.length > 0) {
      setFormErrors((prev) => ({ ...prev, documentId: "" }));
    }
  };

  const handleNITChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = NITFormatter.format(e.target.value);
    setFormData((prev) => ({ ...prev, nit: formatted }));
    if (formatted.length > 0) {
      setFormErrors((prev) => ({ ...prev, nit: "" }));
    }
  };

  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = CardNumberFormatter.format(e.target.value);
    setFormData((prev) => ({ ...prev, cardNumber: formatted }));

    const raw = formatted.replace(/\s/g, "");
    if (raw.length >= 13) {
      if (!LuhnValidator.isValid(raw)) {
        setCardError("Número de tarjeta inválido (Luhn check falló)");
      } else {
        setCardError("");
      }
    } else {
      setCardError("");
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = ExpiryFormatter.format(e.target.value);
    setFormData((prev) => ({ ...prev, expiry: formatted }));
    if (formatted.length > 0) {
      setFormErrors((prev) => ({ ...prev, expiry: "" }));
    }
  };

  const handleCVCChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = CVCFormatter.format(e.target.value);
    setFormData((prev) => ({ ...prev, cvc: formatted }));
    if (formatted.length > 0) {
      setFormErrors((prev) => ({ ...prev, cvc: "" }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (invoiceType === "consumer") {
      const consumerErrors = validationService.validateConsumerForm(
        formData.fullName,
        formData.documentId,
      );
      Object.assign(errors, consumerErrors);
    } else {
      const fiscalErrors = validationService.validateCreditFiscalForm(
        formData.businessName,
        formData.nit,
        formData.nrc,
      );
      Object.assign(errors, fiscalErrors);
    }

    const paymentErrors = validationService.validatePaymentForm(
      formData.expiry,
      formData.cvc,
    );
    Object.assign(errors, paymentErrors);

    const rawCard = formData.cardNumber.replace(/\s/g, "");
    if (!LuhnValidator.isValid(rawCard)) {
      errors.cardNumber = "Tarjeta inválida";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProcessCheckout = async () => {
    if (!validateForm()) return;

    setStep(3);
    setGeneralError("");

    try {
      const orderPayload = cart.toOrderPayload(tableId);
      const orderRes = await fetch(`${baseUrl}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || "Error al crear la orden");
      }

      const orderData = await orderRes.json();

      const checkoutPayload = {
        orderId: orderData.id,
        invoiceType,
        discountStrategies: orderPayload.discountStrategies,
        ...formData,
      };

      const checkoutRes = await fetch(`${baseUrl}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        throw new Error(err.error || "Fallo en la facturación electrónica");
      }

      const result = await checkoutRes.json();
      setCheckoutResult(result);
      setStep(4);
    } catch (err: any) {
      setGeneralError(err.message);
      setStep(2);
    }
  };

  const isGC = invoiceType === "credit_fiscal" && formData.isGranContribuyente;
  const displayTotals = cart.calculateTotals(isGC);

  const isPaymentValid = useMemo(() => {
    const rawCard = formData.cardNumber.replace(/\s/g, "");
    return rawCard.length >= 13 && !cardError;
  }, [formData.cardNumber, cardError]);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">Completar Pago</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={step === 3}
          >
            ✕
          </button>
        </div>

        <div className="modal__body">
          {generalError && (
            <div
              className="toast toast-error"
              style={{
                position: "relative",
                bottom: "auto",
                right: "auto",
                marginBottom: "1rem",
                width: "100%",
                maxWidth: "100%",
              }}
            >
              ⚠️ {generalError}
            </div>
          )}

          {step === 1 && (
            <>
              <p
                style={{ color: "var(--clr-muted)", fontSize: "var(--fs-sm)" }}
              >
                Selecciona el tipo de documento fiscal que necesitas:
              </p>
              <div className="invoice-type-grid">
                <div
                  className={`invoice-type-card ${invoiceType === "consumer" ? "selected" : ""}`}
                  onClick={() => setInvoiceType("consumer")}
                >
                  <div className="invoice-type-card__icon">📄</div>
                  <div className="invoice-type-card__title">
                    Consumidor Final
                  </div>
                  <div className="invoice-type-card__desc">
                    Factura estándar
                  </div>
                </div>
                <div
                  className={`invoice-type-card ${invoiceType === "credit_fiscal" ? "selected" : ""}`}
                  onClick={() => setInvoiceType("credit_fiscal")}
                >
                  <div className="invoice-type-card__icon">🏢</div>
                  <div className="invoice-type-card__title">Crédito Fiscal</div>
                  <div className="invoice-type-card__desc">
                    Para empresas (NIT/NRC)
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
              }}
            >
              {/* Datos de Facturación */}
              <div>
                <h3
                  style={{
                    fontSize: "var(--fs-sm)",
                    textTransform: "uppercase",
                    color: "var(--clr-accent)",
                    marginBottom: "1rem",
                  }}
                >
                  Datos Fiscales
                </h3>

                {invoiceType === "consumer" ? (
                  <div className="form-group">
                    <div
                      className={formErrors.fullName ? "form-field-error" : ""}
                    >
                      <input
                        className="form-input"
                        placeholder="Nombre Completo"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                      />
                      {formErrors.fullName && (
                        <span className="form-error">
                          {formErrors.fullName}
                        </span>
                      )}
                    </div>
                    <div
                      className={
                        formErrors.documentId ? "form-field-error" : ""
                      }
                    >
                      <input
                        className="form-input"
                        placeholder="DUI (ej. 12345678-9)"
                        value={formData.documentId}
                        onChange={handleDUIChange}
                      />
                      {formErrors.documentId && (
                        <span className="form-error">
                          {formErrors.documentId}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      className={
                        formErrors.businessName ? "form-field-error" : ""
                      }
                    >
                      <input
                        className="form-input"
                        placeholder="Razón Social"
                        value={formData.businessName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            businessName: e.target.value,
                          })
                        }
                      />
                      {formErrors.businessName && (
                        <span className="form-error">
                          {formErrors.businessName}
                        </span>
                      )}
                    </div>
                    <div className={formErrors.nit ? "form-field-error" : ""}>
                      <input
                        className="form-input"
                        placeholder="NIT (ej. 0614-123456-123-1)"
                        value={formData.nit}
                        onChange={handleNITChange}
                      />
                      {formErrors.nit && (
                        <span className="form-error">{formErrors.nit}</span>
                      )}
                    </div>
                    <div className={formErrors.nrc ? "form-field-error" : ""}>
                      <input
                        className="form-input"
                        placeholder="NRC"
                        value={formData.nrc}
                        onChange={(e) =>
                          setFormData({ ...formData, nrc: e.target.value })
                        }
                      />
                      {formErrors.nrc && (
                        <span className="form-error">{formErrors.nrc}</span>
                      )}
                    </div>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "var(--fs-sm)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.isGranContribuyente}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isGranContribuyente: e.target.checked,
                          })
                        }
                      />
                      Soy Gran Contribuyente (Aplica 1% Retención)
                    </label>
                  </div>
                )}
              </div>

              {/* Cascada de Impuestos Dinámica */}
              <div
                className="card"
                style={{ padding: "1rem", background: "var(--clr-surface)" }}
              >
                <div className="totals-row">
                  <span>Subtotal:</span>{" "}
                  <span>{formatPrice(displayTotals.subtotalCents)}</span>
                </div>
                {displayTotals.discountResults.length > 0 && (
                  <>
                    {displayTotals.discountResults.map(
                      (dr, i) =>
                        dr.amountCents > 0 && (
                          <div key={i} className="totals-row discount">
                            <span>{dr.label}:</span>{" "}
                            <span>-{formatPrice(dr.amountCents)}</span>
                          </div>
                        ),
                    )}
                    <div className="totals-row">
                      <span>Neto (tras descuentos):</span>{" "}
                      <span>{formatPrice(displayTotals.netCents)}</span>
                    </div>
                  </>
                )}
                {displayTotals.specialTaxCents > 0 && (
                  <div className="totals-row">
                    <span>Impuestos Especiales:</span>{" "}
                    <span>{formatPrice(displayTotals.specialTaxCents)}</span>
                  </div>
                )}
                <div className="totals-row">
                  <span>IVA (13%):</span>{" "}
                  <span>{formatPrice(displayTotals.ivaCents)}</span>
                </div>
                {displayTotals.retentionCents > 0 && (
                  <div className="totals-row discount">
                    <span>Retención IVA (1%):</span>{" "}
                    <span>-{formatPrice(displayTotals.retentionCents)}</span>
                  </div>
                )}
                <div className="totals-row total">
                  <span>TOTAL A PAGAR:</span>{" "}
                  <span>{formatPrice(displayTotals.grandTotalCents)}</span>
                </div>
              </div>

              {/* Pago (Tarjeta) */}
              <div>
                <h3
                  style={{
                    fontSize: "var(--fs-sm)",
                    textTransform: "uppercase",
                    color: "var(--clr-accent)",
                    marginBottom: "1rem",
                  }}
                >
                  Datos de Pago
                </h3>
                <div className="form-group">
                  <div
                    className={`card-input-wrapper ${cardError ? "card-invalid" : formData.cardNumber.replace(/\s/g, "").length >= 13 ? "card-valid" : ""}`}
                  >
                    <input
                      className={`form-input ${cardError ? "error" : ""}`}
                      placeholder="Número de Tarjeta"
                      value={formData.cardNumber}
                      onChange={handleCardChange}
                      maxLength={19}
                    />
                    <span className="card-input-type">
                      {LuhnValidator.detectType(formData.cardNumber)}
                    </span>
                  </div>
                  {cardError && <span className="form-error">{cardError}</span>}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "1rem",
                    }}
                  >
                    <div
                      className={formErrors.expiry ? "form-field-error" : ""}
                    >
                      <input
                        className="form-input"
                        placeholder="MM/YY"
                        value={formData.expiry}
                        onChange={handleExpiryChange}
                        maxLength={5}
                      />
                      {formErrors.expiry && (
                        <span className="form-error">{formErrors.expiry}</span>
                      )}
                    </div>
                    <div className={formErrors.cvc ? "form-field-error" : ""}>
                      <input
                        className="form-input"
                        placeholder="CVC"
                        type="password"
                        value={formData.cvc}
                        onChange={handleCVCChange}
                        maxLength={4}
                      />
                      {formErrors.cvc && (
                        <span className="form-error">{formErrors.cvc}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="hacienda-progress">
              <div className="hacienda-progress__spinner" />
              <div className="hacienda-progress__title">
                Procesando Pago y DTE
              </div>
              <div className="hacienda-progress__sub">
                Conectando con el Ministerio de Hacienda...
                <br />
                Generando Sello de Recepción.
              </div>
            </div>
          )}

          {step === 4 && checkoutResult && (
            <div className="success-screen">
              <div className="success-screen__icon">✓</div>
              <div className="success-screen__title">¡Pago Exitoso!</div>
              <p style={{ color: "var(--clr-text)" }}>
                Tu orden ha sido enviada a cocina.
              </p>

              <div
                style={{ width: "100%", textAlign: "left", marginTop: "1rem" }}
              >
                <div
                  style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--clr-muted)",
                    marginBottom: "4px",
                  }}
                >
                  Sello de Recepción Hacienda:
                </div>
                <div className="success-screen__sello">
                  {checkoutResult.selloHash}
                </div>
              </div>

              {checkoutResult.pdfUrl && (
                <a
                  href={`http://localhost:3001${checkoutResult.pdfUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-full btn-lg"
                  style={{ marginTop: "1rem" }}
                >
                  📄 Descargar Factura PDF
                </a>
              )}
            </div>
          )}
        </div>

        {step < 3 && (
          <div className="modal__footer">
            {step === 1 ? (
              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={() => setStep(2)}
              >
                Continuar
              </button>
            ) : (
              <button
                className="btn btn-primary btn-full btn-lg"
                onClick={handleProcessCheckout}
                disabled={!isPaymentValid}
              >
                Pagar {formatPrice(displayTotals.grandTotalCents)}
              </button>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="modal__footer">
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={onSuccess}
            >
              Volver al Menú
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
