import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AnimatedBorder } from "@/components/motion/AnimatedBorder";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { invokeEdgeFunctionWithRetry } from "@/lib/invokeEdgeFunctionWithRetry";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PricingTier {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  yearlyPeriod: string;
  description: string;
  features: string[];
  popular?: boolean;
  cta: string;
  priceIdMonth: string;
  priceIdYear: string;
}

const pricingTiers: PricingTier[] = [
  {
    name: "Basic",
    price: "$10",
    yearlyPrice: "$100",
    period: "/month",
    yearlyPeriod: "/year",
    description: "Perfect for hobbyists and trying out styles.",
    features: [
      "75 credits/month",
      "Standard quality (1K)",
      "Basic Commercial License",
      "Access to all styles",
    ],
    cta: "Choose Plan",
    priceIdMonth: "price_1T3KMiBxmnkg2dwfnp5bMOLr",
    priceIdYear: "price_1T3KMiBxmnkg2dwfE69V01dq",
  },
  {
    name: "Starter",
    price: "$28.95",
    yearlyPrice: "$289.50",
    period: "/month",
    yearlyPeriod: "/year",
    description: "Great for content creators and small brands.",
    features: [
      "250 credits/month",
      "HD quality available (2K)",
      "Full Commercial License",
      "Priority Support",
      "Rollover unused credits",
    ],
    popular: true,
    cta: "Choose Plan",
    priceIdMonth: "price_1T3KNYBxmnkg2dwfqsFzI6Ni",
    priceIdYear: "price_1T3KNZBxmnkg2dwfismP3dNE",
  },
  {
    name: "Advanced",
    price: "$49.95",
    yearlyPrice: "$499.50",
    period: "/month",
    yearlyPeriod: "/year",
    description: "For professional photographers and agencies.",
    features: [
      "500 credits/month",
      "HD quality available (2K)",
      "Bulk Generation Tools",
      "Dedicated Account Manager",
      "Rollover unused credits",
    ],
    cta: "Choose Plan",
    priceIdMonth: "price_1T3KOOBxmnkg2dwfusX1apa0",
    priceIdYear: "price_1T3KOOBxmnkg2dwfqEQEEmUb",
  },
  {
    name: "Generator",
    price: "$124.95",
    yearlyPrice: "$1,249.50",
    period: "/month",
    yearlyPeriod: "/year",
    description: "Ultimate power for high-volume creation.",
    features: [
      "1,000 credits/month",
      "HD quality available (2K)",
      "API Access (Coming Soon)",
      "White-label options",
      "Rollover unused credits",
    ],
    cta: "Choose Plan",
    priceIdMonth: "price_1T3KPDBxmnkg2dwfkVAAtk6Y",
    priceIdYear: "price_1T3KPDBxmnkg2dwfQ7bKJj1N",
  },
];

const Pricing = () => {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubscribe = async (tier: PricingTier) => {
    setLoadingTier(tier.name);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const priceId = isYearly ? tier.priceIdYear : tier.priceIdMonth;
      const { data, error } = await invokeEdgeFunctionWithRetry("create-checkout", {
        body: {
          priceId,
          mode: "subscription",
          successUrl: `${window.location.origin}/app`,
          cancelUrl: window.location.href,
        },
      });

      if (error) throw new Error((error as any).message || "Checkout failed");
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      toast({
        title: "Checkout Error",
        description: "Could not start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTier(null);
    }
  };

  // Anime.js entrance: scale + blur + opacity stagger from center
  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const cards = section.querySelectorAll(".pricing-card");

    const failsafe = window.setTimeout(() => {
      cards.forEach((el) => {
        const node = el as HTMLElement;
        if (parseFloat(getComputedStyle(node).opacity) < 0.5) {
          node.style.opacity = "1";
          node.style.transform = "none";
          node.style.filter = "none";
        }
      });
    }, 2500);

    if (!isInView) return () => window.clearTimeout(failsafe);

    let floatAnim: { pause: () => void } | null = null;

    import("animejs").then((anime) => {
      const entrance = anime.animate(cards as unknown as HTMLElement[], {
        opacity: [0, 1],
        translateY: [60, 0],
        scale: [0.92, 1],
        filter: ["blur(8px)", "blur(0px)"],
        delay: (_el: HTMLElement, i: number) => {
          const center = (cards.length - 1) / 2;
          return Math.abs(i - center) * 120;
        },
        duration: 800,
        ease: "easeOutExpo",
      });

      // After entrance, add subtle floating to the popular card
      entrance.then(() => {
        const popularCard = section.querySelector(".pricing-card-popular");
        if (popularCard) {
          floatAnim = anime.animate(popularCard as HTMLElement, {
            translateY: [-3, 3],
            duration: 3500,
            ease: "easeInOutSine",
            direction: "alternate",
            loop: true,
          });
        }
      });
    });

    return () => {
      window.clearTimeout(failsafe);
      floatAnim?.pause();
    };
  }, [isInView]);

  return (
    <section id="pricing" className="py-16 md:py-24 relative" ref={ref}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-electric-blue/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-10">
          <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold text-foreground mb-5 leading-tight">
            Simple,{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              Transparent
            </span>{" "}
            Pricing
          </h2>
          <p className="text-foreground/50 font-body text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Start free, scale as you grow. No hidden fees, cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-body transition-colors ${!isYearly ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <motion.button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-7 rounded-full bg-white/[0.04] border border-white/[0.08] p-1"
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-gradient-to-r from-logo-purple to-electric-blue"
                animate={{ x: isYearly ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              />
            </motion.button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-body transition-colors ${isYearly ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                Yearly
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-logo-purple/20 to-electric-blue/20 border border-white/[0.06] text-sm font-body text-logo-purple">
                Save 20%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`pricing-card ${tier.popular ? "pricing-card-popular" : ""} opacity-0 w-[86%] max-w-[360px] flex-shrink-0 snap-center md:w-auto md:max-w-none`}
            >
              {tier.popular ? (
                <AnimatedBorder
                  borderWidth={2}
                  borderRadius="1rem"
                  className="h-full md:-mt-4 md:mb-4"
                >
                  <PricingCardContent tier={tier} isYearly={isYearly} onSubscribe={handleSubscribe} isLoading={loadingTier === tier.name} isAnyLoading={loadingTier !== null} />
                </AnimatedBorder>
              ) : (
                <PricingCardContent tier={tier} isYearly={isYearly} onSubscribe={handleSubscribe} isLoading={loadingTier === tier.name} isAnyLoading={loadingTier !== null} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Individual pricing card with spotlight + 3D tilt hover            */
/* ------------------------------------------------------------------ */

const PricingCardContent = ({ tier, isYearly, onSubscribe, isLoading, isAnyLoading }: { tier: PricingTier; isYearly: boolean; onSubscribe: (tier: PricingTier) => void; isLoading: boolean; isAnyLoading: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  /* ---------- Spotlight (mouse-following radial glow) ---------- */
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  /* ---------- 3D tilt via framer-motion ---------- */
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const springCfg = { stiffness: 260, damping: 20 };
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [4, -4]), springCfg);
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-4, 4]), springCfg);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    mouseX.set(nx);
    mouseY.set(ny);
    setSpotlightPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0.5);
    mouseY.set(0.5);
    setIsHovered(false);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 800,
      }}
      whileHover={{ y: -8, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      className={`relative h-full rounded-2xl p-6 md:p-8 flex flex-col overflow-hidden ${
        tier.popular
          ? "bg-gradient-to-b from-secondary to-deep-black"
          : "glass-surface border border-white/[0.06] hover:border-white/[0.12] transition-colors"
      }`}
    >
      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-500"
        style={{
          opacity: isHovered ? 1 : 0,
          background: tier.popular
            ? `radial-gradient(500px circle at ${spotlightPos.x}px ${spotlightPos.y}px, hsl(252 100% 68% / 0.10), transparent 40%)`
            : `radial-gradient(500px circle at ${spotlightPos.x}px ${spotlightPos.y}px, hsl(252 100% 68% / 0.06), transparent 40%)`,
        }}
      />

      {/* Subtle top accent line */}
      <div
        className={`absolute top-0 left-6 right-6 h-px ${
          tier.popular
            ? "bg-gradient-to-r from-transparent via-logo-purple to-transparent"
            : "bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        }`}
      />

      {/* Popular glow */}
      {tier.popular && (
        <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-logo-purple/15 to-electric-blue/15 blur-2xl -z-10 animate-pulse opacity-50" />
      )}

      {/* Popular Badge */}
      {tier.popular && (
        <div className="flex justify-center mb-4 relative z-20">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-logo-purple to-electric-blue text-primary-foreground text-sm font-body font-medium shadow-lg shadow-logo-purple/25">
            <Sparkles className="w-4 h-4" />
            Most Popular
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`text-center mb-8 ${!tier.popular ? "pt-2" : ""} relative z-20`}>
        <h3 className="font-display text-xl font-semibold text-foreground mb-4 tracking-tight">
          {tier.name}
        </h3>
        <div className="flex items-baseline justify-center gap-1">
          <motion.span
            key={isYearly ? "yearly" : "monthly"}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-display text-4xl md:text-5xl font-bold text-foreground tabular-nums tracking-tight"
          >
            {isYearly ? tier.yearlyPrice : tier.price}
          </motion.span>
          <span className="text-foreground/60 font-body text-sm">
            {isYearly ? tier.yearlyPeriod : tier.period}
          </span>
        </div>
        <p className="text-sm text-foreground/70 font-body mt-3">{tier.description}</p>
      </div>

      {/* Features */}
      <ul className="space-y-3.5 mb-8 flex-1 relative z-20">
        {tier.features.map((feature, featureIndex) => (
          <li key={featureIndex} className="flex items-start gap-3 group/feature">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover/feature:scale-110 ${
                tier.popular
                  ? "bg-gradient-to-r from-logo-purple to-electric-blue"
                  : "bg-white/[0.06] border border-white/[0.08]"
              }`}
            >
              <Check
                className={`w-3 h-3 ${
                  tier.popular ? "text-primary-foreground" : "text-foreground/50"
                }`}
              />
            </div>
            <span className="text-sm text-foreground/70 font-body transition-colors duration-200 group-hover/feature:text-foreground/90">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="relative z-20">
        <MagneticButton strength={0.15} className="w-full">
          <Button
            variant={tier.popular ? "hero" : "glass"}
            size="lg"
            className="w-full font-body"
            onClick={() => onSubscribe(tier)}
            disabled={isAnyLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : tier.cta}
          </Button>
        </MagneticButton>
      </div>
    </motion.div>
  );
};

export default Pricing;
