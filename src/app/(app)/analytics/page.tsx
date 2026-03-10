"use client";

import { useState, useEffect } from "react";
import RevenueChart from "@/components/charts/RevenueChart";
import WorkOrderStatusChart from "@/components/charts/WorkOrderStatusChart";
import MaterialUsageChart from "@/components/charts/MaterialUsageChart";
import QuoteFunnelChart from "@/components/charts/QuoteFunnelChart";
import CustomerRevenueChart from "@/components/charts/CustomerRevenueChart";
import TechPerformanceChart from "@/components/charts/TechPerformanceChart";
import QboFinancialCharts from "@/components/charts/QboFinancialCharts";
import "@/components/charts/charts.css";

type DateRange = "7d" | "30d" | "90d" | "custom";
type AnalyticsTab = "operations" | "qbo_financial";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("operations");
  const [qboConnected, setQboConnected] = useState(false);
  const [qboConnectionInfo, setQboConnectionInfo] = useState<{ classTrackingEnabled?: boolean; locationTrackingEnabled?: boolean } | null>(null);

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
        const fetchWithCheck = async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch ${url}`);
          return res.json();
        };

        const [revenue, workOrders, materials, quotes] = await Promise.all([
          fetchWithCheck(`/api/analytics/revenue?startDate=${start}&endDate=${end}`),
          fetchWithCheck(`/api/analytics/work-orders?startDate=${start}&endDate=${end}`),
          fetchWithCheck(`/api/analytics/materials?startDate=${start}&endDate=${end}`),
          fetchWithCheck(`/api/analytics/quotes?startDate=${start}&endDate=${end}`),
        ]);

        setRevenueData(revenue?.data || null);
        setWorkOrderData(workOrders?.data || null);
        setMaterialData(materials?.data || null);
        setQuoteData(quotes?.data || null);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange, startDate, endDate]);

  // Check QBO connection status
  useEffect(() => {
    async function checkQboConnection() {
      try {
        const res = await fetch("/api/integrations/qbo/health");
        if (res.ok) {
          const data = await res.json();
          setQboConnected(data.connected === true || data.data?.connected === true);
          const connData = data.data || data;
          setQboConnectionInfo({
            classTrackingEnabled: connData.connection?.classTrackingEnabled,
            locationTrackingEnabled: connData.connection?.locationTrackingEnabled,
          });
        }
      } catch { /* QBO not connected */ }
    }
    checkQboConnection();
  }, []);

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

      {/* Tab Navigation */}
      <div className="analytics-container">
        <div className="analytics__tabs">
          <button
            className={`analytics__tab ${activeTab === "operations" ? "analytics__tab--active" : ""}`}
            onClick={() => setActiveTab("operations")}
          >
            Operations
          </button>
          {qboConnected && (
            <button
              className={`analytics__tab ${activeTab === "qbo_financial" ? "analytics__tab--active" : ""}`}
              onClick={() => setActiveTab("qbo_financial")}
            >
              QBO Financial
            </button>
          )}
        </div>

        {activeTab === "qbo_financial" && qboConnected && (
          <QboFinancialCharts
            startDate={getDateRange().start}
            endDate={getDateRange().end}
            qboConnected={qboConnected}
            classTrackingEnabled={qboConnectionInfo?.classTrackingEnabled}
            locationTrackingEnabled={qboConnectionInfo?.locationTrackingEnabled}
          />
        )}

        {activeTab === "operations" && (
        <>
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
                  <span className="analytics-list-name">{customer.customerName || "Unknown"}</span>
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
                  <span className="analytics-list-name">{tech.userName || "Unknown"}</span>
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

        {/* Charts Section */}
        <div className="analytics-charts-grid">
          <RevenueChart data={revenueData?.monthlyTrend || []} />

          <WorkOrderStatusChart data={workOrderData?.statusDistribution || {}} />
          <QuoteFunnelChart data={quoteData?.statusDistribution || {}} />

          <MaterialUsageChart data={materialData?.categoryDistribution || {}} />

          <CustomerRevenueChart data={revenueData?.topCustomers || []} />
          <TechPerformanceChart data={workOrderData?.technicianPerformance || []} />
        </div>
        </>
        )}
      </div>
    </div>
  );
}
