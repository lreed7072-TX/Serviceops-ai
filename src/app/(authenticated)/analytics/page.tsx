"use client";

import { useState, useEffect } from "react";

type DateRange = "7d" | "30d" | "90d" | "custom";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  // Analytics data states
  const [revenueData, setRevenueData] = useState<any>(null);
  const [workOrderData, setWorkOrderData] = useState<any>(null);
  const [materialData, setMaterialData] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);

  // Calculate date range
  const getDateRange = () => {
    const end = new Date();
    let start = new Date();
    
    switch (dateRange) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "custom":
        if (startDate && endDate) {
          return { start: startDate, end: endDate };
        }
        break;
    }
    
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  // Fetch all analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const { start, end } = getDateRange();
      
      try {
        const [revenue, workOrders, materials, quotes] = await Promise.all([
          fetch(`/api/analytics/revenue?startDate=${start}&endDate=${end}`).then(r => r.json()),
          fetch(`/api/analytics/work-orders?startDate=${start}&endDate=${end}`).then(r => r.json()),
          fetch(`/api/analytics/materials?startDate=${start}&endDate=${end}`).then(r => r.json()),
          fetch(`/api/analytics/quotes?startDate=${start}&endDate=${end}`).then(r => r.json()),
        ]);
        
        setRevenueData(revenue.data);
        setWorkOrderData(workOrders.data);
        setMaterialData(materials.data);
        setQuoteData(quotes.data);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange, startDate, endDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  const handleExport = (type: string) => {
    const { start, end } = getDateRange();
    window.open(`/api/analytics/export?type=${type}&startDate=${start}&endDate=${end}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Business Analytics</h1>
        
        <div className="flex gap-2">
          <button
            onClick={() => setDateRange("7d")}
            className={`px-4 py-2 rounded ${dateRange === "7d" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange("30d")}
            className={`px-4 py-2 rounded ${dateRange === "30d" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateRange("90d")}
            className={`px-4 py-2 rounded ${dateRange === "90d" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Last 90 Days
          </button>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Revenue Overview</h2>
          <button
            onClick={() => handleExport("revenue")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Total Revenue</p>
            <p className="text-3xl font-bold">{formatCurrency(revenueData?.summary.totalRevenue || 0)}</p>
            <p className={`text-sm mt-2 ${revenueData?.summary.totalChange >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPercent(revenueData?.summary.totalChange || 0)} vs previous period
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Paid Revenue</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(revenueData?.summary.paidRevenue || 0)}</p>
            <p className={`text-sm mt-2 ${revenueData?.summary.paidChange >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPercent(revenueData?.summary.paidChange || 0)} vs previous period
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Outstanding</p>
            <p className="text-3xl font-bold text-orange-600">{formatCurrency(revenueData?.summary.outstandingRevenue || 0)}</p>
            <p className="text-sm mt-2 text-gray-600">{revenueData?.summary.invoiceCount || 0} invoices</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Avg Days to Payment</p>
            <p className="text-3xl font-bold">{revenueData?.collections.averageDaysToPayment || 0}</p>
            <p className="text-sm mt-2 text-gray-600">
              {revenueData?.collections.paidInvoices || 0} paid / {revenueData?.collections.unpaidInvoices || 0} unpaid
            </p>
          </div>
        </div>
      </div>

      {/* Work Orders */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Work Order Performance</h2>
          <button
            onClick={() => handleExport("work-orders")}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export CSV
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Total Work Orders</p>
            <p className="text-3xl font-bold">{workOrderData?.summary.totalWorkOrders || 0}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Completion Rate</p>
            <p className="text-3xl font-bold text-blue-600">{workOrderData?.summary.completionRate.toFixed(1) || 0}%</p>
            <p className="text-sm mt-2 text-gray-600">{workOrderData?.summary.completedWorkOrders || 0} completed</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Avg Completion Time</p>
            <p className="text-3xl font-bold">{workOrderData?.summary.avgCompletionDays || 0} days</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-gray-600 text-sm mb-1">Total Labor Hours</p>
            <p className="text-3xl font-bold">{workOrderData?.summary.totalLaborHours || 0}</p>
          </div>
        </div>
      </div>

      {/* Materials & Quotes Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Materials */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Material Usage</h2>
            <button
              onClick={() => handleExport("materials")}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Export
            </button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">Total Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(materialData?.summary.totalMaterialCost || 0)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Inventory Value</p>
                <p className="text-2xl font-bold">{formatCurrency(materialData?.summary.inventoryValue || 0)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Usages</p>
                <p className="text-2xl font-bold">{materialData?.summary.totalUsages || 0}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-600">{materialData?.summary.lowStockCount || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quotes */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Quote Pipeline</h2>
            <button
              onClick={() => handleExport("quotes")}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Export
            </button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-600 text-sm">Conversion Rate</p>
                <p className="text-2xl font-bold text-green-600">{quoteData?.summary.conversionRate.toFixed(1) || 0}%</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Pipeline Value</p>
                <p className="text-2xl font-bold">{formatCurrency(quoteData?.summary.pipelineValue || 0)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Quote Value</p>
                <p className="text-2xl font-bold">{formatCurrency(quoteData?.summary.avgQuoteValue || 0)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active Quotes</p>
                <p className="text-2xl font-bold">{quoteData?.summary.activeQuotesCount || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Customers */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Customers by Revenue</h3>
          <div className="space-y-3">
            {revenueData?.topCustomers.slice(0, 5).map((customer: any, idx: number) => (
              <div key={customer.customerId} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{idx + 1}. {customer.customerName}</p>
                  <p className="text-sm text-gray-600">{customer.invoiceCount} invoices</p>
                </div>
                <p className="font-bold">{formatCurrency(customer.revenue)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Technicians */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Technician Performance</h3>
          <div className="space-y-3">
            {workOrderData?.technicianPerformance.slice(0, 5).map((tech: any, idx: number) => (
              <div key={tech.userId} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{idx + 1}. {tech.userName}</p>
                  <p className="text-sm text-gray-600">{tech.taskCount} tasks</p>
                </div>
                <p className="font-bold text-blue-600">{tech.completionRate.toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Materials */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Most Used Materials</h3>
          <div className="space-y-3">
            {materialData?.topMaterials.slice(0, 5).map((material: any, idx: number) => (
              <div key={material.materialId} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{idx + 1}. {material.materialName}</p>
                  <p className="text-sm text-gray-600">{material.usageCount} uses</p>
                </div>
                <p className="font-bold">{formatCurrency(material.totalCost)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
