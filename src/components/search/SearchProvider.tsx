"use client";

import { useState, useEffect } from "react";
import GlobalSearch from "./GlobalSearch";

export default function SearchProvider() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <GlobalSearch isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
