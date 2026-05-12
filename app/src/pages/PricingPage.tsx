import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HomepagePricing } from "@/components/homepage/HomepagePricing";
import snapshotLogo from "@/assets/snapshot-logo.svg";
import { Loader2 } from "lucide-react";

export default function PricingPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: profile } = await supabase.rpc("get_user_profile", {
        user_id: user.id,
      });

      if (profile) {
        const p = typeof profile === "string" ? JSON.parse(profile) : profile;
        const hasAccess =
          p.is_unlimited === true ||
          (p.subscription_tier && p.subscription_tier !== "none");

        if (hasAccess) {
          navigate("/app", { replace: true });
          return;
        }
      }

      setReady(true);
    };
    check();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <img src={snapshotLogo} alt="SnapShot" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="text-center pt-12 pb-4">
          <h1 className="text-2xl font-display font-semibold text-foreground mb-2">
            Choose a plan to continue
          </h1>
          <p className="text-muted-foreground">
            Select a subscription plan to start generating images.
          </p>
        </div>
        <HomepagePricing />
      </main>
    </div>
  );
}
