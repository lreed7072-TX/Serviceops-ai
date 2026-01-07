"use client";

import { useRef, useEffect, useState } from "react";

type SignaturePadProps = {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  signerName: string;
  setSignerName: (name: string) => void;
  signerTitle?: string;
  setSignerTitle?: (title: string) => void;
  signatureType: "CUSTOMER" | "TECH" | "WITNESS";
  saving?: boolean;
};

export function SignaturePad({
  onSave,
  onCancel,
  signerName,
  setSignerName,
  signerTitle,
  setSignerTitle,
  signatureType,
  saving,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Clear canvas with white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature || !signerName.trim()) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  const typeLabels = { CUSTOMER: "Customer", TECH: "Technician", WITNESS: "Witness" };

  return (
    <div className="signature-pad-container">
      <h3>{typeLabels[signatureType]} Signature</h3>
      
      <div className="form-field">
        <label>Name *</label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Full name"
          required
        />
      </div>

      {setSignerTitle && (
        <div className="form-field">
          <label>Title (optional)</label>
          <input
            type="text"
            value={signerTitle ?? ""}
            onChange={(e) => setSignerTitle(e.target.value)}
            placeholder="e.g., Plant Manager"
          />
        </div>
      )}

      <div className="signature-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <p className="signature-hint">Sign above</p>
      </div>

      <div className="signature-actions">
        <button type="button" className="btn btn-secondary" onClick={clearSignature}>
          Clear
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!hasSignature || !signerName.trim() || saving}
        >
          {saving ? "Saving..." : "Save Signature"}
        </button>
      </div>
    </div>
  );
}
