"use client";

import { useEffect, useState } from "react";
import type { User, Role } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";

type ListResponse<T> = { data?: T[] };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("TECH" as Role);
  const [inviting, setInviting] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);
  const [inviteOk, setInviteOk] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, Role>>({});
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string>("");

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiFetch("/api/users", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as ListResponse<User>;
      setUsers(Array.isArray(json?.data) ? json.data : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.ok && json?.user?.email) {
          setMeEmail(String(json.user.email));
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

useEffect(() => {
    load();
  }, []);

  const setBusy = (id: string, v: boolean) => setRowBusy((prev) => ({ ...prev, [id]: v }));

  async function updateRole(userId: string) {
    const role = roleDraft[userId];
    if (!role) return;
    setBusy(userId, true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Update failed (${res.status})`);
      }
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update role.");
    } finally {
      setBusy(userId, false);
    }
  }

  async function removeAccess(userId: string, userEmail: string) {
    // Non-blocking confirm: first click arms, second click confirms.
    if (pendingRemoveId !== userId) {
      setPendingRemoveId(userId);
      return;
    }

    setPendingRemoveId(null);

    // Extra safety on client
    if (meEmail && userEmail.toLowerCase() === meEmail.toLowerCase()) {
      setErr("You cannot remove your own access.");
      return;
    }

    setBusy(userId, true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Remove failed (${res.status})`);
      }
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove access.");
    } finally {
      setBusy(userId, false);
    }
  }

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviting) return;

    setInviting(true);
    setInviteErr(null);
    setInviteOk(null);
    setInviteUrl(null);

    try {
      const email = inviteEmail.trim();
      if (!email) throw new Error("Email is required.");

      const res = await apiFetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: inviteRole }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Invite failed (${res.status})`);
      }

      const json = await res.json().catch(() => ({} as any));
      if (json?.inviteUrl) setInviteUrl(String(json.inviteUrl));
      setInviteOk("Invite created. Copy the invite link and send it to the user.");
      setInviteEmail("");
      setInviteRole("TECH" as Role);
      setShowInvite(false);

      // refresh users list (may remain same until acceptance)
      load();
    } catch (e: any) {
      setInviteErr(e?.message ?? "Invite failed.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage technicians and roles in this organization."
        badge={<Badge>Org scoped</Badge>}
        right={
          <>
            <Button variant="secondary" type="button" onClick={() => setShowInvite(true)}>
              Invite user
            </Button>
            <Button variant="secondary" type="button" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </>
        }
      />

      {err ? <div className="page-alert error">Error: {err}</div> : null}
      {inviteOk ? (
        <div className="page-alert info">
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <span>{inviteOk}</span>
            {inviteUrl ? (
              <Button
                variant="secondary"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteUrl);
                  } catch {
                    // fallback: prompt
                    window.prompt("Copy invite link:", inviteUrl);
                  }
                }}
              >
                Copy invite link
              </Button>
            ) : null}
          </div>
          {inviteUrl ? <div className="muted" style={{ marginTop: 6, wordBreak: "break-all" }}>{inviteUrl}</div> : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h3>Team</h3>
          <span className="muted">{loading ? "Loading…" : `${users.length} user(s)`}</span>
        </CardHeader>

        {loading ? (
          <p>Loading users…</p>
        ) : users.length == 0 ? (
          <p className="muted">No users yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name?.trim() ? u.name : "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={roleDraft[u.id] ?? u.role}
                      onChange={(e) => setRoleDraft((prev) => ({ ...prev, [u.id]: e.target.value as Role }))}
                      disabled={!!rowBusy[u.id]}
                    >
                      <option value="TECH">TECH</option>
                      <option value="DISPATCHER">DISPATCHER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <Button variant="secondary" type="button" onClick={() => updateRole(u.id)} disabled={!!rowBusy[u.id]}>
                        Save role
                      </Button>
                      <Button
                        variant="danger"
                        type="button"
                        onClick={() => removeAccess(u.id, u.email)}
                        disabled={!!rowBusy[u.id] || (!!meEmail && u.email.toLowerCase() === meEmail.toLowerCase())}
                      >
                        {pendingRemoveId === u.id ? "Confirm remove" : "Remove access"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showInvite ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInvite(false);
          }}
        >
          <div
            style={{
              width: "min(560px, 100%)",
              background: "white",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.12)",
              padding: 16,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Invite user</h3>
              <Button variant="secondary" type="button" onClick={() => setShowInvite(false)} disabled={inviting}>
                Close
              </Button>
            </div>

            {inviteErr ? (
              <div style={{ marginTop: 12, padding: 12, border: "1px solid rgba(255,0,0,0.25)", borderRadius: 10 }}>
                <strong>Error:</strong> {inviteErr}
              </div>
            ) : null}

            <form onSubmit={onInvite} style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <label className="form-field" style={{ margin: 0 }}>
                <span>Email</span>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="tech@company.com"
                  disabled={inviting}
                />
              </label>

              <label className="form-field" style={{ margin: 0 }}>
                <span>Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  disabled={inviting}
                >
                  <option value="TECH">TECH</option>
                  <option value="DISPATCHER">DISPATCHER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Button variant="secondary" type="button" onClick={() => setShowInvite(false)} disabled={inviting}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? "Inviting…" : "Send invite"}
                </Button>
              </div>

              <p className="muted" style={{ margin: 0 }}>
                Invited users will show up here after they accept the invite and log in.
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
