export type LanguageCode = 'en' | 'es' | 'hi' | 'fr' | 'pt';
export type UnitSystem = 'metric' | 'imperial';

export type NavTab = 'overview' | 'climate' | 'irrigation' | 'alerts' | 'log';

export type CropFamily =
  | 'grass'
  | 'legume'
  | 'broadleaf'
  | 'brassica'
  | 'root'
  | 'solanaceae'
  | 'cucurbit'
  | 'allium'
  | 'orchard'
  | 'forage';

export type WaterAvailability = 'rainfed' | 'limited' | 'full';
export type LaborAvailability = 'low' | 'moderate' | 'high';
export type SlopeClass = 'flat' | 'gentle' | 'steep';

export type EquipmentId =
  | 'tractor_tillage'
  | 'row_crop_planter'
  | 'grain_combine'
  | 'sprayer_spreader'
  | 'forage_baler'
  | 'potato_harvester'
  | 'cotton_picker'
  | 'paddy_harvester';

export interface LocationOption {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  climateZone: string;
  usdaZone: string;
  traditionalCrops?: string[];
  regionalSource?: 'usda_cropscape' | 'agro_biome_matrix';
  regionalZoneLabel?: string;
}

export interface SoilDepthLayer {
  depth: string;
  ph: number;
  socGKg: number;
  nitrogenGKg: number;
  clayPct: number;
  sandPct: number;
  siltPct: number;
}

export interface SoilProfile {
  ph: number;
  socGKg: number;
  nitrogenGKg: number;
  clayPct: number;
  sandPct: number;
  siltPct: number;
  textureClass: string;
  layers: SoilDepthLayer[];
  source: 'soilgrids_live' | 'regional_benchmark';
}

export interface MonthlyClimatePoint {
  monthIndex: number; // 0-11
  monthLabel: string;
  tempC: number;
  precipMm: number;
  rootWetnessPct: number; // 0-100
  relativeHumidityPct: number; // 0-100
  solarKwhM2: number;
}

export interface YearlyAnomalyPoint {
  year: number;
  annualPrecipMm: number;
  anomalyPct: number;
  meanTempC: number;
  avgWetnessPct: number;
}

export interface DailyForecastPoint {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipMm: number;
  et0Mm: number;
  weatherCode?: number;
  precipProbPct?: number;
  windMaxKmh?: number;
  uvIndexMax?: number;
  sunrise?: string;
  sunset?: string;
}

export interface CurrentWeatherSnapshot {
  tempC: number;
  apparentTempC: number;
  humidityPct: number;
  precipMm: number;
  windKmh: number;
  weatherCode: number;
  observedAt: string;
  timezone: string;
}

export interface CropSpec {
  id: string;
  family: CropFamily;
  category?: string;
  scientificName?: string;
  commonName?: string;
  lifeForm?: string;
  nitrogenBalanceKgHa: number;
  optimalPh: [number, number];
  optimalTempC: [number, number];
  absTempC?: [number, number];
  waterNeedMm: number;
  growingDays: number;
  baseYieldTHa: number;
  buPerTonne: number;
  preferredTextures: string[];
  droughtTolerance: number; // 0-1
  frostTolerance: number; // 0-1
  avgPriceUsdPerTonne: number;
  estInputCostUsdPerHa: number;
  requiredEquipment: EquipmentId[];
  laborIntensity: LaborAvailability;
  laborHoursPerHa: number;
  erosionProtection: number; // 0-1 (1 = strong soil cover on slopes)
}

export interface FactorScoreBreakdown {
  rotationSynergy: number;
  moistureFit: number;
  thermalSolarFit: number;
  soilSuitability: number;
  climateStability: number;
  regionalEconomics: number;
  laborAndSlopeFit: number;
}

export interface CropPrediction {
  cropId: string;
  score: number; // 0-100
  expectedYieldTHa: number;
  expectedYieldBuAc: number;
  confidenceIntervalTHa: number;
  yieldGainVsMonoPct: number;
  nitrogenDeltaKgHa: number;
  waterMatchPct: number;
  diseaseBreakRating: 'high' | 'moderate' | 'low';
  isTraditionalRegional: boolean;
  regionalRank?: number | null;
  regionalPrevalenceScore?: number;
  estGrossRevenueUsdHa: number;
  estNetMarginUsdHa: number;
  roiPct: number;
  economicViability: 'strong' | 'moderate' | 'tight';
  growingDays: number;
  seasonFitsWindow: boolean;
  hardinessLevel: 'hardy' | 'moderate' | 'sensitive';
  laborIntensity: LaborAvailability;
  laborHoursPerHa: number;
  laborFits: boolean;
  slopeSuitable: boolean;
  historyConflict: boolean;
  requiredEquipment: EquipmentId[];
  missingEquipment: EquipmentId[];
  breakdown: FactorScoreBreakdown;
  reasonKeys: string[];
}

export interface WeatherAlert {
  id: string;
  type: 'frost' | 'heat' | 'drought' | 'heavy_rain';
  severity: 'critical' | 'warning';
  date: string;
  metricValue: string;
  titleKey: string;
  detailKey: string;
  actionKey: string;
}

export interface AlertThresholds {
  pushEnabled: boolean;
  frostTempC: number;
  heatTempC: number;
  droughtWetnessPct: number;
  heavyRainMm: number;
}

export interface YieldSensitivity {
  rainfallDeltaPct: number;
  nitrogenBoostKgHa: number;
  conservationTillage: boolean;
}

export interface FarmInsightBundle {
  location: LocationOption;
  fetchedAt: string;
  dataSources: {
    nasaPower: 'live' | 'regional_benchmark';
    soilGrids: 'live' | 'regional_benchmark';
    forecast: 'live' | 'regional_benchmark';
  };
  currentSnapshot: {
    rootWetnessPct: number;
    relativeHumidityPct: number;
    surfaceTempC: number;
    precipLast7dMm: number;
    solarKwhM2: number;
    usdaZone: string;
    frostFreeDays: number;
    elevationM: number;
    slopePct: number;
    inferredSlopeClass: SlopeClass;
  };
  soil: SoilProfile;
  monthlyClimate: MonthlyClimatePoint[];
  yearlyAnomalies: YearlyAnomalyPoint[];
  forecast16d: DailyForecastPoint[];
  currentWeather?: CurrentWeatherSnapshot;
}

export interface CachedFarmPack {
  key: string;
  locationName: string;
  region: string;
  savedAt: string;
  sizeKb: number;
  bundle: FarmInsightBundle;
}

export interface HarvestLogEntry {
  id: string;
  locationKey: string;
  locationName: string;
  cropId: string;
  harvestDate: string;
  areaAcres: number;
  actualYieldTHa: number;
  notes: string;
}

export interface DispatchedAlertLog {
  id: string;
  title: string;
  body: string;
  severity: 'critical' | 'warning';
  sentAt: string;
}

export type EnsoPhase = 'el_nino' | 'la_nina' | 'neutral';
export type EnsoScenarioMode = 'live' | EnsoPhase;
export type WaterScarcityLevel = 'abundant' | 'moderate' | 'severe';
export type WaterSourceType = 'well' | 'canal' | 'rain_harvest' | 'mixed';
export type IrrigationMethodId =
  | 'rain_pipes'
  | 'drip'
  | 'sprinkler'
  | 'furrow'
  | 'drainage';

export interface IrrigationPlanSettings {
  scenarioOverride: EnsoScenarioMode;
  scarcityLevel: WaterScarcityLevel;
  waterSource: WaterSourceType;
  selectedMethod: IrrigationMethodId;
  completedContingencyIds: string[];
  updatedAt?: string;
}

export interface FarmSettings {
  currentCropId: string;
  harvestMonth: number;
  areaAcres: number;
  waterAvailability: WaterAvailability;
  laborAvailability: LaborAvailability;
  slopeClass: SlopeClass;
  ownedEquipment: EquipmentId[];
  prioritizeOwnedEquipment: boolean;
  lang: LanguageCode;
  unitSystem?: UnitSystem;
  irrigationPlan?: IrrigationPlanSettings;
}

export interface FarmProfileRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  location: LocationOption;
  settings: FarmSettings;
  alertThresholds: AlertThresholds;
  harvestLogs: HarvestLogEntry[];
  alertHistory: DispatchedAlertLog[];
}

export interface FarmProfileSummary {
  id: string;
  name: string;
  locationName: string;
  updatedAt: string;
}

export interface PredictApiResponse {
  predictions: CropPrediction[];
  alerts: WeatherAlert[];
  evaluatedAt: string;
  engine: 'server_statistical_v2';
}

export type SyncQueueMutation =
  | {
      id: string;
      farmId: string;
      createdAt: string;
      type: 'settings';
      payload: Partial<FarmSettings> & {location?: LocationOption};
    }
  | {
      id: string;
      farmId: string;
      createdAt: string;
      type: 'thresholds';
      payload: AlertThresholds;
    }
  | {
      id: string;
      farmId: string;
      createdAt: string;
      type: 'log_add';
      payload: HarvestLogEntry;
    }
  | {
      id: string;
      farmId: string;
      createdAt: string;
      type: 'log_delete';
      payload: {logId: string};
    }
  | {
      id: string;
      farmId: string;
      createdAt: string;
      type: 'alert_history';
      payload: DispatchedAlertLog;
    };

export interface GeospatialLayerSummary {
  mean: number | null;
  min: number | null;
  max: number | null;
  validPixels: number;
  units: string;
  dataset: string;
  notes?: string;
}

export interface GeospatialSourceBlock {
  status: string;
  stacEndpoint?: string;
  vrtBase?: string;
  gridCrs?: string;
  scalingFactor?: string;
  cmrReachable?: boolean;
  discoveredGranules?: Record<string, string>;
  message?: string;
  error?: string;
  warnings?: string[];
  layers: Record<string, GeospatialLayerSummary>;
}

export interface GeospatialIngestionPayload {
  ingestedAt: string;
  location: {lat: number; lon: number};
  unifiedGrid: {
    crs: string;
    bbox: number[];
    shape: number[];
  };
  sources: {
    planetaryComputer?: GeospatialSourceBlock;
    nasaEarthdata?: GeospatialSourceBlock;
    isricSoilGrids?: GeospatialSourceBlock;
  };
}

export interface AiAgronomyAnalysis {
  headline: string;
  executiveSummary: string;
  recommendedNextCrop: string;
  soilAndMoistureDiagnosis: string;
  terrainAndSeasonRisk: string;
  actionChecklist: string[];
  dataProvenanceNotes: string;
  analyzedAt: string;
  model: string;
}

export interface AiAnalyzeApiResponse {
  geospatial: GeospatialIngestionPayload;
  analysis: AiAgronomyAnalysis;
}

export interface SeasonalOutlookMonth {
  monthKey: string;
  monthIndex: number;
  monthLabel: string;
  precipMeanMm: number;
  precipP10Mm: number;
  precipP90Mm: number;
  normalPrecipMm: number;
  tempMeanC: number;
  normalTempC: number;
  et0Mm: number;
  heavyRainDaysAvg: number;
}

export interface SeasonalEnsoOutlook {
  fetchedAt: string;
  source: 'live_noaa_openmeteo' | 'regional_benchmark';
  currentSeasonLabel: string;
  oniValueC: number;
  oniTrendDeltaC: number;
  phase: EnsoPhase;
  probabilities: {
    elNinoPct: number;
    neutralPct: number;
    laNinaPct: number;
  };
  ensoSummaryNote: string;
  months: SeasonalOutlookMonth[];
}

export interface MonthlyIrrigationBalance {
  monthKey: string;
  monthIndex: number;
  monthLabel: string;
  forecastPrecipMm: number;
  p10PrecipMm: number;
  p90PrecipMm: number;
  normalPrecipMm: number;
  precipAnomalyPct: number;
  tempC: number;
  et0Mm: number;
  cropKc: number;
  cropEtcMm: number;
  effectiveRainMm: number;
  netBalanceMm: number;
  irrigationNeedMm: number;
  drainageSurplusMm: number;
  floodRisk: 'low' | 'moderate' | 'high';
  droughtRisk: 'low' | 'moderate' | 'high';
  actionSummary: string;
  recommendedFocus: IrrigationMethodId;
}

export interface IrrigationMethodRecommendation {
  methodId: IrrigationMethodId;
  name: string;
  shortLabel: string;
  score: number;
  applicationEfficiencyPct: number;
  seasonalAppliedWaterMm: number;
  waterSavedVsFurrowPct: number;
  scarcityFit: 'optimal' | 'good' | 'poor';
  floodResilience: 'high' | 'moderate' | 'low';
  estCapexUsdPerHa: number;
  estSeasonalOpexUsdPerHa: number;
  rationale: string;
  bestUseCase: string;
  contingencyNote: string;
}

export interface ContingencyActionItem {
  id: string;
  category: 'scarcity' | 'flood' | 'enso';
  priority: 'critical' | 'high' | 'moderate';
  title: string;
  detail: string;
  targetTiming: string;
}

export interface IrrigationDecisionResult {
  activeScenario: EnsoPhase;
  teleconnectionLabel: string;
  teleconnectionRainShiftPct: number;
  teleconnectionTempShiftC: number;
  soilAwcMmPerM: number;
  total6MoPrecipMm: number;
  total6MoCropEtcMm: number;
  total6MoIrrigationNeedMm: number;
  total6MoDrainageSurplusMm: number;
  floodAlertMonths: number;
  droughtAlertMonths: number;
  monthlyBalances: MonthlyIrrigationBalance[];
  methods: IrrigationMethodRecommendation[];
  topMethod: IrrigationMethodRecommendation;
  contingencyActions: ContingencyActionItem[];
}

