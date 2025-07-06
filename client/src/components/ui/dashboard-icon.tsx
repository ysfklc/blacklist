import dashboardIconPath from "@assets/image_1751829717060.png";

interface DashboardIconProps {
  className?: string;
}

export function DashboardIcon({ className = "h-5 w-5" }: DashboardIconProps) {
  return (
    <img 
      src={dashboardIconPath} 
      alt="Dashboard" 
      className={className}
      style={{ filter: 'invert(1)' }} // Makes the icon white to match the sidebar theme
    />
  );
}