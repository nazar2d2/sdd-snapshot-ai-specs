import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";
import { useCredits } from "@/integrations/supabase/hooks/useCredits";
import { useProfile } from "@/integrations/supabase/hooks/useProfile";
import { CreditTopUpModal } from "@/components/CreditTopUpModal";

interface SidebarLayoutProps {
  children: ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { credits, isLoading: isCreditsLoading } = useCredits();
  const { profile } = useProfile();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isAuthLoading, user, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logged out", description: "See you next time!" });
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <AppSidebar
          user={user}
          profile={profile}
          credits={credits}
          isCreditsLoading={isCreditsLoading}
          onLogout={handleLogout}
          onTopUp={() => setTopUpOpen(true)}
        />
        <SidebarInset className="flex flex-col bg-background">
          <header className="border-b border-border/50 bg-background sticky top-0 z-10">
            <div className="flex items-center px-4 py-2.5">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </SidebarInset>
      </div>

      <CreditTopUpModal
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
      />
    </SidebarProvider>
  );
}
