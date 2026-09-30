import React from "react";
import Image from "next/image";
import { UtmTrackSymbol } from "./symbol";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  useImage?: boolean;
  className?: string;
}

export function UtmTrackLogo({ 
  size = "md", 
  showTagline = false, 
  useImage = false,
  className = "" 
}: LogoProps) {
  if (useImage) {
    const imageHeights = {
      sm: 28,
      md: 36,
      lg: 48,
      xl: 60,
    };
    const h = imageHeights[size];

    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        {/* Light theme official logo */}
        <Image
          src="/brand/logo/logo-light.png"
          alt="UTM-Track"
          width={h * 4}
          height={h}
          className="dark:hidden block object-contain w-auto h-auto max-h-[48px]"
          priority
        />
        {/* Dark theme official logo */}
        <Image
          src="/brand/logo/logo-dark.png"
          alt="UTM-Track"
          width={h * 4}
          height={h}
          className="hidden dark:block object-contain w-auto h-auto max-h-[48px]"
          priority
        />
      </div>
    );
  }

  const symbolSizes = {
    sm: 28,
    md: 34,
    lg: 44,
    xl: 56,
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <UtmTrackSymbol size={symbolSizes[size]} />
      <div className="flex flex-col justify-center">
        <div className={`font-extrabold tracking-tight leading-none ${textSizes[size]}`}>
          <span className="text-[#081A33] dark:text-white transition-colors duration-150">
            UTM
          </span>
          <span className="text-[#00D4FF] mx-0.5">-</span>
          <span className="bg-gradient-to-r from-[#0066FF] to-[#00D4FF] bg-clip-text text-transparent">
            Track
          </span>
        </div>
        {showTagline && (
          <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.18em] text-slate-500 dark:text-slate-400 mt-1">
            Transforme Cliques em Resultados
          </span>
        )}
      </div>
    </div>
  );
}
