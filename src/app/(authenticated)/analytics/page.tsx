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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Compact Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Analytics</h1>
            </div>
            
            {/* Compact Time Range Selector */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                {(["7d", "30d", "90d"] as DateRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setDateRange(range)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      dateRange === range
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => handleExport("all")}
                className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid - COMPACT & DATA-DENSE */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* KPI Grid - 4 columns, ultra-compact */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {/* Revenue KPI */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Revenue</span>
              <span className={`text-[10px] font-medium ${
                revenueData?.percentChange >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}>
                {formatPercent(revenueData?.percentChange || 0)}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(revenueData?.totalRevenue || 0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {formatCurrency(revenueData?.paid || 0)} paid · {formatCurrency(revenueData?.outstanding || 0)} due
            </div>
          </div>

          {/* Work Orders KPI */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Work Orders</span>
              <span className="text-[10px] font-medium text-slate-600">{workOrderData?.completionRate || 0}% done</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{workOrderData?.total || 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {workOrderData?.completed || 0} complete · {workOrderData?.avgCompletionDays || 0}d avg
            </div>
          </div>

          {/* Materials KPI */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Materials</span>
              <span className="text-[10px] font-medium text-rose-600">{materialData?.lowStock || 0} low</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(materialData?.totalCost || 0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {materialData?.usages || 0} usages · {formatCurrency(materialData?.inventoryValue || 0)} stock
            </div>
          </div>

          {/* Quotes KPI */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Quotes</span>
              <span className="text-[10px] font-medium text-emerald-600">{quoteData?.conversionRate || 0}% win</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(quoteData?.pipelineValue || 0)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {quoteData?.activeCount || 0} active · {formatCurrency(quoteData?.avgValue || 0)} avg
            </div>
          </div>
        </div>

        {/* Secondary Metrics Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Top Customers - Compact Table */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <h3 className="text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wide">Top Customers</h3>
            <div className="space-y-1.5">
              {revenueData?.topCustomers?.slice(0, 5).map((customer: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-slate-900 font-medium truncate flex-1">{customer.name}</span>
                  <span className="text-slate-500 ml-2">{formatCurrency(customer.revenue)}</span>
                  <span className="text-slate-400 ml-2 text-[10px]">{customer.percentage}%</span>
                </div>
              )) || <div className="text-xs text-slate-400">No customer data</div>}
            </div>
          </div>

          {/* Top Technicians - Compact Table */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <h3 className="text-xs font-semibold text-slate-900 mb-2 uppercase tracking-wide">Top Technicians</h3>
            <div className="space-y-1.5">
              {workOrderData?.topTechnicians?.slice(0, 5).map((tech: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-slate-900 font-medium truncate flex-1">{tech.name}</span>
                  <span className="text-slate-500 ml-2">{tech.workOrders} WO</span>
                  <span className="text-slate-400 ml-2 text-[10px]">{tech.percentage}%</span>
                </div>
              )) || <div className="text-xs text-slate-400">No technician data</div>}
            </div>
          </div>
        </div>

        {/* Bottom Stats Grid - 3 columns */}
        <div className="grid grid-cols-3 gap-3">
          {/* Labor Hours */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Labor Hours</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{workOrderData?.totalLaborHours?.toFixed(1) || 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">hours logged</div>
          </div>

          {/* Avg Decision Time */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Quote Decision</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{quoteData?.avgDecisionDays || 0}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">days average</div>
          </div>

          {/* Top Material */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">Top Material</span>
            <div className="text-sm font-semibold text-slate-900 mt-1 truncate">
              {materialData?.topMaterials?.[0]?.name || "N/A"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {formatCurrency(materialData?.topMaterials?.[0]?.cost || 0)} cost
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
