import dotenv from 'dotenv';
import express from 'express';
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
  inferTraditionalRegionalCrops,
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
      headers: {'User-Agent': 'CropNext-Agronomy-App/1.0'},
    });
  } finally {
    clearTimeout(timer);
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

async function fetchOpenMeteoForecast(
  lat: number,
  lon: number
): Promise<DailyForecastPoint[] | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
    4
  )}&longitude=${lon.toFixed(
    4
  )}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&forecast_days=16&timezone=auto`;

  const res = await fetchWithTimeout(url, 5000);
  if (!res.ok) return null;
  const json = (await res.json()) as {
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      et0_fao_evapotranspiration?: number[];
    };
  };
  const d = json?.daily;
  if (!d?.time?.length) return null;

  return d.time.map((date, idx) => ({
    date,
    tempMaxC: Number((d.temperature_2m_max?.[idx] ?? 24).toFixed(1)),
    tempMinC: Number((d.temperature_2m_min?.[idx] ?? 12).toFixed(1)),
    precipMm: Number((d.precipitation_sum?.[idx] ?? 0).toFixed(1)),
    et0Mm: Number((d.et0_fao_evapotranspiration?.[idx] ?? 3.2).toFixed(1)),
  }));
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

  const [nasaResult, soilResult, forecastResult, terrainResult] =
    await Promise.allSettled([
      fetchNasaPower(locInput.lat, locInput.lon),
      fetchSoilGrids(locInput.lat, locInput.lon),
      fetchOpenMeteoForecast(locInput.lat, locInput.lon),
      fetchElevationAndSlope(locInput.lat, locInput.lon),
    ]);

  const nasa = nasaResult.status === 'fulfilled' ? nasaResult.value : null;
  const soil = soilResult.status === 'fulfilled' ? soilResult.value : null;
  const forecast =
    forecastResult.status === 'fulfilled' ? forecastResult.value : null;
  const terrain =
    terrainResult.status === 'fulfilled' ? terrainResult.value : null;

  const monthlyClimate = nasa?.monthlyClimate ?? fallback.monthlyClimate;
  const minTemp = Math.min(...monthlyClimate.map((m) => m.tempC));
  const slopePct = terrain?.slopePct ?? fallback.currentSnapshot.slopePct;

  return {
    location: {
      ...location,
      usdaZone: estimateUsdaZone(minTemp),
      traditionalCrops: inferTraditionalRegionalCrops(location),
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
        nasa?.currentHumidityPct ??
        fallback.currentSnapshot.relativeHumidityPct,
      surfaceTempC:
        forecast?.[0]?.tempMaxC ??
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
    forecast16d: forecast ?? fallback.forecast16d,
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

  // Geocoding
  app.get('/api/geocode', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.json({results: GLOBAL_FARM_HUBS.slice(0, 8)});
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
      )}&count=6&language=en&format=json`;
      const upstream = await fetchWithTimeout(url, 4000);
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
            climateZone: 'Satellite Grid Point',
            usdaZone: estimateUsdaZone(10 - Math.abs(item.latitude) * 0.35),
          };
        });
        const merged = [...localMatches, ...apiResults].slice(0, 8);
        res.json({results: merged});
        return;
      }
    } catch {
      // Fallback to local hub matches
    }

    res.json({results: localMatches});
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

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CropNext server listening on http://localhost:${PORT}`);
  });
}

startServer();
