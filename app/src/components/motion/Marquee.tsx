import { useRef, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
}

export const Marquee = ({
  children,
  className,
  speed = 40,
  direction = "left",
  pauseOnHover = true,
}: MarqueeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const animRef = useRef<ReturnType<typeof import("animejs").animate> | null>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    // Wait a frame for layout to settle
    const raf = requestAnimationFrame(() => {
      const scrollWidth = scrollEl.scrollWidth / 2;
      const duration = (scrollWidth / speed) * 1000;

      import("animejs").then((anime) => {
        const anim = anime.animate(scrollEl, {
          translateX: direction === "left" ? [0, -scrollWidth] : [-scrollWidth, 0],
          duration,
          ease: "linear",
          loop: true,
        });
        animRef.current = anim;
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      // Anime.js v4 auto-cleans up
    };
  }, [speed, direction]);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    if (isPaused) {
      anim.pause();
    } else {
      anim.play();
    }
  }, [isPaused]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden", className)}
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      <div ref={scrollRef} className="flex w-max">
        {children}
        {children}
      </div>
    </div>
  );
};

export default Marquee;
