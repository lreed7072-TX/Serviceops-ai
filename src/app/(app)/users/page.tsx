"use client";

import { useEffect, useState } from "react";
import type { User, Role } from "@prisma/client";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import "./users.css";

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
    <div className="users-page">
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

      {err ? <div className="users-alert-error">Error: {err}</div> : null}
      {inviteOk ? (
        <div className="invite-banner">
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
          {inviteUrl ? <div className="invite-url-text">{inviteUrl}</div> : null}
        </div>
      ) : null}

      <div className="users-card">
        <div className="users-card-header">
          <h3>Team</h3>
          <span className="muted">{loading ? "Loading..." : `${users.length} user(s)`}</span>
        </div>

        <div className="users-card-body">
          {loading ? (
            <p className="users-loading">Loading users...</p>
          ) : users.length == 0 ? (
            <p className="users-empty">No users yet.</p>
          ) : (
            <table className="users-table">
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
                    <td data-label="Name" className="user-name">{u.name?.trim() ? u.name : "\u2014"}</td>
                    <td data-label="Email" className="user-email">{u.email}</td>
                    <td data-label="Role">
                      <select
                        className="role-select"
                        value={roleDraft[u.id] ?? u.role}
                        onChange={(e) => setRoleDraft((prev) => ({ ...prev, [u.id]: e.target.value as Role }))}
                        disabled={!!rowBusy[u.id]}
                      >
                        <option value="TECH">TECH</option>
                        <option value="DISPATCHER">DISPATCHER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td data-label="Created" className="user-date">{new Date(u.createdAt).toLocaleString()}</td>
                    <td data-label="Actions">
                      <div className="user-actions">
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
        </div>
      </div>

      {showInvite ? (
        <div
          className="users-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInvite(false);
          }}
        >
          <div className="users-modal">
            <div className="users-modal-header">
              <h3>Invite user</h3>
              <Button variant="secondary" type="button" onClick={() => setShowInvite(false)} disabled={inviting}>
                Close
              </Button>
            </div>

            <div className="users-modal-body">
              {inviteErr ? (
                <div className="invite-error">
                  <strong>Error:</strong> {inviteErr}
                </div>
              ) : null}

              <form onSubmit={onInvite}>
                <div className="form-field">
                  <label className="field-label">Email</label>
                  <input
                    className="field-input"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="tech@company.com"
                    disabled={inviting}
                  />
                </div>

                <div className="form-field" style={{ marginTop: "1.25rem" }}>
                  <label className="field-label">Role</label>
                  <select
                    className="field-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    disabled={inviting}
                  >
                    <option value="TECH">TECH</option>
                    <option value="DISPATCHER">DISPATCHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div className="users-modal-footer" style={{ padding: "1.25rem 0 0" , border: "none" }}>
                  <Button variant="secondary" type="button" onClick={() => setShowInvite(false)} disabled={inviting}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={inviting || !inviteEmail.trim()}>
                    {inviting ? "Inviting..." : "Send invite"}
                  </Button>
                </div>

                <p className="invite-note">
                  Invited users will show up here after they accept the invite and log in.
                </p>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
