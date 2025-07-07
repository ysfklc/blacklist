import { cn } from "@/lib/utils";
import logoImage from "@assets/blacklist_1751913069400.png";

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
      <img 
        src={logoImage} 
        alt="Blacklist Platform Logo" 
        className="w-full h-full object-contain filter brightness-0 invert"
      />
    </div>
  );
}