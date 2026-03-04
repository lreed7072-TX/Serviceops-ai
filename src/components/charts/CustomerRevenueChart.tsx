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

interface CustomerRevenue {
  customerId: string;
  customerName: string;
  revenue: number;
  invoiceCount: number;
}

interface CustomerRevenueChartProps {
  data: CustomerRevenue[];
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function truncateName(name: string, maxLen: number = 18): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "\u2026";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
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

export default function CustomerRevenueChart({ data }: CustomerRevenueChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card chart-card-wide">
        <h3 className="chart-card-title">Top Customers by Revenue</h3>
        <div className="chart-empty">No customer data for this period</div>
      </div>
    );
  }

  const chartData = data.slice(0, 10).map((customer) => ({
    name: truncateName(customer.customerName),
    revenue: customer.revenue,
    invoiceCount: customer.invoiceCount,
  }));

  return (
    <div className="chart-card chart-card-wide">
      <h3 className="chart-card-title">Top Customers by Revenue</h3>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 36 + 40)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="revenue"
              fill="#f97316"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
