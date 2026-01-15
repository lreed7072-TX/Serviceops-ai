"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type LaborRate = {
  id: string;
  role: string;
  hourlyRate: number;
  description: string | null;
  isDefault: boolean;
};

export default function SettingsPage() {
  const [rates, setRates] = useState<LaborRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [techRate, setTechRate] = useState<string>("");
  const [techDescription, setTechDescription] = useState<string>("");

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/labor-rates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load labor rates");
      
      const data = await res.json();
      setRates(data.data ?? []);
      
      // Pre-fill form with existing TECH rate
      const techRateData = data.data.find((r: LaborRate) => r.role === "TECH");
      if (techRateData) {
        setTechRate(techRateData.hourlyRate.toString());
        setTechDescription(techRateData.description || "");
      } else {
        setTechRate("85"); // Default
        setTechDescription("Standard Technician Rate");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load labor rates");
    } finally {
      setLoading(false);
    }
  };

  const saveTechRate = async () => {
    setError(null);
    setSuccess(null);
    
    const rateValue = parseFloat(techRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      setError("Please enter a valid hourly rate");
      return;
    }

    try {
      setSaving(true);
      const res = await apiFetch("/api/labor-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "TECH",
          hourlyRate: rateValue,
          description: techDescription || "Standard Technician Rate",
          isDefault: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save labor rate");
      }

      setSuccess("Labor rate saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
      loadRates();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save labor rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link href="/dashboard" className="back-link">← Dashboard</Link>
          <h1>Settings</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Labor Rate Configuration */}
      <div className="card">
        <h2 style={{ marginBottom: 16 }}>💰 Labor Rate Configuration</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
          Set the hourly rate used for calculating labor costs on invoices. This rate applies to all technicians.
        </p>

        <div style={{ maxWidth: 500 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
              Technician Hourly Rate
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24, fontWeight: 600 }}>$</span>
              <input
                type="number"
                value={techRate}
                onChange={(e) => setTechRate(e.target.value)}
                step="0.01"
                min="0"
                placeholder="85.00"
                style={{
                  width: 150,
                  padding: "10px 12px",
                  fontSize: 18,
                  fontWeight: 600,
                  border: "2px solid var(--border)",
                  borderRadius: 6,
                }}
              />
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>per hour</span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
              Description (Optional)
            </label>
            <input
              type="text"
              value={techDescription}
              onChange={(e) => setTechDescription(e.target.value)}
              placeholder="e.g., Standard Technician Rate"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
              }}
            />
          </div>

          <button
            onClick={saveTechRate}
            disabled={saving || loading}
            className="btn-primary"
            style={{ padding: "12px 24px", fontSize: 16 }}
          >
            {saving ? "Saving..." : "Save Labor Rate"}
          </button>
        </div>
      </div>

      {/* Current Rates Display */}
      {!loading && rates.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Current Rates</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Role</th>
                <th style={{ textAlign: "left", padding: "12px 8px", fontWeight: 600 }}>Description</th>
                <th style={{ textAlign: "right", padding: "12px 8px", fontWeight: 600 }}>Hourly Rate</th>
                <th style={{ textAlign: "center", padding: "12px 8px", fontWeight: 600 }}>Default</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(rate => (
                <tr key={rate.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600 }}>{rate.role}</td>
                  <td style={{ padding: "12px 8px", color: "var(--text-muted)" }}>
                    {rate.description || "—"}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>
                    ${parseFloat(rate.hourlyRate.toString()).toFixed(2)}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center" }}>
                    {rate.isDefault && <span style={{ color: "var(--primary)" }}>✓</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--bg-muted)", borderRadius: 8, fontSize: 14, color: "var(--text-muted)" }}>
        <strong>💡 Note:</strong> Labor rates are applied automatically when generating invoices from work orders. 
        Changes to rates will only affect newly generated invoices.
      </div>
    </div>
  );
}
