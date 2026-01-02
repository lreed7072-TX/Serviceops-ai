import type { HTMLAttributes } from "react";

export function Badge(props: HTMLAttributes<HTMLSpanElement>) {
  const { className = "", ...rest } = props;
  return <span {...rest} className={`badge ${className}`.trim()} />;
}
