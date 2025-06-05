"use client";

import React from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, max = 100, className = "" }, ref) => {
    const percentage = Math.round((value / max) * 100);
    return (
      <div
        ref={ref}
        className={`w-full bg-gray-200 h-2 rounded-full overflow-hidden ${className}`}
      >
        <div
          className="bg-[#2660ff] h-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";
