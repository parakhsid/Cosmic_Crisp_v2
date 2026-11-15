import type {CropSpec, EquipmentId, LocationOption} from '../types/agronomy';
import {ECOCROP_RECORDS, ecoRecordToCropSpec} from './ecoCrop';

export const ALL_EQUIPMENT_IDS: EquipmentId[] = [
  'tractor_tillage',
  'row_crop_planter',
  'grain_combine',
  'sprayer_spreader',
  'forage_baler',
  'potato_harvester',
  'cotton_picker',
  'paddy_harvester',
];

export const DEFAULT_OWNED_EQUIPMENT: EquipmentId[] = [
  'tractor_tillage',
  'row_crop_planter',
  'grain_combine',
  'sprayer_spreader',
];

export const CROP_SPECS: CropSpec[] = ECOCROP_RECORDS.map(ecoRecordToCropSpec);

export const CROP_SPECS_BY_ID: Record<string, CropSpec> = Object.fromEntries(
  CROP_SPECS.map((c) => [c.id, c])
);

export const GLOBAL_FARM_HUBS: LocationOption[] = [
  {
    id: 'story-ia',
    name: 'Story County, Iowa',
    region: 'Iowa',
    country: 'United States',
    lat: 42.036,
    lon: -93.465,
    climateZone: 'Humid Continental',
    usdaZone: '5a',
    traditionalCrops: [
      'corn',
      'soybeans',
      'alfalfa',
      'winter_wheat',
      'oats',
      'red_clover',
      'winter_rye_cover',
      'sweet_corn',
      'field_peas',
    ],
    regionalZoneLabel: 'US Corn Belt & Upper Midwest',
  },
  {
    id: 'yakima-wa',
    name: 'Yakima Valley, Washington',
    region: 'Washington',
    country: 'United States',
    lat: 46.6021,
    lon: -120.5059,
    climateZone: 'Semi-Arid Columbia Basin',
    usdaZone: '6b',
    traditionalCrops: [
      'apples',
      'hops',
      'winter_wheat',
      'potatoes',
      'cherries',
      'pears',
      'wine_grapes',
      'sweet_corn',
      'onions',
      'alfalfa',
      'lentils',
      'barley',
    ],
    regionalZoneLabel: 'US Pacific Northwest & Columbia Basin',
  },
  {
    id: 'fresno-ca',
    name: 'Fresno County, California',
    region: 'California',
    country: 'United States',
    lat: 36.7468,
    lon: -119.7726,
    climateZone: 'Semi-Arid Mediterranean',
    usdaZone: '9b',
    traditionalCrops: [
      'almonds',
      'wine_grapes',
      'tomatoes',
      'cotton',
      'alfalfa',
      'citrus',
      'garlic',
      'onions',
      'lettuce',
      'winter_wheat',
      'strawberries',
      'olives',
    ],
    regionalZoneLabel: 'California Central Valley',
  },
  {
    id: 'mclean-il',
    name: 'McLean County, Illinois',
    region: 'Illinois',
    country: 'United States',
    lat: 40.4842,
    lon: -88.9937,
    climateZone: 'Humid Continental',
    usdaZone: '5b',
    traditionalCrops: [
      'corn',
      'soybeans',
      'winter_wheat',
      'alfalfa',
      'squash_pumpkins',
      'oats',
      'winter_rye_cover',
      'red_clover',
      'daikon_radish',
    ],
    regionalZoneLabel: 'US Corn Belt & Upper Midwest',
  },
  {
    id: 'lubbock-tx',
    name: 'Lubbock County, Texas',
    region: 'Texas',
    country: 'United States',
    lat: 33.5779,
    lon: -101.8552,
    climateZone: 'Semi-Arid Steppe',
    usdaZone: '7b',
    traditionalCrops: [
      'cotton',
      'sorghum',
      'winter_wheat',
      'peanuts',
      'sunflower',
      'sesame',
      'sorghum_sudangrass',
      'cowpeas',
      'safflower',
    ],
    regionalZoneLabel: 'US Southern High Plains',
  },
  {
    id: 'tifton-ga',
    name: 'Tift County, Georgia',
    region: 'Georgia',
    country: 'United States',
    lat: 31.4505,
    lon: -83.5085,
    climateZone: 'Humid Subtropical',
    usdaZone: '8b',
    traditionalCrops: [
      'peanuts',
      'cotton',
      'corn',
      'soybeans',
      'sweet_potatoes',
      'blueberries',
      'watermelon',
      'okra',
      'crimson_clover',
      'sunn_hemp',
    ],
    regionalZoneLabel: 'US Southeast Coastal Plain',
  },
  {
    id: 'ludhiana-in',
    name: 'Ludhiana, Punjab',
    region: 'Punjab',
    country: 'India',
    lat: 30.901,
    lon: 75.8573,
    climateZone: 'Subtropical Monsoon',
    usdaZone: '10a',
    traditionalCrops: [
      'rice',
      'winter_wheat',
      'potatoes',
      'mustard',
      'mung_beans',
      'chickpeas',
      'corn',
      'cotton',
      'berseem_clover',
      'onions',
      'cabbage',
      'lentils',
    ],
    regionalZoneLabel: 'Indo-Gangetic Kharif-Rabi Plain',
  },
  {
    id: 'nashik-in',
    name: 'Nashik, Maharashtra',
    region: 'Maharashtra',
    country: 'India',
    lat: 19.9975,
    lon: 73.7898,
    climateZone: 'Tropical Semi-Arid',
    usdaZone: '11a',
    traditionalCrops: [
      'onions',
      'wine_grapes',
      'soybeans',
      'chickpeas',
      'pigeon_peas',
      'cotton',
      'sorghum',
      'pearl_millet',
      'tomatoes',
      'chili_peppers',
      'peanuts',
      'mangoes',
    ],
    regionalZoneLabel: 'Deccan Plateau & Western India',
  },
  {
    id: 'sorriso-br',
    name: 'Sorriso, Mato Grosso',
    region: 'Mato Grosso',
    country: 'Brazil',
    lat: -12.5425,
    lon: -55.7211,
    climateZone: 'Tropical Savanna',
    usdaZone: '11b',
    traditionalCrops: [
      'soybeans',
      'corn',
      'cotton',
      'sorghum',
      'rice',
      'cowpeas',
      'sesame',
      'sunn_hemp',
      'cassava',
      'common_beans',
    ],
    regionalZoneLabel: 'Brazilian Cerrado Belt',
  },
  {
    id: 'londrina-br',
    name: 'Londrina, Paraná',
    region: 'Paraná',
    country: 'Brazil',
    lat: -23.3045,
    lon: -51.1696,
    climateZone: 'Humid Subtropical',
    usdaZone: '10a',
    traditionalCrops: [
      'soybeans',
      'corn',
      'winter_wheat',
      'common_beans',
      'oats',
      'barley',
      'coffee',
      'citrus',
      'cassava',
      'triticale',
    ],
    regionalZoneLabel: 'Southern Brazil & Subtropical Plateaus',
  },
  {
    id: 'beauce-fr',
    name: 'Chartres, Eure-et-Loir',
    region: 'Centre-Val de Loire',
    country: 'France',
    lat: 48.4439,
    lon: 1.489,
    climateZone: 'Temperate Maritime',
    usdaZone: '8a',
    traditionalCrops: [
      'winter_wheat',
      'barley',
      'canola',
      'sugar_beet',
      'potatoes',
      'corn',
      'faba_beans',
      'field_peas',
      'flax',
      'onions',
      'mustard',
      'phacelia',
    ],
    regionalZoneLabel: 'Western European Maritime Cereal Plain',
  },
  {
    id: 'cordoba-es',
    name: 'Córdoba, Andalusia',
    region: 'Andalusia',
    country: 'Spain',
    lat: 37.8882,
    lon: -4.7794,
    climateZone: 'Mediterranean',
    usdaZone: '9b',
    traditionalCrops: [
      'olives',
      'durum_wheat',
      'sunflower',
      'chickpeas',
      'almonds',
      'wine_grapes',
      'barley',
      'cotton',
      'citrus',
      'garlic',
      'tomatoes',
      'winter_wheat',
    ],
    regionalZoneLabel: 'Mediterranean & Iberian Basin',
  },
  {
    id: 'nakuru-ke',
    name: 'Nakuru, Rift Valley',
    region: 'Rift Valley',
    country: 'Kenya',
    lat: -0.3031,
    lon: 36.08,
    climateZone: 'Tropical Highland',
    usdaZone: '10b',
    traditionalCrops: [
      'corn',
      'common_beans',
      'potatoes',
      'winter_wheat',
      'coffee',
      'avocados',
      'cabbage',
      'finger_millet',
      'barley',
      'onions',
      'chickpeas',
    ],
    regionalZoneLabel: 'East African Rift Highlands',
  },
  {
    id: 'pergamino-ar',
    name: 'Pergamino, Buenos Aires',
    region: 'Buenos Aires',
    country: 'Argentina',
    lat: -33.89,
    lon: -60.5736,
    climateZone: 'Humid Pampas',
    usdaZone: '9a',
    traditionalCrops: [
      'soybeans',
      'corn',
      'winter_wheat',
      'sunflower',
      'barley',
      'sorghum',
      'alfalfa',
      'oats',
      'field_peas',
    ],
    regionalZoneLabel: 'Argentine Humid Pampas',
  },
  {
    id: 'saskatoon-ca',
    name: 'Saskatoon, Saskatchewan',
    region: 'Saskatchewan',
    country: 'Canada',
    lat: 52.1332,
    lon: -106.67,
    climateZone: 'Northern Continental Prairie',
    usdaZone: '3b',
    traditionalCrops: [
      'canola',
      'spring_wheat',
      'lentils',
      'field_peas',
      'barley',
      'oats',
      'flax',
      'durum_wheat',
      'chickpeas',
      'mustard',
      'camelina',
      'timothy_hay',
    ],
    regionalZoneLabel: 'Canadian Prairies & Northern Plains',
  },
  {
    id: 'cantho-vn',
    name: 'Cần Thơ, Mekong Delta',
    region: 'Mekong Delta',
    country: 'Vietnam',
    lat: 10.0452,
    lon: 105.7469,
    climateZone: 'Tropical Monsoon Delta',
    usdaZone: '12a',
    traditionalCrops: [
      'rice',
      'mangoes',
      'bananas',
      'sweet_potatoes',
      'taro',
      'mung_beans',
      'soybeans',
      'okra',
      'watermelon',
      'chili_peppers',
      'cassava',
    ],
    regionalZoneLabel: 'Southeast Asian Monsoon Delta',
  },
];

interface RegionalRule {
  zoneLabel: string;
  match: (ctx: {
    country: string;
    region: string;
    name: string;
    lat: number;
    lon: number;
  }) => boolean;
  crops: string[];
}

const REGIONAL_MATRIX: RegionalRule[] = [
  {
    zoneLabel: 'US Pacific Northwest & Columbia Basin',
    match: ({country, region, lat, lon}) =>
      (/washington|oregon|idaho/i.test(region) && /united states|usa/i.test(country)) ||
      (lat >= 43.2 && lat <= 49.0 && lon >= -124.8 && lon <= -114.0),
    crops: [
      'apples',
      'winter_wheat',
      'hops',
      'potatoes',
      'cherries',
      'pears',
      'wine_grapes',
      'lentils',
      'field_peas',
      'barley',
      'sweet_corn',
      'onions',
      'alfalfa',
      'blueberries',
    ],
  },
  {
    zoneLabel: 'California Central Valley & Coast',
    match: ({country, region, lat, lon}) =>
      (/california/i.test(region) && /united states|usa/i.test(country)) ||
      (lat >= 32.5 && lat <= 41.5 && lon >= -124.5 && lon <= -114.5),
    crops: [
      'almonds',
      'wine_grapes',
      'tomatoes',
      'strawberries',
      'lettuce',
      'alfalfa',
      'cotton',
      'citrus',
      'garlic',
      'onions',
      'artichokes',
      'olives',
      'rice',
      'carrots',
    ],
  },
  {
    zoneLabel: 'US Corn Belt & Upper Midwest',
    match: ({region, lat, lon}) =>
      /iowa|illinois|indiana|nebraska|minnesota|wisconsin|michigan|ohio|missouri|south dakota/i.test(
        region
      ) || (lat >= 38.0 && lat <= 47.0 && lon >= -100.0 && lon <= -80.5),
    crops: [
      'corn',
      'soybeans',
      'alfalfa',
      'winter_wheat',
      'oats',
      'sweet_corn',
      'squash_pumpkins',
      'red_clover',
      'winter_rye_cover',
      'daikon_radish',
      'apples',
      'sugar_beet',
    ],
  },
  {
    zoneLabel: 'US Southern & High Plains',
    match: ({region, lat, lon}) =>
      /texas|oklahoma|kansas|new mexico|colorado/i.test(region) ||
      (lat >= 28.0 && lat <= 39.5 && lon >= -107.0 && lon <= -94.5),
    crops: [
      'cotton',
      'winter_wheat',
      'sorghum',
      'corn',
      'sunflower',
      'peanuts',
      'sesame',
      'alfalfa',
      'sorghum_sudangrass',
      'cowpeas',
      'safflower',
      'chili_peppers',
    ],
  },
  {
    zoneLabel: 'US Southeast & Delta',
    match: ({region, lat, lon}) =>
      /georgia|florida|alabama|mississippi|louisiana|arkansas|north carolina|south carolina|tennessee|virginia/i.test(
        region
      ) || (lat >= 25.0 && lat <= 37.8 && lon >= -94.5 && lon <= -75.0),
    crops: [
      'peanuts',
      'cotton',
      'soybeans',
      'corn',
      'sweet_potatoes',
      'rice',
      'blueberries',
      'citrus',
      'watermelon',
      'tomatoes',
      'okra',
      'crimson_clover',
      'sunn_hemp',
    ],
  },
  {
    zoneLabel: 'US Northeast & Mid-Atlantic',
    match: ({region, lat, lon}) =>
      /new york|pennsylvania|vermont|maine|massachusetts|new jersey|maryland|delaware|connecticut|new hampshire/i.test(
        region
      ) || (lat >= 38.5 && lat <= 47.5 && lon >= -80.5 && lon <= -66.9),
    crops: [
      'corn',
      'apples',
      'soybeans',
      'alfalfa',
      'timothy_hay',
      'potatoes',
      'winter_wheat',
      'cabbage',
      'squash_pumpkins',
      'blueberries',
      'oats',
      'winter_rye_cover',
      'red_clover',
    ],
  },
  {
    zoneLabel: 'Canadian Prairies & Northern Plains',
    match: ({country, region, lat, lon}) =>
      /canada/i.test(country) ||
      /saskatchewan|alberta|manitoba|ontario|quebec|montana|north dakota/i.test(region) ||
      (lat >= 46.5 && lat <= 60.0 && lon >= -125.0 && lon <= -60.0),
    crops: [
      'canola',
      'spring_wheat',
      'lentils',
      'field_peas',
      'barley',
      'oats',
      'flax',
      'durum_wheat',
      'mustard',
      'camelina',
      'potatoes',
      'timothy_hay',
      'rye',
    ],
  },
  {
    zoneLabel: 'Indo-Gangetic Kharif-Rabi Plain',
    match: ({country, region, lat, lon}) =>
      (/india|pakistan|bangladesh|nepal/i.test(country) &&
        (/punjab|haryana|uttar|bihar|bengal|sindh/i.test(region) || lat >= 24.0)) ||
      (lat >= 23.5 && lat <= 33.5 && lon >= 68.0 && lon <= 90.0),
    crops: [
      'rice',
      'winter_wheat',
      'mustard',
      'potatoes',
      'chickpeas',
      'mung_beans',
      'lentils',
      'corn',
      'cotton',
      'berseem_clover',
      'onions',
      'cabbage',
      'eggplant',
    ],
  },
  {
    zoneLabel: 'Deccan Plateau & Peninsular South Asia',
    match: ({country, lat, lon}) =>
      /india|sri lanka/i.test(country) ||
      (lat >= 7.5 && lat < 23.5 && lon >= 68.0 && lon <= 88.0),
    crops: [
      'cotton',
      'soybeans',
      'chickpeas',
      'pigeon_peas',
      'sorghum',
      'pearl_millet',
      'finger_millet',
      'onions',
      'peanuts',
      'rice',
      'chili_peppers',
      'okra',
      'mangoes',
      'bananas',
    ],
  },
  {
    zoneLabel: 'Mediterranean & Iberian / Italian / Levant Basin',
    match: ({country, lat, lon}) =>
      /spain|italy|greece|portugal|morocco|tunisia|algeria|turkey|israel|lebanon|syria/i.test(
        country
      ) || (lat >= 31.0 && lat <= 44.5 && lon >= -9.5 && lon <= 36.5),
    crops: [
      'olives',
      'durum_wheat',
      'wine_grapes',
      'almonds',
      'citrus',
      'tomatoes',
      'sunflower',
      'chickpeas',
      'barley',
      'garlic',
      'artichokes',
      'onions',
      'watermelon',
    ],
  },
  {
    zoneLabel: 'Western & Central European Cereal-Root Belt',
    match: ({country, lat, lon}) =>
      /france|germany|united kingdom|uk|ireland|belgium|netherlands|poland|denmark|czech|austria|switzerland|ukraine|romania|hungary/i.test(
        country
      ) || (lat > 44.5 && lat <= 57.5 && lon >= -10.5 && lon <= 38.0),
    crops: [
      'winter_wheat',
      'barley',
      'canola',
      'sugar_beet',
      'potatoes',
      'corn',
      'triticale',
      'faba_beans',
      'field_peas',
      'rye',
      'oats',
      'flax',
      'apples',
      'hops',
      'perennial_ryegrass',
    ],
  },
  {
    zoneLabel: 'Nordic & Boreal Northern Belt',
    match: ({country, lat}) =>
      /sweden|norway|finland|iceland|estonia|latvia|lithuania/i.test(country) ||
      lat > 57.5,
    crops: [
      'barley',
      'oats',
      'spring_wheat',
      'rye',
      'potatoes',
      'canola',
      'field_peas',
      'faba_beans',
      'timothy_hay',
      'red_clover',
      'turnips',
      'carrots',
    ],
  },
  {
    zoneLabel: 'Brazilian Cerrado & Tropical South America',
    match: ({country, region, lat, lon}) =>
      (/brazil|colombia|venezuela|paraguay/i.test(country) &&
        !/paraná|rio grande|santa catarina/i.test(region)) ||
      (lat >= -19.5 && lat <= 10.0 && lon >= -78.0 && lon <= -34.0),
    crops: [
      'soybeans',
      'corn',
      'cotton',
      'coffee',
      'cassava',
      'rice',
      'sorghum',
      'common_beans',
      'cowpeas',
      'bananas',
      'cocoa',
      'mangoes',
      'sunn_hemp',
    ],
  },
  {
    zoneLabel: 'Subtropical Pampas & Southern Cone',
    match: ({country, region, lat, lon}) =>
      /argentina|uruguay|chile/i.test(country) ||
      /paraná|rio grande|santa catarina/i.test(region) ||
      (lat < -19.5 && lat >= -46.0 && lon >= -75.0 && lon <= -48.0),
    crops: [
      'soybeans',
      'corn',
      'winter_wheat',
      'sunflower',
      'barley',
      'wine_grapes',
      'alfalfa',
      'oats',
      'apples',
      'sorghum',
      'peanuts',
      'citrus',
      'olives',
    ],
  },
  {
    zoneLabel: 'Mesoamerica & Andean Highlands',
    match: ({country, lat, lon}) =>
      /mexico|guatemala|peru|ecuador|bolivia|honduras|costa rica|nicaragua/i.test(
        country
      ) || (lat >= -20.0 && lat <= 26.0 && lon >= -116.0 && lon <= -65.0),
    crops: [
      'corn',
      'common_beans',
      'avocados',
      'coffee',
      'potatoes',
      'quinoa',
      'chili_peppers',
      'tomatoes',
      'squash_pumpkins',
      'cocoa',
      'bananas',
      'sorghum',
    ],
  },
  {
    zoneLabel: 'East African Rift & Ethiopian Highlands',
    match: ({country, lat, lon}) =>
      /kenya|ethiopia|uganda|tanzania|rwanda|burundi/i.test(country) ||
      (lat >= -11.0 && lat <= 14.0 && lon >= 29.0 && lon <= 48.0),
    crops: [
      'corn',
      'common_beans',
      'coffee',
      'potatoes',
      'teff',
      'sorghum',
      'finger_millet',
      'bananas',
      'avocados',
      'cabbage',
      'winter_wheat',
      'chickpeas',
    ],
  },
  {
    zoneLabel: 'West & Central African Savanna-Forest Belt',
    match: ({country, lat, lon}) =>
      /nigeria|ghana|ivory coast|côte d|senegal|mali|burkina|cameroon|niger|benin|togo/i.test(
        country
      ) || (lat >= -5.0 && lat <= 18.0 && lon >= -18.0 && lon < 29.0),
    crops: [
      'cassava',
      'yams',
      'sorghum',
      'pearl_millet',
      'cowpeas',
      'peanuts',
      'corn',
      'rice',
      'cocoa',
      'okra',
      'sesame',
      'cotton',
      'sweet_potatoes',
    ],
  },
  {
    zoneLabel: 'Southeast Asian Monsoon & Tropical Islands',
    match: ({country, lat, lon}) =>
      /vietnam|thailand|indonesia|philippines|malaysia|myanmar|cambodia|laos/i.test(
        country
      ) || (lat >= -10.0 && lat <= 23.0 && lon >= 92.0 && lon <= 141.0),
    crops: [
      'rice',
      'cassava',
      'corn',
      'coffee',
      'cocoa',
      'bananas',
      'mangoes',
      'sweet_potatoes',
      'taro',
      'mung_beans',
      'peanuts',
      'chili_peppers',
      'okra',
    ],
  },
  {
    zoneLabel: 'East Asian Temperate-Subtropical Belt',
    match: ({country, lat, lon}) =>
      /china|japan|south korea|korea|taiwan/i.test(country) ||
      (lat > 23.0 && lat <= 46.0 && lon >= 100.0 && lon <= 146.0),
    crops: [
      'rice',
      'winter_wheat',
      'corn',
      'soybeans',
      'sweet_potatoes',
      'potatoes',
      'apples',
      'pears',
      'cabbage',
      'garlic',
      'onions',
      'peanuts',
      'canola',
      'citrus',
    ],
  },
  {
    zoneLabel: 'Australian & New Zealand Agro-Pastoral Belt',
    match: ({country, lat, lon}) =>
      /australia|new zealand/i.test(country) ||
      (lat <= -11.0 && lat >= -47.0 && lon >= 112.0 && lon <= 179.0),
    crops: [
      'winter_wheat',
      'barley',
      'canola',
      'lupins',
      'chickpeas',
      'lentils',
      'cotton',
      'sorghum',
      'wine_grapes',
      'oats',
      'perennial_ryegrass',
      'apples',
      'almonds',
    ],
  },
  {
    zoneLabel: 'Arid Middle East & North African Oasis/Steppe',
    match: ({country, lat, lon}) =>
      /egypt|saudi|jordan|iraq|iran|oman|uae|yemen|sudan|libya/i.test(country) ||
      (lat >= 15.0 && lat <= 35.0 && lon >= 25.0 && lon <= 62.0),
    crops: [
      'durum_wheat',
      'barley',
      'chickpeas',
      'sorghum',
      'pearl_millet',
      'olives',
      'citrus',
      'onions',
      'tomatoes',
      'garlic',
      'sesame',
      'berseem_clover',
      'alfalfa',
    ],
  },
];

export interface RegionalCropProfile {
  crops: string[];
  zoneLabel: string;
}

export function inferRegionalCropProfile(
  loc: LocationOption,
  climateHint?: {meanTempC?: number; annualPrecipMm?: number; coldestTempC?: number}
): RegionalCropProfile {
  if (loc.traditionalCrops?.length) {
    return {
      crops: loc.traditionalCrops,
      zoneLabel: loc.regionalZoneLabel || loc.climateZone || loc.region,
    };
  }

  const matchedHub = GLOBAL_FARM_HUBS.find(
    (h) =>
      h.id === loc.id ||
      (Math.abs(h.lat - loc.lat) < 1.8 && Math.abs(h.lon - loc.lon) < 1.8)
  );
  if (matchedHub?.traditionalCrops?.length) {
    return {
      crops: matchedHub.traditionalCrops,
      zoneLabel: matchedHub.regionalZoneLabel || matchedHub.climateZone,
    };
  }

  const ctx = {
    country: loc.country || '',
    region: loc.region || '',
    name: loc.name || '',
    lat: loc.lat,
    lon: loc.lon,
  };

  for (const rule of REGIONAL_MATRIX) {
    if (rule.match(ctx)) {
      return {
        crops: rule.crops,
        zoneLabel: rule.zoneLabel,
      };
    }
  }

  // Climate-driven Köppen biome fallback for unmapped coordinates (oceans/remote islands)
  const absLat = Math.abs(loc.lat);
  const meanTemp = climateHint?.meanTempC ?? 26 - absLat * 0.42;
  const annualPrecip = climateHint?.annualPrecipMm ?? (absLat < 22 ? 1350 : 720);

  if (meanTemp >= 23 && annualPrecip >= 1100) {
    return {
      crops: [
        'rice',
        'cassava',
        'bananas',
        'cocoa',
        'cowpeas',
        'sweet_potatoes',
        'taro',
        'mangoes',
        'okra',
      ],
      zoneLabel: 'Tropical Humid Agro-Zone',
    };
  }
  if (meanTemp >= 21 && annualPrecip < 650) {
    return {
      crops: [
        'sorghum',
        'pearl_millet',
        'cowpeas',
        'sesame',
        'chickpeas',
        'peanuts',
        'cotton',
        'safflower',
      ],
      zoneLabel: 'Semi-Arid Tropical Steppe',
    };
  }
  if (meanTemp >= 15 && meanTemp < 23 && annualPrecip < 650) {
    return {
      crops: [
        'olives',
        'durum_wheat',
        'chickpeas',
        'almonds',
        'wine_grapes',
        'barley',
        'sunflower',
        'garlic',
      ],
      zoneLabel: 'Mediterranean & Dry Subtropical',
    };
  }
  if (absLat < 47) {
    return {
      crops: [
        'corn',
        'soybeans',
        'winter_wheat',
        'alfalfa',
        'sunflower',
        'apples',
        'potatoes',
        'oats',
      ],
      zoneLabel: 'Temperate Arable Belt',
    };
  }
  return {
    crops: [
      'winter_wheat',
      'barley',
      'canola',
      'oats',
      'potatoes',
      'field_peas',
      'rye',
      'timothy_hay',
    ],
    zoneLabel: 'Cool Continental & Boreal',
  };
}

export function inferTraditionalRegionalCrops(loc: LocationOption): string[] {
  return inferRegionalCropProfile(loc).crops;
}

export function makeLocationKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}
