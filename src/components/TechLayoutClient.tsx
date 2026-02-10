"use client";

import { ReactNode } from "react";
import { CheckInProvider } from "@/contexts/CheckInContext";
import { CheckInBanner } from "@/components/CheckInBanner";

export function TechLayoutClient({ children }: { children: ReactNode }) {
  return (
    <CheckInProvider>
      <CheckInBanner />
      {children}
    </CheckInProvider>
  );
}
