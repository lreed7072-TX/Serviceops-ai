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
        break;
      case "90d":
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
    window.location.href = `/api/analytics/export?type=${type}&startDate=${start}&endDate=${end}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-sm text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Compact Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
              <p className="text-sm text-slate-500 mt-0.5">Business performance overview</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setDateRange("7d")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                  dateRange === "7d" 
                    ? "bg-blue-600 text-white" 
                    : "bg-white text-slate-700 border border-slate-300 hover:border-slate-400"
                }`}
              >
                7D
              </button>
              <button
                onClick={() => setDateRange("30d")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                  dateRange === "30d" 
                    ? "bg-blue-600 text-white" 
                    : "bg-white text-slate-700 border border-slate-300 hover:border-slate-400"
                }`}
              >
                30D
              </button>
              <button
                onClick={() => setDateRange("90d")}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                  dateRange === "90d" 
                    ? "bg-blue-600 text-white" 
                    : "bg-white text-slate-700 border border-slate-300 hover:border-slate-400"
                }`}
              >
                90D
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Revenue Section - Compact */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Revenue</h2>
            <button
              onClick={() => handleExport("revenue")}
              className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium"
            >
              Export CSV
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Revenue</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{formatCurrency(revenueData?.summary.totalRevenue || 0)}</p>
                  <p className={`text-xs mt-1.5 font-medium ${
                    (revenueData?.summary.totalChange || 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {formatPercent(revenueData?.summary.totalChange || 0)} vs prev
                  </p>
                </div>
                <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Paid Revenue */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Paid</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{formatCurrency(revenueData?.summary.paidRevenue || 0)}</p>
                  <p className={`text-xs mt-1.5 font-medium ${
                    (revenueData?.summary.paidChange || 0) >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {formatPercent(revenueData?.summary.paidChange || 0)} vs prev
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Outstanding */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Outstanding</p>
                  <p className="text-2xl font-semibold text-amber-600 mt-1">{formatCurrency(revenueData?.summary.outstandingRevenue || 0)}</p>
                  <p className="text-xs mt-1.5 text-slate-500">{revenueData?.summary.invoiceCount || 0} invoices</p>
                </div>
                <div className="w-8 h-8 bg-amber-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Avg Days */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Avg Days</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{revenueData?.collections.averageDaysToPayment?.toFixed(0) || 0}</p>
                  <p className="text-xs mt-1.5 text-slate-500">
                    {revenueData?.collections.paidInvoices || 0}p / {revenueData?.collections.unpaidInvoices || 0}u
                  </p>
                </div>
                <div className="w-8 h-8 bg-purple-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Work Orders Section - Compact */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Work Orders</h2>
            <button
              onClick={() => handleExport("work-orders")}
              className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium"
            >
              Export CSV
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{workOrderData?.summary.totalWorkOrders || 0}</p>
                  <p className="text-xs mt-1.5 text-slate-500">{workOrderData?.summary.completedWorkOrders || 0} completed</p>
                </div>
                <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Completion</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">{workOrderData?.summary.completionRate?.toFixed(0) || 0}%</p>
                  <p className="text-xs mt-1.5 text-slate-500">
                    {workOrderData?.summary.completedWorkOrders || 0} / {workOrderData?.summary.totalWorkOrders || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Avg Time</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{workOrderData?.summary.avgCompletionDays?.toFixed(0) || 0}</p>
                  <p className="text-xs mt-1.5 text-slate-500">days</p>
                </div>
                <div className="w-8 h-8 bg-purple-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Labor Hours</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-1">{workOrderData?.summary.totalLaborHours?.toFixed(1) || 0}</p>
                  <p className="text-xs mt-1.5 text-slate-500">total logged</p>
                </div>
                <div className="w-8 h-8 bg-orange-50 rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Materials & Quotes - Side by Side */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Materials */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900">Materials</h2>
              <button
                onClick={() => handleExport("materials")}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium"
              >
                Export
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Cost</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{formatCurrency(materialData?.summary.totalMaterialCost || 0)}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Inventory</p>
                <p className="text-xl font-semibold text-blue-600 mt-1">{formatCurrency(materialData?.summary.inventoryValue || 0)}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Usages</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{materialData?.summary.totalUsages || 0}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Low Stock</p>
                <p className="text-xl font-semibold text-amber-600 mt-1">{materialData?.summary.lowStockCount || 0}</p>
              </div>
            </div>
          </div>

          {/* Quotes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900">Quotes</h2>
              <button
                onClick={() => handleExport("quotes")}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors font-medium"
              >
                Export
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Conversion</p>
                <p className="text-xl font-semibold text-green-600 mt-1">{quoteData?.summary.conversionRate?.toFixed(0) || 0}%</p>
                <p className="text-xs mt-1 text-slate-500">{quoteData?.summary.approvedQuotes || 0} / {quoteData?.summary.sentQuotes || 0}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Pipeline</p>
                <p className="text-xl font-semibold text-blue-600 mt-1">{formatCurrency(quoteData?.summary.pipelineValue || 0)}</p>
                <p className="text-xs mt-1 text-slate-500">{quoteData?.summary.activeQuotesCount || 0} active</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Avg Value</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{formatCurrency(quoteData?.summary.avgQuoteValue || 0)}</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Avg Decision</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{quoteData?.summary.avgTimeToDecisionDays?.toFixed(0) || 0}</p>
                <p className="text-xs mt-1 text-slate-500">days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Performers - Compact */}
        <div className="grid grid-cols-3 gap-6">
          {/* Top Customers */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Customers</h3>
            <div className="space-y-2.5">
              {revenueData?.topCustomers.slice(0, 5).map((customer: any, idx: number) => (
                <div key={customer.customerId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-400 w-4">{idx + 1}</span>
                    <span className="font-medium text-slate-900 truncate">{customer.customerName}</span>
                  </div>
                  <span className="font-semibold text-slate-900 ml-2">{formatCurrency(customer.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Technicians */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Technicians</h3>
            <div className="space-y-2.5">
              {workOrderData?.technicianPerformance.slice(0, 5).map((tech: any, idx: number) => (
                <div key={tech.userId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-400 w-4">{idx + 1}</span>
                    <span className="font-medium text-slate-900 truncate">{tech.userName}</span>
                  </div>
                  <span className="font-semibold text-green-600 ml-2">{tech.completionRate.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Materials */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Materials</h3>
            <div className="space-y-2.5">
              {materialData?.topMaterials.slice(0, 5).map((material: any, idx: number) => (
                <div key={material.materialId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-400 w-4">{idx + 1}</span>
                    <span className="font-medium text-slate-900 truncate">{material.materialName}</span>
                  </div>
                  <span className="font-semibold text-slate-900 ml-2">{formatCurrency(material.totalCost)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
