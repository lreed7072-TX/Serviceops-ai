"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
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

type QboAccountItem = {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  FullyQualifiedName?: string;
};

type AccountMappingRecord = {
  qboAccountId: string;
  qboAccountName: string;
  qboAccountType: string;
};

const MAPPING_CATEGORIES: { key: string; label: string; filterType: string[] }[] = [
  { key: "labor_income", label: "Labor Income", filterType: ["Income"] },
  { key: "materials_income", label: "Materials Income", filterType: ["Income"] },
  { key: "service_income", label: "Service Fee Income", filterType: ["Income"] },
  { key: "job_cost_expense", label: "Job Cost Expense", filterType: ["Expense", "Cost of Goods Sold"] },
  { key: "subcontractor_expense", label: "Subcontractor Expense", filterType: ["Expense", "Cost of Goods Sold"] },
];

export default function IntegrationsPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<QboConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Account mapping state
  const [accounts, setAccounts] = useState<QboAccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, AccountMappingRecord>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<{ category: string; message: string } | null>(null);

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

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      const res = await apiFetch("/api/integrations/qbo/accounts");
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
      } else {
        const json = await res.json();
        setAccountsError(json.error || "Failed to fetch accounts");
      }
    } catch {
      setAccountsError("Failed to fetch accounts from QuickBooks");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await apiFetch("/api/integrations/qbo/account-mapping");
      if (res.ok) {
        const json = await res.json();
        setMappings(json.data || {});
      }
    } catch {
      // Silent — mappings will show as empty
    }
  }, []);

  // Load accounts and mappings when connected
  useEffect(() => {
    if (status?.connected) {
      fetchAccounts();
      fetchMappings();
    }
  }, [status?.connected, fetchAccounts, fetchMappings]);

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
    window.location.href = "/api/integrations/qbo/connect";
  }

  async function handleDisconnect() {
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
      setShowDisconnectConfirm(false);
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

  async function handleMappingChange(category: string, qboAccountId: string) {
    if (!qboAccountId) return; // "Select..." placeholder chosen — ignore

    const account = accounts.find((a) => a.Id === qboAccountId);
    if (!account) return;

    const previousMapping = mappings[category];
    setSavingCategory(category);
    setMappingError(null);

    // Optimistic update
    setMappings((prev) => ({
      ...prev,
      [category]: {
        qboAccountId: account.Id,
        qboAccountName: account.Name,
        qboAccountType: account.AccountType,
      },
    }));

    try {
      const res = await apiFetch("/api/integrations/qbo/account-mapping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          qboAccountId: account.Id,
          qboAccountName: account.Name,
          qboAccountType: account.AccountType,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to save mapping");
      }
    } catch (err) {
      // Revert optimistic update
      if (previousMapping) {
        setMappings((prev) => ({ ...prev, [category]: previousMapping }));
      } else {
        setMappings((prev) => {
          const next = { ...prev };
          delete next[category];
          return next;
        });
      }
      setMappingError({
        category,
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSavingCategory(null);
    }
  }

  const mappedCount = Object.keys(mappings).length;
  const allMapped = mappedCount === MAPPING_CATEGORIES.length;

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
              {/* Account Mapping Warning Banner */}
              {!allMapped && status?.connected && (
                <div className="mapping-warning-banner">
                  <AlertTriangle size={16} />
                  Account mapping incomplete ({mappedCount}/{MAPPING_CATEGORIES.length}) — financial syncs are blocked. Configure mapping below.
                </div>
              )}

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
                  onClick={() => setShowDisconnectConfirm(true)}
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

              {/* Account Mapping Section */}
              <div className="account-mapping-section">
                <div className="account-mapping-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h3>Chart of Accounts Mapping</h3>
                    <span className={`mapping-status-indicator ${allMapped ? "complete" : "incomplete"}`}>
                      {allMapped ? (
                        <><CheckCircle size={12} /> All mapped</>
                      ) : (
                        <><AlertTriangle size={12} /> {mappedCount}/{MAPPING_CATEGORIES.length} mapped</>
                      )}
                    </span>
                  </div>
                  <button
                    className="mapping-refresh-btn"
                    onClick={fetchAccounts}
                    disabled={accountsLoading}
                  >
                    <RefreshCw size={14} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                    {accountsLoading ? "Refreshing..." : "Refresh Accounts"}
                  </button>
                </div>

                {accountsLoading && accounts.length === 0 ? (
                  <div className="mapping-accounts-loading">
                    Loading Chart of Accounts from QuickBooks...
                  </div>
                ) : accountsError && accounts.length === 0 ? (
                  <div className="mapping-accounts-error">
                    {accountsError}
                    <br />
                    <button onClick={fetchAccounts}>Try Again</button>
                  </div>
                ) : accounts.length > 0 ? (
                  <div className="mapping-rows">
                    {MAPPING_CATEGORIES.map((cat) => {
                      const filteredAccounts = accounts.filter((a) =>
                        cat.filterType.includes(a.AccountType)
                      );
                      const currentMapping = mappings[cat.key];
                      const isSaving = savingCategory === cat.key;
                      const hasError = mappingError?.category === cat.key;

                      return (
                        <div key={cat.key} className="mapping-row">
                          <span className="mapping-row-label">{cat.label}</span>
                          <select
                            className="mapping-select"
                            value={currentMapping?.qboAccountId || ""}
                            onChange={(e) => handleMappingChange(cat.key, e.target.value)}
                            disabled={isSaving || accountsLoading}
                          >
                            <option value="">Select a QBO account...</option>
                            {filteredAccounts.map((acct) => (
                              <option key={acct.Id} value={acct.Id}>
                                {acct.FullyQualifiedName || acct.Name}
                              </option>
                            ))}
                          </select>
                          <div style={{ minWidth: 70, textAlign: "right" }}>
                            {isSaving ? (
                              <span className="mapping-row-saving">Saving...</span>
                            ) : hasError ? (
                              <span className="mapping-row-error">{mappingError.message}</span>
                            ) : currentMapping ? (
                              <span
                                className={`mapping-account-type ${
                                  currentMapping.qboAccountType === "Income" ? "income" : "expense"
                                }`}
                              >
                                {currentMapping.qboAccountType}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
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

      {/* Disconnect Confirmation */}
      <ConfirmDialog
        open={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
        title="Disconnect QuickBooks"
        message="Are you sure you want to disconnect QuickBooks Online?"
        detail="Synced data will remain, but new syncs will stop until you reconnect."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnecting}
      />
    </div>
  );
}
