import { useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PartialImage {
  viewId: string;
  variantName: string;
  view: string;
  image: string | null;
  error: string | null;
}

interface LoadingStateProps {
  count: number;
  progress?: number;
  partialImages?: PartialImage[];
}

const PHASES = [
  "Analyzing your product…",
  "Setting up the studio…",
  "Styling the model…",
  "Rendering views…",
  "Applying final touches…",
];

function getTimeEstimate(count: number): string {
  if (count <= 1) return "~2 minutes";
  if (count <= 4) return "~4–6 minutes";
  if (count <= 8) return "~6–10 minutes";
  return "~10–15 minutes";
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function LoadingState({ count, progress = 0, partialImages = [] }: LoadingStateProps) {
  const total = count || 1;
  // Use the greater of backend progress count and visible partial images to avoid under-reporting
  const partialCount = partialImages.filter(p => p.image).length;
  const doneCount = Math.max(progress > 0 ? progress : 0, partialCount);
  const hasProgress = doneCount > 0;
  const progressPct = total > 0 ? Math.min(100, (doneCount / total) * 100) : 0;

  const startTime = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [prevPhase, setPrevPhase] = useState("");
  const [currentPhase, setCurrentPhase] = useState(PHASES[0]);
  const [phaseOpacity, setPhaseOpacity] = useState(1);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Phase rotation with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseOpacity(0);
      setTimeout(() => {
        setPhaseIndex((prev) => (prev + 1) % PHASES.length);
        setPhaseOpacity(1);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Derive display phase
  const isRetryingLast = hasProgress && doneCount > 0 && doneCount === total - 1;
  const displayPhase = hasProgress
    ? isRetryingLast
      ? `Finishing last image…`
      : `${doneCount} of ${total} image${total === 1 ? "" : "s"} ready`
    : PHASES[phaseIndex];

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center w-full">
      <div className="space-y-8 w-full">
        {/* Header with animated icon */}
        <div className="text-center space-y-5">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl">
            {/* Pulsing gradient ring */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-accent to-primary opacity-30 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
            <div className="absolute inset-[-4px] rounded-[20px] bg-gradient-to-br from-primary/40 via-transparent to-accent/40 animate-[spin_4s_linear_infinite] opacity-50" />
            <div className="absolute inset-[2px] rounded-[14px] bg-background" />
            <Sparkles className="relative w-9 h-9 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground tracking-tight">
              Creating your product photos
            </h2>
            {/* Phase text with crossfade */}
            <p
              className="text-sm text-muted-foreground/90 transition-opacity duration-300"
              style={{ opacity: hasProgress ? 1 : phaseOpacity }}
            >
              {displayPhase}
            </p>
          </div>

          {/* Progress bar */}
          <div className="max-w-xs mx-auto space-y-3">
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
              {!hasProgress ? (
                /* Indeterminate animated bar */
                <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-primary/60 via-accent to-primary/60 animate-[indeterminate_1.8s_ease-in-out_infinite]">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_1.2s_infinite]" />
                </div>
              ) : (
                /* Real progress bar */
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700 ease-out relative"
                  style={{ width: `${Math.max(progressPct, 5)}%` }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
              )}
            </div>

            {/* Timer + estimate row */}
            <div className="flex items-center justify-between text-xs text-muted-foreground/70">
              <span className="tabular-nums">
                Elapsed: {formatElapsed(elapsed)}
              </span>
              <span>
                Est. {getTimeEstimate(total)} for {total} image{total === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {/* Image grid - show partial images or shimmer placeholders */}
        <div className="flex flex-wrap justify-center items-center gap-4 w-full">
          {Array.from({ length: total }).map((_, index) => {
            const partial = partialImages[index];
            const hasImage = partial?.image;

            return (
              <div
                key={index}
                className={cn(
                  "relative w-36 sm:w-40 aspect-square rounded-xl overflow-hidden border transition-all duration-300 flex items-center justify-center shrink-0",
                  hasImage
                    ? "border-primary/30 bg-white/[0.02] shadow-lg shadow-primary/5"
                    : "border-white/[0.06] bg-white/[0.02]"
                )}
              >
                {hasImage ? (
                  <img
                    src={partial!.image!}
                    alt={partial!.view}
                    className="w-full h-full object-contain object-center animate-in fade-in duration-500"
                  />
                ) : (
                  <div className="w-full h-full loading-shimmer flex flex-col items-center justify-center gap-3">
                    {/* Pulsing gradient ring loader with staggered delay */}
                    <div
                      className="relative w-10 h-10"
                      style={{ animationDelay: `${index * 200}ms` }}
                    >
                      <div
                        className="absolute inset-0 rounded-full border-2 border-transparent animate-[spin_1.5s_linear_infinite]"
                        style={{
                          borderImage: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), transparent) 1",
                          borderRadius: "50%",
                          animationDelay: `${index * 200}ms`,
                        }}
                      />
                      <div
                        className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-[spin_1.2s_linear_infinite]"
                        style={{ animationDelay: `${index * 150}ms` }}
                      />
                      <div
                        className="absolute inset-1 rounded-full border border-accent/20 border-b-accent/60 animate-[spin_2s_linear_infinite_reverse]"
                        style={{ animationDelay: `${index * 100}ms` }}
                      />
                    </div>
                    <span
                      className="text-[10px] text-muted-foreground/50 animate-pulse"
                      style={{ animationDelay: `${index * 300}ms` }}
                    >
                      Rendering…
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground/60">
            Keep this tab open while generating
          </p>
        </div>
      </div>
    </div>
  );
}
