"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import "./NotificationBell.css";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (notificationIds: string[]) => {
    try {
      await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await apiFetch("/api/notifications/mark-all-read", { method: "POST" });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      markAsRead([notification.id]);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      WORK_ORDER_ASSIGNED: "📋",
      WORK_ORDER_STATUS_CHANGED: "🔄",
      TASK_COMPLETED: "✅",
      COMMENT_ADDED: "💬",
      PM_SCHEDULE_DUE: "🔔",
      QUOTE_APPROVED: "👍",
      QUOTE_REJECTED: "👎",
      INVOICE_PAID: "💰",
      // CRM notification types
      SERVICE_TICKET_CREATED: "🎫",
      SERVICE_TICKET_CONVERTED: "🔀",
      FOLLOW_UP_OVERDUE: "⏰",
      OPPORTUNITY_WON: "🏆",
      OPPORTUNITY_LOST: "📉",
    };
    return icons[type] || "📢";
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="nb-container">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="nb-bell"
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="nb-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="nb-overlay" onClick={() => setIsOpen(false)} />
          <div className="nb-dropdown">
            <div className="nb-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} disabled={loading} className="nb-mark-all">
                  {loading ? "..." : "Mark all read"}
                </button>
              )}
            </div>

            <div className="nb-list">
              {notifications.length === 0 ? (
                <div className="nb-empty">
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`nb-item ${!n.readAt ? "nb-unread" : ""}`}
                  >
                    <span className="nb-item-icon">{getNotificationIcon(n.type)}</span>
                    <div className="nb-item-content">
                      <div className="nb-item-title">{n.title}</div>
                      <div className="nb-item-message">{n.message}</div>
                      <div className="nb-item-time">{getTimeAgo(n.createdAt)}</div>
                    </div>
                    {!n.readAt && <span className="nb-unread-dot" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
