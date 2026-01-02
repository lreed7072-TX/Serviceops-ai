"use client";

import { useEffect, useState } from "react";
import type { User } from "@prisma/client";
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
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage technicians and roles in this organization."
        badge={<Badge>Org scoped</Badge>}
        right={
          <Button variant="secondary" type="button" onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {err ? <div className="page-alert error">Error: {err}</div> : null}

      <Card>
        <CardHeader>
          <h3>Team</h3>
          <span className="muted">{loading ? "Loading…" : `${users.length} user(s)`}</span>
        </CardHeader>

        {loading ? (
          <p>Loading users…</p>
        ) : users.length === 0 ? (
          <p className="muted">No users yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name?.trim() ? u.name : "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
