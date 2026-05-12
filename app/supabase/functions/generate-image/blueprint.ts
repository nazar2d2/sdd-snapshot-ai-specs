import type { ProductBlueprint, ProductType } from "./types.ts";

export function createDefaultBlueprint(productType: ProductType): ProductBlueprint {
  return {
    productType,
    garmentClass: productType === "shoes" ? "shoe" : productType,
    silhouette: "regular",
    length: "regular",
    fit: "regular",
    necklineCollar: "none",
    closureType: "pullover",
    zipperLength: "none",
    sleeveLength: "none",
    fabric: "unknown",
    texture: "smooth",
    pocketCount: 0,
    pocketPlacement: "none",
    knitWeavePattern: "plain",
    patternType: "solid",
    logoPatchPlacement: "none",
    originalColor: "unknown",
    uniqueDetails: "none",
    imperfections: "none",
    printsGraphics: "none",
    descriptorString: `${productType} garment`,
  };
}

export async function extractProductBlueprint(
  productImageUrl: string,
  productType: ProductType,
  waitForRateLimit: () => Promise<void>,
): Promise<ProductBlueprint> {
  await waitForRateLimit();

  const defaultBlueprint = createDefaultBlueprint(productType);

  try {
    const isShoe = productType === "shoes";
    const extractionPrompt = isShoe
      ? `Analyze this SHOE product image and extract its EXACT design blueprint.

    CRITICAL: Identify the shoe's materials, construction, and color precisely. Do NOT default to "black" — identify the exact shade (navy, burgundy, tan, chocolate, etc.).

    Return ONLY a JSON object (no markdown) with these EXACT fields:
    {
      "garmentClass": "specific type like oxford, derby, loafer, sneaker, boot, brogue, monk-strap, chelsea boot, moccasin",
      "silhouette": "low-top/mid-top/high-top/ankle/knee-high",
      "length": "regular",
      "fit": "narrow/regular/wide",
      "necklineCollar": "none",
      "closureType": "lace-up/slip-on/buckle/strap/zipper/elastic/none",
      "zipperLength": "none",
      "sleeveLength": "none",
      "fabric": "leather/suede/canvas/nubuck/patent-leather/synthetic/mesh/knit/rubber/cordovan",
      "texture": "smooth/pebbled/grain/brushed/polished/matte/glossy/distressed/embossed/perforated/woven",
      "pocketCount": 0,
      "pocketPlacement": "none",
      "knitWeavePattern": "plain",
      "patternType": "solid/two-tone/tri-color/perforated/brogue-punched/contrast-panel",
      "visualAnchor": "A PRECISE description of the shoe's visual character. Example: 'NAVY BLUE PEBBLED LEATHER UPPER WITH SMOOTH LEATHER TOE CAP, TWO-TONE CONSTRUCTION' or 'WHITE LEATHER SNEAKER WITH PERFORATED SIDE PANELS'. Be SPECIFIC about materials and colors of each panel.",
      "logoPatchPlacement": "none/tongue/heel/side/sole",
      "originalColor": "the EXACT main color — be specific: 'navy blue' not 'blue', 'burgundy' not 'red', 'chocolate brown' not 'brown'",
      "upperMaterial": "describe the primary upper material precisely (e.g., 'pebbled leather', 'smooth calfskin', 'brushed suede')",
      "toeCapStyle": "plain/cap-toe/wingtip/moc-toe/round/pointed/square/none",
      "soleColor": "the color of the sole/outsole",
      "soleType": "leather/rubber/crepe/commando/wedge/flat",
      "panelConstruction": "describe if the shoe has distinct panels with different materials or colors (e.g., 'smooth toe cap with pebbled body', 'contrast heel counter'). If uniform, write 'uniform'",
      "lacingStyle": "open/closed/derby/oxford/speed-hooks/none",
      "uniqueDetails": "DESCRIBE ANY: broguing, medallion, pull-tab, contrast stitching, welt type. if none, 'none'",
      "imperfections": "DESCRIBE ANY: patina, scuffs, natural creasing, color variation. if none, 'none'",
      "printsGraphics": "DESCRIBE ANY: brand logos, embossed marks, printed designs. if none, 'none'"
    }

    Be PRECISE about colors and materials. Navy is NOT black. Pebbled is NOT smooth.`
      : `Analyze this ${productType} product image and extract its EXACT design blueprint.
    
    CRITICAL: YOU MUST IDENTIFY PATTERNS. If the item is plaid, check, houndstooth, or striped, you MUST capture this in 'patternType' and 'visualAnchor'.
    If it is plaid/check, write "ALL-OVER PLAID PATTERN" in visualAnchor.

    Return ONLY a JSON object (no markdown) with these EXACT fields:
    {
      "garmentClass": "specific type like quarter-zip knit, crewneck sweater, button-down shirt, slim jeans, loafer, sneaker, midi dress",
      "silhouette": "fitted/regular/relaxed/oversized/slim/straight",
      "length": "cropped/regular/long/midi/maxi/ankle",
      "fit": "slim/regular/relaxed/oversized",
      "necklineCollar": "crew/v-neck/quarter-zip/polo/mock/turtle/collar/scoop/none",
      "closureType": "pullover/full-zip/quarter-zip/half-zip/button-front/snap/lace-up/slip-on/none",
      "zipperLength": "none/quarter/half/full",
      "sleeveLength": "sleeveless/cap/short/elbow/3-4/long/none",
      "fabric": "cotton/wool/silk/denim/leather/suede/polyester/linen/nylon/cashmere/fleece/chiffon/satin/tweed/corduroy/canvas/knit-blend/unknown",
      "texture": "smooth/ribbed/cable-knit/brushed/woven/distressed/quilted/embossed/fuzzy/matte/shiny/nubby/waffle-knit/bouclé/flat-knit",
      "pocketCount": number (0, 1, 2, etc.),
      "pocketPlacement": "none/chest/side/back/kangaroo/welt",
      "knitWeavePattern": "rib knit/cable knit/plain weave/jersey/denim/leather/suede/mesh/fleece/waffle/chunky knit",
      "patternType": "solid/check/houndstooth/stripe/floral/plaid/geometric/print/gingham/tartan",
      "visualAnchor": "A LOUD, REPETITIVE phrase describing the pattern/texture. Example: 'ALL-OVER PLAID CHECK PATTERN. RED AND BLACK PLAID.' or 'HEAVY CABLE KNIT TEXTURE'. If solid, just 'Solid color'.",
      "logoPatchPlacement": "none/chest-left/chest-center/back/sleeve",
      "originalColor": "the main color of the product",
      "uniqueDetails": "DESCRIBE ANY: paint splatters, rips, holes, raw hems, distressing, unique stitching. if none, 'none'",
      "imperfections": "DESCRIBE ANY: organic fading, stone wash effect, whiskers, worn spots. if none, 'none'",
      "printsGraphics": "DESCRIBE ANY: text, logos, screen prints, embroidery. if none, 'none'"
    }

    Be PRECISE. If pattern exists, SHOUT it in visualAnchor.`;

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      console.log("[PRODUCTLOCK] No GOOGLE_AI_API_KEY configured, using defaults");
      return defaultBlueprint;
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;

    // Parse product image if it's a data URL
    const imageParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: extractionPrompt },
    ];
    const dataUrlMatch = productImageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/s);
    if (dataUrlMatch) {
      imageParts.push({ inlineData: { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] } });
    } else {
      // For HTTP URLs, fetch and convert
      try {
        const imgResp = await fetch(productImageUrl);
        if (imgResp.ok) {
          const buffer = await imgResp.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.slice(i, i + 8192));
          }
          const base64 = btoa(binary);
          const contentType = imgResp.headers.get("content-type") || "image/png";
          imageParts.push({ inlineData: { mimeType: contentType, data: base64 } });
        }
      } catch (e) {
        console.warn("[PRODUCTLOCK] Failed to fetch product image URL:", e);
      }
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [{ role: "user", parts: imageParts }],
      }),
    });

    if (!response.ok) {
      console.log(`[PRODUCTLOCK] Google AI error ${response.status}, using defaults`);
      return defaultBlueprint;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      console.log("[PRODUCTLOCK] Empty response from Lovable AI, using defaults");
      return defaultBlueprint;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("[PRODUCTLOCK] No JSON in response, using defaults");
      return defaultBlueprint;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const blueprint: ProductBlueprint = {
      productType,
      garmentClass: parsed.garmentClass || defaultBlueprint.garmentClass,
      silhouette: parsed.silhouette || defaultBlueprint.silhouette,
      length: parsed.length || defaultBlueprint.length,
      fit: parsed.fit || defaultBlueprint.fit,
      necklineCollar: parsed.necklineCollar || defaultBlueprint.necklineCollar,
      closureType: parsed.closureType || defaultBlueprint.closureType,
      zipperLength: parsed.zipperLength || defaultBlueprint.zipperLength,
      sleeveLength: parsed.sleeveLength || defaultBlueprint.sleeveLength,
      fabric: parsed.fabric || defaultBlueprint.fabric,
      texture: parsed.texture || defaultBlueprint.texture,
      pocketCount: typeof parsed.pocketCount === "number" ? parsed.pocketCount : defaultBlueprint.pocketCount,
      pocketPlacement: parsed.pocketPlacement || defaultBlueprint.pocketPlacement,
      knitWeavePattern: parsed.knitWeavePattern || defaultBlueprint.knitWeavePattern,
      patternType: parsed.patternType || defaultBlueprint.patternType,
      logoPatchPlacement: parsed.logoPatchPlacement || defaultBlueprint.logoPatchPlacement,
      originalColor: parsed.originalColor || defaultBlueprint.originalColor,
      uniqueDetails: parsed.uniqueDetails !== "none" ? parsed.uniqueDetails : "none",
      imperfections: parsed.imperfections !== "none" ? parsed.imperfections : "none",
      printsGraphics: parsed.printsGraphics !== "none" ? parsed.printsGraphics : "none",
      descriptorString: "",
      // Shoe-specific fields
      ...(isShoe && {
        upperMaterial: parsed.upperMaterial || undefined,
        toeCapStyle: parsed.toeCapStyle || undefined,
        soleColor: parsed.soleColor || undefined,
        soleType: parsed.soleType || undefined,
        panelConstruction: parsed.panelConstruction || undefined,
        lacingStyle: parsed.lacingStyle || undefined,
      }),
    };

    blueprint.descriptorString = buildBlueprintDescriptor(blueprint, parsed.visualAnchor);

    console.log(`[PRODUCTLOCK] Blueprint: ${blueprint.descriptorString}`);
    return blueprint;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[PRODUCTLOCK] Extraction error:", msg);
    return defaultBlueprint;
  }
}

export function buildBlueprintDescriptor(bp: ProductBlueprint, visualAnchor?: string): string {
  const parts: string[] = [];

  if (visualAnchor && visualAnchor !== "none") {
    parts.push(visualAnchor.toUpperCase());
  }

  if (bp.patternType !== "solid" && bp.patternType !== "none") {
    parts.push(`${bp.patternType.toUpperCase()} PATTERN`);
  }

  parts.push(bp.garmentClass);
  if (bp.fabric !== "unknown") parts.push(`${bp.fabric} fabric`);
  if (bp.texture !== "smooth") parts.push(`${bp.texture} texture`);
  if (bp.knitWeavePattern !== "plain") parts.push(bp.knitWeavePattern);

  // Shoe-specific descriptor additions
  if (bp.productType === "shoes") {
    if (bp.upperMaterial) parts.push(`upper: ${bp.upperMaterial}`);
    if (bp.toeCapStyle && bp.toeCapStyle !== "none") parts.push(`${bp.toeCapStyle} toe`);
    if (bp.soleColor) parts.push(`${bp.soleColor} sole`);
    if (bp.soleType) parts.push(`${bp.soleType} sole type`);
    if (bp.panelConstruction && bp.panelConstruction !== "uniform") parts.push(`PANELS: ${bp.panelConstruction}`);
    if (bp.lacingStyle && bp.lacingStyle !== "none") parts.push(`${bp.lacingStyle} lacing`);
    if (bp.closureType !== "none") parts.push(bp.closureType);
  } else {
    if (bp.necklineCollar !== "none") parts.push(`with ${bp.necklineCollar}`);
    if (bp.closureType !== "pullover" && bp.closureType !== "none") parts.push(bp.closureType);
    if (bp.zipperLength !== "none") parts.push(`${bp.zipperLength} zipper`);
    if (bp.sleeveLength !== "none") parts.push(`${bp.sleeveLength} sleeves`);
    if (bp.pocketCount > 0) parts.push(`${bp.pocketCount} ${bp.pocketPlacement} pocket${bp.pocketCount > 1 ? "s" : ""}`);
  }

  parts.push(`${bp.fit} fit`);
  if (bp.length !== "regular") parts.push(`${bp.length} length`);
  if (bp.logoPatchPlacement !== "none") parts.push(`logo at ${bp.logoPatchPlacement}`);

  if (bp.uniqueDetails && bp.uniqueDetails !== "none") parts.push(`DETAILS: ${bp.uniqueDetails}`);
  if (bp.imperfections && bp.imperfections !== "none") parts.push(`IMPERFECTIONS: ${bp.imperfections}`);
  if (bp.printsGraphics && bp.printsGraphics !== "none") parts.push(`GRAPHICS: ${bp.printsGraphics}`);

  return parts.join(", ");
}
