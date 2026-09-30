import React from "react";

interface SymbolProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  variant?: "navy" | "transparent";
}

export function UtmTrackSymbol({ 
  size = 32, 
  variant = "navy",
  className = "", 
  ...props 
}: SymbolProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 ${className}`}
      {...props}
    >
      <defs>
        <linearGradient id="utmt_brand_grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="60%" stopColor="#00D4FF" />
          <stop offset="100%" stopColor="#39E6FF" />
        </linearGradient>
        <linearGradient id="utmt_glow_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0066FF" stopOpacity="0.05" />
        </linearGradient>
        <filter id="utmt_glow_filter" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00D4FF" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Background Container */}
      {variant === "navy" && (
        <>
          <rect x="4" y="4" width="92" height="92" rx="22" fill="#081A33" stroke="#142C52" strokeWidth="2" />
          <rect x="5" y="5" width="90" height="90" rx="21" fill="url(#utmt_glow_grad)" />
        </>
      )}

      {/* Official "U" Trajectory */}
      <path 
        d="M28 36 V54 C28 66 38 74 50 74 C62 74 72 66 72 54 V40" 
        stroke="url(#utmt_brand_grad)" 
        strokeWidth="8.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        filter="url(#utmt_glow_filter)" 
      />

      {/* Dynamic Arrowhead pointing Up-Right */}
      <path 
        d="M58 40 L72 32 L80 46" 
        fill="none" 
        stroke="url(#utmt_brand_grad)" 
        strokeWidth="8.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* Central Tracking Target Node */}
      <circle cx="50" cy="52" r="5" fill="#39E6FF" />
      <circle cx="50" cy="52" r="10" stroke="#00D4FF" strokeWidth="2" strokeOpacity="0.7" strokeDasharray="2 3" />
    </svg>
  );
}
