import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAccess = async (currentSession: Session | null) => {
      if (!currentSession) {
        navigate("/admin/login", { replace: true });
        setLoading(false);
        return;
      }

      try {
        const { data: isAdmin, error } = await supabase.rpc("is_admin");

        // Fallback check
        const isEmailAdmin = currentSession?.user?.email === 'snapshot@gmail.com';

        if (error) {
          console.warn("is_admin RPC error in RequireAdmin", error);
          if (isEmailAdmin) {
            setIsAdmin(true); // Allow if email matches
          } else {
            navigate("/admin/login", { replace: true });
            setIsAdmin(false);
          }
        } else if (!isAdmin && !isEmailAdmin) {
          navigate("/admin/login", { replace: true });
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error("Auth check failed", err);
        // Last resort fallback
        if (currentSession?.user?.email === 'snapshot@gmail.com') {
          setIsAdmin(true);
        } else {
          navigate("/admin/login", { replace: true });
          setIsAdmin(false);
        }
      } finally {
        setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/admin/login", { replace: true });
          setLoading(false);
        }
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkAdminAccess(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
