"use client";

import { memo } from "react";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: "default" | "card" | "circle" | "text" | "chart";
}

function Skeleton({
  className = "",
  width,
  height,
  borderRadius,
  variant = "default",
}: SkeletonProps) {
  const getDefaultDimensions = () => {
    switch (variant) {
      case "card":
        return { width: width ?? "100%", height: height ?? "200px", borderRadius: borderRadius ?? "16px" };
      case "circle":
        return { width: width ?? "40px", height: height ?? "40px", borderRadius: "50%" };
      case "text":
        return { width: width ?? "100%", height: height ?? "16px", borderRadius: borderRadius ?? "4px" };
      case "chart":
        return { width: width ?? "100%", height: height ?? "220px", borderRadius: borderRadius ?? "8px" };
      default:
        return { width: width ?? "100%", height: height ?? "20px", borderRadius: borderRadius ?? "4px" };
    }
  };

  const dims = getDefaultDimensions();

  return (
    <div
      className={`
        skeleton
        animate-pulse
        bg-[var(--skeleton-bg)]
        ${className}
      `}
      style={{
        width: dims.width,
        height: dims.height,
        borderRadius: dims.borderRadius ?? borderRadius,
      }}
      aria-hidden="true"
    />
  );
}

// Pre-configured skeleton components for common use cases
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`p-4 rounded-2xl bg-[var(--paper-strong)] border border-[var(--border)] ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={14} />
        </div>
      </div>
      <Skeleton variant="text" width="100%" height={60} className="mb-3" />
      <div className="flex justify-between items-center">
        <Skeleton variant="text" width="30%" height={24} />
        <Skeleton variant="text" width="20%" height={14} />
      </div>
    </div>
  );
}

export function SkeletonStockCard({ className = "" }: { className?: string }) {
  return (
    <div className={`p-4 rounded-2xl bg-[var(--paper-strong)] border border-[var(--border)] ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="40%" height={14} />
        </div>
        <Skeleton variant="text" width={50} height={24} borderRadius={999} />
      </div>
      {/* Price */}
      <div className="mb-4">
        <Skeleton variant="text" width="50%" height={32} className="mb-1" />
        <Skeleton variant="text" width="30%" height={16} />
      </div>
      {/* Prediction */}
      <div className="mb-4 space-y-2">
        <Skeleton variant="text" width="25%" height={12} />
        <Skeleton variant="text" width="40%" height={24} />
        <Skeleton variant="text" width="30%" height={14} />
      </div>
      {/* Chart area */}
      <div className="flex items-end gap-1 h-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="text"
            width="100%"
            height={`${20 + (i % 3) * 20}%`}
            borderRadius={2}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`p-4 rounded-2xl bg-[var(--paper-strong)] border border-[var(--border)] ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="20%" height={14} />
      </div>
      <Skeleton variant="chart" />
    </div>
  );
}

export function SkeletonMetricCards({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-xl bg-[var(--paper-strong)] border border-[var(--border)]"
        >
          <Skeleton variant="text" width="60%" height={12} className="mb-2" />
          <Skeleton variant="text" width="80%" height={28} className="mb-1" />
          <Skeleton variant="text" width="40%" height={14} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonSignalBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`p-6 rounded-xl bg-[var(--paper-strong)] border border-[var(--border)] ${className}`}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" width={56} height={56} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="30%" height={14} />
          <Skeleton variant="text" width="20%" height={32} />
        </div>
        <Skeleton variant="text" width="30%" height={60} />
      </div>
    </div>
  );
}

export function SkeletonPrediction({ className = "" }: { className?: string }) {
  return (
    <div className={`p-6 rounded-2xl bg-[var(--paper-strong)] border border-[var(--border)] ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <Skeleton variant="circle" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="50%" height={24} />
          <Skeleton variant="text" width="70%" height={14} />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton variant="text" width="100%" height={20} />
        <Skeleton variant="text" width="90%" height={20} />
        <Skeleton variant="text" width="95%" height={20} />
      </div>
      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <div className="flex justify-between items-center">
          <Skeleton variant="text" width="30%" height={16} />
          <Skeleton variant="text" width="20%" height={16} />
        </div>
      </div>
    </div>
  );
}

export default memo(Skeleton);
