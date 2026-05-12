import { useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AnimationType = "fadeUp" | "fadeIn" | "scaleIn" | "slideLeft" | "slideRight";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  stagger?: number;
  threshold?: number;
}

const animationConfigs: Record<AnimationType, Record<string, unknown>> = {
  fadeUp: {
    translateY: [40, 0],
    opacity: [0, 1],
    filter: ["blur(6px)", "blur(0px)"],
  },
  fadeIn: {
    opacity: [0, 1],
  },
  scaleIn: {
    scale: [0.9, 1],
    opacity: [0, 1],
  },
  slideLeft: {
    translateX: [-60, 0],
    opacity: [0, 1],
  },
  slideRight: {
    translateX: [60, 0],
    opacity: [0, 1],
  },
};

export const ScrollReveal = ({
  children,
  className,
  animation = "fadeUp",
  delay = 0,
  duration = 700,
  stagger = 0,
  threshold = 0.15,
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasAnimated.current) return;

    // Set initial hidden state
    el.style.opacity = "0";

    // Failsafe: ensure content becomes visible if anime never runs
    const failsafe = window.setTimeout(() => {
      if (parseFloat(getComputedStyle(el).opacity) < 0.5) {
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.filter = "none";
        Array.from(el.children).forEach((child) => {
          const c = child as HTMLElement;
          c.style.opacity = "1";
          c.style.transform = "none";
          c.style.filter = "none";
        });
      }
    }, 2000);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;

            const config = animationConfigs[animation];
            const targets = stagger > 0
              ? el.children
              : el;

            import("animejs").then((anime) => {
              if (stagger > 0) {
                // Set children to hidden initially
                Array.from(el.children).forEach((child) => {
                  (child as HTMLElement).style.opacity = "0";
                });
                el.style.opacity = "1";
              }

              anime.animate(targets as unknown as HTMLElement | HTMLElement[], {
                ...config,
                delay: stagger > 0
                  ? (_el: HTMLElement, i: number) => delay + i * stagger
                  : delay,
                duration,
                ease: "easeOutCubic",
              });
            });
          }
        });
      },
      { threshold }
    );

    observer.observe(el);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [animation, delay, duration, stagger, threshold]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
};

export default ScrollReveal;
