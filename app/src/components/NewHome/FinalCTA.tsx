import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ScrollOpacity } from "@/components/motion/ScrollOpacity";
import { CountUp } from "@/components/motion/CountUp";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Button } from "@/components/ui/button";

const stats = [
  { value: 10, suffix: "+", label: "Brands trust Snapshot", delay: 0 },
  { value: 1, suffix: "k+", label: "Products processed", delay: 100 },
  { value: 30, suffix: "x", label: "Faster than manual editing", delay: 200 },
  { value: 100, suffix: "%", label: "Customer satisfaction", delay: 300 },
];

const FinalCTA = () => {
  return (
    <section className="py-16 md:py-24 relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Eyebrow */}
        <ScrollOpacity yOffset={15}>
          <p className="text-[11px] tracking-[0.25em] uppercase text-foreground/40 font-body mb-6">
            Ready to start?
          </p>
        </ScrollOpacity>

        {/* Headline */}
        <ScrollOpacity yOffset={20}>
          <h2 className="font-prata text-3xl md:text-4xl lg:text-[3.5rem] font-bold text-foreground leading-tight max-w-2xl mx-auto">
            Transform your product catalog{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              in minutes.
            </span>
          </h2>
        </ScrollOpacity>

        {/* Subtle divider */}
        <ScrollOpacity yOffset={10}>
          <div className="w-12 h-px bg-foreground/20 mx-auto mt-6 mb-10" />
        </ScrollOpacity>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 mb-10">
          {stats.map((stat, i) => (
            <ScrollOpacity key={stat.label} yOffset={12} start={`top ${92 - i * 2}%`}>
              <div className="text-center">
                <CountUp
                  to={stat.value}
                  suffix={stat.suffix}
                  duration={1800}
                  delay={stat.delay}
                  className="text-3xl md:text-4xl font-display font-bold text-foreground"
                />
                <p className="text-xs md:text-sm text-foreground/60 font-body mt-1.5 leading-relaxed">
                  {stat.label}
                </p>
              </div>
            </ScrollOpacity>
          ))}
        </div>

        {/* CTA */}
        <ScrollOpacity yOffset={12}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <MagneticButton strength={0.1}>
              <Link to="/auth">
                <Button variant="hero" size="default" className="font-body">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </MagneticButton>
            <Link
              to="/auth"
              className="text-sm text-foreground/70 font-body hover:text-foreground/90 transition-colors duration-300 underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground/60"
            >
              or schedule a demo
            </Link>
          </div>
        </ScrollOpacity>

        {/* Trust line */}
        <ScrollOpacity yOffset={8}>
          <p className="mt-8 text-[11px] md:text-xs text-foreground/50 font-body tracking-wide">
            No credit card required&ensp;·&ensp;Cancel anytime&ensp;·&ensp;Setup in under 2 minutes
          </p>
        </ScrollOpacity>
      </div>
    </section>
  );
};

export default FinalCTA;
