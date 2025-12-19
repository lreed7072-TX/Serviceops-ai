export default function SitesPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Sites</h2>
          <p>Track facilities, addresses, and service coverage.</p>
        </div>
        <span className="badge">Org scoped</span>
      </div>
      <div className="card-grid">
        <div className="card">
          <h3>Priority sites</h3>
          <p>High-impact locations requiring faster response.</p>
        </div>
        <div className="card">
          <h3>Remote sites</h3>
          <p>Locations needing travel planning and access notes.</p>
        </div>
        <div className="card">
          <h3>Compliance sites</h3>
          <p>Preventive visits and inspection schedules.</p>
        </div>
      </div>
    </div>
  );
}
