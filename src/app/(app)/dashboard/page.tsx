export default function DashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Operations overview</h2>
          <p>Live status across work orders, visits, and technicians.</p>
        </div>
        <span className="badge">Org-scoped</span>
      </div>
      <div className="card-grid">
        <div className="card">
          <h3>Open work orders</h3>
          <p>Track backlog, priorities, and SLAs.</p>
        </div>
        <div className="card">
          <h3>Scheduled visits</h3>
          <p>Tomorrow and next-week dispatch coverage.</p>
        </div>
        <div className="card">
          <h3>Technician load</h3>
          <p>Balanced assignments by skill and territory.</p>
        </div>
        <div className="card">
          <h3>Closeout readiness</h3>
          <p>Missing measurements, files, and summaries.</p>
        </div>
      </div>
    </div>
  );
}
