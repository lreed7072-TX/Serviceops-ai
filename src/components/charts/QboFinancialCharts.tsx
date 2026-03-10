"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

type NormalizedSection = {
  name: string;
  total: number;
  items: Array<{ name: string; value: number }>;
};

type StandardReport = {
  reportName: string;
  startDate: string;
  endDate: string;
  reportBasis?: string;
  sections: NormalizedSection[];
  grandTotal?: number;
};

type AgingBucket = {
  customerName: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
  total: number;
};

type AgingReport = {
  reportName: string;
  buckets: AgingBucket[];
  totals: AgingBucket;
};

const CHART_COLORS = ["#f97316", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
const AGING_COLORS = { current: "#10b981", days1to30: "#f59e0b", days31to60: "#f97316", days61to90: "#ef4444", days91plus: "#991b1b" };

type Props = {
  startDate: string;
  endDate: string;
  qboConnected: boolean;
  classTrackingEnabled?: boolean;
  locationTrackingEnabled?: boolean;
};

export default function QboFinancialCharts({ startDate, endDate, qboConnected, classTrackingEnabled, locationTrackingEnabled }: Props) {
  const [accountingMethod, setAccountingMethod] = useState<"Cash" | "Accrual">("Accrual");
  const [classFilter, setClassFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [plReport, setPlReport] = useState<StandardReport | null>(null);
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
  const [bsReport, setBsReport] = useState<StandardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    if (!qboConnected) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      accounting_method: accountingMethod,
    });
    if (classFilter) params.set("class", classFilter);
    if (locationFilter) params.set("department", locationFilter);

    try {
      const [plRes, arRes, bsRes] = await Promise.all([
        fetch(`/api/integrations/qbo/reports?report=ProfitAndLoss&${params}`),
        fetch(`/api/integrations/qbo/reports?report=AgedReceivableDetail&${params}`),
        fetch(`/api/integrations/qbo/reports?report=BalanceSheet&${params}`),
      ]);

      if (plRes.ok) {
        const plData = await plRes.json();
        setPlReport(plData.data);
      }
      if (arRes.ok) {
        const arData = await arRes.json();
        setAgingReport(arData.data);
      }
      if (bsRes.ok) {
        const bsData = await bsRes.json();
        setBsReport(bsData.data);
      }

      if (!plRes.ok && !arRes.ok && !bsRes.ok) {
        setError("Failed to fetch reports from QBO");
      }
    } catch (err) {
      setError("Network error fetching QBO reports");
      console.error("[QBO Financial]", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, accountingMethod, classFilter, locationFilter, qboConnected]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (!qboConnected) {
    return (
      <div className="qbo-financial__empty">
        <p>Connect QuickBooks Online to view financial reports.</p>
      </div>
    );
  }

  // Separate income and expense for P&L
  const incomeSection = plReport?.sections.find((s) => s.name.toLowerCase().includes("income") && !s.name.toLowerCase().includes("expense"));
  const expenseSection = plReport?.sections.find((s) => s.name.toLowerCase().includes("expense") || s.name.toLowerCase().includes("cost"));

  const incomeData = incomeSection?.items.map((i) => ({
    name: i.name.length > 18 ? i.name.slice(0, 16) + "..." : i.name,
    value: Math.abs(i.value),
  })) || [];

  const expenseData = expenseSection?.items.map((i) => ({
    name: i.name.length > 18 ? i.name.slice(0, 16) + "..." : i.name,
    value: Math.abs(i.value),
  })) || [];

  // Prepare Aging chart data (top 10 customers by total)
  const agingChartData = (agingReport?.buckets || [])
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((b) => ({
      name: b.customerName.length > 15 ? b.customerName.slice(0, 13) + "..." : b.customerName,
      current: b.current,
      "1-30": b.days1to30,
      "31-60": b.days31to60,
      "61-90": b.days61to90,
      "91+": b.days91plus,
    }));

  // Prepare Balance Sheet pie data
  const bsPieData = bsReport?.sections
    .filter((s) => s.total !== 0)
    .map((s) => ({
      name: s.name,
      value: Math.abs(s.total),
    })) || [];

  return (
    <div className="qbo-financial">
      {/* Controls Row */}
      <div className="qbo-financial__controls">
        <div className="qbo-financial__toggle">
          <label className="qbo-financial__toggle-label">Accounting Method:</label>
          <div className="qbo-financial__toggle-buttons">
            <button
              className={`qbo-financial__toggle-btn ${accountingMethod === "Cash" ? "qbo-financial__toggle-btn--active" : ""}`}
              onClick={() => setAccountingMethod("Cash")}
            >
              Cash
            </button>
            <button
              className={`qbo-financial__toggle-btn ${accountingMethod === "Accrual" ? "qbo-financial__toggle-btn--active" : ""}`}
              onClick={() => setAccountingMethod("Accrual")}
            >
              Accrual
            </button>
          </div>
        </div>

        {classTrackingEnabled && (
          <div className="qbo-financial__filter">
            <label>Class:</label>
            <input
              type="text"
              placeholder="Filter by class..."
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="qbo-financial__filter-input"
            />
          </div>
        )}

        {locationTrackingEnabled && (
          <div className="qbo-financial__filter">
            <label>Location:</label>
            <input
              type="text"
              placeholder="Filter by location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="qbo-financial__filter-input"
            />
          </div>
        )}
      </div>

      {loading && <div className="qbo-financial__loading">Loading QBO financial reports...</div>}
      {error && <div className="qbo-financial__error">{error}</div>}

      {!loading && !error && (
        <div className="qbo-financial__charts">
          {/* P&L Chart */}
          <div className="qbo-financial__chart-section">
            <h3>Profit & Loss</h3>
            {plReport?.grandTotal !== undefined && (
              <p className="qbo-financial__net">
                Net {plReport.grandTotal >= 0 ? "Income" : "Loss"}:{" "}
                <span className={plReport.grandTotal >= 0 ? "qbo-financial__positive" : "qbo-financial__negative"}>
                  ${Math.abs(plReport.grandTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </p>
            )}
            <div className="qbo-financial__chart-row">
              <div className="qbo-financial__chart-half">
                <h4>Income</h4>
                {incomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={incomeData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} width={120} />
                      <Tooltip formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Amount"]} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
                      <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="qbo-financial__empty-chart">No income data</p>
                )}
              </div>
              <div className="qbo-financial__chart-half">
                <h4>Expenses</h4>
                {expenseData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={expenseData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} width={120} />
                      <Tooltip formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Amount"]} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="qbo-financial__empty-chart">No expense data</p>
                )}
              </div>
            </div>
          </div>

          {/* A/R Aging Chart */}
          <div className="qbo-financial__chart-section">
            <h3>Accounts Receivable Aging</h3>
            {agingReport && agingReport.totals.total > 0 && (
              <p className="qbo-financial__net">
                Total Outstanding: <span className="qbo-financial__negative">${agingReport.totals.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </p>
            )}
            {agingChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={agingChartData} margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} formatter={(v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
                  <Legend />
                  <Bar dataKey="current" stackId="a" fill={AGING_COLORS.current} name="Current" />
                  <Bar dataKey="1-30" stackId="a" fill={AGING_COLORS.days1to30} name="1-30 Days" />
                  <Bar dataKey="31-60" stackId="a" fill={AGING_COLORS.days31to60} name="31-60 Days" />
                  <Bar dataKey="61-90" stackId="a" fill={AGING_COLORS.days61to90} name="61-90 Days" />
                  <Bar dataKey="91+" stackId="a" fill={AGING_COLORS.days91plus} name="91+ Days" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="qbo-financial__empty-chart">No outstanding receivables</p>
            )}
          </div>

          {/* Balance Sheet Chart */}
          <div className="qbo-financial__chart-section">
            <h3>Balance Sheet</h3>
            {bsPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={bsPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={140}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: $${(Number(value) / 1000).toFixed(0)}k`}
                    labelLine={{ stroke: "#9ca3af" }}
                  >
                    {bsPieData.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="qbo-financial__empty-chart">No balance sheet data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
