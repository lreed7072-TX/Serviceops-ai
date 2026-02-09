"use client";

import { useState } from "react";
import type { FilterConfig, FilterValue, FilterPreset } from "@/hooks/useAdvancedFilters";
import "./AdvancedFilterPanel.css";

type AdvancedFilterPanelProps = {
  configs: FilterConfig[];
  filters: Record<string, FilterValue>;
  setFilter: (key: string, value: FilterValue) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  presets: FilterPreset[];
  savePreset: (name: string) => FilterPreset;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
};

export default function AdvancedFilterPanel({
  configs,
  filters,
  setFilter,
  clearAllFilters,
  activeFilterCount,
  hasActiveFilters,
  presets,
  savePreset,
  loadPreset,
  deletePreset,
}: AdvancedFilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName("");
    setShowSaveModal(false);
  };

  const handlePresetDelete = (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    deletePreset(presetId);
  };

  const handleMultiToggle = (key: string, value: string) => {
    const current = (filters[key] as string[]) || [];
    if (current.includes(value)) {
      setFilter(
        key,
        current.filter((v) => v !== value)
      );
    } else {
      setFilter(key, [...current, value]);
    }
  };

  const handleDateChange = (key: string, index: 0 | 1, value: string) => {
    const current = (filters[key] as [string, string]) || ["", ""];
    const updated: [string, string] = [...current] as [string, string];
    updated[index] = value;
    setFilter(key, updated);
  };

  return (
    <>
      <div className="afp-container">
        <button className="afp-toggle" onClick={() => setExpanded(!expanded)}>
          <div className="afp-toggle-left">
            <svg
              className={`afp-toggle-icon ${expanded ? "afp-expanded" : ""}`}
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
            <span className="afp-toggle-label">Advanced Filters</span>
            {activeFilterCount > 0 && (
              <span className="afp-badge-count">{activeFilterCount}</span>
            )}
          </div>
          <div className="afp-toggle-right">
            {presets.length > 0 && !expanded && (
              <div className="afp-presets">
                <span className="afp-presets-label">Presets:</span>
                {presets.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className="afp-preset-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadPreset(p.id);
                    }}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        {expanded && (
          <div className="afp-body">
            <div className="afp-filters-grid">
              {configs.map((config) => (
                <div key={config.key} className="afp-filter-group">
                  <label className="afp-filter-label">{config.label}</label>

                  {config.type === "select" && (
                    <select
                      className={`afp-filter-select ${filters[config.key] ? "afp-has-value" : ""}`}
                      value={(filters[config.key] as string) || ""}
                      onChange={(e) => setFilter(config.key, e.target.value || "")}
                    >
                      <option value="">All</option>
                      {config.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {config.type === "text" && (
                    <input
                      type="text"
                      className={`afp-filter-input ${
                        (filters[config.key] as string)?.trim() ? "afp-has-value" : ""
                      }`}
                      value={(filters[config.key] as string) || ""}
                      onChange={(e) => setFilter(config.key, e.target.value)}
                      placeholder={`Filter by ${config.label.toLowerCase()}...`}
                    />
                  )}

                  {config.type === "multiSelect" && (
                    <div className="afp-multi-select">
                      {config.options?.map((opt) => {
                        const selected = ((filters[config.key] as string[]) || []).includes(
                          opt.value
                        );
                        return (
                          <label
                            key={opt.value}
                            className={`afp-multi-option ${selected ? "afp-multi-selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => handleMultiToggle(config.key, opt.value)}
                            />
                            <span className="afp-multi-check">
                              <span className="afp-multi-check-icon">✓</span>
                            </span>
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {config.type === "dateRange" && (
                    <div className="afp-date-range">
                      <input
                        type="date"
                        value={((filters[config.key] as [string, string]) || ["", ""])[0]}
                        onChange={(e) => handleDateChange(config.key, 0, e.target.value)}
                      />
                      <span className="afp-date-sep">to</span>
                      <input
                        type="date"
                        value={((filters[config.key] as [string, string]) || ["", ""])[1]}
                        onChange={(e) => handleDateChange(config.key, 1, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="afp-actions">
              <div className="afp-actions-left">
                {hasActiveFilters && (
                  <button className="afp-clear-btn" onClick={clearAllFilters}>
                    Clear all filters
                  </button>
                )}
                {hasActiveFilters && (
                  <button className="afp-save-btn" onClick={() => setShowSaveModal(true)}>
                    Save as preset
                  </button>
                )}
              </div>

              <div className="afp-actions-right">
                {presets.length > 0 && (
                  <div className="afp-presets">
                    <span className="afp-presets-label">Presets:</span>
                    {presets.map((p) => (
                      <span
                        key={p.id}
                        className="afp-preset-chip"
                        onClick={() => loadPreset(p.id)}
                      >
                        {p.name}
                        <button
                          className="afp-preset-delete"
                          onClick={(e) => handlePresetDelete(e, p.id)}
                          title="Delete preset"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Preset Modal */}
      {showSaveModal && (
        <div className="afp-save-modal" onClick={() => setShowSaveModal(false)}>
          <div className="afp-save-modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>Save Filter Preset</h4>
            <input
              className="afp-save-modal-input"
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name (e.g., Open High Priority)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
                if (e.key === "Escape") setShowSaveModal(false);
              }}
            />
            <div className="afp-save-modal-actions">
              <button className="afp-modal-cancel" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button
                className="afp-modal-save"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
