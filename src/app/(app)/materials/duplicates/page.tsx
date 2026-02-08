"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface DuplicateGroup {
  normalized_name: string;
  part_number: string;
  count: number;
  ids: string[];
  names: string[];
  costs: (number | null)[];
  manufacturers: (string | null)[];
  quantities: (number | null)[];
  active_flags: boolean[];
}

export default function MaterialDuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadDuplicates();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/materials/duplicates");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load duplicates");
      }
      const data = await res.json();
      setGroups(data.data || []);

      // Default primary selection to first item in each group
      const defaults: Record<string, string> = {};
      for (const group of data.data || []) {
        const key = `${group.normalized_name}|${group.part_number}`;
        defaults[key] = group.ids[0];
      }
      setSelectedPrimary(defaults);
    } catch (e: any) {
      setError(e?.message || "Failed to load duplicates");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (group: DuplicateGroup) => {
    const key = `${group.normalized_name}|${group.part_number}`;
    const primaryId = selectedPrimary[key];
    if (!primaryId) return;

    const duplicateIds = group.ids.filter((id) => id !== primaryId);
    if (duplicateIds.length === 0) return;

    if (
      !confirm(
        `Merge ${duplicateIds.length} duplicate(s) into the selected primary? This cannot be undone.`
      )
    )
      return;

    setMerging(key);
    try {
      const res = await apiFetch("/api/materials/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryId, duplicateIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Merge failed");
      }

      const data = await res.json();
      setSuccess(data.message || "Duplicates merged successfully");
      await loadDuplicates();
    } catch (e: any) {
      alert(e?.message || "Failed to merge");
    } finally {
      setMerging(null);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/materials"
          style={{
            color: "#6b7280",
            textDecoration: "none",
            fontSize: 14,
            display: "inline-block",
            marginBottom: 16,
          }}
        >
          ← Back to Materials
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#111827", margin: 0 }}>
          Duplicate Materials
        </h1>
        <p style={{ color: "#6b7280", marginTop: 8 }}>
          Review and merge duplicate material entries to maintain data quality
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "14px 20px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 8,
            marginBottom: 20,
            border: "1px solid #fca5a5",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "14px 20px",
            background: "#d1fae5",
            color: "#065f46",
            borderRadius: 8,
            marginBottom: 20,
            border: "1px solid #6ee7b7",
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "#6b7280" }}>
          Loading duplicates...
        </div>
      ) : groups.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            background: "#d1fae5",
            borderRadius: 16,
            border: "1px solid #6ee7b7",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ color: "#065f46", marginBottom: 8 }}>No Duplicates Found</h2>
          <p style={{ color: "#059669" }}>Your materials catalog is clean!</p>
        </div>
      ) : (
        <div>
          <div
            style={{
              padding: "14px 20px",
              background: "#fef3c7",
              color: "#92400e",
              borderRadius: 8,
              marginBottom: 24,
              border: "1px solid #fcd34d",
              fontWeight: 500,
            }}
          >
            Found {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} ({groups.reduce((s, g) => s + g.count, 0)} total records)
          </div>

          {groups.map((group) => {
            const key = `${group.normalized_name}|${group.part_number}`;
            const isMerging = merging === key;

            return (
              <div
                key={key}
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 24,
                  marginBottom: 20,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, color: "#111827" }}>
                      {group.names[0]}
                    </h3>
                    {group.part_number && (
                      <span style={{ fontSize: 13, color: "#6b7280" }}>
                        Part #: {group.part_number}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      padding: "4px 12px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {group.count} duplicates
                  </span>
                </div>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>
                        Primary
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>
                        Name
                      </th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>
                        Unit Cost
                      </th>
                      <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>
                        Manufacturer
                      </th>
                      <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>
                        Qty on Hand
                      </th>
                      <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 600 }}>
                        Active
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.ids.map((id, idx) => (
                      <tr
                        key={id}
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          background:
                            selectedPrimary[key] === id ? "#f0fdf4" : "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 12px" }}>
                          <input
                            type="radio"
                            name={`primary-${key}`}
                            checked={selectedPrimary[key] === id}
                            onChange={() =>
                              setSelectedPrimary({ ...selectedPrimary, [key]: id })
                            }
                            style={{ width: 18, height: 18, cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                          {group.names[idx]}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {group.costs[idx] != null
                            ? `$${Number(group.costs[idx]).toFixed(2)}`
                            : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                          {group.manufacturers[idx] || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          {group.quantities[idx] ?? 0}
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          {group.active_flags[idx] ? (
                            <span style={{ color: "#10b981" }}>Yes</span>
                          ) : (
                            <span style={{ color: "#ef4444" }}>No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#6b7280" }}>
                    Select the primary record to keep. Duplicates will be merged into it.
                  </span>
                  <button
                    onClick={() => handleMerge(group)}
                    disabled={isMerging}
                    style={{
                      padding: "10px 20px",
                      background: isMerging ? "#9ca3af" : "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: isMerging ? "not-allowed" : "pointer",
                    }}
                  >
                    {isMerging ? "Merging..." : `Merge ${group.count - 1} Duplicate${group.count > 2 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
