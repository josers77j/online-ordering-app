import crypto from "node:crypto";
import { InvoiceDocument } from "../../domain/Invoice";

export interface HaciendaResponse {
  success: boolean;
  selloHash: string;
  numeroControl: string;
  codigoGeneracion: string;
  fechaHoraProcesamiento: string;
  mensaje: string;
}

const MIN_LATENCY_MS = 2000;
const MAX_LATENCY_MS = 5000;
const FAILURE_RATE = 0.15;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

function randomDelay(): Promise<void> {
  const ms = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFail(): boolean {
  return Math.random() < FAILURE_RATE;
}

function generateSelloHash(invoice: InvoiceDocument): string {
  const payload = JSON.stringify({
    type: invoice.type,
    orderId: invoice.orderId,
    issuedAt: invoice.issuedAt,
    grandTotal: invoice.totals.grandTotalCents,
    nonce: crypto.randomBytes(8).toString("hex"),
  });
  return crypto
    .createHash("sha256")
    .update(payload)
    .digest("hex")
    .toUpperCase();
}

function generateNumeroControl(): string {
  const seq = String(Math.floor(Math.random() * 1_000_000_000_000)).padStart(
    15,
    "0",
  );
  return `DTE-01-CENTROF01-${seq}`;
}

function generateCodigoGeneracion(): string {
  return crypto.randomUUID().replaceAll("-", "").toUpperCase();
}

async function callHaciendaOnce(
  invoice: InvoiceDocument,
): Promise<HaciendaResponse> {
  await randomDelay();

  if (shouldFail()) {
    throw new Error(
      "HACIENDA_TIMEOUT: El servicio del Ministerio de Hacienda no respondió",
    );
  }

  const selloHash = generateSelloHash(invoice);
  const now = new Date().toISOString();

  return {
    success: true,
    selloHash,
    numeroControl: generateNumeroControl(),
    codigoGeneracion: generateCodigoGeneracion(),
    fechaHoraProcesamiento: now,
    mensaje: "Documento tributario electrónico procesado exitosamente",
  };
}

export class HaciendaAdapter {
  async submitInvoice(invoice: InvoiceDocument): Promise<HaciendaResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[Hacienda] Attempt ${attempt}/${MAX_RETRIES} for order ${invoice.orderId}`,
        );
        const response = await callHaciendaOnce(invoice);
        console.log(
          `[Hacienda] Success on attempt ${attempt} — sello: ${response.selloHash.slice(0, 16)}...`,
        );
        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[Hacienda] Attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < MAX_RETRIES) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          console.log(`[Hacienda] Retrying in ${backoff}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw new Error(
      `[Hacienda] All ${MAX_RETRIES} attempts failed. Last error: ${lastError?.message}`,
    );
  }
}
