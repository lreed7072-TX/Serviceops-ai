"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

type FieldDefinition = {
  id: string;
  fieldName: string;
  fieldType: "TEXT" | "NUMBER" | "BOOLEAN";
  displayOrder: number;
  isActive: boolean;
};

type FieldValue = {
  fieldDefinitionId: string;
  value: string | null;
};

type CustomFieldRendererProps = {
  entityType: "CUSTOMER" | "SITE";
  entityId: string;
  industryId?: string | null;
  onSave?: () => void;
};

/**
 * CFIELD-02: Dynamically render custom fields on entity forms.
 * Loads definitions by entityType + optional industryId, loads existing values,
 * and provides save functionality via batch upsert.
 */
export default function CustomFieldRenderer({
  entityType,
  entityId,
  industryId,
  onSave,
}: CustomFieldRendererProps) {
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch definitions and values in parallel
      const params = new URLSearchParams({ entityType });
      if (industryId) params.set("industryId", industryId);

      const [defsRes, valsRes] = await Promise.all([
        apiFetch(`/api/crm/custom-fields?${params}`, { credentials: "include" }),
        apiFetch(
          `/api/crm/custom-field-values?entityType=${entityType}&entityId=${entityId}`,
          { credentials: "include" }
        ),
      ]);

      if (defsRes.ok) {
        const defsJson = await defsRes.json();
        const activeDefs = (defsJson.data || []).filter((d: FieldDefinition) => d.isActive);
        setDefinitions(activeDefs);
      }

      if (valsRes.ok) {
        const valsJson = await valsRes.json();
        const valMap: Record<string, string | null> = {};
        (valsJson.data || []).forEach((v: FieldValue & { fieldDefinition?: FieldDefinition }) => {
          valMap[v.fieldDefinitionId] = v.value;
        });
        setValues(valMap);
      }
    } catch {
      // Silently fail — custom fields are optional
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, industryId]);

  useEffect(() => {
    if (entityId) {
      fetchData();
    }
  }, [entityId, fetchData]);

  function handleChange(fieldId: string, value: string | null) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!dirty || definitions.length === 0) return;

    setSaving(true);
    try {
      const fields = definitions.map((def) => ({
        fieldDefinitionId: def.id,
        value: values[def.id] ?? null,
      }));

      const res = await apiFetch("/api/crm/custom-field-values", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, fields }),
      });

      if (!res.ok) throw new Error("Failed to save custom fields");
      setDirty(false);
      onSave?.();
    } catch {
      // Error handled silently — parent form controls primary save
    } finally {
      setSaving(false);
    }
  }

  if (loading || definitions.length === 0) return null;

  return (
    <div className="custom-fields-section">
      <h4 className="custom-fields-title">Custom Fields</h4>
      <div className="custom-fields-grid">
        {definitions.map((def) => {
          const val = values[def.id] ?? "";

          if (def.fieldType === "BOOLEAN") {
            return (
              <label key={def.id} className="crm-form-checkbox">
                <input
                  type="checkbox"
                  checked={val === "true"}
                  onChange={(e) => handleChange(def.id, e.target.checked ? "true" : "false")}
                />
                <span>{def.fieldName}</span>
              </label>
            );
          }

          return (
            <div key={def.id} className="crm-form-group">
              <label className="crm-form-label">{def.fieldName}</label>
              <input
                type={def.fieldType === "NUMBER" ? "number" : "text"}
                className="crm-form-input"
                value={val}
                onChange={(e) => handleChange(def.id, e.target.value || null)}
                placeholder={`Enter ${def.fieldName.toLowerCase()}`}
              />
            </div>
          );
        })}
      </div>
      {dirty && (
        <button
          className="ui-btn ui-btn--secondary ui-btn--sm"
          onClick={handleSave}
          disabled={saving}
          style={{ marginTop: "0.5rem" }}
        >
          {saving ? "Saving..." : "Save Custom Fields"}
        </button>
      )}
    </div>
  );
}
