"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Asset, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import "./asset-detail.css";

type SingleResponse<T> = {
  data: T;
};

type NameplateFormState = {
  rpm: string;
  horsepower: string;
  kilowatts: string;
  voltage: string;
  amperage: string;
  frequency: string;
  phase: string;
  frame: string;
  enclosure: string;
};

type ToastNotice = {
  type: "success" | "error";
  message: string;
};

const emptyNameplateForm: NameplateFormState = {
  rpm: "",
  horsepower: "",
  kilowatts: "",
  voltage: "",
  amperage: "",
  frequency: "",
  phase: "",
  frame: "",
  enclosure: "",
};

const nameplateLabels: Record<keyof NameplateFormState, string> = {
  rpm: "RPM",
  horsepower: "HP",
  kilowatts: "kW",
  voltage: "V",
  amperage: "A",
  frequency: "Hz",
  phase: "Phase",
  frame: "Frame",
  enclosure: "Enclosure",
};

const numericNameplateFields: Array<keyof NameplateFormState> = [
  "rpm",
  "horsepower",
  "kilowatts",
  "voltage",
  "amperage",
  "frequency",
];

const stringNameplateFields: Array<keyof NameplateFormState> = [
  "phase",
  "frame",
  "enclosure",
];

const getNameplateValue = (nameplate: unknown, key: keyof NameplateFormState) => {
  if (!nameplate || typeof nameplate !== "object" || Array.isArray(nameplate)) {
    return "";
  }

  const value = (nameplate as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const buildNameplateForm = (nameplate: unknown): NameplateFormState => ({
  rpm: getNameplateValue(nameplate, "rpm"),
  horsepower: getNameplateValue(nameplate, "horsepower"),
  kilowatts: getNameplateValue(nameplate, "kilowatts"),
  voltage: getNameplateValue(nameplate, "voltage"),
  amperage: getNameplateValue(nameplate, "amperage"),
  frequency: getNameplateValue(nameplate, "frequency"),
  phase: getNameplateValue(nameplate, "phase"),
  frame: getNameplateValue(nameplate, "frame"),
  enclosure: getNameplateValue(nameplate, "enclosure"),
});

const formatValue = (value: string | null | undefined) => {
  if (value == null) return "—";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "—";
};

const formatEnumValue = (value: string | null | undefined) => {
  if (!value) return "—";
  return value.charAt(0) + value.slice(1).toLowerCase();
};

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params?.id as string | undefined;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameplateForm, setNameplateForm] =
    useState<NameplateFormState>(emptyNameplateForm);
  const [savingNameplate, setSavingNameplate] = useState(false);
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const [pmSchedules, setPmSchedules] = useState<
    { id: string; name: string; status: string; frequencyType: string; frequencyValue: number; nextScheduledDate: string | null }[]
  >([]);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/assets/${assetId}`, { cache: "no-store" });

        if (!response.ok) {
          const statusLabel = response.status ? ` (${response.status})` : "";
          let detail = `Failed to load asset${statusLabel}.`;
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) {
              detail = `Failed to load asset${statusLabel}. ${payload.error}`;
            }
          } catch {
            // ignore parse errors
          }

          throw new Error(detail);
        }

        const payload = (await response.json()) as SingleResponse<Asset>;
        if (cancelled) return;
        setAsset(payload.data);
        setError(null);

        if (payload.data.siteId) {
          try {
            const siteResponse = await apiFetch(`/api/sites/${payload.data.siteId}`, {
              cache: "no-store",
            });
            if (siteResponse.ok) {
              const sitePayload = (await siteResponse.json()) as SingleResponse<Site>;
              if (!cancelled) {
                setSite(sitePayload.data);
              }
            }
          } catch (siteError) {
            console.error(siteError);
          }
        }

        // Fetch PM schedules for this asset
        try {
          const pmRes = await apiFetch(`/api/pm-schedules?assetId=${payload.data.id}`, {
            cache: "no-store",
          });
          if (pmRes.ok) {
            const pmJson = await pmRes.json();
            if (!cancelled) {
              setPmSchedules(pmJson.data ?? []);
            }
          }
        } catch {
          // Silently fail
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load asset.");
        setAsset(null);
        setSite(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  useEffect(() => {
    if (asset) {
      setNameplateForm(buildNameplateForm(asset.nameplate));
    }
  }, [asset]);

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    },
    []
  );

  const notesText = asset?.notes?.trim();

  const pushNotice = (next: ToastNotice) => {
    setNotice(next);
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 3200);
  };

  const handleNameplateChange = (
    field: keyof NameplateFormState,
    value: string
  ) => {
    setNameplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNameplateSave = async () => {
    if (!assetId) return;

    const nameplate: Record<string, number | string> = {};
    for (const field of numericNameplateFields) {
      const raw = nameplateForm[field].trim();
      if (!raw) continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        pushNotice({
          type: "error",
          message: `${nameplateLabels[field]} must be a positive number.`,
        });
        return;
      }
      nameplate[field] = parsed;
    }

    for (const field of stringNameplateFields) {
      const raw = nameplateForm[field].trim();
      if (raw) {
        nameplate[field] = raw;
      }
    }

    try {
      setSavingNameplate(true);
      const response = await apiFetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameplate,
          nameplateSchemaVersion: 1,
        }),
      });

      if (!response.ok) {
        let detail = "Unable to save nameplate.";
        try {
          const payload = (await response.json()) as {
            error?: string;
            issues?: string[];
          };
          detail = payload.error ?? payload.issues?.[0] ?? detail;
        } catch {
          // ignore parse errors
        }
        pushNotice({ type: "error", message: detail });
        return;
      }

      const payload = (await response.json()) as SingleResponse<Asset>;
      setAsset(payload.data);
      pushNotice({ type: "success", message: "Nameplate saved." });
    } catch (saveError) {
      console.error(saveError);
      pushNotice({
        type: "error",
        message:
          saveError instanceof Error
            ? saveError.message
            : "Unable to save nameplate.",
      });
    } finally {
      setSavingNameplate(false);
    }
  };

  return (
    <div className="asset-detail-page">
      {/* Toast Notice */}
      {notice && (
        <div className={`toast-notice ${notice.type}`}>
          {notice.message}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>{asset?.name ?? "Asset detail"}</h1>
            <p className="header-subtitle">Expanded asset detail with nameplate metadata</p>
          </div>
          <div className="header-right">
            <span className="btn-secondary">Org scoped</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="nav-links">
        <Link className="back-link" href="/assets">
          ← Back to assets
        </Link>
        <Link className="back-link" href="/work-orders">
          Work orders
        </Link>
      </div>

      {/* Alerts */}
      {error && <div className="alert-error">{error}</div>}
      {loading && !error && <div className="alert-info">Loading asset...</div>}

      {!loading && !asset && !error && (
        <div className="alert-error">Not found or no access.</div>
      )}

      {asset && (
        <>
          {/* Overview Card */}
          <div className="detail-card">
            <div className="card-header">
              <h2>Overview</h2>
            </div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{formatValue(asset.name)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Site</span>
                  <span className="info-value">{site?.name ?? formatValue(asset.siteId)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Manufacturer</span>
                  <span className="info-value">{formatValue(asset.manufacturer)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Model</span>
                  <span className="info-value">{formatValue(asset.model)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Serial</span>
                  <span className="info-value">{formatValue(asset.serialNumber)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Tag</span>
                  <span className="info-value">{formatValue(asset.assetTag)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status</span>
                  <span className="info-value">{formatEnumValue(asset.status)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Criticality</span>
                  <span className="info-value">{formatEnumValue(asset.criticality ?? "")}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Location</span>
                  <span className="info-value">{formatValue(asset.location)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          <div className="detail-card">
            <div className="card-header">
              <h2>Notes</h2>
            </div>
            <div className="card-body">
              {notesText ? (
                <p className="notes-text">{notesText}</p>
              ) : (
                <p className="notes-empty">No notes yet.</p>
              )}
            </div>
          </div>

          {/* Nameplate Card */}
          <div className="detail-card">
            <div className="card-header">
              <h2>Nameplate</h2>
              <span className="card-header-meta">
                Schema v{asset.nameplateSchemaVersion ?? "—"}
              </span>
            </div>
            <div className="card-body">
              <form
                className="nameplate-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleNameplateSave();
                }}
              >
                {(Object.keys(nameplateLabels) as Array<keyof NameplateFormState>).map(
                  (field) => (
                    <div className="form-field" key={field}>
                      <label className="field-label">{nameplateLabels[field]}</label>
                      <input
                        type={numericNameplateFields.includes(field) ? "number" : "text"}
                        inputMode={
                          numericNameplateFields.includes(field) ? "decimal" : undefined
                        }
                        step={numericNameplateFields.includes(field) ? "any" : undefined}
                        value={nameplateForm[field]}
                        onChange={(event) =>
                          handleNameplateChange(field, event.target.value)
                        }
                        placeholder={nameplateLabels[field]}
                        className="field-input"
                      />
                    </div>
                  )
                )}
                <button type="submit" className="btn-submit" disabled={savingNameplate}>
                  {savingNameplate ? "Saving..." : "Save nameplate"}
                </button>
              </form>
            </div>
          </div>

          {/* Attachments */}
          <AttachmentsPanel entityType="asset" entityId={asset.id} />

          {/* PM Schedules */}
          <div className="detail-card">
            <div className="card-header">
              <h2>PM Schedules ({pmSchedules.length})</h2>
              <Link
                href={`/pm-schedules/new?assetId=${asset.id}`}
                className="btn-primary"
              >
                + Create PM Schedule
              </Link>
            </div>
            <div className="card-body">
              {pmSchedules.length === 0 ? (
                <div className="empty-state">
                  <p>No PM schedules configured for this equipment.</p>
                </div>
              ) : (
                <div className="pm-list">
                  {pmSchedules.map((pm) => (
                    <Link
                      key={pm.id}
                      href={`/pm-schedules/${pm.id}`}
                      className="pm-item"
                    >
                      <div className="pm-item-header">
                        <span className="pm-item-name">{pm.name}</span>
                        <span className={`status-badge ${pm.status?.toLowerCase() || "active"}`}>
                          {pm.status}
                        </span>
                      </div>
                      <div className="pm-item-detail">
                        Every {pm.frequencyValue}{" "}
                        {pm.frequencyType.toLowerCase().replace("ly", pm.frequencyValue === 1 ? "" : "s")}
                        {pm.nextScheduledDate && (
                          <> &bull; Next: {new Date(pm.nextScheduledDate).toLocaleDateString()}</>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
