"use client";

import { useEffect, useState } from "react";
import "./SearchTrigger.css";

export default function SearchTrigger() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  const handleClick = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  };

  return (
    <button className="search-trigger-btn" onClick={handleClick}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path
          d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16ZM19 19l-4.35-4.35"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="search-trigger-text">Search</span>
      <kbd className="search-trigger-kbd">{isMac ? "\u2318" : "Ctrl"}+K</kbd>
    </button>
  );
}
