
-- Create user_prompt_configs table
CREATE TABLE public.user_prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_type text NOT NULL,
  config_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, config_type)
);

-- Enable RLS
ALTER TABLE public.user_prompt_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own configs" ON public.user_prompt_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own configs" ON public.user_prompt_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own configs" ON public.user_prompt_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own configs" ON public.user_prompt_configs FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_user_prompt_configs_updated_at
  BEFORE UPDATE ON public.user_prompt_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed all existing users with default configs
INSERT INTO public.user_prompt_configs (user_id, config_type, config_data)
SELECT p.id, t.config_type, t.config_data::jsonb
FROM public.profiles p
CROSS JOIN (VALUES
  ('fashion_views', '[{"id":"front","name":"Front View","pose":"Classic catalog pose - facing camera directly, natural confident expression, one hand relaxed at side, weight slightly shifted to one leg","enabled":true,"isCustom":false,"prompt":"FRONT VIEW REQUIREMENTS:\n- Model faces camera DIRECTLY at 0° angle\n- FRAMING BY PRODUCT TYPE:\n  • TOP/OUTFIT: Full head visible with 10% headroom above hair, frame from head to waist/hips\n  • BOTTOM: Frame from waist to feet, shoes fully visible\n  • SHOES: Frame from mid-calf to floor, both shoes fully visible\n- STUDIO: Hyperrealistic seamless cyclorama, soft gradient floor sweep, soft even shadows, background tinted to ${backgroundColor}\n- MODEL: Same ${gender} model identity as anchor, ${ethnicity} ethnicity, ${skinTone} skin\n- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments\n- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged, background stays same\n- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo"},{"id":"back","name":"Back View","pose":"Full body back view, model facing away from camera, shoulders relaxed, arms hanging naturally at sides, confident upright posture","enabled":true,"isCustom":false,"prompt":"BACK VIEW REQUIREMENTS:\n- Model faces AWAY from camera at 180° angle, back of head visible\n- FRAMING BY PRODUCT TYPE:\n  • TOP/OUTFIT: Back of head fully visible with 10% headroom, frame from head to waist/hips\n  • BOTTOM: Frame from waist to feet, shoes fully visible\n  • SHOES: Frame from mid-calf to floor, both shoes fully visible\n- STUDIO: Hyperrealistic seamless cyclorama, soft gradient floor sweep, soft even shadows, background tinted to ${backgroundColor}\n- MODEL: Same ${gender} model identity as anchor, ${ethnicity} ethnicity, ${skinTone} skin\n- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments\n- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged, background stays same\n- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo"},{"id":"side","name":"Side View","pose":"90-degree side profile, model facing left or right, arms relaxed, natural upright posture, chin level","enabled":true,"isCustom":false,"prompt":"SIDE VIEW REQUIREMENTS:\n- Model at exact 90° SIDE PROFILE angle\n- FRAMING BY PRODUCT TYPE:\n  • TOP/OUTFIT: Full head in profile visible with 10% headroom, frame from head to waist/hips\n  • BOTTOM: Frame from waist to feet, shoes fully visible\n  • SHOES: Frame from mid-calf to floor, both shoes fully visible\n- STUDIO: Hyperrealistic seamless cyclorama, soft gradient floor sweep, soft even shadows, background tinted to ${backgroundColor}\n- MODEL: Same ${gender} model identity as anchor, ${ethnicity} ethnicity, ${skinTone} skin\n- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments\n- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged, background stays same\n- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo"},{"id":"outdoor","name":"Outdoor View","pose":"Confident editorial fashion pose on an iconic urban street, natural movement, relaxed shoulders, engaging expression","enabled":true,"isCustom":false,"prompt":"OUTDOOR VIEW REQUIREMENTS:\n- Hyperrealistic street scene in ${city} during ${season}\n- Natural daylight, authentic urban environment, no phone, no text overlays\n- FRAMING BY PRODUCT TYPE:\n  • TOP/OUTFIT: Full head visible with 10% headroom, frame from head to mid-thigh or full body\n  • BOTTOM: Frame from waist to feet, feet on ground\n  • SHOES: Frame from mid-calf to floor, both shoes on street\n- MODEL: Same ${gender} model identity as anchor, ${ethnicity} ethnicity, ${skinTone} skin\n- CLOTHING SAFETY: Never shirtless, never pantless, always fully clothed with complementary neutral garments\n- VARIANTS: Change garment color ONLY to target hex, keep exact design/fabric/structure unchanged\n- NO UPLOAD LEAKAGE: Do not copy jewelry/watches/shoes/pose from reference photo"}]'),
  ('home_decor_views', '[{"id":"fullProduct","name":"Full Product","placement":"Studio shot","enabled":true,"isCustom":false},{"id":"lifestylePrimary","name":"Lifestyle Primary","placement":"Coffee table in living room","enabled":true,"isCustom":false},{"id":"lifestyleSecondary","name":"Lifestyle Secondary","placement":"Shelf in bedroom","enabled":true,"isCustom":false}]'),
  ('fashion_defaults', '{"season":"summer"}')
) AS t(config_type, config_data)
ON CONFLICT DO NOTHING;
