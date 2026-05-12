// Hook to read saved view configurations from localStorage (set by PromptBuilder)

export interface FashionViewConfig {
  id: string;
  name: string;
  pose: string;
  enabled: boolean;
  isCustom: boolean;
  prompt?: string;
}

export interface HomeDecorViewConfig {
  id: string;
  name: string;
  placement: string;
  enabled: boolean;
  isCustom: boolean;
  prompt?: string;
}

export interface FashionDefaults {
  season: string;
}

const STORAGE_KEY_FASHION = "promptBuilder_fashionViews";
const STORAGE_KEY_HOMEDECOR = "promptBuilder_homeDecorViews";
const STORAGE_KEY_FASHION_DEFAULTS = "promptBuilder_fashionDefaults";

// Default fashion views - ONLY front, back, side, outdoor (no custom poses)
const defaultFashionViews: FashionViewConfig[] = [
  { id: "front", name: "Front View", pose: "Classic catalog pose - one hand on hip, weight shifted to one leg, direct eye contact", enabled: true, isCustom: false },
  { id: "back", name: "Back View", pose: "Full body back view with arms relaxed and confident posture", enabled: true, isCustom: false },
  { id: "side", name: "Side View", pose: "90-degree side profile with arms relaxed and natural upright posture", enabled: true, isCustom: false },
  { id: "outdoor", name: "Outdoor View", pose: "Confident editorial fashion pose on an iconic street", enabled: true, isCustom: false },
];

// Allowed view IDs - only these four are valid
const ALLOWED_FASHION_VIEW_IDS = new Set(["front", "back", "side", "outdoor"]);

// Default home decor views (same as in PromptBuilder)
const defaultHomeDecorViews: HomeDecorViewConfig[] = [
  { id: "fullProduct", name: "Full Product", placement: "Studio shot", enabled: true, isCustom: false },
  { id: "lifestylePrimary", name: "Lifestyle Primary", placement: "Coffee table in living room", enabled: true, isCustom: false },
  { id: "lifestyleSecondary", name: "Lifestyle Secondary", placement: "Shelf in bedroom", enabled: true, isCustom: false },
];

export function getFashionViews(): FashionViewConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FASHION);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading fashion views from localStorage:", e);
  }
  return defaultFashionViews;
}

export function getHomeDecorViews(): HomeDecorViewConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HOMEDECOR);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading home decor views from localStorage:", e);
  }
  return defaultHomeDecorViews;
}

export function getFashionDefaults(): FashionDefaults {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FASHION_DEFAULTS);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading fashion defaults from localStorage:", e);
  }
  return { season: "summer" };
}

export function getEnabledFashionViews(): FashionViewConfig[] {
  return getFashionViews().filter((v) => {
    // Only allow front, back, side, outdoor – filter out ALL custom/other views
    return v.enabled && ALLOWED_FASHION_VIEW_IDS.has(v.id);
  });
}


export function getEnabledHomeDecorViews(): HomeDecorViewConfig[] {
  return getHomeDecorViews().filter(v => v.enabled);
}
