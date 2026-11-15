import {ECOCROP_BY_ID} from '../data/ecoCrop';
import {
  buildFallbackSeasonalOutlook,
  resolveTeleconnection,
} from './irrigationModel';
import type {
  EnsoPhase,
  EnsoScenarioMode,
  FarmInsightBundle,
  IrrigationMethodId,
  MonthlyPestRiskPoint,
  PestControlPosture,
  PestPrepChecklistItem,
  PestStrategyResult,
  RegionalThreatProfile,
  SeasonalEnsoOutlook,
  SlopeClass,
  ThreatGuild,
} from '../types/agronomy';

export type AgroBiomeId =
  | 'south_asia_monsoon'
  | 'california_med'
  | 'us_corn_belt'
  | 'pnw_cool_temperate'
  | 'latin_tropics'
  | 'africa_savanna'
  | 'east_se_asia'
  | 'oceania_semi_arid';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function resolveAgroBiome(
  lat: number,
  lon: number,
  country = ''
): {id: AgroBiomeId; label: string} {
  const c = country.toLowerCase();
  if (
    c.includes('india') ||
    c.includes('pakistan') ||
    c.includes('bangladesh') ||
    c.includes('sri lanka') ||
    (lon >= 66 && lon <= 93 && lat >= 6 && lat <= 36)
  ) {
    return {
      id: 'south_asia_monsoon',
      label: 'South Asia Monsoon & Deccan Belt',
    };
  }
  if (
    (lon >= -125 && lon <= -114 && lat >= 31 && lat <= 41) ||
    (lon >= -10 && lon <= 35 && lat >= 32 && lat <= 45)
  ) {
    return {
      id: 'california_med',
      label: 'Mediterranean & Semi-Arid Orchard Valley',
    };
  }
  if (lon >= -106 && lon <= -72 && lat >= 36 && lat <= 50) {
    return {
      id: 'us_corn_belt',
      label: 'North American Continental Grain Belt',
    };
  }
  if (
    (lon >= -126 && lon <= -106 && lat > 41 && lat <= 55) ||
    (lon >= -10 && lon <= 32 && lat > 45 && lat <= 60)
  ) {
    return {
      id: 'pnw_cool_temperate',
      label: 'Cool Temperate & Maritime Basin',
    };
  }
  if (lon >= -95 && lon <= -34 && lat >= -38 && lat <= 24) {
    return {
      id: 'latin_tropics',
      label: 'Latin American Tropical & Subtropical Belt',
    };
  }
  if (lon >= -18 && lon <= 52 && lat >= -35 && lat <= 31) {
    return {
      id: 'africa_savanna',
      label: 'Sub-Saharan & Savanna Cropping Zone',
    };
  }
  if (lon >= 110 && lon <= 160 && lat <= -10) {
    return {
      id: 'oceania_semi_arid',
      label: 'Oceania & Southern Semi-Arid Zone',
    };
  }
  if (lon > 93 && lon <= 150 && lat >= -10 && lat <= 46) {
    return {
      id: 'east_se_asia',
      label: 'East & Southeast Asian Monsoon Zone',
    };
  }
  return {
    id: 'pnw_cool_temperate',
    label: 'Temperate Continental Agro-Zone',
  };
}

interface IrrigationEpidemiologyEffect {
  fungalDelta: number;
  insectDelta: number;
  soilDelta: number;
  summary: string;
}

function getIrrigationEpidemiologyEffect(
  method: IrrigationMethodId,
  activeScenario: EnsoPhase
): IrrigationEpidemiologyEffect {
  switch (method) {
    case 'sprinkler':
      return {
        fungalDelta: 15,
        insectDelta: -7,
        soilDelta: 4,
        summary:
          'Overhead Sprinkler wets foliage and extends leaf-wetness hours (+15 fungal pressure), while physically washing off surface mites and thrips (-7 insect pressure).',
      };
    case 'drip':
      return {
        fungalDelta: -13,
        insectDelta: activeScenario === 'el_nino' ? 5 : 2,
        soilDelta: -5,
        summary:
          'Drip / SDI keeps the upper canopy dry (-13 fungal mildew risk), though dry inter-row dust and mild clear-sky foliage can favor spider mites and thrips unless mulched.',
      };
    case 'rain_pipes':
      return {
        fungalDelta: -6,
        insectDelta: -4,
        soilDelta: -4,
        summary:
          'Dawn-scheduled Rain Pipes maintain steady root turgor to deter drought-triggered sap pests while allowing quick solar drying of leaves before mid-morning.',
      };
    case 'furrow':
      return {
        fungalDelta: 7,
        insectDelta: -2,
        soilDelta: 15,
        summary:
          'Furrow / Surface Flood pools moisture at stems and elevates root-zone humidity (+15 collar/root rot risk, +7 lower-canopy mildew).',
      };
    case 'drainage':
      return {
        fungalDelta: -5,
        insectDelta: 0,
        soilDelta: -18,
        summary:
          'Active Contour & Tile Drainage clears standing storm water rapidly (-18 root/collar rot pressure during P90 rainfall spikes).',
      };
  }
}

interface ThreatTemplate {
  id: string;
  guild: ThreatGuild;
  commonName: string;
  scientificName: string;
  crops?: string[];
  categories?: string[];
  biomes?: AgroBiomeId[];
  optTempMin: number;
  optTempMax: number;
  wetnessWeight: number; // + favours wet/humid, - favours clear dry weather
  heatWeight: number; // + favours warm/hot
  soilMoistureSensitive?: boolean;
  weatherTrigger: string;
  earlyScoutingSign: string;
  culturalPrep: string;
  biologicalControl: string;
  targetedIntervention: string;
}

const REGIONAL_THREAT_CATALOG: ThreatTemplate[] = [
  // --- Grapes (India / Deccan + Mediterranean / California + PNW) ---
  {
    id: 'grape-downy-mildew',
    guild: 'fungal',
    commonName: 'Grape Downy Mildew',
    scientificName: 'Plasmopara viticola',
    crops: ['wine_grapes'],
    biomes: ['south_asia_monsoon', 'california_med', 'pnw_cool_temperate', 'oceania_semi_arid'],
    optTempMin: 16,
    optTempMax: 27,
    wetnessWeight: 1.35,
    heatWeight: -0.15,
    weatherTrigger: 'Prolonged rain > 65% RH, wet canopy > 4 hrs at 18–26°C (suppressed under clear dry El Niño skies).',
    earlyScoutingSign: 'Translucent "oil spots" on upper leaf surface with white cottony sporulation underneath.',
    culturalPrep: 'Open trellis canopy before rains, prune dense lateral shoots, and switch overhead wetting to drip or dawn-only passes.',
    biologicalControl: 'Preventive Trichoderma viride canopy wash + Bacillus subtilis (QST 713) bio-fungicide ahead of wet spells.',
    targetedIntervention: 'Apply copper hydroxide / mancozeb or potassium phosphonate only when rain-wetness forecast crosses 60% risk.',
  },
  {
    id: 'grape-thrips-india',
    guild: 'insect',
    commonName: 'Chilli & Grape Thrips',
    scientificName: 'Scirtothrips dorsalis / Frankliniella occidentalis',
    crops: ['wine_grapes'],
    optTempMin: 23,
    optTempMax: 37,
    wetnessWeight: -1.25,
    heatWeight: 0.9,
    weatherTrigger: 'Clear, sunny, low-rainfall weather (strong El Niño surge in India/monsoon belt or dry La Niña in West US).',
    earlyScoutingSign: 'Silvery-brown corky scarring ("halo") on young berries and curled upward shoot tips.',
    culturalPrep: 'Install 25–30 blue sticky traps per acre at bud-break, clear weed hosts along vineyard borders, and maintain mulch moisture.',
    biologicalControl: 'Release predatory mites (Amblyseius swirskii) or spray Beauveria bassiana + 5% Neem Seed Kernel Extract (NSKE) at dusk.',
    targetedIntervention: 'Rotate spinosad or emamectin benzoate strictly when tap-sampling exceeds 3 thrips per shoot tip.',
  },
  {
    id: 'grape-mealybug',
    guild: 'insect',
    commonName: 'Vine & Pink Hibiscus Mealybug',
    scientificName: 'Maconellicoccus hirsutus / Planococcus ficus',
    crops: ['wine_grapes'],
    optTempMin: 24,
    optTempMax: 38,
    wetnessWeight: -1.1,
    heatWeight: 0.85,
    weatherTrigger: 'Warm, dry clear spells with low natural rain wash-off and ant-tended bark crevices.',
    earlyScoutingSign: 'Cottony white wax clusters under loose bark, sticky honeydew on bunches, and black sooty mold.',
    culturalPrep: 'Debark old cordons pre-pruning, install sticky ant-barrier bands on vine trunks, and prune touching weed bridges.',
    biologicalControl: 'Release Cryptolaemus montrouzieri (Australian ladybird) at 600–1,000 beetles/ac + Verticillium lecanii.',
    targetedIntervention: 'Stem-wash or spot-treat infested spurs with buprofezin / spirotetramat prior to berry set.',
  },
  {
    id: 'grape-spider-mite',
    guild: 'insect',
    commonName: 'Two-Spotted Red Spider Mite',
    scientificName: 'Tetranychus urticae',
    crops: ['wine_grapes', 'almonds', 'apples', 'strawberries', 'tomatoes'],
    optTempMin: 25,
    optTempMax: 40,
    wetnessWeight: -1.3,
    heatWeight: 1.0,
    weatherTrigger: 'Hot, dusty, clear-sky drought periods and water-stressed vines under deficit conditions.',
    earlyScoutingSign: 'Yellow-bronze stippling on lower leaves and fine silk webbing along leaf midribs.',
    culturalPrep: 'Dust-suppress farm roads near rows, avoid excessive nitrogen flush, and keep consistent root hydration via Rain Pipes or drip.',
    biologicalControl: 'Introduce Phytoseiulus persimilis predatory mites and spray horticultural mineral oil or azadirachtin.',
    targetedIntervention: 'Targeted abamectin or hexythiazox miticide when counts exceed 5 motile mites per leaf.',
  },
  {
    id: 'grape-powdery-mildew',
    guild: 'fungal',
    commonName: 'Grape Powdery Mildew',
    scientificName: 'Erysiphe necator',
    crops: ['wine_grapes'],
    optTempMin: 19,
    optTempMax: 31,
    wetnessWeight: 0.35,
    heatWeight: 0.25,
    weatherTrigger: 'High morning humidity in shaded canopies even without heavy rain; thrives at 20–30°C.',
    earlyScoutingSign: 'Ash-gray powdery colonies on upper leaf faces, rachis stems, and immature green berries.',
    culturalPrep: 'Basal leaf pulling around cluster zone after fruit set to boost airflow and UV light penetration.',
    biologicalControl: 'Wettable elemental sulfur (avoid >32°C) or potassium bicarbonate + Ampelomyces quisqualis.',
    targetedIntervention: 'Rotate FRAC 3/11 DMI or strobilurin fungicides only during critical bloom-to-pea-size window.',
  },
  {
    id: 'grape-anthracnose-collar',
    guild: 'soil_vector',
    commonName: 'Anthracnose & Collar/Root Rot Complex',
    scientificName: 'Elsinoë ampelina / Phytophthora spp.',
    crops: ['wine_grapes'],
    optTempMin: 20,
    optTempMax: 32,
    wetnessWeight: 1.15,
    heatWeight: 0.1,
    soilMoistureSensitive: true,
    weatherTrigger: 'Sudden P90 storm bursts or prolonged wet soil around vine trunks.',
    earlyScoutingSign: 'Sunken "bird’s-eye" necrotic lesions on shoots/berries or darkened wet bark at the graft union.',
    culturalPrep: 'Clear inter-row surface drains ahead of monsoon/El Niño storms and keep drip emitters 12 in away from vine trunks.',
    biologicalControl: 'Apply Trichoderma harzianum drench around root collar zone before rainy onset.',
    targetedIntervention: 'Localized trunk/collar fosetyl-Al or copper oxychloride paste on poorly drained low spots.',
  },

  // --- Cereals: Corn, Wheat, Rice, Sorghum ---
  {
    id: 'corn-northern-blight',
    guild: 'fungal',
    commonName: 'Northern Corn Leaf Blight & Gray Leaf Spot',
    scientificName: 'Exserohilum turcicum / Cercospora zeae-maydis',
    crops: ['corn', 'sweet_corn', 'sorghum'],
    optTempMin: 18,
    optTempMax: 29,
    wetnessWeight: 1.2,
    heatWeight: 0.0,
    weatherTrigger: 'Warm humid nights, heavy dew, and frequent rainfall on continuous-corn residue.',
    earlyScoutingSign: 'Cigar-shaped gray-green lesions or rectangular matchstick spots on lower ear leaves.',
    culturalPrep: 'Rotate out of corn, shred/incorporate infected stubble, and favor resistant hybrids with high stay-green ratings.',
    biologicalControl: 'Bacillus amyloliquefaciens foliar bio-protectant at V10–VT if heavy humidity persists.',
    targetedIntervention: 'Single VT/R1 strobilurin + triazole application only when lesions reach ear-leaf minus-2.',
  },
  {
    id: 'corn-armyworm-earworm',
    guild: 'insect',
    commonName: 'Fall Armyworm & Corn Earworm',
    scientificName: 'Spodoptera frugiperda / Helicoverpa zea',
    crops: ['corn', 'sweet_corn', 'sorghum'],
    optTempMin: 22,
    optTempMax: 36,
    wetnessWeight: -0.95,
    heatWeight: 0.85,
    weatherTrigger: 'Warm dry early-summer winds and mild El Niño winter survival pushing early moth flights.',
    earlyScoutingSign: 'Windowpane leaf feeding in whorl and sawdust-like frass packed near emerging tassels.',
    culturalPrep: 'Plant early to escape peak late-summer moth flights and install pheromone bucket traps (2 per 10 ac) for flight timing.',
    biologicalControl: 'Egg parasitoid Trichogramma pretiosum releases + whorl-directed Bacillus thuringiensis (Bt kurstaki) or Metarhizium.',
    targetedIntervention: 'Whorl spray of chlorantraniliprole or spinetoram strictly if >20% whorls show fresh live larvae.',
  },
  {
    id: 'corn-rootworm-pythium',
    guild: 'soil_vector',
    commonName: 'Rootworm & Saturated Pythium Root Rot',
    scientificName: 'Diabrotica virgifera / Pythium spp.',
    crops: ['corn', 'sweet_corn', 'barley', 'winter_wheat'],
    optTempMin: 14,
    optTempMax: 28,
    wetnessWeight: 0.65,
    heatWeight: 0.1,
    soilMoistureSensitive: true,
    weatherTrigger: 'Saturated cold spring soils (Pythium) or dry mid-summer cracking clay weakening root recovery.',
    earlyScoutingSign: 'Goosenecked leaning stalks after summer windstorms or brown water-soaked seedling roots.',
    culturalPrep: 'Open tile outlets before spring rains, rotate with legumes/brassicas, and avoid planting into cold wet mud.',
    biologicalControl: 'Entomopathogenic nematodes (Heterorhabditis bacteriophora) or Trichoderma seed-coat treatment.',
    targetedIntervention: 'Targeted in-furrow biological/seed-treatment protection on second-year corn fields only.',
  },
  {
    id: 'rice-blast-sheath',
    guild: 'fungal',
    commonName: 'Rice Blast & Sheath Blight',
    scientificName: 'Magnaporthe oryzae / Rhizoctonia solani',
    crops: ['rice'],
    optTempMin: 21,
    optTempMax: 32,
    wetnessWeight: 1.3,
    heatWeight: 0.1,
    weatherTrigger: 'Cloudy monsoon skies, >85% RH, heavy morning dew, and excess basal urea nitrogen.',
    earlyScoutingSign: 'Diamond-shaped gray-center lesions on leaves/neck and snake-skin blotches near waterline.',
    culturalPrep: 'Split nitrogen into 3–4 modest doses, avoid over-dense transplanting, and drain mid-season for 4–5 days.',
    biologicalControl: 'Pseudomonas fluorescens seed/foliar treatment + Trichoderma viride soil amendment.',
    targetedIntervention: 'Booting-stage tricyclazole or azoxystrobin applied only if neck-blast risk exceeds threshold.',
  },
  {
    id: 'rice-bph-stemborer',
    guild: 'insect',
    commonName: 'Brown Planthopper & Yellow Stem Borer',
    scientificName: 'Nilaparvata lugens / Scirpophaga incertulas',
    crops: ['rice'],
    optTempMin: 24,
    optTempMax: 36,
    wetnessWeight: -0.75,
    heatWeight: 0.8,
    weatherTrigger: 'Warm humid breaks or dry El Niño water-level fluctuations concentrating nymphs at tillers.',
    earlyScoutingSign: 'Circular "hopperburn" yellowing patches and white deadheart tillers pulling free easily.',
    culturalPrep: 'Alternate Wetting & Drying (AWD) water schedule, leave 12-inch alleys every 10 ft for airflow, and keep bunds spider-friendly.',
    biologicalControl: 'Conserve mirid bugs & wolf spiders (avoid early broad-spectrum pyrethroids) + Beauveria bassiana.',
    targetedIntervention: 'Pymetrozine or dinotefuran targeted at tiller bases only if counts exceed 10 hoppers per hill.',
  },
  {
    id: 'wheat-rusts-fusarium',
    guild: 'fungal',
    commonName: 'Yellow / Stem Rust & Fusarium Head Blight',
    scientificName: 'Puccinia striiformis / Fusarium graminearum',
    crops: ['winter_wheat', 'barley', 'oats'],
    optTempMin: 11,
    optTempMax: 25,
    wetnessWeight: 1.2,
    heatWeight: -0.35,
    weatherTrigger: 'Cool-mild wet springs or La Niña storm moisture overlapping flowering (anthesis).',
    earlyScoutingSign: 'Bright yellow-orange pustule stripes along leaf veins or bleached pinkish spikelets.',
    culturalPrep: 'Select multi-gene rust-resistant varieties and avoid overhead sprinkler irrigation during flowering.',
    biologicalControl: 'Bacillus subtilis prophylactic spray at flag-leaf emergence in humid spring blocks.',
    targetedIntervention: 'Metconazole or prothioconazole at early anthesis only when Fusarium rain model triggers high alert.',
  },
  {
    id: 'cereal-aphid-bydv',
    guild: 'insect',
    commonName: 'Cereal Aphids & Barley Yellow Dwarf Vectors',
    scientificName: 'Rhopalosiphum padi / Sitobion avenae',
    crops: ['winter_wheat', 'barley', 'oats', 'sorghum'],
    optTempMin: 16,
    optTempMax: 31,
    wetnessWeight: -1.0,
    heatWeight: 0.65,
    weatherTrigger: 'Warm, clear dry autumn/spring days (El Niño/dry La Niña breaks) enabling rapid winged aphid migration.',
    earlyScoutingSign: 'Clustered green/black aphids inside flag leaf sheath and golden-red stunted leaf tips.',
    culturalPrep: 'Delay autumn planting past peak aphid flight window and maintain flowering hedgerow strips for hoverflies & lacewings.',
    biologicalControl: 'Conserve ladybeetles & Aphidius parasitoid wasps; apply potassium salts of fatty acids on hot-spots.',
    targetedIntervention: 'Flonicamid or sulfoxaflor spot spray only if colonies exceed 15 aphids per tiller before milk stage.',
  },

  // --- Legumes & Oilseeds (Soybeans, Chickpeas, Cotton, Canola) ---
  {
    id: 'legume-rust-ascochyta',
    guild: 'fungal',
    commonName: 'Soybean Rust / Ascochyta Blight',
    scientificName: 'Phakopsora pachyrhizi / Ascochyta rabiei',
    crops: ['soybeans', 'chickpeas', 'lentils', 'field_peas'],
    categories: ['Legumes'],
    optTempMin: 15,
    optTempMax: 27,
    wetnessWeight: 1.25,
    heatWeight: -0.1,
    weatherTrigger: 'Continuous wet cloudy canopy > 48 hrs and splash dispersal during heavy rains.',
    earlyScoutingSign: 'Tan-to-reddish-brown pustules on lower leaf undersides or concentric black pycnidia rings on stems.',
    culturalPrep: 'Use certified disease-free seed, widen row spacing for canopy breeze, and rotate 3 years away from legumes.',
    biologicalControl: 'Trichoderma seed treatment + foliar Bacillus subtilis protectant prior to monsoon/rain spells.',
    targetedIntervention: 'Azoxystrobin + triazole mix triggered only at R1–R3 when regional spore traps confirm arrival.',
  },
  {
    id: 'legume-podborer-whitefly',
    guild: 'insect',
    commonName: 'Pod Borer, Whitefly & Stink Bug Complex',
    scientificName: 'Helicoverpa armigera / Bemisia tabaci',
    crops: ['soybeans', 'chickpeas', 'lentils', 'cotton'],
    categories: ['Legumes', 'Oilseeds & Fiber'],
    optTempMin: 22,
    optTempMax: 38,
    wetnessWeight: -1.1,
    heatWeight: 0.9,
    weatherTrigger: 'Clear, dry, hot periods (El Niño drought stress) accelerating generation turnover.',
    earlyScoutingSign: 'Circular bored holes in green pods, whitefly clouds rising on canopy shake, and yellowing mosaic leaves.',
    culturalPrep: 'Plant marigold or pigeon-pea trap strips, set pheromone traps (5/ac), and mount yellow sticky cards for whitefly alerts.',
    biologicalControl: 'HaNPV (Helicoverpa Nuclear Polyhedrosis Virus) + Neem 1500 ppm + Chrysoperla lacewing releases.',
    targetedIntervention: 'Chlorantraniliprole or flonicamid threshold spray when larvae exceed 2 per meter row.',
  },
  {
    id: 'root-fusarium-wilt',
    guild: 'soil_vector',
    commonName: 'Fusarium Wilt & Charcoal / Phytophthora Root Rot',
    scientificName: 'Fusarium oxysporum / Macrophomina phaseolina',
    categories: ['Legumes', 'Oilseeds & Fiber', 'Vegetables & Specialty'],
    optTempMin: 20,
    optTempMax: 35,
    wetnessWeight: 0.35,
    heatWeight: 0.45,
    soilMoistureSensitive: true,
    weatherTrigger: 'Alternating waterlogging (Phytophthora) or hot dry soil compaction (Charcoal Rot).',
    earlyScoutingSign: 'Sudden single-branch wilting at midday and dark brown vascular streaking when stem base is split.',
    culturalPrep: 'Deep-chisel hardpans, raise beds on clay soils, and apply composted organic matter to boost antagonistic microbes.',
    biologicalControl: 'Trichoderma viride + Pseudomonas fluorescens bio-enriched compost furrow application at planting.',
    targetedIntervention: 'Preventive seed-box biological/fungicide coat; no curative chemical rescue once vascular wilt sets in.',
  },

  // --- Solanaceae, Tubers & Specialty Vegetables ---
  {
    id: 'solanaceae-late-blight',
    guild: 'fungal',
    commonName: 'Late Blight & Early Blight Complex',
    scientificName: 'Phytophthora infestans / Alternaria solani',
    crops: ['potatoes', 'tomatoes', 'onions', 'garlic', 'strawberries'],
    categories: ['Tubers & Roots', 'Vegetables & Specialty'],
    optTempMin: 12,
    optTempMax: 25,
    wetnessWeight: 1.4,
    heatWeight: -0.25,
    weatherTrigger: 'Cool-to-mild cloudy nights with >85% humidity, rain splash, or overhead sprinkler leaf wetting.',
    earlyScoutingSign: 'Water-soaked dark leaf blotches bordered by pale white mold ring at dawn.',
    culturalPrep: 'Eliminate volunteer tubers/cull piles, hill ridges cleanly, and replace overhead sprinklers with Drip or dawn Rain Pipes.',
    biologicalControl: 'Copper octanoate + Bacillus amyloliquefaciens weekly rotation during blight-watch humidity windows.',
    targetedIntervention: 'Cymoxanil or mandipropamid protective pass strictly when 7-day leaf-wetness risk exceeds 70%.',
  },
  {
    id: 'veg-whitefly-thrips-virus',
    guild: 'insect',
    commonName: 'Whitefly, Thrips & Aphid Virus Vectors',
    scientificName: 'Bemisia tabaci / Thrips tabaci / Myzus persicae',
    crops: ['tomatoes', 'potatoes', 'onions', 'garlic', 'lettuce', 'strawberries'],
    categories: ['Tubers & Roots', 'Vegetables & Specialty'],
    optTempMin: 22,
    optTempMax: 37,
    wetnessWeight: -1.15,
    heatWeight: 0.85,
    weatherTrigger: 'Warm, clear dry weeks (El Niño in monsoon tropics or dry La Niña in semi-arid basins) driving vector migration.',
    earlyScoutingSign: 'Upward leaf curling, yellow vein clearing (TYLCV / TSWV), and silvery streaks on onion foliage.',
    culturalPrep: 'Lay UV-reflective silver mulch along beds, erect 40-mesh insect-proof border windbreaks, and rogue early viral plants.',
    biologicalControl: 'Yellow + blue sticky cards (15/ac), Verticillium lecanii + azadirachtin foliar sprays.',
    targetedIntervention: 'Cyantraniliprole or spirotetramat rotation strictly at threshold to block secondary viral spread.',
  },

  // --- Temperate Orchards & Nut Crops ---
  {
    id: 'orchard-scab-brown-rot',
    guild: 'fungal',
    commonName: 'Apple Scab, Anthracnose & Brown Rot',
    scientificName: 'Venturia inaequalis / Monilinia fructicola',
    crops: ['apples', 'pears', 'cherries', 'almonds', 'citrus', 'olives'],
    categories: ['Fruits & Orchards'],
    optTempMin: 12,
    optTempMax: 25,
    wetnessWeight: 1.3,
    heatWeight: -0.15,
    weatherTrigger: 'Spring green-tip rains and high humidity during bloom/petal fall.',
    earlyScoutingSign: 'Velvety olive-green spots on young leaves and tannish-brown rotting mummies on spurs.',
    culturalPrep: 'Flail-mow or shred fallen leaves with 5% urea post-harvest to destroy overwintering spores; prune open centers.',
    biologicalControl: 'Bacillus subtilis + lime-sulfur / potassium bicarbonate timed strictly ahead of forecast rain events.',
    targetedIntervention: 'Captan or myclobutanil Mills-table spray only during verified infection-hour rain events.',
  },
  {
    id: 'orchard-codling-now-psylla',
    guild: 'insect',
    commonName: 'Codling Moth, Navel Orangeworm & Psyllids',
    scientificName: 'Cydia pomonella / Amyelois transitella / Diaphorina citri',
    crops: ['apples', 'pears', 'cherries', 'almonds', 'citrus', 'olives'],
    categories: ['Fruits & Orchards'],
    optTempMin: 20,
    optTempMax: 36,
    wetnessWeight: -0.95,
    heatWeight: 0.85,
    weatherTrigger: 'Warm, calm, clear twilight evenings accelerating degree-day egg-hatch flights.',
    earlyScoutingSign: 'Frass pushed out of fruit calyx/stem entry holes and sticky honeydew droplets on flush leaves.',
    culturalPrep: 'Remove all winter mummy nuts/fruits before spring bloom and hang pheromone mating-disruption dispensers.',
    biologicalControl: 'Granulosis virus (CpGV) + horticultural summer oil + release of parasitic wasps (Goniozus / Tamarixia).',
    targetedIntervention: 'Degree-day timed methoxyfenozide or spinetoram targeted at peak biofix + 250 GDD egg hatch.',
  },

  // --- Universal Forage / Cover / Fallback Templates ---
  {
    id: 'generic-foliar-fungal',
    guild: 'fungal',
    commonName: 'Canopy Leaf Spot, Rust & Downy Mildew',
    scientificName: 'Foliar Fungal & Oomycete Complex',
    optTempMin: 15,
    optTempMax: 28,
    wetnessWeight: 1.25,
    heatWeight: -0.1,
    weatherTrigger: 'Consecutive wet/humid days and prolonged evening canopy dew.',
    earlyScoutingSign: 'Circular necrotic leaf spots or powdery/rusty spore pustules on lower shaded leaves.',
    culturalPrep: 'Maintain weed-free air corridors, irrigate at dawn rather than dusk, and rotate out of host crop family.',
    biologicalControl: 'Bacillus subtilis / Trichoderma preventive canopy cover ahead of multi-day wet weather.',
    targetedIntervention: 'Protective copper or strobilurin spray triggered only when wet-week risk crosses high threshold.',
  },
  {
    id: 'generic-sap-sucking-insects',
    guild: 'insect',
    commonName: 'Thrips, Aphids, Whiteflies & Spider Mites',
    scientificName: 'Sap-Sucking & Vector Guild',
    optTempMin: 21,
    optTempMax: 38,
    wetnessWeight: -1.15,
    heatWeight: 0.9,
    weatherTrigger: 'Clear, dry, warm ENSO phases reducing rain wash-off and raising plant sap sugar stress.',
    earlyScoutingSign: 'Curled growing tips, leaf bronzing/stippling, and sticky honeydew on upper foliage.',
    culturalPrep: 'Deploy yellow/blue sticky monitoring traps, suppress field-edge dust, and maintain even root moisture.',
    biologicalControl: 'Neem (NSKE 5%) + Beauveria bassiana / Verticillium lecanii sprayed at dusk to protect pollinators.',
    targetedIntervention: 'Selective systemic/translaminar control rotated by IRAC mode of action only above scouting threshold.',
  },
  {
    id: 'generic-soil-collar-rot',
    guild: 'soil_vector',
    commonName: 'Root Collar Rot & Soil-Borne Wilt',
    scientificName: 'Phytophthora / Pythium / Fusarium Complex',
    optTempMin: 18,
    optTempMax: 33,
    wetnessWeight: 0.75,
    heatWeight: 0.25,
    soilMoistureSensitive: true,
    weatherTrigger: 'P90 storm waterlogging on clay/flat fields or abrupt wet-to-heat root stress transitions.',
    earlyScoutingSign: 'Patchy midday wilting despite damp soil and reddish-brown bark discoloration at crown.',
    culturalPrep: 'Ensure field outlet drains flow cleanly before heavy rain months and avoid ponding around plant stems.',
    biologicalControl: 'Trichoderma harzianum + compost tea root-zone drench prior to peak rain or planting.',
    targetedIntervention: 'Spot-treat low-lying saturated zones with phosphonate/biological protectant; improve surface drainage.',
  },
];

function matchThreatsForCropAndBiome(
  cropId: string,
  biome: AgroBiomeId
): ThreatTemplate[] {
  const eco = ECOCROP_BY_ID[cropId];
  const category = eco?.CAT ?? 'Cereals';

  const scored = REGIONAL_THREAT_CATALOG.map((tmpl) => {
    let relevance = 0;
    if (tmpl.crops?.includes(cropId)) relevance += 100;
    else if (tmpl.categories?.includes(category)) relevance += 55;
    else if (!tmpl.crops && !tmpl.categories) relevance += 20;
    else return null;

    if (tmpl.biomes) {
      relevance += tmpl.biomes.includes(biome) ? 25 : 5;
    } else {
      relevance += 12;
    }
    return {tmpl, relevance};
  }).filter((x): x is {tmpl: ThreatTemplate; relevance: number} => x !== null);

  scored.sort((a, b) => b.relevance - a.relevance);

  // Ensure all 3 guilds (fungal, insect, soil_vector) are well represented
  const selected: ThreatTemplate[] = [];
  const seenIds = new Set<string>();
  const guilds: ThreatGuild[] = ['fungal', 'insect', 'soil_vector'];

  // First pick highest-relevance per guild
  for (const g of guilds) {
    const match = scored.find((s) => s.tmpl.guild === g && !seenIds.has(s.tmpl.id));
    if (match) {
      selected.push(match.tmpl);
      seenIds.add(match.tmpl.id);
    }
  }
  // Fill up to 5 top threats
  for (const s of scored) {
    if (selected.length >= 5) break;
    if (!seenIds.has(s.tmpl.id)) {
      selected.push(s.tmpl);
      seenIds.add(s.tmpl.id);
    }
  }
  return selected;
}

function postureInstruction(
  tmpl: ThreatTemplate,
  posture: PestControlPosture
): string {
  if (posture === 'organic') {
    return `${tmpl.culturalPrep} Pair with ${tmpl.biologicalControl}`;
  }
  if (posture === 'conventional') {
    return `${tmpl.targetedIntervention} Support with sanitation: ${tmpl.culturalPrep}`;
  }
  // IPM (default): Monitor -> Cultural + Bio first -> Targeted spray only at threshold
  return `1) Scout: ${tmpl.earlyScoutingSign} 2) Bio/Cultural: ${tmpl.biologicalControl} 3) Threshold trigger: ${tmpl.targetedIntervention}`;
}

export function evaluatePestDiseaseStrategy(params: {
  bundle: FarmInsightBundle;
  outlook: SeasonalEnsoOutlook | null;
  cropId: string;
  slopeClass: SlopeClass;
  irrigationMethod: IrrigationMethodId;
  posture: PestControlPosture;
  scenarioMode: EnsoScenarioMode;
}): PestStrategyResult {
  const {
    bundle,
    cropId,
    slopeClass,
    irrigationMethod,
    posture,
    scenarioMode,
  } = params;

  const baseOutlook = params.outlook ?? buildFallbackSeasonalOutlook(bundle);
  const activeScenario: EnsoPhase =
    scenarioMode === 'live' ? baseOutlook.phase : scenarioMode;

  const biome = resolveAgroBiome(
    bundle.location.lat,
    bundle.location.lon,
    bundle.location.country
  );
  const tele = resolveTeleconnection(
    bundle.location.lat,
    bundle.location.lon,
    activeScenario
  );
  const irrEffect = getIrrigationEpidemiologyEffect(
    irrigationMethod,
    activeScenario
  );

  // If user is explicitly stress-testing El Niño / La Niña away from live baseline, apply full teleconnection delta
  const isManualStress = scenarioMode !== 'live' && scenarioMode !== baseOutlook.phase;
  const stressFactor = isManualStress ? 1.0 : 0.35;

  const clay = bundle.soil.clayPct ?? 25;
  const drainageBottleneck = clamp(
    (clay >= 35 ? 0.55 : clay >= 27 ? 0.3 : 0.12) +
      (slopeClass === 'flat' ? 0.25 : 0.05),
    0.1,
    0.92
  );

  const crop = ECOCROP_BY_ID[cropId];
  const cropName = crop?.CommonName ?? cropId;

  const matchedTemplates = matchThreatsForCropAndBiome(cropId, biome.id);
  const topFungalTmpl =
    matchedTemplates.find((t) => t.guild === 'fungal') ?? matchedTemplates[0];
  const topInsectTmpl =
    matchedTemplates.find((t) => t.guild === 'insect') ?? matchedTemplates[0];
  const topSoilTmpl =
    matchedTemplates.find((t) => t.guild === 'soil_vector') ?? matchedTemplates[0];

  const monthlyRisks: MonthlyPestRiskPoint[] = baseOutlook.months.map((m) => {
    const rainFactor = clamp(1 + (tele.rainShiftPct * stressFactor) / 100, 0.38, 1.85);
    const forecastPrecipMm = Math.round(m.precipMeanMm * rainFactor);
    const tempC = Number((m.tempMeanC + tele.tempShiftC * stressFactor).toFixed(1));
    const normal = Math.max(10, m.normalPrecipMm);
    const precipAnomalyPct = Math.round(((forecastPrecipMm - normal) / normal) * 100);

    // Derive humidity proxy from monthly baseline RH shifted by rainfall & thermal anomalies
    const normalClimate = bundle.monthlyClimate.find((c) => c.monthIndex === m.monthIndex);
    const baseRh = normalClimate?.relativeHumidityPct ?? 62;
    const rhShift = clamp(precipAnomalyPct * 0.28 - (tempC - m.normalTempC) * 2.2, -24, 22);
    const humidityProxyPct = Math.round(clamp(baseRh + rhShift, 24, 96));

    // Fungal / Oomycete index: boosted by high precip, RH >= 68%, mild-warm 14-28C, heavy rain days, and sprinkler/furrow irrigation
    const rainWetScore =
      clamp((forecastPrecipMm / 120) * 34, 4, 42) +
      clamp((humidityProxyPct - 42) * 0.68, 0, 34) +
      m.heavyRainDaysAvg * 4.5;
    const fungalTempFit =
      tempC >= 12 && tempC <= 29 ? 14 : tempC > 29 && tempC <= 34 ? 5 : -8;
    const clearDryDampening = precipAnomalyPct <= -15 ? precipAnomalyPct * 0.35 : 0;
    const fungalRisk = Math.round(
      clamp(rainWetScore + fungalTempFit + clearDryDampening + irrEffect.fungalDelta, 6, 97)
    );

    // Insect & Mite Vector index: boosted by warm/hot T >= 20C, clear dry skies (-rainAnomaly), low RH, & reduced wash-off
    const drynessSurge =
      clamp(-precipAnomalyPct * 0.42, -14, 26) +
      clamp((68 - humidityProxyPct) * 0.52, -10, 24) +
      (forecastPrecipMm < 45 ? 16 : forecastPrecipMm > 140 ? -12 : 4);
    const insectHeatFit =
      tempC >= 20 ? clamp((tempC - 16) * 2.1, 0, 34) : clamp((tempC - 10) * 1.1, -12, 8);
    const insectRisk = Math.round(
      clamp(22 + drynessSurge + insectHeatFit + irrEffect.insectDelta, 8, 97)
    );

    // Soil-borne / Collar Rot / Root Vector index: storm excess + drainage bottleneck + irrigation ponding
    const excessRainLoad = Math.max(0, forecastPrecipMm - 95) * 0.32 + m.heavyRainDaysAvg * 6;
    const soilTempFit = tempC >= 16 && tempC <= 33 ? 12 : 3;
    const soilVectorRisk = Math.round(
      clamp(
        14 +
          excessRainLoad * (0.55 + drainageBottleneck * 0.7) +
          soilTempFit +
          irrEffect.soilDelta,
        6,
        95
      )
    );

    let dominantGuild: ThreatGuild = 'fungal';
    let primaryAgentName = topFungalTmpl.commonName;
    let weatherDriverNote = `Humid canopy (${humidityProxyPct}% RH, ${forecastPrecipMm} mm rain)`;
    let preemptiveAction = topFungalTmpl.culturalPrep;

    if (insectRisk >= fungalRisk && insectRisk >= soilVectorRisk) {
      dominantGuild = 'insect';
      primaryAgentName = topInsectTmpl.commonName;
      weatherDriverNote =
        precipAnomalyPct < -8
          ? `Clear dry skies (${precipAnomalyPct}% rain anomaly, ${tempC}°C) favor sap pests`
          : `Warm canopy (${tempC}°C, ${humidityProxyPct}% RH) accelerates insect cycles`;
      preemptiveAction =
        posture === 'organic'
          ? topInsectTmpl.biologicalControl
          : topInsectTmpl.culturalPrep;
    } else if (soilVectorRisk > fungalRisk && soilVectorRisk > insectRisk) {
      dominantGuild = 'soil_vector';
      primaryAgentName = topSoilTmpl.commonName;
      weatherDriverNote = `Heavy storm burst & soil saturation (${Math.round(drainageBottleneck * 100)}% retention)`;
      preemptiveAction = topSoilTmpl.culturalPrep;
    }

    return {
      monthKey: m.monthKey,
      monthIndex: m.monthIndex,
      monthLabel: m.monthLabel,
      forecastPrecipMm,
      normalPrecipMm: m.normalPrecipMm,
      precipAnomalyPct,
      tempC,
      humidityProxyPct,
      fungalRisk,
      insectRisk,
      soilVectorRisk,
      dominantGuild,
      primaryAgentName,
      weatherDriverNote,
      preemptiveAction,
    };
  });

  const avgFungalRisk = Math.round(
    monthlyRisks.reduce((acc, m) => acc + m.fungalRisk, 0) / Math.max(1, monthlyRisks.length)
  );
  const avgInsectRisk = Math.round(
    monthlyRisks.reduce((acc, m) => acc + m.insectRisk, 0) / Math.max(1, monthlyRisks.length)
  );
  const peakFungalRisk = Math.max(...monthlyRisks.map((m) => m.fungalRisk));
  const peakInsectRisk = Math.max(...monthlyRisks.map((m) => m.insectRisk));
  const peakSoilVectorRisk = Math.max(...monthlyRisks.map((m) => m.soilVectorRisk));

  // Score each matched regional threat profile against the 6-month forecast
  const threats: RegionalThreatProfile[] = matchedTemplates
    .map((tmpl) => {
      const monthScores = monthlyRisks.map((mr) => {
        const tempInBand =
          mr.tempC >= tmpl.optTempMin && mr.tempC <= tmpl.optTempMax
            ? 14
            : mr.tempC >= tmpl.optTempMin - 4 && mr.tempC <= tmpl.optTempMax + 4
            ? 5
            : -10;
        const baseGuild =
          tmpl.guild === 'fungal'
            ? mr.fungalRisk
            : tmpl.guild === 'insect'
            ? mr.insectRisk
            : mr.soilVectorRisk;
        const rainSensitivityAdj =
          tmpl.wetnessWeight < 0
            ? clamp(-mr.precipAnomalyPct * 0.2, -10, 14)
            : clamp(mr.precipAnomalyPct * 0.2, -14, 14);
        const s = Math.round(clamp(baseGuild + tempInBand * 0.55 + rainSensitivityAdj * 0.45, 8, 98));
        return {monthLabel: mr.monthLabel, score: s};
      });

      const maxScore = Math.max(...monthScores.map((x) => x.score));
      const avgScore = Math.round(
        monthScores.reduce((a, b) => a + b.score, 0) / Math.max(1, monthScores.length)
      );
      const riskScore = Math.round(maxScore * 0.65 + avgScore * 0.35);
      const peakMonths = monthScores
        .filter((x) => x.score >= maxScore - 8)
        .slice(0, 3)
        .map((x) => x.monthLabel);

      const severity: RegionalThreatProfile['severity'] =
        riskScore >= 72
          ? 'critical'
          : riskScore >= 52
          ? 'high'
          : riskScore >= 34
          ? 'moderate'
          : 'low';

      const ensoShiftNote =
        tmpl.guild === 'insect'
          ? tele.rainShiftPct < -10
            ? `${activeScenario === 'el_nino' ? 'El Niño' : 'La Niña'} suppresses rainfall (${tele.rainShiftPct}%), keeping foliage unwashed and boosting reproduction.`
            : `${activeScenario === 'neutral' ? 'Neutral baseline' : 'Forecasted warm breaks'} allow steady seasonal pest buildup.`
          : tmpl.guild === 'fungal'
          ? tele.rainShiftPct < -10
            ? `Clearer skies (${tele.rainShiftPct}% rain shift) significantly cut foliar spore splash & wet-leaf infection hours.`
            : tele.rainShiftPct > 10
            ? `Higher rainfall (${tele.rainShiftPct > 0 ? '+' : ''}${tele.rainShiftPct}%) extends leaf wetness and accelerates sporulation.`
            : 'Moderate humidity windows dictate preventive protectant timing.'
          : drainageBottleneck >= 0.45
          ? 'Heavier clay / flat topography holds storm runoff at the collar zone.'
          : 'Well-drained soil mitigates root rot except during extreme P90 storm clusters.';

      const irrigationEffectNote =
        tmpl.guild === 'fungal'
          ? irrigationMethod === 'sprinkler'
            ? 'Overhead Sprinkler amplifies canopy humidity—shift passes to pre-dawn or transition toward Drip / Rain Pipes.'
            : irrigationMethod === 'drip'
            ? 'Drip / SDI keeps foliage dry, naturally suppressing spore germination.'
            : irrigationMethod === 'rain_pipes'
            ? 'Dawn Rain Pipe cycles allow rapid solar drying, avoiding prolonged wet-leaf risk.'
            : 'Keep lower canopy pruned high above furrow moisture.'
          : tmpl.guild === 'insect'
          ? irrigationMethod === 'drip'
            ? 'Dry inter-rows under Drip can favor mites & thrips; pair with inter-row mulch or border cover.'
            : irrigationMethod === 'rain_pipes'
            ? 'Consistent low-pressure Rain Pipe hydration avoids drought-stressed sugary sap attractive to sucking pests.'
            : irrigationMethod === 'sprinkler'
            ? 'Periodic sprinkler wetting helps suppress spider mite dust buildup.'
            : 'Avoid abrupt water-stress swings between furrow cycles.'
          : irrEffect.summary;

      return {
        id: tmpl.id,
        guild: tmpl.guild,
        commonName: tmpl.commonName,
        scientificName: tmpl.scientificName,
        riskScore,
        severity,
        peakMonths,
        weatherTrigger: tmpl.weatherTrigger,
        ensoShiftNote,
        irrigationEffectNote,
        earlyScoutingSign: tmpl.earlyScoutingSign,
        culturalPrep: tmpl.culturalPrep,
        biologicalControl: tmpl.biologicalControl,
        targetedIntervention: tmpl.targetedIntervention,
        recommendedActionForPosture: postureInstruction(tmpl, posture),
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  // Build concise plain-English strategy summary
  const rainShiftRounded = Math.round(tele.rainShiftPct * stressFactor);
  const tempShiftRounded = Number((tele.tempShiftC * stressFactor).toFixed(1));

  let headlineSummary = '';
  let fungalVsInsectSummary = '';

  if (avgInsectRisk >= avgFungalRisk + 8) {
    headlineSummary = `Insect & vector pressure leads (${peakInsectRisk}/100 peak) over fungal disease (${peakFungalRisk}/100) for ${cropName}`;
    fungalVsInsectSummary =
      rainShiftRounded < -8
        ? `Forecasted ${rainShiftRounded}% drier, clearer conditions reduce foliar fungal infections (${topFungalTmpl.commonName}) while creating ideal warm conditions for ${topInsectTmpl.commonName} and mites.`
        : `Warm canopy temperatures favor ${topInsectTmpl.commonName} buildup ahead of lower fungal pressure.`;
  } else if (avgFungalRisk >= avgInsectRisk + 8) {
    headlineSummary = `Fungal & blight vigilance leads (${peakFungalRisk}/100 peak) over insect pressure (${peakInsectRisk}/100) for ${cropName}`;
    fungalVsInsectSummary =
      rainShiftRounded > 8
        ? `Wetter seasonal outlook (+${rainShiftRounded}% rainfall) extends leaf wetness and elevates ${topFungalTmpl.commonName} risk, while rain wash-off curbs sap-sucking insects.`
        : `High ambient canopy humidity makes ${topFungalTmpl.commonName} the primary target before flowering and fruit/grain fill.`;
  } else {
    headlineSummary = `Dual fungal (${peakFungalRisk}/100) and insect (${peakInsectRisk}/100) protection window for ${cropName}`;
    fungalVsInsectSummary =
      'Transition months split between wet fungal infection windows and warm clear-sky insect flights—schedule monitoring traps and bio-protectants together.';
  }

  // Build categorized Pre-Season Prep Checklist
  const prepChecklist: PestPrepChecklistItem[] = [
    {
      id: 'prep-traps-scouting',
      category: 'monitoring',
      priority: peakInsectRisk >= 60 ? 'critical' : 'high',
      title: `Deploy sticky cards & pheromone traps for ${topInsectTmpl.commonName}`,
      detail: `Set yellow/blue sticky cards (15–25/ac) and pheromone lures at field edges 2 weeks before vegetative flush. Scout weekly for: ${topInsectTmpl.earlyScoutingSign}`,
      timingWindow: '2–3 weeks pre-flush',
    },
    {
      id: 'prep-bio-inoculants',
      category: 'biological_cultural',
      priority: posture === 'organic' || peakFungalRisk >= 55 ? 'critical' : 'high',
      title: `Stock Trichoderma, Beauveria & Neem/bio-fungicides (${posture.toUpperCase()} program)`,
      detail:
        avgInsectRisk >= avgFungalRisk
          ? `Prioritize ${topInsectTmpl.biologicalControl} before peak dry-warm months.`
          : `Stage ${topFungalTmpl.biologicalControl} ahead of forecast rain periods.`,
      timingWindow: 'Before peak month arrives',
    },
    {
      id: 'prep-canopy-sanitation',
      category: 'biological_cultural',
      priority: 'high',
      title: `Sanitize crop residue, alternate weed hosts & prune canopy airflow`,
      detail: `${topFungalTmpl.culturalPrep} Remove border host weeds that bridge ${topInsectTmpl.commonName} between seasons.`,
      timingWindow: 'Dormant / pre-plant prep',
    },
    {
      id: 'prep-irrigation-hygiene',
      category: 'irrigation_hygiene',
      priority: irrigationMethod === 'sprinkler' || peakSoilVectorRisk >= 55 ? 'critical' : 'moderate',
      title: `Align ${irrigationMethod === 'rain_pipes' ? 'Rain Pipes' : irrigationMethod === 'drip' ? 'Drip / SDI' : irrigationMethod === 'sprinkler' ? 'Sprinkler' : irrigationMethod === 'furrow' ? 'Furrow' : 'Drainage'} timing to break disease & sap-stress cycles`,
      detail: irrEffect.summary,
      timingWindow: 'Active growing season',
    },
    {
      id: 'prep-threshold-rescue',
      category: 'targeted_control',
      priority: threats[0]?.severity === 'critical' ? 'critical' : 'moderate',
      title: `Pre-stage threshold-triggered ${posture === 'organic' ? 'OMRI botanical/microbial' : 'selective FRAC/IRAC'} treatments`,
      detail:
        posture === 'organic'
          ? `Verify sprayer nozzle calibration for dusk application of botanical oils & bio-controls without harming pollinators.`
          : `Reserve ${threats[0]?.targetedIntervention ?? 'selective targeted sprays'} strictly for verified scouting thresholds to prevent resistance.`,
      timingWindow: 'On verified scouting trigger',
    },
  ];

  return {
    activeScenario,
    posture,
    regionLabel: biome.label,
    teleconnectionLabel: tele.label,
    teleconnectionRainShiftPct: rainShiftRounded,
    teleconnectionTempShiftC: tempShiftRounded,
    irrigationModifierSummary: irrEffect.summary,
    headlineSummary,
    fungalVsInsectSummary,
    peakFungalRisk,
    peakInsectRisk,
    peakSoilVectorRisk,
    avgFungalRisk,
    avgInsectRisk,
    monthlyRisks,
    threats,
    prepChecklist,
  };
}
