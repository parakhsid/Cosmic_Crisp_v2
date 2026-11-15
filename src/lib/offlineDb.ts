import type {
  AlertThresholds,
  CachedFarmPack,
  DispatchedAlertLog,
  FarmProfileRecord,
  HarvestLogEntry,
  SyncQueueMutation,
} from '../types/agronomy';

const DB_NAME = 'CosmicCrispOfflineDB';
const DB_VERSION = 2;

const STORE_PACKS = 'farmPacks';
const STORE_LOGS = 'harvestLogs';
const STORE_SETTINGS = 'settings';
const STORE_ALERTS = 'alertHistory';
const STORE_FARMS = 'farmProfiles';
const STORE_SYNC_QUEUE = 'syncQueue';

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  pushEnabled: false,
  frostTempC: 2,
  heatTempC: 35,
  droughtWetnessPct: 32,
  heavyRainMm: 35,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PACKS)) {
        db.createObjectStore(STORE_PACKS, {keyPath: 'key'});
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, {keyPath: 'key'});
      }
      if (!db.objectStoreNames.contains(STORE_ALERTS)) {
        db.createObjectStore(STORE_ALERTS, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_FARMS)) {
        db.createObjectStore(STORE_FARMS, {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, {keyPath: 'id'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFarmPack(pack: CachedFarmPack): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      tx.objectStore(STORE_PACKS).put(pack);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(`cosmic_crisp_pack_${pack.key}`, JSON.stringify(pack));
  }
}

export async function getFarmPack(key: string): Promise<CachedFarmPack | null> {
  try {
    const db = await openDb();
    return await new Promise<CachedFarmPack | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const req = tx.objectStore(STORE_PACKS).get(key);
      req.onsuccess = () => resolve((req.result as CachedFarmPack) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem(`cosmic_crisp_pack_${key}`);
    return raw ? (JSON.parse(raw) as CachedFarmPack) : null;
  }
}

export async function listFarmPacks(): Promise<CachedFarmPack[]> {
  try {
    const db = await openDb();
    const list = await new Promise<CachedFarmPack[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, 'readonly');
      const req = tx.objectStore(STORE_PACKS).getAll();
      req.onsuccess = () => resolve((req.result as CachedFarmPack[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return list.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export async function deleteFarmPack(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, 'readwrite');
      tx.objectStore(STORE_PACKS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(`cosmic_crisp_pack_${key}`);
  }
}

// Cached Farm Profiles (mirrors server JSON DB for instant offline startup)
export async function saveFarmProfileCache(
  farm: FarmProfileRecord
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FARMS, 'readwrite');
      tx.objectStore(STORE_FARMS).put(farm);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(`cosmic_crisp_farm_${farm.id}`, JSON.stringify(farm));
  }
}

export async function getFarmProfileCache(
  farmId: string
): Promise<FarmProfileRecord | null> {
  try {
    const db = await openDb();
    return await new Promise<FarmProfileRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_FARMS, 'readonly');
      const req = tx.objectStore(STORE_FARMS).get(farmId);
      req.onsuccess = () => resolve((req.result as FarmProfileRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem(`cosmic_crisp_farm_${farmId}`);
    return raw ? (JSON.parse(raw) as FarmProfileRecord) : null;
  }
}

export async function listFarmProfileCaches(): Promise<FarmProfileRecord[]> {
  try {
    const db = await openDb();
    const list = await new Promise<FarmProfileRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_FARMS, 'readonly');
      const req = tx.objectStore(STORE_FARMS).getAll();
      req.onsuccess = () => resolve((req.result as FarmProfileRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

// Offline Sync Queue (flushed to POST /api/farms/:farmId/sync when reconnected)
export async function enqueueSyncMutation(
  mutation: SyncQueueMutation
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      tx.objectStore(STORE_SYNC_QUEUE).put(mutation);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await listSyncQueue();
    localStorage.setItem(
      'cosmic_crisp_sync_queue',
      JSON.stringify([...existing, mutation])
    );
  }
}

export async function listSyncQueue(
  farmId?: string
): Promise<SyncQueueMutation[]> {
  try {
    const db = await openDb();
    const list = await new Promise<SyncQueueMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_SYNC_QUEUE).getAll();
      req.onsuccess = () => resolve((req.result as SyncQueueMutation[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    const sorted = list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return farmId ? sorted.filter((m) => m.farmId === farmId) : sorted;
  } catch {
    const raw = localStorage.getItem('cosmic_crisp_sync_queue');
    const parsed = raw ? (JSON.parse(raw) as SyncQueueMutation[]) : [];
    return farmId ? parsed.filter((m) => m.farmId === farmId) : parsed;
  }
}

export async function clearSyncQueueItems(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_SYNC_QUEUE);
      for (const id of ids) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await listSyncQueue();
    const idSet = new Set(ids);
    localStorage.setItem(
      'cosmic_crisp_sync_queue',
      JSON.stringify(existing.filter((m) => !idSet.has(m.id)))
    );
  }
}

export async function listHarvestLogs(): Promise<HarvestLogEntry[]> {
  try {
    const db = await openDb();
    const items = await new Promise<HarvestLogEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readonly');
      const req = tx.objectStore(STORE_LOGS).getAll();
      req.onsuccess = () => resolve((req.result as HarvestLogEntry[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return items.sort((a, b) => b.harvestDate.localeCompare(a.harvestDate));
  } catch {
    const raw = localStorage.getItem('cosmic_crisp_harvest_logs');
    return raw ? (JSON.parse(raw) as HarvestLogEntry[]) : [];
  }
}

export async function saveHarvestLog(entry: HarvestLogEntry): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readwrite');
      tx.objectStore(STORE_LOGS).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await listHarvestLogs();
    localStorage.setItem(
      'cosmic_crisp_harvest_logs',
      JSON.stringify([entry, ...existing])
    );
  }
}

export async function deleteHarvestLog(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LOGS, 'readwrite');
      tx.objectStore(STORE_LOGS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await listHarvestLogs();
    localStorage.setItem(
      'cosmic_crisp_harvest_logs',
      JSON.stringify(existing.filter((x) => x.id !== id))
    );
  }
}

export async function loadAlertThresholds(): Promise<AlertThresholds> {
  try {
    const db = await openDb();
    const row = await new Promise<{key: string; value: AlertThresholds} | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const req = tx.objectStore(STORE_SETTINGS).get('alertThresholds');
        req.onsuccess = () =>
          resolve(req.result as {key: string; value: AlertThresholds} | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    return row?.value ?? DEFAULT_ALERT_THRESHOLDS;
  } catch {
    return DEFAULT_ALERT_THRESHOLDS;
  }
}

export async function saveAlertThresholds(value: AlertThresholds): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put({key: 'alertThresholds', value});
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem('cosmic_crisp_alert_thresholds', JSON.stringify(value));
  }
}

export async function appendDispatchedAlert(log: DispatchedAlertLog): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_ALERTS, 'readwrite');
      tx.objectStore(STORE_ALERTS).put(log);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage fallback error
  }
}

export async function listDispatchedAlerts(): Promise<DispatchedAlertLog[]> {
  try {
    const db = await openDb();
    const list = await new Promise<DispatchedAlertLog[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ALERTS, 'readonly');
      const req = tx.objectStore(STORE_ALERTS).getAll();
      req.onsuccess = () => resolve((req.result as DispatchedAlertLog[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return list.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 20);
  } catch {
    return [];
  }
}
