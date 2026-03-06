"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import type {
  TemplateDefinition,
  TemplateField,
  FieldValue,
  PhotoValue,
  SignatureValue,
  GpsValue,
  FormResponseData,
} from "@/lib/forms/types";
import "../../reports.css";
import "../responses.css";

type TemplateSummary = { id: string; name: string; definition: unknown; schemaVersion: number };
type WorkOrderSummary = { id: string; workOrderNumber: string; title: string };
type SiteSummary = { id: string; name: string };
type AssetSummary = { id: string; name: string; serialNumber: string | null };
type UserSummary = { id: string; name: string };

interface FormResponseDetail {
  id: string;
  status: string;
  data: FormResponseData;
  templateSnapshot: unknown;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reportTemplate: TemplateSummary;
  workOrder: WorkOrderSummary | null;
  site: SiteSummary | null;
  asset: AssetSummary | null;
  filledBy: UserSummary | null;
}

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDateShort = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function getTemplateDef(response: FormResponseDetail): TemplateDefinition | null {
  const raw = response.templateSnapshot ?? response.reportTemplate.definition;
  if (!raw || typeof raw !== "object") return null;
  return raw as TemplateDefinition;
}

function isInSpec(value: number, min?: number, max?: number): boolean | null {
  if (min == null && max == null) return null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

// ----- Field renderers -----

function FieldSectionHeader({ field }: { field: TemplateField }) {
  return (
    <div className="response-section">
      <h3 className="response-section-header">{field.title}</h3>
    </div>
  );
}

function FieldInstructions({ field }: { field: TemplateField }) {
  const content = field.props.content ?? field.title;
  return (
    <div className="response-instructions">{content}</div>
  );
}

function FieldTextDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const display = value != null && value !== "" ? String(value) : null;
  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      <span className={`field-display-value${display ? "" : " empty"}`}>
        {display ?? "No response"}
      </span>
    </div>
  );
}

function FieldNumericDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const numVal = typeof value === "number" ? value : null;
  const specResult =
    numVal != null ? isInSpec(numVal, field.props.minValue, field.props.maxValue) : null;
  const hasSpec = field.props.minValue != null || field.props.maxValue != null;

  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      <span className={`field-display-value${numVal != null ? "" : " empty"}`}>
        {numVal != null ? (
          <>
            {numVal}
            {field.props.unit && (
              <span className="field-display-unit">{field.props.unit}</span>
            )}
            {hasSpec && specResult != null && (
              <span
                className={`field-spec-badge ${specResult ? "in-spec" : "out-of-spec"}`}
              >
                {specResult ? "In Spec" : "Out of Spec"}
              </span>
            )}
            {hasSpec && (
              <span className="field-display-calculated">
                {" "}(range: {field.props.minValue ?? "--"} - {field.props.maxValue ?? "--"})
              </span>
            )}
          </>
        ) : (
          "No response"
        )}
      </span>
    </div>
  );
}

function FieldYesNoDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const boolVal = typeof value === "boolean" ? value : null;
  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      <span className={`field-display-value${boolVal != null ? "" : " empty"}`}>
        {boolVal != null ? (
          <span className="field-yesno-indicator">
            <span className={`field-yesno-dot ${boolVal ? "yes" : "no"}`} />
            {boolVal ? "Yes" : "No"}
          </span>
        ) : (
          "No response"
        )}
      </span>
    </div>
  );
}

function FieldMultiSelectDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const arr = Array.isArray(value) ? (value as string[]) : null;
  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      <span className={`field-display-value${arr && arr.length > 0 ? "" : " empty"}`}>
        {arr && arr.length > 0 ? arr.join(", ") : "No response"}
      </span>
    </div>
  );
}

function FieldDateDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const display = typeof value === "string" && value ? formatDateShort(value) : null;
  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      <span className={`field-display-value${display ? "" : " empty"}`}>
        {display ?? "No response"}
      </span>
    </div>
  );
}

function FieldCalculatedDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const display = value != null ? String(value) : null;
  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      <span className={`field-display-value${display ? "" : " empty"}`}>
        {display != null ? (
          <>
            {display}
            {field.props.unit && (
              <span className="field-display-unit">{field.props.unit}</span>
            )}
            <span className="field-display-calculated">(calculated)</span>
          </>
        ) : (
          "No value"
        )}
      </span>
    </div>
  );
}

function FieldPhotoDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const photos = Array.isArray(value) ? (value as PhotoValue) : null;
  return (
    <div className="field-display-row" style={{ flexDirection: "column", gap: "0.5rem" }}>
      <span className="field-display-label">{field.title}</span>
      {photos && photos.length > 0 ? (
        <div className="field-photo-grid">
          {photos.map((photo, i) => (
            <div key={i} className="field-photo-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.caption ?? `Photo ${i + 1}`} />
              {photo.caption && (
                <div className="field-photo-caption">{photo.caption}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <span className="field-display-value empty">No photos</span>
      )}
    </div>
  );
}

function FieldSignatureDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const sig =
    value && typeof value === "object" && !Array.isArray(value) && "url" in value
      ? (value as SignatureValue)
      : null;
  return (
    <div className="field-display-row" style={{ flexDirection: "column", gap: "0.5rem" }}>
      <span className="field-display-label">{field.title}</span>
      {sig ? (
        <div className="field-signature-display">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sig.url} alt="Signature" />
          <div className="field-signature-meta">
            Signed by {sig.signedBy}
            {sig.signedAt ? ` on ${formatDateShort(sig.signedAt)}` : ""}
          </div>
        </div>
      ) : (
        <span className="field-display-value empty">No signature</span>
      )}
    </div>
  );
}

function FieldGpsDisplay({
  field,
  value,
}: {
  field: TemplateField;
  value: FieldValue;
}) {
  const gps =
    value && typeof value === "object" && !Array.isArray(value) && "lat" in value
      ? (value as GpsValue)
      : null;
  return (
    <div className="field-display-row">
      <span className="field-display-label">{field.title}</span>
      {gps ? (
        <span className="field-gps-value">
          {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
          {gps.accuracy != null && (
            <span className="field-display-calculated">
              {" "}(accuracy: {gps.accuracy.toFixed(1)}m)
            </span>
          )}
        </span>
      ) : (
        <span className="field-display-value empty">No location</span>
      )}
    </div>
  );
}

// ----- Main Component -----

export default function FormResponseDetailPage() {
  const params = useParams();
  const responseId = params?.id as string | undefined;

  const [response, setResponse] = useState<FormResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadResponse = useCallback(async () => {
    if (!responseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/form-responses/${responseId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load response.");
      }
      const payload = (await res.json()) as { data: FormResponseDetail };
      setResponse(payload.data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load response.");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [responseId]);

  useEffect(() => {
    loadResponse();
  }, [loadResponse]);

  const handleExportPdf = async () => {
    if (!responseId) return;
    setExporting(true);
    try {
      const res = await apiFetch(`/api/form-responses/${responseId}/pdf`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to generate PDF.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      let filename = "report.pdf";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Refresh to show EXPORTED status
      await loadResponse();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  const canExport =
    response &&
    (response.status === "SUBMITTED" ||
      response.status === "REVIEWED" ||
      response.status === "EXPORTED");

  // Render a single field based on type
  const renderField = (field: TemplateField, data: FormResponseData) => {
    if (field.type === "SECTION_HEADER") {
      return <FieldSectionHeader key={field.blockId} field={field} />;
    }
    if (field.type === "INSTRUCTIONS") {
      return <FieldInstructions key={field.blockId} field={field} />;
    }

    const value: FieldValue = data[field.blockId] ?? null;

    switch (field.type) {
      case "TEXT_INPUT":
      case "TEXTAREA":
      case "DROPDOWN":
        return <FieldTextDisplay key={field.blockId} field={field} value={value} />;
      case "NUMERIC_INPUT":
        return <FieldNumericDisplay key={field.blockId} field={field} value={value} />;
      case "YES_NO":
        return <FieldYesNoDisplay key={field.blockId} field={field} value={value} />;
      case "MULTI_SELECT":
        return <FieldMultiSelectDisplay key={field.blockId} field={field} value={value} />;
      case "DATE_INPUT":
        return <FieldDateDisplay key={field.blockId} field={field} value={value} />;
      case "CALCULATED":
        return <FieldCalculatedDisplay key={field.blockId} field={field} value={value} />;
      case "PHOTO_CAPTURE":
        return <FieldPhotoDisplay key={field.blockId} field={field} value={value} />;
      case "SIGNATURE":
        return <FieldSignatureDisplay key={field.blockId} field={field} value={value} />;
      case "GPS_CAPTURE":
        return <FieldGpsDisplay key={field.blockId} field={field} value={value} />;
      default:
        // Unknown field type — render as text
        return <FieldTextDisplay key={field.blockId} field={field} value={value} />;
    }
  };

  if (!responseId) {
    return (
      <div className="reports-page">
        <p>Missing response ID in URL.</p>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <Breadcrumbs
        items={[
          { label: "Reports", href: "/reports" },
          { label: "Form Responses", href: "/reports/responses" },
          { label: response?.reportTemplate?.name ?? "Response" },
        ]}
      />

      {error && <div className="alert-error" style={{ marginTop: "1rem" }}>{error}</div>}

      {loading ? (
        <div className="reports-loading">
          <div className="reports-spinner" />
          <p>Loading response...</p>
        </div>
      ) : !response ? (
        <div className="reports-empty-state" style={{ marginTop: "1.5rem" }}>
          <h3>Response not found</h3>
          <p>The form response may have been deleted or you may not have access.</p>
          <Link href="/reports/responses" className="reports-btn-primary">
            Back to Responses
          </Link>
        </div>
      ) : (
        <div className="response-detail" style={{ marginTop: "1rem" }}>
          {/* Header Card */}
          <div className="response-detail-header">
            <div className="response-detail-header-top">
              <div>
                <h1 className="response-detail-title">
                  {response.reportTemplate?.name ?? "Form Response"}
                </h1>
                <span
                  className={`response-status-badge ${response.status.toLowerCase()}`}
                >
                  {response.status}
                </span>
              </div>
              {canExport && (
                <button
                  type="button"
                  className="reports-btn-primary"
                  onClick={handleExportPdf}
                  disabled={exporting}
                >
                  {exporting ? "Generating PDF..." : "Export PDF"}
                </button>
              )}
            </div>
            <div className="response-detail-meta">
              <div className="response-detail-meta-item">
                <strong>Work Order:</strong>{" "}
                {response.workOrder ? (
                  <Link
                    href={`/work-orders/${response.workOrder.id}`}
                    className="reports-table-link"
                  >
                    {response.workOrder.workOrderNumber}
                  </Link>
                ) : (
                  "Standalone"
                )}
              </div>
              {response.site && (
                <div className="response-detail-meta-item">
                  <strong>Site:</strong> {response.site.name}
                </div>
              )}
              {response.asset && (
                <div className="response-detail-meta-item">
                  <strong>Asset:</strong> {response.asset.name}
                  {response.asset.serialNumber
                    ? ` (S/N: ${response.asset.serialNumber})`
                    : ""}
                </div>
              )}
              <div className="response-detail-meta-item">
                <strong>Filled By:</strong> {response.filledBy?.name ?? "--"}
              </div>
              <div className="response-detail-meta-item">
                <strong>Submitted:</strong> {formatDate(response.submittedAt)}
              </div>
              <div className="response-detail-meta-item">
                <strong>Last Updated:</strong> {formatDate(response.updatedAt)}
              </div>
            </div>
          </div>

          {/* Rendered Fields */}
          {(() => {
            const templateDef = getTemplateDef(response);
            if (!templateDef?.sections || templateDef.sections.length === 0) {
              return (
                <div className="response-section">
                  <p style={{ color: "#6b7280" }}>
                    No template definition available. The form data may still exist but
                    cannot be rendered without a template structure.
                  </p>
                </div>
              );
            }

            const data = (response.data ?? {}) as FormResponseData;
            const sorted = [...templateDef.sections].sort(
              (a, b) => a.sortOrder - b.sortOrder
            );

            // Group fields by sections: each SECTION_HEADER starts a new group
            const groups: { header: TemplateField | null; fields: TemplateField[] }[] =
              [];
            let currentGroup: { header: TemplateField | null; fields: TemplateField[] } =
              { header: null, fields: [] };

            for (const field of sorted) {
              if (field.type === "SECTION_HEADER") {
                if (currentGroup.header || currentGroup.fields.length > 0) {
                  groups.push(currentGroup);
                }
                currentGroup = { header: field, fields: [] };
              } else {
                currentGroup.fields.push(field);
              }
            }
            if (currentGroup.header || currentGroup.fields.length > 0) {
              groups.push(currentGroup);
            }

            return groups.map((group, gi) => (
              <div key={gi} className="response-section">
                {group.header && (
                  <h3 className="response-section-header">{group.header.title}</h3>
                )}
                {group.fields.map((field) => renderField(field, data))}
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
