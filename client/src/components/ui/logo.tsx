import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  return (
    <div className={cn(
      "relative flex items-center justify-center",
      sizeClasses[size],
      className
    )}>
      <svg 
        viewBox="0 0 512 512" 
        className="w-full h-full text-white"
        fill="currentColor"
      >
        {/* Blacklist prohibition symbol */}
        <circle 
          cx="256" 
          cy="256" 
          r="230" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="32"
        />
        <path 
          d="M149.7 149.7L362.3 362.3" 
          stroke="currentColor" 
          strokeWidth="32" 
          strokeLinecap="round"
        />
        {/* Inner content - representing blocked/forbidden items */}
        <circle cx="256" cy="256" r="180" fill="currentColor" opacity="0.1"/>
        
        {/* Digital/network elements to represent cyber security */}
        <rect x="200" y="200" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="220" y="190" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="240" y="200" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="260" y="190" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="280" y="200" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="300" y="190" width="8" height="8" fill="currentColor" opacity="0.7"/>
        
        <rect x="200" y="220" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="220" y="230" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="240" y="220" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="260" y="230" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="280" y="220" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="300" y="230" width="8" height="8" fill="currentColor" opacity="0.7"/>
        
        <rect x="200" y="280" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="220" y="290" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="240" y="280" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="260" y="290" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="280" y="280" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="300" y="290" width="8" height="8" fill="currentColor" opacity="0.7"/>
        
        <rect x="200" y="300" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="220" y="310" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="240" y="300" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="260" y="310" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="280" y="300" width="8" height="8" fill="currentColor" opacity="0.7"/>
        <rect x="300" y="310" width="8" height="8" fill="currentColor" opacity="0.7"/>
      </svg>
    </div>
  );
}