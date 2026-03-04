"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface WorkOrder {
  id: string;
  workOrderNumber: string | null;
  title: string;
  status: string;
  createdAt: string;
  site: { name: string } | null;
  _count: { tasks: number; visits: number };
}

export default function PortalWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/work-orders")
      .then((res) => res.json())
      .then((data) => setWorkOrders(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading work orders...</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="portal-page-title">Work Orders</h1>

      <div className="portal-card">
        {workOrders.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon">🔧</div>
            <p>No work orders to display.</p>
          </div>
        ) : (
          <div>
            {workOrders.map((wo) => (
              <Link
                key={wo.id}
                href={`/portal/work-orders/${wo.id}`}
                className="portal-list-item"
              >
                <div className="portal-list-item-main">
                  <div className="portal-list-item-title">
                    {wo.workOrderNumber || wo.title}
                  </div>
                  <div className="portal-list-item-subtitle">
                    {wo.title}
                    {wo.site && <> &middot; {wo.site.name}</>}
                    {" "}&middot; {new Date(wo.createdAt).toLocaleDateString()}
                    {" "}&middot; {wo._count.tasks} tasks &middot; {wo._count.visits} visits
                  </div>
                </div>
                <div className="portal-list-item-right">
                  <span className={`portal-status ${getStatusClass(wo.status)}`}>
                    {wo.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
