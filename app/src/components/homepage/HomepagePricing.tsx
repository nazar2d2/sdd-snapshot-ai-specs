import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { invokeEdgeFunctionWithRetry } from "@/lib/invokeEdgeFunctionWithRetry";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLANS = [
  {
    name: "Basic",
    monthlyPrice: 10,
    yearlyPrice: 100,
    images: 75,
    description: "Perfect for hobbyists and trying out styles.",
    features: [
      "75 credits/month",
      "Standard quality (1K)",
      "Basic Commercial License",
      "Access to all styles"
    ],
    priceIdMonth: "price_1T3KMiBxmnkg2dwfnp5bMOLr",
    priceIdYear: "price_1T3KMiBxmnkg2dwfE69V01dq",
  },
  {
    name: "Starter",
    monthlyPrice: 28.95,
    yearlyPrice: 289.50,
    images: 250,
    description: "Great for content creators and small brands.",
    features: [
      "250 credits/month",
      "HD quality available (2K)",
      "Full Commercial License",
      "Priority Support",
      "Rollover unused credits"
    ],
    popular: true,
    priceIdMonth: "price_1T3KNYBxmnkg2dwfqsFzI6Ni",
    priceIdYear: "price_1T3KNZBxmnkg2dwfismP3dNE",
  },
  {
    name: "Advanced",
    monthlyPrice: 49.95,
    yearlyPrice: 499.50,
    images: 500,
    description: "For professional photographers and agencies.",
    features: [
      "500 credits/month",
      "HD quality available (2K)",
      "Bulk Generation Tools",
      "Dedicated Account Manager",
      "Rollover unused credits"
    ],
    priceIdMonth: "price_1T3KOOBxmnkg2dwfusX1apa0",
    priceIdYear: "price_1T3KOOBxmnkg2dwfqEQEEmUb",
  },
  {
    name: "Generator",
    monthlyPrice: 124.95,
    yearlyPrice: 1249.50,
    images: 1000,
    description: "Ultimate power for high-volume creation.",
    features: [
      "1,000 credits/month",
      "HD quality available (2K)",
      "API Access (Coming Soon)",
      "White-label options",
      "Rollover unused credits"
    ],
    priceIdMonth: "price_1T3KPDBxmnkg2dwfkVAAtk6Y",
    priceIdYear: "price_1T3KPDBxmnkg2dwfQ7bKJj1N",
  }
];

export const HomepagePricing = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    setLoadingPlan(plan.name);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      const priceId = isYearly ? plan.priceIdYear : plan.priceIdMonth;

      const { data, error } = await invokeEdgeFunctionWithRetry("create-checkout", {
        body: {
          priceId,
          mode: "subscription",
          successUrl: `${window.location.origin}/app`,
          cancelUrl: window.location.href,
        }
      });

      if (error) throw new Error((error as any).message || "Checkout failed");

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Checkout Error",
        description: "Could not start checkout. Please try again.",
        variant: "destructive"
      });
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) navigate("/auth");
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your creative needs.
          </p>

          <div className="flex items-center justify-center gap-4 mb-8">
            <Label htmlFor="billing-period" className={`text-sm ${!isYearly ? 'font-bold' : ''}`}>Monthly</Label>
            <Switch
              id="billing-period"
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <Label htmlFor="billing-period" className={`text-sm ${isYearly ? 'font-bold' : ''}`}>
              Yearly <span className="text-xs text-green-600 font-normal ml-1">(Save ~20%)</span>
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-card rounded-2xl border ${plan.popular ? 'border-primary ring-2 ring-primary/20 shadow-card' : 'border-border'} hover:shadow-medium transition-smooth overflow-hidden flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 gradient-brand py-1 text-center">
                  <span className="text-xs font-semibold text-primary-foreground uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={`p-6 ${plan.popular ? 'pt-10' : 'pt-8'} flex-1 flex flex-col`}>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-foreground">
                    ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                  </span>
                  <span className="text-muted-foreground text-sm">/{isYearly ? 'year' : 'month'}</span>
                </div>
                <div className="text-sm font-medium text-primary mb-4">
                  {plan.images.toLocaleString()} credits / month
                </div>
                <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                  {plan.description}
                </p>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loadingPlan === plan.name}
                  className={`w-full ${plan.popular ? 'gradient-brand border-0 shadow-soft hover:shadow-medium' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                >
                  {loadingPlan === plan.name ? <Loader2 className="w-4 h-4 animate-spin" /> : "Choose Plan"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
