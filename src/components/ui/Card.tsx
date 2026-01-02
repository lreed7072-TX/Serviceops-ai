import type { HTMLAttributes } from "react";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div {...rest} className={`card ${className}`.trim()} />;
}

export function CardHeader(props: HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div {...rest} className={`card-header ${className}`.trim()} />;
}
