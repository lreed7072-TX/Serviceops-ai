"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { exportToCSV } from "@/lib/export";
import type { ExportColumn } from "@/lib/export";
import ExportButton from "@/components/filters/ExportButton";
import "./audit-logs.css";

type AuditLogEntry = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  changes: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "al-green",
  UPDATE: "al-blue",
  DELETE: "al-red",
  ARCHIVE: "al-gray",
  RESTORE: "al-blue",
  STATUS_CHANGE: "al-yellow",
  ASSIGN: "al-purple",
  COMPLETE: "al-green",
  APPROVE: "al-green",
  REJECT: "al-red",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filterEntityType) params.set("entityType", filterEntityType);
      if (filterAction) params.set("action", filterAction);

      const res = await apiFetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to load audit logs");
      }
      const data = await res.json();
      setLogs(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [filterEntityType, filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = () => {
    const columns: ExportColumn<AuditLogEntry>[] = [
      { header: "Timestamp", accessor: (log) => new Date(log.createdAt).toISOString() },
      { header: "User", accessor: (log) => log.user.name || log.user.email },
      { header: "Email", accessor: (log) => log.user.email },
      { header: "Action", accessor: (log) => log.action },
      { header: "Entity Type", accessor: (log) => log.entityType },
      { header: "Entity Name", accessor: (log) => log.entityName },
      { header: "Changes", accessor: (log) => log.changes },
    ];
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCSV(logs, columns, `audit-logs-${timestamp}`);
  };

  if (error) {
    return (
      <div className="al-page">
        <div className="page-alert error">{error}</div>
      </div>
    );
  }

  return (
    <div className="al-page">
      <div className="al-header">
        <div>
          <h1>Audit Logs</h1>
          <p className="al-subtitle">
            System activity and change history{!loading && ` (${logs.length} entries)`}
          </p>
        </div>
        <ExportButton
          onClick={handleExport}
          disabled={logs.length === 0}
          label="Export Logs"
        />
      </div>

      <div className="al-filters">
        <select
          className="al-filter-select"
          value={filterEntityType}
          onChange={(e) => setFilterEntityType(e.target.value)}
        >
          <option value="">All Entity Types</option>
          <option value="WORK_ORDER">Work Orders</option>
          <option value="QUOTE">Quotes</option>
          <option value="INVOICE">Invoices</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SITE">Sites</option>
          <option value="ASSET">Assets</option>
          <option value="USER">Users</option>
          <option value="PM_SCHEDULE">PM Schedules</option>
          <option value="TASK">Tasks</option>
        </select>

        <select
          className="al-filter-select"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="STATUS_CHANGE">Status Change</option>
          <option value="ASSIGN">Assign</option>
          <option value="APPROVE">Approve</option>
          <option value="REJECT">Reject</option>
        </select>
      </div>

      {loading ? (
        <div className="al-loading">Loading audit logs...</div>
      ) : logs.length === 0 ? (
        <div className="al-empty">
          <p>No audit log entries found.</p>
        </div>
      ) : (
        <div className="al-table-wrap">
          <table className="al-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="al-ts">{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="al-user-name">{log.user.name || "—"}</div>
                    <div className="al-user-email">{log.user.email}</div>
                  </td>
                  <td>
                    <span className={`al-action-badge ${ACTION_COLORS[log.action] || "al-gray"}`}>
                      {log.action.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="al-entity-type">{log.entityType.replace("_", " ")}</div>
                    {log.entityName && <div className="al-entity-name">{log.entityName}</div>}
                  </td>
                  <td className="al-changes">
                    {log.changes ? <code>{log.changes}</code> : <span className="al-none">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
