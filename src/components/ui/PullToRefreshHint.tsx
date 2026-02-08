"use client";

import { useEffect, useState } from "react";
import "./PullToRefreshHint.css";

export default function PullToRefreshHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem("pull-to-refresh-hint-seen");
    if (!hasSeenHint && window.innerWidth < 768) {
      const showTimer = setTimeout(() => setShow(true), 2000);
      const hideTimer = setTimeout(() => {
        setShow(false);
        localStorage.setItem("pull-to-refresh-hint-seen", "true");
      }, 7000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  if (!show) return null;

  return (
    <div className="pull-refresh-hint">
      <div className="pull-refresh-icon">↓</div>
      <span>Pull down to refresh</span>
    </div>
  );
}
