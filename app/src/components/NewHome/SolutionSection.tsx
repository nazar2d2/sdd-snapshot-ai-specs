import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import Lottie from "lottie-react";
import {
  Zap,
  Sparkles,
  Camera,
  RotateCcw,
  ArrowRight,
  Search,
  Sun,
  Aperture,
  LayoutGrid,
  Image,
  Palette,
} from "lucide-react";
import { ScrollOpacity } from "@/components/motion/ScrollOpacity";
import { AnimatedBorder } from "@/components/motion/AnimatedBorder";
import digitalDesignerAnim from "@/assets/lottie/digital-designer.json";

/* Tile product images */
import imgFront from "@/assets/homepage/hero-front.jpg";
import imgBack from "@/assets/gallery/fashion-pink-back.png";
import imgSide from "@/assets/homepage/hero-side.jpg";
import imgDetail from "@/assets/gallery/fashion-suit-front.jpg";
import imgOutdoor from "@/assets/homepage/hero-outdoor.jpg";
import imgStudio from "@/assets/gallery/fashion-dress-side.jpg";
import imgFlatlay from "@/assets/gallery/fashion-sweater.jpg";
import imgLifestyle from "@/assets/homepage/gallery-fashion-1.jpg";
import imgVariant from "@/assets/homepage/gallery-fashion-2.jpg";

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const benefits = [
  "Angles: front, back, side — consistent styling",
  "Colorways generated in one run",
  "Studio and lifestyle scenes",
  "Consistent lighting and quality",
  "Export-ready outputs for your catalog",
];

const tileData = [
  { label: "Front", icon: Camera, gradFrom: "from-logo-purple/30", gradTo: "to-electric-blue/20", image: imgFront },
  { label: "Back", icon: RotateCcw, gradFrom: "from-electric-blue/25", gradTo: "to-logo-purple/15", image: imgBack },
  { label: "Side", icon: ArrowRight, gradFrom: "from-logo-purple/20", gradTo: "to-pink-500/20", image: imgSide },
  { label: "Detail", icon: Search, gradFrom: "from-electric-blue/30", gradTo: "to-cyan-500/15", image: imgDetail },
  { label: "Outdoor", icon: Sun, gradFrom: "from-amber-500/20", gradTo: "to-electric-blue/15", image: imgOutdoor },
  { label: "Studio", icon: Aperture, gradFrom: "from-logo-purple/25", gradTo: "to-electric-blue/25", image: imgStudio },
  { label: "Flatlay", icon: LayoutGrid, gradFrom: "from-cyan-500/20", gradTo: "to-logo-purple/15", image: imgFlatlay },
  { label: "Lifestyle", icon: Image, gradFrom: "from-pink-500/20", gradTo: "to-electric-blue/20", image: imgLifestyle },
  { label: "Variant", icon: Palette, gradFrom: "from-logo-purple/30", gradTo: "to-amber-500/15", image: imgVariant },
];

/* ------------------------------------------------------------------ */
/*  Animated SVG Check Icon (draws on scroll)                         */
/* ------------------------------------------------------------------ */

const AnimatedCheck = ({ delay }: { delay: number }) => {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <svg
      ref={ref}
      className="w-6 h-6 flex-shrink-0"
      viewBox="0 0 24 24"
      fill="none"
    >
      {/* Circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="url(#checkGrad)"
        strokeWidth="2"
        strokeDasharray="63"
        strokeDashoffset={inView ? "0" : "63"}
        style={{
          transition: `stroke-dashoffset 0.6s ease-out ${delay}s`,
        }}
      />
      {/* Checkmark */}
      <path
        d="M8 12.5l2.5 2.5 5.5-5.5"
        stroke="url(#checkGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="20"
        strokeDashoffset={inView ? "0" : "20"}
        style={{
          transition: `stroke-dashoffset 0.4s ease-out ${delay + 0.3}s`,
        }}
      />
      <defs>
        <linearGradient id="checkGrad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="hsl(252 100% 68%)" />
          <stop offset="1" stopColor="hsl(217 91% 60%)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  3D Tilt Card                                                      */
/* ------------------------------------------------------------------ */

const TiltCard = ({ children }: { children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(800px) rotateX(0deg) rotateY(0deg)");
  const [shadow, setShadow] = useState("0 0 80px hsl(252 100% 68% / 0.35), 0 0 40px hsl(217 91% 60% / 0.25), 0 8px 32px hsl(0 0% 0% / 0.4)");

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4; // max ±4 degrees
    const rotateY = ((x - centerX) / centerX) * 4;
    setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`);
    setShadow("0 0 120px hsl(252 100% 68% / 0.5), 0 0 60px hsl(217 91% 60% / 0.35), 0 12px 40px hsl(0 0% 0% / 0.5)");
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransform("perspective(800px) rotateX(0deg) rotateY(0deg)");
    setShadow("0 0 80px hsl(252 100% 68% / 0.35), 0 0 40px hsl(217 91% 60% / 0.25), 0 8px 32px hsl(0 0% 0% / 0.4)");
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        boxShadow: shadow,
        transition: "transform 0.15s ease-out, box-shadow 0.3s ease-out",
        willChange: "transform",
      }}
      className="rounded-2xl"
    >
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main Section                                                       */
/* ------------------------------------------------------------------ */

const SolutionSection = () => {
  const gridRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  /* Anime.js: stagger reveal + looping "AI generation" scan */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const items = grid.querySelectorAll<HTMLElement>(".grid-item");
    const overlays = grid.querySelectorAll<HTMLElement>(".tile-overlay");
    const checks = grid.querySelectorAll<HTMLElement>(".tile-check");

    /* Failsafe: make tiles visible if anime.js never loads */
    const failsafe = window.setTimeout(() => {
      items.forEach((node) => {
        if (parseFloat(getComputedStyle(node).opacity) < 0.8) {
          node.style.opacity = "1";
          node.style.transform = "none";
        }
      });
    }, 2500);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            import("animejs").then((anime) => {
              /* --- 1) Staggered reveal from center --- */
              anime.animate(items as unknown as HTMLElement[], {
                opacity: [0.4, 1],
                scale: [0.85, 1],
                delay: (_el: HTMLElement, i: number) => {
                  const row = Math.floor(i / 3);
                  const col = i % 3;
                  const dist = Math.abs(row - 1) + Math.abs(col - 1);
                  return 200 + dist * 90;
                },
                duration: 550,
                ease: "easeOutCubic",
              });

              /* --- 2) Looping "AI generation" scan --- */
              const tl = anime.createTimeline({
                loop: true,
                defaults: { ease: "easeOutCubic" },
              });

              overlays.forEach((el) => {
                el.style.opacity = "0";
              });
              checks.forEach((el) => {
                el.style.opacity = "0";
                el.style.transform = "scale(0.85)";
              });

              const tileOrder = [0, 4, 8, 2, 6, 1, 3, 5, 7];
              tileOrder.forEach((idx, step) => {
                const tile = items[idx];
                const overlay = overlays[idx];
                const check = checks[idx];
                const offset = step * 280;

                if (tile) {
                  tl.add(
                    tile,
                    { scale: [1, 1.05, 1], duration: 560 },
                    offset
                  );
                }
                if (overlay) {
                  tl.add(
                    overlay,
                    { opacity: [0, 0.9, 0.25], duration: 560 },
                    offset
                  );
                }
                if (check) {
                  tl.add(
                    check,
                    {
                      opacity: [0, 1],
                      scale: [0.85, 1],
                      duration: 240,
                      ease: "easeOutBack",
                    },
                    offset + 300
                  );
                }
              });

              tl.add(
                overlays as unknown as HTMLElement[],
                { opacity: [0.25, 0], duration: 500 },
                "+=1000"
              );
              tl.add(
                checks as unknown as HTMLElement[],
                { opacity: [1, 0], duration: 500, ease: "easeInOutCubic" },
                "-=500"
              );
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(grid);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none">
        <div
          className="w-full h-full rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle at 30% 40%, hsl(252 100% 68% / 0.15), transparent 60%), radial-gradient(circle at 70% 60%, hsl(217 91% 60% / 0.12), transparent 55%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <ScrollOpacity yOffset={20}>
          <div className="text-center mb-10 md:mb-14">

            <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold mb-5 leading-tight text-foreground">
              Generate a full product set{" "}
              <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
                in one run.
              </span>
            </h2>

            <p className="text-foreground/50 font-body text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Upload once. Get every angle, color, and scene — consistent
              lighting, consistent styling, ready for export.
            </p>
          </div>
        </ScrollOpacity>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          {/* ============ Left Column ============ */}
          <ScrollOpacity yOffset={15}>
            <div>
              {/* Lottie Animation */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mb-8 flex justify-center lg:justify-start"
              >
                <div className="w-full max-w-[340px] h-auto relative">
                  <Lottie
                    animationData={digitalDesignerAnim}
                    loop
                    autoplay
                    style={{ width: "100%", height: "auto" }}
                  />
                  {/* Brand tint overlay — faded edges */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 50%, hsl(252 100% 68% / 0.55), hsl(217 91% 60% / 0.45) 40%, transparent 70%)",
                      mixBlendMode: "overlay",
                    }}
                  />
                </div>
              </motion.div>

              {/* Benefits with animated SVG checks */}
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="group flex items-center gap-3 relative rounded-lg px-3 py-2 -mx-3 transition-all duration-300 hover:bg-white/[0.03]"
                  >
                    {/* Hover glow highlight */}
                    <div className="absolute inset-y-0 left-0 w-[3px] rounded-full bg-gradient-to-b from-logo-purple to-electric-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <AnimatedCheck delay={0.2 + index * 0.15} />
                    <span className="text-foreground font-medium font-body">
                      {benefit}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </ScrollOpacity>

          {/* ============ Right Column ============ */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            {/* Floating glow behind card */}
            <div className="absolute inset-0 animate-blob-float">
              <div
                className="w-full h-full scale-110 rounded-3xl opacity-40"
                style={{
                  background:
                    "radial-gradient(ellipse at 40% 30%, hsl(252 100% 68% / 0.20), transparent 55%), radial-gradient(ellipse at 70% 70%, hsl(217 91% 60% / 0.15), transparent 50%)",
                  filter: "blur(60px)",
                }}
              />
            </div>

            {/* Animated Border + 3D Tilt Card */}
            <AnimatedBorder borderRadius="1rem">
              <TiltCard>
                <div className="relative glass-surface rounded-2xl p-6 sm:p-8 border border-white/[0.08]">
                  {/* Subtle inner sheen */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-logo-purple/[0.06] via-transparent to-electric-blue/[0.05]" />

                  {/* Purple-blue glow overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl z-[1]"
                    style={{
                      background: "radial-gradient(ellipse at 50% 40%, hsl(252 100% 68% / 0.12), hsl(217 91% 60% / 0.08) 50%, transparent 75%)",
                      mixBlendMode: "overlay",
                    }}
                  />

                  {/* Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-logo-purple to-electric-blue flex items-center justify-center shadow-button">
                      <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-foreground">
                        Batch Generation
                      </div>
                      <div className="text-sm text-foreground/70 font-body">
                        All variants at once
                      </div>
                    </div>
                  </div>

                  {/* Grid of outputs — staggered entrance */}
                  <div ref={gridRef} className="grid grid-cols-3 gap-3">
                    {tileData.map((tile, i) => {
                      const Icon = tile.icon;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.85 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 0.35,
                            delay: 0.3 + i * 0.05,
                            ease: "easeOut",
                          }}
                          className="grid-item aspect-square rounded-xl bg-white/[0.04] border border-white/[0.08] relative overflow-hidden group cursor-pointer hover:border-logo-purple/40 transition-all duration-300 hover:scale-[1.04]"
                        >
                          {/* Product image background */}
                          <img
                            src={tile.image}
                            alt={tile.label}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale group-hover:opacity-90 group-hover:grayscale-0 transition-all duration-300"
                          />

                          {/* Dark overlay so label stays readable */}
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-300" />

                          {/* Gradient tint */}
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${tile.gradFrom} ${tile.gradTo} opacity-60 group-hover:opacity-30 transition-opacity duration-300`}
                          />

                          {/* Subtle noise texture */}
                          <div className="absolute inset-0 bg-noise opacity-[0.03]" />

                          {/* Center icon (fades on hover to reveal image) */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Icon
                              className="w-7 h-7 sm:w-8 sm:h-8 text-white/40 group-hover:text-white/20 transition-colors duration-300 drop-shadow-lg"
                              strokeWidth={1.5}
                            />
                          </div>

                          {/* Scan / AI overlay */}
                          <div className="tile-overlay absolute inset-0 opacity-0 pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.15] to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-br from-logo-purple/40 to-electric-blue/40 opacity-70" />
                          </div>

                          {/* Label */}
                          <div className="absolute top-2 left-2 text-[10px] font-body font-medium text-foreground/70 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/[0.08]">
                            {tile.label}
                          </div>

                          {/* Check indicator */}
                          <div className="tile-check absolute bottom-2 right-2 opacity-0 scale-90">
                            <div className="w-6 h-6 rounded-full bg-green-500/25 border border-green-400/30 flex items-center justify-center backdrop-blur-sm">
                              <svg
                                className="w-3.5 h-3.5 text-green-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Bottom status bar */}
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {[
                        "from-logo-purple/40 to-electric-blue/30",
                        "from-electric-blue/40 to-cyan-500/30",
                        "from-pink-500/30 to-logo-purple/30",
                      ].map((grad, i) => (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${grad} border-2 border-background/60`}
                        />
                      ))}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-logo-purple/20 to-electric-blue/20 border-2 border-background/60 flex items-center justify-center text-xs font-body font-medium text-logo-purple">
                        +9
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-body font-medium text-logo-purple">
                      <Zap className="w-4 h-4 animate-pulse" />
                      Generating...
                    </div>
                  </div>
                </div>
              </TiltCard>
            </AnimatedBorder>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
