import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) navigate("/auth", { replace: true });
        return;
      }

      const { data: profile, error } = await supabase.rpc("get_user_profile", {
        user_id: user.id,
      });

      if (error || !profile) {
        if (!cancelled) navigate("/pricing", { replace: true });
        return;
      }

      const p = typeof profile === "string" ? JSON.parse(profile) : profile;

      const hasAccess =
        p.is_unlimited === true ||
        (p.subscription_tier && p.subscription_tier !== "none");

      if (!cancelled) {
        if (hasAccess) {
          setAuthorized(true);
        } else {
          navigate("/pricing", { replace: true });
        }
      }
    };

    checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          if (!cancelled) navigate("/auth", { replace: true });
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (authorized !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
