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
      "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 shadow-lg border border-blue-500/30",
      sizeClasses[size],
      className
    )}>
      <svg
        viewBox="0 0 48 48"
        className="w-2/3 h-2/3 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {/* Modern hexagonal shield */}
        <path d="M24 4L34 8v12c0 6-4 12-10 14-6-2-10-8-10-14V8L24 4z" 
              fill="currentColor" 
              stroke="none"
              opacity="0.9"/>
        
        {/* Network nodes */}
        <circle cx="24" cy="16" r="2" fill="white" opacity="0.9"/>
        <circle cx="18" cy="22" r="1.5" fill="white" opacity="0.8"/>
        <circle cx="30" cy="22" r="1.5" fill="white" opacity="0.8"/>
        <circle cx="24" cy="28" r="1.5" fill="white" opacity="0.8"/>
        
        {/* Network connections */}
        <path d="M24 16 L18 22 M24 16 L30 22 M24 16 L24 28" 
              stroke="white" 
              strokeWidth="1" 
              opacity="0.6"/>
        <path d="M18 22 L30 22 M18 22 L24 28 M30 22 L24 28" 
              stroke="white" 
              strokeWidth="1" 
              opacity="0.4"/>
        
        {/* Scanning radar effect */}
        <circle cx="24" cy="20" r="8" stroke="white" strokeWidth="1" opacity="0.3" fill="none"/>
        <circle cx="24" cy="20" r="12" stroke="white" strokeWidth="0.5" opacity="0.2" fill="none"/>
        
        {/* Digital elements */}
        <rect x="16" y="32" width="2" height="2" fill="white" opacity="0.7"/>
        <rect x="20" y="34" width="2" height="2" fill="white" opacity="0.7"/>
        <rect x="24" y="32" width="2" height="2" fill="white" opacity="0.7"/>
        <rect x="28" y="34" width="2" height="2" fill="white" opacity="0.7"/>
        
        {/* Data streams */}
        <path d="M12 38 L18 38 M20 38 L24 38 M26 38 L30 38 M32 38 L36 38" 
              stroke="white" 
              strokeWidth="1" 
              strokeLinecap="round" 
              opacity="0.4"/>
      </svg>
      
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-700/20 blur-sm -z-10"></div>
    </div>
  );
}