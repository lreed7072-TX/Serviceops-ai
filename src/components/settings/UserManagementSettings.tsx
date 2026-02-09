"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import "./UserManagementSettings.css";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UserManagementSettings() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("TECH");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
        if (json.currentUserId) setCurrentUserId(json.currentUserId);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!inviteEmail.trim() || !inviteName.trim()) {
      setMessage({ type: "error", text: "Email and name are required" });
      return;
    }

    setInviting(true);
    try {
      const res = await apiFetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      const data = await res.json();
      setMessage({ type: "success", text: data.message || "Invitation sent" });
      setTimeout(() => setMessage(null), 5000);
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("TECH");
      fetchUsers();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send invitation",
      });
    } finally {
      setInviting(false);
    }
  };

  const openRoleModal = (user: User) => {
    setRoleTarget(user);
    setSelectedRole(user.role);
    setShowRoleModal(true);
  };

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTarget) return;
    setMessage(null);

    try {
      const res = await apiFetch(`/api/users/${roleTarget.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }

      setMessage({ type: "success", text: `Role updated to ${selectedRole}` });
      setTimeout(() => setMessage(null), 3000);
      setShowRoleModal(false);
      setRoleTarget(null);
      fetchUsers();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update role",
      });
    }
  };

  const toggleActive = async (user: User) => {
    const action = user.isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} ${user.name || user.email}?`)) return;

    setMessage(null);
    try {
      const res = await apiFetch(`/api/users/${user.id}/${action}`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} user`);
      }

      setMessage({
        type: "success",
        text: `User ${action}d successfully`,
      });
      setTimeout(() => setMessage(null), 3000);
      fetchUsers();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : `Failed to ${action} user`,
      });
    }
  };

  const getRoleBadgeClass = (role: string) => {
    const roleMap: Record<string, string> = {
      ADMIN: "um-role-admin",
      DISPATCHER: "um-role-dispatcher",
      TECH: "um-role-tech",
    };
    return roleMap[role] || "um-role-tech";
  };

  if (loading) {
    return <p style={{ color: "#6b7280", padding: "2rem", textAlign: "center" }}>Loading...</p>;
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <div>
          <h2>User Management</h2>
          <p>Manage team members and their roles</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn btn-primary"
        >
          + Invite User
        </button>
      </div>

      {message && (
        <div className={`settings-message ${message.type}`}>{message.text}</div>
      )}

      <div className="um-users-list">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;

          return (
            <div
              key={user.id}
              className={`um-user-card ${!user.isActive ? "um-inactive" : ""}`}
            >
              <div className="um-user-info">
                <div className="um-user-avatar">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="um-user-details">
                  <div className="um-user-name">
                    {user.name || user.email}
                    {isCurrentUser && <span className="um-you-badge">You</span>}
                  </div>
                  <div className="um-user-email">{user.email}</div>
                </div>
              </div>

              <div className="um-user-meta">
                <span className={`um-role-badge ${getRoleBadgeClass(user.role)}`}>
                  {user.role}
                </span>
                <span className={`um-status-badge ${user.isActive ? "um-active" : "um-inactive-badge"}`}>
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {!isCurrentUser && (
                <div className="um-user-actions">
                  <button
                    onClick={() => openRoleModal(user)}
                    className="btn btn-sm btn-outline"
                  >
                    Change Role
                  </button>
                  <button
                    onClick={() => toggleActive(user)}
                    className={`btn btn-sm ${
                      user.isActive ? "btn-danger-outline" : "btn-secondary"
                    }`}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Invite User</h3>

            <form onSubmit={handleInvite}>
              <div className="um-form-grid">
                <div className="um-form-field">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    autoFocus
                  />
                </div>

                <div className="um-form-field">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="um-form-field um-full-width">
                  <label>Role *</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="TECH">Technician</option>
                    <option value="DISPATCHER">Dispatcher</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <small>
                    <strong>Admin:</strong> Full access &bull; <strong>Dispatcher:</strong>{" "}
                    Manage work orders &bull; <strong>Tech:</strong> Complete tasks
                  </small>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={inviting} className="btn btn-primary">
                  {inviting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showRoleModal && roleTarget && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Role</h3>
            <p className="um-role-modal-subtitle">
              Update role for <strong>{roleTarget.name || roleTarget.email}</strong>
            </p>

            <form onSubmit={handleChangeRole}>
              <div className="um-form-field" style={{ marginBottom: "24px" }}>
                <label>New Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="TECH">Technician</option>
                  <option value="DISPATCHER">Dispatcher</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
