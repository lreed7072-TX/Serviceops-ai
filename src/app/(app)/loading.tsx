export default function AppLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" />
          <div className="skeleton-bar skeleton-subtitle" />
        </div>
      </div>
      <div className="skeleton-stats-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-stat-card">
            <div className="skeleton-bar skeleton-stat-value" />
            <div className="skeleton-bar skeleton-stat-label" />
          </div>
        ))}
      </div>
      <div className="skeleton-table">
        <div className="skeleton-table-header" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-bar skeleton-cell" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-table-row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="skeleton-bar skeleton-cell-short" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
