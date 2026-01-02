"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "link" | "danger";

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
) {
  const { variant = "secondary", className = "", ...rest } = props;

  // Map to your existing CSS conventions (card/link-button/badge/etc.)
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-3 py-2 font-semibold";
  const variants: Record<Variant, string> = {
    primary:
      "bg-black text-white border border-black hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed",
    secondary:
      "bg-white text-black border border-black/15 hover:bg-black/5 disabled:opacity-60 disabled:cursor-not-allowed",
    link:
      "link-button", // uses existing global class
    danger:
      "link-button danger", // uses existing global class
  };

  const cls =
    variant === "link" || variant === "danger"
      ? `${variants[variant]} ${className}`.trim()
      : `${base} ${variants[variant]} ${className}`.trim();

  return <button {...rest} className={cls} />;
}
