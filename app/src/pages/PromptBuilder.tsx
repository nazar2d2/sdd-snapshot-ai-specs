import { useState, useEffect } from "react";
import { usePromptConfig } from "@/hooks/usePromptConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Eye, EyeOff, Settings, ChevronDown,
  Wand2, Info, Shirt, Sofa, User, RotateCcw, ArrowRight, MapPin,
  Sun, Snowflake, Leaf, Flower2, Check, Camera, Layers, Package
} from "lucide-react";

// Seasons with icons
const seasons = [
  { id: "summer", name: "Summer", description: "Bright sunlight, warm tones, summer fashion", icon: Sun },
  { id: "winter", name: "Winter", description: "Cool tones, cozy layers, winter atmosphere", icon: Snowflake },
  { id: "fall", name: "Fall", description: "Warm autumn colors, golden hour lighting", icon: Leaf },
  { id: "spring", name: "Spring", description: "Fresh colors, blooming nature, light clothing", icon: Flower2 },
];

// View-specific icons
const viewIcons: Record<string, React.ElementType> = {
  front: User,
  back: RotateCcw,
  side: ArrowRight,
  outdoor: MapPin,
};

// Home decor view icons
const homeDecorIcons: Record<string, React.ElementType> = {
  fullProduct: Camera,
  lifestylePrimary: Sofa,
  lifestyleSecondary: Layers,
};

// Default fashion views with poses - ONLY front, back, side, outdoor
const defaultFashionViews = [
  { 
    id: "front", 
    name: "Front View", 
    pose: "Classic catalog pose - facing camera directly, natural confident expression, one hand relaxed at side, weight slightly shifted to one leg", 
    enabled: true, 
    isCustom: false,
    prompt: `FRONT VIEW REQUIREMENTS:
- Model faces camera DIRECTLY at 0° angle
- FRAMING BY PRODUCT TYPE:
  • TOP/OUTFIT: Full head visible with 10% headroom above hair, frame from head to waist/hips
  • BOTTOM: Frame from waist to feet, shoes fully visible
  • SHOES: Frame from mid-calf to floor, both shoes fully visible
- STUDIO: Hyperrealistic seamless cyclorama, soft gradient floor sweep, soft even shadows, background tinted to \${backgroundColor}
- MODEL: Same \${gender} model identity as anchor, \${ethnicity} ethnicity, \${skinTone} skin
- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments
- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged, background stays same
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`
  },
  { 
    id: "back", 
    name: "Back View", 
    pose: "Full body back view, model facing away from camera, shoulders relaxed, arms hanging naturally at sides, confident upright posture", 
    enabled: true, 
    isCustom: false,
    prompt: `BACK VIEW REQUIREMENTS:
- Model faces AWAY from camera at 180° angle, back of head visible
- FRAMING BY PRODUCT TYPE:
  • TOP/OUTFIT: Back of head fully visible with 10% headroom, frame from head to waist/hips
  • BOTTOM: Frame from waist to feet, shoes fully visible
  • SHOES: Frame from mid-calf to floor, both shoes fully visible
- STUDIO: Hyperrealistic seamless cyclorama, soft gradient floor sweep, soft even shadows, background tinted to \${backgroundColor}
- MODEL: Same \${gender} model identity as anchor, \${ethnicity} ethnicity, \${skinTone} skin
- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments
- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged, background stays same
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`
  },
  { 
    id: "side", 
    name: "Side View", 
    pose: "90-degree side profile, model facing left or right, arms relaxed, natural upright posture, chin level", 
    enabled: true, 
    isCustom: false,
    prompt: `SIDE VIEW REQUIREMENTS:
- Model at exact 90° SIDE PROFILE angle
- FRAMING BY PRODUCT TYPE:
  • TOP/OUTFIT: Full head in profile visible with 10% headroom, frame from head to waist/hips
  • BOTTOM: Frame from waist to feet, shoes fully visible
  • SHOES: Frame from mid-calf to floor, both shoes fully visible
- STUDIO: Hyperrealistic seamless cyclorama, soft gradient floor sweep, soft even shadows, background tinted to \${backgroundColor}
- MODEL: Same \${gender} model identity as anchor, \${ethnicity} ethnicity, \${skinTone} skin
- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments
- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged, background stays same
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`
  },
  { 
    id: "outdoor", 
    name: "Outdoor View", 
    pose: "Confident editorial fashion pose on an iconic urban street, natural movement, relaxed shoulders, engaging expression", 
    enabled: true, 
    isCustom: false,
    prompt: `OUTDOOR VIEW REQUIREMENTS:
- Hyperrealistic street scene in \${city} during \${season}
- Natural daylight, authentic urban environment, no phone, no text overlays
- FRAMING BY PRODUCT TYPE:
  • TOP/OUTFIT: Full head visible with 10% headroom, frame from head to mid-thigh or full body
  • BOTTOM: Frame from waist to feet, feet on ground
  • SHOES: Frame from mid-calf to floor, both shoes on street
- MODEL: Same \${gender} model identity as anchor, \${ethnicity} ethnicity, \${skinTone} skin
- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments
- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`
  },
];

const ALLOWED_FASHION_VIEW_IDS = new Set(["front", "back", "side", "outdoor"]);

const defaultHomeDecorViews = [
  { id: "fullProduct", name: "Full Product", placement: "Studio shot", enabled: true, isCustom: false },
  { id: "lifestylePrimary", name: "Lifestyle Primary", placement: "Coffee table in living room", enabled: true, isCustom: false },
  { id: "lifestyleSecondary", name: "Lifestyle Secondary", placement: "Shelf in bedroom", enabled: true, isCustom: false },
];

const promptPlaceholders = [
  { placeholder: "${backgroundColor}", description: "Background color (hex code)" },
  { placeholder: "${modelAge}", description: "Model age (18-70)" },
  { placeholder: "${city}", description: "City name for outdoor shots" },
  { placeholder: "${modelDescription}", description: "Gender-based model description" },
  { placeholder: "${placement}", description: "Furniture placement for home decor" },
  { placeholder: "${season}", description: "Season (Summer, Winter, Fall, Spring)" },
];

interface ViewConfig {
  id: string;
  name: string;
  pose: string;
  enabled: boolean;
  isCustom: boolean;
  prompt?: string;
}

interface HomeDecorViewConfig {
  id: string;
  name: string;
  placement: string;
  enabled: boolean;
  isCustom: boolean;
  prompt?: string;
}

interface FashionDefaults {
  season: string;
}

const STORAGE_KEY_FASHION = "promptBuilder_fashionViews";
const STORAGE_KEY_HOMEDECOR = "promptBuilder_homeDecorViews";
const STORAGE_KEY_FASHION_DEFAULTS = "promptBuilder_fashionDefaults";

export default function PromptBuilder() {
  const {
    fashionViews: dbFashionViews,
    homeDecorViews: dbHomeDecorViews,
    fashionDefaults: dbFashionDefaults,
    isLoading: isLoadingConfig,
    saveConfigs,
    resetConfigs,
    isSaving,
    isResetting,
    defaults,
  } = usePromptConfig();

  const [fashionViews, setFashionViews] = useState<ViewConfig[]>(defaultFashionViews);
  const [homeDecorViews, setHomeDecorViews] = useState<HomeDecorViewConfig[]>(defaultHomeDecorViews);
  const [fashionDefaults, setFashionDefaults] = useState<FashionDefaults>({ season: "summer" });
  const [selectedTab, setSelectedTab] = useState("fashion");
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const { toast } = useToast();

  // Initialize state from DB data once loaded
  useEffect(() => {
    if (!isLoadingConfig && !initialized) {
      const allowedViews = (dbFashionViews as ViewConfig[]).filter((v) => ALLOWED_FASHION_VIEW_IDS.has(v.id));
      const mergedFashion = defaultFashionViews.map((defaultView) => {
        const savedView = allowedViews.find((v) => v.id === defaultView.id);
        return savedView || defaultView;
      });
      setFashionViews(mergedFashion);
      setHomeDecorViews(dbHomeDecorViews as HomeDecorViewConfig[]);
      setFashionDefaults(dbFashionDefaults as FashionDefaults);
      setInitialized(true);
    }
  }, [isLoadingConfig, initialized, dbFashionViews, dbHomeDecorViews, dbFashionDefaults]);

  const toggleExpanded = (id: string) => {
    setExpandedViews(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Fashion view handlers
  const toggleFashionView = (id: string) => {
    if (!ALLOWED_FASHION_VIEW_IDS.has(id)) return;
    setFashionViews(views =>
      views.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v)
    );
  };

  const updateFashionPose = (id: string, newPose: string) => {
    setFashionViews(views =>
      views.map(v => v.id === id ? { ...v, pose: newPose } : v)
    );
  };

  const updateFashionPrompt = (id: string, prompt: string) => {
    setFashionViews(views =>
      views.map(v => v.id === id ? { ...v, prompt } : v)
    );
  };

  // Home decor view handlers
  const toggleHomeDecorView = (id: string) => {
    setHomeDecorViews(views =>
      views.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v)
    );
  };

  const updateHomeDecorPlacement = (id: string, placement: string) => {
    setHomeDecorViews(views =>
      views.map(v => v.id === id ? { ...v, placement } : v)
    );
  };

  const updateHomeDecorPrompt = (id: string, prompt: string) => {
    setHomeDecorViews(views =>
      views.map(v => v.id === id ? { ...v, prompt } : v)
    );
  };

  const addCustomHomeDecorView = () => {
    const newId = `custom-${Date.now()}`;
    const newView: HomeDecorViewConfig = {
      id: newId,
      name: "Custom Lifestyle",
      placement: "Enter placement...",
      enabled: true,
      isCustom: true,
    };
    setHomeDecorViews([...homeDecorViews, newView]);
  };

  const removeHomeDecorView = (id: string) => {
    setHomeDecorViews(views => views.filter(v => v.id !== id));
  };

  // Sync to localStorage on state change (write-through cache for generation flow)
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY_FASHION, JSON.stringify(fashionViews));
    }
  }, [fashionViews, initialized]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY_HOMEDECOR, JSON.stringify(homeDecorViews));
    }
  }, [homeDecorViews, initialized]);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY_FASHION_DEFAULTS, JSON.stringify(fashionDefaults));
    }
  }, [fashionDefaults, initialized]);

  const handleSave = async () => {
    try {
      await saveConfigs({
        fashionViews: fashionViews as any,
        homeDecorViews: homeDecorViews as any,
        fashionDefaults: fashionDefaults as any,
      });
      toast({
        title: "Configuration saved",
        description: "Your view and prompt configuration has been saved.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: "Could not save configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = async () => {
    try {
      await resetConfigs();
      setFashionViews(defaults.fashionViews as ViewConfig[]);
      setHomeDecorViews(defaults.homeDecorViews as HomeDecorViewConfig[]);
      setFashionDefaults(defaults.fashionDefaults as FashionDefaults);
      localStorage.removeItem(STORAGE_KEY_FASHION);
      localStorage.removeItem(STORAGE_KEY_HOMEDECOR);
      localStorage.removeItem(STORAGE_KEY_FASHION_DEFAULTS);
      toast({
        title: "Reset complete",
        description: "All views have been restored to default configuration.",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Reset failed",
        description: "Could not reset configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderViewCard = (
    view: ViewConfig | HomeDecorViewConfig,
    type: "fashion" | "homeDecor"
  ) => {
    const isFashion = type === "fashion";
    const IconComp = isFashion
      ? viewIcons[view.id] || User
      : homeDecorIcons[view.id] || Package;
    const isExpanded = expandedViews.has(view.id);

    return (
      <div
        key={view.id}
        className={`group rounded-xl border transition-all duration-200 overflow-hidden ${
          view.enabled
            ? "bg-card border-l-2 border-l-primary border-t-border border-r-border border-b-border shadow-sm hover:shadow-md"
            : "bg-muted/20 border-border/40 opacity-60"
        }`}
      >
        {/* Header row */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
          onClick={() => view.enabled && toggleExpanded(view.id)}
        >
          <Switch
            checked={view.enabled}
            onCheckedChange={(e) => {
              e && toggleExpanded(view.id); // auto-expand on enable
              isFashion ? toggleFashionView(view.id) : toggleHomeDecorView(view.id);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
              view.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              <IconComp className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-semibold block ${view.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                {view.name}
              </span>
              {!isFashion && "placement" in view && (
                <span className="text-xs text-muted-foreground truncate block">{(view as HomeDecorViewConfig).placement}</span>
              )}
            </div>
            {"isCustom" in view && view.isCustom && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-accent/30 text-accent">Custom</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isFashion && "isCustom" in view && view.isCustom && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); removeHomeDecorView(view.id); }}
                className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {view.enabled && (
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            )}
          </div>
        </div>

        {/* Expandable content */}
        {view.enabled && (
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="px-4 pb-4 space-y-3 border-t border-border/30">
              {isFashion && "pose" in view && (
                <div className="pt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pose Description</Label>
                  <Textarea
                    value={(view as ViewConfig).pose}
                    onChange={(e) => updateFashionPose(view.id, e.target.value)}
                    className="mt-1.5 min-h-[80px] bg-secondary/50 border-border/50 focus:border-primary/50 text-sm"
                    placeholder="Describe the pose for this view..."
                  />
                </div>
              )}

              {!isFashion && "placement" in view && (
                <div className="pt-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Placement</Label>
                  <Input
                    value={(view as HomeDecorViewConfig).placement}
                    onChange={(e) => updateHomeDecorPlacement(view.id, e.target.value)}
                    className="mt-1.5 bg-secondary/50 border-border/50 focus:border-primary/50"
                    placeholder="e.g. coffee table in living room"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Prompt</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPrompt(editingPrompt === view.id ? null : view.id)}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {editingPrompt === view.id ? (
                      <><EyeOff className="w-3 h-3" /> Hide</>
                    ) : (
                      <><Eye className="w-3 h-3" /> Edit</>
                    )}
                  </Button>
                </div>
                {editingPrompt === view.id && (
                  <div className="space-y-1">
                    <Textarea
                      value={view.prompt || ""}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, 800);
                        isFashion
                          ? updateFashionPrompt(view.id, val)
                          : updateHomeDecorPrompt(view.id, val);
                      }}
                      maxLength={800}
                      className="min-h-[120px] font-mono text-xs bg-secondary/50 border-border/50 focus:border-primary/50"
                      placeholder="Leave empty to use the default prompt. Use ${placeholder} syntax for dynamic values..."
                    />
                    <p className={`text-[10px] text-right ${(view.prompt?.length || 0) > 700 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {view.prompt?.length || 0} / 800
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoadingConfig || !initialized) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              Prompt & Perspective Builder
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure views, poses, and prompts used for generating product photos.
            </p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-primary/40 via-accent/30 to-transparent" />
      </div>

      {/* Placeholders Info Banner */}
      <Collapsible className="mb-6">
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/[0.08] transition-colors group">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">Available Placeholders</span>
              <span className="text-xs text-muted-foreground ml-2">— dynamic values replaced during generation</span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 px-4 py-3 rounded-xl bg-secondary/40 border border-border/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {promptPlaceholders.map(p => (
                <div key={p.placeholder} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-background/60">
                  <code className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {p.placeholder}
                  </code>
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full max-w-sm grid-cols-2 bg-secondary/60 rounded-xl p-1 h-11">
          <TabsTrigger value="fashion" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium">
            <Shirt className="w-4 h-4" />
            Fashion
          </TabsTrigger>
          <TabsTrigger value="homeDecor" className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm font-medium">
            <Sofa className="w-4 h-4" />
            Home Decor
          </TabsTrigger>
        </TabsList>

        {/* Fashion Tab */}
        <TabsContent value="fashion" className="space-y-5 animate-fade-in">
          {/* Default Settings */}
          <Collapsible open={showDefaults} onOpenChange={setShowDefaults}>
            <Card className="border-border/60 bg-card/80">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/20 transition-colors rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10">
                        <Settings className="w-3.5 h-3.5 text-accent" />
                      </div>
                      Default Settings
                    </CardTitle>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showDefaults ? "rotate-180" : ""}`} />
                  </div>
                  <CardDescription className="text-xs ml-9.5">
                    Default settings applied to all fashion photos.
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">Season</Label>
                      <Select
                        value={fashionDefaults.season}
                        onValueChange={(value) => setFashionDefaults(prev => ({ ...prev, season: value }))}
                      >
                        <SelectTrigger className="bg-secondary/50 border-border/50">
                          <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                        <SelectContent>
                          {seasons.map(season => {
                            const SeasonIcon = season.icon;
                            return (
                              <SelectItem key={season.id} value={season.id}>
                                <span className="flex items-center gap-2">
                                  <SeasonIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                  {season.name}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1.5 italic">
                        {seasons.find(s => s.id === fashionDefaults.season)?.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Active Views */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
                <Layers className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Active Views</h3>
                <p className="text-xs text-muted-foreground">Toggle views on/off and customize poses & prompts.</p>
              </div>
            </div>
            <div className="space-y-3">
              {fashionViews.map(view => renderViewCard(view, "fashion"))}
            </div>
          </div>
        </TabsContent>

        {/* Home Decor Tab */}
        <TabsContent value="homeDecor" className="space-y-5 animate-fade-in">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
                  <Sofa className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Active Perspectives</h3>
                  <p className="text-xs text-muted-foreground">Configure placements and prompts for home decor photos.</p>
                </div>
              </div>
              <Button
                onClick={addCustomHomeDecorView}
                variant="outline"
                size="sm"
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add View
              </Button>
            </div>
            <div className="space-y-3">
              {homeDecorViews.map(view => renderViewCard(view, "homeDecor"))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 bg-background/90 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_hsl(0_0%_0%/0.3)]">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-1.5"
            disabled={isResetting || isSaving}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isResetting ? "Resetting..." : "Reset to Default"}
          </Button>
          <Button
            onClick={handleSave}
            className="gap-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground border-0"
            disabled={isSaving || isResetting}
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
