export default function TechLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 160 }} />
          <div className="skeleton-bar skeleton-subtitle" />
        </div>
      </div>
      <div className="skeleton-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-stat-card">
            <div className="skeleton-bar skeleton-stat-value" />
            <div className="skeleton-bar skeleton-stat-label" />
          </div>
        ))}
      </div>
      <div className="skeleton-cards-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-bar skeleton-card-title" />
            <div className="skeleton-bar skeleton-card-line" />
            <div className="skeleton-bar skeleton-card-line-short" />
          </div>
        ))}
      </div>
    </div>
  );
}
