import PDFDocument from "pdfkit";

// Colors
const PRIMARY = "#3b82f6";
const SUCCESS = "#10b981";
const WARNING = "#f59e0b";
const DANGER = "#ef4444";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG_LIGHT = "#f9fafb";

const STATUS_COLORS: Record<string, string> = {
  OPEN: PRIMARY,
  IN_PROGRESS: WARNING,
  COMPLETED: SUCCESS,
  CANCELED: "#9ca3af",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: MUTED,
  IN_PROGRESS: WARNING,
  DONE: SUCCESS,
  BLOCKED: DANGER,
  SKIPPED: "#9ca3af",
};

const FINDING_PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6b7280",
  MEDIUM: WARNING,
  HIGH: "#f97316",
  CRITICAL: DANGER,
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function generateServiceReportPDF(workOrder: any, org: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = 50;

      // ── HEADER ──
      doc.fontSize(22).fillColor(PRIMARY).text(org?.name || "ServiceOpsIQ", 50, y);
      doc.fontSize(10).fillColor(MUTED).text("Field Service Report", 50, y + 28);

      const woNum = workOrder.workOrderNumber || `WO-${workOrder.id.slice(0, 8).toUpperCase()}`;
      doc.fontSize(20).fillColor(TEXT).text(woNum, 350, y, { align: "right" });
      const statusColor = STATUS_COLORS[workOrder.status] || MUTED;
      doc.fontSize(11).fillColor(statusColor).text(workOrder.status.replace("_", " "), 350, y + 26, { align: "right" });
      y = 100;

      // Divider
      doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
      y += 12;

      // Title
      doc.fontSize(14).fillColor(TEXT).text(workOrder.title, 50, y, { width: 512 });
      y += doc.heightOfString(workOrder.title, { width: 512 }) + 8;

      // ── CUSTOMER & SITE ──
      doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
      y += 12;
      doc.fontSize(9).fillColor(MUTED).text("CUSTOMER & LOCATION", 50, y);
      y += 16;

      if (workOrder.customer) {
        doc.fontSize(10).fillColor(MUTED).text("Customer:", 50, y);
        doc.fillColor(TEXT).text(workOrder.customer.name, 120, y);
        y += 15;
        if (workOrder.customer.primaryPhone) {
          doc.fontSize(9).fillColor(MUTED).text(workOrder.customer.primaryPhone, 120, y);
          y += 12;
        }
      }
      if (workOrder.site) {
        doc.fontSize(10).fillColor(MUTED).text("Site:", 300, y - 27);
        doc.fillColor(TEXT).text(workOrder.site.name, 340, y - 27);
        if (workOrder.site.address) {
          doc.fontSize(9).fillColor(MUTED).text(workOrder.site.address, 340, y - 15, { width: 222 });
        }
      }
      if (workOrder.asset) {
        doc.fontSize(10).fillColor(MUTED).text("Asset:", 50, y);
        doc.fillColor(TEXT).text(workOrder.asset.name, 120, y);
        y += 15;
        const assetDetails = [
          workOrder.asset.serialNumber ? `S/N: ${workOrder.asset.serialNumber}` : null,
          workOrder.asset.manufacturer ? workOrder.asset.manufacturer : null,
          workOrder.asset.model ? workOrder.asset.model : null,
        ].filter(Boolean).join(" | ");
        if (assetDetails) {
          doc.fontSize(9).fillColor(MUTED).text(assetDetails, 120, y, { width: 440 });
          y += 12;
        }
      }
      y += 8;

      // ── SUMMARY METRICS ──
      const allTasks = workOrder.packages.flatMap((p: any) => p.tasks);
      const completedTasks = allTasks.filter((t: any) => t.status === "DONE");
      const totalLaborSeconds = allTasks
        .flatMap((t: any) => t.timeEntries || [])
        .reduce((sum: number, e: any) => sum + (e.accumulatedSeconds || 0), 0);
      const totalLaborHours = Math.round((totalLaborSeconds / 3600) * 10) / 10;
      const totalMaterialsCost = allTasks
        .flatMap((t: any) => t.materialUsages || [])
        .reduce((sum: number, m: any) => sum + (m.totalCost || 0), 0);
      const allFindings = allTasks.flatMap((t: any) => t.findings || []);
      const criticalFindings = allFindings.filter((f: any) => f.priority === "CRITICAL" || f.priority === "HIGH");
      const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

      doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
      y += 12;
      doc.fontSize(9).fillColor(MUTED).text("SUMMARY", 50, y);
      y += 16;

      doc.rect(50, y, 512, 55).fill(BG_LIGHT);
      const cols = [70, 180, 290, 400, 490];
      doc.fontSize(8).fillColor(MUTED);
      doc.text("Completion", cols[0], y + 8);
      doc.text("Labor Hours", cols[1], y + 8);
      doc.text("Materials", cols[2], y + 8);
      doc.text("Findings", cols[3], y + 8);
      doc.text("Status", cols[4], y + 8);

      doc.fontSize(14).fillColor(TEXT);
      doc.text(`${completionRate}%`, cols[0], y + 22);
      doc.text(`${totalLaborHours}h`, cols[1], y + 22);
      doc.text(`$${totalMaterialsCost.toFixed(2)}`, cols[2], y + 22);
      doc.fillColor(criticalFindings.length > 0 ? DANGER : TEXT).text(`${allFindings.length}`, cols[3], y + 22);
      doc.fillColor(statusColor).text(workOrder.status.replace("_", " "), cols[4], y + 22);

      doc.fontSize(8).fillColor(MUTED);
      doc.text(`${completedTasks.length}/${allTasks.length} tasks`, cols[0], y + 40);
      if (criticalFindings.length > 0) {
        doc.fillColor(DANGER).text(`${criticalFindings.length} critical/high`, cols[3], y + 40);
      }
      y += 65;

      // ── TASKS BY PACKAGE ──
      for (const pkg of workOrder.packages) {
        if (y > 680) { doc.addPage(); y = 50; }

        doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
        y += 12;

        const pkgDone = pkg.tasks.filter((t: any) => t.status === "DONE").length;
        doc.fontSize(10).fillColor(TEXT).text(pkg.name, 50, y);
        doc.fontSize(9).fillColor(MUTED).text(`${pkgDone}/${pkg.tasks.length} completed`, 350, y, { align: "right" });
        y += 18;

        // Task table header
        doc.rect(50, y, 512, 18).fill(BG_LIGHT);
        doc.fontSize(8).fillColor(MUTED);
        doc.text("#", 55, y + 5, { width: 25 });
        doc.text("TASK", 80, y + 5, { width: 250 });
        doc.text("TECH", 335, y + 5, { width: 100 });
        doc.text("STATUS", 440, y + 5, { width: 80, align: "right" });
        y += 18;

        for (const task of pkg.tasks) {
          if (y > 710) { doc.addPage(); y = 50; }
          doc.fontSize(9).fillColor(TEXT);
          doc.text(task.sequenceNumber?.toString() || "-", 55, y + 3, { width: 25 });
          const taskTitle = task.isCritical ? `${task.title} *` : task.title;
          doc.text(taskTitle, 80, y + 3, { width: 250 });
          doc.fontSize(8).fillColor(MUTED).text(task.assignedTo?.name || "-", 335, y + 3, { width: 100 });
          doc.fillColor(TASK_STATUS_COLORS[task.status] || MUTED).text(task.status.replace("_", " "), 440, y + 3, { width: 80, align: "right" });
          y += 16;
          doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
        }
        y += 8;

        // Measurements for this package's tasks
        const pkgMeasurements = pkg.tasks.flatMap((t: any) => (t.measurements || []).map((m: any) => ({ ...m, taskTitle: t.title })));
        if (pkgMeasurements.length > 0) {
          if (y > 680) { doc.addPage(); y = 50; }
          doc.fontSize(9).fillColor(TEXT).text("Measurements:", 60, y);
          y += 14;
          for (const m of pkgMeasurements) {
            if (y > 710) { doc.addPage(); y = 50; }
            const name = m.name || m.measurementDefinition?.name || "Measurement";
            const unit = m.unit || m.measurementDefinition?.unit || "";
            let value = "";
            if (m.numericValue !== null && m.numericValue !== undefined) value = `${m.numericValue}`;
            else if (m.textValue) value = m.textValue;
            else if (m.passFail !== null && m.passFail !== undefined) value = m.passFail ? "PASS" : "FAIL";

            const specStatus = m.isWithinSpec === false ? " [OUT OF SPEC]" : "";
            doc.fontSize(8).fillColor(MUTED).text(`  ${name}: `, 70, y);
            doc.fillColor(m.isWithinSpec === false ? DANGER : TEXT).text(`${value} ${unit}${specStatus}`, 200, y);
            y += 12;
          }
          y += 4;
        }

        // Materials for this package's tasks
        const pkgMaterials = pkg.tasks.flatMap((t: any) => (t.materialUsages || []).map((m: any) => ({ ...m, taskTitle: t.title })));
        if (pkgMaterials.length > 0) {
          if (y > 680) { doc.addPage(); y = 50; }
          doc.fontSize(9).fillColor(TEXT).text("Materials Used:", 60, y);
          y += 14;
          for (const m of pkgMaterials) {
            if (y > 710) { doc.addPage(); y = 50; }
            const cost = m.totalCost ? ` — $${Number(m.totalCost).toFixed(2)}` : "";
            doc.fontSize(8).fillColor(TEXT).text(`  ${m.name}`, 70, y);
            doc.fillColor(MUTED).text(`${m.quantity} ${m.unit || "ea"}${cost}`, 250, y);
            y += 12;
          }
          y += 4;
        }
      }

      // ── FINDINGS & RECOMMENDATIONS ──
      if (allFindings.length > 0) {
        if (y > 620) { doc.addPage(); y = 50; }
        doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
        y += 12;
        doc.fontSize(10).fillColor(TEXT).text("FINDINGS & RECOMMENDATIONS", 50, y);
        y += 18;

        for (const finding of allFindings) {
          if (y > 680) { doc.addPage(); y = 50; }
          const prioColor = FINDING_PRIORITY_COLORS[finding.priority] || MUTED;
          doc.fontSize(9).fillColor(prioColor).text(`[${finding.priority}]`, 55, y);
          doc.fillColor(TEXT).text(finding.category, 105, y);
          y += 14;
          doc.fontSize(8).fillColor(TEXT).text(finding.details, 65, y, { width: 490 });
          y += doc.heightOfString(finding.details, { width: 490 }) + 4;
          if (finding.createdByUser) {
            doc.fontSize(7).fillColor(MUTED).text(`— ${finding.createdByUser.name || finding.createdByUser.email}`, 65, y);
            y += 10;
          }
          y += 4;
        }
      }

      // ── SITE CHECK-INS ──
      if (workOrder.siteCheckIns?.length > 0) {
        if (y > 650) { doc.addPage(); y = 50; }
        doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
        y += 12;
        doc.fontSize(10).fillColor(TEXT).text("SITE ATTENDANCE", 50, y);
        y += 18;

        for (const ci of workOrder.siteCheckIns) {
          if (y > 710) { doc.addPage(); y = 50; }
          const inTime = new Date(ci.checkInAt).toLocaleString();
          const outTime = ci.checkOutAt ? new Date(ci.checkOutAt).toLocaleString() : "Still on site";
          doc.fontSize(8).fillColor(TEXT).text(ci.user?.name || ci.user?.email || "Tech", 60, y);
          doc.fillColor(MUTED).text(`In: ${inTime}  |  Out: ${outTime}`, 180, y, { width: 380 });
          y += 14;
        }
        y += 4;
      }

      // ── SIGNATURES ──
      if (workOrder.signatures?.length > 0) {
        if (y > 620) { doc.addPage(); y = 50; }
        doc.moveTo(50, y).lineTo(562, y).strokeColor(BORDER).stroke();
        y += 12;
        doc.fontSize(10).fillColor(TEXT).text("SIGNATURES", 50, y);
        y += 18;

        for (const sig of workOrder.signatures) {
          if (y > 660) { doc.addPage(); y = 50; }

          // Signature image
          if (sig.signatureData && sig.signatureData.startsWith("data:image")) {
            try {
              const base64Data = sig.signatureData.split(",")[1];
              const imgBuffer = Buffer.from(base64Data, "base64");
              doc.image(imgBuffer, 60, y, { width: 200, height: 60 });
            } catch {
              doc.fontSize(8).fillColor(MUTED).text("[Signature on file]", 60, y);
            }
          } else {
            doc.fontSize(8).fillColor(MUTED).text("[Signature on file]", 60, y);
          }

          doc.fontSize(9).fillColor(TEXT).text(sig.signerName, 280, y + 5);
          doc.fontSize(8).fillColor(MUTED).text(sig.signatureType, 280, y + 18);
          if (sig.signerTitle) doc.text(sig.signerTitle, 280, y + 30);
          doc.text(new Date(sig.signedAt).toLocaleString(), 280, y + 42);

          // Signature line
          doc.moveTo(60, y + 60).lineTo(260, y + 60).strokeColor(BORDER).stroke();
          y += 75;
        }
      }

      // ── FOOTER ──
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor(MUTED).text(
          `Page ${i + 1} of ${pageCount} | Service Report generated ${new Date().toLocaleString()} | ${org?.name || "ServiceOpsIQ"}`,
          50, 750, { align: "center", width: 512 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
