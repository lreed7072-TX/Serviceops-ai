"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import "./CompanySettings.css";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time (AZ)" },
  { value: "America/Anchorage", label: "Alaska Time (AK)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HI)" },
  { value: "UTC", label: "UTC" },
];

const CURRENCIES = [
  { value: "USD", label: "US Dollar ($)" },
  { value: "CAD", label: "Canadian Dollar (CAD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "MXN", label: "Mexican Peso (MXN)" },
];

interface OrgData {
  id: string;
  timezone: string | null;
  currency: string | null;
  createdAt: string;
}

export default function OrganizationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [org, setOrg] = useState<OrgData | null>(null);

  const [timezone, setTimezone] = useState("America/Chicago");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await apiFetch("/api/organization", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const data = json.data;
          setOrg(data);
          setTimezone(data.timezone || "America/Chicago");
          setCurrency(data.currency || "USD");
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
    setSaving(true);

    try {
      const res = await apiFetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, currency }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setMessage({ type: "success", text: "Organization settings saved successfully" });
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

  if (loading) {
    return <p style={{ color: "#6b7280", padding: "2rem", textAlign: "center" }}>Loading...</p>;
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Organization Preferences</h2>
        <p>Configure regional and system preferences</p>
      </div>

      {message && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="settings-form-section">
          <h3>Regional Settings</h3>
          <div className="settings-form-grid">
            <div className="settings-form-field">
              <label>Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <small>Used for scheduling and time displays</small>
            </div>

            <div className="settings-form-field">
              <label>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((curr) => (
                  <option key={curr.value} value={curr.value}>
                    {curr.label}
                  </option>
                ))}
              </select>
              <small>Used on quotes, invoices, and reports</small>
            </div>
          </div>
        </div>

        <div className="settings-form-section">
          <h3>System Information</h3>
          <div className="settings-info-box">
            <div>
              <strong>Platform Details</strong>
              {org && (
                <>
                  <p><strong>Organization ID:</strong> {org.id}</p>
                  <p>
                    <strong>Created:</strong>{" "}
                    {new Date(org.createdAt).toLocaleDateString()}
                  </p>
                </>
              )}
              <p><strong>Platform:</strong> ServiceOpsIQ Enterprise</p>
              <p><strong>Version:</strong> 1.0.0</p>
            </div>
          </div>
        </div>

        <div className="settings-form-section">
          <h3>Data &amp; Privacy</h3>
          <div className="settings-info-box">
            <div>
              <strong>Data Security</strong>
              <p>
                Your organization&apos;s data is stored securely with enterprise-grade
                encryption. All data is isolated to your organization and never shared
                with other tenants.
              </p>
              <p><strong>Backup Schedule:</strong> Automated daily backups with 30-day retention</p>
              <p><strong>Data Location:</strong> United States (Supabase US Region)</p>
            </div>
          </div>
        </div>

        <div className="settings-form-actions">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
