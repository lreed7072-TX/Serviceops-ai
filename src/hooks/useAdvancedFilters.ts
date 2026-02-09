"use client";

import { useState, useCallback, useMemo } from "react";

export type FilterValue = string | string[] | [string, string] | null;

export type FilterConfig = {
  key: string;
  label: string;
  type: "select" | "multiSelect" | "dateRange" | "text";
  options?: { value: string; label: string }[];
};

export type FilterState = Record<string, FilterValue>;

export type FilterPreset = {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
};

const PRESETS_STORAGE_KEY = "serviceops_filter_presets";

function loadPresets(pageKey: string): FilterPreset[] {
  try {
    const raw = localStorage.getItem(`${PRESETS_STORAGE_KEY}_${pageKey}`);
    if (!raw) return [];
    return JSON.parse(raw) as FilterPreset[];
  } catch {
    return [];
  }
}

function savePresetsToStorage(pageKey: string, presets: FilterPreset[]) {
  try {
    localStorage.setItem(`${PRESETS_STORAGE_KEY}_${pageKey}`, JSON.stringify(presets));
  } catch {
    // localStorage full or unavailable
  }
}

export function useAdvancedFilters(pageKey: string, configs: FilterConfig[]) {
  const defaultState = useMemo(() => {
    const state: FilterState = {};
    for (const config of configs) {
      if (config.type === "multiSelect") {
        state[config.key] = [];
      } else if (config.type === "dateRange") {
        state[config.key] = ["", ""];
      } else {
        state[config.key] = "";
      }
    }
    return state;
  }, [configs]);

  const [filters, setFilters] = useState<FilterState>(() => ({ ...defaultState }));
  const [presets, setPresets] = useState<FilterPreset[]>(() => loadPresets(pageKey));

  const setFilter = useCallback((key: string, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({ ...defaultState });
  }, [defaultState]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const config of configs) {
      const val = filters[config.key];
      if (config.type === "multiSelect") {
        if (Array.isArray(val) && val.length > 0) count++;
      } else if (config.type === "dateRange") {
        if (Array.isArray(val) && (val[0] || val[1])) count++;
      } else if (config.type === "text") {
        if (typeof val === "string" && val.trim()) count++;
      } else {
        if (val && val !== "") count++;
      }
    }
    return count;
  }, [filters, configs]);

  const hasActiveFilters = activeFilterCount > 0;

  const savePreset = useCallback(
    (name: string) => {
      const preset: FilterPreset = {
        id: crypto.randomUUID(),
        name,
        filters: { ...filters },
        createdAt: new Date().toISOString(),
      };
      const updated = [...presets, preset];
      setPresets(updated);
      savePresetsToStorage(pageKey, updated);
      return preset;
    },
    [filters, presets, pageKey]
  );

  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        setFilters({ ...defaultState, ...preset.filters });
      }
    },
    [presets, defaultState]
  );

  const deletePreset = useCallback(
    (presetId: string) => {
      const updated = presets.filter((p) => p.id !== presetId);
      setPresets(updated);
      savePresetsToStorage(pageKey, updated);
    },
    [presets, pageKey]
  );

  return {
    filters,
    setFilter,
    clearAllFilters,
    activeFilterCount,
    hasActiveFilters,
    presets,
    savePreset,
    loadPreset,
    deletePreset,
    configs,
  };
}
