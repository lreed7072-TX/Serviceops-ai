import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, type InvoiceData } from "./documents/InvoiceDocument";
import { QuoteDocument, type QuoteData } from "./documents/QuoteDocument";
import {
  WorkOrderReportDocument,
  type WorkOrderData,
} from "./documents/WorkOrderReportDocument";
import {
  AnalyticsReportDocument,
  type AnalyticsData,
} from "./documents/AnalyticsReportDocument";

export type { InvoiceData } from "./documents/InvoiceDocument";
export type { QuoteData } from "./documents/QuoteDocument";
export type { WorkOrderData } from "./documents/WorkOrderReportDocument";
export type { AnalyticsData } from "./documents/AnalyticsReportDocument";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function render(element: React.ReactElement): Promise<Buffer> {
  const buffer = await renderToBuffer(element as any);
  return Buffer.from(buffer);
}

export async function generateInvoicePdf(
  invoice: InvoiceData
): Promise<Buffer> {
  return render(React.createElement(InvoiceDocument, { data: invoice }));
}

export async function generateQuotePdf(quote: QuoteData): Promise<Buffer> {
  return render(React.createElement(QuoteDocument, { data: quote }));
}

export async function generateWorkOrderReportPdf(
  workOrder: WorkOrderData
): Promise<Buffer> {
  return render(
    React.createElement(WorkOrderReportDocument, { data: workOrder })
  );
}

export async function generateAnalyticsReportPdf(
  data: AnalyticsData
): Promise<Buffer> {
  return render(React.createElement(AnalyticsReportDocument, { data }));
}
