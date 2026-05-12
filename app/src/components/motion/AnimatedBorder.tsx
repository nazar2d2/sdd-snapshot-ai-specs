import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedBorderProps {
  children: ReactNode;
  className?: string;
  borderWidth?: number;
  borderRadius?: string;
}

export const AnimatedBorder = ({
  children,
  className,
  borderWidth = 2,
  borderRadius = "1.5rem",
}: AnimatedBorderProps) => {
  return (
    <div className={cn("relative", className)}>
      {/* Animated gradient border */}
      <div
        className="absolute -inset-px rounded-[inherit] animate-gradient-shift"
        style={{
          borderRadius,
          background:
            "linear-gradient(90deg, hsl(252 100% 68%), hsl(217 91% 60%), hsl(252 100% 68%), hsl(217 91% 60%))",
          backgroundSize: "300% 100%",
          padding: borderWidth,
        }}
      />
      {/* Inner content with background */}
      <div
        className="relative bg-deep-black"
        style={{ borderRadius }}
      >
        {children}
      </div>
    </div>
  );
};

export default AnimatedBorder;
