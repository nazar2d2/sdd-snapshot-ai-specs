import { useRef, useEffect, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollOpacityProps {
  children: ReactNode;
  className?: string;
  /** ScrollTrigger start position, e.g. "top 90%" (default) */
  start?: string;
  /** ScrollTrigger end position where element is fully visible, e.g. "top 50%" (default) */
  end?: string;
  /** Initial vertical offset in pixels (default 30) */
  yOffset?: number;
}

export const ScrollOpacity = ({
  children,
  className,
  start: _start,
  end: _end,
  yOffset = 30,
}: ScrollOpacityProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Ensure scale originates from center
    gsap.set(el, { transformOrigin: "center center" });

    // Build a timeline that spans the section's full journey through the viewport:
    //   0%  – section bottom touches viewport bottom  (just entering)
    //  40%  – fully visible (enter complete)
    //  60%  – still fully visible (hold)
    // 100%  – section top has left viewport top (fully exited)
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: "top bottom",   // section top hits viewport bottom
        end: "bottom top",     // section bottom hits viewport top
        scrub: 0.4,
      },
    });

    // --- Enter phase (0% → 20%) ---
    tl.fromTo(
      el,
      { opacity: 0, y: 30, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, ease: "power1.out", duration: 0.2 },
      0
    );

    // --- Hold phase (35% → 50%) – stays fully visible ---
    // (no animation needed; values persist)

    // --- Leave phase (50% → 100%) ---
    tl.to(
      el,
      { opacity: 0, y: -50, scale: 0.75, ease: "power1.in", duration: 0.5 },
      0.5
    );

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [yOffset]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
};

export default ScrollOpacity;
