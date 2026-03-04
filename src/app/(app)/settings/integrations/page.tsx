"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import "./integrations.css";

type QboConnectionStatus = {
  connected: boolean;
  connection: {
    id: string;
    realmId: string;
    companyName: string | null;
    connectedAt: string;
    lastSyncAt: string | null;
  } | null;
  recentLogs?: Array<{
    id: string;
    entityType: string;
    action: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    qboEntityId: string | null;
  }>;
};

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<QboConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check for callback params
  useEffect(() => {
    const qboConnected = searchParams.get("qbo_connected");
    const qboError = searchParams.get("qbo_error");

    if (qboConnected === "true") {
      setMessage({ type: "success", text: "Successfully connected to QuickBooks Online!" });
    } else if (qboError) {
      setMessage({ type: "error", text: `QuickBooks connection failed: ${qboError}` });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await apiFetch("/api/integrations/qbo/status");
      if (res.ok) {
        const json = await res.json();
        setStatus(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    // Navigate to the connect endpoint which will redirect to Intuit
    window.location.href = "/api/integrations/qbo/connect";
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect QuickBooks Online?")) return;

    setDisconnecting(true);
    try {
      const res = await apiFetch("/api/integrations/qbo/disconnect", {
        method: "POST",
      });
      if (res.ok) {
        setStatus({ connected: false, connection: null });
        setMessage({ type: "success", text: "QuickBooks disconnected successfully." });
      } else {
        const json = await res.json();
        setMessage({ type: "error", text: json.error || "Failed to disconnect" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to disconnect QuickBooks" });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync(entityType: "customers" | "invoices") {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await apiFetch("/api/integrations/qbo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType }),
      });
      const json = await res.json();
      if (res.ok) {
        const { synced, failed, total } = json.data;
        setMessage({
          type: failed > 0 ? "error" : "success",
          text: `Sync complete: ${synced}/${total} ${entityType} synced${failed > 0 ? `, ${failed} failed` : ""}`,
        });
        // Refresh status to get updated sync logs
        fetchStatus();
      } else {
        setMessage({ type: "error", text: json.error || "Sync failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Sync request failed" });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container integrations-page">
        <div className="page-header">
          <div>
            <h1>Integrations</h1>
            <p className="page-subtitle">Connect external services</p>
          </div>
        </div>
        <div className="integrations-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container integrations-page">
      <div className="page-header">
        <div>
          <h1>Integrations</h1>
          <p className="page-subtitle">Connect external services to streamline your workflow</p>
        </div>
      </div>

      {message && (
        <div className={`integrations-message integrations-message--${message.type}`}>
          {message.text}
          <button
            className="integrations-message-close"
            onClick={() => setMessage(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* QuickBooks Online Card */}
      <div className="integration-card">
        <div className="integration-card-header">
          <div className="integration-info">
            <h2 className="integration-name">QuickBooks Online</h2>
            <p className="integration-description">
              Sync customers and invoices with QuickBooks Online for seamless accounting.
            </p>
          </div>
          <div className={`integration-status-badge ${status?.connected ? "connected" : "disconnected"}`}>
            {status?.connected ? "Connected" : "Not Connected"}
          </div>
        </div>

        <div className="integration-card-body">
          {status?.connected && status.connection ? (
            <>
              <div className="integration-details">
                <div className="integration-detail-row">
                  <span className="detail-label">Company</span>
                  <span className="detail-value">
                    {status.connection.companyName || status.connection.realmId}
                  </span>
                </div>
                <div className="integration-detail-row">
                  <span className="detail-label">Connected</span>
                  <span className="detail-value">
                    {new Date(status.connection.connectedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="integration-detail-row">
                  <span className="detail-label">Last Sync</span>
                  <span className="detail-value">
                    {status.connection.lastSyncAt
                      ? new Date(status.connection.lastSyncAt).toLocaleString()
                      : "Never"}
                  </span>
                </div>
              </div>

              <div className="integration-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSync("customers")}
                  disabled={syncing}
                >
                  {syncing ? "Syncing..." : "Sync Customers"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSync("invoices")}
                  disabled={syncing}
                >
                  {syncing ? "Syncing..." : "Sync Invoices"}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>

              {/* Sync Log Table */}
              {status.recentLogs && status.recentLogs.length > 0 && (
                <div className="sync-log-section">
                  <h3>Recent Sync Activity</h3>
                  <div className="sync-log-table-wrapper">
                    <table className="sync-log-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Type</th>
                          <th>Action</th>
                          <th>Status</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.recentLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{new Date(log.createdAt).toLocaleString()}</td>
                            <td className="sync-log-type">{log.entityType}</td>
                            <td>{log.action}</td>
                            <td>
                              <span className={`sync-status sync-status--${log.status}`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="sync-log-detail">
                              {log.errorMessage || (log.qboEntityId ? `QBO ID: ${log.qboEntityId}` : "-")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="integration-connect-prompt">
              <p>
                Connect your QuickBooks Online account to automatically sync customers
                and invoices between ServiceOpsIQ and QuickBooks.
              </p>
              <button className="btn btn-primary" onClick={handleConnect}>
                Connect to QuickBooks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
