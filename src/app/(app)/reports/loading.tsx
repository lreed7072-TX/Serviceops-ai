export default function ReportsLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 110 }} />
          <div className="skeleton-bar skeleton-subtitle" />
        </div>
        <div className="skeleton-bar skeleton-btn" />
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
