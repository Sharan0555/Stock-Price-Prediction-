import { useState, useEffect, useCallback } from "react";
import { fetchWithApiFallback, readApiErrorMessage } from "@/lib/api-base";

export interface Alert {
  id: number;
  symbol: string;
  alert_type: "price_above" | "price_below" | "volatility";
  threshold: number;
  user_id?: string;
  is_active: boolean;
  triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertCreate {
  symbol: string;
  alert_type: "price_above" | "price_below" | "volatility";
  threshold: number;
  user_id?: string;
}

export interface Notification {
  id: string;
  symbol: string;
  message: string;
  alert_type: string;
  triggered_at: string;
  is_read: boolean;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async (symbol?: string, isActive?: boolean) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (symbol) params.append("symbol", symbol);
      if (isActive !== undefined) params.append("is_active", isActive.toString());
      
      const response = await fetchWithApiFallback(`/api/v1/alerts?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(response, `Failed to fetch alerts: ${response.statusText}`),
        );
      }
      
      const data = await response.json();
      setAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  const createAlert = useCallback(async (alert: AlertCreate): Promise<Alert | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithApiFallback("/api/v1/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alert),
      });
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(
            response,
            `Failed to create alert: ${response.statusText}`,
          ),
        );
      }
      
      const newAlert = await response.json();
      setAlerts(prev => [newAlert, ...prev]);
      return newAlert;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create alert";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAlert = useCallback(async (alertId: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithApiFallback(`/api/v1/alerts/${alertId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(
            response,
            `Failed to delete alert: ${response.statusText}`,
          ),
        );
      }
      
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete alert");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAlert = useCallback(async (alertId: number, updates: Partial<Alert>): Promise<Alert | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithApiFallback(`/api/v1/alerts/${alertId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(
            response,
            `Failed to update alert: ${response.statusText}`,
          ),
        );
      }
      
      const updatedAlert = await response.json();
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? updatedAlert : alert
      ));
      return updatedAlert;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update alert";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    alerts,
    loading,
    error,
    fetchAlerts,
    createAlert,
    deleteAlert,
    updateAlert,
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false);
  const [pollInterval, setPollInterval] = useState(30000); // Start with 30 seconds

  const fetchNotifications = useCallback(async (unreadOnly: boolean = true) => {
    setLoading(true);
    
    try {
      const response = await fetchWithApiFallback(
        `/api/v1/notifications?unread_only=${unreadOnly}`,
        {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        },
      );
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(
            response,
            `Failed to fetch notifications: ${response.statusText}`,
          ),
        );
      }
      
      const data = await response.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      
      // Reset error state on successful fetch
      setConsecutiveErrors(0);
      setHasConnectionIssue(false);
      setError(null);
      
      // Reset to normal polling interval on success
      if (pollInterval > 30000) {
        setPollInterval(30000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch notifications";
      setError(errorMessage);
      
      // Increment consecutive errors
      const newErrorCount = consecutiveErrors + 1;
      setConsecutiveErrors(newErrorCount);
      
      // Implement exponential backoff after 3 consecutive errors
      if (newErrorCount >= 3) {
        setHasConnectionIssue(true);
        const newInterval = Math.min(300000, 30000 * Math.pow(2, newErrorCount - 3)); // Max 5 minutes
        setPollInterval(newInterval);
      }
    } finally {
      setLoading(false);
    }
  }, [consecutiveErrors, pollInterval]);

  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      const response = await fetchWithApiFallback(`/api/v1/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(
            response,
            `Failed to mark notification as read: ${response.statusText}`,
          ),
        );
      }
      
      setNotifications(prev => prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, is_read: true }
          : notification
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark notification as read");
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetchWithApiFallback("/api/v1/notifications/read-all", {
        method: "PATCH",
      });
      
      if (!response.ok) {
        throw new Error(
          await readApiErrorMessage(
            response,
            `Failed to mark all notifications as read: ${response.statusText}`,
          ),
        );
      }
      
      setNotifications(prev => prev.map(notification => ({ ...notification, is_read: true })));
      setUnreadCount(0);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all notifications as read");
      return false;
    }
  }, []);

  // Auto-refresh notifications with dynamic interval
  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchNotifications();
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [fetchNotifications, pollInterval]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    hasConnectionIssue,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
