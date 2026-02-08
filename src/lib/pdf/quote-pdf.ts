import PDFDocument from "pdfkit";

interface LineItem {
  id: string;
  itemType: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  totalPrice: number | string;
}

interface QuoteData {
  quoteNumber: string;
  title: string;
  description: string | null;
  status: string;
  subtotal: number | string;
  tax: number | string;
  taxRate: number | string;
  total: number | string;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
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
  lineItems: LineItem[];
  orgName: string;
}

export async function generateQuotePDF(quote: QuoteData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 50,
        bufferPages: true,
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
      doc.fontSize(24).fillColor(primaryColor).text(quote.orgName, 50, 50);
      doc.fontSize(10).fillColor(mutedColor).text("Quote / Estimate", 50, 80);

      // Quote Number & Status (right aligned)
      doc.fontSize(28).fillColor(textColor).text(quote.quoteNumber, 400, 50, { align: "right" });

      const statusColors: Record<string, string> = {
        DRAFT: "#6b7280",
        SENT: "#3b82f6",
        APPROVED: "#10b981",
        REJECTED: "#ef4444",
        EXPIRED: "#9ca3af",
        CONVERTED: "#8b5cf6",
      };
      const statusColor = statusColors[quote.status] || "#6b7280";
      doc.fontSize(12).fillColor(statusColor).text(quote.status, 400, 85, { align: "right" });

      // Divider
      doc.moveTo(50, 110).lineTo(562, 110).strokeColor(borderColor).stroke();

      // Prepared For section
      let yPos = 130;
      doc.fontSize(10).fillColor(mutedColor).text("PREPARED FOR", 50, yPos);
      yPos += 15;
      doc.fontSize(12).fillColor(textColor).text(quote.customer.name, 50, yPos);
      yPos += 15;
      if (quote.customer.primaryEmail) {
        doc.fontSize(10).fillColor(mutedColor).text(quote.customer.primaryEmail, 50, yPos);
        yPos += 12;
      }
      if (quote.customer.primaryPhone) {
        doc.fontSize(10).fillColor(mutedColor).text(quote.customer.primaryPhone, 50, yPos);
        yPos += 12;
      }
      if (quote.customer.billingAddress) {
        doc.fontSize(10).fillColor(mutedColor).text(quote.customer.billingAddress, 50, yPos, { width: 200 });
        yPos += 12;
      }
      if (quote.site) {
        yPos += 5;
        doc.fontSize(9).fillColor(mutedColor).text("Site: " + quote.site.name, 50, yPos);
        yPos += 12;
      }

      // Quote Details (right side)
      let rightY = 130;
      doc.fontSize(10).fillColor(mutedColor).text("QUOTE DETAILS", 350, rightY, { align: "right", width: 212 });
      rightY += 15;

      doc.fontSize(10).fillColor(mutedColor).text("Date:", 350, rightY);
      doc.fillColor(textColor).text(new Date(quote.createdAt).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
      rightY += 15;

      if (quote.validUntil) {
        doc.fillColor(mutedColor).text("Valid Until:", 350, rightY);
        const validDate = new Date(quote.validUntil);
        const isExpired = validDate < new Date();
        doc.fillColor(isExpired ? "#ef4444" : textColor).text(validDate.toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
        rightY += 15;
      }

      if (quote.sentAt) {
        doc.fillColor(mutedColor).text("Sent:", 350, rightY);
        doc.fillColor(textColor).text(new Date(quote.sentAt).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
        rightY += 15;
      }

      if (quote.approvedAt) {
        doc.fillColor(mutedColor).text("Approved:", 350, rightY);
        doc.fillColor("#10b981").text(new Date(quote.approvedAt).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
        rightY += 15;
        if (quote.approvedByName) {
          doc.fillColor(mutedColor).text("Approved By:", 350, rightY);
          doc.fillColor(textColor).text(quote.approvedByName, 450, rightY, { align: "right", width: 112 });
          rightY += 15;
        }
      }

      if (quote.rejectedAt) {
        doc.fillColor(mutedColor).text("Rejected:", 350, rightY);
        doc.fillColor("#ef4444").text(new Date(quote.rejectedAt).toLocaleDateString(), 450, rightY, { align: "right", width: 112 });
        rightY += 15;
      }

      // Title and Description
      yPos = Math.max(yPos, rightY) + 20;
      doc.fontSize(14).fillColor(textColor).text(quote.title, 50, yPos);
      yPos += 20;
      if (quote.description) {
        doc.fontSize(10).fillColor(mutedColor).text(quote.description, 50, yPos, { width: 512 });
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
      for (const item of quote.lineItems) {
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
      doc.fillColor(textColor).text("$" + Number(quote.subtotal).toFixed(2), 500, yPos, { width: 62, align: "right" });
      yPos += 18;

      if (Number(quote.tax) > 0) {
        doc.fillColor(mutedColor).text(`Tax (${Number(quote.taxRate).toFixed(2)}%):`, totalsX, yPos);
        doc.fillColor(textColor).text("$" + Number(quote.tax).toFixed(2), 500, yPos, { width: 62, align: "right" });
        yPos += 18;
      }

      // Total
      doc.moveTo(totalsX, yPos).lineTo(562, yPos).strokeColor(borderColor).lineWidth(2).stroke();
      yPos += 10;
      doc.fontSize(14).fillColor(textColor).text("Total:", totalsX, yPos);
      doc.fillColor(primaryColor).text("$" + Number(quote.total).toFixed(2), 500, yPos, { width: 62, align: "right" });

      // Notes and Terms
      yPos += 40;
      if (quote.terms) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        doc.fontSize(10).fillColor(mutedColor).text("TERMS & CONDITIONS", 50, yPos);
        yPos += 15;
        doc.fontSize(10).fillColor(textColor).text(quote.terms, 50, yPos, { width: 512 });
        yPos += doc.heightOfString(quote.terms, { width: 512 }) + 20;
      }

      if (quote.notes) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        doc.fontSize(10).fillColor(mutedColor).text("NOTES", 50, yPos);
        yPos += 15;
        doc.fontSize(10).fillColor(textColor).text(quote.notes, 50, yPos, { width: 512 });
        yPos += doc.heightOfString(quote.notes, { width: 512 }) + 20;
      }

      // Validity Notice
      if (quote.validUntil && quote.status === "SENT") {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        yPos += 10;
        doc.rect(50, yPos, 512, 30).fill("#fef3c7");
        doc.fontSize(10).fillColor("#92400e").text(
          `This quote is valid until ${new Date(quote.validUntil).toLocaleDateString()}. Please respond before this date.`,
          60,
          yPos + 10,
          { width: 492 }
        );
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
