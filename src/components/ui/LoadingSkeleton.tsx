import "./LoadingSkeleton.css";

export function TaskListSkeleton() {
  return (
    <div className="skeleton-container">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-header">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-badge" />
          </div>
          <div className="skeleton-line skeleton-text" />
          <div className="skeleton-line skeleton-text short" />
          <div className="skeleton-actions">
            <div className="skeleton-button" />
            <div className="skeleton-button" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-text" />
          <div className="skeleton-line skeleton-text short" />
        </div>
      ))}
    </div>
  );
}
