import { ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Niche = "fashion" | "homeDecor" | null;
type Step = "niche" | "configure" | "loading" | "results";

const fashionStepLabels: Record<number, string> = {
  1: "Upload",
  2: "Model & Views",
};

const homeDecorStepLabels: Record<number, string> = {
  1: "Upload",
  2: "Configure",
};

interface FlowBreadcrumbProps {
  step: Step;
  niche: Niche;
  fashionStep?: number;
  homeDecorStep?: number;
}

const nicheLabel: Record<NonNullable<Niche>, string> = {
  fashion: "Fashion",
  homeDecor: "Home Decor",
};

export function FlowBreadcrumb({ step, niche, fashionStep, homeDecorStep }: FlowBreadcrumbProps) {
  if (step === "niche") return null;

  const parts: string[] = [];
  if (niche) parts.push(nicheLabel[niche]);
  if (step === "configure") {
    if (niche === "fashion" && fashionStep && fashionStepLabels[fashionStep]) {
      parts.push(fashionStepLabels[fashionStep]);
    } else if (niche === "homeDecor" && homeDecorStep && homeDecorStepLabels[homeDecorStep]) {
      parts.push(homeDecorStepLabels[homeDecorStep]);
    } else {
      parts.push("Configure");
    }
  } else if (step === "loading") parts.push("Generating…");
  else if (step === "results") parts.push("Results");

  if (parts.length === 0) return null;

  return (
    <nav
      aria-label="Progress"
      className={cn(
        "flex items-center gap-1.5 text-[11px] tracking-wide",
        "text-muted-foreground/80"
      )}
    >
      {parts.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 opacity-40" />}
          <Circle className={cn(
            "w-1.5 h-1.5",
            i === parts.length - 1 ? "fill-primary text-primary" : "fill-muted-foreground/40 text-muted-foreground/40"
          )} />
          <span className={cn(
            i === parts.length - 1
              ? "text-primary font-semibold"
              : "text-muted-foreground/70"
          )}>
            {p}
          </span>
        </span>
      ))}
    </nav>
  );
}
