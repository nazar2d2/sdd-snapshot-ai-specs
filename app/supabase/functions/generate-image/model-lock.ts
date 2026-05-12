import type { ModelProfile } from "./types.ts";
import { ETHNICITY_DESCRIPTORS, SKIN_TONE_DESCRIPTORS } from "./config.ts";

const HAIR_STYLES_MALE = [
  "short cropped hair",
  "medium length wavy hair",
  "short textured hair",
  "classic side-parted hair",
  "short curly hair",
];
const HAIR_STYLES_FEMALE = [
  "long straight hair",
  "shoulder-length wavy hair",
  "long layered hair",
  "medium bob cut",
  "long curly hair",
];
const HAIR_COLORS = ["black", "dark brown", "brown", "light brown", "auburn"];
const EYE_COLORS = ["dark brown", "brown", "hazel", "light brown", "green-brown"];
const FACE_SHAPES_MALE = ["oval face", "square jaw", "strong jawline", "angular features", "defined cheekbones"];
const FACE_SHAPES_FEMALE = [
  "oval face",
  "heart-shaped face",
  "soft features",
  "high cheekbones",
  "elegant bone structure",
];
const BUILDS_MALE = [
  "athletic build",
  "lean muscular build",
  "fit physique",
  "toned athletic frame",
  "well-proportioned athletic body",
];
const BUILDS_FEMALE = ["slim athletic build", "toned physique", "slender frame", "fit build", "graceful proportions"];
const HEIGHTS_MALE = ["180cm", "182cm", "178cm", "184cm", "181cm"];
const HEIGHTS_FEMALE = ["172cm", "170cm", "175cm", "168cm", "173cm"];
const FACIAL_HAIR_OPTIONS = ["clean-shaven", "short stubble", "short boxed beard", "light stubble", "trimmed goatee"];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function pickFromSeed<T>(arr: T[], seed: string, index: number): T {
  const hash = hashString(`${seed}-${index}`);
  return arr[hash % arr.length];
}

function createModelKey(gender: "male" | "female", ethnicity: string, skinTone: string, age: number): string {
  return `model-${gender}-${ethnicity}-${skinTone}-${age}`;
}

export function createModelProfile(
  gender: "male" | "female",
  ethnicity: string,
  skinTone: string,
  age: number,
  jobId: string,
): ModelProfile {
  const modelKey = createModelKey(gender, ethnicity, skinTone, age);
  const jobSeed = `job-${jobId}-seed`;

  const hairStyles = gender === "male" ? HAIR_STYLES_MALE : HAIR_STYLES_FEMALE;
  const faceShapes = gender === "male" ? FACE_SHAPES_MALE : FACE_SHAPES_FEMALE;
  const builds = gender === "male" ? BUILDS_MALE : BUILDS_FEMALE;
  const heights = gender === "male" ? HEIGHTS_MALE : HEIGHTS_FEMALE;

  const hairStyle = pickFromSeed(hairStyles, modelKey, 0);
  const hairColor = pickFromSeed(HAIR_COLORS, modelKey, 1);
  const eyeColor = pickFromSeed(EYE_COLORS, modelKey, 2);
  const faceShape = pickFromSeed(faceShapes, modelKey, 3);
  const build = pickFromSeed(builds, modelKey, 4);
  const height = pickFromSeed(heights, modelKey, 5);
  const facialHair = gender === "male" ? pickFromSeed(FACIAL_HAIR_OPTIONS, modelKey, 6) : "";

  const lockString = `${modelKey}-${jobId.slice(0, 8)}`;

  const ethnicityDesc = ETHNICITY_DESCRIPTORS[ethnicity]?.[gender] || ETHNICITY_DESCRIPTORS["caucasian"][gender];
  const skinToneDesc = SKIN_TONE_DESCRIPTORS[skinTone] || SKIN_TONE_DESCRIPTORS["medium"];

  const shortDescription = `${age}-year-old ${gender === "male" ? "man" : "woman"}, ${ethnicityDesc}, ${skinToneDesc}, ${hairColor} ${hairStyle}, ${eyeColor} eyes${gender === "male" && facialHair ? `, ${facialHair}` : ""}, ${build}, ${height}`;

  const fullDescription =
    gender === "male"
      ? `${age}-year-old handsome male model, ${ethnicityDesc}, ${skinToneDesc}, ${hairColor} ${hairStyle}, ${eyeColor} eyes, ${faceShape}, ${facialHair}, ${build}, ${height}, well-groomed, natural confident expression`
      : `${age}-year-old gorgeous female model, ${ethnicityDesc}, ${skinToneDesc}, ${hairColor} ${hairStyle}, ${eyeColor} eyes, ${faceShape}, ${build}, ${height}, flawless natural skin, elegant features`;

  return {
    modelKey,
    lockString,
    gender,
    ethnicity,
    skinTone,
    age,
    hairStyle,
    hairColor,
    eyeColor,
    faceShape,
    build,
    height,
    facialHair,
    shortDescription,
    fullDescription,
    jobSeed,
    jobId,
  };
}

export function deriveTaskSeed(modelKey: string, viewKey: string, variantKey: string): string {
  return `${modelKey}-${viewKey}-${variantKey}`;
}
