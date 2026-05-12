import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NicheSelection } from "@/components/NicheSelection";
import { FashionFlow, FashionFormData } from "@/components/FashionFlow";
import { HomeDecorFlow, HomeDecorFormData } from "@/components/HomeDecorFlow";
import { ImageResults } from "@/components/ImageResults";
import { StepProgress } from "@/components/StepProgress";
import { LoadingState } from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunctionWithRetry } from "@/lib/invokeEdgeFunctionWithRetry";
import { ArrowLeft, LogOut } from "lucide-react";
import snapshotLogo from "@/assets/snapshot-logo.svg";
import { Button } from "@/components/ui/button";
import { User, Session } from "@supabase/supabase-js";

type Niche = "fashion" | "homeDecor" | null;
type Step = "niche" | "configure" | "loading" | "results";

interface ImageResult {
  view: string;
  viewId: string;
  variantName: string;
  image: string | null;
  error: string | null;
}

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [niche, setNiche] = useState<Niche>(null);
  const [step, setStep] = useState<Step>("niche");
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
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

  const handleNicheSelect = (selectedNiche: Niche) => {
    setNiche(selectedNiche);
    if (selectedNiche) {
      setStep("configure");
    }
  };

  const handleBack = () => {
    if (step === "configure") {
      setStep("niche");
      setNiche(null);
    } else if (step === "results") {
      setStep("configure");
      setImages([]);
    }
  };

  const handleReset = () => {
    setStep("niche");
    setNiche(null);
    setImages([]);
    setIsGenerating(false);
  };

  const handleFashionGenerate = async (data: FashionFormData) => {
    if (!session?.access_token) {
      toast({
        title: "Not logged in",
        description: "Your session has expired. Please log in again to generate.",
        variant: "destructive",
      });
      navigate("/auth", { replace: true });
      return;
    }

    setIsGenerating(true);
    setLoadingCount(data.views.length);
    setStep("loading");

    // Use supabase.functions.invoke (with retry on transient 5xx boot/proxy failures)
    const invokeGeneration = async (): Promise<any> => {
      const { data: result, error } = await invokeEdgeFunctionWithRetry(
        "generate-image",
        {
          body: {
            niche: "fashion",
            productImage: data.productImage,
            views: data.views,
            backgroundColor: data.backgroundColor,
            city: data.city,
            modelAge: data.modelAge,
            aspectRatio: "1:1", // Forced 1:1
            colorVariants: data.colorVariants,
            gender: data.gender,
            ethnicity: data.ethnicity,
            skinTone: data.skinTone,
          },
        }
      );

      if (error) {
        console.error("Edge function error:", error);
        throw new Error((error as any)?.message || "Failed to generate images");
      }

      return result;
    };

    try {
      const result = await invokeGeneration();

      if (result?.error) {
        throw new Error(result.error);
      }

      if (!result?.images) {
        throw new Error("No images were generated");
      }

      setImages(result.images);
      setStep("results");
    } catch (error) {
      console.error("Generation error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred while generating images.";
      toast({
        title: "Generation Failed",
        description: message,
        variant: "destructive",
      });
      setStep("configure");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHomeDecorGenerate = async (data: HomeDecorFormData) => {
    if (!session?.access_token) {
      toast({
        title: "Not logged in",
        description: "Your session has expired. Please log in again to generate.",
        variant: "destructive",
      });
      navigate("/auth", { replace: true });
      return;
    }

    setIsGenerating(true);
    setLoadingCount(data.perspectives.length);
    setStep("loading");

    // Use supabase.functions.invoke (with retry on transient 5xx boot/proxy failures)
    const invokeGeneration = async (): Promise<any> => {
      const { data: result, error } = await invokeEdgeFunctionWithRetry(
        "generate-image",
        {
          body: {
            niche: "homeDecor",
            productImage: data.productImage,
            perspectives: data.perspectives,
            aspectRatio: "1:1", // Forced 1:1
            backgroundColor: data.backgroundColor,
            primaryPlacement: data.primaryPlacement,
            secondaryPlacement: data.secondaryPlacement,
          },
        }
      );

      if (error) {
        console.error("Edge function error:", error);
        throw new Error((error as any)?.message || "Failed to generate images");
      }

      return result;
    };

    try {
      const result = await invokeGeneration();

      if (result?.error) {
        throw new Error(result.error);
      }

      if (!result?.images) {
        throw new Error("No images were generated");
      }

      setImages(result.images);
      setStep("results");
    } catch (error) {
      console.error("Generation error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "An error occurred while generating images.";
      toast({
        title: "Generation Failed",
        description: message,
        variant: "destructive",
      });
      setStep("configure");
    } finally {
      setIsGenerating(false);
    }
  };

  const getCurrentStep = () => {
    switch (step) {
      case "niche":
        return 1;
      case "configure":
      case "loading":
        return 2;
      case "results":
        return 3;
      default:
        return 1;
    }
  };

  const stepLabels = ["Select Niche", "Configure", "Results"];

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={snapshotLogo} alt="SnapShot" className="h-10 w-auto" />
            </div>
            <div className="flex items-center space-x-2">
              {step !== "niche" && step !== "loading" && (
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="flex items-center space-x-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="container max-w-5xl mx-auto px-4">
        <StepProgress
          currentStep={getCurrentStep()}
          totalSteps={3}
          labels={stepLabels}
        />
      </div>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-8">
        {step === "niche" && (
          <NicheSelection
            selectedNiche={niche}
            onSelectNiche={handleNicheSelect}
          />
        )}

        {step === "configure" && niche === "fashion" && (
          <FashionFlow
            onGenerate={handleFashionGenerate}
            isGenerating={isGenerating}
          />
        )}

        {step === "configure" && niche === "homeDecor" && (
          <HomeDecorFlow
            onGenerate={handleHomeDecorGenerate}
            isGenerating={isGenerating}
          />
        )}

        {step === "loading" && <LoadingState count={loadingCount} />}

        {step === "results" && (
          <ImageResults images={images} onReset={handleReset} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground font-body">
            Powered by AI • Professional e-commerce photography in seconds
          </p>
        </div>
      </footer>
    </div>
  );
}
