import {ALL_EQUIPMENT_IDS, CROP_SPECS} from '../src/data/cropsAndLocations.ts';
import type {
  AlertThresholds,
  DispatchedAlertLog,
  EnsoScenarioMode,
  EquipmentId,
  FarmInsightBundle,
  FarmSettings,
  HarvestLogEntry,
  IrrigationMethodId,
  IrrigationPlanSettings,
  LaborAvailability,
  LanguageCode,
  LocationOption,
  PestControlPosture,
  PestPlanSettings,
  SlopeClass,
  SyncQueueMutation,
  UnitSystem,
  WaterAvailability,
  WaterScarcityLevel,
  WaterSourceType,
  YieldSensitivity,
} from '../src/types/agronomy.ts';

export type ValidationResult<T> =
  | {valid: true; data: T}
  | {valid: false; errors: string[]};

const VALID_CROP_IDS = new Set(CROP_SPECS.map((c) => c.id));
const VALID_EQUIPMENT_IDS = new Set<string>(ALL_EQUIPMENT_IDS);
const VALID_WATER = new Set<WaterAvailability>(['rainfed', 'limited', 'full']);
const VALID_LABOR = new Set<LaborAvailability>(['low', 'moderate', 'high']);
const VALID_SLOPE = new Set<SlopeClass>(['flat', 'gentle', 'steep']);
const VALID_LANGS = new Set<LanguageCode>(['en', 'es', 'hi', 'fr', 'pt']);
const VALID_UNITS = new Set<UnitSystem>(['metric', 'imperial']);
const VALID_SCENARIOS = new Set<EnsoScenarioMode>([
  'live',
  'el_nino',
  'la_nina',
  'neutral',
]);
const VALID_SCARCITY = new Set<WaterScarcityLevel>([
  'abundant',
  'moderate',
  'severe',
]);
const VALID_WATER_SOURCE = new Set<WaterSourceType>([
  'well',
  'canal',
  'rain_harvest',
  'mixed',
]);
const VALID_IRRIG_METHODS = new Set<IrrigationMethodId>([
  'rain_pipes',
  'drip',
  'sprinkler',
  'furrow',
  'drainage',
]);
const VALID_PEST_POSTURES = new Set<PestControlPosture>([
  'ipm',
  'organic',
  'conventional',
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateLocation(raw: unknown): ValidationResult<LocationOption> {
  if (!isRecord(raw)) {
    return {valid: false, errors: ['location must be an object']};
  }
  const errors: string[] = [];
  if (typeof raw.name !== 'string' || raw.name.trim().length < 2) {
    errors.push('location.name must be at least 2 characters');
  }
  if (!isFiniteNum(raw.lat) || raw.lat < -90 || raw.lat > 90) {
    errors.push('location.lat must be between -90 and 90');
  }
  if (!isFiniteNum(raw.lon) || raw.lon < -180 || raw.lon > 180) {
    errors.push('location.lon must be between -180 and 180');
  }
  if (errors.length) return {valid: false, errors};

  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  return {
    valid: true,
    data: {
      id:
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim().slice(0, 80)
          : `${lat.toFixed(3)},${lon.toFixed(3)}`,
      name: String(raw.name).trim().slice(0, 120),
      region:
        typeof raw.region === 'string' && raw.region.trim()
          ? raw.region.trim().slice(0, 100)
          : 'Agricultural Region',
      country:
        typeof raw.country === 'string'
          ? raw.country.trim().slice(0, 80)
          : '',
      lat,
      lon,
      climateZone:
        typeof raw.climateZone === 'string'
          ? raw.climateZone.trim().slice(0, 80)
          : 'Satellite Agro-Zone',
      usdaZone:
        typeof raw.usdaZone === 'string'
          ? raw.usdaZone.trim().slice(0, 16)
          : '6b',
      traditionalCrops: Array.isArray(raw.traditionalCrops)
        ? raw.traditionalCrops.filter(
            (x): x is string => typeof x === 'string' && VALID_CROP_IDS.has(x)
          )
        : undefined,
      regionalSource:
        raw.regionalSource === 'usda_cropscape' ||
        raw.regionalSource === 'agro_biome_matrix'
          ? raw.regionalSource
          : undefined,
      regionalZoneLabel:
        typeof raw.regionalZoneLabel === 'string'
          ? raw.regionalZoneLabel.trim().slice(0, 120)
          : undefined,
    },
  };
}

export function validateCreateFarm(body: unknown): ValidationResult<{
  id?: string;
  name: string;
  location?: LocationOption;
  settings?: Partial<FarmSettings>;
}> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const errors: string[] = [];
  if (
    typeof body.name !== 'string' ||
    body.name.trim().length < 2 ||
    body.name.trim().length > 80
  ) {
    errors.push('name must be between 2 and 80 characters');
  }

  let id: string | undefined;
  if (body.id !== undefined) {
    if (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{3,80}$/.test(body.id)) {
      errors.push('id must be 3-80 alphanumeric, hyphen, or underscore characters');
    } else {
      id = body.id;
    }
  }

  let location: LocationOption | undefined;
  if (body.location !== undefined) {
    const locCheck = validateLocation(body.location);
    if (!locCheck.valid) {
      errors.push(...locCheck.errors);
    } else {
      location = locCheck.data;
    }
  }

  let settings: Partial<FarmSettings> | undefined;
  if (body.settings !== undefined) {
    const settingsCheck = validateSettingsPatch(body.settings);
    if (!settingsCheck.valid) {
      errors.push(...settingsCheck.errors);
    } else {
      const {location: _loc, ...rest} = settingsCheck.data;
      settings = rest;
    }
  }

  if (errors.length) return {valid: false, errors};
  return {
    valid: true,
    data: {
      id,
      name: String(body.name).trim(),
      location,
      settings,
    },
  };
}

export function validateSettingsPatch(
  body: unknown
): ValidationResult<Partial<FarmSettings> & {location?: LocationOption}> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const errors: string[] = [];
  const out: Partial<FarmSettings> & {location?: LocationOption} = {};

  if (body.currentCropId !== undefined) {
    if (
      typeof body.currentCropId !== 'string' ||
      !VALID_CROP_IDS.has(body.currentCropId)
    ) {
      errors.push('currentCropId must be a valid crop ID');
    } else {
      out.currentCropId = body.currentCropId;
    }
  }

  if (body.harvestMonth !== undefined) {
    if (
      !Number.isInteger(body.harvestMonth) ||
      Number(body.harvestMonth) < 0 ||
      Number(body.harvestMonth) > 11
    ) {
      errors.push('harvestMonth must be an integer between 0 and 11');
    } else {
      out.harvestMonth = Number(body.harvestMonth);
    }
  }

  if (body.areaAcres !== undefined) {
    if (
      !isFiniteNum(body.areaAcres) ||
      body.areaAcres < 1 ||
      body.areaAcres > 100000
    ) {
      errors.push('areaAcres must be between 1 and 100000');
    } else {
      out.areaAcres = Number(body.areaAcres);
    }
  }

  if (body.waterAvailability !== undefined) {
    if (
      typeof body.waterAvailability !== 'string' ||
      !VALID_WATER.has(body.waterAvailability as WaterAvailability)
    ) {
      errors.push('waterAvailability must be rainfed, limited, or full');
    } else {
      out.waterAvailability = body.waterAvailability as WaterAvailability;
    }
  }

  if (body.laborAvailability !== undefined) {
    if (
      typeof body.laborAvailability !== 'string' ||
      !VALID_LABOR.has(body.laborAvailability as LaborAvailability)
    ) {
      errors.push('laborAvailability must be low, moderate, or high');
    } else {
      out.laborAvailability = body.laborAvailability as LaborAvailability;
    }
  }

  if (body.slopeClass !== undefined) {
    if (
      typeof body.slopeClass !== 'string' ||
      !VALID_SLOPE.has(body.slopeClass as SlopeClass)
    ) {
      errors.push('slopeClass must be flat, gentle, or steep');
    } else {
      out.slopeClass = body.slopeClass as SlopeClass;
    }
  }

  if (body.ownedEquipment !== undefined) {
    if (!Array.isArray(body.ownedEquipment)) {
      errors.push('ownedEquipment must be an array');
    } else {
      const invalid = body.ownedEquipment.filter(
        (eq) => typeof eq !== 'string' || !VALID_EQUIPMENT_IDS.has(eq)
      );
      if (invalid.length > 0) {
        errors.push(`ownedEquipment contains invalid IDs: ${invalid.join(', ')}`);
      } else {
        out.ownedEquipment = Array.from(
          new Set(body.ownedEquipment as EquipmentId[])
        );
      }
    }
  }

  if (body.prioritizeOwnedEquipment !== undefined) {
    if (typeof body.prioritizeOwnedEquipment !== 'boolean') {
      errors.push('prioritizeOwnedEquipment must be a boolean');
    } else {
      out.prioritizeOwnedEquipment = body.prioritizeOwnedEquipment;
    }
  }

  if (body.lang !== undefined) {
    if (
      typeof body.lang !== 'string' ||
      !VALID_LANGS.has(body.lang as LanguageCode)
    ) {
      errors.push('lang must be one of en, es, hi, fr, pt');
    } else {
      out.lang = body.lang as LanguageCode;
    }
  }

  if (body.unitSystem !== undefined) {
    if (
      typeof body.unitSystem !== 'string' ||
      !VALID_UNITS.has(body.unitSystem as UnitSystem)
    ) {
      errors.push('unitSystem must be metric or imperial');
    } else {
      out.unitSystem = body.unitSystem as UnitSystem;
    }
  }

  if (body.irrigationPlan !== undefined) {
    if (!isRecord(body.irrigationPlan)) {
      errors.push('irrigationPlan must be an object');
    } else {
      const ip = body.irrigationPlan;
      if (!VALID_SCENARIOS.has(ip.scenarioOverride as EnsoScenarioMode)) {
        errors.push('irrigationPlan.scenarioOverride must be live, el_nino, la_nina, or neutral');
      } else if (!VALID_SCARCITY.has(ip.scarcityLevel as WaterScarcityLevel)) {
        errors.push('irrigationPlan.scarcityLevel must be abundant, moderate, or severe');
      } else if (!VALID_WATER_SOURCE.has(ip.waterSource as WaterSourceType)) {
        errors.push('irrigationPlan.waterSource must be well, canal, rain_harvest, or mixed');
      } else if (!VALID_IRRIG_METHODS.has(ip.selectedMethod as IrrigationMethodId)) {
        errors.push('irrigationPlan.selectedMethod must be rain_pipes, drip, sprinkler, furrow, or drainage');
      } else if (
        ip.completedContingencyIds !== undefined &&
        (!Array.isArray(ip.completedContingencyIds) ||
          ip.completedContingencyIds.some((x) => typeof x !== 'string'))
      ) {
        errors.push('irrigationPlan.completedContingencyIds must be an array of strings');
      } else {
        const cleanPlan: IrrigationPlanSettings = {
          scenarioOverride: ip.scenarioOverride as EnsoScenarioMode,
          scarcityLevel: ip.scarcityLevel as WaterScarcityLevel,
          waterSource: ip.waterSource as WaterSourceType,
          selectedMethod: ip.selectedMethod as IrrigationMethodId,
          completedContingencyIds: Array.isArray(ip.completedContingencyIds)
            ? Array.from(
                new Set(
                  ip.completedContingencyIds
                    .map((s) => String(s).trim().slice(0, 64))
                    .filter(Boolean)
                )
              )
            : [],
          updatedAt: new Date().toISOString(),
        };
        out.irrigationPlan = cleanPlan;
      }
    }
  }

  if (body.pestPlan !== undefined) {
    if (!isRecord(body.pestPlan)) {
      errors.push('pestPlan must be an object');
    } else {
      const pp = body.pestPlan;
      if (!VALID_PEST_POSTURES.has(pp.posture as PestControlPosture)) {
        errors.push('pestPlan.posture must be ipm, organic, or conventional');
      } else if (!VALID_SCENARIOS.has(pp.scenarioOverride as EnsoScenarioMode)) {
        errors.push('pestPlan.scenarioOverride must be live, el_nino, la_nina, or neutral');
      } else if (
        pp.completedPrepIds !== undefined &&
        (!Array.isArray(pp.completedPrepIds) ||
          pp.completedPrepIds.some((x) => typeof x !== 'string'))
      ) {
        errors.push('pestPlan.completedPrepIds must be an array of strings');
      } else if (
        pp.focusedThreatId !== undefined &&
        typeof pp.focusedThreatId !== 'string'
      ) {
        errors.push('pestPlan.focusedThreatId must be a string');
      } else {
        const cleanPestPlan: PestPlanSettings = {
          posture: pp.posture as PestControlPosture,
          scenarioOverride: pp.scenarioOverride as EnsoScenarioMode,
          completedPrepIds: Array.isArray(pp.completedPrepIds)
            ? Array.from(
                new Set(
                  pp.completedPrepIds
                    .map((s) => String(s).trim().slice(0, 64))
                    .filter(Boolean)
                )
              )
            : [],
          focusedThreatId:
            typeof pp.focusedThreatId === 'string' && pp.focusedThreatId.trim()
              ? pp.focusedThreatId.trim().slice(0, 64)
              : undefined,
          updatedAt: new Date().toISOString(),
        };
        out.pestPlan = cleanPestPlan;
      }
    }
  }

  if (body.location !== undefined) {
    const locCheck = validateLocation(body.location);
    if (!locCheck.valid) {
      errors.push(...locCheck.errors);
    } else {
      out.location = locCheck.data;
    }
  }

  if (errors.length) return {valid: false, errors};
  return {valid: true, data: out};
}

export function validateHarvestLogInput(
  body: unknown
): ValidationResult<HarvestLogEntry> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const errors: string[] = [];

  if (typeof body.cropId !== 'string' || !VALID_CROP_IDS.has(body.cropId)) {
    errors.push('cropId must be a valid crop ID');
  }
  if (
    typeof body.harvestDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.harvestDate)
  ) {
    errors.push('harvestDate must be YYYY-MM-DD');
  }
  if (
    !isFiniteNum(body.areaAcres) ||
    body.areaAcres < 0.1 ||
    body.areaAcres > 100000
  ) {
    errors.push('areaAcres must be between 0.1 and 100000');
  }
  if (
    !isFiniteNum(body.actualYieldTHa) ||
    body.actualYieldTHa < 0.05 ||
    body.actualYieldTHa > 150
  ) {
    errors.push('actualYieldTHa must be between 0.05 and 150');
  }
  if (
    typeof body.locationName !== 'string' ||
    body.locationName.trim().length < 2
  ) {
    errors.push('locationName is required');
  }
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    errors.push('notes must be a string');
  }

  if (errors.length) return {valid: false, errors};

  const id =
    typeof body.id === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(body.id)
      ? body.id
      : `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    valid: true,
    data: {
      id,
      locationKey:
        typeof body.locationKey === 'string' && body.locationKey.trim()
          ? body.locationKey.trim().slice(0, 80)
          : 'custom',
      locationName: String(body.locationName).trim().slice(0, 120),
      cropId: String(body.cropId),
      harvestDate: String(body.harvestDate),
      areaAcres: Number(body.areaAcres),
      actualYieldTHa: Number(Number(body.actualYieldTHa).toFixed(2)),
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '',
    },
  };
}

export function validateAlertThresholds(
  body: unknown
): ValidationResult<AlertThresholds> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const errors: string[] = [];

  if (typeof body.pushEnabled !== 'boolean') {
    errors.push('pushEnabled must be a boolean');
  }
  if (!isFiniteNum(body.frostTempC) || body.frostTempC < -25 || body.frostTempC > 15) {
    errors.push('frostTempC must be between -25 and 15');
  }
  if (!isFiniteNum(body.heatTempC) || body.heatTempC < 20 || body.heatTempC > 55) {
    errors.push('heatTempC must be between 20 and 55');
  }
  if (
    !isFiniteNum(body.droughtWetnessPct) ||
    body.droughtWetnessPct < 5 ||
    body.droughtWetnessPct > 85
  ) {
    errors.push('droughtWetnessPct must be between 5 and 85');
  }
  if (
    !isFiniteNum(body.heavyRainMm) ||
    body.heavyRainMm < 5 ||
    body.heavyRainMm > 300
  ) {
    errors.push('heavyRainMm must be between 5 and 300');
  }

  if (errors.length) return {valid: false, errors};
  return {
    valid: true,
    data: {
      pushEnabled: Boolean(body.pushEnabled),
      frostTempC: Number(body.frostTempC),
      heatTempC: Number(body.heatTempC),
      droughtWetnessPct: Number(body.droughtWetnessPct),
      heavyRainMm: Number(body.heavyRainMm),
    },
  };
}

export function validateAlertHistoryEntry(
  body: unknown
): ValidationResult<DispatchedAlertLog> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const errors: string[] = [];
  if (typeof body.title !== 'string' || !body.title.trim()) {
    errors.push('title is required');
  }
  if (typeof body.body !== 'string' || !body.body.trim()) {
    errors.push('body is required');
  }
  if (body.severity !== 'critical' && body.severity !== 'warning') {
    errors.push('severity must be critical or warning');
  }
  if (errors.length) return {valid: false, errors};

  return {
    valid: true,
    data: {
      id:
        typeof body.id === 'string' && /^[a-zA-Z0-9_-]{4,80}$/.test(body.id)
          ? body.id
          : `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(body.title).trim().slice(0, 160),
      body: String(body.body).trim().slice(0, 400),
      severity: body.severity as 'critical' | 'warning',
      sentAt:
        typeof body.sentAt === 'string' && !Number.isNaN(Date.parse(body.sentAt))
          ? body.sentAt
          : new Date().toISOString(),
    },
  };
}

export interface ValidatedPredictPayload {
  farmId?: string;
  bundle?: FarmInsightBundle;
  location?: LocationOption;
  currentCropId: string;
  harvestMonth: number;
  waterAvailability: WaterAvailability;
  laborAvailability: LaborAvailability;
  slopeClass: SlopeClass;
  ownedEquipment: EquipmentId[];
  prioritizeOwnedEquipment: boolean;
  recentHistoryCropIds: string[];
  sensitivity: YieldSensitivity;
  thresholds?: AlertThresholds;
}

export function validatePredictRequest(
  body: unknown
): ValidationResult<ValidatedPredictPayload> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }

  const settingsRes = validateSettingsPatch({
    currentCropId: body.currentCropId,
    harvestMonth: body.harvestMonth,
    waterAvailability: body.waterAvailability,
    laborAvailability: body.laborAvailability,
    slopeClass: body.slopeClass,
    ownedEquipment: body.ownedEquipment,
    prioritizeOwnedEquipment: body.prioritizeOwnedEquipment,
    location: body.location,
  });

  const errors: string[] = [];
  if (!settingsRes.valid) errors.push(...settingsRes.errors);

  if (!body.currentCropId) errors.push('currentCropId is required');
  if (body.harvestMonth === undefined) errors.push('harvestMonth is required');
  if (!body.waterAvailability) errors.push('waterAvailability is required');
  if (!body.laborAvailability) errors.push('laborAvailability is required');
  if (!body.slopeClass) errors.push('slopeClass is required');

  let bundle: FarmInsightBundle | undefined;
  if (body.bundle !== undefined) {
    if (
      !isRecord(body.bundle) ||
      !Array.isArray(body.bundle.monthlyClimate) ||
      body.bundle.monthlyClimate.length !== 12 ||
      !isRecord(body.bundle.soil) ||
      !isRecord(body.bundle.currentSnapshot)
    ) {
      errors.push('bundle must include valid monthlyClimate[12], soil, and currentSnapshot');
    } else {
      bundle = body.bundle as unknown as FarmInsightBundle;
    }
  }

  if (!bundle && !settingsRes.valid) {
    // Location error already captured if invalid
  }

  let sensitivity: YieldSensitivity = {
    rainfallDeltaPct: 0,
    nitrogenBoostKgHa: 0,
    conservationTillage: false,
  };
  if (body.sensitivity !== undefined) {
    if (!isRecord(body.sensitivity)) {
      errors.push('sensitivity must be an object');
    } else {
      const r = body.sensitivity.rainfallDeltaPct ?? 0;
      const n = body.sensitivity.nitrogenBoostKgHa ?? 0;
      const t = body.sensitivity.conservationTillage ?? false;
      if (!isFiniteNum(r) || r < -50 || r > 50) {
        errors.push('sensitivity.rainfallDeltaPct must be between -50 and 50');
      }
      if (!isFiniteNum(n) || n < -60 || n > 120) {
        errors.push('sensitivity.nitrogenBoostKgHa must be between -60 and 120');
      }
      if (typeof t !== 'boolean') {
        errors.push('sensitivity.conservationTillage must be boolean');
      }
      sensitivity = {
        rainfallDeltaPct: Number(r),
        nitrogenBoostKgHa: Number(n),
        conservationTillage: Boolean(t),
      };
    }
  }

  let thresholds: AlertThresholds | undefined;
  if (body.thresholds !== undefined) {
    const thRes = validateAlertThresholds(body.thresholds);
    if (!thRes.valid) errors.push(...thRes.errors);
    else thresholds = thRes.data;
  }

  const recentHistoryCropIds = Array.isArray(body.recentHistoryCropIds)
    ? body.recentHistoryCropIds.filter(
        (c): c is string => typeof c === 'string' && VALID_CROP_IDS.has(c)
      )
    : [];

  if (errors.length || !settingsRes.valid) {
    return {valid: false, errors};
  }

  return {
    valid: true,
    data: {
      farmId: typeof body.farmId === 'string' ? body.farmId.trim() : undefined,
      bundle,
      location: settingsRes.data.location,
      currentCropId: settingsRes.data.currentCropId!,
      harvestMonth: settingsRes.data.harvestMonth!,
      waterAvailability: settingsRes.data.waterAvailability!,
      laborAvailability: settingsRes.data.laborAvailability!,
      slopeClass: settingsRes.data.slopeClass!,
      ownedEquipment: settingsRes.data.ownedEquipment ?? [],
      prioritizeOwnedEquipment: settingsRes.data.prioritizeOwnedEquipment ?? false,
      recentHistoryCropIds,
      sensitivity,
      thresholds,
    },
  };
}

export function validateSyncMutations(
  body: unknown
): ValidationResult<SyncQueueMutation[]> {
  if (!isRecord(body) || !Array.isArray(body.mutations)) {
    return {valid: false, errors: ['body.mutations must be an array']};
  }
  const validMutations: SyncQueueMutation[] = [];
  const errors: string[] = [];

  for (let i = 0; i < body.mutations.length; i++) {
    const m = body.mutations[i];
    if (!isRecord(m) || typeof m.type !== 'string' || typeof m.id !== 'string') {
      errors.push(`mutations[${i}] missing id or type`);
      continue;
    }
    const base = {
      id: m.id,
      farmId: typeof m.farmId === 'string' ? m.farmId : '',
      createdAt:
        typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
    };
    if (m.type === 'settings') {
      const check = validateSettingsPatch(m.payload);
      if (!check.valid) errors.push(`mutations[${i}]: ${check.errors.join('; ')}`);
      else validMutations.push({...base, type: 'settings', payload: check.data});
    } else if (m.type === 'thresholds') {
      const check = validateAlertThresholds(m.payload);
      if (!check.valid) errors.push(`mutations[${i}]: ${check.errors.join('; ')}`);
      else validMutations.push({...base, type: 'thresholds', payload: check.data});
    } else if (m.type === 'log_add') {
      const check = validateHarvestLogInput(m.payload);
      if (!check.valid) errors.push(`mutations[${i}]: ${check.errors.join('; ')}`);
      else validMutations.push({...base, type: 'log_add', payload: check.data});
    } else if (m.type === 'log_delete') {
      if (!isRecord(m.payload) || typeof m.payload.logId !== 'string') {
        errors.push(`mutations[${i}]: log_delete requires payload.logId`);
      } else {
        validMutations.push({
          ...base,
          type: 'log_delete',
          payload: {logId: m.payload.logId},
        });
      }
    } else if (m.type === 'alert_history') {
      const check = validateAlertHistoryEntry(m.payload);
      if (!check.valid) errors.push(`mutations[${i}]: ${check.errors.join('; ')}`);
      else validMutations.push({...base, type: 'alert_history', payload: check.data});
    } else {
      errors.push(`mutations[${i}]: unknown mutation type ${m.type}`);
    }
  }

  if (errors.length) return {valid: false, errors};
  return {valid: true, data: validMutations};
}

const VALID_INGEST_SOURCES = new Set([
  'planetary_computer',
  'earthdata',
  'soilgrids',
]);

export interface ValidatedGeospatialRequest {
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  polygon?: Record<string, unknown>;
  sources?: string[];
  forceRefresh?: boolean;
}

export function validateGeospatialIngestRequest(
  body: unknown
): ValidationResult<ValidatedGeospatialRequest> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const errors: string[] = [];
  if (!isFiniteNum(body.lat) || body.lat < -90 || body.lat > 90) {
    errors.push('lat must be between -90 and 90');
  }
  if (!isFiniteNum(body.lon) || body.lon < -180 || body.lon > 180) {
    errors.push('lon must be between -180 and 180');
  }

  let bbox: [number, number, number, number] | undefined;
  if (body.bbox !== undefined) {
    if (
      !Array.isArray(body.bbox) ||
      body.bbox.length !== 4 ||
      !body.bbox.every((v) => isFiniteNum(v))
    ) {
      errors.push('bbox must be [minLon, minLat, maxLon, maxLat]');
    } else {
      const [minx, miny, maxx, maxy] = body.bbox.map(Number);
      if (minx >= maxx || miny >= maxy) {
        errors.push('bbox min values must be strictly less than max values');
      } else {
        bbox = [minx, miny, maxx, maxy];
      }
    }
  }

  let polygon: Record<string, unknown> | undefined;
  if (body.polygon !== undefined) {
    if (
      !isRecord(body.polygon) ||
      typeof body.polygon.type !== 'string' ||
      !Array.isArray(body.polygon.coordinates)
    ) {
      errors.push('polygon must be a valid GeoJSON geometry object');
    } else {
      polygon = body.polygon;
    }
  }

  let sources: string[] | undefined;
  if (body.sources !== undefined) {
    if (!Array.isArray(body.sources)) {
      errors.push('sources must be an array');
    } else {
      const invalid = body.sources.filter(
        (s) => typeof s !== 'string' || !VALID_INGEST_SOURCES.has(s)
      );
      if (invalid.length > 0) {
        errors.push(`invalid geospatial sources: ${invalid.join(', ')}`);
      } else {
        sources = Array.from(new Set(body.sources as string[]));
      }
    }
  }

  if (errors.length) return {valid: false, errors};
  return {
    valid: true,
    data: {
      lat: Number(body.lat),
      lon: Number(body.lon),
      bbox,
      polygon,
      sources,
      forceRefresh: Boolean(body.forceRefresh),
    },
  };
}

export interface ValidatedAiAnalyzeRequest extends ValidatedGeospatialRequest {
  farmId?: string;
  locationName: string;
  lang: LanguageCode;
  bundle?: FarmInsightBundle;
  geospatial?: Record<string, unknown>;
  farmerInputs: {
    currentCropId: string;
    harvestMonth: number;
    areaAcres: number;
    waterAvailability: WaterAvailability;
    laborAvailability: LaborAvailability;
    slopeClass: SlopeClass;
    ownedEquipment: EquipmentId[];
  };
}

export function validateAiAnalyzeRequest(
  body: unknown
): ValidationResult<ValidatedAiAnalyzeRequest> {
  if (!isRecord(body)) {
    return {valid: false, errors: ['Request body must be a JSON object']};
  }
  const geoCheck = validateGeospatialIngestRequest(body);
  const errors: string[] = geoCheck.valid ? [] : [...geoCheck.errors];

  const langRaw = typeof body.lang === 'string' ? body.lang : 'en';
  if (!VALID_LANGS.has(langRaw as LanguageCode)) {
    errors.push('lang must be one of en, es, hi, fr, pt');
  }

  const fiRaw = isRecord(body.farmerInputs) ? body.farmerInputs : {};
  const settingsCheck = validateSettingsPatch({
    currentCropId: fiRaw.currentCropId ?? 'corn',
    harvestMonth: fiRaw.harvestMonth ?? 9,
    areaAcres: fiRaw.areaAcres ?? 120,
    waterAvailability: fiRaw.waterAvailability ?? 'rainfed',
    laborAvailability: fiRaw.laborAvailability ?? 'moderate',
    slopeClass: fiRaw.slopeClass ?? 'flat',
    ownedEquipment: fiRaw.ownedEquipment ?? [],
  });
  if (!settingsCheck.valid) errors.push(...settingsCheck.errors);

  if (errors.length || !geoCheck.valid || !settingsCheck.valid) {
    return {valid: false, errors};
  }

  return {
    valid: true,
    data: {
      ...geoCheck.data,
      farmId: typeof body.farmId === 'string' ? body.farmId.trim() : undefined,
      locationName:
        typeof body.locationName === 'string' && body.locationName.trim()
          ? body.locationName.trim().slice(0, 120)
          : 'Selected Field',
      lang: langRaw as LanguageCode,
      bundle: isRecord(body.bundle)
        ? (body.bundle as unknown as FarmInsightBundle)
        : undefined,
      geospatial: isRecord(body.geospatial) ? body.geospatial : undefined,
      farmerInputs: {
        currentCropId: settingsCheck.data.currentCropId ?? 'corn',
        harvestMonth: settingsCheck.data.harvestMonth ?? 9,
        areaAcres: settingsCheck.data.areaAcres ?? 120,
        waterAvailability: settingsCheck.data.waterAvailability ?? 'rainfed',
        laborAvailability: settingsCheck.data.laborAvailability ?? 'moderate',
        slopeClass: settingsCheck.data.slopeClass ?? 'flat',
        ownedEquipment: settingsCheck.data.ownedEquipment ?? [],
      },
    },
  };
}

