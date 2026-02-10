"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "@/lib/api";

export type ActiveCheckIn = {
  id: string;
  workOrderId: string;
  checkInAt: string;
  latitude: number | null;
  longitude: number | null;
  workOrder: {
    id: string;
    title: string;
    workOrderNumber: string | null;
    status: string;
  };
  site: {
    name: string;
    address: string;
  } | null;
};

type CheckInContextValue = {
  activeCheckIn: ActiveCheckIn | null;
  loading: boolean;
  refreshCheckIn: () => Promise<void>;
};

const CheckInContext = createContext<CheckInContextValue>({
  activeCheckIn: null,
  loading: true,
  refreshCheckIn: async () => {},
});

export function useCheckIn() {
  return useContext(CheckInContext);
}

export function CheckInProvider({ children }: { children: ReactNode }) {
  const [activeCheckIn, setActiveCheckIn] = useState<ActiveCheckIn | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshCheckIn = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/active-check-in", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setActiveCheckIn(json.data ?? null);
      }
    } catch (e) {
      console.error("Failed to fetch active check-in:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCheckIn();
    // Poll every 60 seconds to keep duration fresh
    const interval = setInterval(refreshCheckIn, 60000);
    return () => clearInterval(interval);
  }, [refreshCheckIn]);

  return (
    <CheckInContext.Provider value={{ activeCheckIn, loading, refreshCheckIn }}>
      {children}
    </CheckInContext.Provider>
  );
}
