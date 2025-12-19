export default function WorkOrdersPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Work Orders</h2>
          <p>Dispatch queue and SLA tracking.</p>
        </div>
        <span className="badge">Dispatcher view</span>
      </div>
      <div className="card">
        <h3>Active queue</h3>
        <p>Review open, in-progress, and blocked work orders.</p>
      </div>
    </div>
  );
}
