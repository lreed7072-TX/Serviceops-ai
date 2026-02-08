"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { SignaturePad } from "@/components/SignaturePad";
import "./SignaturePanel.css";

type SignatureType = "CUSTOMER" | "TECH" | "WITNESS";

type SignatureRecord = {
  id: string;
  signatureType: SignatureType;
  signerName: string;
  signerTitle: string | null;
  signatureData: string;
  signedAt: string;
  capturedBy: { id: string; name: string | null } | null;
};

interface SignaturePanelProps {
  workOrderId: string;
}

const TYPE_LABELS: Record<SignatureType, string> = {
  CUSTOMER: "Customer",
  TECH: "Technician",
  WITNESS: "Witness",
};

export default function SignaturePanel({ workOrderId }: SignaturePanelProps) {
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturingType, setCapturingType] = useState<SignatureType | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSignatures = async () => {
    try {
      const res = await apiFetch(`/api/work-orders/${workOrderId}/signatures`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setSignatures(json.data ?? []);
      }
    } catch {
      // Signatures are supplementary
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const handleSave = async (dataUrl: string) => {
    if (!capturingType) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/work-orders/${workOrderId}/signatures`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signatureType: capturingType,
          signerName: signerName.trim(),
          signerTitle: signerTitle.trim() || null,
          signatureData: dataUrl,
        }),
      });
      if (!res.ok) throw new Error("Failed to save signature");
      setCapturingType(null);
      setSignerName("");
      setSignerTitle("");
      await fetchSignatures();
    } catch {
      setError("Failed to save signature");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCapturingType(null);
    setSignerName("");
    setSignerTitle("");
  };

  const openCapture = (type: SignatureType) => {
    setSignerName("");
    setSignerTitle("");
    setError(null);
    setCapturingType(type);
  };

  return (
    <div className="sp-container">
      {error && <div className="sp-error">{error}</div>}

      {/* Capture Buttons */}
      <div className="sp-capture-row">
        <button className="btn btn-primary sp-capture-btn" onClick={() => openCapture("CUSTOMER")}>
          Customer Signature
        </button>
        <button className="btn btn-secondary sp-capture-btn" onClick={() => openCapture("TECH")}>
          Technician Signature
        </button>
        <button className="btn btn-secondary sp-capture-btn" onClick={() => openCapture("WITNESS")}>
          Witness Signature
        </button>
      </div>

      {/* Existing Signatures */}
      {loading ? (
        <p className="sp-empty">Loading signatures...</p>
      ) : signatures.length === 0 ? (
        <p className="sp-empty">No signatures captured yet</p>
      ) : (
        <div className="sp-gallery">
          {signatures.map((sig) => (
            <div key={sig.id} className="sp-sig-card">
              <div className="sp-sig-preview">
                <img src={sig.signatureData} alt={`${sig.signerName} signature`} />
              </div>
              <div className="sp-sig-info">
                <span className={`sp-sig-type ${sig.signatureType.toLowerCase()}`}>
                  {TYPE_LABELS[sig.signatureType]}
                </span>
                <p className="sp-sig-name">{sig.signerName}</p>
                {sig.signerTitle && <p className="sp-sig-title">{sig.signerTitle}</p>}
                <p className="sp-sig-meta">
                  {new Date(sig.signedAt).toLocaleString()}
                  {sig.capturedBy?.name && ` — Captured by ${sig.capturedBy.name}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signature Capture Modal */}
      {capturingType && (
        <div className="sp-modal-overlay" onClick={() => !saving && handleCancel()}>
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <SignaturePad
              signatureType={capturingType}
              signerName={signerName}
              setSignerName={setSignerName}
              signerTitle={signerTitle}
              setSignerTitle={setSignerTitle}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
