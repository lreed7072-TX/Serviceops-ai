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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-6 text-lg text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Business Analytics</h1>
              <p className="mt-1 text-sm text-gray-500">Track your business performance and key metrics</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setDateRange("7d")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === "7d" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setDateRange("30d")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === "30d" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setDateRange("90d")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  dateRange === "90d" 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                90 Days
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Revenue Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">💰 Revenue Overview</h2>
            <button
              onClick={() => handleExport("revenue")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Revenue Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(revenueData?.summary.totalRevenue || 0)}</p>
              <p className={`text-sm mt-2 font-medium flex items-center gap-1 ${
                (revenueData?.summary.totalChange || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {(revenueData?.summary.totalChange || 0) >= 0 ? "↑" : "↓"}
                {formatPercent(revenueData?.summary.totalChange || 0)} vs previous period
              </p>
            </div>
            
            {/* Paid Revenue Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Paid Revenue</p>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(revenueData?.summary.paidRevenue || 0)}</p>
              <p className={`text-sm mt-2 font-medium flex items-center gap-1 ${
                (revenueData?.summary.paidChange || 0) >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {(revenueData?.summary.paidChange || 0) >= 0 ? "↑" : "↓"}
                {formatPercent(revenueData?.summary.paidChange || 0)} vs previous period
              </p>
            </div>
            
            {/* Outstanding Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Outstanding</p>
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-amber-600">{formatCurrency(revenueData?.summary.outstandingRevenue || 0)}</p>
              <p className="text-sm mt-2 text-gray-600">
                {revenueData?.summary.invoiceCount || 0} total invoices
              </p>
            </div>
            
            {/* Payment Days Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Avg Days to Payment</p>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{revenueData?.collections.averageDaysToPayment?.toFixed(0) || 0}</p>
              <p className="text-sm mt-2 text-gray-600">
                {revenueData?.collections.paidInvoices || 0} paid / {revenueData?.collections.unpaidInvoices || 0} unpaid
              </p>
            </div>
          </div>
        </div>

        {/* Work Order Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">🔧 Work Order Performance</h2>
            <button
              onClick={() => handleExport("work-orders")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Work Orders</p>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{workOrderData?.summary.totalWorkOrders || 0}</p>
              <p className="text-sm mt-2 text-gray-600">
                {workOrderData?.summary.completedWorkOrders || 0} completed
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">{workOrderData?.summary.completionRate?.toFixed(0) || 0}%</p>
              <p className="text-sm mt-2 text-gray-600">
                {workOrderData?.summary.completedWorkOrders || 0} of {workOrderData?.summary.totalWorkOrders || 0}
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Avg Completion Time</p>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{workOrderData?.summary.avgCompletionDays?.toFixed(0) || 0}</p>
              <p className="text-sm mt-2 text-gray-600">days average</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Labor Hours</p>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{workOrderData?.summary.totalLaborHours?.toFixed(1) || 0}</p>
              <p className="text-sm mt-2 text-gray-600">hours logged</p>
            </div>
          </div>
        </div>

        {/* Material Usage Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">📦 Material Usage</h2>
            <button
              onClick={() => handleExport("materials")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(materialData?.summary.totalMaterialCost || 0)}</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(materialData?.summary.inventoryValue || 0)}</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Total Usages</p>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{materialData?.summary.totalUsages || 0}</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-amber-600">{materialData?.summary.lowStockCount || 0}</p>
            </div>
          </div>
        </div>

        {/* Quote Pipeline Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">💼 Quote Pipeline</h2>
            <button
              onClick={() => handleExport("quotes")}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-green-600">{quoteData?.summary.conversionRate?.toFixed(0) || 0}%</p>
              <p className="text-sm mt-2 text-gray-600">
                {quoteData?.summary.approvedQuotes || 0} / {quoteData?.summary.sentQuotes || 0} approved
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(quoteData?.summary.pipelineValue || 0)}</p>
              <p className="text-sm mt-2 text-gray-600">
                {quoteData?.summary.activeQuotesCount || 0} active quotes
              </p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Avg Quote Value</p>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(quoteData?.summary.avgQuoteValue || 0)}</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-600">Avg Decision Time</p>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{quoteData?.summary.avgTimeToDecisionDays?.toFixed(0) || 0}</p>
              <p className="text-sm mt-2 text-gray-600">days average</p>
            </div>
          </div>
        </div>

        {/* Top Performers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Customers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">🏆</span>
              Top Customers
            </h3>
            <div className="space-y-4">
              {revenueData?.topCustomers.slice(0, 5).map((customer: any, idx: number) => (
                <div key={customer.customerId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{customer.customerName}</p>
                      <p className="text-sm text-gray-500">{customer.invoiceCount} invoices</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 ml-2">{formatCurrency(customer.revenue)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Technicians */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">👨‍🔧</span>
              Top Technicians
            </h3>
            <div className="space-y-4">
              {workOrderData?.technicianPerformance.slice(0, 5).map((tech: any, idx: number) => (
                <div key={tech.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{tech.userName}</p>
                      <p className="text-sm text-gray-500">{tech.taskCount} tasks</p>
                    </div>
                  </div>
                  <p className="font-bold text-green-600 ml-2">{tech.completionRate.toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Materials */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">📦</span>
              Most Used Materials
            </h3>
            <div className="space-y-4">
              {materialData?.topMaterials.slice(0, 5).map((material: any, idx: number) => (
                <div key={material.materialId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{material.materialName}</p>
                      <p className="text-sm text-gray-500">{material.usageCount} uses</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 ml-2">{formatCurrency(material.totalCost)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
