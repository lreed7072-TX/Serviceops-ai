import type { ReactNode } from "react";
import "./shared-ui.css";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state">
      {icon && <div className="ui-empty-icon">{icon}</div>}
      <h3 className="ui-empty-title">{title}</h3>
      {description && <p className="ui-empty-description">{description}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
