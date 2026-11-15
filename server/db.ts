import {promises as fs} from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_OWNED_EQUIPMENT,
  GLOBAL_FARM_HUBS,
} from '../src/data/cropsAndLocations.ts';
import type {
  AlertThresholds,
  DispatchedAlertLog,
  FarmProfileRecord,
  FarmProfileSummary,
  FarmSettings,
  HarvestLogEntry,
  LocationOption,
  SyncQueueMutation,
} from '../src/types/agronomy.ts';

interface CosmicCrispDbSchema {
  version: 1;
  farms: Record<string, FarmProfileRecord>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cosmic-crisp-db.json');

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  pushEnabled: false,
  frostTempC: 2,
  heatTempC: 35,
  droughtWetnessPct: 32,
  heavyRainMm: 35,
};

function buildSeedDb(): CosmicCrispDbSchema {
  const now = new Date().toISOString();
  const storyIa = GLOBAL_FARM_HUBS[0];
  const ludhianaIn =
    GLOBAL_FARM_HUBS.find((h) => h.id === 'ludhiana-in') ?? GLOBAL_FARM_HUBS[4];

  return {
    version: 1,
    farms: {
      'north-40-iowa': {
        id: 'north-40-iowa',
        name: 'North 40 · Story County, IA',
        createdAt: now,
        updatedAt: now,
        location: storyIa,
        settings: {
          currentCropId: 'corn',
          harvestMonth: new Date().getMonth(),
          areaAcres: 120,
          waterAvailability: 'rainfed',
          laborAvailability: 'moderate',
          slopeClass: 'flat',
          ownedEquipment: [...DEFAULT_OWNED_EQUIPMENT],
          prioritizeOwnedEquipment: false,
          lang: 'en',
        },
        alertThresholds: {...DEFAULT_THRESHOLDS},
        harvestLogs: [
          {
            id: 'seed-log-ia-1',
            locationKey: storyIa.id,
            locationName: storyIa.name,
            cropId: 'corn',
            harvestDate: '2025-10-14',
            areaAcres: 120,
            actualYieldTHa: 10.6,
            notes: 'Strong stand, minimal stalk lodging after dry September.',
          },
          {
            id: 'seed-log-ia-2',
            locationKey: storyIa.id,
            locationName: storyIa.name,
            cropId: 'soybeans',
            harvestDate: '2024-10-03',
            areaAcres: 120,
            actualYieldTHa: 3.8,
            notes: 'No-till drilled into corn residue; clean nodulation.',
          },
        ],
        alertHistory: [],
      },
      'block-a-punjab': {
        id: 'block-a-punjab',
        name: 'Block A · Ludhiana, Punjab',
        createdAt: now,
        updatedAt: now,
        location: ludhianaIn,
        settings: {
          currentCropId: 'rice',
          harvestMonth: 9,
          areaAcres: 24,
          waterAvailability: 'full',
          laborAvailability: 'high',
          slopeClass: 'flat',
          ownedEquipment: [
            'tractor_tillage',
            'sprayer_spreader',
            'paddy_harvester',
            'grain_combine',
          ],
          prioritizeOwnedEquipment: false,
          lang: 'en',
        },
        alertThresholds: {
          ...DEFAULT_THRESHOLDS,
          heatTempC: 38,
          heavyRainMm: 45,
        },
        harvestLogs: [
          {
            id: 'seed-log-pb-1',
            locationKey: ludhianaIn.id,
            locationName: ludhianaIn.name,
            cropId: 'rice',
            harvestDate: '2025-10-22',
            areaAcres: 24,
            actualYieldTHa: 6.9,
            notes: 'Kharif paddy harvested cleanly; ready for rabi wheat seeding.',
          },
        ],
        alertHistory: [],
      },
    },
  };
}

let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureDbFile(): Promise<CosmicCrispDbSchema> {
  await fs.mkdir(DATA_DIR, {recursive: true});
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CosmicCrispDbSchema;
    if (parsed && parsed.version === 1 && parsed.farms && Object.keys(parsed.farms).length > 0) {
      return parsed;
    }
  } catch {
    // File does not exist yet or is malformed; initialize cleanly
  }
  const seeded = buildSeedDb();
  await atomicWriteDb(seeded);
  return seeded;
}

async function atomicWriteDb(db: CosmicCrispDbSchema): Promise<void> {
  await fs.mkdir(DATA_DIR, {recursive: true});
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmpFile, DB_FILE);
}

function runSerialized<T>(fn: (db: CosmicCrispDbSchema) => Promise<T> | T): Promise<T> {
  const next = writeQueue.then(async () => {
    const db = await ensureDbFile();
    return await fn(db);
  });
  writeQueue = next.catch(() => undefined);
  return next;
}

export function getDbFilePath(): string {
  return DB_FILE;
}

export async function checkDbHealth(): Promise<{ok: boolean; farmCount: number; filePath: string}> {
  const db = await ensureDbFile();
  return {
    ok: true,
    farmCount: Object.keys(db.farms).length,
    filePath: DB_FILE,
  };
}

export async function listFarmSummaries(): Promise<FarmProfileSummary[]> {
  const db = await ensureDbFile();
  return Object.values(db.farms)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((f) => ({
      id: f.id,
      name: f.name,
      locationName: f.location.name,
      updatedAt: f.updatedAt,
    }));
}

export async function getFarmById(farmId: string): Promise<FarmProfileRecord | null> {
  const db = await ensureDbFile();
  return db.farms[farmId] ?? null;
}

export async function createFarmProfile(input: {
  name: string;
  location?: LocationOption;
}): Promise<FarmProfileRecord> {
  return runSerialized(async (db) => {
    const slugBase = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);
    const id = `${slugBase || 'farm'}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const loc = input.location ?? GLOBAL_FARM_HUBS[0];

    const record: FarmProfileRecord = {
      id,
      name: input.name,
      createdAt: now,
      updatedAt: now,
      location: loc,
      settings: {
        currentCropId: 'corn',
        harvestMonth: new Date().getMonth(),
        areaAcres: 80,
        waterAvailability: 'rainfed',
        laborAvailability: 'moderate',
        slopeClass: 'flat',
        ownedEquipment: [...DEFAULT_OWNED_EQUIPMENT],
        prioritizeOwnedEquipment: false,
        lang: 'en',
      },
      alertThresholds: {...DEFAULT_THRESHOLDS},
      harvestLogs: [],
      alertHistory: [],
    };
    db.farms[id] = record;
    await atomicWriteDb(db);
    return record;
  });
}

export async function patchFarmSettings(
  farmId: string,
  patch: Partial<FarmSettings> & {location?: LocationOption}
): Promise<FarmProfileRecord | null> {
  return runSerialized(async (db) => {
    const farm = db.farms[farmId];
    if (!farm) return null;
    const {location, ...settingsPatch} = patch;
    if (location) {
      farm.location = location;
    }
    farm.settings = {
      ...farm.settings,
      ...settingsPatch,
    };
    farm.updatedAt = new Date().toISOString();
    await atomicWriteDb(db);
    return farm;
  });
}

export async function addHarvestLog(
  farmId: string,
  entry: HarvestLogEntry
): Promise<FarmProfileRecord | null> {
  return runSerialized(async (db) => {
    const farm = db.farms[farmId];
    if (!farm) return null;
    const existingIdx = farm.harvestLogs.findIndex((l) => l.id === entry.id);
    if (existingIdx >= 0) {
      farm.harvestLogs[existingIdx] = entry;
    } else {
      farm.harvestLogs.unshift(entry);
    }
    farm.harvestLogs.sort((a, b) => b.harvestDate.localeCompare(a.harvestDate));
    farm.updatedAt = new Date().toISOString();
    await atomicWriteDb(db);
    return farm;
  });
}

export async function removeHarvestLog(
  farmId: string,
  logId: string
): Promise<{farm: FarmProfileRecord; removed: boolean} | null> {
  return runSerialized(async (db) => {
    const farm = db.farms[farmId];
    if (!farm) return null;
    const before = farm.harvestLogs.length;
    farm.harvestLogs = farm.harvestLogs.filter((l) => l.id !== logId);
    const removed = farm.harvestLogs.length !== before;
    if (removed) {
      farm.updatedAt = new Date().toISOString();
      await atomicWriteDb(db);
    }
    return {farm, removed};
  });
}

export async function updateAlertThresholds(
  farmId: string,
  thresholds: AlertThresholds
): Promise<FarmProfileRecord | null> {
  return runSerialized(async (db) => {
    const farm = db.farms[farmId];
    if (!farm) return null;
    farm.alertThresholds = thresholds;
    farm.updatedAt = new Date().toISOString();
    await atomicWriteDb(db);
    return farm;
  });
}

export async function appendAlertHistory(
  farmId: string,
  entry: DispatchedAlertLog
): Promise<FarmProfileRecord | null> {
  return runSerialized(async (db) => {
    const farm = db.farms[farmId];
    if (!farm) return null;
    const withoutDup = farm.alertHistory.filter((a) => a.id !== entry.id);
    farm.alertHistory = [entry, ...withoutDup].slice(0, 30);
    farm.updatedAt = new Date().toISOString();
    await atomicWriteDb(db);
    return farm;
  });
}

export async function applySyncMutations(
  farmId: string,
  mutations: SyncQueueMutation[]
): Promise<FarmProfileRecord | null> {
  return runSerialized(async (db) => {
    const farm = db.farms[farmId];
    if (!farm) return null;

    for (const m of mutations) {
      if (m.type === 'settings') {
        const {location, ...settingsPatch} = m.payload;
        if (location) farm.location = location;
        farm.settings = {...farm.settings, ...settingsPatch};
      } else if (m.type === 'thresholds') {
        farm.alertThresholds = m.payload;
      } else if (m.type === 'log_add') {
        const idx = farm.harvestLogs.findIndex((l) => l.id === m.payload.id);
        if (idx >= 0) farm.harvestLogs[idx] = m.payload;
        else farm.harvestLogs.unshift(m.payload);
      } else if (m.type === 'log_delete') {
        farm.harvestLogs = farm.harvestLogs.filter((l) => l.id !== m.payload.logId);
      } else if (m.type === 'alert_history') {
        const withoutDup = farm.alertHistory.filter((a) => a.id !== m.payload.id);
        farm.alertHistory = [m.payload, ...withoutDup].slice(0, 30);
      }
    }

    farm.harvestLogs.sort((a, b) => b.harvestDate.localeCompare(a.harvestDate));
    farm.updatedAt = new Date().toISOString();
    await atomicWriteDb(db);
    return farm;
  });
}
