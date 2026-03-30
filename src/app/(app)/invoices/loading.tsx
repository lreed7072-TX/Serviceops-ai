export default function InvoicesLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 120 }} />
          <div className="skeleton-bar skeleton-subtitle" />
        </div>
        <div className="skeleton-bar skeleton-btn" />
      </div>
      <div className="skeleton-stats-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-stat-card">
            <div className="skeleton-bar skeleton-stat-value" />
            <div className="skeleton-bar skeleton-stat-label" />
          </div>
        ))}
      </div>
      <div className="skeleton-filter-bar">
        <div className="skeleton-bar skeleton-search" />
        <div className="skeleton-bar skeleton-filter-btn" />
      </div>
      <div className="skeleton-table">
        <div className="skeleton-table-header" style={{ gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-bar skeleton-cell" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-table-row" style={{ gridTemplateColumns: "1fr 2fr 1fr 1fr 1fr" }}>
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="skeleton-bar skeleton-cell-short" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
