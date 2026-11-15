import dotenv from 'dotenv';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  addHarvestLog,
  appendAlertHistory,
  applySyncMutations,
  checkDbHealth,
  createFarmProfile,
  DEFAULT_THRESHOLDS,
  getFarmById,
  listFarmSummaries,
  patchFarmSettings,
  removeHarvestLog,
  updateAlertThresholds,
} from './server/db.ts';
import {
  analyzeGeospatialWithGemini,
  type GeospatialIngestionPayload,
} from './server/aiAnalysis.ts';
import {runPythonGeospatialIngestion} from './server/geospatialBridge.ts';
import {
  validateAiAnalyzeRequest,
  validateAlertHistoryEntry,
  validateAlertThresholds,
  validateCreateFarm,
  validateGeospatialIngestRequest,
  validateHarvestLogInput,
  validatePredictRequest,
  validateSettingsPatch,
  validateSyncMutations,
} from './server/validation.ts';
import {
  GLOBAL_FARM_HUBS,
  inferRegionalCropProfile,
  makeLocationKey,
} from './src/data/cropsAndLocations.ts';
import {
  buildRegionalFallbackBundle,
  classifySlope,
  estimateFrostFreeDays,
} from './src/data/fallbackClimate.ts';
import {
  evaluateWeatherAlerts,
  predictNextCrops,
} from './src/lib/statisticalModel.ts';
import type {
  CurrentWeatherSnapshot,
  DailyForecastPoint,
  FarmInsightBundle,
  LocationOption,
  MonthlyClimatePoint,
  PredictApiResponse,
  SoilDepthLayer,
  SoilProfile,
  YearlyAnomalyPoint,
} from './src/types/agronomy.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function classifyTexture(clay: number, sand: number): string {
  const silt = Math.max(0, 100 - clay - sand);
  if (clay >= 40) return 'Clay';
  if (clay >= 27 && sand < 20) return 'Silty Clay Loam';
  if (clay >= 27 && sand <= 45) return 'Clay Loam';
  if (sand >= 70 && clay < 15) return 'Sandy Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  return 'Loam';
}

function estimateUsdaZone(minMonthlyTempC: number): string {
  const winterF = minMonthlyTempC * 1.8 + 32 - 14;
  if (winterF < -20) return '4b';
  if (winterF < -10) return '5b';
  if (winterF < 0) return '6b';
  if (winterF < 10) return '7b';
  if (winterF < 20) return '8b';
  if (winterF < 30) return '9b';
  if (winterF < 40) return '10a';
  return '11a';
}

async function fetchWithTimeout(url: string, timeoutMs = 5500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {'User-Agent': 'CosmicCrisp-Agronomy-App/1.0'},
    });
  } finally {
    clearTimeout(timer);
  }
}

const CDL_NAME_TO_CROP_ID: Record<string, string> = {
  corn: 'corn',
  'sweet corn': 'sweet_corn',
  'pop or orn corn': 'corn',
  soybeans: 'soybeans',
  'winter wheat': 'winter_wheat',
  'spring wheat': 'spring_wheat',
  'durum wheat': 'durum_wheat',
  cotton: 'cotton',
  rice: 'rice',
  sorghum: 'sorghum',
  barley: 'barley',
  oats: 'oats',
  rye: 'rye',
  alfalfa: 'alfalfa',
  canola: 'canola',
  sunflower: 'sunflower',
  potatoes: 'potatoes',
  'sweet potatoes': 'sweet_potatoes',
  peanuts: 'peanuts',
  'chick peas': 'chickpeas',
  lentils: 'lentils',
  'dry beans': 'common_beans',
  sugarbeets: 'sugar_beet',
  apples: 'apples',
  grapes: 'wine_grapes',
  almonds: 'almonds',
  oranges: 'citrus',
  citrus: 'citrus',
  cherries: 'cherries',
  pears: 'pears',
  hops: 'hops',
  onions: 'onions',
  tomatoes: 'tomatoes',
  blueberries: 'blueberries',
  strawberries: 'strawberries',
  olives: 'olives',
  clovers: 'red_clover',
  'clover/wildflowers': 'red_clover',
  vetch: 'hairy_vetch',
  millet: 'pearl_millet',
  flaxseed: 'flax',
  mustard: 'mustard',
  camelina: 'camelina',
  triticale: 'triticale',
  safflower: 'safflower',
  garlic: 'garlic',
  cabbage: 'cabbage',
  pumpkins: 'squash_pumpkins',
  squash: 'squash_pumpkins',
  watermelons: 'watermelon',
  peppers: 'chili_peppers',
  carrots: 'carrots',
  spinach: 'spinach',
  lettuce: 'lettuce',
  turnips: 'turnips',
  radishes: 'daikon_radish',
  buckwheat: 'buckwheat',
  hemp: 'hemp',
};

function latLonToEpsg5070(latDeg: number, lonDeg: number): [number, number] {
  const deg2rad = Math.PI / 180;
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const e2 = 2 * f - f * f;
  const e = Math.sqrt(e2);
  const phi1 = 29.5 * deg2rad;
  const phi2 = 45.5 * deg2rad;
  const phi0 = 23.0 * deg2rad;
  const lam0 = -96.0 * deg2rad;
  const phi = latDeg * deg2rad;
  const lam = lonDeg * deg2rad;

  const q = (p: number) => {
    const sp = Math.sin(p);
    return (
      (1 - e2) *
      (sp / (1 - e2 * sp * sp) -
        (1 / (2 * e)) * Math.log((1 - e * sp) / (1 + e * sp)))
    );
  };
  const m = (p: number) => {
    const sp = Math.sin(p);
    return Math.cos(p) / Math.sqrt(1 - e2 * sp * sp);
  };

  const m1 = m(phi1);
  const m2 = m(phi2);
  const q0 = q(phi0);
  const q1 = q(phi1);
  const q2 = q(phi2);
  const qPhi = q(phi);
  const n = (m1 * m1 - m2 * m2) / (q2 - q1);
  const c = m1 * m1 + n * q1;
  const rho0 = (a * Math.sqrt(c - n * q0)) / n;
  const rho = (a * Math.sqrt(Math.max(0, c - n * qPhi))) / n;
  const theta = n * (lam - lam0);
  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}

const cropscapeCache = new Map<string, string[]>();

async function fetchUsdaCropscapeMix(
  lat: number,
  lon: number
): Promise<string[] | null> {
  if (lat < 24.4 || lat > 49.5 || lon < -125.0 || lon > -66.9) {
    return null;
  }
  const cacheKey = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const cached = cropscapeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [cx, cy] = latLonToEpsg5070(lat, lon);
    const half = 6000; // 12km x 12km neighborhood cropland census
    const bbox = `${Math.round(cx - half)},${Math.round(cy - half)},${Math.round(
      cx + half
    )},${Math.round(cy + half)}`;
    const url = `https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLStat?year=2023&bbox=${bbox}&format=json`;
    const res = await fetchWithTimeout(url, 3200);
    if (!res.ok) return null;
    const rawText = await res.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      Result?: Array<{Category?: string; Acreage?: number | string}>;
    };
    const rows = Array.isArray(parsed.Result) ? parsed.Result : [];
    const cropCounts = new Map<string, number>();

    for (const row of rows) {
      const cat = String(row.Category || '')
        .trim()
        .toLowerCase();
      const acreage = Number(row.Acreage ?? 0);
      if (!cat || !Number.isFinite(acreage) || acreage <= 0) continue;
      // Handle double-crop entries like "Dbl Crop WinWht/Soybeans"
      const parts = cat
        .replace(/^dbl crop\s+/i, '')
        .split('/')
        .map((p) => p.trim());
      for (const p of parts) {
        const mapped = CDL_NAME_TO_CROP_ID[p];
        if (mapped) {
          cropCounts.set(mapped, (cropCounts.get(mapped) ?? 0) + acreage);
        }
      }
    }

    const ranked = Array.from(cropCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, 12);

    if (ranked.length >= 2) {
      cropscapeCache.set(cacheKey, ranked);
      return ranked;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchNasaPower(lat: number, lon: number): Promise<{
  monthlyClimate: MonthlyClimatePoint[];
  yearlyAnomalies: YearlyAnomalyPoint[];
  currentWetnessPct: number;
  currentHumidityPct: number;
  currentTempC: number;
  currentSolar: number;
  precipLast7dMm: number;
} | null> {
  const monthlyUrl = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,GWETROOT,RH2M,ALLSKY_SFC_SW_DWN&community=AG&longitude=${lon.toFixed(
    4
  )}&latitude=${lat.toFixed(4)}&start=2021&end=2025&format=JSON`;

  const res = await fetchWithTimeout(monthlyUrl, 6000);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    properties?: {
      parameter?: Record<string, Record<string, number>>;
    };
  };
  const params = json?.properties?.parameter;
  if (!params || !params.T2M || !params.PRECTOTCORR) return null;

  const monthlyBuckets: Array<{
    temps: number[];
    precips: number[];
    wetness: number[];
    humidity: number[];
    solar: number[];
  }> = Array.from({length: 12}, () => ({
    temps: [],
    precips: [],
    wetness: [],
    humidity: [],
    solar: [],
  }));

  const yearlyMap = new Map<
    number,
    {precipTotal: number; temps: number[]; wetness: number[]}
  >();

  for (const [ym, rawTemp] of Object.entries(params.T2M)) {
    const year = Number(ym.slice(0, 4));
    const month = Number(ym.slice(4, 6));
    if (month < 1 || month > 12 || year < 2021 || year > 2025) continue;

    const precipDay = params.PRECTOTCORR?.[ym] ?? -999;
    const wet = params.GWETROOT?.[ym] ?? -999;
    const rh = params.RH2M?.[ym] ?? -999;
    const solar = params.ALLSKY_SFC_SW_DWN?.[ym] ?? -999;
    const daysInMonth = new Date(year, month, 0).getDate();

    const bucket = monthlyBuckets[month - 1];
    if (rawTemp > -90) bucket.temps.push(rawTemp);
    if (precipDay >= 0) bucket.precips.push(precipDay * daysInMonth);
    if (wet >= 0 && wet <= 1) bucket.wetness.push(wet * 100);
    if (rh >= 0 && rh <= 100) bucket.humidity.push(rh);
    if (solar >= 0) bucket.solar.push(solar);

    const yEntry = yearlyMap.get(year) ?? {
      precipTotal: 0,
      temps: [],
      wetness: [],
    };
    if (precipDay >= 0) yEntry.precipTotal += precipDay * daysInMonth;
    if (rawTemp > -90) yEntry.temps.push(rawTemp);
    if (wet >= 0 && wet <= 1) yEntry.wetness.push(wet * 100);
    yearlyMap.set(year, yEntry);
  }

  const avg = (arr: number[], fallback: number) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;

  const monthlyClimate: MonthlyClimatePoint[] = monthlyBuckets.map((b, idx) => ({
    monthIndex: idx,
    monthLabel: MONTH_LABELS[idx],
    tempC: Number(avg(b.temps, 18).toFixed(1)),
    precipMm: Math.round(avg(b.precips, 60)),
    rootWetnessPct: Math.round(avg(b.wetness, 52)),
    relativeHumidityPct: Math.round(avg(b.humidity, 64)),
    solarKwhM2: Number(avg(b.solar, 4.3).toFixed(1)),
  }));

  const yearlyList = Array.from(yearlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .filter(([, v]) => v.temps.length >= 6);

  const baselinePrecip =
    yearlyList.reduce((acc, [, v]) => acc + v.precipTotal, 0) /
    Math.max(1, yearlyList.length);

  const yearlyAnomalies: YearlyAnomalyPoint[] = yearlyList.map(([year, v]) => ({
    year,
    annualPrecipMm: Math.round(v.precipTotal),
    anomalyPct: Math.round(
      ((v.precipTotal - baselinePrecip) / Math.max(1, baselinePrecip)) * 100
    ),
    meanTempC: Number(avg(v.temps, 18).toFixed(1)),
    avgWetnessPct: Math.round(avg(v.wetness, 50)),
  }));

  const currentMonth = new Date().getMonth();
  const snap = monthlyClimate[currentMonth];

  return {
    monthlyClimate,
    yearlyAnomalies,
    currentWetnessPct: snap.rootWetnessPct,
    currentHumidityPct: snap.relativeHumidityPct,
    currentTempC: snap.tempC,
    currentSolar: snap.solarKwhM2,
    precipLast7dMm: Math.round(snap.precipMm * 0.24),
  };
}

async function fetchElevationAndSlope(
  lat: number,
  lon: number
): Promise<{elevationM: number; slopePct: number} | null> {
  const d = 0.005; // ~550m terrain sampling step
  const lats = [lat, lat + d, lat - d, lat, lat].map((v) => v.toFixed(4)).join(',');
  const lons = [lon, lon, lon, lon + d, lon - d].map((v) => v.toFixed(4)).join(',');
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;

  const res = await fetchWithTimeout(url, 3500);
  if (!res.ok) return null;
  const json = (await res.json()) as {elevation?: number[]};
  const e = json?.elevation;
  if (!e || e.length < 5) return null;

  const center = e[0];
  const dzDy = (e[1] - e[2]) / 1110;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dzDx = (e[3] - e[4]) / (1110 * cosLat);
  const slopePct = Number((Math.hypot(dzDx, dzDy) * 100).toFixed(1));
  return {
    elevationM: Math.round(center),
    slopePct: Math.min(28, slopePct),
  };
}

async function fetchSoilGrids(lat: number, lon: number): Promise<SoilProfile | null> {
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${lat.toFixed(
    4
  )}&lon=${lon.toFixed(
    4
  )}&property=phh2o&property=soc&property=nitrogen&property=clay&property=sand&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean`;

  const res = await fetchWithTimeout(url, 5500);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    properties?: {
      layers?: Array<{
        name: string;
        unit_measure?: {d_factor?: number};
        depths?: Array<{
          values?: {mean?: number | null};
        }>;
      }>;
    };
  };

  const layers = json?.properties?.layers;
  if (!layers || !layers.length) return null;

  const extractByDepth = (propName: string, depthIdx: number): number | null => {
    const layer = layers.find((l) => l.name === propName);
    const dFactor = layer?.unit_measure?.d_factor || 10;
    const raw = layer?.depths?.[depthIdx]?.values?.mean;
    if (raw === null || raw === undefined) return null;
    return raw / dFactor;
  };

  const depthLabels = ['0–5 cm', '5–15 cm', '15–30 cm'];
  const parsedLayers: SoilDepthLayer[] = [];

  for (let i = 0; i < 3; i++) {
    const ph = extractByDepth('phh2o', i);
    const soc = extractByDepth('soc', i);
    const nitrogen = extractByDepth('nitrogen', i);
    const clay = extractByDepth('clay', i);
    const sand = extractByDepth('sand', i);
    if (ph === null || clay === null || sand === null) continue;
    const clayPct = Math.round(clay);
    const sandPct = Math.round(sand);
    const siltPct = Math.max(0, 100 - clayPct - sandPct);
    const socGKg = Number((soc ?? 15).toFixed(1));
    parsedLayers.push({
      depth: depthLabels[i],
      ph: Number(ph.toFixed(1)),
      socGKg,
      nitrogenGKg: Number((nitrogen ?? socGKg * 0.085).toFixed(2)),
      clayPct,
      sandPct,
      siltPct,
    });
  }

  if (!parsedLayers.length) return null;

  const top = parsedLayers[0];
  return {
    ph: top.ph,
    socGKg: top.socGKg,
    nitrogenGKg: top.nitrogenGKg,
    clayPct: top.clayPct,
    sandPct: top.sandPct,
    siltPct: top.siltPct,
    textureClass: classifyTexture(top.clayPct, top.sandPct),
    layers: parsedLayers,
    source: 'soilgrids_live',
  };
}

function parseCoordinatesQuery(
  raw: string
): {lat: number; lon: number} | null {
  const cleaned = raw.trim().replace(/[°]/g, '');
  const match = cleaned.match(
    /^(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)$/
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }
  return {lat, lon};
}

function safeNum(val: number | null | undefined, fallback: number): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

async function fetchOpenMeteoForecast(
  lat: number,
  lon: number
): Promise<{
  daily: DailyForecastPoint[];
  currentWeather: CurrentWeatherSnapshot;
} | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
    4
  )}&longitude=${lon.toFixed(
    4
  )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration,uv_index_max,sunrise,sunset&forecast_days=16&timezone=auto`;

  const res = await fetchWithTimeout(url, 6000);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    timezone?: string;
    current?: {
      time?: string;
      temperature_2m?: number | null;
      relative_humidity_2m?: number | null;
      apparent_temperature?: number | null;
      precipitation?: number | null;
      weather_code?: number | null;
      wind_speed_10m?: number | null;
    };
    daily?: {
      time?: string[];
      weather_code?: Array<number | null>;
      temperature_2m_max?: Array<number | null>;
      temperature_2m_min?: Array<number | null>;
      precipitation_sum?: Array<number | null>;
      precipitation_probability_max?: Array<number | null>;
      wind_speed_10m_max?: Array<number | null>;
      et0_fao_evapotranspiration?: Array<number | null>;
      uv_index_max?: Array<number | null>;
      sunrise?: string[];
      sunset?: string[];
    };
  };
  const d = json?.daily;
  if (!d?.time?.length) return null;

  const daily: DailyForecastPoint[] = d.time.map((date, idx) => ({
    date,
    tempMaxC: Number(safeNum(d.temperature_2m_max?.[idx], 22).toFixed(1)),
    tempMinC: Number(safeNum(d.temperature_2m_min?.[idx], 12).toFixed(1)),
    precipMm: Number(safeNum(d.precipitation_sum?.[idx], 0).toFixed(1)),
    et0Mm: Number(safeNum(d.et0_fao_evapotranspiration?.[idx], 2.8).toFixed(1)),
    weatherCode: Math.round(safeNum(d.weather_code?.[idx], 1)),
    precipProbPct: Math.round(
      Math.max(0, Math.min(100, safeNum(d.precipitation_probability_max?.[idx], 0)))
    ),
    windMaxKmh: Number(safeNum(d.wind_speed_10m_max?.[idx], 10).toFixed(1)),
    uvIndexMax: Number(safeNum(d.uv_index_max?.[idx], 4).toFixed(1)),
    sunrise: d.sunrise?.[idx],
    sunset: d.sunset?.[idx],
  }));

  const cur = json?.current;
  const currentWeather: CurrentWeatherSnapshot = {
    tempC: Number(
      safeNum(cur?.temperature_2m, daily[0]?.tempMaxC ?? 20).toFixed(1)
    ),
    apparentTempC: Number(
      safeNum(cur?.apparent_temperature, safeNum(cur?.temperature_2m, 20)).toFixed(1)
    ),
    humidityPct: Math.round(
      Math.max(0, Math.min(100, safeNum(cur?.relative_humidity_2m, 62)))
    ),
    precipMm: Number(safeNum(cur?.precipitation, 0).toFixed(1)),
    windKmh: Number(
      safeNum(cur?.wind_speed_10m, daily[0]?.windMaxKmh ?? 10).toFixed(1)
    ),
    weatherCode: Math.round(
      safeNum(cur?.weather_code, daily[0]?.weatherCode ?? 1)
    ),
    observedAt: cur?.time || new Date().toISOString(),
    timezone: json?.timezone || 'UTC',
  };

  return {daily, currentWeather};
}

async function resolveFarmInsightsBundle(locInput: {
  lat: number;
  lon: number;
  name: string;
  region: string;
  country: string;
}): Promise<FarmInsightBundle> {
  const location: LocationOption = {
    id: makeLocationKey(locInput.lat, locInput.lon),
    name: locInput.name,
    region: locInput.region,
    country: locInput.country,
    lat: locInput.lat,
    lon: locInput.lon,
    climateZone: 'Satellite Agro-Zone',
    usdaZone: '6b',
  };

  const fallback = buildRegionalFallbackBundle(location);

  const [nasaResult, soilResult, forecastResult, terrainResult, cropscapeResult] =
    await Promise.allSettled([
      fetchNasaPower(locInput.lat, locInput.lon),
      fetchSoilGrids(locInput.lat, locInput.lon),
      fetchOpenMeteoForecast(locInput.lat, locInput.lon),
      fetchElevationAndSlope(locInput.lat, locInput.lon),
      fetchUsdaCropscapeMix(locInput.lat, locInput.lon),
    ]);

  const nasa = nasaResult.status === 'fulfilled' ? nasaResult.value : null;
  const soil = soilResult.status === 'fulfilled' ? soilResult.value : null;
  const forecast =
    forecastResult.status === 'fulfilled' ? forecastResult.value : null;
  const terrain =
    terrainResult.status === 'fulfilled' ? terrainResult.value : null;
  const cropscapeCrops =
    cropscapeResult.status === 'fulfilled' ? cropscapeResult.value : null;

  const monthlyClimate = nasa?.monthlyClimate ?? fallback.monthlyClimate;
  const minTemp = Math.min(...monthlyClimate.map((m) => m.tempC));
  const meanTempC =
    monthlyClimate.reduce((a, m) => a + m.tempC, 0) /
    Math.max(1, monthlyClimate.length);
  const annualPrecipMm = monthlyClimate.reduce((a, m) => a + m.precipMm, 0);
  const slopePct = terrain?.slopePct ?? fallback.currentSnapshot.slopePct;

  const matrixProfile = inferRegionalCropProfile(location, {
    meanTempC,
    annualPrecipMm,
    coldestTempC: minTemp,
  });
  const mergedRegionalCrops = cropscapeCrops?.length
    ? Array.from(new Set([...cropscapeCrops, ...matrixProfile.crops])).slice(
        0,
        15
      )
    : matrixProfile.crops;

  return {
    location: {
      ...location,
      usdaZone: estimateUsdaZone(minTemp),
      traditionalCrops: mergedRegionalCrops,
      regionalSource: cropscapeCrops?.length
        ? 'usda_cropscape'
        : 'agro_biome_matrix',
      regionalZoneLabel: matrixProfile.zoneLabel,
    },
    fetchedAt: new Date().toISOString(),
    dataSources: {
      nasaPower: nasa ? 'live' : 'regional_benchmark',
      soilGrids: soil ? 'live' : 'regional_benchmark',
      forecast: forecast ? 'live' : 'regional_benchmark',
    },
    currentSnapshot: {
      rootWetnessPct:
        nasa?.currentWetnessPct ?? fallback.currentSnapshot.rootWetnessPct,
      relativeHumidityPct:
        forecast?.currentWeather?.humidityPct ??
        nasa?.currentHumidityPct ??
        fallback.currentSnapshot.relativeHumidityPct,
      surfaceTempC:
        forecast?.currentWeather?.tempC ??
        forecast?.daily?.[0]?.tempMaxC ??
        nasa?.currentTempC ??
        fallback.currentSnapshot.surfaceTempC,
      precipLast7dMm:
        nasa?.precipLast7dMm ?? fallback.currentSnapshot.precipLast7dMm,
      solarKwhM2: nasa?.currentSolar ?? fallback.currentSnapshot.solarKwhM2,
      usdaZone: estimateUsdaZone(minTemp),
      frostFreeDays: estimateFrostFreeDays(monthlyClimate),
      elevationM: terrain?.elevationM ?? fallback.currentSnapshot.elevationM,
      slopePct,
      inferredSlopeClass: classifySlope(slopePct),
    },
    soil: soil ?? fallback.soil,
    monthlyClimate,
    yearlyAnomalies: nasa?.yearlyAnomalies.length
      ? nasa.yearlyAnomalies
      : fallback.yearlyAnomalies,
    forecast16d: forecast?.daily ?? fallback.forecast16d,
    currentWeather: forecast?.currentWeather ?? fallback.currentWeather,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  // Catch malformed JSON payloads cleanly
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({error: 'Invalid JSON request body'});
        return;
      }
      next(err);
    }
  );

  // Health & DB check
  app.get('/api/health', async (_req, res) => {
    try {
      const db = await checkDbHealth();
      res.json({status: 'ok', db});
    } catch (err) {
      res.status(500).json({
        status: 'error',
        error: err instanceof Error ? err.message : 'Database check failed',
      });
    }
  });

  // Geocoding (supports any named place on Earth via Open-Meteo + direct lat, lon coordinates)
  app.get('/api/geocode', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({results: GLOBAL_FARM_HUBS.slice(0, 8)});
      return;
    }

    const coordMatch = parseCoordinatesQuery(query);
    if (coordMatch) {
      const {lat, lon} = coordMatch;
      const coordOption: LocationOption = {
        id: makeLocationKey(lat, lon),
        name: `Coordinates (${lat.toFixed(3)}, ${lon.toFixed(3)})`,
        region: `${lat >= 0 ? 'N' : 'S'} ${Math.abs(lat).toFixed(2)}°, ${
          lon >= 0 ? 'E' : 'W'
        } ${Math.abs(lon).toFixed(2)}°`,
        country: 'Global Grid',
        lat,
        lon,
        climateZone: 'Global Coordinates',
        usdaZone: estimateUsdaZone(12 - Math.abs(lat) * 0.45),
      };
      res.json({results: [coordOption]});
      return;
    }

    const qLower = query.toLowerCase();
    const localMatches = GLOBAL_FARM_HUBS.filter(
      (h) =>
        h.name.toLowerCase().includes(qLower) ||
        h.region.toLowerCase().includes(qLower) ||
        h.country.toLowerCase().includes(qLower)
    );

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=10&language=en&format=json`;
      const upstream = await fetchWithTimeout(url, 4500);
      if (upstream.ok) {
        const data = (await upstream.json()) as {
          results?: Array<{
            id: number;
            name: string;
            admin1?: string;
            admin2?: string;
            country?: string;
            latitude: number;
            longitude: number;
          }>;
        };
        const apiResults: LocationOption[] = (data.results ?? []).map((item) => {
          const region = [item.admin2, item.admin1].filter(Boolean).join(', ');
          const displayName = region
            ? `${item.name}, ${item.admin1 || region}`
            : item.name;
          return {
            id: makeLocationKey(item.latitude, item.longitude),
            name: displayName,
            region: item.admin1 || item.country || 'Agricultural Region',
            country: item.country || '',
            lat: item.latitude,
            lon: item.longitude,
            climateZone: 'Open-Meteo Global Grid',
            usdaZone: estimateUsdaZone(10 - Math.abs(item.latitude) * 0.35),
          };
        });
        const seenIds = new Set<string>();
        const merged: LocationOption[] = [];
        for (const item of [...localMatches, ...apiResults]) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            merged.push(item);
          }
        }
        res.json({results: merged.slice(0, 10)});
        return;
      }
    } catch {
      // Fallback to local hub matches
    }

    res.json({results: localMatches});
  });

  // Dedicated Open-Meteo Next 10-Day Weather Forecast for any coordinate on Earth
  app.get('/api/weather', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const requestedDays = Number(req.query.days ?? 10);
    const days = Number.isFinite(requestedDays)
      ? Math.max(1, Math.min(16, Math.round(requestedDays)))
      : 10;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      res
        .status(400)
        .json({error: 'lat must be -90..90 and lon must be -180..180'});
      return;
    }

    const live = await fetchOpenMeteoForecast(lat, lon);
    if (live) {
      res.json({
        location: {
          lat,
          lon,
          name: String(req.query.name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`),
        },
        source: 'open-meteo',
        timezone: live.currentWeather.timezone,
        currentWeather: live.currentWeather,
        forecast10d: live.daily.slice(0, 10),
        forecast: live.daily.slice(0, days),
        fetchedAt: new Date().toISOString(),
      });
      return;
    }

    const fallback = buildRegionalFallbackBundle({
      id: makeLocationKey(lat, lon),
      name: String(req.query.name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`),
      region: 'Global Grid',
      country: '',
      lat,
      lon,
      climateZone: 'Global Coordinates',
      usdaZone: estimateUsdaZone(12 - Math.abs(lat) * 0.45),
    });
    res.json({
      location: {
        lat,
        lon,
        name: fallback.location.name,
      },
      source: 'regional_benchmark',
      timezone: fallback.currentWeather?.timezone ?? 'UTC',
      currentWeather: fallback.currentWeather,
      forecast10d: fallback.forecast16d.slice(0, 10),
      forecast: fallback.forecast16d.slice(0, days),
      fetchedAt: fallback.fetchedAt,
    });
  });

  // Satellite, Soil, Terrain & 16-day Weather Insights (validated coordinates)
  app.get('/api/farm-insights', async (req, res) => {
    const lat = Number(req.query.lat ?? 42.036);
    const lon = Number(req.query.lon ?? -93.465);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      res.status(400).json({error: 'lat must be -90..90 and lon must be -180..180'});
      return;
    }

    const name = String(req.query.name || 'Story County, Iowa').slice(0, 120);
    const region = String(req.query.region || 'Iowa').slice(0, 100);
    const country = String(req.query.country || 'United States').slice(0, 80);

    const bundle = await resolveFarmInsightsBundle({
      lat,
      lon,
      name,
      region,
      country,
    });
    res.json(bundle);
  });

  // Farm Profiles List + Active Farm Bootstrapping
  app.get('/api/farms', async (req, res) => {
    const farms = await listFarmSummaries();
    const requestedId =
      typeof req.query.farmId === 'string' ? req.query.farmId : farms[0]?.id;
    const activeFarm = requestedId ? await getFarmById(requestedId) : null;
    res.json({
      farms,
      activeFarm: activeFarm ?? (farms[0] ? await getFarmById(farms[0].id) : null),
    });
  });

  // Create New Farm Profile
  app.post('/api/farms', async (req, res) => {
    const check = validateCreateFarm(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }
    const farm = await createFarmProfile(check.data);
    const farms = await listFarmSummaries();
    res.status(201).json({farm, farms});
  });

  // Get Single Farm Profile
  app.get('/api/farms/:farmId', async (req, res) => {
    const farm = await getFarmById(req.params.farmId);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.json({farm});
  });

  // Update Farm Settings / Location / Equipment / Labor / Water / Slope
  app.patch('/api/farms/:farmId/settings', async (req, res) => {
    const check = validateSettingsPatch(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }
    const farm = await patchFarmSettings(req.params.farmId, check.data);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.json({farm});
  });

  // Harvest Logs CRUD
  app.get('/api/farms/:farmId/logs', async (req, res) => {
    const farm = await getFarmById(req.params.farmId);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.json({logs: farm.harvestLogs});
  });

  app.post('/api/farms/:farmId/logs', async (req, res) => {
    const check = validateHarvestLogInput(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }
    const farm = await addHarvestLog(req.params.farmId, check.data);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.status(201).json({log: check.data, logs: farm.harvestLogs});
  });

  app.delete('/api/farms/:farmId/logs/:logId', async (req, res) => {
    const result = await removeHarvestLog(req.params.farmId, req.params.logId);
    if (!result) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    if (!result.removed) {
      res.status(404).json({error: 'Harvest log entry not found'});
      return;
    }
    res.json({removed: true, logs: result.farm.harvestLogs});
  });

  // Alert Thresholds & History
  app.put('/api/farms/:farmId/alerts/thresholds', async (req, res) => {
    const check = validateAlertThresholds(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }
    const farm = await updateAlertThresholds(req.params.farmId, check.data);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.json({farm});
  });

  app.post('/api/farms/:farmId/alerts/history', async (req, res) => {
    const check = validateAlertHistoryEntry(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }
    const farm = await appendAlertHistory(req.params.farmId, check.data);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.status(201).json({entry: check.data, alertHistory: farm.alertHistory});
  });

  // Offline IndexedDB Sync Reconciliation
  app.post('/api/farms/:farmId/sync', async (req, res) => {
    const check = validateSyncMutations(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }
    const farm = await applySyncMutations(req.params.farmId, check.data);
    if (!farm) {
      res.status(404).json({error: 'Farm profile not found'});
      return;
    }
    res.json({farm, syncedCount: check.data.length});
  });

  // Server-Side Statistical Crop Prediction & Weather Hazard Evaluation
  app.post('/api/predict', async (req, res) => {
    const check = validatePredictRequest(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }

    const input = check.data;
    const farmRecord = input.farmId ? await getFarmById(input.farmId) : null;

    let bundle = input.bundle;
    if (!bundle) {
      const loc = input.location ?? farmRecord?.location ?? GLOBAL_FARM_HUBS[0];
      bundle = await resolveFarmInsightsBundle(loc);
    }

    const recentHistoryCropIds =
      input.recentHistoryCropIds.length > 0
        ? input.recentHistoryCropIds
        : Array.from(
            new Set(
              (farmRecord?.harvestLogs ?? []).slice(0, 3).map((l) => l.cropId)
            )
          );

    const predictions = predictNextCrops(bundle, {
      currentCropId: input.currentCropId,
      harvestMonth: input.harvestMonth,
      waterAvailability: input.waterAvailability,
      laborAvailability: input.laborAvailability,
      slopeClass: input.slopeClass,
      ownedEquipment: input.ownedEquipment,
      prioritizeOwnedEquipment: input.prioritizeOwnedEquipment,
      recentHistoryCropIds,
      sensitivity: input.sensitivity,
    });

    const thresholds =
      input.thresholds ?? farmRecord?.alertThresholds ?? DEFAULT_THRESHOLDS;
    const alerts = evaluateWeatherAlerts(bundle, thresholds);

    const response: PredictApiResponse = {
      predictions,
      alerts,
      evaluatedAt: new Date().toISOString(),
      engine: 'server_statistical_v2',
    };
    res.json(response);
  });

  // In-Memory Python xarray Geospatial Ingestion (Planetary Computer, NASA Earthdata, ISRIC SoilGrids)
  app.post('/api/geospatial/ingest', async (req, res) => {
    const check = validateGeospatialIngestRequest(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }

    try {
      const payload = await runPythonGeospatialIngestion(check.data);
      res.json(payload);
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to stream geospatial datasets into xarray',
      });
    }
  });

  // Server-Side Gemini AI Agronomic Synthesis from Extracted xarray Layer Statistics
  app.post('/api/ai/analyze', async (req, res) => {
    const check = validateAiAnalyzeRequest(req.body);
    if (!check.valid) {
      res.status(400).json({error: 'Validation failed', details: check.errors});
      return;
    }

    const input = check.data;
    const farmRecord = input.farmId ? await getFarmById(input.farmId) : null;

    let bundle = input.bundle;
    if (!bundle) {
      bundle = await resolveFarmInsightsBundle({
        lat: input.lat,
        lon: input.lon,
        name: input.locationName,
        region: farmRecord?.location.region ?? 'Agricultural Region',
        country: farmRecord?.location.country ?? '',
      });
    }

    let geospatial = input.geospatial as
      | GeospatialIngestionPayload
      | undefined;
    if (!geospatial || input.forceRefresh) {
      try {
        geospatial = await runPythonGeospatialIngestion({
          lat: input.lat,
          lon: input.lon,
          bbox: input.bbox,
          polygon: input.polygon,
          sources: input.sources,
          forceRefresh: input.forceRefresh,
        });
      } catch (err) {
        res.status(502).json({
          error:
            err instanceof Error
              ? err.message
              : 'Failed to ingest xarray geospatial datasets',
        });
        return;
      }
    }

    const recentHistoryCropIds = Array.from(
      new Set((farmRecord?.harvestLogs ?? []).slice(0, 3).map((l) => l.cropId))
    );

    const topPredictions = predictNextCrops(bundle, {
      currentCropId: input.farmerInputs.currentCropId,
      harvestMonth: input.farmerInputs.harvestMonth,
      waterAvailability: input.farmerInputs.waterAvailability,
      laborAvailability: input.farmerInputs.laborAvailability,
      slopeClass: input.farmerInputs.slopeClass,
      ownedEquipment: input.farmerInputs.ownedEquipment,
      prioritizeOwnedEquipment: false,
      recentHistoryCropIds,
    });

    try {
      const analysis = await analyzeGeospatialWithGemini({
        locationName: input.locationName,
        lang: input.lang,
        geospatial,
        bundle,
        farmerInputs: input.farmerInputs,
        topPredictions,
      });

      res.json({geospatial, analysis});
    } catch (err) {
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : 'Gemini AI analysis failed',
      });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const devKillSw = `
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({type: 'window'});
    for (const client of clients) {
      client.navigate(client.url);
    }
  })());
});
`;
    app.get(['/dev-sw.js', '/sw.js'], (_req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.send(devKillSw);
    });

    app.use(
      '/crop-images',
      express.static(path.resolve(__dirname, 'public', 'crop-images'), {
        maxAge: '7d',
      })
    );

    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {server: httpServer},
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Cosmic Crisp server listening on http://localhost:${PORT}`);
  });
}

startServer();
