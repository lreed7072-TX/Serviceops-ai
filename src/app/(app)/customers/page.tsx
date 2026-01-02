"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";


type Customer = {
  id: string;
  name: string;
  status: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  notes?: string | null;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
const [billingStreet1, setBillingStreet1] = useState("");
  const [billingStreet2, setBillingStreet2] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/customers", { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }
      const json = await res.json();
      setCustomers(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load customers.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function onCreate(e: React.FormEvent) {
      e.preventDefault();
      if (saving) return;
    if (!name.trim()) return;

    setSaving(true);
    setErr(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          primaryEmail: primaryEmail.trim() || null,
          primaryPhone: primaryPhone.trim() || null,
          billingStreet1: billingStreet1.trim() || null,
          billingStreet2: billingStreet2.trim() || null,
          billingCity: billingCity.trim() || null,
          billingState: billingState.trim() || null,
          billingPostalCode: billingPostalCode.trim() || null,
          billingCountry: "US",
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Create failed (${res.status})`);
      }

      setIsOpen(false);
      setName("");
      setStatus("ACTIVE");
      setPrimaryEmail("");
      setPrimaryPhone("");
      setNotes("");
      await loadCustomers();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
            <PageHeader
        title="Customers"
        subtitle="Manage client accounts across regions and service tiers."
        right={
          <>
            <Badge>CRUD API ready</Badge>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + New Customer
          </button>
          </>
        }
      />

      {err ? (
        <div style={{ marginBottom: 12, padding: 12, border: "1px solid rgba(255,0,0,0.25)", borderRadius: 10 }}>
          <strong>Error:</strong> {err}
        </div>
      ) : null}

      <div className="card">
        <h3>Customer list</h3>

        {loading ? (
          <div style={{ padding: 12 }}>Loading…</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Sites</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 12, opacity: 0.75 }}>
                    No customers yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/customers/${c.id}`}>{c.name}</Link></td>
                    <td>{c.status ?? "ACTIVE"}</td>
                    <td>—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            // close when clicking backdrop
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>New Customer</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <form onSubmit={onCreate} style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Facilities"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                  }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>


              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Primary email</span>
                <input
                  value={primaryEmail}
                  onChange={(e) => setPrimaryEmail(e.target.value)}
                  placeholder="e.g. billing@acme.com"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Primary phone</span>
                <input
                  value={primaryPhone}
                  onChange={(e) => setPrimaryPhone(e.target.value)}
                  placeholder="e.g. (555) 555-1234"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                  }}
                />
              </label>
              <div style={{ display: "grid", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Billing street 1</span>
                  <input
                    value={billingStreet1}
                    onChange={(e) => setBillingStreet1(e.target.value)}
                    placeholder="Optional"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Billing street 2</span>
                  <input
                    value={billingStreet2}
                    onChange={(e) => setBillingStreet2(e.target.value)}
                    placeholder="Optional"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Billing city</span>
                  <input
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    placeholder="Optional"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Billing state</span>
                  <input
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                    placeholder="Optional"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Billing ZIP</span>
                  <input
                    value={billingPostalCode}
                    onChange={(e) => setBillingPostalCode(e.target.value)}
                    placeholder="Optional"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                  rows={4}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: saving ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.9)",
                    color: saving ? "black" : "white",
                    cursor: saving ? "default" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {saving ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
