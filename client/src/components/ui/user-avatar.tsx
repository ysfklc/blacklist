import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    username: string;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base"
  };

  // Generate initials from firstName and lastName, fallback to username
  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}`;
    }
    if (user.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    }
    if (user.lastName) {
      return user.lastName.charAt(0).toUpperCase();
    }
    // Fallback to username initials
    const usernameParts = user.username.split(/[\s._-]/);
    if (usernameParts.length >= 2) {
      return `${usernameParts[0].charAt(0).toUpperCase()}${usernameParts[1].charAt(0).toUpperCase()}`;
    }
    return user.username.charAt(0).toUpperCase();
  };

  // Generate consistent color based on user info
  const getBackgroundColor = () => {
    const colors = [
      "bg-red-500",
      "bg-blue-500", 
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-cyan-500"
    ];
    
    const identifier = user.firstName || user.lastName || user.username;
    const hash = identifier.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white",
        sizeClasses[size],
        getBackgroundColor(),
        className
      )}
    >
      {getInitials()}
    </div>
  );
}