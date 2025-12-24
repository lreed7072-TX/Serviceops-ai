"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Asset, Site } from "@prisma/client";
import { apiFetch } from "@/lib/api";

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
    <div>
      {notice && (
        <div
          className="page-alert"
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            width: "min(360px, calc(100% - 48px))",
            background: notice.type === "success" ? "#ecfdf3" : undefined,
            borderColor: notice.type === "success" ? "#bbf7d0" : undefined,
            color: notice.type === "success" ? "#166534" : undefined,
            zIndex: 50,
          }}
        >
          {notice.message}
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>{asset?.name ?? "Asset detail"}</h2>
          <p>Expanded asset detail with nameplate metadata.</p>
        </div>
        <span className="badge">Org scoped</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link className="link-button" href="/assets">
          ← Back to assets
        </Link>
        <Link className="link-button" href="/work-orders">
          Work orders
        </Link>
      </div>

      {error && <div className="page-alert error">{error}</div>}
      {loading && !error && <div className="page-alert info">Loading asset…</div>}

      {!loading && !asset && !error && (
        <div className="page-alert error">Not found or no access.</div>
      )}

      {asset && (
        <>
          <div className="card">
            <h3>Overview</h3>
            <dl className="detail-grid">
              <div>
                <dt>Name</dt>
                <dd>{formatValue(asset.name)}</dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>{site?.name ?? formatValue(asset.siteId)}</dd>
              </div>
              <div>
                <dt>Manufacturer</dt>
                <dd>{formatValue(asset.manufacturer)}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{formatValue(asset.model)}</dd>
              </div>
              <div>
                <dt>Serial</dt>
                <dd>{formatValue(asset.serialNumber)}</dd>
              </div>
              <div>
                <dt>Tag</dt>
                <dd>{formatValue(asset.assetTag)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{formatEnumValue(asset.status)}</dd>
              </div>
              <div>
                <dt>Criticality</dt>
                <dd>{formatEnumValue(asset.criticality ?? "")}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{formatValue(asset.location)}</dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Notes</h3>
            </div>
            <p>{notesText ? notesText : "No notes yet."}</p>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Nameplate</h3>
              <span className="muted">
                Schema v{asset.nameplateSchemaVersion ?? "—"}
              </span>
            </div>
            <form
              className="form-grid"
              onSubmit={(event) => {
                event.preventDefault();
                handleNameplateSave();
              }}
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              {(Object.keys(nameplateLabels) as Array<keyof NameplateFormState>).map(
                (field) => (
                  <label className="form-field" key={field}>
                    {nameplateLabels[field]}
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
                    />
                  </label>
                )
              )}
              <button type="submit" disabled={savingNameplate}>
                {savingNameplate ? "Saving..." : "Save nameplate"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
