import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import type { Json } from "@/integrations/supabase/types";

// Default configs (same as PromptBuilder defaults)
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
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`,
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
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`,
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
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`,
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
- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo`,
  },
];

const defaultHomeDecorViews = [
  { id: "fullProduct", name: "Full Product", placement: "Studio shot", enabled: true, isCustom: false },
  { id: "lifestylePrimary", name: "Lifestyle Primary", placement: "Coffee table in living room", enabled: true, isCustom: false },
  { id: "lifestyleSecondary", name: "Lifestyle Secondary", placement: "Shelf in bedroom", enabled: true, isCustom: false },
];

const defaultFashionDefaults = { season: "summer" };

// localStorage keys (write-through cache for generation flow)
const STORAGE_KEY_FASHION = "promptBuilder_fashionViews";
const STORAGE_KEY_HOMEDECOR = "promptBuilder_homeDecorViews";
const STORAGE_KEY_FASHION_DEFAULTS = "promptBuilder_fashionDefaults";

interface PromptConfigRow {
  config_type: string;
  config_data: unknown;
}

export function usePromptConfig() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["prompt-configs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: rows, error } = await supabase
        .from("user_prompt_configs")
        .select("config_type, config_data")
        .eq("user_id", user.id);

      if (error) throw error;
      return rows as PromptConfigRow[];
    },
  });

  // Parse fetched data or fall back to defaults
  const configMap = new Map<string, unknown>();
  if (data) {
    for (const row of data) {
      configMap.set(row.config_type, row.config_data);
    }
  }

  const fashionViews = (configMap.get("fashion_views") as typeof defaultFashionViews) ?? defaultFashionViews;
  const homeDecorViews = (configMap.get("home_decor_views") as typeof defaultHomeDecorViews) ?? defaultHomeDecorViews;
  const fashionDefaults = (configMap.get("fashion_defaults") as typeof defaultFashionDefaults) ?? defaultFashionDefaults;

  // Sync to localStorage whenever data changes (write-through cache)
  useEffect(() => {
    if (!isLoading && data) {
      localStorage.setItem(STORAGE_KEY_FASHION, JSON.stringify(fashionViews));
      localStorage.setItem(STORAGE_KEY_HOMEDECOR, JSON.stringify(homeDecorViews));
      localStorage.setItem(STORAGE_KEY_FASHION_DEFAULTS, JSON.stringify(fashionDefaults));
    }
  }, [data, isLoading, fashionViews, homeDecorViews, fashionDefaults]);

  const saveConfigsMutation = useMutation({
    mutationFn: async ({
      fashionViews: fv,
      homeDecorViews: hdv,
      fashionDefaults: fd,
    }: {
      fashionViews: Json;
      homeDecorViews: Json;
      fashionDefaults: Json;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const configs = [
        { user_id: user.id, config_type: "fashion_views", config_data: fv },
        { user_id: user.id, config_type: "home_decor_views", config_data: hdv },
        { user_id: user.id, config_type: "fashion_defaults", config_data: fd },
      ];

      const { error } = await supabase
        .from("user_prompt_configs")
        .upsert(configs, { onConflict: "user_id,config_type" });

      if (error) throw error;

      // Sync localStorage
      localStorage.setItem(STORAGE_KEY_FASHION, JSON.stringify(fv));
      localStorage.setItem(STORAGE_KEY_HOMEDECOR, JSON.stringify(hdv));
      localStorage.setItem(STORAGE_KEY_FASHION_DEFAULTS, JSON.stringify(fd));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-configs"] });
    },
  });

  const resetConfigsMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_prompt_configs")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY_FASHION);
      localStorage.removeItem(STORAGE_KEY_HOMEDECOR);
      localStorage.removeItem(STORAGE_KEY_FASHION_DEFAULTS);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompt-configs"] });
    },
  });

  return {
    fashionViews,
    homeDecorViews,
    fashionDefaults,
    isLoading,
    error,
    saveConfigs: saveConfigsMutation.mutateAsync,
    resetConfigs: resetConfigsMutation.mutateAsync,
    isSaving: saveConfigsMutation.isPending,
    isResetting: resetConfigsMutation.isPending,
    defaults: {
      fashionViews: defaultFashionViews,
      homeDecorViews: defaultHomeDecorViews,
      fashionDefaults: defaultFashionDefaults,
    },
  };
}
