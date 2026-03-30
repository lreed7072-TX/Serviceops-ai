export default function DashboardLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 140 }} />
          <div className="skeleton-bar skeleton-subtitle" style={{ width: 240 }} />
        </div>
      </div>
      <div className="skeleton-kpi-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-kpi-card">
            <div className="skeleton-bar skeleton-kpi-icon" />
            <div>
              <div className="skeleton-bar skeleton-kpi-value" />
              <div className="skeleton-bar skeleton-kpi-label" />
            </div>
          </div>
        ))}
      </div>
      <div className="skeleton-charts-grid">
        <div className="skeleton-chart">
          <div className="skeleton-bar skeleton-cell" style={{ width: 180 }} />
          <div className="skeleton-bar skeleton-chart-area" />
        </div>
        <div className="skeleton-chart">
          <div className="skeleton-bar skeleton-cell" style={{ width: 180 }} />
          <div className="skeleton-bar skeleton-chart-area" />
        </div>
      </div>
      <div className="skeleton-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-stat-card">
            <div className="skeleton-bar skeleton-stat-value" />
            <div className="skeleton-bar skeleton-stat-label" />
            <div className="skeleton-bar skeleton-stat-label" style={{ marginTop: 8, width: 80 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
