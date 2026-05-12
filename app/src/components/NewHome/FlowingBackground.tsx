import { useEffect, useRef } from "react";

const FlowingBackground = () => {
  const orbsRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<SVGSVGElement>(null);
  const streakPathARef = useRef<SVGPathElement>(null);
  const streakPathBRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const container = orbsRef.current;
    if (!container) return;

    const orbs = container.querySelectorAll(".bg-orb");

    import("animejs").then((anime) => {
      orbs.forEach((orb, i) => {
        const xRange = 80 + i * 30;
        const yRange = 60 + i * 20;
        const duration = 20000 + i * 5000;

        anime.animate(orb as HTMLElement, {
          translateX: [
            { value: xRange, duration },
            { value: -xRange, duration },
            { value: 0, duration: duration * 0.5 },
          ],
          translateY: [
            { value: -yRange, duration: duration * 0.8 },
            { value: yRange, duration: duration * 0.8 },
            { value: 0, duration: duration * 0.4 },
          ],
          scale: [
            { value: 1.1, duration: duration * 0.6 },
            { value: 0.9, duration: duration * 0.6 },
            { value: 1, duration: duration * 0.3 },
          ],
          ease: "easeInOutSine",
          loop: true,
        });
      });
    });
  }, []);

  // Add a Google-Flow-like light streak layer (animated SVG paths).
  useEffect(() => {
    const svg = streakRef.current;
    const pathA = streakPathARef.current;
    const pathB = streakPathBRef.current;
    if (!svg || !pathA || !pathB) return;

    const prepPath = (p: SVGPathElement) => {
      const length = p.getTotalLength();
      p.style.strokeDasharray = `${length}`;
      p.style.strokeDashoffset = `${length}`;
      return length;
    };

    const lenA = prepPath(pathA);
    const lenB = prepPath(pathB);

    let cancel = false;

    import("animejs").then((anime) => {
      // Draw-in on load
      anime.animate(pathA as unknown as HTMLElement, {
        strokeDashoffset: [lenA, 0],
        duration: 1400,
        ease: "easeInOutCubic",
      });
      anime.animate(pathB as unknown as HTMLElement, {
        strokeDashoffset: [lenB, 0],
        duration: 1800,
        delay: 120,
        ease: "easeInOutCubic",
      });

      // Slow drift (gives depth)
      anime.animate(svg as unknown as HTMLElement, {
        translateX: [0, 40, -30, 0],
        translateY: [0, -18, 12, 0],
        duration: 22000,
        ease: "easeInOutSine",
        loop: true,
      });
    });

    // Subtle parallax tied to scroll
    const onScroll = () => {
      if (cancel) return;
      const y = window.scrollY || 0;
      const offset = Math.min(80, y * 0.08);
      svg.style.transform = `translateY(${offset}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      cancel = true;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base dark background */}
      <div className="absolute inset-0 bg-[#030303]" />

      {/* Light streak layer */}
      <svg
        ref={streakRef}
        className="absolute inset-0 w-full h-full opacity-[0.55]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        style={{ filter: "blur(0.2px)" }}
      >
        <defs>
          <linearGradient id="streakGradA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(252 100% 68%)" stopOpacity="0" />
            <stop offset="25%" stopColor="hsl(252 100% 68%)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="hsl(217 91% 60%)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="streakGradB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity="0" />
            <stop offset="30%" stopColor="hsl(217 91% 60%)" stopOpacity="0.45" />
            <stop offset="65%" stopColor="hsl(252 100% 68%)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="hsl(252 100% 68%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* main streak */}
        <path
          ref={streakPathARef}
          d="M-60,560 C180,430 420,520 660,560 C920,605 1140,520 1500,430"
          fill="none"
          stroke="url(#streakGradA)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* secondary streak */}
        <path
          ref={streakPathBRef}
          d="M-80,610 C220,520 430,650 690,640 C980,630 1180,560 1520,500"
          fill="none"
          stroke="url(#streakGradB)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>

      {/* Animated gradient orbs */}
      <div ref={orbsRef}>
        <div
          className="bg-orb absolute w-[700px] h-[700px] rounded-full blur-[120px] opacity-[0.12]"
          style={{
            top: "5%",
            left: "10%",
            background: "radial-gradient(circle, hsl(252 100% 68%), transparent 70%)",
          }}
        />
        <div
          className="bg-orb absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-[0.10]"
          style={{
            top: "45%",
            left: "55%",
            background: "radial-gradient(circle, hsl(217 91% 60%), transparent 70%)",
          }}
        />
        <div
          className="bg-orb absolute w-[500px] h-[500px] rounded-full blur-[110px] opacity-[0.08]"
          style={{
            top: "65%",
            left: "15%",
            background: "radial-gradient(circle, hsl(252 100% 68%), transparent 70%)",
          }}
        />
        <div
          className="bg-orb absolute w-[450px] h-[450px] rounded-full blur-[90px] opacity-[0.06]"
          style={{
            top: "20%",
            left: "70%",
            background: "radial-gradient(circle, hsl(217 91% 60%), transparent 70%)",
          }}
        />
      </div>

      {/* Bottom fade for contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#030303]/90" />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-noise opacity-[0.025]" />
    </div>
  );
};

export default FlowingBackground;
