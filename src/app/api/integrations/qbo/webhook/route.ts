import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/qbo/qbo-client";
import { handleQboPaymentWebhook } from "@/lib/qbo/qbo-sync";

// POST /api/integrations/qbo/webhook
// Receives QBO webhook events (no auth required - signature verified instead)
export async function POST(req: NextRequest) {
  const signature = req.headers.get("intuit-signature");
  const rawBody = await req.text();

  // Verify webhook signature if verifier token is configured
  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (verifierToken && signature) {
    const valid = verifyWebhookSignature(rawBody, signature, verifierToken);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }
  }

  try {
    const payload = JSON.parse(rawBody);

    // Handle the webhook payload
    await handleQboPaymentWebhook(payload);

    // QBO expects a 200 response
    return NextResponse.json({ ok: true });
  } catch (err) {
    // QBO will retry on non-200 responses, so log but return 200
    // to prevent infinite retries for malformed payloads
    console.error("QBO webhook processing error:", err);
    return NextResponse.json({ ok: true });
  }
}

// GET /api/integrations/qbo/webhook
// QBO sends a GET to verify the webhook endpoint during setup
export async function GET() {
  return NextResponse.json({ status: "active" });
}
