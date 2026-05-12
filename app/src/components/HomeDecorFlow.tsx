import { useState, useMemo, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { StepProgress } from "./StepProgress";
import { Sparkles, ArrowRight, Lightbulb, Check, Sofa, Layout } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getEnabledHomeDecorViews } from "@/hooks/useViewConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HomeDecorFlowProps {
  onGenerate: (data: HomeDecorFormData) => void;
  isGenerating: boolean;
  onStepChange?: (homeDecorStep: number) => void;
}

export type HomeDecorResolution = "1K" | "2K";

export interface HomeDecorFormData {
  productImage: string;
  perspectives: string[];
  backgroundColor: string;
  primaryPlacement: string;
  secondaryPlacement: string;
  resolution: HomeDecorResolution;
}

const HOMEDECOR_STEP_LABELS = ["Upload", "Configure"];

const placementOptions = [
  { id: "bedside-table", label: "Bedside table", icon: Layout },
  { id: "living-room-side-table", label: "Living room side table", icon: Sofa },
  { id: "dining-table", label: "Dining table", icon: Layout },
  { id: "coffee-table", label: "Coffee table", icon: Sofa },
  { id: "shelf", label: "Shelf", icon: Layout },
  { id: "console-table", label: "Console table", icon: Layout },
  { id: "bathroom-shelf", label: "Bathroom shelf", icon: Layout },
  { id: "sideboard", label: "Sideboard", icon: Layout },
  { id: "near-window", label: "Near window light", icon: Layout },
  { id: "above-sofa", label: "Above sofa (wall)", icon: Sofa },
  { id: "entry-console", label: "Entry console", icon: Layout },
];

export function HomeDecorFlow({ onGenerate, isGenerating, onStepChange }: HomeDecorFlowProps) {
  const [homeDecorStep, setHomeDecorStep] = useState<1 | 2>(1);

  useEffect(() => {
    onStepChange?.(homeDecorStep);
  }, [homeDecorStep, onStepChange]);

  const perspectiveOptions = useMemo(() => {
    const enabledViews = getEnabledHomeDecorViews();
    return enabledViews.map(v => ({
      id: v.id,
      label: v.name,
      description: v.placement,
      prompt: v.prompt,
    }));
  }, []);

  const [productImage, setProductImage] = useState<string | null>(null);
  const [perspectives, setPerspectives] = useState<string[]>([]);
  const [backgroundColor, setBackgroundColor] = useState("#F7F7F7");
  const [primaryPlacement, setPrimaryPlacement] = useState("coffee-table");
  const [secondaryPlacement, setSecondaryPlacement] = useState("shelf");
  const [resolution, setResolution] = useState<HomeDecorResolution>("1K");

  const handlePerspectiveChange = (perspectiveId: string, checked: boolean) => {
    if (checked) {
      setPerspectives([...perspectives, perspectiveId]);
    } else {
      setPerspectives(perspectives.filter((p) => p !== perspectiveId));
    }
  };

  const handleSubmit = () => {
    if (!productImage) return;
    onGenerate({
      productImage,
      perspectives,
      backgroundColor,
      primaryPlacement,
      secondaryPlacement,
      resolution,
    });
  };

  const hasFullProduct = perspectives.some(p => p.toLowerCase().includes("fullproduct") || p.toLowerCase().includes("full"));
  const hasPrimary = perspectives.some(p => p.toLowerCase().includes("primary"));
  const hasSecondary = perspectives.some(p => p.toLowerCase().includes("secondary"));

  const isValid = productImage && perspectives.length > 0;

  const selectedTags = useMemo(() => {
    const tags: string[] = [];
    perspectiveOptions.forEach(p => {
      if (perspectives.includes(p.id)) tags.push(p.label);
    });
    if (hasPrimary) tags.push(placementOptions.find(o => o.id === primaryPlacement)?.label ?? "Coffee table");
    if (hasSecondary) tags.push(placementOptions.find(o => o.id === secondaryPlacement)?.label ?? "Shelf");
    return tags;
  }, [perspectives, hasPrimary, hasSecondary, primaryPlacement, secondaryPlacement, perspectiveOptions]);

  return (
    <div className="space-y-5">
      <StepProgress
        currentStep={homeDecorStep}
        totalSteps={2}
        labels={HOMEDECOR_STEP_LABELS}
      />

      {homeDecorStep === 1 && (
        <div className="space-y-6 w-full">
          <div className="space-y-1">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground tracking-tight">
              Upload your product
            </h2>
            <p className="text-muted-foreground/90 text-sm font-body">
              Drop a clear photo and we&apos;ll create lifestyle shots
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-card overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
              <div className="p-6 lg:p-8 space-y-4">
                <Label className="text-sm font-medium text-foreground/90">
                  Product Image <span className="text-destructive">*</span>
                </Label>
                <ImageUpload value={productImage} onChange={setProductImage} size="large" />
                <p className="text-xs text-muted-foreground">
                  Clear image used in all shots
                </p>
              </div>

              <div className="border-t lg:border-t-0 lg:border-l border-white/[0.06] p-6 lg:p-8 bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium text-foreground">Tips for best results</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    "Plain or neutral background",
                    "Good, even lighting",
                    "Product fills most of the frame",
                    "High resolution (min 800px)",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 lg:px-8 py-4 border-t border-white/[0.06] flex justify-end">
              <Button
                onClick={() => setHomeDecorStep(2)}
                disabled={!productImage}
                className="h-12 px-8 bg-gradient-primary text-primary-foreground hover:opacity-95 disabled:opacity-50"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {homeDecorStep === 2 && (
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground tracking-tight">
              Configure your shots
            </h2>
            <p className="text-muted-foreground/90 text-sm font-body">
              Select image types and placements for lifestyle scenes
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-10 items-start">
            <div className="space-y-2 md:sticky md:top-4">
              <Label className="text-sm font-medium text-foreground/90">Product Image</Label>
              <div className="w-full max-w-[320px]">
                <ImageUpload value={productImage} onChange={setProductImage} />
              </div>
            </div>

            <div className="space-y-5 min-w-0">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Select Image Types</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perspectiveOptions.length === 0 ? (
                    <p className="col-span-2 text-muted-foreground text-xs py-3 text-center">
                      No views configured. Go to Prompt Builder to add views.
                    </p>
                  ) : (
                    perspectiveOptions.map((perspective) => (
                      <label
                        key={perspective.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors duration-150
                          ${perspectives.includes(perspective.id)
                            ? "border-primary/50 bg-primary/[0.06]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                          }`}
                      >
                        <Checkbox
                          checked={perspectives.includes(perspective.id)}
                          onCheckedChange={(checked) => handlePerspectiveChange(perspective.id, checked as boolean)}
                          className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="min-w-0">
                          <span className="font-body text-sm font-medium text-foreground block truncate">{perspective.label}</span>
                          <span className="text-xs text-muted-foreground block truncate">{perspective.description}</span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {selectedTags.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">Selected:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-sm font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hasFullProduct && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Studio Background</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.08]">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-white/20 cursor-pointer appearance-none shrink-0"
                      style={{ backgroundColor }}
                    />
                    <span className="text-xs text-foreground">{backgroundColor.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {hasPrimary && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Primary Placement</Label>
                  <Select value={primaryPlacement} onValueChange={setPrimaryPlacement}>
                    <SelectTrigger className="w-full h-11 text-left bg-white/[0.02] border-white/[0.08] rounded-lg hover:border-white/15 text-sm">
                      <SelectValue placeholder="Select placement">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
                            <Sofa className="w-5 h-5" />
                          </div>
                          <span className="font-medium truncate">
                            {placementOptions.find(o => o.id === primaryPlacement)?.label ?? "Coffee table"}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border rounded-xl z-50">
                      {placementOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.id} value={option.id} className="cursor-pointer py-3 px-3 rounded-lg focus:bg-primary/5">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                                <Icon className="w-5 h-5" />
                              </div>
                              <span className="font-medium text-foreground">{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasSecondary && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">Secondary Placement</Label>
                  <Select value={secondaryPlacement} onValueChange={setSecondaryPlacement}>
                    <SelectTrigger className="w-full h-11 text-left bg-white/[0.02] border-white/[0.08] rounded-lg hover:border-white/15 text-sm">
                      <SelectValue placeholder="Select placement">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary">
                            <Layout className="w-5 h-5" />
                          </div>
                          <span className="font-medium truncate">
                            {placementOptions.find(o => o.id === secondaryPlacement)?.label ?? "Shelf"}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border rounded-xl z-50">
                      {placementOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.id} value={option.id} className="cursor-pointer py-3 px-3 rounded-lg focus:bg-primary/5">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                                <Icon className="w-5 h-5" />
                              </div>
                              <span className="font-medium text-foreground">{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ── RESOLUTION SECTION ──────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Quality</Label>
                <ToggleGroup
                  type="single"
                  value={resolution}
                  onValueChange={(val) => { if (val) setResolution(val as HomeDecorResolution); }}
                  className="w-full gap-0 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5"
                >
                  <ToggleGroupItem
                    value="1K"
                    className="flex-1 h-9 rounded-md text-sm font-medium data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-sm"
                  >
                    Standard (1K) · 1 credit
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="2K"
                    className="flex-1 h-9 rounded-md text-sm font-medium data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-sm"
                  >
                    HD (2K) · 3 credits
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setHomeDecorStep(1)}
                  className="h-12 border-white/[0.08] hover:bg-white/[0.04]"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || isGenerating}
                  className="flex-1 h-14 text-base font-medium bg-gradient-primary text-primary-foreground hover:opacity-95 disabled:opacity-50 transition-all duration-200 rounded-xl shadow-button hover:shadow-button-hover"
                >
                  {isGenerating ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Generating...</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-2">
                      <Sparkles className="w-5 h-5" />
                      <span>Generate {perspectives.length} Image{perspectives.length !== 1 ? "s" : ""} · {perspectives.length * (resolution === "2K" ? 3 : 1)} credit{perspectives.length * (resolution === "2K" ? 3 : 1) !== 1 ? "s" : ""}</span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
