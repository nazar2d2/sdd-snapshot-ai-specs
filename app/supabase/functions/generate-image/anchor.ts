import type { ModelProfile } from "./types.ts";
import { SKIN_TONE_DESCRIPTORS, getFormatSpec } from "./config.ts";
import { buildAspectRatioDirective } from "./prompts.ts";

export function buildAnchorPrompt(modelProfile: ModelProfile, aspectRatio: string): string {
  const formatSpec = getFormatSpec(aspectRatio);

  return `
[MASTER IDENTITY ANCHOR]
This image establishes the model identity for the entire batch. Every subsequent image MUST show THIS EXACT SAME PERSON.

MODEL IDENTITY: ${modelProfile.fullDescription}
FACE: ${modelProfile.faceShape}, ${modelProfile.eyeColor} eyes
HAIR: ${modelProfile.hairColor} ${modelProfile.hairStyle}
${modelProfile.gender === "male" && modelProfile.facialHair ? `FACIAL HAIR: ${modelProfile.facialHair}\n` : ""}BODY: ${modelProfile.build}, ${modelProfile.height}
SKIN (AUTHORITATIVE REFERENCE): ${SKIN_TONE_DESCRIPTORS[modelProfile.skinTone] || "medium"} — all subsequent images MUST match this exact skin tone with zero deviation.
AGE: ${modelProfile.age} years

STUDIO: Seamless white/light gray cyclorama, 3-point lighting, neutral front pose facing camera, full body head-to-toe with 10% headroom, sharp well-lit face, natural confident expression.

${buildAspectRatioDirective(formatSpec)}

OUTPUT: Single image, one person, full head visible with headroom, no borders/collage/grid, commercial photography quality.
`;
}
