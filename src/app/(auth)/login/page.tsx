export default function LoginPage() {
  return (
    <div className="login-card">
      <span className="badge">Invite-only</span>
      <h2>Sign in</h2>
      <p>Use your invite-issued account and org context to access the platform.</p>
      <form>
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" placeholder="you@company.com" />
        <label htmlFor="org">Org ID</label>
        <input id="org" name="org" placeholder="org_123" />
        <button type="button">Request access</button>
      </form>
    </div>
  );
}
