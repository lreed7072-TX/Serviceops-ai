"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuoteLineItemType } from "@prisma/client";

interface Customer {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
}

interface LineItem {
  itemType: QuoteLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  materialId?: string;
}

export default function NewQuotePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    siteId: "",
    title: "",
    description: "",
    taxRate: "0",
    validUntil: "",
    notes: "",
    terms: "Payment due within 30 days of work order completion.",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [currentLineItem, setCurrentLineItem] = useState<LineItem>({
    itemType: QuoteLineItemType.SERVICE,
    description: "",
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (formData.customerId) {
      fetchSites(formData.customerId);
    } else {
      setSites([]);
    }
  }, [formData.customerId]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      if (response.ok) {
        const result = await response.json();
        setCustomers(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchSites = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}/sites`);
      if (response.ok) {
        const result = await response.json();
        setSites(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch sites:", error);
    }
  };

  const handleAddLineItem = () => {
    const totalPrice = currentLineItem.quantity * currentLineItem.unitPrice;
    setLineItems([...lineItems, { ...currentLineItem, totalPrice }]);
    setCurrentLineItem({
      itemType: QuoteLineItemType.SERVICE,
      description: "",
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    });
    setShowLineItemForm(false);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = parseFloat(formData.taxRate) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      alert("Please select a customer");
      return;
    }

    if (lineItems.length === 0) {
      alert("Please add at least one line item");
      return;
    }

    const { subtotal, tax, total } = calculateTotals();

    const payload = {
      customerId: formData.customerId,
      siteId: formData.siteId || null,
      title: formData.title,
      description: formData.description || null,
      taxRate: parseFloat(formData.taxRate) || 0,
      validUntil: formData.validUntil || null,
      notes: formData.notes || null,
      terms: formData.terms || null,
      subtotal,
      tax,
      total,
      lineItems: lineItems.map((item, index) => ({
        ...item,
        sortOrder: index,
      })),
    };

    setLoading(true);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/quotes/${result.data.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create quote");
      }
    } catch (error) {
      console.error("Failed to create quote:", error);
      alert("An error occurred while creating quote");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push("/quotes")}
          className="text-blue-600 hover:underline mb-2"
        >
          ← Back to Quotes
        </button>
        <h1 className="text-2xl font-bold">Create New Quote</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Customer *</label>
              <select
                required
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value, siteId: "" })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Site (Optional)</label>
              <select
                value={formData.siteId}
                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                className="w-full border rounded px-3 py-2"
                disabled={!formData.customerId || sites.length === 0}
              >
                <option value="">No specific site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quote Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quote Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="e.g., Annual pump maintenance"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Additional details about this quote..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valid Until</label>
                <input
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <button
              type="button"
              onClick={() => setShowLineItemForm(true)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              + Add Item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items added yet. Click "Add Item" to get started.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-sm">Type</th>
                  <th className="px-3 py-2 text-left text-sm">Description</th>
                  <th className="px-3 py-2 text-right text-sm">Qty</th>
                  <th className="px-3 py-2 text-right text-sm">Unit Price</th>
                  <th className="px-3 py-2 text-right text-sm">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <span className="px-2 py-1 text-xs rounded bg-gray-100">
                        {item.itemType}
                      </span>
                    </td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      ${item.totalPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(index)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="mt-4 border-t pt-4 space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax ({formData.taxRate}%)</span>
                <span className="font-medium">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes & Terms */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Notes & Terms</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Internal notes or special instructions..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Terms & Conditions</label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Quote"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/quotes")}
            className="bg-gray-200 px-6 py-2 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Line Item Form Modal */}
      {showLineItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Line Item</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={currentLineItem.itemType}
                  onChange={(e) => setCurrentLineItem({ 
                    ...currentLineItem, 
                    itemType: e.target.value as QuoteLineItemType 
                  })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value={QuoteLineItemType.LABOR}>Labor</option>
                  <option value={QuoteLineItemType.MATERIAL}>Material</option>
                  <option value={QuoteLineItemType.SERVICE}>Service</option>
                  <option value={QuoteLineItemType.OTHER}>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={currentLineItem.description}
                  onChange={(e) => setCurrentLineItem({ 
                    ...currentLineItem, 
                    description: e.target.value 
                  })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Describe the item..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentLineItem.quantity}
                    onChange={(e) => setCurrentLineItem({ 
                      ...currentLineItem, 
                      quantity: parseFloat(e.target.value) || 0 
                    })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={currentLineItem.unitPrice}
                    onChange={(e) => setCurrentLineItem({ 
                      ...currentLineItem, 
                      unitPrice: parseFloat(e.target.value) || 0 
                    })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="text-right text-lg font-semibold">
                Total: ${(currentLineItem.quantity * currentLineItem.unitPrice).toFixed(2)}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={handleAddLineItem}
                disabled={!currentLineItem.description}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add Item
              </button>
              <button
                type="button"
                onClick={() => setShowLineItemForm(false)}
                className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
