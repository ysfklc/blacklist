import { cn } from "@/lib/utils";

interface FeedLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FeedLogo({ className, size = "md" }: FeedLogoProps) {
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
        viewBox="0 0 32 32" 
        className="w-full h-full text-gray-900"
        fill="none" 
        stroke="currentColor" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="2"
      >
        <circle cx="6" cy="26" r="2" fill="currentColor" />
        <path d="M4 15 C11 15 17 21 17 28 M4 6 C17 6 26 15 26 28" />
      </svg>
    </div>
  );
}