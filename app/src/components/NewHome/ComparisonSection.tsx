import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { X, Check, Clock, MousePointer, Zap, Sparkles, ArrowRight } from "lucide-react";

const oldWayItems = [
  { label: "Time per product", value: "~15 min", icon: Clock },
  { label: "Manual clicks", value: "10+", icon: MousePointer },
  { label: "Consistency", value: "Variable", icon: X },
];

const snapshotItems = [
  { label: "Time per batch", value: "~5–8 min", icon: Zap },
  { label: "Manual clicks", value: "3–5", icon: MousePointer },
  { label: "Consistency", value: "Perfect", icon: Sparkles },
];

const ComparisonSection = () => {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const oldItems = section.querySelectorAll(".old-item");
    const snapItems = section.querySelectorAll(".snap-item");

    const failsafe = window.setTimeout(() => {
      [...oldItems, ...snapItems].forEach((el) => {
        const node = el as HTMLElement;
        if (parseFloat(getComputedStyle(node).opacity) < 0.5) {
          node.style.opacity = "1";
          node.style.transform = "none";
        }
      });
    }, 2000);

    if (!isInView) return;

    import("animejs").then((anime) => {
      anime.animate(oldItems as unknown as HTMLElement[], {
        opacity: [0, 1],
        translateX: [-20, 0],
        delay: (_el: HTMLElement, i: number) => 400 + i * 100,
        duration: 500,
        ease: "easeOutCubic",
      });

      anime.animate(snapItems as unknown as HTMLElement[], {
        opacity: [0, 1],
        translateX: [20, 0],
        delay: (_el: HTMLElement, i: number) => 400 + i * 100,
        duration: 500,
        ease: "easeOutCubic",
      });
    });

    return () => window.clearTimeout(failsafe);
  }, [isInView]);

  return (
    <section className="py-16 md:py-24 relative overflow-hidden" ref={ref}>
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-[0.04]"
          style={{
            top: "30%",
            right: "10%",
            background: "radial-gradient(circle, hsl(252 100% 68%), transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold text-foreground mb-5 leading-tight">
            The Old Way vs.{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              The Snapshot Way
            </span>
          </h2>
          <p className="text-foreground/50 font-body text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            See why leading e-commerce brands are switching to batch generation
          </p>
        </div>

        {/* Comparison Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="grid md:grid-cols-2 gap-5 lg:gap-6 items-start">
            {/* Old Way Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="group relative"
            >
              <div className="rounded-2xl p-8 md:p-10 border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.1]">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                    <X className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <span className="font-display text-lg font-bold text-foreground block">
                      The Old Way
                    </span>
                    <span className="text-xs font-body text-foreground/35">Manual photography</span>
                  </div>
                </div>

                {/* Hero stat */}
                <div className="mb-8 p-5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                  <span className="text-foreground/35 font-body text-xs uppercase tracking-widest">Time per product</span>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-display text-4xl md:text-5xl font-bold text-destructive/80 line-through decoration-destructive/40 decoration-2">
                      15 min
                    </span>
                  </div>
                </div>

                {/* List items */}
                <div className="space-y-3">
                  {oldWayItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="old-item flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] transition-colors opacity-0"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-foreground/40" />
                          <span className="text-sm font-body text-foreground/60">{item.label}</span>
                        </div>
                        <span className="text-sm font-body font-semibold text-destructive/70">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Snapshot Way Card - elevated */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="group relative md:scale-[1.03] md:origin-center"
            >
              {/* Glow behind card */}
              <div className="absolute -inset-2 bg-gradient-to-r from-logo-purple/15 to-electric-blue/15 rounded-3xl blur-xl opacity-60" />

              <div className="relative rounded-2xl p-8 md:p-10 border border-logo-purple/25 hover:border-logo-purple/40 bg-white/[0.03] transition-all duration-300">
                {/* Recommended badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-logo-purple to-electric-blue text-xs font-body font-semibold text-white shadow-lg shadow-logo-purple/30">
                    <Sparkles className="w-3 h-3" />
                    Recommended
                  </span>
                </div>

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-br from-logo-purple/[0.04] to-electric-blue/[0.04]" />
                </div>

                {/* Header */}
                <div className="relative flex items-center gap-3 mb-8">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-logo-purple to-electric-blue flex items-center justify-center shadow-lg shadow-logo-purple/20">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-display text-lg font-bold text-foreground block">
                      The Snapshot Way
                    </span>
                    <span className="text-xs font-body text-foreground/35">AI-powered batches</span>
                  </div>
                </div>

                {/* Hero stat */}
                <div className="relative mb-8 p-5 rounded-xl bg-logo-purple/[0.06] border border-logo-purple/10">
                  <span className="text-foreground/35 font-body text-xs uppercase tracking-widest">Time per batch</span>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="font-display text-4xl md:text-5xl font-bold bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
                      5–8 min
                    </span>
                  </div>
                </div>

                {/* List items */}
                <div className="relative space-y-3">
                  {snapshotItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="snap-item flex items-center justify-between p-3.5 rounded-xl bg-logo-purple/[0.04] transition-colors opacity-0"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-logo-purple/70" />
                          <span className="text-sm font-body text-foreground/70">{item.label}</span>
                        </div>
                        <span className="text-sm font-body font-bold bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom highlight bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.8 }}
            className="mt-10 flex justify-center"
          >
            <div className="inline-flex items-center gap-6 px-8 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-400" />
                <span className="text-sm font-body font-semibold text-green-400">3x faster</span>
              </div>
              <div className="w-px h-5 bg-white/[0.08]" />
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-logo-purple" />
                <span className="text-sm font-body font-semibold text-foreground/60">Perfect consistency</span>
              </div>
              <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />
              <a href="/#pricing" className="hidden sm:flex items-center gap-1.5 text-sm font-body font-medium text-foreground/40 hover:text-foreground/70 transition-colors">
                Start free
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonSection;
