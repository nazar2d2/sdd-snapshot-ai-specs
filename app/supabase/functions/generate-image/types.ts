export type ProductType = "top" | "bottom" | "shoes" | "outfit";
export type ViewPose = "full-body" | "product-focused";

export interface ProductBlueprint {
  productType: ProductType;
  garmentClass: string;
  silhouette: string;
  length: string;
  fit: string;
  necklineCollar: string;
  closureType: string;
  zipperLength: string;
  sleeveLength: string;
  fabric: string;
  texture: string;
  pocketCount: number;
  pocketPlacement: string;
  knitWeavePattern: string;
  patternType: string;
  logoPatchPlacement: string;
  originalColor: string;
  uniqueDetails: string;
  imperfections: string;
  printsGraphics: string;
  descriptorString: string;
  // Shoe-specific fields
  upperMaterial?: string;
  toeCapStyle?: string;
  soleColor?: string;
  soleType?: string;
  panelConstruction?: string;
  lacingStyle?: string;
}

export interface ProductLock {
  blueprint: ProductBlueprint;
  productRefUrl: string;
}

export interface ModelProfile {
  modelKey: string;
  lockString: string;
  gender: "male" | "female";
  ethnicity: string;
  skinTone: string;
  age: number;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  faceShape: string;
  build: string;
  height: string;
  facialHair: string;
  shortDescription: string;
  fullDescription: string;
  jobSeed: string;
  jobId: string;
}

export interface IdentityAnchor {
  anchorUrl: string;
  modelProfile: ModelProfile;
}

export interface FormatSpec {
  aspect: string;
  width: number;
  height: number;
  tolerance: number;
  promptDirective: string;
  compositionHint: string;
}

export interface GarmentMasks {
  topMask: boolean;
  bottomMask: boolean;
  shoesMask: boolean;
  dressMask: boolean;
  accessoryMask: boolean;
}

export interface NormalizedView {
  id: string;
  name: string;
  pose?: string;
  customPrompt?: string;
}

export interface GateLogEntry {
  taskId: string;
  gateName: string;
  passed: boolean;
  failReason?: string;
  score?: number;
  retryCount: number;
  latencyMs: number;
}

export interface MasterGateResult {
  passed: boolean;
  faceResult: { passed: boolean; reason?: string };
  layoutResult: { passed: boolean; reason?: string };
  qualityResult: { passed: boolean; reason?: string; score: number };
  productResult: { passed: boolean; reason?: string; score: number };
  failReason?: string;
}

export interface FormatCheckResult {
  passed: boolean;
  reason?: string;
  actualAspect?: number;
  targetAspect?: number;
}
