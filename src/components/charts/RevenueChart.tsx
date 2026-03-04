"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoiceCount: number;
}

interface RevenueChartProps {
  data: MonthlyRevenue[];
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function formatMonth(month: string): string {
  const [year, mo] = month.split("-");
  const date = new Date(Number(year), Number(mo) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{formatMonth(label)}</div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#f97316" }} />
        <span>Revenue</span>
        <span className="chart-tooltip-value">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payload[0].value)}
        </span>
      </div>
      {payload[0]?.payload?.invoiceCount != null && (
        <div className="chart-tooltip-item">
          <span className="chart-tooltip-dot" style={{ background: "#94a3b8" }} />
          <span>Invoices</span>
          <span className="chart-tooltip-value">{payload[0].payload.invoiceCount}</span>
        </div>
      )}
    </div>
  );
}

export default function RevenueChart({ data }: RevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-card-title">Revenue Trend</h3>
        <div className="chart-empty">No revenue data for this period</div>
      </div>
    );
  }

  return (
    <div className="chart-card chart-card-wide">
      <h3 className="chart-card-title">Revenue Trend</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#f97316", stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
