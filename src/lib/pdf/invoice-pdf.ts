import PDFDocument from "pdfkit";

interface LineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

interface InvoiceData {
  invoiceNumber: string;
  title: string;
  description: string | null;
  status: string;
  subtotal: number | string;
  tax: number | string;
  taxRate: number | string;
  total: number | string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
  customer: {
    name: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    billingAddress: string | null;
  };
  site: {
    name: string;
    address: string | null;
  } | null;
  workOrder: {
    workOrderNumber: string | null;
    title: string;
  } | null;
  lineItems: LineItem[];
  orgName: string;
}

export async function generateInvoicePDF(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 50,
        bufferPages: true
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Colors
      const primaryColor = "#3b82f6";
      const textColor = "#111827";
      const mutedColor = "#6b7280";
      const borderColor = "#e5e7eb";

      // Header - Company Info
      doc.fontSize(24).fillColor(primaryColor).text(invoice.orgName, 50, 50);
      doc.fontSize(10).fillColor(mutedColor).text("Invoice", 50, 80);

      // Invoice Number & Status (right aligned)
      doc.fontSize(28).fillColor(textColor).text(invoice.invoiceNumber, 400, 50, { align: "right" });

      const statusColors: Record<string, string> = {
        DRAFT: "#6b7280",
        SENT: "#3b82f6",
        PAID: "#10b981",
        OVERDUE: "#ef4444",
        CANCELED: "#9ca3af",
      };
      const statusColor = statusColors[invoice.status] || "#6b7280";
      doc.fontSize(12).fillColor(statusColor).text(invoice.status, 400, 85, { align: "right" });

      // Divider
      doc.moveTo(50, 110).lineTo(562, 110).strokeColor(borderColor).stroke();

      // Bill To section
      let yPos = 130;
      doc.fontSize(10).fillColor(mutedColor).text("BILL TO", 50, yPos);
      yPos += 15;
      doc.fontSize(12).fillColor(textColor).text(invoice.customer.name, 50, yPos);
      yPos += 15;
      if (invoice.customer.primaryEmail) {
        doc.fontSize(10).fillColor(mutedColor).text(invoice.customer.primaryEmail, 50, yPos);
        yPos += 12;
      }
      if (invoice.customer.primaryPhone) {
        doc.fontSize(10).fillColor(mutedColor).text(invoice.customer.primaryPhone, 50, yPos);
        yPos += 12;
      }
      if (invoice.customer.billingAddress) {
        doc.fontSize(10).fillColor(mutedColor).text(invoice.customer.billingAddress, 50, yPos, { width: 200 });
        yPos += 12;
      }

      // Invoice Details (right side)
      let rightY = 130;
      doc.fontSize(10).fillColor(mutedColor).text("INVOICE DETAILS", 350, rightY, { align: "right", width: 212 });
      rightY += 15;

      doc.fontSize(10).fillColor(mutedColor).text("Date:", 350, rightY);
      doc.fillColor(textColor).text(new Date(invoice.createdAt).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
      rightY += 15;

      if (invoice.dueDate) {
        doc.fillColor(mutedColor).text("Due Date:", 350, rightY);
        doc.fillColor(textColor).text(new Date(invoice.dueDate).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
        rightY += 15;
      }

      if (invoice.paidAt) {
        doc.fillColor(mutedColor).text("Paid:", 350, rightY);
        doc.fillColor("#10b981").text(new Date(invoice.paidAt).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
        rightY += 15;
      }

      if (invoice.workOrder) {
        doc.fillColor(mutedColor).text("Work Order:", 350, rightY);
        doc.fillColor(textColor).text(invoice.workOrder.workOrderNumber || invoice.workOrder.title, 450, rightY, { align: "right", width: 112 });
        rightY += 15;
      }

      // Title and Description
      yPos = Math.max(yPos, rightY) + 20;
      doc.fontSize(14).fillColor(textColor).text(invoice.title, 50, yPos);
      yPos += 20;
      if (invoice.description) {
        doc.fontSize(10).fillColor(mutedColor).text(invoice.description, 50, yPos, { width: 512 });
        yPos += 20;
      }

      // Line Items Table
      yPos += 10;

      // Table Header
      doc.rect(50, yPos, 512, 25).fill("#f9fafb");
      doc.fontSize(9).fillColor(mutedColor);
      doc.text("DESCRIPTION", 55, yPos + 8, { width: 250 });
      doc.text("TYPE", 310, yPos + 8, { width: 60 });
      doc.text("QTY", 375, yPos + 8, { width: 40, align: "right" });
      doc.text("RATE", 420, yPos + 8, { width: 60, align: "right" });
      doc.text("AMOUNT", 485, yPos + 8, { width: 72, align: "right" });
      yPos += 25;

      // Table Rows
      for (const item of invoice.lineItems) {
        if (yPos > 680) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(10).fillColor(textColor);
        doc.text(item.description, 55, yPos + 5, { width: 250 });
        doc.fontSize(9).fillColor(mutedColor);
        doc.text(item.itemType, 310, yPos + 5, { width: 60 });
        doc.text(Number(item.quantity).toFixed(2), 375, yPos + 5, { width: 40, align: "right" });
        doc.text("$" + Number(item.unitPrice).toFixed(2), 420, yPos + 5, { width: 60, align: "right" });
        doc.fontSize(10).fillColor(textColor);
        doc.text("$" + Number(item.totalPrice).toFixed(2), 485, yPos + 5, { width: 72, align: "right" });

        yPos += 25;
        doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
      }

      // Totals
      yPos += 20;
      const totalsX = 400;

      doc.fontSize(10).fillColor(mutedColor).text("Subtotal:", totalsX, yPos);
      doc.fillColor(textColor).text("$" + Number(invoice.subtotal).toFixed(2), 500, yPos, { width: 62, align: "right" });
      yPos += 18;

      if (Number(invoice.tax) > 0) {
        doc.fillColor(mutedColor).text(`Tax (${Number(invoice.taxRate).toFixed(2)}%):`, totalsX, yPos);
        doc.fillColor(textColor).text("$" + Number(invoice.tax).toFixed(2), 500, yPos, { width: 62, align: "right" });
        yPos += 18;
      }

      // Total
      doc.moveTo(totalsX, yPos).lineTo(562, yPos).strokeColor(borderColor).lineWidth(2).stroke();
      yPos += 10;
      doc.fontSize(14).fillColor(textColor).text("Total:", totalsX, yPos);
      doc.fillColor(primaryColor).text("$" + Number(invoice.total).toFixed(2), 500, yPos, { width: 62, align: "right" });

      // Notes and Terms
      yPos += 40;
      if (invoice.terms) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        doc.fontSize(10).fillColor(mutedColor).text("PAYMENT TERMS", 50, yPos);
        yPos += 15;
        doc.fontSize(10).fillColor(textColor).text(invoice.terms, 50, yPos, { width: 512 });
        yPos += doc.heightOfString(invoice.terms, { width: 512 }) + 20;
      }

      if (invoice.notes) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        doc.fontSize(10).fillColor(mutedColor).text("NOTES", 50, yPos);
        yPos += 15;
        doc.fontSize(10).fillColor(textColor).text(invoice.notes, 50, yPos, { width: 512 });
      }

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(mutedColor).text(
          `Page ${i + 1} of ${pageCount}`,
          50,
          750,
          { align: "center", width: 512 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
