import type { FormatSpec, IdentityAnchor, ModelProfile, ProductBlueprint, ProductType, ViewPose } from "./types.ts";
import {
  ABSOLUTE_RULES,
  NEGATIVE_PROMPT,
  SKIN_TONE_DESCRIPTORS,
  getFormatSpec,
  getFrozenGarments,
} from "./config.ts";

// ── Prompt Budget ────────────────────────────────────────────────────────────

/** Collapse redundant whitespace */
function compactWhitespace(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

/** Simplify prompt — Gemini Flash has generous token limits, only compact whitespace */
export function enforcePromptBudget(prompt: string): string {
  return compactWhitespace(prompt);
}

// ── Custom Prompt Interpolation ───────────────────────────────────────────────
function interpolateCustomPrompt(
  prompt: string,
  vars: Record<string, string>,
): string {
  let result = prompt;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`\${${key}}`, value);
  }
  // Strip generic clothing safety that conflicts with gender-specific framing rules
  result = result.replace(
    /always fully clothed with complementary neutral garments/gi,
    "always fully clothed with gender-appropriate complementary garments",
  );
  return result;
}

// ── Season Descriptors ───────────────────────────────────────────────────────
export const SEASON_DESCRIPTORS: Record<string, string> = {
  summer: "bright warm sunlight, lush green foliage, clear blue sky, warm atmosphere",
  winter: "cool crisp light, bare trees or light snow, overcast sky, cold weather",
  fall: "golden hour warmth, autumn leaves orange/red/yellow, soft warm light",
  spring: "fresh soft light, blooming flowers, fresh greenery, gentle pastels",
};

// ── Aspect Ratio Directive ───────────────────────────────────────────────────
export function buildAspectRatioDirective(formatSpec: FormatSpec): string {
  return `
[FORMAT LOCK - ${formatSpec.aspect}]
${formatSpec.promptDirective}
Target: ${formatSpec.width}x${formatSpec.height} pixels. ${formatSpec.compositionHint}.
Full-bleed edge-to-edge, no letterboxing, no borders, no padding. Extend background to fill format if needed.`;
}

// ── Studio Lighting ──────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getColorName(hex: string): string {
  const h = hex.toUpperCase();
  if (h === "#FFFFFF" || h === "#FAFAFA") return "pure white";
  if (h === "#000000") return "pure black";

  const { r, g, b } = hexToRgb(hex);
  const { h: hue, s, l } = rgbToHsl(r, g, b);

  // Low saturation → grayscale
  if (s < 0.08) {
    if (l > 0.93) return "off-white";
    if (l > 0.8) return "light gray";
    if (l > 0.65) return "soft gray";
    if (l > 0.5) return "medium gray";
    if (l > 0.3) return "dark gray";
    if (l > 0.15) return "charcoal";
    return "near-black";
  }

  // Chromatic — name by hue
  let hueName: string;
  if (hue < 15 || hue >= 345) hueName = "red";
  else if (hue < 40) hueName = "orange";
  else if (hue < 65) hueName = "yellow";
  else if (hue < 160) hueName = "green";
  else if (hue < 200) hueName = "cyan";
  else if (hue < 260) hueName = "blue";
  else if (hue < 290) hueName = "purple";
  else if (hue < 330) hueName = "pink";
  else hueName = "magenta";

  // Lightness prefix
  let prefix = "";
  if (l > 0.8) prefix = "light ";
  else if (l > 0.65) prefix = "soft ";
  else if (l < 0.2) prefix = "very dark ";
  else if (l < 0.35) prefix = "dark ";
  else if (s > 0.8) prefix = "vivid ";

  return `${prefix}${hueName} (${hex})`;
}

type BgTone = "light" | "dark" | "mid";

function classifyBgTone(hex: string): BgTone {
  const { r, g, b } = hexToRgb(hex);
  const lum = relativeLuminance(r, g, b);
  if (lum > 0.5) return "light";
  if (lum < 0.1) return "dark";
  return "mid";
}

function buildStudioLightingPrompt(backgroundColor: string, productFocused: boolean = false): string {
  const tone = classifyBgTone(backgroundColor);
  const colorName = getColorName(backgroundColor);

  // Adaptive lighting ratios based on backdrop brightness
  const lighting = tone === "light"
    ? {
        style: "high-key commercial",
        key: "large 120cm octabox with inner diffusion, 45° camera-left, 1-stop above ambient — broad even wrap",
        fill: "4×6ft white V-flat reflector camera-right, 1:2 key-to-fill ratio — open shadows, minimal contrast",
        rim: "strip softbox directly behind subject, 0.5-stop above key — subtle hair/shoulder edge separation",
        bg: `even wash from two background lights with barn doors, true ${colorName} with no hotspots or falloff`,
        shadow: "delicate contact shadow (10-15% opacity, soft gaussian edges) plus faint secondary fill shadow opposite side",
        atmosphere: "clean high-key air, no visible haze, bright airy feel",
      }
    : tone === "dark"
    ? {
        style: "dramatic editorial",
        key: "medium 90cm beauty dish with grid, 30° camera-left, concentrated directional light — sculpted highlights",
        fill: "negative fill (black V-flat) camera-right — deep controlled shadows, 1:4 key-to-fill ratio",
        rim: "hard-edged strip light behind subject at 1-stop above key — strong luminous edge separation from dark backdrop",
        bg: `single background light with grid spot, true ${colorName} with controlled vignette darker at edges`,
        shadow: "defined contact shadow (25-35% opacity, medium-soft edges) with visible directional fall-off",
        atmosphere: "subtle studio haze catching rim light, adding depth and three-dimensionality",
      }
    : {
        style: "balanced commercial",
        key: "large 120cm softbox, 45° camera-left, neutral balanced intensity — even skin rendering",
        fill: "3×4ft diffused panel camera-right, 1:3 key-to-fill ratio — controlled open shadows",
        rim: "strip softbox above-behind subject, 0.5-stop above key — clean edge definition",
        bg: `even background illumination, true ${colorName}, subtle tonal gradient slightly darker at floor edges`,
        shadow: "natural contact shadow (18-22% opacity, soft edges) with subtle secondary fill shadow",
        atmosphere: "faint atmospheric haze for depth separation between subject and backdrop",
      };

  const groundingSection = productFocused
    ? `GROUNDING: ${lighting.shadow}. Natural weight distribution visible where body meets frame.`
    : `GROUNDING: Model feet planted on studio floor with weight and contact. ${lighting.shadow}. Feet interact with floor surface realistically — visible contact points, natural stance pressure.`;

  return `
[PROFESSIONAL STUDIO — ${lighting.style.toUpperCase()}]

CYCLORAMA: Seamless ${colorName} matte paper backdrop (infinity cove). Curved floor-to-wall sweep with NO visible seam. ${productFocused ? "" : "Floor surface is matte paper — subtle tonal gradient darker toward edges for depth. "}Physically real studio with perspective recession — NOT a flat color fill.

${groundingSection}

LIGHTING (professional 3-point):
- KEY: ${lighting.key}
- FILL: ${lighting.fill}
- RIM/HAIR: ${lighting.rim}
- BACKGROUND: ${lighting.bg}
${lighting.atmosphere}.

MATERIAL RENDERING: Subsurface scattering on skin (warm translucency at ear tips, nose, fingers). Fabric-accurate specular — matte diffuse on cotton/knit, soft sheen on silk/satin, crisp highlights on leather/vinyl. Catchlights in eyes matching key light shape and position. Skin pores and texture visible at close range.

COLOR ISOLATION: Backdrop color must NOT spill onto garment or skin — no color cast from ${colorName} background. Garment colors remain true-to-product. White balance locked at 5600K daylight.

GARMENT COLOR FIDELITY: The garment color must be a PIXEL-PERFECT match to the uploaded product reference image. Extract the exact hue/saturation/lightness from the reference and reproduce it identically. Studio lighting must NOT warm, cool, or shift the garment hue. No creative interpretation of the color — copy it exactly. Maintain identical color output regardless of which view (front, back, side) is being rendered.

CAMERA: Canon EOS R5, 85mm f/4 portrait lens, 5600K white balance, commercial e-commerce standard. Sharp focus on garment with natural depth-of-field falloff on backdrop.

EQUIPMENT VISIBILITY: All lighting equipment, softboxes, reflectors, V-flats, stands, and rigging MUST be completely invisible. Only their EFFECT on the subject is visible — never the equipment itself. Clean, uncluttered studio environment.`;
}

// ── City Landmark Descriptors ─────────────────────────────────────────────────
const CITY_LANDMARKS: Record<string, string> = {
  "Abu Dhabi": "Sheikh Zayed Grand Mosque visible in background, modern glass skyscrapers, palm-lined Corniche boulevard",
  "Amsterdam": "narrow canal houses with gabled facades, arched bridges over canals, bicycles parked along railings",
  "Athens": "Acropolis and Parthenon visible on hilltop in background, neoclassical buildings, whitewashed walls",
  "Bangkok": "ornate golden temple spires (Wat Arun style), tuk-tuks, tropical foliage, vibrant street signage in Thai script",
  "Barcelona": "Gaudí-style mosaic facades, La Sagrada Família spires in background, Mediterranean palm trees, colorful tiled buildings",
  "Beijing": "traditional hutong alleyways with red lanterns, Forbidden City-style architecture in distance, Chinese signage",
  "Berlin": "Brandenburg Gate visible in distance, Bauhaus-style buildings, graffiti-covered concrete walls, wide boulevards",
  "Bogotá": "colorful colonial La Candelaria buildings, Monserrate hill visible in background, Andean mountain backdrop",
  "Brussels": "ornate Art Nouveau facades, Grand Place-style gilded buildings, cobblestone squares",
  "Budapest": "Danube riverbank, Hungarian Parliament Building in background, ornate Austro-Hungarian architecture, chain bridge",
  "Buenos Aires": "wide Avenida-style boulevard, ornate Beaux-Arts buildings, colorful La Boca-style facades",
  "Cairo": "Great Pyramids of Giza visible in hazy background, minarets, bustling market streets, sandstone buildings",
  "Copenhagen": "colorful Nyhavn-style townhouses along canal, bicycle lanes, Scandinavian minimalist architecture",
  "Doha": "futuristic glass skyscrapers, Museum of Islamic Art-style architecture, desert-modern cityscape",
  "Dubai": "Burj Khalifa towering in skyline, ultra-modern glass towers, palm-lined boulevards, luxury storefronts",
  "Dublin": "Georgian red-brick townhouses with colorful doors, cobblestone streets, traditional pub facades",
  "Helsinki": "Art Nouveau and Nordic modernist buildings, Helsinki Cathedral dome in background, harbor views",
  "Istanbul": "Hagia Sophia or Blue Mosque domes and minarets in background, Grand Bazaar-style archways, Ottoman architecture",
  "Jakarta": "modern skyscrapers mixed with traditional Betawi architecture, tropical vegetation, bustling market streets",
  "Jerusalem": "ancient limestone walls, Old City architecture, domes and arches, warm golden stone buildings",
  "Kuala Lumpur": "Petronas Twin Towers visible in skyline, modern Islamic architecture, tropical greenery, bustling street markets",
  "Kyiv": "golden-domed Orthodox churches, Khreschatyk boulevard, European-style buildings with ornate facades",
  "Lima": "colonial Spanish balconies, Plaza Mayor-style architecture, terracotta and mustard-colored buildings",
  "Lisbon": "colorful azulejo-tiled facades, vintage yellow trams, hilly cobblestone streets, pastel buildings",
  "London": "Georgian red-brick townhouses, black cab in background, Big Ben or Tower Bridge visible in distance, red telephone box",
  "Madrid": "Gran Vía-style ornate buildings, terracotta rooftops, Royal Palace architecture in background, wide boulevards",
  "Manila": "Spanish colonial Intramuros-style architecture mixed with modern towers, jeepneys, tropical palms",
  "Marbella": "whitewashed Andalusian buildings, bougainvillea cascading on walls, Mediterranean terracotta rooftops, palm-lined promenade",
  "Marbella near the Beach": "whitewashed buildings overlooking Mediterranean Sea, golden sand visible, palm trees, luxury beach club atmosphere",
  "Marbella on the Beach": "golden Mediterranean beach, turquoise water, luxury sun loungers, Marbella coastline in background",
  "Mexico City": "Palacio de Bellas Artes-style Art Nouveau dome, colorful colonial buildings, Zócalo-style grand plaza",
  "Monaco": "Monte Carlo Casino-style Belle Époque architecture, luxury yachts in harbor, Mediterranean cliff-side buildings",
  "Moscow": "Saint Basil's Cathedral colorful onion domes, Red Square-style architecture, Stalinist neoclassical buildings",
  "Nairobi": "modern skyline with Kenyatta International Centre, acacia trees, vibrant market streets",
  "New Delhi": "Mughal-style red sandstone arches, India Gate visible in distance, ornate Rajasthani-style architecture",
  "Nicosia": "Venetian walls, limestone buildings, Mediterranean architecture with shuttered windows",
  "Oslo": "Nordic wooden architecture, Oslo Opera House-style angular modern buildings, fjord views, clean Scandinavian design",
  "Ottawa": "Gothic Revival Parliament buildings, Rideau Canal, Victorian-era stone architecture, maple trees",
  "Paris": "Haussmann-style limestone buildings, wrought-iron balconies, Eiffel Tower visible in background, charming café terraces with rattan chairs, Art Nouveau metro entrance",
  "Prague": "Gothic spires of St. Vitus Cathedral, Charles Bridge-style stone arches, Baroque pastel buildings, cobblestone streets",
  "Reykjavik": "colorful corrugated-iron houses, Hallgrímskirkja church spire in background, volcanic landscape hints",
  "Riga": "Art Nouveau facades with ornate detailing, medieval Old Town spires, cobblestone streets",
  "Riyadh": "Kingdom Tower with its distinctive sky bridge, modern glass towers, desert-modern architecture",
  "Rome": "Colosseum or ancient Roman ruins in background, terracotta buildings, cobblestone piazza, Renaissance fountains, ivy-covered walls",
  "San José": "colonial Spanish-style buildings, lush tropical vegetation, Central Valley mountain backdrop",
  "Santiago": "Andes mountains visible in background, neoclassical Plaza de Armas-style buildings, modern glass towers",
  "São Tomé": "colorful Portuguese colonial architecture, tropical vegetation, Atlantic Ocean views",
  "Seoul": "Gyeongbokgung Palace-style traditional Korean architecture, Namsan Tower in background, neon-lit modern streets with Hangul signage",
  "Singapore": "Marina Bay Sands visible in skyline, Shophouse-style colorful facades, lush tropical gardens, futuristic Supertree structures",
  "Stockholm": "Gamla Stan medieval buildings in warm ochre/terracotta, cobblestone alleys, Stockholm City Hall tower in distance, waterfront views",
  "Taipei": "Taipei 101 tower visible in skyline, traditional temple architecture, bustling night market streets with Chinese signage",
  "Tallinn": "medieval Old Town towers and walls, Gothic spires, cobblestone streets, pastel Hanseatic buildings",
  "Tehran": "Alborz mountain range in background, Azadi Tower-style modern monument, Persian-style architecture with ornate tilework",
  "Tokyo": "neon signage in Japanese kanji/katakana, Shibuya-style crossing, narrow streets with vending machines, Tokyo Tower or Skytree in distance",
  "Vienna": "Baroque imperial palaces, ornate Ringstraße-style buildings, St. Stephen's Cathedral spire, grand coffee house facades",
  "Vilnius": "Baroque Old Town churches, Gediminas Tower on hilltop, cobblestone streets, Renaissance architecture",
  "Warsaw": "Old Town reconstructed colorful facades, Palace of Culture and Science-style tower, wide boulevards",
  "Washington D.C.": "neoclassical government buildings, Capitol dome or Washington Monument in distance, wide tree-lined National Mall",
  "Wellington": "colorful wooden Victorian houses on hillside, cable car, harbor views, New Zealand bush-covered hills",
  "Zagreb": "Austro-Hungarian architecture, Zagreb Cathedral spires, colorful Upper Town rooftops, cobblestone streets",
  // ── Missing capitals (alphabetical) ────────────────────────────────────────
  "Accra": "colorful market stalls, Independence Arch, tropical trees, vibrant Ghanaian kente-cloth banners",
  "Addis Ababa": "modern African Union headquarters, Meskel Square, Ethiopian Orthodox churches with ornate crosses, eucalyptus-lined streets",
  "Algiers": "French colonial Haussmann-style buildings mixed with Casbah whitewashed walls, Mediterranean Sea backdrop, mosaic tilework",
  "Amman": "ancient Roman amphitheater, Citadel hilltop ruins, sand-colored limestone buildings cascading down hills, Jordanian arches",
  "Ankara": "Atakule Tower in skyline, Anıtkabir mausoleum-style monumental architecture, wide Turkish boulevards",
  "Antananarivo": "terraced hillside houses in warm ochre and brick, Rova palace on hilltop, jacaranda-lined avenues, Malagasy architecture",
  "Ashgabat": "white marble government buildings, golden domes, Neutrality Arch-style monument, wide empty boulevards",
  "Asmara": "Art Deco Italian colonial buildings, Fiat Tagliero futuristic gas station, pastel-painted modernist facades",
  "Astana": "Bayterek Tower, futuristic glass and steel buildings, Khan Shatyr tent-shaped structure, Central Asian steppe backdrop",
  "Asunción": "Palacio de los López, colonial-era pastel buildings, subtropical palm trees, Río Paraguay waterfront",
  "Baghdad": "Al-Shaheed Monument, Tigris River waterfront, Islamic arched facades, palm-lined boulevards, golden mosque domes",
  "Baku": "Flame Towers glowing in skyline, medieval Old City walls, Heydar Aliyev Center-style fluid white architecture, Caspian Sea views",
  "Bamako": "Niger River waterfront, Bamako Grand Mosque, dusty ochre buildings, West African market stalls with colorful fabrics",
  "Bangui": "Ubangi River waterfront, French colonial-era buildings, tropical vegetation, Central African red-earth roads",
  "Banjul": "Arch 22 monument, colorful West African market, Atlantic Ocean views, colonial-era Gambian buildings",
  "Basseterre": "colorful Caribbean colonial buildings, Berkeley Memorial Clock Tower, palm-fringed waterfront, volcanic hills backdrop",
  "Beirut": "Raouché Pigeon Rocks offshore, French Mandate-era balconied buildings, modern towers, Mediterranean waterfront",
  "Belgrade": "Kalemegdan Fortress, confluence of Danube and Sava rivers, Socialist-era brutalist mixed with Austro-Hungarian architecture",
  "Belmopan": "lush Central American jungle surrounding modern government buildings, Mayan-influenced architecture, tropical palms",
  "Bern": "medieval arcaded walkways (Lauben), Zytglogge clock tower, Aare River turquoise waters, red-sandstone Old Town buildings",
  "Bishkek": "Soviet-era apartment blocks, Ala-Too Square with Manas statue, snow-capped Tian Shan mountains in background",
  "Bissau": "Portuguese colonial pastel buildings, tropical vegetation, Bissau-Guinean market stalls, red laterite streets",
  "Bratislava": "Bratislava Castle on hilltop, pastel Baroque Old Town, Danube riverfront, St. Martin's Cathedral spire",
  "Brazzaville": "Congo River waterfront, Basilique Sainte-Anne, French colonial-era buildings, tropical mango trees lining streets",
  "Brasília": "Oscar Niemeyer modernist architecture, Cathedral of Brasília hyperboloid structure, National Congress twin towers and dome, wide Eixo Monumental boulevard, cerrado landscape",
  "Bridgetown": "colorful Barbadian colonial buildings, Chamberlain Bridge, Careenage waterfront, coral-stone Parliament",
  "Bucharest": "Palace of the Parliament massive facade, Belle Époque buildings, wide Communist-era boulevards, ornate Orthodox churches",
  "Canberra": "Australian Parliament House, Lake Burley Griffin, wide eucalyptus-lined avenues, modernist government architecture",
  "Caracas": "Ávila mountain towering over city, modernist towers, colorful barrio hillside houses, tropical vegetation",
  "Castries": "colorful Caribbean wooden houses, Cathedral of the Immaculate Conception, lush Piton mountains backdrop, harbor views",
  "Chisinau": "Triumphal Arch, Nativity Cathedral, Soviet-era wide boulevards mixed with neoclassical buildings, tree-lined parks",
  "Colombo": "colonial-era British buildings, Lotus Tower in skyline, Buddhist temples with ornate stupas, Indian Ocean waterfront",
  "Conakry": "Conakry Grand Mosque minarets, bustling West African market, tropical waterfront, colorful French colonial facades",
  "Dakar": "African Renaissance Monument visible in distance, colorful Senegalese buildings, Atlantic Ocean views, vibrant market streets",
  "Damascus": "ancient Umayyad Mosque minarets, narrow Old City alleyways, ornate Islamic geometric tilework, stone arched bazaars",
  "Dhaka": "Lalbagh Fort-style Mughal architecture, rickshaws, dense tropical cityscape, Buriganga River, colorful Bengali signage",
  "Dili": "Cristo Rei statue overlooking bay, Portuguese colonial buildings, tropical palms, Timor Sea turquoise waters",
  "Djibouti": "white-washed colonial buildings, arid landscape, port cranes visible, turquoise Gulf of Tadjoura waters",
  "Dodoma": "Tanzanian government buildings, baobab trees, East African savanna landscape, warm red-earth paths",
  "Dushanbe": "Ismoili Somoni Monument, wide Soviet-era boulevards, Pamir mountain backdrop, ornate Persian-influenced facades",
  "Freetown": "colorful Krio board houses, Cotton Tree landmark, hillside tropical vegetation, Sierra Leone coastal views",
  "Gaborone": "modern African city buildings, Three Dikgosi Monument, dry savanna landscape, wide sun-baked boulevards",
  "Georgetown": "colonial wooden Demerara-style houses on stilts, St. George's Cathedral wooden spire, tropical vegetation, Guyana waterfront",
  "Guatemala City": "Palacio Nacional de la Cultura, colonial Spanish facades, volcanic mountains in background, colorful Guatemalan textiles",
  "Hanoi": "Hoàn Kiếm Lake, French colonial yellow buildings, narrow Old Quarter streets, Vietnamese signage, motorbikes",
  "Harare": "jacaranda-lined avenues in purple bloom, modern African Union-style buildings, Kopje hilltop, subtropical gardens",
  "Havana": "colorful 1950s American cars, crumbling pastel colonial facades, Malecón sea wall, Capitol Building dome, art deco details",
  "Islamabad": "Faisal Mosque modernist design, Margalla Hills green backdrop, wide planned boulevards, Pakistani Islamic architecture",
  "Kabul": "rugged Hindu Kush mountains backdrop, Darul Aman Palace, bazaar streets with Afghan textiles, traditional mud-brick walls",
  "Kampala": "Makerere University red-brick, lush green hillside city, Gaddafi National Mosque, bustling boda-boda traffic",
  "Kathmandu": "Boudhanath Stupa prayer flags, ornate Nepalese pagoda temples, Himalayan peaks in distance, carved wooden windows",
  "Khartoum": "confluence of Blue and White Nile rivers, Meroe pyramid-style architecture, arid landscape, golden mosque domes",
  "Kigali": "clean modern African city on green hills, Kigali Convention Centre dome, well-maintained boulevards, tropical vegetation",
  "Kingston": "Blue Mountains backdrop, colorful Jamaican buildings, Devon House colonial mansion, tropical palm trees, Caribbean vibes",
  "Kingstown": "colorful Caribbean hillside houses, volcanic peaks, St. Vincent harbor, tropical botanical gardens",
  "Kinshasa": "Congo River waterfront, Palais du Peuple, bustling African market, tropical vegetation, vibrant Congolese culture",
  "Kuwait City": "Kuwait Towers landmark spheres, modern glass skyline, Islamic-modern architecture, Persian Gulf waterfront",
  "La Paz": "dramatic Andean valley setting, Illimani snow-capped peak, cable cars (teleféricos), colonial churches, steep streets",
  "Libreville": "Cathédrale Sainte-Marie, lush equatorial vegetation, modern Gabonese government buildings, Atlantic Ocean waterfront",
  "Lilongwe": "Lilongwe Wildlife Centre area, wide African boulevards, lush green tropical vegetation, Lake Malawi-inspired blue accents",
  "Ljubljana": "Triple Bridge, Ljubljana Castle on hilltop, pastel Baroque facades, Ljubljanica River, dragon statue on bridge",
  "Lomé": "Independence Monument, bustling Grand Marché, colorful West African fabrics, Atlantic Ocean beach, palm-lined boulevards",
  "Luanda": "Fortaleza de São Miguel, modern Angolan towers, Atlantic bay waterfront, colonial Portuguese-era buildings",
  "Lusaka": "wide tree-lined African boulevards, Independence Monument, modern Zambian buildings, tropical msasa trees",
  "Luxembourg": "Adolphe Bridge arches, medieval fortress walls (Casemates du Bock), Grand Ducal Palace, deep Alzette valley gorge",
  "Majuro": "turquoise Pacific lagoon, palm-fringed atoll, traditional Marshallese outrigger canoes, low-rise tropical buildings",
  "Malabo": "Spanish colonial-era cathedral, tropical Bioko Island vegetation, volcanic Mount Basile backdrop, colorful market",
  "Malé": "colorful Maldivian buildings packed on island, turquoise Indian Ocean, mosques with golden domes, waterfront promenade",
  "Managua": "Antigua Catedral ruins, Lake Managua waterfront, volcanic landscape backdrop, colorful Nicaraguan colonial buildings",
  "Manama": "Bahrain World Trade Center twin towers, Al Fateh Grand Mosque, traditional souq archways, Persian Gulf waterfront",
  "Maputo": "Maputo Railway Station ornate iron architecture, wide Avenida-style boulevards, colonial Portuguese buildings, Indian Ocean views",
  "Maseru": "Basotho Hat building (traditional mokorotlo shape), Lesotho mountain backdrop, sandstone buildings, wide streets",
  "Mbabane": "Swazi traditional architecture mixed with colonial buildings, lush Ezulwini Valley, pine-forested hills",
  "Minsk": "Independence Avenue wide Soviet-era boulevard, National Library diamond-shaped building, Stalinist neoclassical buildings",
  "Mogadishu": "Mogadishu Cathedral ruins, Indian Ocean coastline, white-washed Somali buildings, ancient port architecture",
  "Monrovia": "Providence Island historical site, Liberian colonial-era buildings, Atlantic Ocean waterfront, tropical palm trees",
  "Montevideo": "Palacio Salvo Art Deco tower, Ciudad Vieja colonial buildings, Rambla waterfront promenade, Río de la Plata views",
  "Nassau": "pastel-colored colonial buildings, Queen's Staircase, Nassau Straw Market, turquoise Caribbean waters, palm-lined Bay Street",
  "Moroni": "Ancienne Mosquée du Vendredi, volcanic Mount Karthala backdrop, narrow Comorian medina streets, Indian Ocean waterfront",
  "Muscat": "Sultan Qaboos Grand Mosque, traditional Omani fort architecture, Hajar Mountains backdrop, whitewashed Arabian buildings",
  "Naypyidaw": "Uppatasanti Pagoda golden spire, wide empty ceremonial boulevards, tropical vegetation, Myanmar government buildings",
  "Niamey": "Grande Mosquée of Niamey, Niger River bridge, Sahel-style mud-brick architecture, dusty wide boulevards",
  "Nouakchott": "Saudi Mosque minarets, Saharan-edge architecture, sandy wide streets, colorful Mauritanian market tents",
  "Nuku'alofa": "Royal Palace waterfront, traditional Tongan fale structures, Pacific Ocean, coconut palm trees, coral-stone church",
  "Ouagadougou": "Grande Mosquée de Ouagadougou, wide sun-baked boulevards, Burkinabè market stalls, mango trees, laterite-red earth",
  "Panama City": "Panama Canal in distance, modern glass skyscrapers of Punta Pacifica, Casco Viejo colonial balconied buildings",
  "Paramaribo": "wooden colonial Dutch buildings (UNESCO), St. Peter and Paul Cathedral wooden towers, Suriname River, tropical palms",
  "Phnom Penh": "Royal Palace golden spires, Mekong River waterfront, French colonial yellow buildings, Cambodian temple motifs",
  "Podgorica": "Millennium Bridge cable-stayed design, Morača River, mix of Ottoman and Austro-Hungarian architecture, Montenegrin mountains",
  "Port Louis": "Caudan Waterfront, Aapravasi Ghat, colorful Mauritian Creole buildings, Port Louis Theater, Moka mountain backdrop",
  "Port Moresby": "Papua New Guinean traditional haus tambaran-style buildings, tropical harbor, lush green hills, Coral Sea views",
  "Port of Spain": "Magnificent Seven colonial mansions, Queen's Park Savannah, Northern Range mountains, colorful Trinidadian buildings",
  "Port-au-Prince": "Gingerbread Houses ornate Victorian-Haitian architecture, Iron Market, mountain backdrop, vibrant Caribbean colors",
  "Porto-Novo": "Grande Mosquée de Porto-Novo, colonial-era Brazilian-style buildings, Ouémé lagoon, colorful Beninese market",
  "Praia": "colorful hillside houses, Atlantic Ocean views, volcanic Cape Verdean landscape, Portuguese colonial pastel buildings",
  "Pretoria": "Union Buildings on hilltop, jacaranda-lined avenues in purple bloom, Voortrekker Monument, red-brick colonial buildings",
  "Pristina": "Newborn Monument, National Library brutalist-style architecture, Mother Teresa Cathedral, modern Kosovo buildings",
  "Pyongyang": "Juche Tower, Ryugyong Hotel pyramid silhouette, wide empty boulevards, monumental Socialist-Realist architecture",
  "Quito": "colonial churches with ornate Baroque facades, Panecillo Virgin statue on hilltop, Andean volcanic peaks, colorful buildings",
  "Rabat": "Hassan Tower and incomplete mosque ruins, Kasbah of the Udayas blue-and-white walls, Moroccan zellige tilework",
  "Roseau": "colorful Caribbean Creole buildings, lush volcanic mountain backdrop, Dominica Botanic Gardens, waterfront promenade",
  "San Marino": "Guaita tower on Monte Titano, medieval stone walls, panoramic Italian countryside views, cobblestone paths",
  "San Salvador": "San Salvador Cathedral, El Salvador volcanic landscape, colonial pastel buildings, Central American market streets",
  "Sana'a": "distinctive multi-story tower houses with white geometric trim, Old City ancient buildings, Yemeni mountain backdrop",
  "Santo Domingo": "Zona Colonial cobblestone streets, Alcázar de Colón, first cathedral of the Americas, Caribbean colonial architecture",
  "Sarajevo": "Ottoman-era Baščaršija bazaar, Sebilj wooden fountain, minarets mixed with Austro-Hungarian buildings, surrounding mountains",
  "Skopje": "Stone Bridge over Vardar River, Macedonia Gate arch, mix of Ottoman and neoclassical buildings, Kale Fortress hilltop",
  "Sofia": "Alexander Nevsky Cathedral golden domes, yellow-brick royal palace, Vitosha Mountain backdrop, Ottoman mosque minarets",
  "Sucre": "whitewashed colonial buildings (Ciudad Blanca), ornate Baroque churches, red terracotta rooftops, Bolivian Andes backdrop",
  "Suva": "Suva Municipal Market, colonial-era wooden buildings, lush Fijian tropical gardens, Pacific harbor views",
  "Tashkent": "Khast Imam complex blue-tiled Islamic architecture, wide Soviet-era boulevards, modern Tashkent Tower, Uzbek ornamental patterns",
  "Tbilisi": "Narikala Fortress on cliff, colorful leaning wooden balcony houses, Bridge of Peace modern glass arch, Georgian churches",
  "Tegucigalpa": "colonial cathedral, El Picacho Christ statue on hilltop, hillside colorful houses, Honduran mountain valley setting",
  "Thimphu": "traditional Bhutanese dzong fortress architecture, prayer flags, Himalayan mountain backdrop, Buddha Dordenma statue",
  "Tirana": "colorful painted apartment buildings of Edi Rama era, Skanderbeg Square, Et'hem Bey Mosque, Albanian mountain backdrop",
  "Tripoli": "Red Castle (Assaraya al-Hamra), Ottoman-era medina, Marcus Aurelius Arch, Mediterranean waterfront, whitewashed buildings",
  "Tunis": "Medina of Tunis arched passageways, Zitouna Mosque minaret, blue-and-white Sidi Bou Said-style buildings, Tunisian tilework",
  "Ulaanbaatar": "Genghis Khan equestrian statue, Gandantegchinlen Monastery, Soviet-era apartment blocks, Mongolian steppe backdrop",
  "Vaduz": "Vaduz Castle perched on Alpine hillside, Rhine Valley views, small-town European architecture, Alpine flowers",
  "Valletta": "honey-colored limestone bastions, ornate Baroque balconies, Grand Harbour views, St. John's Co-Cathedral dome, blue Mediterranean",
  "Vatican City": "St. Peter's Basilica dome, Bernini's Colonnade, Vatican obelisk, Renaissance architecture, Swiss Guard presence",
  "Victoria": "Sir Selwyn Selwyn-Clarke Market, clock tower, lush Seychelles tropical vegetation, granite boulders, Creole architecture",
  "Vientiane": "Pha That Luang golden stupa, Patuxai Victory Gate arch, French colonial buildings, Buddhist temples, Mekong River",
  "Windhoek": "Christuskirche German colonial church, Alte Feste fortress, Independence Memorial Museum, Namibian highland landscape",
  "Yaoundé": "Reunification Monument, lush green hills, Cameroon government buildings, tropical vegetation, red-earth pathways",
  "Yerevan": "Republic Square pink-tuff stone buildings, Mount Ararat snow-capped peak in background, Cascade stairway complex, Armenian churches",
  // Beach / Club locations
  "Bali": "tropical Balinese temple gates (split gate / candi bentar), lush jungle, rice terrace terraces, carved stone statues",
  "Bali near the Beach": "Balinese beach with volcanic black sand, traditional fishing boats (jukung), tropical palms, temple silhouette",
  "Bali on the Beach": "white sand Bali beach, turquoise Indian Ocean water, thatched beach umbrellas, tropical palm trees",
  "In a Beach Club in Bali": "luxury Bali beach club, thatched-roof cabana, infinity pool overlooking ocean, tropical cocktails, Balinese carved wood decor",
  "In a Beach Club in Marbella": "luxury Marbella beach club, white sun loungers, Mediterranean Sea, DJ booth area, champagne service, palm-lined pool deck",
};

function getCityLandmarks(city: string): string {
  if (CITY_LANDMARKS[city]) {
    return CITY_LANDMARKS[city];
  }
  // Smart fallback for unlisted cities
  return `distinctive local architecture and recognizable landmarks of ${city}, culturally authentic streetscape unique to ${city}`;
}

// ── Outdoor Hyperreal ────────────────────────────────────────────────────────
function buildOutdoorHyperrealPrompt(city: string, season: string): string {
  const seasonDesc = SEASON_DESCRIPTORS[season] || SEASON_DESCRIPTORS.summer;
  const cityLandmarks = getCityLandmarks(city);

  const sunConfig: Record<string, { angle: string; quality: string; shadows: string; temp: string }> = {
    summer: {
      angle: "high sun (60-75deg)",
      quality: "bright direct sunlight with sharp highlights",
      shadows: "short defined shadows, high contrast",
      temp: "5600K neutral to slightly warm",
    },
    winter: {
      angle: "low sun (20-35deg)",
      quality: "cool diffused light through thin clouds",
      shadows: "long soft shadows, low contrast",
      temp: "6500K cool daylight",
    },
    fall: {
      angle: "golden hour sun (15-30deg)",
      quality: "warm golden directional light",
      shadows: "long rich warm shadows, medium contrast",
      temp: "4500K warm golden",
    },
    spring: {
      angle: "moderate sun (40-55deg)",
      quality: "soft diffused daylight through light clouds",
      shadows: "gentle medium-length shadows",
      temp: "5800K neutral fresh",
    },
  };

  const sun = sunConfig[season] || sunConfig.summer;
  const seasonalVegetation = season === "fall" ? "autumn leaves, golden foliage" : season === "winter" ? "bare trees, cold atmosphere" : season === "spring" ? "blooming flowers, fresh greenery" : "lush green trees, summer vibrancy";

  return `
[OUTDOOR - HYPERREAL STREET PHOTOGRAPHY IN ${city.toUpperCase()}]

LOCATION: Authentic ${season} street in ${city}. ${seasonDesc}. ONLY ONE model visible.

ENVIRONMENT: ${cityLandmarks}. ${seasonalVegetation}. Textured pavement. Depth layers with atmospheric perspective. Iconic location must be recognizable — viewer should immediately identify this as ${city}.

LANDMARK RULE: At least one famous landmark or culturally iconic element of ${city} MUST be visible in the background. The location must be unmistakably ${city} — not a generic street.

STREET TEXTURE & LIFE: Worn cobblestones or cracked asphalt with puddle remnants, weathered building facades with peeling paint or patina, real shop signage in local language, iron balcony railings with rust spots, cafe tables with half-finished drinks in background, 2-3 blurred candid pedestrians at natural distances, parked scooters or bicycles leaning against walls, pigeons on ledges, stray cafe napkin on ground. The street must feel INHABITED and LIVED-IN — not freshly rendered.

LIGHTING (${season.toUpperCase()}): Sun ${sun.angle}, ${sun.quality}, ${sun.shadows}, ${sun.temp}. Light on model matches environment shadows. Natural skin rendering with environmental color bounce.

LIGHT-ENVIRONMENT INTERACTION: Dappled sunlight through tree canopy creating natural shadow patterns on pavement, warm light bouncing off stone/brick walls onto model's shadow side, visible light rays through narrow alleyways or between buildings, reflections in shop windows and wet surfaces, natural color temperature shift between sunlit and shaded areas of the scene.

CAMERA: Canon EOS R5, 85mm f/2.8 portrait prime. Shallow DOF with natural bokeh circles in background highlights. Subtle barrel distortion at frame edges. Micro film grain at ISO 200-400. Color science: Canon faithful profile with natural skin rendering. Shutter speed 1/250 freezing subtle motion.

GROUNDING: Feet firmly planted, natural contact shadow, weight distribution visible, ground texture around feet.

REALISM: Skin with pores/texture, realistic fabric drape, natural hair, catchlights matching sun, matching environmental shadows. Professional pose (no selfie, no phone). Natural environment interaction.

COLOR FIDELITY: The garment color must be a PIXEL-PERFECT match to the uploaded product reference image — identical hue, saturation, and lightness. Environmental lighting (sun, sky, foliage, reflections) must NOT tint, warm, cool, or shift the garment color in any way. Treat the garment as if it has its own independent white balance locked to the reference image. The outdoor garment color MUST be indistinguishable from the studio garment color.

PHOTOGRAPHIC IMPERFECTIONS (REALISM): Subtle natural lens characteristics — faint chromatic aberration at frame edges, micro film grain consistent with ISO 200-400, natural optical vignetting. Skin must show real texture: visible pores, fine peach fuzz, subtle under-eye texture, natural skin irregularities. NO airbrushed/plastic skin. NO HDR glow. NO over-saturated colors.

ATMOSPHERIC DEPTH (3-PLANE): FOREGROUND (0-2m): Slightly defocused element — edge of a railing, potted plant, bicycle wheel, cafe chair — creating natural depth frame. MID-GROUND (2-5m): Model sharp and in focus, ground texture crisp, visible contact shadows with ambient occlusion. BACKGROUND (5m+): City architecture with natural atmospheric haze, slight blue-shift from aerial perspective, landmarks recognizable but softened by distance. Sky with real cloud formations — cumulus for summer, overcast layers for winter.

WIND & MOVEMENT: Hair and loose fabric must show subtle natural wind movement consistent with outdoor setting. Clothing drape must respond to body movement and breeze — no static/stiff fabric.

ANTI-AI MANDATE: This must be indistinguishable from a real photograph taken by a professional fashion photographer. Zero tolerance for: plastic/waxy skin, unnaturally perfect symmetry, floating feet, merged fingers, impossible reflections, over-smooth backgrounds, video-game lighting.

OUTDOOR REALISM CHECK: Shadows must fall in consistent direction matching sun position. Reflections in windows must show actual scene content. Building perspective lines must converge naturally. No perfectly clean streets — include minor litter, leaves, wear marks. Skin must show environmental interaction — slight warmth on sun-facing side, cooler tones in shadow. Hair must respond to any breeze direction consistently across strands.`;
}

// ── Background Directive ─────────────────────────────────────────────────────
export function getBackgroundDirective(isOutdoor: boolean, city: string, backgroundColor: string, season?: string, productFocused: boolean = false): string {
  if (isOutdoor) {
    return buildOutdoorHyperrealPrompt(city, season || "summer");
  }
  return buildStudioLightingPrompt(backgroundColor, productFocused);
}

// ── Front Poses (natural, editorial, facing camera) ─────────────────────────
const FRONT_POSES = [
  "weight shifted to left leg, slight hip tilt, right hand resting on hip, left arm relaxed at side, subtle contrapposto",
  "weight shifted to right leg, left hand lightly on hip, right arm hanging naturally, shoulders slightly angled",
  "relaxed contrapposto stance, one knee slightly bent, arms loose at sides with slight bend at elbows, natural asymmetry",
  "slight torso angle (5-10°), one hand casually in pocket, other arm relaxed, confident stance",
  "thumbs hooked in front pockets, weight on one leg, shoulders slightly uneven, relaxed editorial feel",
  "one arm bent with hand near collar or lapel, other arm relaxed, slight weight shift, natural posture",
  "arms loosely crossed at waist level, weight on one leg, head tilted very slightly, composed look",
  "one hand adjusting sleeve or cuff of opposite arm, weight shifted, candid mid-gesture moment",
  "hands clasped loosely in front at waist, slight lean, relaxed but intentional posture",
  "one hand resting on thigh, other arm bent with hand near waist, subtle S-curve in posture",
  "slight forward lean from hips, one foot slightly ahead of the other, engaged confident energy",
  "arms relaxed with one hand holding opposite wrist in front of body, gentle weight shift, composed stance",
  "mid-stride walk toward camera, one leg forward knee bent, arms swinging naturally, dynamic movement energy",
  "power stance with feet shoulder-width apart, one hand on hip, other hand touching side of neck, strong confident energy",
  "slight three-quarter turn (15° from camera), looking directly at lens, one hand brushing hair back, candid editorial moment",
  "wide-leg stance, both hands in pockets, shoulders relaxed and slightly forward, cool nonchalant attitude",
  "crossed ankles while standing, one hand adjusting jacket or top hem, casual effortless vibe",
  "walking pose caught mid-step, one arm swinging forward, torso naturally rotated, genuine movement captured",
  "leaning very slightly to one side, one elbow bent with hand near chin, thoughtful editorial expression",
  "one foot pointed forward, opposite hand resting on back of neck, relaxed asymmetrical stance with visible body twist",
];

function getRandomFrontPose(seed: number): string {
  const index = Math.abs(Math.floor(seed)) % FRONT_POSES.length;
  return FRONT_POSES[index];
}

// ── Outdoor Poses ────────────────────────────────────────────────────────────
const OUTDOOR_POSES = [
  "walking confidently towards camera, mid-stride, movement in hair",
  "walking away from camera, looking back over shoulder, candid",
  "crossing the street briskly, urban energy, looking ahead",
  "striding past a blurred background, dynamic movement",
  "stepping down from a curb, focused execution",
  "leaning casually against a textured wall, one leg crossed, looking away",
  "shifting weight to one hip, hand in pocket, looking off-camera, relaxed",
  "leaning against a railing or fence, gazing at cityscape",
  "waiting for a cab, arm slightly raised, urban context",
  "checking watch or phone (subtle), busy lifestyle vibe",
  "adjusting sunglasses or hair, candid moment caught off-guard",
  "holding a coffee cup, laughing naturally, looking at a friend (off-camera)",
  "sitting relaxed on steps or bench, engaging with environment",
  "turning sharp 45-degree angle, caught in motion",
  "pausing mid-walk to look at something interesting in the distance",
  "strong power stance, wide leg, looking down at camera (low angle)",
  "dynamic twist in torso, hands near face, fashion editorial vibe",
  "walking past shop windows, reflection visible, cinematic",
  "leaning against a doorway frame, casual stance",
  "leaning forward slightly, engaging directly with lens, intense gaze",
  "caught mid-laugh, head thrown back slightly, joyful energy",
  "looking sideways at traffic, wind blowing hair, natural",
  "fixing jacket or adjusting collar, unposed feel",
  "stepping out of a doorway, entering the scene",
  "resting back against a street light pole, relaxed pose",
  "walking confidently along a crosswalk, mid-stride, urban energy, city moving around them",
  "standing at a street corner waiting to cross, relaxed weight on one leg, looking down the road",
  "browsing a sidewalk cafe menu or flower stand, half-turned, natural curiosity",
  "descending stone steps with one hand on iron railing, movement and architectural interaction",
  "pausing on a cobblestone lane, looking up at the architecture, genuine discovery moment",
  "walking through a sun-dappled tree-lined avenue, light filtering through leaves onto model",
];

function getRandomOutdoorPose(seed: number): string {
  const index = Math.abs(Math.floor(seed)) % OUTDOOR_POSES.length;
  return OUTDOOR_POSES[index];
}

// ── Pose Validation ──────────────────────────────────────────────────────────
export function getPoseValidation(viewId: string, viewName: string, seed: number = 0): string {
  const viewLower = viewId.toLowerCase();
  const nameLower = viewName.toLowerCase();

  if (viewLower === "front" || nameLower.includes("front")) {
    const uniquePose = getRandomFrontPose(seed);
    return `POSE: FRONT VIEW - facing camera, eyes at camera, full body visible. ${uniquePose}. MANDATORY: visible body asymmetry — uneven shoulders, weight clearly on one leg, at least one arm bent or gesture-engaged. FORBIDDEN: rigid symmetrical stance, both arms hanging straight at sides, stiff military posture, mannequin energy. The model must look mid-moment, NOT posed for a passport photo.`;
  }

  if (viewLower === "side" || nameLower.includes("side")) {
    return `POSE: SIDE VIEW (90deg PROFILE) - model turned 90deg, one shoulder at camera, face in profile (one eye visible). Do NOT show both shoulders or chest front. No 3/4 view. Looking straight ahead.`;
  }

  if (viewLower === "back" || nameLower.includes("back")) {
    return `POSE: BACK VIEW - facing AWAY from camera completely. Back of head and body visible. No logos/labels on back unless on original.
CRITICAL COLOR LOCK: The garment color on the back MUST be the EXACT SAME color as the front. Same fabric, same base color, same shade. Do NOT invent a different colorway for the back of the garment.`;
  }

  if (viewLower === "outdoor" || nameLower.includes("outdoor")) {
    const uniquePose = getRandomOutdoorPose(seed);
    return `POSE: OUTDOOR / LIFESTYLE (DYNAMIC) - ${uniquePose}. The model MUST interact with the real environment — touching a wall, stepping on cobblestones, reacting to sunlight. Do NOT use standard front-view passport pose. Do NOT stand straight with hands by sides. Candid editorial vibe — the model belongs in this city, not pasted onto it. FORBIDDEN: static centered pose with no environmental connection, floating-on-background look, studio-style lighting on outdoor model.`;
  }

  return `POSE: "${viewName}" - execute exactly as described, natural body position.`;
}

// ── Complementary Garment Lock ───────────────────────────────────────────────
const FEMALE_SHOES = ["white sneakers", "simple black flats", "black ankle boots"];
const MALE_SHOES = ["white sneakers", "black loafers"];

const FEMALE_TOPS = ["white fitted crew-neck tee", "black slim-fit tank top", "gray ribbed long-sleeve top"];
const MALE_TOPS = ["white crew-neck tee", "gray henley shirt", "navy button-down shirt"];

const FEMALE_BOTTOMS = ["black skinny jeans", "navy fitted leggings", "charcoal pleated midi skirt"];
const MALE_BOTTOMS = ["gray slim chinos", "black tailored trousers", "navy chinos"];

const FEMALE_PANTS_FOR_SHOES = ["black skinny jeans hemmed above ankle", "navy slim-fit leggings rolled at calf", "charcoal fitted leggings"];
const MALE_PANTS_FOR_SHOES = ["gray slim chinos hemmed above ankle", "black tailored trousers", "navy chinos"];

function _hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function pickComplementaryShoe(gender: "male" | "female", seed: string): string {
  const options = gender === "female" ? FEMALE_SHOES : MALE_SHOES;
  return options[_hashSeed(seed) % options.length];
}

function pickComplementaryTop(gender: "male" | "female", seed: string): string {
  const options = gender === "female" ? FEMALE_TOPS : MALE_TOPS;
  return options[_hashSeed(seed + "-top") % options.length];
}

function pickComplementaryBottom(gender: "male" | "female", seed: string): string {
  const options = gender === "female" ? FEMALE_BOTTOMS : MALE_BOTTOMS;
  return options[_hashSeed(seed + "-bottom") % options.length];
}

function pickComplementaryPantsForShoes(gender: "male" | "female", seed: string): string {
  const options = gender === "female" ? FEMALE_PANTS_FOR_SHOES : MALE_PANTS_FOR_SHOES;
  return options[_hashSeed(seed + "-shoepants") % options.length];
}

export interface ComplementaryGarments {
  top: string;
  bottom: string;
  shoes: string;
  pantsForShoes: string;
}

export function resolveComplementaryGarments(gender: "male" | "female", jobSeed: string): ComplementaryGarments {
  return {
    top: pickComplementaryTop(gender, jobSeed),
    bottom: pickComplementaryBottom(gender, jobSeed),
    shoes: pickComplementaryShoe(gender, jobSeed),
    pantsForShoes: pickComplementaryPantsForShoes(gender, jobSeed),
  };
}

// ── Framing Rules ────────────────────────────────────────────────────────────
function getAspectRatioFramingHint(aspectRatio: string): string {
  const parts = aspectRatio.split(":").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "";
  const ratio = parts[0] / parts[1];

  const centerRule = `Center the product garment horizontally and vertically within the frame.`;

  if (ratio > 1.3) {
    // Wide landscape (16:9, 21:9, 3:2)
    return `\n[WIDE FORMAT FRAMING (${aspectRatio})]\n${centerRule} This is a WIDE landscape format. Zoom out to show more surrounding context while keeping the product as the centered focal point. Allow generous environment/background space around the product. The product should occupy ~50-60% of the frame width, NOT fill edge-to-edge. Leave natural breathing room on all sides.`;
  }
  if (ratio > 1.05) {
    // Mild landscape (5:4, 4:3)
    return `\n[MILD LANDSCAPE FORMAT (${aspectRatio})]\n${centerRule} Slightly wider than square. Product centered with comfortable margins on all sides.`;
  }
  if (ratio < 0.7) {
    // Tall portrait (9:16, 2:3)
    return `\n[TALL PORTRAIT FORMAT (${aspectRatio})]\n${centerRule} This is a TALL portrait format. Use the vertical space naturally — center the product with generous breathing room above and below. Do NOT fill the entire vertical space with the model; leave natural headroom and footroom.`;
  }
  if (ratio < 0.95) {
    // Mild portrait (4:5, 3:4)
    return `\n[PORTRAIT FORMAT (${aspectRatio})]\n${centerRule} Slightly taller than square. Product centered with comfortable vertical margins.`;
  }
  // Square
  return `\n[SQUARE FORMAT]\n${centerRule}`;
}

export function getFramingRules(productType: ProductType, viewPose: ViewPose, viewId: string, gender: "male" | "female" = "female", aspectRatio: string = "1:1", jobSeed: string = "default", garments?: ComplementaryGarments): string {
  const isProductFocused = viewPose === "product-focused";
  const isBackView = viewId.toLowerCase() === "back";

  const faceProtection = `[FACE PROTECTION] Model's face 100% visible and intact. Full head + 10% headroom. Never crop/erase/blur face.`;

  // Universal product visibility rule for product-focused
  const productVisibilityRule = isProductFocused
    ? `\n[PRODUCT VISIBILITY — CRITICAL] Center the product garment in the frame both horizontally and vertically. The product must be 100% visible with comfortable breathing room around it — NEVER crop, cut off, or obscure any part of the product. Leave at least 5% margin on all edges between the product and the frame boundary.`
    : "";

  const aspectHint = isProductFocused ? getAspectRatioFramingHint(aspectRatio) : "";

  // Deterministic complementary garments — same across every view in the batch
  const resolved = garments || resolveComplementaryGarments(gender, jobSeed);
  const complementaryTop = resolved.top;
  const complementaryBottom = resolved.bottom;
  const complementaryShoes = resolved.shoes;
  const complementaryPantsForShoes = resolved.pantsForShoes;

  if (productType === "bottom") {
    if (isProductFocused) {
      return `[OVERRIDE] Ignore "FACE 100% VISIBLE" rule — face is NOT required for bottom-focused shots.
FRAMING: BOTTOM - PRODUCT-FOCUSED
CRITICAL: Do NOT show the model's head, face, chest, or upper torso. The frame STARTS at mid-torso/belly button. The TOP of the image must show the waistband area, NOT the head. This is a LOWER-BODY ONLY shot.
Frame from mid-torso/belly button down to feet — show generous space above the waistband. BOTH legs fully visible from hip to toe. Shoes/feet MUST be fully visible touching the ground — NEVER crop or cut off the feet. The focus and center of composition is the bottom garment (pants/skirt/trousers), but legs and shoes must be completely in frame. Waistband and some torso visible at top of frame.
Center the bottom garment horizontally within the frame.
Complementary: neutral shoes (${complementaryShoes}).${productVisibilityRule}${aspectHint}`;
    }
    return `FRAMING: BOTTOM - FULL BODY (HEAD-TO-TOE MANDATORY)
FULL BODY — head-to-toe. Entire person visible: full head with 10% headroom above, full torso, BOTH legs fully visible from hip to toe, shoes/feet touching visible ground. Camera distance shows full standing figure occupying ~70-80% of frame height. Do NOT crop below the knees. Do NOT zoom in on the garment. Feet MUST be visible touching the ground — NEVER cut off. Both arms and hands fully visible.
Complementary: ${complementaryTop}, simple solid color. Shoes: ${complementaryShoes} — SAME shoe style and color on ALL views.`;
  }

  if (productType === "top") {
    if (isProductFocused) {
      return `${faceProtection}
FRAMING: TOP - PRODUCT-FOCUSED (waist-up)
CRITICAL: The model's FULL HEAD must be visible with 10% headroom above — NEVER crop the head. Frame generously from well above the head to below the garment hem. The ENTIRE top garment must be 100% visible — from collar/neckline to the full hem at the bottom. The hem of the shirt/top must be fully visible with generous space below it. Frame ends at mid-thigh — show some thigh/hip area below the garment for breathing room. No knees/calves/feet visible. Both sleeves and arms fully visible to the cuff.
The focus and center of composition is the top garment, but the head must ALWAYS be fully in frame.
DO NOT crop the product garment or the head — both must be 100% visible and centered within the frame.
${isBackView ? "Back view: back of head fully visible with headroom." : "Eyes, nose, mouth, chin - ALL visible."}
Complementary: ${complementaryBottom} visible at waist. Shoes: ${complementaryShoes} — SAME shoe style and color on ALL views.${productVisibilityRule}${aspectHint}`;
    }
    return `${faceProtection}
FRAMING: TOP - FULL BODY (HEAD-TO-TOE MANDATORY)
FULL BODY — head-to-toe. Entire person visible: full head with 10% headroom above, full torso with top garment and arms/sleeves fully visible, BOTH legs to the floor, shoes touching visible ground. Camera distance shows full standing figure occupying ~70-80% of frame height. Do NOT crop below the knees. Do NOT zoom in on the garment. Both arms and hands fully visible.
${isBackView ? "Back view: back of head fully visible with headroom." : "Eyes, nose, mouth, chin - ALL visible."}
Complementary: ${complementaryBottom}, simple solid color. Shoes: ${complementaryShoes} — SAME shoe style and color on ALL views.`;
  }

  if (productType === "shoes") {
    if (isProductFocused) {
      return `[OVERRIDE] Ignore "FACE 100% VISIBLE" rule — face is NOT required for shoe-focused shots.
FRAMING: SHOES - PRODUCT-FOCUSED
Center both shoes in the frame horizontally and vertically. Frame from KNEES down to ground — show the lower legs and both shoes in full with ground/floor visible beneath. Leave 15-20% margin on ALL sides between shoes and frame edges. Do NOT crop tighter than the knees. No head/torso/hips/upper thighs visible.
DO NOT crop the product — both shoes must be 100% visible and centered within the frame.
Complementary: ${complementaryPantsForShoes}.${productVisibilityRule}${aspectHint}`;
    }
    return `FRAMING: SHOES - FULL BODY (HEAD-TO-TOE MANDATORY)
FULL BODY — head-to-toe. Entire person visible: full head with 10% headroom above, full torso, BOTH legs fully visible, shoes/feet as focal point touching visible ground. Camera distance shows full standing figure occupying ~70-80% of frame height. Do NOT crop to lower-body only. Do NOT use knee-down framing. Both arms and hands fully visible. Floor/ground MUST be visible.
Complementary: ${complementaryPantsForShoes}. Top: ${complementaryTop}.`;
  }

  if (productType === "outfit") {
    if (isProductFocused) {
      return `${faceProtection}
FRAMING: OUTFIT - PRODUCT-FOCUSED
Full head with complete face + 10% headroom. Full outfit visible head to mid-calf/ankle. Show complete coordination of outfit pieces.
${isBackView ? "Back view: back of head fully visible with headroom." : "Eyes, nose, mouth, chin - ALL visible."}
Complementary: neutral shoes if outfit lacks them (${complementaryShoes}).${productVisibilityRule}${aspectHint}`;
    }
    return `${faceProtection}
FRAMING: OUTFIT - FULL BODY (HEAD-TO-TOE MANDATORY)
FULL BODY — head-to-toe. Entire person visible: full head with 10% headroom above, full outfit visible from collar to shoes, feet touching visible ground. Camera distance shows full standing figure occupying ~70-80% of frame height. Do NOT crop below the knees. Do NOT zoom in on any single piece. Both arms and hands fully visible.
${isBackView ? "Back view: back of head fully visible with headroom." : "Eyes, nose, mouth, chin - ALL visible."}
Complementary: neutral shoes if outfit lacks them (${complementaryShoes}).`;
  }

  return getFramingRules("top", viewPose, viewId, gender, aspectRatio, jobSeed);
}

// ── Identity Reference Prompt ────────────────────────────────────────────────
export function buildIdentityReferencePrompt(
  anchor: IdentityAnchor,
  taskSeed: string,
  productBlueprint: ProductBlueprint | undefined,
  _viewName: string,
): string {
  return `
[MODEL AND PRODUCT IDENTITY LOCK]
ANCHOR IMAGE PROVIDED - reproduce this EXACT person with zero deviation.

MODEL LOCK ID: ${anchor.modelProfile.lockString}
TASK SEED: ${taskSeed}

LOCKED IDENTITY (copy exactly from anchor):
- FACE: ${anchor.modelProfile.faceShape}, ${anchor.modelProfile.eyeColor} eyes
- HAIR: ${anchor.modelProfile.hairColor} ${anchor.modelProfile.hairStyle}
${anchor.modelProfile.gender === "male" && anchor.modelProfile.facialHair ? `- FACIAL HAIR: ${anchor.modelProfile.facialHair}\n` : ""}- BODY: ${anchor.modelProfile.build}, ${anchor.modelProfile.height}
- SKIN TONE: ${SKIN_TONE_DESCRIPTORS[anchor.modelProfile.skinTone] || "medium"}
- AGE: ${anchor.modelProfile.age} years old

SKIN TONE LOCK: The model's skin tone is "${SKIN_TONE_DESCRIPTORS[anchor.modelProfile.skinTone] || "medium"}" — this is NON-NEGOTIABLE.
Match the anchor image's exact skin shade across ALL views. Do NOT lighten or darken skin for studio vs outdoor lighting. The same person has the same skin in every photo.

${
  productBlueprint
    ? `LOCKED PRODUCT (copy texture and pattern exactly):
GARMENT: ${productBlueprint.productType.toUpperCase()} - ${productBlueprint.garmentClass}
TEXTURE/PATTERN: ${productBlueprint.patternType} - ${productBlueprint.knitWeavePattern}
FABRIC: ${productBlueprint.fabric} | TEXTURE: ${productBlueprint.texture}
SLEEVE: ${productBlueprint.sleeveLength}
DETAIL: ${productBlueprint.uniqueDetails}
Preserve exact texture (checks, ribs, weave) even if color changes. Do NOT simplify fabric.
`
    : ""
}
IDENTITY RULES: Same face/bone structure, same hairstyle/color, same body/build/height, SAME EXACT SKIN TONE, same age. Face must be recognizable as the SAME individual from anchor.
`;
}

// ── Build Fashion Prompt (Step 4 — Batch View Generation) ────────────────────
export function buildFashionPrompt(
  modelProfile: ModelProfile,
  productType: ProductType,
  viewPose: ViewPose,
  viewId: string,
  viewName: string,
  backgroundColor: string,
  city: string,
  anchor: IdentityAnchor | null,
  taskSeed: string,
  blueprint: ProductBlueprint | null,
  season?: string,
  customPose?: string | null,
  customPrompt?: string | null,
  aspectRatio?: string,
  variantColor?: string | null,
  isBaseVariant?: boolean,
  allVariantColorsInBatch?: string[],
  resolution?: string,
): string {
  const isOutdoor = viewId.toLowerCase() === "outdoor" || viewName.toLowerCase().includes("outdoor");
  const formatSpec = getFormatSpec(aspectRatio || "1:1");

  // [ROLE]
  const roleSection = `[ROLE] Elite fashion photographer specializing in high-end ecommerce photography.`;

  // [IDENTITY]
  const identitySection = anchor
    ? buildIdentityReferencePrompt(anchor, taskSeed, blueprint ?? undefined, viewName)
    : "";

  // [PRODUCT]
  const productSection = blueprint
    ? `
[PRODUCTLOCK - GARMENT DESIGN FROZEN]
The uploaded product image is the EXACT garment reference.

GARMENT: ${blueprint.garmentClass}
BLUEPRINT: ${blueprint.descriptorString}

ALL design elements LOCKED: neckline/collar, closure (buttons/zip/pullover), pocket count and placement, pattern/texture/fabric, silhouette/cut, fit, length, sleeve length (${blueprint.sleeveLength}), fabric (${blueprint.fabric}), texture (${blueprint.texture}), seams/stitching/hems, logos/labels/patches. Pattern must be seamless across entire garment - no fading to solid.

Output garment must be VISUALLY IDENTICAL to upload. Only COLOR may change for variants.

UPLOAD LEAKAGE PREVENTION: Ignore jewelry/watches/accessories/shoes/pose/BACKGROUND/ENVIRONMENT/LIGHTING from reference. The reference image is for PRODUCT DESIGN ONLY — its background, setting, surfaces, and lighting must be completely discarded. Generate the background strictly from the [VIEW] directives below. Generic neutral footwear only.`
    : `
[PRODUCT REFERENCE]
Uploaded product image is the EXACT garment to reproduce. Copy every design detail. Do NOT invent or modify elements. Design is LOCKED - only pose/view/color changes allowed.
Upload leakage prevention: ignore jewelry/watches/accessories/shoes/pose/BACKGROUND/ENVIRONMENT/LIGHTING from reference. The reference image is for PRODUCT DESIGN ONLY — its background, setting, surfaces, and lighting must be completely discarded.`;

  const isProductFocused = viewPose === "product-focused";

  // [VIEW] - merged environment + background directive (no duplication)
  const viewSection = isOutdoor
    ? `
[VIEW: ${viewName.toUpperCase()} - OUTDOOR]
${getBackgroundDirective(true, city, backgroundColor, season, isProductFocused)}
Background fills 100% canvas edge-to-edge. No white margins, no pillarboxing, no letterboxing. Camera is IN the scene.`
    : `
[VIEW: ${viewName.toUpperCase()} - STUDIO]
${getBackgroundDirective(false, city, backgroundColor, season, isProductFocused)}
Background fills 100% canvas edge-to-edge. No white margins, no pillarboxing, no letterboxing. Camera is INSIDE an infinite room.`;

  // [COLOR]
  let colorSection = "";
  if (isBaseVariant) {
    const forbiddenColorsList = (allVariantColorsInBatch || []).filter((c) => c).join(", ");
    const detectedColor = blueprint?.originalColor && blueprint.originalColor !== "unknown" ? blueprint.originalColor : null;
    colorSection = `
[COLOR: ORIGINAL VARIANT]
${detectedColor ? `This is the ORIGINAL product in "${detectedColor}". Output garment color MUST EXACTLY MATCH the reference image — precise ${detectedColor} shade.` : `This is the ORIGINAL product. Output color MUST EXACTLY MATCH the reference image color. Copy precise shade/tone from input.`}
REFERENCE IMAGE IS THE ABSOLUTE COLOR AUTHORITY. Sample the garment color directly from the uploaded product photo — do not interpret, approximate, or "improve" it. The output garment must match the input garment color exactly as if photographed under identical lighting conditions.
Do NOT shift hue, saturation, or brightness due to lighting or environment.
${detectedColor ? `The garment is ${detectedColor} in studio AND in outdoor — same exact shade regardless of scene lighting.` : "Maintain identical color in studio AND outdoor — no environmental tinting."}
${forbiddenColorsList ? `Other variants in batch (${forbiddenColorsList}) must NOT influence this color.` : ""}
CROSS-VIEW COLOR LOCK: This garment color must be IDENTICAL across every view in this batch (front, back, side, outdoor). Same hue, same saturation, same brightness. Do NOT adjust color for "visual interest" or "lighting variation" between views. Studio and outdoor outputs must show the exact same shade.
${productType === "shoes" ? `SHOE COLOR FIDELITY: The shoes are "${detectedColor || "as shown in reference"}". Reproduce the EXACT shade, material finish, and tonal variations from the reference photo. Do NOT default to generic black — match the precise hue (navy, brown, burgundy, etc.) pixel-for-pixel from the upload.` : ""}`;
  } else if (variantColor) {
    colorSection = `
[COLOR: VARIANT - ${variantColor}]
COLOR VARIANT (not original). Replace original color completely. DYE entire PRIMARY/OUTER garment to ${variantColor}. All visible fabric surfaces of the main garment must be ${variantColor}. Ignore original color.
LAYER SEPARATION: If wearing layers (e.g., blazer over crop top, jacket over shirt), ONLY recolor the OUTER/PRIMARY garment. Inner layers (undershirt, crop top, tank top) must keep their original color UNCHANGED.
COLOR FIDELITY: Maintain exact ${variantColor} shade regardless of lighting environment (studio or outdoor). No tinting from ambient light.
CROSS-VIEW COLOR LOCK: This garment color must be IDENTICAL across every view in this batch (front, back, side, outdoor). Same hue, same saturation, same brightness. Do NOT adjust color for "visual interest" or "lighting variation" between views. Studio and outdoor outputs must show the exact same shade.`;
  }
  if (viewId.toLowerCase() === "back") {
    colorSection += `\nBACK VIEW COLOR RULE: The back of the garment is the SAME COLOR as the front. Sports jerseys, t-shirts, jackets — the base fabric color does NOT change between front and back. Only print/number placement may differ.`;
  }

  // Interpolate custom prompt placeholders
  const interpolationVars: Record<string, string> = {
    backgroundColor,
    gender: modelProfile.gender,
    ethnicity: modelProfile.ethnicity || "",
    skinTone: modelProfile.skinTone || "",
    city,
    season: season || "summer",
  };

  let interpolatedCustomPose = customPose && customPose.trim()
    ? interpolateCustomPrompt(customPose, interpolationVars)
    : null;
  let interpolatedCustomPrompt = customPrompt && customPrompt.trim()
    ? interpolateCustomPrompt(customPrompt, interpolationVars)
    : null;

  // When product-focused, aggressively strip full-body cues from custom pose and prompt
  if (isProductFocused) {
    const sanitize = (text: string | null): string | null => {
      if (!text) return null;
      return text
        .replace(/full[\s-]?body/gi, "")
        .replace(/head[\s-]?to[\s-]?toe/gi, "")
        .replace(/feet\s+(visible|on\s+ground|planted|on\s+floor)/gi, "")
        .replace(/floor\s+visible/gi, "")
        .replace(/visible\s+floor/gi, "")
        .replace(/show(ing)?\s+(full|entire)\s+body/gi, "")
        .replace(/- FRAMING BY PRODUCT TYPE:?\n(?:[\t •\-].*\n?)*/gi, "")
        .replace(/FRAMING BY PRODUCT TYPE:?\n(?:[\t •\-].*\n?)*/gi, "")
        .trim() || null;
    };
    interpolatedCustomPose = sanitize(interpolatedCustomPose);
    interpolatedCustomPrompt = sanitize(interpolatedCustomPrompt);
  }

  // [POSE]
  const poseSection =
    interpolatedCustomPose ? `POSE: "${viewName}"\n${interpolatedCustomPose}` : getPoseValidation(viewId, viewName);

  // [CUSTOM]
  const customSection = interpolatedCustomPrompt ? `\n[CUSTOM INSTRUCTIONS]\n${interpolatedCustomPrompt}\n` : "";

  // Conditionally modify ABSOLUTE_RULES for product-focused framing
  let effectiveRules = ABSOLUTE_RULES;
  if (viewPose === "product-focused") {
    if (productType === "shoes" || productType === "bottom") {
      // Remove both "FACE 100% VISIBLE" and "visible floor" rules — they conflict with cropped framing
      effectiveRules = effectiveRules
        .replace(/^\s*\d+\.\s*FACE 100% VISIBLE[^\n]*/m, "")
        .replace(/visible floor/gi, "studio background");
    } else {
      // top/outfit: keep face rule but remove "visible floor" (implies head-to-toe)
      effectiveRules = effectiveRules
        .replace(/visible floor/gi, "studio background");
    }
  }

  // Resolve complementary garments once for the entire batch
  const complementary = resolveComplementaryGarments(modelProfile.gender, modelProfile.jobSeed);
  const framingRules = getFramingRules(productType, viewPose, viewId, modelProfile.gender, aspectRatio || "1:1", modelProfile.jobSeed, complementary);

  // Framing lock override: highest priority instruction
  let framingLockSection = "";
  if (isProductFocused) {
    framingLockSection = `
⚠️ FRAMING LOCK — THIS OVERRIDES ALL OTHER SECTIONS (anchor image composition, background, pose, custom instructions).
The anchor/reference image is for IDENTITY ONLY (face, hair, skin, body type). Do NOT match the anchor's camera distance or full-body composition.
CROP TO: ${productType === "top" ? "head-to-hips (waist-up)" : productType === "bottom" ? "mid-torso to shoes ONLY. The TOP of the frame starts at the belly button/navel area. NO head, NO face, NO chest, NO shoulders visible. The camera is pointed at the LOWER HALF of the body" : productType === "shoes" ? "knees-to-floor (no upper body, show lower legs and both shoes fully)" : "full outfit head-to-ankle"}.
Any conflicting instruction elsewhere in this prompt is VOID.
`;
  } else if (viewPose === "full-body") {
    framingLockSection = `
⚠️ FRAMING LOCK — FULL BODY (OVERRIDES anchor composition bias)
The anchor/reference image is for IDENTITY ONLY. Do NOT match the anchor's camera distance.
MANDATORY: Show the ENTIRE person head-to-toe in EVERY view. Full head with headroom at top, feet/shoes touching visible ground at bottom. The person must occupy ~70-80% of the frame height.
Camera distance and scale must be CONSISTENT across all views in this batch.
Any view that crops below the knees or above the head VIOLATES this lock.
`;
  }

  // Assemble final prompt (single-pass, no duplicates)
  // Framing lock + framing rules placed FIRST (right after role) for highest priority
  return `${roleSection}

${framingLockSection}

${framingRules}

${effectiveRules}

${identitySection}

MODEL: ${modelProfile.fullDescription}
TASK SEED: ${taskSeed}
PRODUCT TYPE: ${productType.toUpperCase()}
VIEW: ${viewName}

${productSection}

${colorSection}

${viewSection}

${buildAspectRatioDirective(formatSpec)}

${poseSection}

${customSection}

${productType === "shoes" ? `
[SHOE COLOR ISOLATION]
The shoe color must NOT bleed into ANY other part of the image. Complementary garments (pants, shirt, socks) must remain their specified neutral colors with ZERO color contamination from the shoes. Background must remain clean — no color halos, tints, or splotches from the shoe color. The reference image background and lighting must be IGNORED — only extract the shoe design.
` : ""}
[SKIN TONE CONSISTENCY]
CRITICAL: Model skin tone must be IDENTICAL across all views in this batch.
Skin: ${SKIN_TONE_DESCRIPTORS[modelProfile.skinTone] || "medium"}.
Do NOT adjust skin tone based on environment lighting. Studio and outdoor shots show the EXACT SAME skin shade. Match the anchor reference precisely.

[COLOR CONSISTENCY — ALL VIEWS]
The garment color MUST be pixel-identical across front, back, side, and outdoor views. Zero hue/saturation/brightness drift between views. Studio lighting and outdoor lighting must NOT shift the garment color. If in doubt, match the product reference image exactly.

[CROSS-VIEW PRODUCT CONSISTENCY — ALL VIEWS]
The product garment/item MUST appear visually identical across ALL views in this batch (front, back, side, outdoor).
- SAME exact proportions, silhouette, and fit on the model
- SAME fabric drape behavior and texture rendering
- SAME shoe style, lacing, and positioning (for shoe products)
- SAME complementary garments: identical pants/skirt style, identical shoe model across every view
- Model legs/stance may change per pose, but the PRODUCT on the model must look like the same physical item photographed from different angles
- Do NOT change product scale, tightness, length, or material appearance between views
- The viewer should believe all images are from the SAME photo shoot of the SAME outfit on the SAME day

[CAMERA DISTANCE LOCK — ALL VIEWS]
The camera distance, zoom level, and model scale relative to the frame must be IDENTICAL across all views (front, back, side, outdoor). If the front view shows the model occupying 75% of the frame height, ALL other views must show the model at the same scale. Do NOT zoom in closer for side/back views. Do NOT change the framing between views.

[COMPLEMENTARY GARMENT LOCK — ALL VIEWS]
Every non-product garment on the model is FROZEN for this entire batch:
- TOP: Wear exactly "${complementary.top}" on ALL views — same garment, same color, same fit
- BOTTOM: Wear exactly "${complementary.bottom}" on ALL views — same garment, same color, same fit
- SHOES: Wear exactly "${complementary.shoes}" on ALL views — same style, same color
Do NOT substitute, vary, or reinterpret any complementary garment between views.
The model's entire outfit (product + complementary pieces) must be identical in every image.

${resolution === "2K" ? `[QUALITY — HD PREMIUM]
Shot on Phase One IQ4 150MP, Schneider 80mm f/2.8 LS, tethered to Capture One.
Resolution: 2048px long-edge minimum. Every pixel must hold detail at 200% zoom — image must remain crisp and sharp when zoomed in to 200-300%.
FABRIC MICRO-DETAIL: Individual thread weave, stitch relief, buttonhole stitching, seam topology visible at 100% crop. No smoothing or texture loss.
SKIN REALISM: Visible pores, fine vellus hair, natural subsurface scattering. Zero airbrushing. Skin detail must survive zoom-in inspection.
LIGHTING: Profoto D2 key + large octabox fill. Specular highlights on buttons/zippers. Fabric shows directional light with micro-shadow detail in folds.
DEPTH: Shallow DOF on background, razor-sharp on garment from collar to hem. Edge sharpness must hold at full zoom.
COLOR SCIENCE: Phase One XTRANS sensor color depth. Rich tonal gradients, no banding, no posterization.
ZOOM-IN TEST: At 200% zoom, individual fabric threads, stitch patterns, button textures, and skin pores must all be clearly distinguishable. No mushy or painted-looking areas.
This is a $5000/day studio shoot — the image must justify that production value.` : `[QUALITY]
Canon R5, 85mm f/4, 5600K daylight. Sharp focus on garment and model. Commercial ecommerce photography. Natural skin texture, realistic fabric drape. No CGI look.`}

[NEGATIVE]
${NEGATIVE_PROMPT}
${isProductFocused && productType === "bottom" ? "\n⚠️ FINAL REMINDER: This is a BOTTOM garment shot. Frame from belly button to shoes. NO HEAD OR FACE IN FRAME.\n" : ""}
`;
}

// ── Strict Color Edit Prompt (Step 5 — Color Variants) ──────────────────────
function getForbiddenColors(colorName: string): string {
  const normalized = (colorName || "").toLowerCase().trim();
  const palette = [
    "red", "pink", "orange", "yellow", "green", "blue", "navy",
    "purple", "brown", "beige", "black", "white", "gray", "grey",
    "silver", "gold", "maroon",
  ];

  const detected = palette.find((p) => normalized.includes(p)) ?? "";
  const forbidden = palette.filter((p) => (detected ? p !== detected : true));
  const uniq = Array.from(new Set(forbidden.map((c) => (c === "grey" ? "gray" : c))));
  return uniq.join(", ");
}

function describeColorFromHex(colorName: string, colorHex: string): string {
  const n = colorName.toLowerCase();
  if (n.includes("bordeaux") || n.includes("wine") || n.includes("burgundy")) return `deep wine-red (${colorName})`;
  if (n.includes("navy")) return `dark navy blue (${colorName})`;
  if (n.includes("forest")) return `deep forest green (${colorName})`;
  if (n.includes("cream")) return `warm cream/off-white (${colorName})`;
  if (n.includes("charcoal")) return `dark charcoal gray (${colorName})`;
  return `${colorName} (precise shade from variant selection)`;
}

export function buildStrictColorEditPrompt(
  productType: ProductType,
  colorVariant: { color: string; name: string },
  blueprint: ProductBlueprint | null,
  retryCount: number = 0,
): string {
  const frozenGarments = getFrozenGarments(productType);
  const frozenList = frozenGarments.join(", ");
  const garmentClass = blueprint?.garmentClass && blueprint.garmentClass !== "unknown" ? blueprint.garmentClass : productType;
  const targetGarment = productType === "outfit" ? "the complete outfit (top + bottom OR dress)" : `the ${garmentClass} (${productType})`;

  const colorName = colorVariant.name;
  const colorHex = colorVariant.color;
  const forbiddenColors = getForbiddenColors(colorName);
  const colorDescription = describeColorFromHex(colorName, colorHex);

  const descriptorText = blueprint
    ? `
GARMENT BLUEPRINT (must remain identical):
Type: ${blueprint.garmentClass}
Design: ${blueprint.descriptorString}
All design elements frozen. Unique details: ${blueprint.uniqueDetails || "none"}. Imperfections: ${blueprint.imperfections || "none"}.`
    : "";

  const strictnessBoost =
    retryCount > 0
      ? `\nSTRICT MODE (retry ${retryCount}): Zero tolerance. No color change to ${frozenList}. Pixel-perfect preservation of face, body, pose, background.`
      : "";

  return `[COLOR VARIANT EDIT - PRODUCTLOCK ENFORCED]

TASK: Change ONLY the color of ${targetGarment.toUpperCase()}.
TARGET COLOR: ${colorDescription}
COLOR CODE: ${colorHex}

[COLOR APPLICATION]
DYE the entire ${productType} garment fabric to ${colorName}. Apply uniformly across all fabric surfaces. The color code (${colorHex}) is the absolute truth - if color name conflicts, trust the code. Color must be deep, rich, and accurate to the variant.

FORBIDDEN COLORS: ${forbiddenColors}. Do NOT generate colors close to these.

PATTERN PRESERVATION: If garment has a pattern (checks, houndstooth, stripes, plaid, herringbone), preserve the pattern structure PIXEL-PERFECT. Keep the contrast between light and dark pattern areas — only shift the base hue. Pattern geometry, scale, and spacing must remain identical.

LAYER SEPARATION: If the target garment is worn over another layer (undershirt, crop top, tank top, t-shirt), ONLY recolor the OUTER/PRIMARY garment. The inner/underneath layer must remain COMPLETELY UNCHANGED in color and appearance. The target is the ${garmentClass}, NOT any layer beneath it.

DETAIL PRESERVATION: Do NOT paint over splatters, rips, holes, raw hems, logos. Recolor FABRIC only. Keep imperfections visible.
${descriptorText}

[FROZEN ELEMENTS - ZERO CHANGES]
- Model face: 100% visible and identical. Never crop/erase/blur
- Other garments: ${frozenList} - unchanged
- Model identity/pose/expression: unchanged
- Background color/lighting/shadows: unchanged
- Garment design (neckline, closure, pockets, pattern, fit, seams): unchanged
- Aspect ratio: match input exactly
- Zero text in output

EXECUTION:
1. DYE fabric to ${colorName} (${colorHex})
2. Preserve pattern structure if present
3. Keep every non-target pixel unchanged
4. Output is a pure photograph - no text, labels, or codes
${strictnessBoost}

CROSS-VIEW MATCH: Other views of this variant already exist or will be generated. Your output color must be identical to those — same ${colorName} (${colorHex}) shade across all views.

[NEGATIVE]
Recolor ${frozenList.replace(/, /g, ", recolor ")}, design modification, texture change, pattern change, fit alteration, face change, pose shift, background alteration, color bleed, text, labels, hex codes.

OUTPUT: ${productType} in ${colorName} - everything else pixel-perfect identical.`;
}

// ── Home Decor Prompts ───────────────────────────────────────────────────────

const HOME_DECOR_PRODUCT_LOCK = `[PRODUCT IDENTITY LOCK]
Reproduce the EXACT product from the reference image — same shape, proportions, color, material, texture, branding, and every design detail. Do NOT invent, add, remove, or modify any features. The reference image is the absolute truth for what the product looks like.`;

const HOME_DECOR_REALISM = `[PHOTOREALISM LAYER]
This must look like a real photograph taken by a professional photographer — NOT a CGI render or AI-generated image. Enforce:
- Material micro-details: visible wood grain, fabric weave/thread texture, metal reflections and patina, ceramic glaze variations, glass refractions
- Surface imperfections: subtle dust motes in light, micro-scratches on polished surfaces, slight color variations in natural materials
- Light behavior: realistic falloff, soft caustics on reflective surfaces, accurate shadow softness based on light distance
- Film grain: subtle photographic grain consistent with professional camera sensors
- Depth cues: accurate focus falloff, atmospheric perspective on distant elements

[ANTI-AI MANDATE]
No plastic/CGI/3D-render look. No perfectly uniform surfaces. No AI glow or haze. No unnaturally smooth materials. No synthetic-looking lighting. Every surface must have the organic irregularity of real-world materials.`;

const HOME_DECOR_NEGATIVE = `[NEGATIVE]
No text, no watermarks, no labels, no logos, no extra products not in reference, no product redesign, no color shift from original, no proportion change, no floating objects, no unnatural shadows, no CGI aesthetic, no 3D-render look, no plastic textures, no AI glow, no haze.`;

export const homeDecorPrompts = {
  fullProduct: (backgroundColor: string) =>
    `Professional high-end product photography. Clean seamless ${backgroundColor} paper backdrop, soft diffused studio lighting from above-left with gentle fill light from right, creating a subtle natural shadow beneath the product. Product centered in frame filling 60-70% of the composition. Shot with a 90mm macro lens at f/8 for tack-sharp detail across the entire product. Ultra-high resolution, 8K detail.

${HOME_DECOR_PRODUCT_LOCK}

${HOME_DECOR_REALISM}

STUDIO-SPECIFIC REALISM:
- Realistic contact shadow: soft, diffused shadow directly beneath the product with natural penumbra — not a hard graphic drop-shadow
- Subtle surface reflection on the backdrop if the product has glossy/polished elements
- Material texture must be visible at pixel level: wood grain direction, fabric thread count, metal brush marks, ceramic glaze pooling
- The backdrop paper should show very subtle tonal variation — not perfectly flat digital white

Clean, minimal, editorial e-commerce aesthetic. Absolutely no props, no decorations, no context objects — product only on clean background.

${HOME_DECOR_NEGATIVE}`,

  lifestylePrimary: (placement: string) =>
    `Editorial interior design photography. The product is the hero, placed prominently on a ${placement} in a beautifully styled modern living space. Warm natural daylight streaming through large windows, creating soft directional light with gentle shadows. Shallow depth of field (f/2.8) keeping the product razor-sharp while the background softly blurs. Contemporary minimalist interior with neutral warm tones — soft whites, warm grays, natural wood accents. The product occupies 40-50% of the frame, clearly the focal point. Shot at eye level with a 50mm lens.

${HOME_DECOR_PRODUCT_LOCK}

${HOME_DECOR_REALISM}

ENVIRONMENT REALISM:
- Wall surfaces: subtle plaster texture or paint roller marks — never perfectly flat CG walls
- Furniture surfaces: visible wood grain with natural color variation, slight wear marks on edges
- Natural light falloff: light intensity decreases realistically from window to room interior, with soft color temperature shift (cooler near window, warmer in shadows)
- Ambient occlusion: realistic darkening where surfaces meet (wall-floor junction, object-surface contact)
- Complementary styling with minimal tasteful decor that doesn't compete with the product

${HOME_DECOR_NEGATIVE}`,

  lifestyleSecondary: (placement: string) =>
    `Atmospheric editorial interior photography with a cozy, lived-in feel. The product is naturally integrated on a ${placement}, surrounded by tasteful complementary decor elements — a small plant, a book, a ceramic dish. Soft warm ambient lighting with a mix of natural light and subtle warm lamp glow, creating an inviting mood. Modern Scandinavian-inspired interior with muted earth tones, soft textiles, and organic textures. The product is clearly visible and identifiable, occupying 30-40% of the frame. Slightly elevated camera angle, shot with a 35mm lens at f/3.5 for environmental context with the product still sharp. Rich, warm color grading.

${HOME_DECOR_PRODUCT_LOCK}

${HOME_DECOR_REALISM}

LIVED-IN REALISM:
- Textiles: slight natural fabric wrinkles and draping, visible weave texture, not perfectly pressed or CGI-smooth
- Plants: natural leaf imperfections — slight browning tips, asymmetric growth, realistic soil texture
- Books: realistic spine creases, slightly varied page-edge coloring, authentic typography on visible spines
- Ceramics/pottery: visible glaze variations, slight handmade irregularities
- Ambient details: subtle dust particles visible in light beams, natural patina on metal accents

${HOME_DECOR_NEGATIVE}`,
};
