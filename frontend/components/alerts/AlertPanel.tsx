"use client";

import { useState, useEffect } from "react";
import { fetchWithApiFallback } from "@/lib/api-base";
import { useAlerts } from "@/hooks/useAlerts";
import { useNotifications } from "@/hooks/useAlerts";
import { Alert, AlertCreate } from "@/hooks/useAlerts";
import type { Notification } from "@/hooks/useAlerts";

interface AlertPanelProps {
  symbol?: string;
  className?: string;
}

export default function AlertPanel({ symbol, className = "" }: AlertPanelProps) {
  const { alerts, loading, error, fetchAlerts, createAlert, deleteAlert, updateAlert } = useAlerts();
  const { notifications } = useNotifications();
  const [isExpanded, setIsExpanded] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [formData, setFormData] = useState<AlertCreate>({
    symbol: symbol || "",
    alert_type: "price_above",
    threshold: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    symbol?: string;
    threshold?: string;
  }>({});

  useEffect(() => {
    fetchAlerts(symbol, true); // Fetch active alerts for the symbol if provided
  }, [fetchAlerts, symbol]);

  const validateForm = (): boolean => {
    const errors: { symbol?: string; threshold?: string } = {};
    
    // Validate symbol
    if (!formData.symbol.trim()) {
      errors.symbol = "Stock symbol is required";
    } else if (formData.symbol.trim().length < 1 || formData.symbol.trim().length > 10) {
      errors.symbol = "Symbol must be 1-10 characters";
    }
    
    // Validate threshold
    if (!formData.threshold || formData.threshold <= 0) {
      errors.threshold = "Threshold must be greater than 0";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);

    try {
      const alertData = {
        ...formData,
        symbol: formData.symbol.toUpperCase().trim(),
      };
      await createAlert(alertData);
      
      // Reset form
      setFormData({
        symbol: symbol || "",
        alert_type: "price_above",
        threshold: 0,
      });
      setValidationErrors({});
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    await deleteAlert(alertId);
  };

  const handleToggleActive = async (alertId: number, isActive: boolean) => {
    await updateAlert(alertId, { is_active: !isActive });
  };

  const filteredAlerts = symbol 
    ? alerts.filter(alert => alert.symbol === symbol.toUpperCase())
    : alerts;

  const activeAlerts = filteredAlerts.filter(alert => alert.is_active);
  const visibleActiveAlerts = activeAlerts.slice(0, 10);
  
  // Get last 5 triggered notifications for live feed
  const recentNotifications = notifications.slice(0, 5);

  const handleRunDemo = async () => {
    setDemoLoading(true);
    try {
      setDemoError(null);
      const response = await fetchWithApiFallback("/api/v1/alerts/demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        fetchAlerts(symbol, true);
      } else {
        setDemoError("Unable to run demo alerts right now.");
      }
    } catch {
      setDemoError("Unable to run demo alerts right now.");
    } finally {
      setDemoLoading(false);
    }
  };

  const getAlertTypeColor = (alertType: string) => {
    switch (alertType) {
      case "price_above":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "price_below":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "volatility":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };
  
  const formatNotificationTime = (dateString: string) => {
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

  return (
    <div className={`alert-panel ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Price Alerts
            </h3>
            {activeAlerts.length > 0 && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium px-2 py-1 rounded-full">
                {activeAlerts.length} active
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRunDemo();
              }}
              disabled={demoLoading}
              className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200 disabled:bg-gray-100 disabled:text-gray-400 dark:text-green-400 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:disabled:bg-gray-900/20 dark:disabled:text-gray-500 transition-colors flex items-center gap-1"
            >
              {demoLoading ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  ▶ Run Demo
                </>
              )}
            </button>
            <button 
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <svg 
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
            {demoError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {demoError}
              </div>
            )}
            {/* Live Feed of Recent Notifications */}
            {recentNotifications.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Recent Triggered Alerts
                </h4>
                <div className="space-y-2">
                  {recentNotifications.map((notification: Notification) => (
                    <div 
                      key={notification.id}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getAlertTypeColor(notification.alert_type)}`}>
                          {notification.alert_type === "price_above" && "↑"}
                          {notification.alert_type === "price_below" && "↓"}
                          {notification.alert_type === "volatility" && "⚡"}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {notification.symbol}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {notification.message}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatNotificationTime(notification.triggered_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Create Alert Form */}
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
                Create New Alert
              </h4>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stock Symbol
                    </label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => {
                        setFormData({ ...formData, symbol: e.target.value });
                        // Clear validation error when user starts typing
                        if (validationErrors.symbol) {
                          setValidationErrors(prev => ({ ...prev, symbol: undefined }));
                        }
                      }}
                      placeholder="e.g., AAPL"
                      className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.symbol 
                          ? "border-red-300 dark:border-red-600" 
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      required
                      disabled={!!symbol || submitting}
                    />
                    {validationErrors.symbol && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {validationErrors.symbol}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alert Type
                    </label>
                    <select
                      value={formData.alert_type}
                      onChange={(e) => setFormData({ ...formData, alert_type: e.target.value as AlertCreate["alert_type"] })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={submitting}
                    >
                      <option value="price_above">Price Above</option>
                      <option value="price_below">Price Below</option>
                      <option value="volatility">High Volatility</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Threshold
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.threshold}
                      onChange={(e) => {
                        setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 });
                        // Clear validation error when user starts typing
                        if (validationErrors.threshold) {
                          setValidationErrors(prev => ({ ...prev, threshold: undefined }));
                        }
                      }}
                      placeholder={formData.alert_type === "volatility" ? "e.g., 25" : "e.g., 150.00"}
                      className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.threshold 
                          ? "border-red-300 dark:border-red-600" 
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                      required
                      min="0"
                      disabled={submitting}
                    />
                    {validationErrors.threshold && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {validationErrors.threshold}
                      </p>
                    )}
                  </div>
                </div>
                
                {formError && (
                  <div className="text-red-600 dark:text-red-400 text-sm">
                    {formError}
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Alert...
                    </>
                  ) : (
                    "Create Alert"
                  )}
                </button>
              </form>
            </div>

            {/* Active Alerts List */}
            {activeAlerts.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Active Alerts
                </h4>
                <div className="space-y-2">
                  {visibleActiveAlerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {alert.symbol}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {alert.alert_type === "price_above" && "Price >"}
                            {alert.alert_type === "price_below" && "Price <"}
                            {alert.alert_type === "volatility" && "Volatility >"}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            ${alert.threshold.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Created {new Date(alert.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleActive(alert.id, alert.is_active)}
                          className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                          title={alert.is_active ? "Deactivate" : "Activate"}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(alert.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {activeAlerts.length > visibleActiveAlerts.length && (
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Showing 10 of {activeAlerts.length} stock price alerts.
                  </div>
                )}
              </div>
            )}

            {activeAlerts.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p>No active alerts</p>
                <p className="text-sm mt-1">Create your first alert above or try the demo</p>
              </div>
            )}

            {loading && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Loading alerts...
              </div>
            )}

            {error && (
              <div className="text-center py-4 text-red-600 dark:text-red-400">
                Error: {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
