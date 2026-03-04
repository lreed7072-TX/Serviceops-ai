"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WorkOrderStatusChartProps {
  data: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  OPEN: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
  ON_HOLD: "#8b5cf6",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ON_HOLD: "On Hold",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: entry.payload.fill }} />
        <span>{entry.name}</span>
        <span className="chart-tooltip-value">{entry.value}</span>
      </div>
    </div>
  );
}

export default function WorkOrderStatusChart({ data }: WorkOrderStatusChartProps) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="chart-card">
        <h3 className="chart-card-title">Work Order Status</h3>
        <div className="chart-empty">No work order data for this period</div>
      </div>
    );
  }

  const chartData = Object.entries(data).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    fill: STATUS_COLORS[status] || "#94a3b8",
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="chart-card">
      <h3 className="chart-card-title">Work Order Status</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: "22px", fontWeight: 700, fill: "#0f172a" }}
            >
              {total}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: "10px", fill: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}
            >
              Total
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {chartData.map((entry, index) => (
          <div key={index} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: entry.fill }} />
            <span>{entry.name} ({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
