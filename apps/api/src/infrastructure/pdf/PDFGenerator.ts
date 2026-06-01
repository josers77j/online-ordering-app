import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "node:fs";
import path from "node:path";
import {
  InvoiceDocument,
  ConsumerInvoiceData,
  CreditFiscalInvoiceData,
} from "../../domain/Invoice";

const PDF_OUTPUT_DIR = path.resolve(__dirname, "../../../data/pdfs");

function ensureOutputDir(): void {
  if (!fs.existsSync(PDF_OUTPUT_DIR)) {
    fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString("es-SV", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/El_Salvador",
  });
}

async function generateQRBuffer(text: string): Promise<Buffer> {
  return await QRCode.toBuffer(text, {
    errorCorrectionLevel: "M",
    width: 120,
    margin: 1,
  });
}

export class PDFGenerator {
  async generate(invoice: InvoiceDocument): Promise<string> {
    ensureOutputDir();

    const filename = `${invoice.type}_${invoice.invoiceNumber}_${invoice.orderId.slice(0, 8)}.pdf`;
    const outputPath = path.join(PDF_OUTPUT_DIR, filename);

    const qrBuffer = await generateQRBuffer(invoice.selloHash);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#1a1a2e")
        .text("🍽  RESTAURANTE QR", { align: "center" });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#555")
        .text("NIT: 0614-190185-101-3 | NRC: 123456-7", { align: "center" })
        .text("Colonia Escalón, San Salvador, El Salvador", { align: "center" })
        .moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#dee2e6")
        .stroke()
        .moveDown(0.5);

      const typeLabel =
        invoice.type === "consumer"
          ? "FACTURA DE CONSUMIDOR FINAL"
          : "COMPROBANTE DE CRÉDITO FISCAL";

      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor("#e63946")
        .text(typeLabel, { align: "center" })
        .moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#555")
        .text(`N° Comprobante: ${invoice.invoiceNumber}`, { align: "center" })
        .text(`Fecha de emisión: ${formatDate(invoice.issuedAt)}`, {
          align: "center",
        })
        .text(`Mesa de origen: ${invoice.tableId}`, { align: "center" })
        .moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#dee2e6")
        .stroke()
        .moveDown(0.5);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1a1a2e")
        .text("DATOS DEL RECEPTOR")
        .moveDown(0.3);

      doc.font("Helvetica").fontSize(10).fillColor("#333");

      if (invoice.type === "consumer") {
        const c = invoice as ConsumerInvoiceData;
        doc
          .text(`Nombre: ${c.fullName}`)
          .text(`${c.documentType}: ${c.documentId}`);
      } else {
        const cf = invoice as CreditFiscalInvoiceData;
        doc
          .text(`Razón Social: ${cf.businessName}`)
          .text(`NIT: ${cf.nit}`)
          .text(`NRC: ${cf.nrc}`)
          .text(`Gran Contribuyente: ${cf.isGranContribuyente ? "Sí" : "No"}`);
      }

      doc.moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#dee2e6")
        .stroke()
        .moveDown(0.5);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1a1a2e")
        .text("DETALLE DE PRODUCTOS")
        .moveDown(0.3);

      const colDesc = 50,
        colQty = 310,
        colUnit = 370,
        colTotal = 460;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#555")
        .text("Descripción", colDesc, doc.y)
        .text("Cant.", colQty, doc.y - doc.currentLineHeight())
        .text("P. Unit.", colUnit, doc.y - doc.currentLineHeight())
        .text("Subtotal", colTotal, doc.y - doc.currentLineHeight())
        .moveDown(0.2);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#dee2e6")
        .stroke()
        .moveDown(0.2);

      doc.font("Helvetica").fontSize(9).fillColor("#333");

      for (const item of invoice.totals.discountResults !== undefined
        ? ((invoice as any)._items ?? [])
        : []) {
      }

      const items =
        ((invoice as any).items as Array<{
          productName: string;
          quantity: number;
          unitPrice: number;
        }>) ?? [];

      for (const item of items) {
        const lineTotal = item.unitPrice * item.quantity;
        const y = doc.y;
        doc
          .text(item.productName, colDesc, y, { width: 250 })
          .text(String(item.quantity), colQty, y)
          .text(formatCents(item.unitPrice), colUnit, y)
          .text(formatCents(lineTotal), colTotal, y)
          .moveDown(0.15);
      }

      doc.moveDown(0.3);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#dee2e6")
        .stroke()
        .moveDown(0.3);

      const { totals } = invoice;
      const taxX = 370;

      const taxLine = (
        label: string,
        value: number,
        bold = false,
        color = "#333",
      ) => {
        const y = doc.y;
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(10)
          .fillColor(color)
          .text(label, taxX, y)
          .text(formatCents(value), 460, y)
          .moveDown(0.2);
      };

      taxLine("Subtotal bruto:", totals.subtotalCents);

      for (const dr of totals.discountResults) {
        if (dr.amountCents > 0) {
          taxLine(`  - ${dr.label}:`, -dr.amountCents, false, "#e63946");
        }
      }

      if (totals.totalDiscountCents > 0) {
        taxLine("Neto (tras descuentos):", totals.netCents, true);
      }

      if (totals.specialTaxCents > 0) {
        taxLine("Impuesto especial (5%):", totals.specialTaxCents);
      }

      taxLine("IVA (13%):", totals.ivaCents);

      if (totals.retentionCents > 0) {
        taxLine(
          "Retención IVA (1%):",
          -totals.retentionCents,
          false,
          "#e63946",
        );
      }

      doc
        .moveTo(taxX, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#1a1a2e")
        .stroke()
        .moveDown(0.2);

      taxLine("TOTAL A PAGAR:", totals.grandTotalCents, true, "#1a1a2e");

      doc.moveDown(1);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#dee2e6")
        .stroke()
        .moveDown(0.5);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#1a1a2e")
        .text("SELLO DE RECEPCIÓN DIGITAL", { align: "center" })
        .moveDown(0.3);

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#555")
        .text(invoice.selloHash, { align: "center", characterSpacing: 1 })
        .moveDown(0.5);

      const qrX = (doc.page.width - 120) / 2;
      doc.image(qrBuffer, qrX, doc.y, { width: 120 });
      doc.moveDown(5);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#aaa")
        .text(
          "Documento generado electrónicamente. Válido sin firma autógrafa.",
          { align: "center" },
        );

      doc.end();

      stream.on("finish", () => resolve(outputPath));
      stream.on("error", reject);
    });
  }
}
