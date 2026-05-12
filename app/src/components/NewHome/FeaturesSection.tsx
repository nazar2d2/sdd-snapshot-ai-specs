import { useRef, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ScanEye,
  Palette,
  Camera,
  Rocket,
  Zap,
  ArrowRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

interface Feature {
  id: number;
  title: string;
  headline: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  large?: boolean;
}

const features: Feature[] = [
  {
    id: 1,
    title: "Multi-View",
    headline: "Every Angle, One Click",
    description:
      "Generate front, back, side, and custom views in a single batch. Pixel-perfect consistency across every angle — no reshoots, no guesswork.",
    icon: <ScanEye className="w-8 h-8" />,
    gradient: "from-electric-blue to-cyan-400",
    large: true,
  },
  {
    id: 2,
    title: "Color Batching",
    headline: "Infinite Colorways, Instantly",
    description:
      "Showcase every color variant of your product without a single reshoot. Upload once, generate dozens of perfectly matched colorways in seconds.",
    icon: <Palette className="w-8 h-8" />,
    gradient: "from-logo-purple to-electric-blue",
    large: true,
  },
  {
    id: 3,
    title: "Scenes",
    headline: "Studio-Grade Scenes on Demand",
    description:
      "Professional studio lighting or natural environments — pick the perfect backdrop and let AI handle the rest.",
    icon: <Camera className="w-7 h-7" />,
    gradient: "from-pink-500 to-logo-purple",
  },
  {
    id: 4,
    title: "Export",
    headline: "Ship to Every Platform",
    description:
      "One-click export to Shopify, Amazon & WooCommerce — properly sized, named, and organized automatically.",
    icon: <Rocket className="w-7 h-7" />,
    gradient: "from-green-400 to-emerald-500",
  },
  {
    id: 5,
    title: "Speed",
    headline: "Lightning-Fast Generation",
    description:
      "Powered by optimized AI pipelines. What used to take a full day of shooting now takes under a minute.",
    icon: <Zap className="w-7 h-7" />,
    gradient: "from-amber-400 to-orange-500",
  },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const FeaturesSection = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const cards = section.querySelectorAll(".feature-card");

    const failsafe = window.setTimeout(() => {
      cards.forEach((card) => {
        const el = card as HTMLElement;
        if (parseFloat(getComputedStyle(el).opacity) < 0.5) {
          el.style.opacity = "1";
          el.style.transform = "none";
          el.style.filter = "none";
        }
      });
    }, 2500);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            import("animejs").then((anime) => {
              anime.animate(cards as unknown as HTMLElement[], {
                opacity: [0, 1],
                translateY: [40, 0],
                filter: ["blur(6px)", "blur(0px)"],
                delay: (_el: HTMLElement, i: number) => i * 100 + 100,
                duration: 700,
                ease: "easeOutCubic",
              });
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(section);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  const largeFeatures = features.filter((f) => f.large);
  const smallFeatures = features.filter((f) => !f.large);

  return (
    <section id="product" className="py-16 md:py-24 relative overflow-hidden" ref={sectionRef}>
      {/* Single subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[160px] opacity-[0.04]"
          style={{
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(circle, hsl(252 100% 68%), hsl(217 91% 60%), transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold text-foreground mb-5 leading-tight">
            Built for Speed.{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              Designed for Scale.
            </span>
          </h2>
          <p className="text-foreground/50 font-body text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Professional product photography that used to take hours — now takes seconds.
          </p>
        </div>

        {/* Bento grid: 2 large on top */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 mb-4 lg:mb-5">
          {largeFeatures.map((feature) => (
            <motion.div
              key={feature.id}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              className="feature-card opacity-0 group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 bg-white/[0.02]"
            >
              <div className="relative p-8 md:p-10 h-full flex flex-col">
                {/* Top gradient accent */}
                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${feature.gradient} opacity-20`} />

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-7 shadow-lg`}>
                  {feature.icon}
                </div>

                {/* Title badge */}
                <span className="text-xs font-body font-semibold uppercase tracking-[0.2em] text-foreground/35 mb-3">
                  {feature.title}
                </span>

                {/* Headline */}
                <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-tight">
                  {feature.headline}
                </h3>

                {/* Description */}
                <p className="text-foreground/50 font-body text-[15px] leading-relaxed flex-1 max-w-md">
                  {feature.description}
                </p>

                {/* Footer: learn more */}
                <div className="mt-auto pt-5">
                  <span className="flex items-center gap-1.5 text-sm font-body font-medium text-foreground/30 group-hover:text-foreground/60 transition-colors duration-200">
                    Learn more
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Small feature cards: 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          {smallFeatures.map((feature) => (
            <motion.div
              key={feature.id}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 25 } }}
              className="feature-card opacity-0 group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 bg-white/[0.02]"
            >
              <div className="relative p-7 md:p-8 h-full flex flex-col">
                {/* Top gradient accent */}
                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${feature.gradient} opacity-20`} />

                {/* Icon */}
                <div className={`w-13 h-13 w-[52px] h-[52px] rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-white mb-6 shadow-lg`}>
                  {feature.icon}
                </div>

                {/* Title badge */}
                <span className="text-xs font-body font-semibold uppercase tracking-[0.2em] text-foreground/35 mb-2">
                  {feature.title}
                </span>

                {/* Headline */}
                <h3 className="font-display text-lg md:text-xl font-bold text-foreground mb-2 tracking-tight">
                  {feature.headline}
                </h3>

                {/* Description */}
                <p className="text-foreground/50 font-body text-sm leading-relaxed flex-1">
                  {feature.description}
                </p>

                {/* Footer: learn more */}
                <div className="mt-auto pt-6">
                  <span className="flex items-center gap-1.5 text-sm font-body font-medium text-foreground/40 group-hover:text-foreground/70 transition-colors duration-200">
                    Learn more
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
