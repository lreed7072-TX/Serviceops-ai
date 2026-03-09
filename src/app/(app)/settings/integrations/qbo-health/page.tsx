"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Users,
  FileText,
  Package,
  Receipt,
  Calculator,
  ArrowLeft,
} from "lucide-react";
import "./qbo-health.css";

/* ── Type definitions matching API response shapes ── */

type ConnectionInfo = {
  realmId: string;
  companyName: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
};

type EntityStat = {
  lastSync: string | null;
  successCount: number;
  failedCount: number;
};

type QueueStats = {
  pending: number;
  claimed: number;
  deadLetter: number;
  completed: number;
};

type HealthData = {
  connected: boolean;
  connection: ConnectionInfo | null;
  entityStats: Record<string, EntityStat>;
  queueStats: QueueStats | null;
};

type SyncLogEntry = {
  id: string;
  entityType: string;
  entityId: string | null;
  qboEntityId: string | null;
  action: string;
  status: string;
  errorMessage: string | null;
  resolutionHint: string | null;
  createdAt: string;
};

/* ── Entity metadata for display ── */

const ENTITY_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> ; triggerType: string }> = {
  customer: { label: "Customers", icon: Users, triggerType: "customers" },
  invoice: { label: "Invoices", icon: Receipt, triggerType: "invoices" },
  item: { label: "Items", icon: Package, triggerType: "items" },
  estimate: { label: "Estimates", icon: Calculator, triggerType: "estimates" },
  payment: { label: "Payments", icon: FileText, triggerType: "" },
};

/* ── Helpers ── */

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/* ── Component ── */

export default function QboHealthPage() {
  const toast = useToast();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [filterEntity, setFilterEntity] = useState<string>("");
  const [logsOffset, setLogsOffset] = useState(0);
  const LOGS_LIMIT = 20;

  const fetchHealth = useCallback(async () => {
    try {
      const res = await apiFetch("/api/integrations/qbo/health");
      if (res.ok) {
        const json = await res.json();
        setHealth(json.data);
      }
    } catch {
      toast.error("Failed to load health data");
    }
  }, [toast]);

  const fetchLogs = useCallback(async (offset = 0, entityType = "") => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({
        status: "failed",
        limit: String(LOGS_LIMIT),
        offset: String(offset),
      });
      if (entityType) params.set("entityType", entityType);

      const res = await apiFetch(`/api/integrations/qbo/sync-logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (offset === 0) {
          setLogs(json.data);
        } else {
          setLogs((prev) => [...prev, ...json.data]);
        }
        setLogsTotal(json.total);
        setLogsOffset(offset + json.data.length);
      }
    } catch {
      toast.error("Failed to load sync logs");
    } finally {
      setLogsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchHealth(), fetchLogs(0, "")]);
      setLoading(false);
    };
    init();
  }, [fetchHealth, fetchLogs]);

  const triggerSync = async (entityType: string) => {
    setSyncing((prev) => ({ ...prev, [entityType]: true }));
    try {
      const res = await apiFetch("/api/integrations/qbo/sync-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Sync trigger failed");
      }
      const json = await res.json();
      toast.success(`Enqueued ${json.data.enqueued} ${entityType} for sync`);
      // Refresh health after triggering
      setTimeout(() => fetchHealth(), 2000);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to trigger sync");
    } finally {
      setSyncing((prev) => ({ ...prev, [entityType]: false }));
    }
  };

  const handleFilterChange = (entityType: string) => {
    setFilterEntity(entityType);
    setLogs([]);
    setLogsOffset(0);
    fetchLogs(0, entityType);
  };

  const handleLoadMore = () => {
    fetchLogs(logsOffset, filterEntity);
  };

  if (loading) {
    return (
      <div className="page-container qbo-health-container">
        <LoadingSpinner message="Loading QBO health data..." />
      </div>
    );
  }

  if (!health || !health.connected) {
    return (
      <div className="page-container qbo-health-container">
        <div className="qbo-health-breadcrumbs">
          <Link href="/settings">Settings</Link>
          <span className="breadcrumb-sep">/</span>
          <Link href="/settings/integrations">Integrations</Link>
          <span className="breadcrumb-sep">/</span>
          <span>QBO Health</span>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <XCircle size={40} style={{ color: "#ef4444", marginBottom: 12 }} />
          <h2 style={{ marginBottom: 8 }}>Not Connected</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            QuickBooks Online is not connected. Connect in Settings to view sync health.
          </p>
          <Link
            href="/settings/integrations"
            className="btn btn-primary"
            style={{ textDecoration: "none", padding: "10px 24px" }}
          >
            Go to Integrations
          </Link>
        </div>
      </div>
    );
  }

  const conn = health.connection!;
  const qs = health.queueStats;
  const tokenDays = daysUntil(conn.tokenExpiresAt);
  const entityTypes = Object.keys(ENTITY_META);

  return (
    <div className="page-container qbo-health-container">
      {/* Breadcrumbs */}
      <div className="qbo-health-breadcrumbs">
        <Link href="/settings">Settings</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href="/settings/integrations">Integrations</Link>
        <span className="breadcrumb-sep">/</span>
        <span>QBO Health</span>
      </div>

      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/settings/integrations"
            style={{ color: "var(--text-muted)", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1>QBO Integration Health</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
              Monitor sync status, queue health, and resolve errors
            </p>
          </div>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => { fetchHealth(); fetchLogs(0, filterEntity); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, padding: "8px 16px" }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── Connection Status Card ── */}
      <div className={`connection-status ${health.connected ? "connection-status--connected" : "connection-status--disconnected"}`}>
        <div className="connection-status__header">
          <div className="connection-status__indicator">
            {health.connected ? (
              <CheckCircle size={20} style={{ color: "#10b981" }} />
            ) : (
              <XCircle size={20} style={{ color: "#ef4444" }} />
            )}
            <span className="connection-status__label">
              {health.connected ? "Connected" : "Disconnected"}
            </span>
          </div>
          <span className="connection-status__company">
            {conn.companyName || conn.realmId}
          </span>
        </div>
        <div className="connection-status__details">
          <div className="connection-detail">
            <span className="connection-detail__label">Realm ID</span>
            <span className="connection-detail__value">{conn.realmId}</span>
          </div>
          <div className="connection-detail">
            <span className="connection-detail__label">Connected</span>
            <span className="connection-detail__value">{new Date(conn.connectedAt).toLocaleDateString()}</span>
          </div>
          <div className="connection-detail">
            <span className="connection-detail__label">Last Sync</span>
            <span className="connection-detail__value">{relativeTime(conn.lastSyncAt)}</span>
          </div>
          <div className="connection-detail">
            <span className="connection-detail__label">Token Expires</span>
            <span className={`connection-detail__value ${tokenDays !== null && tokenDays < 7 ? "connection-detail__value--warn" : ""}`}>
              {tokenDays !== null ? (tokenDays > 0 ? `${tokenDays} days` : "Expired") : "Unknown"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Queue Stats Bar ── */}
      {qs && (
        <div className="queue-stats-bar">
          <div className="queue-stat-card">
            <span className="queue-stat-card__count">{qs.pending}</span>
            <span className="queue-stat-card__label">Pending</span>
          </div>
          <div className="queue-stat-card queue-stat-card--processing">
            <span className="queue-stat-card__count">{qs.claimed}</span>
            <span className="queue-stat-card__label">Processing</span>
          </div>
          <div className="queue-stat-card queue-stat-card--failed">
            <span className="queue-stat-card__count">{qs.deadLetter}</span>
            <span className="queue-stat-card__label">Failed</span>
          </div>
          <div className="queue-stat-card queue-stat-card--completed">
            <span className="queue-stat-card__count">{qs.completed}</span>
            <span className="queue-stat-card__label">Completed</span>
          </div>
        </div>
      )}

      {/* ── Dead Letter Warning ── */}
      {qs && qs.deadLetter > 0 && (
        <div className="dead-letter-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>{qs.deadLetter} job{qs.deadLetter > 1 ? "s" : ""} in dead letter queue.</strong>{" "}
            These jobs failed after maximum retries. Check the error log below for resolution hints.
          </div>
        </div>
      )}

      {/* ── Sync Overview Grid ── */}
      <h2 className="section-title">Entity Sync Overview</h2>
      <div className="sync-overview-grid">
        {entityTypes.map((et) => {
          const meta = ENTITY_META[et];
          const stat = health.entityStats[et];
          const Icon = meta.icon;
          const canSync = meta.triggerType !== "";
          const isSyncing = syncing[meta.triggerType] || false;

          return (
            <div key={et} className="entity-sync-card">
              <div className="entity-sync-card__header">
                <Icon size={20} />
                <span className="entity-sync-card__name">{meta.label}</span>
              </div>
              <div className="entity-sync-card__stats">
                <div className="entity-sync-card__stat">
                  <CheckCircle size={14} style={{ color: "#10b981" }} />
                  <span>{stat?.successCount ?? 0} synced</span>
                </div>
                <div className="entity-sync-card__stat">
                  <XCircle size={14} style={{ color: "#ef4444" }} />
                  <span>{stat?.failedCount ?? 0} failed</span>
                </div>
              </div>
              <div className="entity-sync-card__last-sync">
                <Clock size={12} />
                <span>{relativeTime(stat?.lastSync ?? null)}</span>
              </div>
              {canSync && (
                <div className="entity-sync-card__action">
                  <button
                    className="btn btn-accent-sm"
                    onClick={() => triggerSync(meta.triggerType)}
                    disabled={isSyncing}
                  >
                    <RefreshCw size={14} className={isSyncing ? "spin" : ""} />
                    {isSyncing ? "Syncing..." : "Sync Now"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Error Log Section ── */}
      <div className="error-log-section">
        <div className="error-log-header">
          <h2 className="section-title" style={{ margin: 0 }}>Failed Sync Log</h2>
          <select
            className="error-log-filter"
            value={filterEntity}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="">All Entity Types</option>
            {entityTypes.map((et) => (
              <option key={et} value={et}>
                {ENTITY_META[et].label}
              </option>
            ))}
          </select>
        </div>

        {logs.length === 0 && !logsLoading ? (
          <div className="error-log-empty">
            <CheckCircle size={32} style={{ color: "#10b981", marginBottom: 8 }} />
            <p>No failed sync entries found</p>
          </div>
        ) : (
          <>
            <div className="error-log-table-wrapper">
              <table className="error-log-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Entity</th>
                    <th>Error</th>
                    <th>Resolution</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const meta = ENTITY_META[log.entityType];
                    const canRetrigger = meta?.triggerType !== "";
                    return (
                      <tr key={log.id}>
                        <td className="error-log-time">{relativeTime(log.createdAt)}</td>
                        <td>
                          <span className="error-log-entity-badge">{log.entityType}</span>
                        </td>
                        <td className="error-log-message">
                          {log.errorMessage || "Unknown error"}
                        </td>
                        <td>
                          {log.resolutionHint && (
                            <div className="resolution-hint">{log.resolutionHint}</div>
                          )}
                        </td>
                        <td>
                          {canRetrigger && meta?.triggerType && (
                            <button
                              className="btn btn-outline-sm"
                              onClick={() => triggerSync(meta.triggerType)}
                              disabled={syncing[meta.triggerType] || false}
                            >
                              <RefreshCw size={12} />
                              Retry
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {logsLoading && <LoadingSpinner size="sm" inline />}

            {logs.length < logsTotal && !logsLoading && (
              <button
                className="btn btn-outline load-more-btn"
                onClick={handleLoadMore}
              >
                Load More ({logs.length} of {logsTotal})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
