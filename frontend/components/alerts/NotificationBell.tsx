"use client";

import { useState, useRef, useEffect } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import { useNotifications } from "@/hooks/useAlerts";
import type { Notification } from "@/hooks/useAlerts";

const SAMPLE_ALERT_CANDIDATES = [
  { symbol: "AAPL", base: 212.45, alert_type: "price_above" as const },
  { symbol: "MSFT", base: 428.1, alert_type: "price_below" as const },
  { symbol: "NVDA", base: 118.6, alert_type: "price_above" as const },
  { symbol: "AMZN", base: 186.25, alert_type: "price_below" as const },
  { symbol: "GOOGL", base: 171.4, alert_type: "price_above" as const },
  { symbol: "META", base: 498.8, alert_type: "price_below" as const },
  { symbol: "TSLA", base: 177.3, alert_type: "price_above" as const },
  { symbol: "RELIANCE", base: 2940.0, alert_type: "price_below" as const },
  { symbol: "TCS", base: 4015.0, alert_type: "price_above" as const },
  { symbol: "HDFCBANK", base: 1682.0, alert_type: "price_below" as const },
  { symbol: "ITC", base: 432.0, alert_type: "price_above" as const },
  { symbol: "SBIN", base: 812.0, alert_type: "price_below" as const },
];

type SampleAlert = {
  id: string;
  symbol: string;
  alert_type: "price_above" | "price_below" | "volatility";
  threshold: number;
};

function buildSampleAlerts(): SampleAlert[] {
  const shuffled = [...SAMPLE_ALERT_CANDIDATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 10).map((item, index) => {
    const direction = item.alert_type === "price_above" ? 1.01 : 0.99;
    const variance = 1 + ((index % 5) + 1) * 0.003;
    return {
      id: `sample-${item.symbol}-${index}`,
      symbol: item.symbol,
      alert_type: item.alert_type,
      threshold: Number((item.base * direction * variance).toFixed(2)),
    };
  });
}

export default function NotificationBell() {
  const { alerts, fetchAlerts } = useAlerts();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading, hasConnectionIssue } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [sampleAlerts] = useState<SampleAlert[]>(() => buildSampleAlerts());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadCount = useRef(unreadCount);
  const activeAlerts = alerts.filter((alert) => alert.is_active).slice(0, 10);
  const visibleAlerts = activeAlerts.length > 0 ? activeAlerts : sampleAlerts;

  useEffect(() => {
    if (!isOpen) return;
    void fetchAlerts(undefined, true);
  }, [fetchAlerts, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Request notification permission on first notification and handle push notifications
  useEffect(() => {
    if (unreadCount > prevUnreadCount.current && prevUnreadCount.current === 0) {
      requestNotificationPermission();
    }
    
    // Trigger animation when new notifications arrive
    if (unreadCount > prevUnreadCount.current) {
      triggerBellAnimation();
      
      // Send browser notification if permission granted
      if (notificationPermission === "granted" && notifications.length > 0) {
        const latestNotification = notifications[0];
        sendBrowserNotification(latestNotification);
      }
    }
    
    prevUnreadCount.current = unreadCount;
  }, [unreadCount, notifications, notificationPermission]);

  // Check notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  const sendBrowserNotification = (notification: Notification) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Stock Alert", {
        body: notification.message,
        icon: "/favicon.ico"
      });
    }
  };

  const triggerBellAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "price_above":
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case "price_below":
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        );
      case "volatility":
        return (
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const formatAlertLabel = (alertType: string, threshold: number) => {
    if (alertType === "price_above") {
      return `Price above $${threshold.toFixed(2)}`;
    }
    if (alertType === "price_below") {
      return `Price below $${threshold.toFixed(2)}`;
    }
    return `Volatility above ${threshold.toFixed(2)}`;
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className={`w-6 h-6 ${isAnimating ? "animate-bounce" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        
        {hasConnectionIssue && (
          <span className="absolute -bottom-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center" title="Connection issues">
            !
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {visibleAlerts.length > 0 && (
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Stock Price Alerts
                </div>
                <div className="space-y-2">
                  {visibleAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-750"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {alert.symbol}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatAlertLabel(alert.alert_type, alert.threshold)}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {activeAlerts.length > 0 ? "Active" : "Watch"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {loading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Loading notifications...
              </div>
            ) : hasConnectionIssue ? (
              <div className="p-4 text-center">
                <div className="text-yellow-600 dark:text-yellow-400 text-sm font-medium mb-2">
                  Connection Issues
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  Having trouble connecting to the server. Will retry automatically.
                </div>
                {notifications.length > 0 && (
                  <div className="mt-3 text-xs text-gray-400">
                    Showing {notifications.length} cached notifications
                  </div>
                )}
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {notifications.slice(0, 10).map((notification: Notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      !notification.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getAlertIcon(notification.alert_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {notification.symbol}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimeAgo(notification.triggered_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                          {notification.message}
                        </p>
                        {!notification.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No notifications</p>
                <p className="text-sm mt-1">You&apos;re all caught up!</p>
              </div>
            )}
          </div>

          {notifications.length > 10 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
