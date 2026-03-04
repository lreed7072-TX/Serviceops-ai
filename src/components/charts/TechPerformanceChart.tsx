"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TechPerformance {
  userId: string;
  userName: string;
  taskCount: number;
  completedTasks: number;
  completionRate: number;
}

interface TechPerformanceChartProps {
  data: TechPerformance[];
}

function truncateName(name: string, maxLen: number = 14): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "\u2026";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#3b82f6" }} />
        <span>Assigned</span>
        <span className="chart-tooltip-value">{entry?.taskCount ?? 0}</span>
      </div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#10b981" }} />
        <span>Completed</span>
        <span className="chart-tooltip-value">{entry?.completedTasks ?? 0}</span>
      </div>
      <div className="chart-tooltip-item">
        <span className="chart-tooltip-dot" style={{ background: "#94a3b8" }} />
        <span>Completion Rate</span>
        <span className="chart-tooltip-value">{entry?.completionRate?.toFixed(1) ?? 0}%</span>
      </div>
    </div>
  );
}

export default function TechPerformanceChart({ data }: TechPerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card chart-card-wide">
        <h3 className="chart-card-title">Technician Performance</h3>
        <div className="chart-empty">No technician data for this period</div>
      </div>
    );
  }

  const chartData = data.slice(0, 10).map((tech) => ({
    name: truncateName(tech.userName),
    taskCount: tech.taskCount,
    completedTasks: tech.completedTasks,
    completionRate: tech.completionRate,
  }));

  return (
    <div className="chart-card chart-card-wide">
      <h3 className="chart-card-title">Technician Performance</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={280}>
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
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              name="Assigned"
              dataKey="taskCount"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              name="Completed"
              dataKey="completedTasks"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
