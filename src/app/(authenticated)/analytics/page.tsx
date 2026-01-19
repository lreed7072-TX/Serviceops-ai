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
                (revenueData?.percentChange || 0) >= 0 ? "positive" : "negative"
              }`}>
                {formatPercent(revenueData?.percentChange || 0)}
              </span>
            </div>
            <div className="analytics-kpi-value">{formatCurrency(revenueData?.totalRevenue || 0)}</div>
            <div className="analytics-kpi-meta">
              {formatCurrency(revenueData?.paid || 0)} paid · {formatCurrency(revenueData?.outstanding || 0)} due
            </div>
          </div>

          {/* Work Orders KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Work Orders</span>
              <span className="analytics-kpi-meta">{workOrderData?.completionRate || 0}% done</span>
            </div>
            <div className="analytics-kpi-value">{workOrderData?.total || 0}</div>
            <div className="analytics-kpi-meta">
              {workOrderData?.completed || 0} complete · {workOrderData?.avgCompletionDays || 0}d avg
            </div>
          </div>

          {/* Materials KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Materials</span>
              <span className="analytics-kpi-change negative">{materialData?.lowStock || 0} low</span>
            </div>
            <div className="analytics-kpi-value">{formatCurrency(materialData?.totalCost || 0)}</div>
            <div className="analytics-kpi-meta">
              {materialData?.usages || 0} usages · {formatCurrency(materialData?.inventoryValue || 0)} stock
            </div>
          </div>

          {/* Quotes KPI */}
          <div className="analytics-kpi-card">
            <div className="analytics-kpi-header">
              <span className="analytics-kpi-label">Quotes</span>
              <span className="analytics-kpi-change positive">{quoteData?.conversionRate || 0}% win</span>
            </div>
            <div className="analytics-kpi-value">{formatCurrency(quoteData?.pipelineValue || 0)}</div>
            <div className="analytics-kpi-meta">
              {quoteData?.activeCount || 0} active · {formatCurrency(quoteData?.avgValue || 0)} avg
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
                  <span className="analytics-list-name">{customer.name}</span>
                  <span className="analytics-list-value">{formatCurrency(customer.revenue)}</span>
                  <span className="analytics-list-percent">{customer.percentage}%</span>
                </div>
              )) || <div className="analytics-list-empty">No customer data</div>}
            </div>
          </div>

          {/* Top Technicians */}
          <div className="analytics-list-card">
            <h3 className="analytics-list-title">Top Technicians</h3>
            <div className="analytics-list">
              {workOrderData?.topTechnicians?.slice(0, 5).map((tech: any, index: number) => (
                <div key={index} className="analytics-list-item">
                  <span className="analytics-list-name">{tech.name}</span>
                  <span className="analytics-list-value">{tech.workOrders} WO</span>
                  <span className="analytics-list-percent">{tech.percentage}%</span>
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
            <div className="analytics-stat-value">{workOrderData?.totalLaborHours?.toFixed(1) || 0}</div>
            <div className="analytics-stat-meta">hours logged</div>
          </div>

          {/* Avg Decision Time */}
          <div className="analytics-stat-card">
            <span className="analytics-stat-label">Quote Decision</span>
            <div className="analytics-stat-value">{quoteData?.avgDecisionDays || 0}</div>
            <div className="analytics-stat-meta">days average</div>
          </div>

          {/* Top Material */}
          <div className="analytics-stat-card">
            <span className="analytics-stat-label">Top Material</span>
            <div className="analytics-stat-value" style={{ fontSize: "14px" }}>
              {materialData?.topMaterials?.[0]?.name || "N/A"}
            </div>
            <div className="analytics-stat-meta">
              {formatCurrency(materialData?.topMaterials?.[0]?.cost || 0)} cost
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
