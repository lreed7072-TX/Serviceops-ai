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

interface QuoteFunnelChartProps {
  data: Record<string, number>;
}

const STAGE_ORDER = ["DRAFT", "SENT", "APPROVED", "CONVERTED", "REJECTED"];

const STAGE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
};

const STAGE_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  SENT: "#3b82f6",
  APPROVED: "#10b981",
  CONVERTED: "#f97316",
  REJECTED: "#ef4444",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const color = payload[0]?.payload?.fill || "#94a3b8";
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: color }} />
        <span>{label}</span>
        <span className="chart-tooltip-value">{payload[0].value} quotes</span>
      </div>
    </div>
  );
}

export default function QuoteFunnelChart({ data }: QuoteFunnelChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-card-title">Quote Pipeline</h3>
        <div className="chart-empty">No quote data for this period</div>
      </div>
    );
  }

  const chartData = STAGE_ORDER
    .filter((stage) => data[stage] != null && data[stage] > 0)
    .map((stage) => ({
      name: STAGE_LABELS[stage] || stage,
      count: data[stage],
      fill: STAGE_COLORS[stage] || "#94a3b8",
    }));

  if (chartData.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-card-title">Quote Pipeline</h3>
        <div className="chart-empty">No quote data for this period</div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h3 className="chart-card-title">Quote Pipeline</h3>
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
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {/* Colors applied via fill prop on each data entry */}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
