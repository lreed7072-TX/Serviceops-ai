"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuoteStatus, QuoteLineItemType } from "@prisma/client";

interface QuoteLineItem {
  id: string;
  itemType: QuoteLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sortOrder: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  validUntil: string | null;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  site: {
    id: string;
    name: string;
  } | null;
  lineItems: QuoteLineItem[];
  createdBy: {
    name: string;
  };
}

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetchQuote();
  }, [params.id]);

  const fetchQuote = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quotes/${params.id}`);
      if (response.ok) {
        const result = await response.json();
        setQuote(result.data);
      } else {
        console.error("Failed to fetch quote");
      }
    } catch (error) {
      console.error("Error fetching quote:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!quote) return;
    
    let rejectionReason = null;
    if (newStatus === QuoteStatus.REJECTED) {
      rejectionReason = prompt("Please provide a reason for rejection:");
      if (!rejectionReason) return;
    }

    try {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          rejectionReason 
        }),
      });

      if (response.ok) {
        await fetchQuote();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("An error occurred while updating status");
    }
  };

  const handleConvertToWorkOrder = async () => {
    if (!quote) return;
    
    if (!confirm(`Convert quote ${quote.quoteNumber} to a work order?`)) return;
    
    setConverting(true);
    try {
      const response = await fetch(`/api/quotes/${quote.id}/accept`, {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.data.message);
        router.push(`/work-orders/${result.data.workOrder.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to convert quote");
      }
    } catch (error) {
      console.error("Failed to convert quote:", error);
      alert("An error occurred while converting");
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading quote...</div>;
  }

  if (!quote) {
    return <div className="p-6">Quote not found</div>;
  }

  const getStatusColor = (status: QuoteStatus) => {
    switch (status) {
      case QuoteStatus.DRAFT: return "bg-gray-100 text-gray-800";
      case QuoteStatus.SENT: return "bg-blue-100 text-blue-800";
      case QuoteStatus.APPROVED: return "bg-green-100 text-green-800";
      case QuoteStatus.REJECTED: return "bg-red-100 text-red-800";
      case QuoteStatus.EXPIRED: return "bg-orange-100 text-orange-800";
      case QuoteStatus.CONVERTED: return "bg-purple-100 text-purple-800";
      case QuoteStatus.CANCELED: return "bg-gray-100 text-gray-600";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/quotes")}
          className="text-blue-600 hover:underline mb-2"
        >
          ← Back to Quotes
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
            <p className="text-gray-600">{quote.title}</p>
          </div>
          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(quote.status)}`}>
            {quote.status}
          </span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Customer</div>
            <div className="font-medium">{quote.customer.name}</div>
            {quote.customer.email && (
              <div className="text-sm text-gray-600">{quote.customer.email}</div>
            )}
          </div>
          {quote.site && (
            <div>
              <div className="text-sm text-gray-600">Site</div>
              <div className="font-medium">{quote.site.name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Quote Details */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Quote Details</h2>
        {quote.description && (
          <div className="mb-4">
            <div className="text-sm text-gray-600">Description</div>
            <div className="mt-1">{quote.description}</div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600">Created</div>
            <div>{new Date(quote.createdAt).toLocaleDateString()}</div>
            <div className="text-sm text-gray-600">by {quote.createdBy.name}</div>
          </div>
          {quote.validUntil && (
            <div>
              <div className="text-sm text-gray-600">Valid Until</div>
              <div>{new Date(quote.validUntil).toLocaleDateString()}</div>
            </div>
          )}
          {quote.sentAt && (
            <div>
              <div className="text-sm text-gray-600">Sent</div>
              <div>{new Date(quote.sentAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
        {quote.approvedAt && (
          <div className="mt-4 p-3 bg-green-50 rounded">
            <div className="text-sm font-medium text-green-800">
              Approved on {new Date(quote.approvedAt).toLocaleDateString()}
              {quote.approvedByName && ` by ${quote.approvedByName}`}
            </div>
          </div>
        )}
        {quote.rejectedAt && (
          <div className="mt-4 p-3 bg-red-50 rounded">
            <div className="text-sm font-medium text-red-800">
              Rejected on {new Date(quote.rejectedAt).toLocaleDateString()}
            </div>
            {quote.rejectionReason && (
              <div className="text-sm text-red-700 mt-1">
                Reason: {quote.rejectionReason}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Line Items</h2>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-2 text-left text-sm font-medium">Description</th>
              <th className="px-4 py-2 text-right text-sm font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-sm font-medium">Unit Price</th>
              <th className="px-4 py-2 text-right text-sm font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {quote.lineItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs rounded bg-gray-100">
                    {item.itemType}
                  </span>
                </td>
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-right">${item.unitPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  ${item.totalPrice.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tax ({quote.taxRate}%)</span>
            <span className="font-medium">${quote.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total</span>
            <span>${quote.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      {(quote.notes || quote.terms) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {quote.notes && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div>
              <h3 className="font-semibold mb-2">Terms & Conditions</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{quote.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {quote.status === QuoteStatus.DRAFT && (
            <button
              onClick={() => handleStatusChange(QuoteStatus.SENT)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Mark as Sent
            </button>
          )}
          {(quote.status === QuoteStatus.SENT || quote.status === QuoteStatus.DRAFT) && (
            <>
              <button
                onClick={handleConvertToWorkOrder}
                disabled={converting}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {converting ? "Converting..." : "Convert to Work Order"}
              </button>
              <button
                onClick={() => handleStatusChange(QuoteStatus.REJECTED)}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Reject Quote
              </button>
            </>
          )}
          {quote.status === QuoteStatus.DRAFT && (
            <button
              onClick={() => router.push(`/quotes/${quote.id}/edit`)}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Edit Quote
            </button>
          )}
          {quote.status !== QuoteStatus.CANCELED && quote.status !== QuoteStatus.CONVERTED && (
            <button
              onClick={() => handleStatusChange(QuoteStatus.CANCELED)}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancel Quote
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
