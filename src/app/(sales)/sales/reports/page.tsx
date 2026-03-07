"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import {
  BarChart3,
  Phone,
  CalendarCheck,
  TrendingUp,
  PieChart as PieChartIcon,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Target,
  DollarSign,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./reports.css";

/* ---------- Types ---------- */

type CallActivityReport = {
  callsByDay: { date: string; count: number }[];
  totalCalls: number;
  avgDuration: number;
  byType: { type: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
};

type FollowUpReport = {
  open: number;
  overdue: number;
  completed: number;
  avgDaysToComplete: number;
  byRep: { rep: string; open: number; completed: number; overdue: number }[];
};

type PipelineSummaryReport = {
  totalValue: number;
  avgDealSize: number;
  totalOpportunities: number;
  byStage: { stage: string; value: number; count: number }[];
};

type WinLossReport = {
  won: number;
  lost: number;
  wonValue: number;
  lostValue: number;
  winRate: number;
  lossReasons: { reason: string; count: number }[];
};

type CustomerCoverageReport = {
  totalCustomers: number;
  contactedCustomers: number;
  coveragePercent: number;
  avgCallsPerCustomer: number;
  byTier: { tier: string; total: number; contacted: number }[];
};

/* ---------- Helpers ---------- */

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMinutes(mins: number): string {
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getMonthStart(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function getToday(): string {
  return toISODate(new Date());
}

/* ---------- Tooltip Components ---------- */

function CallBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{formatDate(label)}</div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#f97316" }} />
        <span>Calls</span>
        <span className="chart-tooltip-value">{payload[0].value}</span>
      </div>
    </div>
  );
}

function PipelineBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#f97316" }} />
        <span>Value</span>
        <span className="chart-tooltip-value">
          {formatCurrency(payload[0].value)}
        </span>
      </div>
    </div>
  );
}

function WinLossPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-item">
        <span
          className="chart-tooltip-dot"
          style={{ background: entry.payload.fill }}
        />
        <span>{entry.name}</span>
        <span className="chart-tooltip-value">{entry.value}</span>
      </div>
    </div>
  );
}

function FollowUpBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="chart-tooltip-item">
          <span className="chart-tooltip-dot" style={{ background: p.fill || p.color }} />
          <span>{p.name}</span>
          <span className="chart-tooltip-value">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Section Error State ---------- */

function SectionError({ message }: { message: string }) {
  return (
    <div className="sr-section-error">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function SalesReportsPage() {
  const toast = useToast();

  // Date range state
  const [startDate, setStartDate] = useState(getMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [viewMode, setViewMode] = useState<"all" | "my">("all");

  // Data state for each section
  const [callActivity, setCallActivity] = useState<CallActivityReport | null>(null);
  const [followUp, setFollowUp] = useState<FollowUpReport | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSummaryReport | null>(null);
  const [winLoss, setWinLoss] = useState<WinLossReport | null>(null);
  const [coverage, setCoverage] = useState<CustomerCoverageReport | null>(null);

  // Error state per section
  const [callError, setCallError] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [winLossError, setWinLossError] = useState<string | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setCallError(null);
    setFollowUpError(null);
    setPipelineError(null);
    setWinLossError(null);
    setCoverageError(null);

    const qs = `startDate=${startDate}&endDate=${endDate}&view=${viewMode}`;

    const fetchOne = async <T,>(
      endpoint: string,
      setter: (d: T) => void,
      errorSetter: (msg: string) => void
    ) => {
      try {
        const res = await apiFetch(`/api/crm/reports/${endpoint}?${qs}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setter(json.data ?? json);
      } catch (e: any) {
        errorSetter(e?.message || "Failed to load");
      }
    };

    await Promise.all([
      fetchOne<CallActivityReport>("call-activity", setCallActivity, setCallError),
      fetchOne<FollowUpReport>("follow-up-performance", setFollowUp, setFollowUpError),
      fetchOne<PipelineSummaryReport>("pipeline-summary", setPipeline, setPipelineError),
      fetchOne<WinLossReport>("win-loss", setWinLoss, setWinLossError),
      fetchOne<CustomerCoverageReport>("customer-coverage", setCoverage, setCoverageError),
    ]);

    setLoading(false);
  }, [startDate, endDate, viewMode]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  /* ---------- Render ---------- */

  return (
    <div className="sr-page">
      {/* Page Header */}
      <div className="sr-header">
        <div className="sr-header-title-row">
          <BarChart3 size={28} />
          <div>
            <h1>Sales Reports</h1>
            <p className="sr-subtitle">
              Performance analytics and CRM insights
            </p>
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="sr-controls">
        <div className="sr-date-picker">
          <label htmlFor="sr-start">From</label>
          <input
            id="sr-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <label htmlFor="sr-end">To</label>
          <input
            id="sr-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="sr-view-toggle">
          <Filter size={16} />
          <button
            className={`sr-toggle-btn ${viewMode === "all" ? "active" : ""}`}
            onClick={() => setViewMode("all")}
          >
            All
          </button>
          <button
            className={`sr-toggle-btn ${viewMode === "my" ? "active" : ""}`}
            onClick={() => setViewMode("my")}
          >
            My Data
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="sr-loading-container">
          <div className="sr-loading-spinner" />
          <span>Loading reports...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* ===== 1. Call Activity ===== */}
          <div className="sr-section">
            <div className="sr-section-header">
              <Phone size={20} />
              <h2>Call Activity</h2>
            </div>

            {callError ? (
              <SectionError message={`Failed to load call activity: ${callError}`} />
            ) : callActivity ? (
              <div className="sr-section-body">
                {/* Summary stats */}
                <div className="sr-mini-stats">
                  <div className="sr-mini-stat">
                    <span className="sr-mini-stat-value">{callActivity.totalCalls}</span>
                    <span className="sr-mini-stat-label">Total Calls</span>
                  </div>
                  <div className="sr-mini-stat">
                    <Clock size={16} />
                    <span className="sr-mini-stat-value">
                      {formatMinutes(callActivity.avgDuration)}
                    </span>
                    <span className="sr-mini-stat-label">Avg Duration</span>
                  </div>
                </div>

                {/* Bar chart: calls by day */}
                {callActivity.callsByDay.length > 0 && (
                  <div className="sr-chart-container">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={callActivity.callsByDay}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatDate}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          width={40}
                        />
                        <Tooltip content={<CallBarTooltip />} />
                        <Bar
                          dataKey="count"
                          fill="#f97316"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mini tables */}
                <div className="sr-mini-tables">
                  {callActivity.byType.length > 0 && (
                    <div className="sr-mini-table">
                      <h4>Calls by Type</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {callActivity.byType.map((row) => (
                            <tr key={row.type}>
                              <td>{row.type}</td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {callActivity.byOutcome.length > 0 && (
                    <div className="sr-mini-table">
                      <h4>Calls by Outcome</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Outcome</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {callActivity.byOutcome.map((row) => (
                            <tr key={row.outcome}>
                              <td>{row.outcome}</td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="sr-empty">No call activity data available</div>
            )}
          </div>

          {/* ===== 2. Follow-up Performance ===== */}
          <div className="sr-section">
            <div className="sr-section-header">
              <CalendarCheck size={20} />
              <h2>Follow-up Performance</h2>
            </div>

            {followUpError ? (
              <SectionError message={`Failed to load follow-up data: ${followUpError}`} />
            ) : followUp ? (
              <div className="sr-section-body">
                {/* Stat cards */}
                <div className="sr-stat-grid">
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon blue">
                      <Target size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">{followUp.open}</span>
                      <span className="sr-stat-label">Open</span>
                    </div>
                  </div>
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon red">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value sr-stat-red">
                        {followUp.overdue}
                      </span>
                      <span className="sr-stat-label">Overdue</span>
                    </div>
                  </div>
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon green">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">{followUp.completed}</span>
                      <span className="sr-stat-label">Completed</span>
                    </div>
                  </div>
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon orange">
                      <Clock size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">
                        {followUp.avgDaysToComplete.toFixed(1)}
                      </span>
                      <span className="sr-stat-label">Avg Days to Complete</span>
                    </div>
                  </div>
                </div>

                {/* Bar chart by rep */}
                {followUp.byRep && followUp.byRep.length > 0 && (
                  <div className="sr-chart-container">
                    <h4 className="sr-chart-subtitle">By Representative</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={followUp.byRep}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="rep"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                          width={40}
                        />
                        <Tooltip content={<FollowUpBarTooltip />} />
                        <Bar
                          dataKey="completed"
                          name="Completed"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="open"
                          name="Open"
                          fill="#f97316"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Bar
                          dataKey="overdue"
                          name="Overdue"
                          fill="#ef4444"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="sr-empty">No follow-up data available</div>
            )}
          </div>

          {/* ===== 3. Pipeline Summary ===== */}
          <div className="sr-section">
            <div className="sr-section-header">
              <TrendingUp size={20} />
              <h2>Pipeline Summary</h2>
            </div>

            {pipelineError ? (
              <SectionError message={`Failed to load pipeline data: ${pipelineError}`} />
            ) : pipeline ? (
              <div className="sr-section-body">
                {/* Stats */}
                <div className="sr-mini-stats">
                  <div className="sr-mini-stat">
                    <DollarSign size={16} />
                    <span className="sr-mini-stat-value">
                      {formatCurrency(pipeline.totalValue)}
                    </span>
                    <span className="sr-mini-stat-label">Total Pipeline Value</span>
                  </div>
                  <div className="sr-mini-stat">
                    <span className="sr-mini-stat-value">
                      {formatCurrency(pipeline.avgDealSize)}
                    </span>
                    <span className="sr-mini-stat-label">Avg Deal Size</span>
                  </div>
                  <div className="sr-mini-stat">
                    <span className="sr-mini-stat-value">
                      {pipeline.totalOpportunities}
                    </span>
                    <span className="sr-mini-stat-label">Total Opportunities</span>
                  </div>
                </div>

                {/* Horizontal bar chart: value by stage */}
                {pipeline.byStage.length > 0 && (
                  <div className="sr-chart-container">
                    <ResponsiveContainer width="100%" height={Math.max(300, pipeline.byStage.length * 50)}>
                      <BarChart
                        data={pipeline.byStage}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tickFormatter={formatCurrencyShort}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="stage"
                          tick={{ fontSize: 12, fill: "#1f2937", fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <Tooltip content={<PipelineBarTooltip />} />
                        <Bar
                          dataKey="value"
                          fill="#f97316"
                          radius={[0, 4, 4, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="sr-empty">No pipeline data available</div>
            )}
          </div>

          {/* ===== 4. Win/Loss Analysis ===== */}
          <div className="sr-section">
            <div className="sr-section-header">
              <PieChartIcon size={20} />
              <h2>Win/Loss Analysis</h2>
            </div>

            {winLossError ? (
              <SectionError message={`Failed to load win/loss data: ${winLossError}`} />
            ) : winLoss ? (
              <div className="sr-section-body">
                {/* Stats */}
                <div className="sr-mini-stats">
                  <div className="sr-mini-stat">
                    <Target size={16} />
                    <span className="sr-mini-stat-value">
                      {winLoss.winRate.toFixed(1)}%
                    </span>
                    <span className="sr-mini-stat-label">Win Rate</span>
                  </div>
                  <div className="sr-mini-stat">
                    <DollarSign size={16} />
                    <span className="sr-mini-stat-value">
                      {formatCurrency(winLoss.wonValue)}
                    </span>
                    <span className="sr-mini-stat-label">Won Value</span>
                  </div>
                  <div className="sr-mini-stat">
                    <span className="sr-mini-stat-value">
                      {winLoss.won + winLoss.lost}
                    </span>
                    <span className="sr-mini-stat-label">Total Decided</span>
                  </div>
                </div>

                {/* Pie chart */}
                <div className="sr-winloss-layout">
                  <div className="sr-chart-container sr-chart-half">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Won", value: winLoss.won, fill: "#10b981" },
                            { name: "Lost", value: winLoss.lost, fill: "#ef4444" },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip content={<WinLossPieTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={10}
                          wrapperStyle={{ fontSize: 13 }}
                        />
                        <text
                          x="50%"
                          y="46%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{
                            fontSize: "24px",
                            fontWeight: 700,
                            fill: "#0f172a",
                          }}
                        >
                          {winLoss.winRate.toFixed(0)}%
                        </text>
                        <text
                          x="50%"
                          y="56%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{
                            fontSize: "10px",
                            fill: "#64748b",
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.5px",
                          }}
                        >
                          Win Rate
                        </text>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Loss reasons table */}
                  {winLoss.lossReasons && winLoss.lossReasons.length > 0 && (
                    <div className="sr-mini-table sr-table-half">
                      <h4>Loss Reasons</h4>
                      <table>
                        <thead>
                          <tr>
                            <th>Reason</th>
                            <th>Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {winLoss.lossReasons.map((row) => (
                            <tr key={row.reason}>
                              <td>{row.reason}</td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="sr-empty">No win/loss data available</div>
            )}
          </div>

          {/* ===== 5. Customer Coverage ===== */}
          <div className="sr-section">
            <div className="sr-section-header">
              <Users size={20} />
              <h2>Customer Coverage</h2>
            </div>

            {coverageError ? (
              <SectionError message={`Failed to load coverage data: ${coverageError}`} />
            ) : coverage ? (
              <div className="sr-section-body">
                {/* Stat cards */}
                <div className="sr-stat-grid">
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon blue">
                      <Users size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">
                        {coverage.totalCustomers}
                      </span>
                      <span className="sr-stat-label">Total Customers</span>
                    </div>
                  </div>
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon green">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">
                        {coverage.contactedCustomers}
                      </span>
                      <span className="sr-stat-label">Contacted</span>
                    </div>
                  </div>
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon orange">
                      <Target size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">
                        {coverage.coveragePercent.toFixed(1)}%
                      </span>
                      <span className="sr-stat-label">Coverage</span>
                    </div>
                  </div>
                  <div className="sr-stat-card">
                    <div className="sr-stat-icon blue">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="sr-stat-value">
                        {coverage.avgCallsPerCustomer.toFixed(1)}
                      </span>
                      <span className="sr-stat-label">Avg Calls / Customer</span>
                    </div>
                  </div>
                </div>

                {/* Coverage by tier table */}
                {coverage.byTier && coverage.byTier.length > 0 && (
                  <div className="sr-mini-table sr-table-full">
                    <h4>Coverage by Tier</h4>
                    <table>
                      <thead>
                        <tr>
                          <th>Tier</th>
                          <th>Total</th>
                          <th>Contacted</th>
                          <th>Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverage.byTier.map((row) => (
                          <tr key={row.tier}>
                            <td>{row.tier}</td>
                            <td>{row.total}</td>
                            <td>{row.contacted}</td>
                            <td>
                              {row.total > 0
                                ? `${((row.contacted / row.total) * 100).toFixed(1)}%`
                                : "0%"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="sr-empty">No customer coverage data available</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
