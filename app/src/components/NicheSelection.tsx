import { Shirt, Home, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Niche = "fashion" | "homeDecor" | null;

interface NicheSelectionProps {
  selectedNiche: Niche;
  onSelectNiche: (niche: Niche) => void;
}

const niches = [
  {
    id: "fashion" as const,
    title: "Fashion",
    description: "AI-powered model photography for clothing & accessories",
    icon: Shirt,
    gradient: "from-[hsl(252,85%,62%)] to-[hsl(280,80%,55%)]",
    glowColor: "hsl(252 85% 62% / 0.4)",
    features: ["Multi-angle Views", "Color Variants", "Model Customization", "Studio & Outdoor"],
  },
  {
    id: "homeDecor" as const,
    title: "Home Decor",
    description: "Lifestyle product shots for furniture & decorative items",
    icon: Home,
    gradient: "from-[hsl(217,91%,60%)] to-[hsl(190,80%,50%)]",
    glowColor: "hsl(217 91% 60% / 0.4)",
    features: ["Product Shots", "Room Scenes", "Multiple Placements", "Natural Lighting"],
  },
];

export function NicheSelection({ selectedNiche, onSelectNiche }: NicheSelectionProps) {
  return (
    <div className="space-y-10 sm:space-y-14 w-full">
      {/* Simplified centered header */}
      <div className="text-center space-y-3">
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-foreground tracking-tight">
          What are you creating?
        </h2>
        <p className="text-muted-foreground/80 text-base sm:text-lg max-w-lg mx-auto leading-relaxed font-body">
          Choose a category to generate AI-powered product photos.
        </p>
      </div>

      {/* Cards with subtle background glow */}
      <div className="relative">
        {/* Background glow */}
        <div className="absolute inset-0 -inset-x-8 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-4xl mx-auto">
          {niches.map((niche, index) => {
            const isSelected = selectedNiche === niche.id;
            return (
              <button
                key={niche.id}
                onClick={() => onSelectNiche(niche.id)}
                className={cn(
                  "relative rounded-3xl text-left group w-full overflow-hidden",
                  "border transition-all duration-300",
                  "hover:-translate-y-1 active:scale-[0.98]",
                  "animate-fade-in",
                  isSelected
                    ? "border-primary/60 shadow-[0_0_50px_-8px_hsl(var(--primary)/0.35)]"
                    : "border-border-subtle hover:border-primary/30 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.2)]"
                )}
                style={{ animationDelay: `${index * 120}ms`, animationFillMode: "both" }}
              >
                {/* Gradient top strip */}
                <div className={cn("h-2 w-full bg-gradient-to-r", niche.gradient)} />

                {/* Card body */}
                <div className={cn(
                  "p-8 sm:p-10 flex flex-col items-center text-center space-y-6",
                  "bg-gradient-to-b from-transparent to-transparent group-hover:to-primary/[0.03] transition-all duration-300"
                )}>
                  {/* Icon with glow */}
                  <div className="relative">
                    <div
                      className={cn(
                        "w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-300",
                        "bg-gradient-to-br",
                        niche.gradient,
                      )}
                      style={{
                        boxShadow: isSelected
                          ? `0 10px 40px -4px ${niche.glowColor}`
                          : "none",
                      }}
                    >
                      <niche.icon className="w-11 h-11 text-white" />
                    </div>
                    {/* Selected check badge */}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg animate-scale-in">
                        <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground">
                      {niche.title}
                    </h3>
                    <p className="text-base text-muted-foreground/80 leading-relaxed font-body">
                      {niche.description}
                    </p>
                  </div>

                  {/* Feature pills */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {niche.features.map((feature) => (
                      <Badge
                        key={feature}
                        variant="outline"
                        className={cn(
                          "text-sm font-medium px-4 py-1.5 rounded-full transition-colors duration-200",
                          isSelected
                            ? "border-primary/40 text-primary bg-primary/[0.08]"
                            : "border-border text-muted-foreground group-hover:border-primary/20 group-hover:text-foreground/80"
                        )}
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  {/* CTA hint */}
                  <div className={cn(
                    "flex items-center gap-1 text-sm font-medium transition-all duration-200",
                    isSelected
                      ? "text-primary"
                      : "text-muted-foreground/50 group-hover:text-muted-foreground"
                  )}>
                    <span>{isSelected ? "Selected" : "Select"}</span>
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      "group-hover:translate-x-0.5"
                    )} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
