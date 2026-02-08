import { Resend } from "resend";

// Lazy-initialize Resend to avoid build-time errors when API key is not set
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

// Default sender email - should be configured in environment
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@example.com";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "ServiceOpsIQ";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  try {
    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured, email not sent");
      return {
        success: false,
        error: "Email service not configured. Please set RESEND_API_KEY environment variable.",
      };
    }

    const { data, error } = await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
      })),
      replyTo: options.replyTo,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error("Email service error:", error);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

interface QuoteEmailData {
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  total: number | string;
  validUntil: string | null;
  title: string;
  description?: string | null;
  orgName: string;
  quoteUrl?: string;
  pdfBuffer?: Buffer;
}

/**
 * Send a quote email to a customer
 */
export async function sendQuoteEmail(data: QuoteEmailData): Promise<EmailResult> {
  const validUntilText = data.validUntil
    ? `This quote is valid until ${new Date(data.validUntil).toLocaleDateString()}.`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quote ${data.quoteNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .total { font-size: 28px; color: #3b82f6; font-weight: 700; margin: 20px 0; }
          .cta { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
          .note { background: #fef3c7; border: 1px solid #fcd34d; padding: 12px 16px; border-radius: 6px; margin-top: 20px; color: #92400e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.orgName}</h1>
            <p>Quote ${data.quoteNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Thank you for your interest. Please find attached your quote for:</p>
            <h2 style="margin: 20px 0 10px 0; color: #111827;">${data.title}</h2>
            ${data.description ? `<p style="color: #6b7280;">${data.description}</p>` : ""}
            <div class="total">$${Number(data.total).toFixed(2)}</div>
            ${data.quoteUrl ? `<a href="${data.quoteUrl}" class="cta">View Quote Online</a>` : ""}
            ${validUntilText ? `<div class="note">${validUntilText}</div>` : ""}
            <p style="margin-top: 30px;">If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>${data.orgName}</p>
          </div>
          <div class="footer">
            <p>This email was sent by ${data.orgName}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Quote ${data.quoteNumber} from ${data.orgName}

Dear ${data.customerName},

Thank you for your interest. Please find your quote details below:

${data.title}
${data.description || ""}

Total: $${Number(data.total).toFixed(2)}

${validUntilText}

If you have any questions, please don't hesitate to contact us.

Best regards,
${data.orgName}
  `.trim();

  const attachments = data.pdfBuffer
    ? [
        {
          filename: `${data.quoteNumber}.pdf`,
          content: data.pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  return sendEmail({
    to: data.customerEmail,
    subject: `Quote ${data.quoteNumber} from ${data.orgName}`,
    html,
    text,
    attachments,
  });
}

interface InvoiceEmailData {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  total: number | string;
  dueDate: string | null;
  title: string;
  description?: string | null;
  orgName: string;
  invoiceUrl?: string;
  pdfBuffer?: Buffer;
}

/**
 * Send an invoice email to a customer
 */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<EmailResult> {
  const dueDateText = data.dueDate
    ? `Payment is due by ${new Date(data.dueDate).toLocaleDateString()}.`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${data.invoiceNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .total { font-size: 28px; color: #10b981; font-weight: 700; margin: 20px 0; }
          .cta { display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
          .note { background: #dbeafe; border: 1px solid #93c5fd; padding: 12px 16px; border-radius: 6px; margin-top: 20px; color: #1e40af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.orgName}</h1>
            <p>Invoice ${data.invoiceNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Please find attached your invoice for:</p>
            <h2 style="margin: 20px 0 10px 0; color: #111827;">${data.title}</h2>
            ${data.description ? `<p style="color: #6b7280;">${data.description}</p>` : ""}
            <div class="total">$${Number(data.total).toFixed(2)}</div>
            ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="cta">View Invoice Online</a>` : ""}
            ${dueDateText ? `<div class="note">${dueDateText}</div>` : ""}
            <p style="margin-top: 30px;">If you have any questions about this invoice, please contact us.</p>
            <p>Thank you for your business.</p>
            <p>Best regards,<br>${data.orgName}</p>
          </div>
          <div class="footer">
            <p>This email was sent by ${data.orgName}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Invoice ${data.invoiceNumber} from ${data.orgName}

Dear ${data.customerName},

Please find your invoice details below:

${data.title}
${data.description || ""}

Total Due: $${Number(data.total).toFixed(2)}

${dueDateText}

If you have any questions about this invoice, please contact us.

Thank you for your business.

Best regards,
${data.orgName}
  `.trim();

  const attachments = data.pdfBuffer
    ? [
        {
          filename: `${data.invoiceNumber}.pdf`,
          content: data.pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  return sendEmail({
    to: data.customerEmail,
    subject: `Invoice ${data.invoiceNumber} from ${data.orgName}`,
    html,
    text,
    attachments,
  });
}

interface WorkOrderEmailData {
  workOrderNumber: string;
  customerName: string;
  customerEmail: string;
  title: string;
  description?: string | null;
  status: string;
  orgName: string;
  siteName?: string | null;
  technicianName?: string | null;
  workOrderUrl?: string;
  pdfBuffer?: Buffer;
}

/**
 * Send a work order email to a customer
 */
export async function sendWorkOrderEmail(data: WorkOrderEmailData): Promise<EmailResult> {
  const statusDisplay = data.status.replace("_", " ");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Work Order ${data.workOrderNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: 600; color: #374151; min-width: 140px; }
          .detail-value { color: #111827; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; background: #dbeafe; color: #1e40af; text-transform: uppercase; }
          .cta { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.orgName}</h1>
            <p>Work Order ${data.workOrderNumber}</p>
          </div>
          <div class="content">
            <p>Dear ${data.customerName},</p>
            <p>Please find the details for your work order below:</p>
            <h2 style="margin: 20px 0 10px 0; color: #111827;">${data.title}</h2>
            ${data.description ? `<p style="color: #6b7280;">${data.description}</p>` : ""}
            <div style="margin: 20px 0; background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value"><span class="status-badge">${statusDisplay}</span></span>
              </div>
              ${data.siteName ? `
              <div class="detail-row">
                <span class="detail-label">Service Location</span>
                <span class="detail-value">${data.siteName}</span>
              </div>` : ""}
              ${data.technicianName ? `
              <div class="detail-row">
                <span class="detail-label">Assigned Tech</span>
                <span class="detail-value">${data.technicianName}</span>
              </div>` : ""}
            </div>
            ${data.workOrderUrl ? `<a href="${data.workOrderUrl}" class="cta">View Work Order Online</a>` : ""}
            <p style="margin-top: 30px;">A PDF copy of this work order is attached for your records.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>${data.orgName}</p>
          </div>
          <div class="footer">
            <p>This email was sent by ${data.orgName}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Work Order ${data.workOrderNumber} from ${data.orgName}

Dear ${data.customerName},

Please find the details for your work order below:

${data.title}
${data.description || ""}

Status: ${statusDisplay}
${data.siteName ? `Service Location: ${data.siteName}` : ""}
${data.technicianName ? `Assigned Technician: ${data.technicianName}` : ""}

A PDF copy of this work order is attached for your records.

If you have any questions, please don't hesitate to contact us.

Best regards,
${data.orgName}
  `.trim();

  const attachments = data.pdfBuffer
    ? [
        {
          filename: `${data.workOrderNumber}.pdf`,
          content: data.pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    : undefined;

  return sendEmail({
    to: data.customerEmail,
    subject: `Work Order ${data.workOrderNumber} - ${data.orgName}`,
    html,
    text,
    attachments,
  });
}
