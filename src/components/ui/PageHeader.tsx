import type { ReactNode } from "react";
import "./shared-ui.css";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  badge?: ReactNode;
  count?: number;
}

export function PageHeader({ title, subtitle, right, badge, count }: PageHeaderProps) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header-left">
        <div className="ui-page-header-title-row">
          <h1 className="ui-page-title">{title}</h1>
          {badge && <span className="ui-page-header-badge">{badge}</span>}
          {count !== undefined && (
            <span className="ui-page-header-count">{count}</span>
          )}
        </div>
        {subtitle && <p className="ui-page-subtitle">{subtitle}</p>}
      </div>
      {right && <div className="ui-page-header-right">{right}</div>}
    </div>
  );
}
