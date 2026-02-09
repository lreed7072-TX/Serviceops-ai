"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import "./CompanySettings.css";

export default function EmailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [emailFromName, setEmailFromName] = useState("");
  const [emailFromAddress, setEmailFromAddress] = useState("");
  const [emailReplyTo, setEmailReplyTo] = useState("");

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await apiFetch("/api/organization", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const org = json.data;
          setEmailFromName(org.emailFromName || org.name || "");
          setEmailFromAddress(org.emailFromAddress || "");
          setEmailReplyTo(org.emailReplyTo || org.contactEmail || "");
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!emailFromName.trim() || !emailFromAddress.trim()) {
      setMessage({ type: "error", text: "From name and address are required" });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailFromName: emailFromName.trim(),
          emailFromAddress: emailFromAddress.trim(),
          emailReplyTo: emailReplyTo.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setMessage({ type: "success", text: "Email settings saved successfully" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!emailFromAddress.trim()) {
      setMessage({ type: "error", text: "Please save your email settings first" });
      return;
    }

    const testTo = prompt("Enter email address to send test email:");
    if (!testTo) return;

    setTesting(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      setMessage({ type: "success", text: `Test email sent to ${testTo}` });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <p style={{ color: "#6b7280", padding: "2rem", textAlign: "center" }}>Loading...</p>;
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Email Configuration</h2>
        <p>Configure email settings for outgoing notifications and documents</p>
      </div>

      {message && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="settings-form-section">
          <h3>Sender Information</h3>
          <div className="settings-form-grid">
            <div className="settings-form-field">
              <label>From Name *</label>
              <input
                type="text"
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                placeholder="Global Pump Solutions"
                required
              />
              <small>Name shown in recipient&apos;s inbox</small>
            </div>
            <div className="settings-form-field">
              <label>From Email Address *</label>
              <input
                type="email"
                value={emailFromAddress}
                onChange={(e) => setEmailFromAddress(e.target.value)}
                placeholder="noreply@company.com"
                required
              />
              <small>Must be verified in Resend dashboard</small>
            </div>
            <div className="settings-form-field">
              <label>Reply-To Email</label>
              <input
                type="email"
                value={emailReplyTo}
                onChange={(e) => setEmailReplyTo(e.target.value)}
                placeholder="support@company.com"
              />
              <small>Where replies will be sent</small>
            </div>
          </div>
        </div>

        <div className="settings-form-section">
          <h3>Email Service Provider</h3>
          <div className="settings-info-box">
            <div>
              <strong>Using Resend</strong>
              <p>
                ServiceOpsIQ uses Resend for reliable email delivery. Your API key is
                stored securely in environment variables.
              </p>
              <p>
                <strong>Setup:</strong> Add your domain to Resend, verify DNS records, and
                update RESEND_API_KEY in your .env file.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-form-actions">
          <button
            type="button"
            onClick={sendTestEmail}
            disabled={testing}
            className="btn btn-secondary"
          >
            {testing ? "Sending..." : "Send Test Email"}
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
