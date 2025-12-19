export default function CustomersPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Customers</h2>
          <p>Manage client accounts across regions and service tiers.</p>
        </div>
        <span className="badge">CRUD API ready</span>
      </div>
      <div className="card">
        <h3>Customer list</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Sites</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Acme Facilities</td>
              <td>Active</td>
              <td>12</td>
            </tr>
            <tr>
              <td>Northwind Utilities</td>
              <td>Active</td>
              <td>5</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
