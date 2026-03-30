export default function CustomersLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 140 }} />
          <div className="skeleton-bar skeleton-subtitle" style={{ width: 300 }} />
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
        <div className="skeleton-bar skeleton-filter-btn" />
        <div className="skeleton-bar skeleton-filter-btn" />
      </div>
      <div className="skeleton-cards-grid">
        {Array.from({ length: 6 }).map((_, i) => (
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
