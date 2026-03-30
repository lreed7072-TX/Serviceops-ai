export default function SchedulingLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 140 }} />
          <div className="skeleton-bar skeleton-subtitle" />
        </div>
      </div>
      <div className="skeleton-filter-bar">
        <div className="skeleton-bar skeleton-filter-btn" style={{ width: 120 }} />
        <div className="skeleton-bar skeleton-filter-btn" style={{ width: 120 }} />
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
