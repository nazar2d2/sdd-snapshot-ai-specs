import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      {
        const trimmedEmail = email.trim();
        const isSnapshotAdmin = trimmedEmail.toLowerCase() === "snapshot@gmail.com";

        let signInResult = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInResult.error) throw signInResult.error;

        // Verify admin role via RPC
        const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

        // Fallback: If RPC fails (e.g. not setup) or returns error, check email directly
        const isEmailAdmin = signInResult.data.user?.email === 'snapshot@gmail.com';

        if (adminError) {
          console.warn("is_admin RPC failed, falling back to email check:", adminError);
          if (!isEmailAdmin) {
            await supabase.auth.signOut();
            throw new Error("Access denied. Admin privileges required.");
          }
        } else if (!isAdmin && !isEmailAdmin) {
          // Sign out if not admin
          await supabase.auth.signOut();
          throw new Error("Access denied. Admin privileges required.");
        }

        toast({ title: "Welcome, Admin!", description: "Successfully logged in.", variant: "success" });
        navigate("/admin", { replace: true });
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials or insufficient privileges.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Admin Portal
              </h1>
              <p className="text-xs text-muted-foreground">
                Authorized Personnel Only
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                Admin Login
              </h2>
              <p className="text-muted-foreground">
                Sign in with your admin credentials
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="snapshot@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-12"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center space-x-2">
                    <Loader2 className="animate-spin h-5 w-5" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <span>Sign in</span>
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>



            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
