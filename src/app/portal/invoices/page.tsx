"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  total: number | string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  site: { name: string } | null;
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/invoices")
      .then((res) => res.json())
      .then((data) => setInvoices(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStatusClass = (status: string) =>
    status?.toLowerCase().replace("_", "-") || "";

  if (loading) {
    return (
      <div className="portal-loading">
        <div className="portal-spinner" />
        <span>Loading invoices...</span>
      </div>
    );
  }

  return (
    <div>
      <h1 className="portal-page-title">Invoices</h1>

      <div className="portal-card">
        {invoices.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon">📄</div>
            <p>No invoices to display.</p>
          </div>
        ) : (
          <div>
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/portal/invoices/${invoice.id}`}
                className="portal-list-item"
              >
                <div className="portal-list-item-main">
                  <div className="portal-list-item-title">{invoice.title}</div>
                  <div className="portal-list-item-subtitle">
                    {invoice.invoiceNumber}
                    {invoice.site && <> &middot; {invoice.site.name}</>}
                    {" "}&middot; {new Date(invoice.createdAt).toLocaleDateString()}
                    {invoice.dueDate && (
                      <> &middot; Due {new Date(invoice.dueDate).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                <div className="portal-list-item-right">
                  <span className={`portal-status ${getStatusClass(invoice.status)}`}>
                    {invoice.status}
                  </span>
                  <span className="portal-amount">
                    ${Number(invoice.total).toFixed(2)}
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
