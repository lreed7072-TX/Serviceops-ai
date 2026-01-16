"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuoteStatus } from "@prisma/client";

interface Quote {
  id: string;
  quoteNumber: string;
  title: string;
  status: QuoteStatus;
  total: number;
  validUntil: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
  };
  site: {
    id: string;
    name: string;
  } | null;
}

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "ALL">("ALL");

  useEffect(() => {
    fetchQuotes();
  }, [statusFilter]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const response = await fetch(`/api/quotes?${params}`);
      if (response.ok) {
        const result = await response.json();
        setQuotes(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Quotes</h1>
          <p className="text-gray-600">Manage customer quotes and estimates</p>
        </div>
        <button
          onClick={() => router.push("/quotes/new")}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Quote
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | "ALL")}
          className="border rounded px-3 py-2"
        >
          <option value="ALL">All Statuses</option>
          <option value={QuoteStatus.DRAFT}>Draft</option>
          <option value={QuoteStatus.SENT}>Sent</option>
          <option value={QuoteStatus.APPROVED}>Approved</option>
          <option value={QuoteStatus.REJECTED}>Rejected</option>
          <option value={QuoteStatus.EXPIRED}>Expired</option>
          <option value={QuoteStatus.CONVERTED}>Converted</option>
          <option value={QuoteStatus.CANCELED}>Canceled</option>
        </select>
      </div>

      {/* Quotes Table */}
      {loading ? (
        <div className="text-center py-8">Loading quotes...</div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No quotes found. Create your first quote to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Quote #</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Valid Until</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((quote) => (
                <tr 
                  key={quote.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/quotes/${quote.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{quote.quoteNumber}</td>
                  <td className="px-4 py-3">
                    <div>{quote.customer.name}</div>
                    {quote.site && (
                      <div className="text-sm text-gray-600">{quote.site.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{quote.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    ${quote.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {quote.validUntil ? (
                      <span className={isExpired(quote.validUntil) ? "text-red-600" : ""}>
                        {new Date(quote.validUntil).toLocaleDateString()}
                        {isExpired(quote.validUntil) && " (Expired)"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(quote.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/quotes/${quote.id}`);
                      }}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
