"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import "./CompanySettings.css";

export default function CompanySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("United States");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await apiFetch("/api/organization", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const org = json.data;
          setName(org.name || "");
          setContactEmail(org.contactEmail || "");
          setContactPhone(org.contactPhone || "");
          setAddress(org.address || "");
          setCity(org.city || "");
          setState(org.state || "");
          setZipCode(org.zipCode || "");
          setCountry(org.country || "United States");
          setWebsite(org.website || "");
          setTaxId(org.taxId || "");
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

    if (!name.trim()) {
      setMessage({ type: "error", text: "Company name is required" });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zipCode: zipCode.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          taxId: taxId.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setMessage({ type: "success", text: "Company settings saved successfully" });
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
        <h2>Company Information</h2>
        <p>Manage your company details and contact information</p>
      </div>

      {message && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="settings-form-section">
          <h3>Basic Information</h3>
          <div className="settings-form-grid">
            <div className="settings-form-field">
              <label>Company Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Global Pump Solutions"
                required
              />
            </div>
            <div className="settings-form-field">
              <label>Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="info@company.com"
              />
            </div>
            <div className="settings-form-field">
              <label>Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="settings-form-field">
              <label>Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
              />
            </div>
          </div>
        </div>

        <div className="settings-form-section">
          <h3>Address</h3>
          <div className="settings-form-grid">
            <div className="settings-form-field full-width">
              <label>Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="settings-form-field">
              <label>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Burleson"
              />
            </div>
            <div className="settings-form-field">
              <label>State/Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Texas"
              />
            </div>
            <div className="settings-form-field">
              <label>ZIP/Postal Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="76028"
              />
            </div>
            <div className="settings-form-field">
              <label>Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>
        </div>

        <div className="settings-form-section">
          <h3>Tax Information</h3>
          <div className="settings-form-grid">
            <div className="settings-form-field">
              <label>Tax ID / EIN</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="12-3456789"
              />
              <small>Used on invoices and tax documents</small>
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
