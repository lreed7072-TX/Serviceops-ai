"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CategoryData {
  count: number;
  totalCost: number;
}

interface MaterialUsageChartProps {
  data: Record<string, CategoryData>;
}

const CATEGORY_LABELS: Record<string, string> = {
  PIPE: "Pipe",
  VALVE: "Valve",
  SEAL: "Seal",
  BEARING: "Bearing",
  ELECTRICAL: "Electrical",
  CONSUMABLE: "Consumable",
  OTHER: "Other",
};

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#3b82f6" }} />
        <span>Cost</span>
        <span className="chart-tooltip-value">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(payload[0]?.value || 0)}
        </span>
      </div>
      {payload[0]?.payload?.count != null && (
        <div className="chart-tooltip-item">
          <span className="chart-tooltip-dot" style={{ background: "#94a3b8" }} />
          <span>Usages</span>
          <span className="chart-tooltip-value">{payload[0].payload.count}</span>
        </div>
      )}
    </div>
  );
}

export default function MaterialUsageChart({ data }: MaterialUsageChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-card-title">Material Usage by Category</h3>
        <div className="chart-empty">No material data for this period</div>
      </div>
    );
  }

  const chartData = Object.entries(data)
    .map(([category, stats]) => ({
      name: CATEGORY_LABELS[category] || category,
      totalCost: stats.totalCost,
      count: stats.count,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return (
    <div className="chart-card">
      <h3 className="chart-card-title">Material Usage by Category</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
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
            <Bar
              dataKey="totalCost"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
