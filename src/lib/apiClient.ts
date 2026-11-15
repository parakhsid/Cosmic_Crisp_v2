import type {
  AiAnalyzeApiResponse,
  AlertThresholds,
  DispatchedAlertLog,
  EquipmentId,
  FarmInsightBundle,
  FarmProfileRecord,
  FarmProfileSummary,
  FarmSettings,
  GeospatialIngestionPayload,
  HarvestLogEntry,
  LaborAvailability,
  LanguageCode,
  LocationOption,
  PredictApiResponse,
  SeasonalEnsoOutlook,
  SlopeClass,
  SyncQueueMutation,
  WaterAvailability,
  YieldSensitivity,
} from '../types/agronomy';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json()) as T & {error?: string; details?: string[]};
  if (!res.ok) {
    const detailMsg = data.details?.length ? `: ${data.details.join(', ')}` : '';
    throw new Error(`${data.error || `HTTP ${res.status}`}${detailMsg}`);
  }
  return data;
}

export function fetchFarmsBootstrap(farmId?: string): Promise<{
  farms: FarmProfileSummary[];
  activeFarm: FarmProfileRecord | null;
}> {
  const query = farmId ? `?farmId=${encodeURIComponent(farmId)}` : '';
  return apiJson(`/api/farms${query}`);
}

export function createFarmApi(input: {
  id?: string;
  name: string;
  location?: LocationOption;
  settings?: Partial<FarmSettings>;
}): Promise<{farm: FarmProfileRecord; farms: FarmProfileSummary[]}> {
  return apiJson('/api/farms', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function patchFarmSettingsApi(
  farmId: string,
  patch: Partial<FarmSettings> & {location?: LocationOption}
): Promise<{farm: FarmProfileRecord}> {
  return apiJson(`/api/farms/${encodeURIComponent(farmId)}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function addHarvestLogApi(
  farmId: string,
  entry: HarvestLogEntry
): Promise<{log: HarvestLogEntry; logs: HarvestLogEntry[]}> {
  return apiJson(`/api/farms/${encodeURIComponent(farmId)}/logs`, {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export function deleteHarvestLogApi(
  farmId: string,
  logId: string
): Promise<{removed: boolean; logs: HarvestLogEntry[]}> {
  return apiJson(
    `/api/farms/${encodeURIComponent(farmId)}/logs/${encodeURIComponent(logId)}`,
    {method: 'DELETE'}
  );
}

export function updateAlertThresholdsApi(
  farmId: string,
  thresholds: AlertThresholds
): Promise<{farm: FarmProfileRecord}> {
  return apiJson(`/api/farms/${encodeURIComponent(farmId)}/alerts/thresholds`, {
    method: 'PUT',
    body: JSON.stringify(thresholds),
  });
}

export function appendAlertHistoryApi(
  farmId: string,
  entry: DispatchedAlertLog
): Promise<{entry: DispatchedAlertLog; alertHistory: DispatchedAlertLog[]}> {
  return apiJson(`/api/farms/${encodeURIComponent(farmId)}/alerts/history`, {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export function syncOfflineMutationsApi(
  farmId: string,
  mutations: SyncQueueMutation[]
): Promise<{farm: FarmProfileRecord; syncedCount: number}> {
  return apiJson(`/api/farms/${encodeURIComponent(farmId)}/sync`, {
    method: 'POST',
    body: JSON.stringify({mutations}),
  });
}

export function predictNextCropsApi(payload: {
  farmId?: string;
  bundle: FarmInsightBundle;
  currentCropId: string;
  harvestMonth: number;
  waterAvailability: WaterAvailability;
  laborAvailability: LaborAvailability;
  slopeClass: SlopeClass;
  ownedEquipment: EquipmentId[];
  prioritizeOwnedEquipment: boolean;
  recentHistoryCropIds: string[];
  sensitivity?: YieldSensitivity;
  thresholds?: AlertThresholds;
}): Promise<PredictApiResponse> {
  return apiJson('/api/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function ingestGeospatialApi(payload: {
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  sources?: string[];
  forceRefresh?: boolean;
}): Promise<GeospatialIngestionPayload> {
  return apiJson('/api/geospatial/ingest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function analyzeWithAiApi(payload: {
  farmId?: string;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  locationName: string;
  lang: LanguageCode;
  bundle?: FarmInsightBundle;
  geospatial?: GeospatialIngestionPayload;
  forceRefresh?: boolean;
  farmerInputs: {
    currentCropId: string;
    harvestMonth: number;
    areaAcres: number;
    waterAvailability: WaterAvailability;
    laborAvailability: LaborAvailability;
    slopeClass: SlopeClass;
    ownedEquipment: EquipmentId[];
  };
}): Promise<AiAnalyzeApiResponse> {
  return apiJson('/api/ai/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchSeasonalOutlookApi(loc: {
  lat: number;
  lon: number;
  name?: string;
  region?: string;
  country?: string;
}): Promise<SeasonalEnsoOutlook> {
  const qs = new URLSearchParams({
    lat: String(loc.lat),
    lon: String(loc.lon),
    name: loc.name ?? '',
    region: loc.region ?? '',
    country: loc.country ?? '',
  });
  return apiJson(`/api/seasonal-outlook?${qs.toString()}`);
}


