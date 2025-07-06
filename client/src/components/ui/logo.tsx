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
      "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-red-700 via-red-800 to-red-900 shadow-lg border border-red-600/30",
      sizeClasses[size],
      className
    )}>
      <svg
        viewBox="0 0 48 48"
        className="w-2/3 h-2/3 text-white"
        fill="currentColor"
      >
        {/* Shield base */}
        <path d="M24 4L10 8v12c0 8.5 6 16 14 18 8-2 14-9.5 14-18V8L24 4z" 
              fill="currentColor" 
              opacity="0.9"/>
        
        {/* Block/Stop symbol - circular background */}
        <circle cx="24" cy="20" r="8" fill="white" opacity="0.95"/>
        
        {/* Prohibition slash */}
        <path d="M18 14 L30 26" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"/>
        
        {/* Threat indicators around shield */}
        <circle cx="14" cy="28" r="1.5" fill="currentColor" opacity="0.6"/>
        <circle cx="34" cy="28" r="1.5" fill="currentColor" opacity="0.6"/>
        <circle cx="18" cy="34" r="1.5" fill="currentColor" opacity="0.6"/>
        <circle cx="30" cy="34" r="1.5" fill="currentColor" opacity="0.6"/>
        
        {/* Data flow lines being blocked */}
        <path d="M6 38 L18 38" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              opacity="0.4"/>
        <path d="M30 38 L42 38" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              opacity="0.4"/>
        
        {/* X marks indicating blocked content */}
        <path d="M16 38 L20 42 M20 38 L16 42" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              opacity="0.6"/>
        <path d="M28 38 L32 42 M32 38 L28 42" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              opacity="0.6"/>
      </svg>
      
      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-600/20 to-red-900/20 blur-sm -z-10"></div>
    </div>
  );
}