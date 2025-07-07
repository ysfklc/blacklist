import logoImage from "@assets/blacklist_1751913069400.png";

interface DashboardIconProps {
  className?: string;
}

export function DashboardIcon({ className = "h-5 w-5" }: DashboardIconProps) {
  return (
    <img 
      src={logoImage} 
      alt="Dashboard"
      className={`${className} object-contain filter brightness-0 invert`}
    />
  );
}