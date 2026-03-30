export default function SettingsLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header">
        <div>
          <div className="skeleton-bar skeleton-title" style={{ width: 120 }} />
          <div className="skeleton-bar skeleton-subtitle" style={{ width: 200 }} />
        </div>
      </div>
      <div className="skeleton-cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-bar skeleton-card-title" style={{ width: "50%" }} />
            <div className="skeleton-bar skeleton-card-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
