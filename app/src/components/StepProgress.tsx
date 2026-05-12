import { Check, Upload, Settings2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

const STEP_ICONS: LucideIcon[] = [Upload, Settings2];

export function StepProgress({ currentStep, totalSteps, labels }: StepProgressProps) {
  return (
    <div className="flex items-center justify-center py-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => {
        const isCompleted = currentStep > step;
        const isCurrent = currentStep === step;
        const isPending = currentStep < step;
        const Icon = STEP_ICONS[index] ?? Settings2;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              {/* Step circle */}
              <div
                className={cn(
                  "relative flex items-center justify-center w-11 h-11 rounded-full text-sm font-semibold transition-all duration-500",
                  isCompleted && "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_20px_hsl(252,85%,62%,0.35)]",
                  isCurrent && "bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_24px_hsl(252,85%,62%,0.45)] ring-[3px] ring-primary/25",
                  isPending && "bg-muted/60 text-muted-foreground border border-border"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4.5 h-4.5 animate-scale-in" strokeWidth={2.5} />
                ) : (
                  <Icon className="w-4.5 h-4.5" strokeWidth={isCurrent ? 2.2 : 1.8} />
                )}
                {/* Current step glow pulse */}
                {isCurrent && (
                  <span
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      boxShadow: "0 0 20px 4px hsl(252 85% 62% / 0.3)",
                      animation: "step-glow-pulse 2.5s ease-in-out infinite",
                    }}
                  />
                )}
              </div>
              {/* Label below */}
              <span
                className={cn(
                  "text-xs font-medium transition-all duration-300 whitespace-nowrap",
                  isCompleted && "text-foreground/80",
                  isCurrent && "font-semibold gradient-text",
                  isPending && "text-muted-foreground/60"
                )}
              >
                {labels[index]}
              </span>
            </div>

            {/* Connector */}
            {index < totalSteps - 1 && (
              <div className="relative w-20 md:w-28 h-1 mx-5 rounded-full bg-border/50 overflow-hidden mb-6">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                    isCompleted
                      ? "w-full bg-gradient-to-r from-primary to-accent"
                      : isCurrent
                        ? "w-1/2 bg-gradient-to-r from-primary/50 to-primary/10"
                        : "w-0"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes step-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
