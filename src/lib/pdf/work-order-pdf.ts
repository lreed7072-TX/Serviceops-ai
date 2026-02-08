import PDFDocument from "pdfkit";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sequenceNumber: number | null;
  isCritical: boolean;
  assignedTo: {
    name: string | null;
  } | null;
}

interface WorkPackage {
  id: string;
  packageType: string;
  tasks: Task[];
}

interface WorkOrderData {
  workOrderNumber: string | null;
  title: string;
  description: string | null;
  status: string;
  executionMode: string;
  orderType: string;
  priority: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  createdAt: string;
  customer: {
    name: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
  } | null;
  site: {
    name: string;
    address: string | null;
  } | null;
  asset: {
    name: string;
    serialNumber: string | null;
    assetTag: string | null;
  } | null;
  packages: WorkPackage[];
  summary: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalLaborHours: number;
    totalMaterialCost: number;
  };
  orgName: string;
}

export async function generateWorkOrderPDF(workOrder: WorkOrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 50,
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Colors
      const primaryColor = "#3b82f6";
      const successColor = "#10b981";
      const warningColor = "#f59e0b";
      const dangerColor = "#ef4444";
      const textColor = "#111827";
      const mutedColor = "#6b7280";
      const borderColor = "#e5e7eb";

      // Status colors
      const statusColors: Record<string, string> = {
        OPEN: "#3b82f6",
        IN_PROGRESS: "#f59e0b",
        COMPLETED: "#10b981",
        CANCELED: "#9ca3af",
      };

      // Priority labels
      const priorityLabels: Record<number, string> = {
        1: "Low",
        2: "Normal",
        3: "High",
        4: "Urgent",
      };

      // Header - Company Info
      doc.fontSize(24).fillColor(primaryColor).text(workOrder.orgName, 50, 50);
      doc.fontSize(10).fillColor(mutedColor).text("Work Order", 50, 80);

      // Work Order Number & Status (right aligned)
      const woNumber = workOrder.workOrderNumber || `WO-${Date.now().toString(36).toUpperCase()}`;
      doc.fontSize(24).fillColor(textColor).text(woNumber, 350, 50, { align: "right" });

      const statusColor = statusColors[workOrder.status] || "#6b7280";
      doc.fontSize(12).fillColor(statusColor).text(workOrder.status.replace("_", " "), 350, 80, { align: "right" });

      // Divider
      doc.moveTo(50, 105).lineTo(562, 105).strokeColor(borderColor).stroke();

      // Work Order Title
      let yPos = 120;
      doc.fontSize(16).fillColor(textColor).text(workOrder.title, 50, yPos);
      yPos += 25;

      // Type badges row
      doc.fontSize(9).fillColor(mutedColor);
      const orderTypeLabel = workOrder.orderType.replace("_", " ");
      const execModeLabel = workOrder.executionMode === "UNIFIED" ? "Unified" : "Multi-Lane";
      doc.text(`${orderTypeLabel} | ${execModeLabel}`, 50, yPos);
      yPos += 20;

      // Customer & Site Section
      doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
      yPos += 15;

      doc.fontSize(10).fillColor(mutedColor).text("CUSTOMER & LOCATION", 50, yPos);
      yPos += 18;

      // Two column layout for customer/site
      const leftColX = 50;
      const rightColX = 300;

      if (workOrder.customer) {
        doc.fontSize(10).fillColor(mutedColor).text("Customer:", leftColX, yPos);
        doc.fillColor(textColor).text(workOrder.customer.name, leftColX + 60, yPos);
        yPos += 15;
        if (workOrder.customer.primaryPhone) {
          doc.fontSize(9).fillColor(mutedColor).text(workOrder.customer.primaryPhone, leftColX + 60, yPos);
          yPos += 12;
        }
        if (workOrder.customer.primaryEmail) {
          doc.fontSize(9).fillColor(mutedColor).text(workOrder.customer.primaryEmail, leftColX + 60, yPos);
          yPos += 12;
        }
      }

      let siteY = yPos - 39; // Reset to same row as customer
      if (workOrder.site) {
        doc.fontSize(10).fillColor(mutedColor).text("Site:", rightColX, siteY);
        doc.fillColor(textColor).text(workOrder.site.name, rightColX + 35, siteY);
        siteY += 15;
        if (workOrder.site.address) {
          doc.fontSize(9).fillColor(mutedColor).text(workOrder.site.address, rightColX + 35, siteY, { width: 200 });
        }
      }

      yPos = Math.max(yPos, siteY + 20) + 10;

      // Asset info
      if (workOrder.asset) {
        doc.fontSize(10).fillColor(mutedColor).text("Asset:", leftColX, yPos);
        doc.fillColor(textColor).text(workOrder.asset.name, leftColX + 60, yPos);
        yPos += 15;
        if (workOrder.asset.serialNumber || workOrder.asset.assetTag) {
          const assetDetails = [
            workOrder.asset.serialNumber ? `S/N: ${workOrder.asset.serialNumber}` : null,
            workOrder.asset.assetTag ? `Tag: ${workOrder.asset.assetTag}` : null,
          ].filter(Boolean).join(" | ");
          doc.fontSize(9).fillColor(mutedColor).text(assetDetails, leftColX + 60, yPos, { width: 400 });
        }
        yPos += 20;
      }

      // Schedule & Priority Section
      yPos += 5;
      doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
      yPos += 15;

      doc.fontSize(10).fillColor(mutedColor).text("SCHEDULE & DETAILS", 50, yPos);
      yPos += 18;

      // Grid of details
      doc.fontSize(10).fillColor(mutedColor).text("Created:", leftColX, yPos);
      doc.fillColor(textColor).text(new Date(workOrder.createdAt).toLocaleDateString(), leftColX + 70, yPos);

      if (workOrder.priority) {
        doc.fillColor(mutedColor).text("Priority:", rightColX, yPos);
        const priorityLabel = priorityLabels[workOrder.priority] || "Normal";
        doc.fillColor(workOrder.priority >= 3 ? dangerColor : textColor).text(priorityLabel, rightColX + 50, yPos);
      }
      yPos += 18;

      if (workOrder.scheduledStart) {
        doc.fillColor(mutedColor).text("Scheduled:", leftColX, yPos);
        doc.fillColor(textColor).text(new Date(workOrder.scheduledStart).toLocaleString(), leftColX + 70, yPos);
        yPos += 18;
      }

      // Description
      if (workOrder.description) {
        yPos += 10;
        doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
        yPos += 15;
        doc.fontSize(10).fillColor(mutedColor).text("DESCRIPTION", 50, yPos);
        yPos += 18;
        doc.fontSize(10).fillColor(textColor).text(workOrder.description, 50, yPos, { width: 512 });
        yPos += doc.heightOfString(workOrder.description, { width: 512 }) + 10;
      }

      // Tasks Section
      yPos += 10;
      doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
      yPos += 15;

      const allTasks = workOrder.packages.flatMap((pkg) => pkg.tasks);
      doc.fontSize(10).fillColor(mutedColor).text(`TASKS (${workOrder.summary.completedTasks}/${workOrder.summary.totalTasks} completed)`, 50, yPos);
      yPos += 20;

      if (allTasks.length === 0) {
        doc.fontSize(10).fillColor(mutedColor).text("No tasks assigned", 50, yPos);
        yPos += 20;
      } else {
        // Task table header
        doc.rect(50, yPos, 512, 22).fill("#f9fafb");
        doc.fontSize(9).fillColor(mutedColor);
        doc.text("#", 55, yPos + 7, { width: 25 });
        doc.text("TASK", 85, yPos + 7, { width: 280 });
        doc.text("ASSIGNED", 370, yPos + 7, { width: 100 });
        doc.text("STATUS", 480, yPos + 7, { width: 77, align: "right" });
        yPos += 22;

        // Sort tasks by sequence
        const sortedTasks = [...allTasks].sort((a, b) => (a.sequenceNumber || 999) - (b.sequenceNumber || 999));

        for (const task of sortedTasks) {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          const taskStatusColors: Record<string, string> = {
            PENDING: "#6b7280",
            IN_PROGRESS: "#f59e0b",
            DONE: "#10b981",
            BLOCKED: "#ef4444",
            SKIPPED: "#9ca3af",
          };

          doc.fontSize(10).fillColor(textColor);
          doc.text(task.sequenceNumber?.toString() || "-", 55, yPos + 5, { width: 25 });

          const taskTitle = task.isCritical ? `${task.title} ⚠️` : task.title;
          doc.text(taskTitle, 85, yPos + 5, { width: 280 });

          doc.fontSize(9).fillColor(mutedColor);
          doc.text(task.assignedTo?.name || "-", 370, yPos + 5, { width: 100 });

          doc.fillColor(taskStatusColors[task.status] || mutedColor);
          doc.text(task.status.replace("_", " "), 480, yPos + 5, { width: 77, align: "right" });

          yPos += 22;
          doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
        }
      }

      // Summary Section
      yPos += 20;
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }

      doc.moveTo(50, yPos).lineTo(562, yPos).strokeColor(borderColor).stroke();
      yPos += 15;

      doc.fontSize(10).fillColor(mutedColor).text("SUMMARY", 50, yPos);
      yPos += 20;

      // Summary box
      doc.rect(50, yPos, 512, 80).fill("#f9fafb");

      const summaryCol1X = 70;
      const summaryCol2X = 200;
      const summaryCol3X = 350;
      const summaryCol4X = 480;

      yPos += 15;
      doc.fontSize(9).fillColor(mutedColor).text("Completion", summaryCol1X, yPos);
      doc.text("Labor Hours", summaryCol2X, yPos);
      doc.text("Material Cost", summaryCol3X, yPos);
      doc.text("Status", summaryCol4X, yPos);

      yPos += 18;
      doc.fontSize(16).fillColor(textColor);
      doc.text(`${Math.round(workOrder.summary.completionRate)}%`, summaryCol1X, yPos);
      doc.text(`${workOrder.summary.totalLaborHours}h`, summaryCol2X, yPos);
      doc.text(`$${workOrder.summary.totalMaterialCost.toFixed(2)}`, summaryCol3X, yPos);
      doc.fillColor(statusColor).text(workOrder.status.replace("_", " "), summaryCol4X, yPos);

      yPos += 25;
      doc.fontSize(9).fillColor(mutedColor);
      doc.text(`${workOrder.summary.completedTasks}/${workOrder.summary.totalTasks} tasks`, summaryCol1X, yPos);

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(mutedColor).text(
          `Page ${i + 1} of ${pageCount} | Generated ${new Date().toLocaleString()}`,
          50,
          750,
          { align: "center", width: 512 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
