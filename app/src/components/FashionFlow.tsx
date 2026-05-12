import { useState, useMemo, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CitySelect } from "./CitySelect";
import { ImageUpload } from "./ImageUpload";
import { ColorVariantSelector, ColorVariant } from "./ColorVariantSelector";
import { StepProgress } from "./StepProgress";
import { Sparkles, Shirt, User, Users, Focus, Maximize, Footprints, ArrowRight, Lightbulb, Check, RatioIcon, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEnabledFashionViews, getFashionDefaults } from "@/hooks/useViewConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FashionFlowProps {
  onGenerate: (data: FashionFormData) => void;
  isGenerating: boolean;
  onStepChange?: (fashionStep: number) => void;
}

export interface FashionViewData {
  id: string;
  name: string;
  pose?: string;
  customPrompt?: string;
}

export type ModelGender = "male" | "female";

export type ModelEthnicity =
  | "caucasian"
  | "black"
  | "east-asian"
  | "south-asian"
  | "middle-eastern"
  | "latino"
  | "mixed";

export type ModelSkinTone =
  | "fair"
  | "light"
  | "medium"
  | "tan"
  | "deep";

export type ProductType = "top" | "bottom" | "shoes" | "outfit";

export type ViewPose = "full-body" | "product-focused";

export type AspectRatio =
  | "1:1" | "4:5" | "9:16" | "16:9"
  | "4:3" | "3:4" | "2:3" | "3:2"
  | "5:4" | "21:9";

export type Resolution = "1K" | "2K";

export interface FashionFormData {
  productImage: string;
  views: FashionViewData[];
  backgroundColor: string;
  city: string;
  modelAge: number;
  aspectRatio: AspectRatio;
  season: string;
  colorVariants: ColorVariant[];
  gender: ModelGender;
  ethnicity: ModelEthnicity;
  skinTone: ModelSkinTone;
  productType: ProductType;
  viewPose: ViewPose;
  resolution: Resolution;
}



const skinToneOptions: { id: ModelSkinTone; label: string; color: string }[] = [
  { id: "fair", label: "Fair", color: "#FDEBD0" },
  { id: "light", label: "Light", color: "#F5CBA7" },
  { id: "medium", label: "Medium", color: "#D4A574" },
  { id: "tan", label: "Tan", color: "#BA8C63" },
  { id: "deep", label: "Deep", color: "#8B5A2B" },
];

const productTypeOptions: { id: ProductType; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "top", label: "Top", description: "Shirts, sweaters, jackets", icon: <Shirt className="w-5 h-5" /> },
  { id: "bottom", label: "Bottom", description: "Pants, skirts, shorts", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12l-2 16H8L6 4z" /><path d="M12 4v16" /></svg> },
  { id: "shoes", label: "Shoes", description: "Footwear", icon: <Footprints className="w-5 h-5" /> },
  { id: "outfit", label: "Outfit", description: "Full outfit/set", icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="6" r="2" /><path d="M12 8v4M8 20v-8a4 4 0 0 1 8 0v8" /></svg> },
];

const viewPoseOptions: { id: ViewPose; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "full-body", label: "Full Body", description: "Head to toe visible", icon: <Maximize className="w-5 h-5" /> },
  { id: "product-focused", label: "Product Focused", description: "Focused on the product", icon: <Focus className="w-5 h-5" /> },
];

const genderOptions: { id: ModelGender; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "male", label: "Men", description: "Male model", icon: <User className="w-5 h-5" /> },
  { id: "female", label: "Women", description: "Female model", icon: <Users className="w-5 h-5" /> },
];

const ethnicityOptionsWithIcons: { id: ModelEthnicity; label: string; description: string }[] = [
  { id: "caucasian", label: "Caucasian", description: "European descent" },
  { id: "black", label: "Black", description: "African descent" },
  { id: "east-asian", label: "East Asian", description: "East Asian descent" },
  { id: "south-asian", label: "South Asian", description: "South Asian descent" },
  { id: "middle-eastern", label: "Middle Eastern", description: "Middle Eastern descent" },
  { id: "latino", label: "Latino", description: "Latin American descent" },
  { id: "mixed", label: "Mixed", description: "Mixed ethnicity" },
];

const aspectRatioOptions: { id: AspectRatio; label: string; hint: string; w: number; h: number }[] = [
  { id: "9:16", label: "9:16", hint: "Stories", w: 9, h: 16 },
  { id: "2:3", label: "2:3", hint: "Portrait", w: 2, h: 3 },
  { id: "3:4", label: "3:4", hint: "Portrait", w: 3, h: 4 },
  { id: "4:5", label: "4:5", hint: "Instagram", w: 4, h: 5 },
  { id: "1:1", label: "1:1", hint: "Square", w: 1, h: 1 },
  { id: "5:4", label: "5:4", hint: "Landscape", w: 5, h: 4 },
  { id: "4:3", label: "4:3", hint: "Landscape", w: 4, h: 3 },
  { id: "3:2", label: "3:2", hint: "Photo", w: 3, h: 2 },
  { id: "16:9", label: "16:9", hint: "Banner", w: 16, h: 9 },
  { id: "21:9", label: "21:9", hint: "Ultra-wide", w: 21, h: 9 },
];

const BG_PRESETS = [
  { color: "#FFFFFF", name: "White" },
  { color: "#F7F7F7", name: "Off White" },
  { color: "#E8E8E8", name: "Light Gray" },
  { color: "#D0D0D0", name: "Gray" },
  { color: "#A0A0A0", name: "Mid Gray" },
  { color: "#505050", name: "Dark Gray" },
  { color: "#1A1A1A", name: "Charcoal" },
  { color: "#000000", name: "Black" },
  { color: "#F5F0EB", name: "Warm Cream" },
  { color: "#E8DDD3", name: "Beige" },
  { color: "#D4E6F1", name: "Light Blue" },
  { color: "#FADBD8", name: "Blush" },
];

const FASHION_STEP_LABELS = ["Upload", "Model & Views"];

export function FashionFlow({ onGenerate, isGenerating, onStepChange }: FashionFlowProps) {
  const [fashionStep, setFashionStep] = useState<1 | 2>(1);

  useEffect(() => {
    onStepChange?.(fashionStep);
  }, [fashionStep, onStepChange]);

  // Get enabled views from localStorage config
  const viewOptions = useMemo(() => {
    const enabledViews = getEnabledFashionViews();
    return enabledViews.map(v => ({
      id: v.id,
      label: v.name,
      isStudio: v.id !== "outdoor" && !v.id.includes("outdoor"),
      pose: v.pose,
      prompt: v.prompt,
    }));
  }, []);

  const fashionDefaults = useMemo(() => getFashionDefaults(), []);

  const [productImage, setProductImage] = useState<string | null>(null);
  const [selectedViewIds, setSelectedViewIds] = useState<string[]>([]);
  const [backgroundColor, setBackgroundColor] = useState("#F7F7F7");
  const [city, setCity] = useState("");
  const [modelAge, setModelAge] = useState<number>(25);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");

  const [colorVariants, setColorVariants] = useState<ColorVariant[]>([]);
  const [gender, setGender] = useState<ModelGender>("female");
  const [ethnicity, setEthnicity] = useState<ModelEthnicity>("caucasian");
  const [skinTone, setSkinTone] = useState<ModelSkinTone>("medium");
  const [productType, setProductType] = useState<ProductType>("top");
  const [viewPose, setViewPose] = useState<ViewPose>("full-body");
  const [resolution, setResolution] = useState<Resolution>("1K");

  const handleViewChange = (viewId: string, checked: boolean) => {
    if (checked) {
      setSelectedViewIds([...selectedViewIds, viewId]);
    } else {
      setSelectedViewIds(selectedViewIds.filter((v) => v !== viewId));
    }
  };

  const handleSubmit = () => {
    if (!productImage) return;

    // Fixed view order for consistent sorting
    const VIEW_ORDER = ["front", "side", "back", "outdoor"];

    // Sort selectedViewIds by fixed view order
    const sortedViewIds = [...selectedViewIds].sort((a, b) => {
      const aIdx = VIEW_ORDER.indexOf(a.toLowerCase());
      const bIdx = VIEW_ORDER.indexOf(b.toLowerCase());
      return (aIdx >= 0 ? aIdx : 99) - (bIdx >= 0 ? bIdx : 99);
    });

    // Map selected IDs to full view data including custom poses/prompts from PromptBuilder
    const selectedViews: FashionViewData[] = sortedViewIds
      .map(id => viewOptions.find(v => v.id === id))
      .filter((v): v is NonNullable<typeof v> => v !== undefined)
      .map(v => ({
        id: v.id,
        name: v.label,
        pose: v.pose,
        // Map 'prompt' from PromptBuilder to 'customPrompt' for the backend
        customPrompt: v.prompt,
      }));

    // Assign unique IDs to each color variant using index
    // This ensures each variant is treated as distinct even if name/color match
    const indexedVariants = colorVariants.map((v, i) => ({
      ...v,
      id: `${v.name}-${v.color}-${i}`,
    }));

    onGenerate({
      productImage,
      views: selectedViews,
      backgroundColor,
      city,
      modelAge,
      aspectRatio,
      season: fashionDefaults.season,
      colorVariants: indexedVariants,
      gender,
      ethnicity,
      skinTone,
      productType,
      viewPose,
      resolution,
    });
  };

  // Calculate total images and credit cost
  const totalImages = selectedViewIds.length * (colorVariants.filter(v => !v.isBase).length + 1);
  const creditsPerImage = resolution === "2K" ? 3 : 1;
  const totalCredits = totalImages * creditsPerImage;

  const hasOutdoorView = selectedViewIds.some(v => v.toLowerCase().includes("outdoor"));
  const hasStudioViews = selectedViewIds.some(v => !v.toLowerCase().includes("outdoor"));

  const isValid = productImage && selectedViewIds.length > 0 &&
    (!hasOutdoorView || city);


  return (
    <div className="space-y-5">
      <StepProgress
        currentStep={fashionStep}
        totalSteps={2}
        labels={FASHION_STEP_LABELS}
      />

      {fashionStep === 1 && (
        <div className="space-y-6 w-full animate-fade-in">
          <div className="space-y-1 text-center">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground tracking-tight">
              <span className="gradient-text">Upload</span> your product
            </h2>
            <p className="text-muted-foreground/70 text-sm font-body">
              Drop a clear photo and we&apos;ll create professional model shots
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] shadow-[0_8px_32px_hsl(0,0%,0%,0.5)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
              {/* Upload area - left */}
              <div className="p-6 lg:p-8 space-y-4">
                <Label className="text-sm font-medium text-foreground/90">
                  Product Image <span className="text-destructive">*</span>
                </Label>
                <ImageUpload value={productImage} onChange={setProductImage} size="large" />
                <p className="text-xs text-muted-foreground/60">
                  Clear image of your product used in all views
                </p>
              </div>

              {/* Tips panel - right */}
              <div className="relative border-t lg:border-t-0 lg:border-l border-white/[0.06] p-6 lg:p-8 bg-white/[0.015]">
                {/* Gradient accent top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/40 via-accent/30 to-transparent lg:hidden" />
                <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/40 via-accent/30 to-transparent hidden lg:block" />
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                    <Lightbulb className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Tips for best results</h3>
                </div>
                <ul className="space-y-3.5">
                  {[
                    "Plain or neutral background",
                    "Good, even lighting",
                    "Product fills most of the frame",
                    "High resolution (min 800px)",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2.5 text-sm text-muted-foreground/80">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 lg:px-8 py-5 border-t border-white/[0.06] flex justify-end bg-white/[0.01]">
              <Button
                onClick={() => setFashionStep(2)}
                disabled={!productImage}
                variant="hero"
                size="lg"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {fashionStep === 2 && (
        <div className="space-y-5 animate-fade-in">
          <div className="text-center space-y-1">
            <h2 className="font-display text-2xl md:text-3xl font-medium text-foreground tracking-tight">
              <span className="gradient-text">Configure</span> &amp; Generate
            </h2>
            <p className="text-muted-foreground/70 text-sm font-body">
              Set model, product, format, and views for your shoot
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 lg:gap-10 items-start">
            {/* Product preview - left column */}
            <div className="space-y-2 md:sticky md:top-4">
              <Label className="text-sm font-medium text-foreground/90">Product Image</Label>
              <div className="w-full max-w-[320px]">
                <ImageUpload value={productImage} onChange={setProductImage} />
              </div>
            </div>

            {/* Form - right column */}
            <div className="space-y-4 min-w-0">

              {/* ── MODEL SECTION ───────────────────────────────────── */}
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shadow-[0_0_12px_hsl(252,85%,62%,0.15)]">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Model</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Gender toggle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Gender</Label>
                    <ToggleGroup
                      type="single"
                      value={gender}
                      onValueChange={(val) => { if (val) setGender(val as ModelGender); }}
                      className="w-full gap-0 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5"
                    >
                      {genderOptions.map((opt) => (
                        <ToggleGroupItem
                          key={opt.id}
                          value={opt.id}
                          className="flex-1 h-9 rounded-md text-sm font-medium data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-sm gap-1.5"
                        >
                          {opt.icon}
                          {opt.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  {/* Ethnicity select */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Ethnicity</Label>
                    <Select value={ethnicity} onValueChange={(val) => setEthnicity(val as ModelEthnicity)}>
                      <SelectTrigger className="w-full h-9 text-left bg-white/[0.02] border-white/[0.08] rounded-lg hover:border-white/15 text-sm">
                        <SelectValue>
                          <span className="truncate">{ethnicityOptionsWithIcons.find(o => o.id === ethnicity)?.label}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border rounded-xl z-50 max-h-[300px]">
                        {ethnicityOptionsWithIcons.map((option) => (
                          <SelectItem key={option.id} value={option.id} className="cursor-pointer py-2 px-3 rounded-lg focus:bg-primary/5 text-sm">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Skin Tone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Skin Tone</Label>
                  <div className="flex flex-wrap gap-2">
                    {skinToneOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSkinTone(option.id)}
                        className={`flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-colors min-w-[56px]
                          ${skinTone === option.id
                            ? "border-primary/50 bg-primary/[0.06]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                          }`}
                      >
                        <div className="w-6 h-6 rounded-full border border-white/20 mb-1" style={{ backgroundColor: option.color }} />
                        <span className="text-[10px] text-foreground">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Age slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Age</Label>
                    <span className="text-sm font-medium text-foreground tabular-nums">{modelAge}</span>
                  </div>
                  <Slider
                    value={[modelAge]}
                    onValueChange={([v]) => setModelAge(v)}
                    min={18}
                    max={70}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>18</span>
                    <span>70</span>
                  </div>
                </div>
              </section>

              {/* ── PRODUCT SECTION ─────────────────────────────────── */}
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shadow-[0_0_12px_hsl(252,85%,62%,0.15)]">
                    <Shirt className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Product</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Product type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Type</Label>
                    <Select value={productType} onValueChange={(val) => setProductType(val as ProductType)}>
                      <SelectTrigger className="w-full h-9 text-left bg-white/[0.02] border-white/[0.08] rounded-lg hover:border-white/15 text-sm">
                        <SelectValue placeholder="Select product type">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary">
                              {productTypeOptions.find(o => o.id === productType)?.icon}
                            </div>
                            <span className="font-medium truncate">{productTypeOptions.find(o => o.id === productType)?.label}</span>
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border rounded-xl z-50">
                        {productTypeOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id} className="cursor-pointer py-2.5 px-3 rounded-lg focus:bg-primary/5">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary">{option.icon}</div>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground text-sm">{option.label}</span>
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* View pose toggle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Framing</Label>
                    <ToggleGroup
                      type="single"
                      value={viewPose}
                      onValueChange={(val) => { if (val) setViewPose(val as ViewPose); }}
                      className="w-full gap-0 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5"
                    >
                      {viewPoseOptions.map((opt) => (
                        <ToggleGroupItem
                          key={opt.id}
                          value={opt.id}
                          className="flex-1 h-9 rounded-md text-xs font-medium data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-sm gap-1.5"
                        >
                          {opt.icon}
                          {opt.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>
              </section>

              {/* ── FORMAT SECTION (Aspect Ratio) ──────────────────── */}
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shadow-[0_0_12px_hsl(252,85%,62%,0.15)]">
                    <RatioIcon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Aspect Ratio</span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {aspectRatioOptions.map((ar) => {
                    const maxH = 48;
                    const scale = maxH / Math.max(ar.w, ar.h);
                    const rectW = Math.round(ar.w * scale);
                    const rectH = Math.round(ar.h * scale);
                    const selected = aspectRatio === ar.id;

                    return (
                      <button
                        key={ar.id}
                        type="button"
                        onClick={() => setAspectRatio(ar.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border cursor-pointer transition-all
                          ${selected
                            ? "border-primary/50 bg-primary/[0.08] shadow-sm"
                            : "border-white/[0.06] bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.03]"
                          }`}
                      >
                        <div className="flex items-center justify-center h-[52px]">
                          <div
                            className={`rounded-[3px] border ${selected ? "border-primary/60 bg-primary/20" : "border-white/20 bg-white/[0.06]"}`}
                            style={{ width: rectW, height: rectH }}
                          />
                        </div>
                        <span className={`text-[11px] font-medium leading-none ${selected ? "text-primary" : "text-foreground/70"}`}>
                          {ar.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground leading-none">{ar.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── RESOLUTION SECTION ──────────────────────────── */}
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shadow-[0_0_12px_hsl(252,85%,62%,0.15)]">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Quality</span>
                </div>

                <ToggleGroup
                  type="single"
                  value={resolution}
                  onValueChange={(val) => { if (val) setResolution(val as Resolution); }}
                  className="w-full gap-0 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5"
                >
                  <ToggleGroupItem
                    value="1K"
                    className="flex-1 h-10 rounded-md text-sm font-medium data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-sm gap-1.5 flex-col"
                  >
                    <span>Standard (1K)</span>
                    <span className="text-[10px] text-muted-foreground">1 credit/image</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="2K"
                    className="flex-1 h-10 rounded-md text-sm font-medium data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:shadow-sm gap-1.5 flex-col"
                  >
                    <span>HD (2K)</span>
                    <span className="text-[10px] text-muted-foreground">3 credits/image</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </section>

              {/* ── VIEWS SECTION ───────────────────────────────────── */}
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shadow-[0_0_12px_hsl(252,85%,62%,0.15)]">
                    <Maximize className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Views</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {viewOptions.length === 0 ? (
                    <p className="col-span-4 text-muted-foreground text-xs py-3 text-center">
                      No views configured. Go to Prompt Builder to add views.
                    </p>
                  ) : (
                    viewOptions.map((view) => (
                      <label
                        key={view.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors duration-150
                          ${selectedViewIds.includes(view.id)
                            ? "border-primary/50 bg-primary/[0.06]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                          }`}
                      >
                        <Checkbox
                          checked={selectedViewIds.includes(view.id)}
                          onCheckedChange={(checked) => handleViewChange(view.id, checked as boolean)}
                          className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span className="font-body text-sm text-foreground truncate">{view.label}</span>
                      </label>
                    ))
                  )}
                </div>
              </section>

              {/* ── VARIANTS SECTION ────────────────────────────────── */}
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                <ColorVariantSelector
                  variants={colorVariants}
                  onVariantsChange={setColorVariants}
                />
              </section>

              {/* ── ENVIRONMENT SECTION (conditional) ──────────────── */}
              {(hasStudioViews || hasOutdoorView) && (
                <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4 transition-all duration-200 hover:border-white/[0.12] shadow-[0_2px_12px_hsl(0,0%,0%,0.3)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shadow-[0_0_12px_hsl(252,85%,62%,0.15)]">
                      <Palette className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Environment</span>
                  </div>

                  {hasStudioViews && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Studio Background</Label>
                      <div className="flex items-center gap-3">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-10 h-10 rounded-lg border border-white/20 cursor-pointer shrink-0 shadow-sm transition-transform hover:scale-105"
                              style={{ backgroundColor }}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="start">
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm">Background Color</h4>
                              <div className="grid grid-cols-6 gap-2">
                                {BG_PRESETS.map((preset) => (
                                  <button
                                    key={preset.color}
                                    type="button"
                                    onClick={() => setBackgroundColor(preset.color)}
                                    className={`w-8 h-8 rounded-full border hover:scale-110 transition-transform ${backgroundColor === preset.color ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                                    style={{ backgroundColor: preset.color }}
                                    title={preset.name}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center gap-2 pt-2 border-t">
                                <input
                                  type="color"
                                  value={backgroundColor}
                                  onChange={(e) => setBackgroundColor(e.target.value)}
                                  className="w-8 h-8 rounded border border-border cursor-pointer"
                                />
                                <Input
                                  value={backgroundColor.toUpperCase()}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) setBackgroundColor(v);
                                  }}
                                  className="flex-1 h-8 text-xs font-mono"
                                  maxLength={7}
                                />
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <span className="text-xs text-foreground font-mono">{backgroundColor.toUpperCase()}</span>
                      </div>
                    </div>
                  )}

                  {hasOutdoorView && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Outdoor Location</Label>
                      <CitySelect value={city} onValueChange={setCity} />
                    </div>
                  )}
                </section>
              )}

              {/* ── CONFIG SUMMARY ──────────────────────────────────── */}
              {selectedViewIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground rounded-lg px-4 py-3 border-l-[3px] border-l-primary/50 bg-white/[0.02]">
                  <span className="text-foreground font-semibold">{selectedViewIds.length} view{selectedViewIds.length !== 1 ? "s" : ""}</span>
                  <span className="text-white/15">·</span>
                  <span>{colorVariants.filter(v => !v.isBase).length + 1} variant{colorVariants.filter(v => !v.isBase).length > 0 ? "s" : ""}</span>
                  <span className="text-white/15">·</span>
                  <span>{resolution === "2K" ? "HD (2K)" : "Standard (1K)"}</span>
                  <span className="text-white/15">·</span>
                  <span>{viewPoseOptions.find(o => o.id === viewPose)?.label}</span>
                  <span className="ml-auto text-primary font-semibold">{totalImages} image{totalImages !== 1 ? "s" : ""} · {totalCredits} credit{totalCredits !== 1 ? "s" : ""}</span>
                </div>
              )}

              {/* ── GENERATE ACTIONS ────────────────────────────────── */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={() => setFashionStep(1)}
                  className="h-12 border-white/[0.08] hover:bg-white/[0.04]"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || isGenerating}
                  variant="hero"
                  className={cn(
                    "flex-1 h-14 text-base font-medium rounded-xl",
                    isValid && !isGenerating && "shadow-[0_0_30px_hsl(252,85%,62%,0.35)] hover:shadow-[0_0_40px_hsl(252,85%,62%,0.5)]"
                  )}
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
                      <span>Generate {totalImages} Image{totalImages !== 1 ? "s" : ""}</span>
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
