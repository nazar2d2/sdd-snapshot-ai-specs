import { useRef, useEffect } from "react";
import { Upload, Settings, Download } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload product image",
    description:
      "Upload your product photo. Works best with clean product shots on neutral backgrounds.",
    accent: "from-electric-blue to-cyan-400",
  },
  {
    number: "02",
    icon: Settings,
    title: "Pick niche, views, format, variants",
    description:
      "Choose Fashion or Home Decor. Select views, aspect ratios, and color variants for your batch.",
    accent: "from-logo-purple to-electric-blue",
  },
  {
    number: "03",
    icon: Download,
    title: "Download results, use Fix Image for edits",
    description:
      "Download your generated images. Use our Fix Image tool to make adjustments if needed.",
    accent: "from-pink-500 to-logo-purple",
  },
];

const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const stepCards = section.querySelectorAll(".step-card");

    const failsafe = window.setTimeout(() => {
      stepCards.forEach((card) => {
        const el = card as HTMLElement;
        if (parseFloat(getComputedStyle(el).opacity) < 0.5) {
          el.style.opacity = "1";
          el.style.transform = "none";
          el.style.filter = "none";
        }
      });
    }, 2000);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            import("animejs").then((anime) => {
              anime.animate(stepCards as unknown as HTMLElement[], {
                opacity: [0, 1],
                translateY: [40, 0],
                filter: ["blur(6px)", "blur(0px)"],
                delay: (_el: HTMLElement, i: number) => i * 150,
                duration: 700,
                ease: "easeOutCubic",
              });
            });
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      id="how-snapshot-works"
      className="py-16 md:py-24 relative overflow-hidden"
      ref={sectionRef}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold mb-5 leading-tight">
            How{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              SnapShot
            </span>{" "}
            Works
          </h2>
          <p className="text-foreground/50 font-body text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
            Three simple steps to professional product photography
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 relative">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 25 } }}
                className="step-card opacity-0 group relative"
              >
                <div className="relative rounded-2xl border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02] transition-all duration-300 p-8 md:p-9 h-full">
                  {/* Top gradient accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${step.accent} opacity-20 group-hover:opacity-40 transition-opacity duration-300`} />

                  {/* Step number badge + icon row */}
                  <div className="flex items-center gap-4 mb-7">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.accent} flex items-center justify-center text-white shadow-lg`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="flex items-center justify-center w-9 h-9 rounded-full border border-white/[0.08] bg-white/[0.03]">
                      <span className="font-display text-sm font-bold text-foreground/50">
                        {step.number}
                      </span>
                    </div>
                  </div>

                  {/* Content - left aligned */}
                  <h3 className="font-display text-xl md:text-[22px] font-bold text-foreground mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-foreground/45 font-body text-[15px] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
