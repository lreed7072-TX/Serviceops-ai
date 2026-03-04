"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import "./materials-duplicates.css";

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
  const toast = useToast();

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
      toast.error(e?.message || "Failed to merge");
    } finally {
      setMerging(null);
    }
  };

  return (
    <div className="duplicates-page">
      {/* Page Header */}
      <div className="duplicates-page-header">
        <Link href="/materials" className="back-link">
          ← Back to Materials
        </Link>
        <h1>Duplicate Materials</h1>
        <p>Review and merge duplicate material entries to maintain data quality</p>
      </div>

      {/* Alerts */}
      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading duplicates...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="clean-state">
          <div className="clean-state-icon">✓</div>
          <h2>No Duplicates Found</h2>
          <p>Your materials catalog is clean!</p>
        </div>
      ) : (
        <div>
          <div className="alert-warning">
            Found {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} ({groups.reduce((s, g) => s + g.count, 0)} total records)
          </div>

          {groups.map((group) => {
            const key = `${group.normalized_name}|${group.part_number}`;
            const isMerging = merging === key;

            return (
              <div key={key} className="duplicate-group">
                <div className="duplicate-group-header">
                  <div>
                    <h3 className="duplicate-group-title">{group.names[0]}</h3>
                    {group.part_number && (
                      <div className="duplicate-group-part">Part #: {group.part_number}</div>
                    )}
                  </div>
                  <span className="duplicate-count-badge">
                    {group.count} duplicates
                  </span>
                </div>

                <table className="duplicate-table">
                  <thead>
                    <tr>
                      <th className="text-left">Primary</th>
                      <th className="text-left">Name</th>
                      <th className="text-right">Unit Cost</th>
                      <th className="text-left">Manufacturer</th>
                      <th className="text-right">Qty on Hand</th>
                      <th className="text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.ids.map((id, idx) => (
                      <tr
                        key={id}
                        className={selectedPrimary[key] === id ? "selected-row" : ""}
                      >
                        <td>
                          <input
                            type="radio"
                            name={`primary-${key}`}
                            checked={selectedPrimary[key] === id}
                            onChange={() =>
                              setSelectedPrimary({ ...selectedPrimary, [key]: id })
                            }
                            className="radio-input"
                          />
                        </td>
                        <td className="name-cell">{group.names[idx]}</td>
                        <td className="text-right">
                          {group.costs[idx] != null
                            ? `$${Number(group.costs[idx]).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="muted">{group.manufacturers[idx] || "—"}</td>
                        <td className="text-right">{group.quantities[idx] ?? 0}</td>
                        <td className="text-center">
                          {group.active_flags[idx] ? (
                            <span className="active-yes">Yes</span>
                          ) : (
                            <span className="active-no">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="duplicate-group-footer">
                  <span className="duplicate-group-hint">
                    Select the primary record to keep. Duplicates will be merged into it.
                  </span>
                  <button
                    onClick={() => handleMerge(group)}
                    disabled={isMerging}
                    className="btn-danger"
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
