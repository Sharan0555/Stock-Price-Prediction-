"use client";

import { memo, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 p-1.5",
  md: "w-10 h-10 p-2",
  lg: "w-12 h-12 p-2.5",
};

const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
};

function ThemeToggle({ className = "", size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  const handleToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`
        ${sizeClasses[size]}
        rounded-full
        border border-[var(--border)]
        bg-[var(--paper-strong)]
        text-[var(--ink)]
        flex items-center justify-center
        transition-all duration-200 ease-out
        hover:border-[var(--accent)]
        hover:shadow-md
        hover:scale-105
        active:scale-95
        focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
        focus:ring-offset-[var(--paper)]
        dark:bg-gray-800 dark:border-gray-600 dark:text-yellow-400 dark:hover:border-yellow-500
        ${className}
      `}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Currently ${theme} mode. Click to toggle.`}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Sun icon - visible in dark mode */}
        <Sun
          size={iconSizes[size]}
          className={`
            absolute
            transition-all duration-200 ease-out
            ${isDark 
              ? "opacity-100 rotate-0 scale-100" 
              : "opacity-0 rotate-90 scale-50"
            }
          `}
          strokeWidth={2}
        />
        {/* Moon icon - visible in light mode */}
        <Moon
          size={iconSizes[size]}
          className={`
            absolute
            transition-all duration-200 ease-out
            ${!isDark 
              ? "opacity-100 rotate-0 scale-100" 
              : "opacity-0 -rotate-90 scale-50"
            }
          `}
          strokeWidth={2}
        />
      </div>
    </button>
  );
}

export default memo(ThemeToggle);
