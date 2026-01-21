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
      <div className="analytics-loading">
        <div className="analytics-loading-content">
          <div className="analytics-spinner"></div>
          <p className="analytics-loading-text">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="analytics-header">
        <div className="analytics-header-inner">
          <h1>Analytics</h1>
          
          <div className="analytics-controls">
            <div className="analytics-range-selector">
              {(["7d", "30d", "90d"] as DateRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`analytics-range-btn ${dateRange === range ? "active" : ""}`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => handleExport("all")}
              className="analytics-export-btn"
            >
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="analytics-container">
        
        {/* KPI Grid */}
        <div className="analytics-kpi-grid">
          {/* Revenue KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Revenue</span>
              <span className={`analytics-kpi-change ${
                (revenueData?.summary?.totalChange || 0) >= 0 ? "positive" : "negative"
              }`}>
                {formatPercent(revenueData?.summary?.totalChange || 0)}
              </span>
            </div>
            <div className="analytics-kpi-value">{formatCurrency(revenueData?.summary?.totalRevenue || 0)}</div>
            <div className="analytics-kpi-meta">
              {formatCurrency(revenueData?.summary?.paidRevenue || 0)} paid · {formatCurrency(revenueData?.summary?.outstandingRevenue || 0)} due
            </div>
          </div>

          {/* Work Orders KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Work Orders</span>
              <span className="analytics-kpi-meta">{workOrderData?.summary?.completionRate?.toFixed(1) || 0}% done</span>
            </div>
            <div className="analytics-kpi-value">{workOrderData?.summary?.totalWorkOrders || 0}</div>
            <div className="analytics-kpi-meta">
              {workOrderData?.summary?.completedWorkOrders || 0} complete · {workOrderData?.summary?.avgCompletionDays || 0}d avg
            </div>
          </div>

          {/* Materials KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Materials</span>
              <span className="analytics-kpi-change negative">{materialData?.summary?.lowStockCount || 0} low</span>
            </div>
            <div className="analytics-kpi-value">{formatCurrency(materialData?.summary?.totalMaterialCost || 0)}</div>
            <div className="analytics-kpi-meta">
              {materialData?.summary?.totalUsages || 0} usages · {formatCurrency(materialData?.summary?.inventoryValue || 0)} stock
            </div>
          </div>

          {/* Quotes KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Quotes</span>
              <span className="analytics-kpi-change positive">{quoteData?.summary?.conversionRate?.toFixed(1) || 0}% win</span>
            </div>
            <div className="analytics-kpi-value">{formatCurrency(quoteData?.summary?.pipelineValue || 0)}</div>
            <div className="analytics-kpi-meta">
              {quoteData?.summary?.activeQuotesCount || 0} active · {formatCurrency(quoteData?.summary?.avgQuoteValue || 0)} avg
            </div>
          </div>
        </div>

        {/* List Grid */}
        <div className="analytics-list-grid">
          {/* Top Customers */}
          <div className="analytics-list-card">
            <h3 className="analytics-list-title">Top Customers</h3>
            <div className="analytics-list">
              {revenueData?.topCustomers?.slice(0, 5).map((customer: any, index: number) => (
                <div key={index} className="analytics-list-item">
                  <span className="analytics-list-name">{customer.customerName}</span>
                  <span className="analytics-list-value">{formatCurrency(customer.revenue)}</span>
                  <span className="analytics-list-percent">{((customer.revenue / (revenueData?.summary?.totalRevenue || 1)) * 100).toFixed(1)}%</span>
                </div>
              )) || <div className="analytics-list-empty">No customer data</div>}
            </div>
          </div>

          {/* Top Technicians */}
          <div className="analytics-list-card">
            <h3 className="analytics-list-title">Top Technicians</h3>
            <div className="analytics-list">
              {workOrderData?.technicianPerformance?.slice(0, 5).map((tech: any, index: number) => (
                <div key={index} className="analytics-list-item">
                  <span className="analytics-list-name">{tech.userName}</span>
                  <span className="analytics-list-value">{tech.taskCount} tasks</span>
                  <span className="analytics-list-percent">{tech.completionRate?.toFixed(1) || 0}%</span>
                </div>
              )) || <div className="analytics-list-empty">No technician data</div>}
            </div>
          </div>
        </div>

        {/* Bottom Stats Grid */}
        <div className="analytics-stats-grid">
          {/* Labor Hours */}
          <div className="analytics-stat-card">
            <span className="analytics-stat-label">Labor Hours</span>
            <div className="analytics-stat-value">{workOrderData?.summary?.totalLaborHours?.toFixed(1) || 0}</div>
            <div className="analytics-stat-meta">hours logged</div>
          </div>

          {/* Avg Decision Time */}
          <div className="analytics-stat-card">
            <span className="analytics-stat-label">Quote Decision</span>
            <div className="analytics-stat-value">{quoteData?.summary?.avgTimeToDecisionDays?.toFixed(1) || 0}</div>
            <div className="analytics-stat-meta">days average</div>
          </div>

          {/* Top Material */}
          <div className="analytics-stat-card">
            <span className="analytics-stat-label">Top Material</span>
            <div className="analytics-stat-value" style={{ fontSize: "14px" }}>
              {materialData?.topMaterials?.[0]?.materialName || "N/A"}
            </div>
            <div className="analytics-stat-meta">
              {formatCurrency(materialData?.topMaterials?.[0]?.totalCost || 0)} cost
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
