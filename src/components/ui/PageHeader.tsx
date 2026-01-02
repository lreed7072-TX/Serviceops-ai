import type { ReactNode } from "react";

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  badge?: ReactNode;
}) {
  const { title, subtitle, right, badge } = props;

  return (
    <div className="page-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {badge ?? null}
        {right ?? null}
      </div>
    </div>
  );
}
