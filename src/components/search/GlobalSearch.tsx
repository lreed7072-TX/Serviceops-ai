"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { debounce } from "@/lib/utils";
import "./GlobalSearch.css";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url: string;
  badge?: string;
  status?: string;
  priority?: string;
  contact?: string;
  location?: string;
  serialNumber?: string;
  customer?: string;
  counts?: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, SearchResult[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const flatResults = useMemo(() => Object.values(results).flat(), [results]);
  const totalResults = flatResults.length;

  // Debounced search
  const debouncedSearch = useRef(
    debounce(async (q: string) => {
      if (!q || q.length < 2) {
        setResults({});
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.data || {});
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    setSelectedIndex(0);
    if (query.trim().length >= 2) {
      setLoading(true);
      debouncedSearch(query.trim());
    } else {
      setResults({});
      setLoading(false);
    }
  }, [query, debouncedSearch]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery("");
      setResults({});
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, totalResults - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && totalResults > 0) {
        e.preventDefault();
        const selected = flatResults[selectedIndex];
        if (selected) {
          router.push(selected.url);
          onClose();
        }
      }
    },
    [isOpen, selectedIndex, totalResults, flatResults, router, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const getResultIcon = (type: string) => {
    const icons: Record<string, string> = {
      "work-order": "\u{1F4CB}",
      customer: "\u{1F464}",
      asset: "\u{2699}\uFE0F",
      site: "\u{1F4CD}",
    };
    return icons[type] || "\u{1F4C4}";
  };

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      OPEN: "blue",
      IN_PROGRESS: "yellow",
      COMPLETED: "green",
      CANCELED: "red",
    };
    return colors[status || ""] || "gray";
  };

  let globalIdx = 0;

  return (
    <div className="gs-overlay" onClick={onClose}>
      <div className="gs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gs-header">
          <svg className="gs-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16ZM19 19l-4.35-4.35" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work orders, customers, assets, sites..."
            className="gs-input"
          />
          {loading && <span className="gs-spinner" />}
          <button onClick={onClose} className="gs-close-btn">
            Esc
          </button>
        </div>

        <div className="gs-results">
          {query.length < 2 && (
            <div className="gs-empty">
              <p>Type at least 2 characters to search</p>
              <div className="gs-tips">
                <p className="gs-tips-title">Search tips:</p>
                <ul>
                  <li>Work order numbers (e.g., WO-001234)</li>
                  <li>Customer names or contact info</li>
                  <li>Asset names, serial numbers, or tags</li>
                  <li>Site names or addresses</li>
                </ul>
              </div>
            </div>
          )}

          {query.length >= 2 && !loading && totalResults === 0 && (
            <div className="gs-empty">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <p className="gs-hint">Try different keywords or check spelling</p>
            </div>
          )}

          {Object.entries(results).map(([category, items]) => {
            if (!items || items.length === 0) return null;

            const categoryLabel: Record<string, string> = {
              workOrders: "Work Orders",
              customers: "Customers",
              assets: "Assets",
              sites: "Sites",
            };

            return (
              <div key={category} className="gs-category">
                <h3 className="gs-category-title">
                  {categoryLabel[category] || category}
                  <span className="gs-category-count">{items.length}</span>
                </h3>
                <div className="gs-category-items">
                  {items.map((result) => {
                    const idx = globalIdx++;
                    const isSelected = idx === selectedIndex;

                    return (
                      <button
                        key={result.id}
                        className={`gs-result ${isSelected ? "gs-selected" : ""}`}
                        onClick={() => {
                          router.push(result.url);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <span className="gs-result-icon">
                          {getResultIcon(result.type)}
                        </span>
                        <div className="gs-result-content">
                          <div className="gs-result-title">{result.title}</div>
                          {result.subtitle && (
                            <div className="gs-result-sub">{result.subtitle}</div>
                          )}
                          {result.contact && (
                            <div className="gs-result-meta">{result.contact}</div>
                          )}
                          {result.location && (
                            <div className="gs-result-meta">{result.location}</div>
                          )}
                          {result.serialNumber && (
                            <div className="gs-result-meta">SN: {result.serialNumber}</div>
                          )}
                          {result.customer && (
                            <div className="gs-result-meta">{result.customer}</div>
                          )}
                          {result.counts && (
                            <div className="gs-result-meta">{result.counts}</div>
                          )}
                        </div>
                        <div className="gs-result-badges">
                          {result.badge && (
                            <span className="gs-badge">{result.badge}</span>
                          )}
                          {result.status && (
                            <span className={`gs-status gs-status-${getStatusColor(result.status)}`}>
                              {result.status.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="gs-footer">
          <span className="gs-hint-item"><kbd>&uarr;&darr;</kbd> Navigate</span>
          <span className="gs-hint-item"><kbd>Enter</kbd> Select</span>
          <span className="gs-hint-item"><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
