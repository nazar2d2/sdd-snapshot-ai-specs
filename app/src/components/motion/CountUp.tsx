import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountUpProps {
  from?: number;
  to: number;
  duration?: number;
  delay?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  decimals?: number;
}

export const CountUp = ({
  from = 0,
  to,
  duration = 2000,
  delay = 0,
  suffix = "",
  prefix = "",
  className,
  decimals = 0,
}: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const [displayValue, setDisplayValue] = useState(from);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasAnimated.current) return;

    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    const runAnimation = () => {
      const startTime = performance.now();
      const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutExpo(progress);
        setDisplayValue(from + (to - from) * easedProgress);
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    };

    const start = () => {
      if (hasAnimated.current) return;
      hasAnimated.current = true;

      if (delay > 0) {
        delayTimer = setTimeout(runAnimation, delay);
      } else {
        runAnimation();
      }
    };

    // Wait for the element to actually become visible in the viewport.
    // Use a polling check so we don't fire while a parent is still at opacity 0
    // (e.g. during entrance animations).
    const isElementVisible = (): boolean => {
      let current: HTMLElement | null = el;
      while (current) {
        const style = getComputedStyle(current);
        if (parseFloat(style.opacity) < 0.1) return false;
        if (style.visibility === "hidden" || style.display === "none") return false;
        current = current.parentElement;
      }
      return true;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            // Check that the element (and parents) is actually visible
            if (isElementVisible()) {
              start();
            } else {
              // Poll until the parent entrance animation makes it visible
              const poll = setInterval(() => {
                if (hasAnimated.current) {
                  clearInterval(poll);
                  return;
                }
                if (isElementVisible()) {
                  clearInterval(poll);
                  start();
                }
              }, 100);
              // Safety: stop polling after 5s
              setTimeout(() => clearInterval(poll), 5000);
            }
          }
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, [from, to, duration, delay]);

  return (
    <span ref={ref} className={cn(className)}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export default CountUp;
