import {WifiOff} from 'lucide-react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AlertsAndOfflineView} from './components/AlertsAndOfflineView';
import {ClimateAnalyticsView} from './components/ClimateAnalyticsView';
import {FarmLogView} from './components/FarmLogView';
import {IrrigationPlannerView} from './components/IrrigationPlannerView';
import {MobileBottomNav} from './components/MobileBottomNav';
import {OverviewDashboard} from './components/OverviewDashboard';
import {PestDiseaseView} from './components/PestDiseaseView';
import {TopBar} from './components/TopBar';
import {WorkspaceToolbar} from './components/WorkspaceToolbar';
import {
  DEFAULT_OWNED_EQUIPMENT,
  GLOBAL_FARM_HUBS,
  makeLocationKey,
} from './data/cropsAndLocations';
import {buildRegionalFallbackBundle} from './data/fallbackClimate';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {t, type TranslationKey} from './i18n/translations';
import {
  addHarvestLogApi,
  appendAlertHistoryApi,
  createFarmApi,
  deleteHarvestLogApi,
  fetchFarmsBootstrap,
  fetchSeasonalOutlookApi,
  patchFarmSettingsApi,
  predictNextCropsApi,
  syncOfflineMutationsApi,
  updateAlertThresholdsApi,
} from './lib/apiClient';
import {
  dispatchCropPushNotification,
  getNotificationPermission,
  requestPushPermission,
  type PushPermissionState,
} from './lib/notifications';
import {
  appendDispatchedAlert,
  clearSyncQueueItems,
  DEFAULT_ALERT_THRESHOLDS,
  deleteFarmPack,
  enqueueSyncMutation,
  getFarmPack,
  getFarmProfileCache,
  listFarmPacks,
  listFarmProfileCaches,
  listSyncQueue,
  saveFarmPack,
  saveFarmProfileCache,
} from './lib/offlineDb';
import {evaluateWeatherAlerts, predictNextCrops} from './lib/statisticalModel';
import type {
  AlertThresholds,
  CachedFarmPack,
  CropPrediction,
  DispatchedAlertLog,
  EquipmentId,
  FarmInsightBundle,
  FarmProfileRecord,
  FarmProfileSummary,
  FarmSettings,
  HarvestLogEntry,
  IrrigationMethodId,
  IrrigationPlanSettings,
  LaborAvailability,
  LanguageCode,
  LocationOption,
  NavTab,
  PestPlanSettings,
  SeasonalEnsoOutlook,
  SlopeClass,
  SyncQueueMutation,
  UnitSystem,
  WaterAvailability,
  WeatherAlert,
  YieldSensitivity,
} from './types/agronomy';

const DEFAULT_FARM_ID = 'north-40-iowa';

const DEFAULT_IRRIGATION_PLAN: IrrigationPlanSettings = {
  scenarioOverride: 'live',
  scarcityLevel: 'moderate',
  waterSource: 'well',
  selectedMethod: 'rain_pipes',
  completedContingencyIds: [],
};

const DEFAULT_PEST_PLAN: PestPlanSettings = {
  posture: 'ipm',
  scenarioOverride: 'live',
  completedPrepIds: [],
};

export default function App() {
  const isOnline = useOnlineStatus();
  const [simulateOffline, setSimulateOffline] = useState(false);
  const isOfflineActive = !isOnline || simulateOffline;

  const [farms, setFarms] = useState<FarmProfileSummary[]>(() => {
    try {
      const cached = localStorage.getItem('cosmic_crisp_farms_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as FarmProfileSummary[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fall back to default farm summary
    }
    return [
      {
        id: DEFAULT_FARM_ID,
        name: 'North 40 · Story County, IA',
        locationName: GLOBAL_FARM_HUBS[0].name,
        updatedAt: new Date().toISOString(),
      },
    ];
  });
  const [activeFarmId, setActiveFarmId] = useState<string>(() => {
    return localStorage.getItem('cosmic_crisp_active_farm_id') || DEFAULT_FARM_ID;
  });

  const updateFarmsList = useCallback(
    (
      next:
        | FarmProfileSummary[]
        | ((prev: FarmProfileSummary[]) => FarmProfileSummary[])
    ) => {
      setFarms((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          localStorage.setItem('cosmic_crisp_farms_cache', JSON.stringify(resolved));
        } catch {
          // Ignore storage quota errors
        }
        return resolved;
      });
    },
    []
  );

  const [lang, setLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('cosmic_crisp_lang') as LanguageCode | null;
    return saved && ['en', 'es', 'hi', 'fr', 'pt'].includes(saved) ? saved : 'en';
  });
  const [unit, setUnit] = useState<UnitSystem>(() => {
    const saved = localStorage.getItem('cosmic_crisp_unit_system_v2') as UnitSystem | null;
    return saved === 'metric' || saved === 'imperial' ? saved : 'imperial';
  });

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedLocation, setSelectedLocation] = useState<LocationOption>(
    GLOBAL_FARM_HUBS[0]
  );
  const [isPreviewingLocation, setIsPreviewingLocation] = useState(false);
  const activeSavedLocationRef = useRef<LocationOption>(GLOBAL_FARM_HUBS[0]);
  const [currentCropId, setCurrentCropId] = useState('corn');
  const [harvestMonth, setHarvestMonth] = useState(() => new Date().getMonth());
  const [areaAcres, setAreaAcres] = useState(120);
  const [waterAvailability, setWaterAvailability] =
    useState<WaterAvailability>('rainfed');
  const [laborAvailability, setLaborAvailability] =
    useState<LaborAvailability>('moderate');
  const [slopeClass, setSlopeClass] = useState<SlopeClass>('flat');
  const [slopeOverridden, setSlopeOverridden] = useState(false);
  const [ownedEquipment, setOwnedEquipment] = useState<EquipmentId[]>(
    DEFAULT_OWNED_EQUIPMENT
  );
  const [prioritizeOwnedEquipment, setPrioritizeOwnedEquipment] = useState(false);
  const [irrigationPlan, setIrrigationPlan] = useState<IrrigationPlanSettings>(
    DEFAULT_IRRIGATION_PLAN
  );
  const [pestPlan, setPestPlan] = useState<PestPlanSettings>(DEFAULT_PEST_PLAN);

  const [bundle, setBundle] = useState<FarmInsightBundle | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [servedFromCache, setServedFromCache] = useState(false);
  const [seasonalOutlook, setSeasonalOutlook] = useState<SeasonalEnsoOutlook | null>(
    null
  );
  const [loadingOutlook, setLoadingOutlook] = useState(false);

  const [sensitivity, setSensitivity] = useState<YieldSensitivity>({
    rainfallDeltaPct: 0,
    nitrogenBoostKgHa: 0,
    conservationTillage: false,
  });

  const [thresholds, setThresholds] = useState<AlertThresholds>(
    DEFAULT_ALERT_THRESHOLDS
  );
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getNotificationPermission()
  );
  const [testPushFeedback, setTestPushFeedback] = useState<string | null>(null);
  const [alertHistory, setAlertHistory] = useState<DispatchedAlertLog[]>([]);
  const [savedPacks, setSavedPacks] = useState<CachedFarmPack[]>([]);
  const [harvestLogs, setHarvestLogs] = useState<HarvestLogEntry[]>([]);

  const [serverPredictions, setServerPredictions] = useState<CropPrediction[] | null>(
    null
  );
  const [serverAlerts, setServerAlerts] = useState<WeatherAlert[] | null>(null);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'pending'>(
    'synced'
  );
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const hydratedRef = useRef(false);

  const normalizeSeededFarm = useCallback(
    (farm: FarmProfileRecord): {farm: FarmProfileRecord; healed: boolean} => {
      if (farm.id === 'north-40-iowa' && farm.location?.id !== GLOBAL_FARM_HUBS[0].id) {
        return {farm: {...farm, location: GLOBAL_FARM_HUBS[0]}, healed: true};
      }
      const ludhianaIn =
        GLOBAL_FARM_HUBS.find((h) => h.id === 'ludhiana-in') ?? GLOBAL_FARM_HUBS[4];
      if (farm.id === 'block-a-punjab' && farm.location?.id !== ludhianaIn.id) {
        return {farm: {...farm, location: ludhianaIn}, healed: true};
      }
      return {farm, healed: false};
    },
    []
  );

  const applyFarmRecordToState = useCallback(
    (rawFarm: FarmProfileRecord) => {
      const {farm} = normalizeSeededFarm(rawFarm);
      activeSavedLocationRef.current = farm.location;
      setIsPreviewingLocation(false);
      setActiveFarmId(farm.id);
      localStorage.setItem('cosmic_crisp_active_farm_id', farm.id);
      setSelectedLocation(farm.location);
      setCurrentCropId(farm.settings.currentCropId);
      setHarvestMonth(farm.settings.harvestMonth);
      setAreaAcres(farm.settings.areaAcres);
      setWaterAvailability(farm.settings.waterAvailability);
      setLaborAvailability(farm.settings.laborAvailability);
      setSlopeClass(farm.settings.slopeClass);
      setSlopeOverridden(true);
      setOwnedEquipment(farm.settings.ownedEquipment);
      setPrioritizeOwnedEquipment(farm.settings.prioritizeOwnedEquipment);
      setLang(farm.settings.lang);
      localStorage.setItem('cosmic_crisp_lang', farm.settings.lang);
      const resolvedUnit: UnitSystem =
        farm.settings.unitSystem === 'metric' || farm.settings.unitSystem === 'imperial'
          ? farm.settings.unitSystem
          : 'imperial';
      setUnit(resolvedUnit);
      localStorage.setItem('cosmic_crisp_unit_system_v2', resolvedUnit);
      setIrrigationPlan(
        farm.settings.irrigationPlan ?? {
          ...DEFAULT_IRRIGATION_PLAN,
          scarcityLevel:
            farm.settings.waterAvailability === 'full' ? 'abundant' : 'moderate',
        }
      );
      setPestPlan(farm.settings.pestPlan ?? DEFAULT_PEST_PLAN);
      setThresholds(farm.alertThresholds);
      setHarvestLogs(farm.harvestLogs);
      setAlertHistory(farm.alertHistory);
      void saveFarmProfileCache(farm);
    },
    [normalizeSeededFarm]
  );

  // Refresh pending sync queue badge count
  const refreshSyncQueueCount = useCallback(async () => {
    const queue = await listSyncQueue();
    setPendingSyncCount(queue.length);
    if (queue.length > 0 && isOfflineActive) {
      setSyncState('pending');
    }
  }, [isOfflineActive]);

  // Bootstrap active farm from backend JSON DB (or IndexedDB cache if offline)
  const bootstrapFarm = useCallback(
    async (targetFarmId?: string) => {
      const desiredId = targetFarmId ?? activeFarmId;
      try {
        if (!isOfflineActive) {
          let data = await fetchFarmsBootstrap(desiredId);
          const serverIds = new Set(data.farms.map((f) => f.id));
          const cachedAll = await listFarmProfileCaches();

          // Reconcile any custom client-created farms missing on the server
          let restoredAny = false;
          for (const cachedFarm of cachedAll) {
            const {farm: cleanFarm, healed} = normalizeSeededFarm(cachedFarm);
            if (healed) {
              await saveFarmProfileCache(cleanFarm);
            }
            if (
              cleanFarm.id !== 'north-40-iowa' &&
              cleanFarm.id !== 'block-a-punjab' &&
              !serverIds.has(cleanFarm.id)
            ) {
              try {
                await createFarmApi({
                  id: cleanFarm.id,
                  name: cleanFarm.name,
                  location: cleanFarm.location,
                  settings: cleanFarm.settings,
                });
                restoredAny = true;
              } catch {
                // Ignore individual restore failure
              }
            }
          }

          if (restoredAny) {
            data = await fetchFarmsBootstrap(desiredId);
          }

          updateFarmsList(data.farms);
          if (data.activeFarm) {
            applyFarmRecordToState(data.activeFarm);
          }
          hydratedRef.current = true;
          return;
        }
      } catch {
        // Fall through to IndexedDB offline cache
      }

      const cachedList = await listFarmProfileCaches();
      if (cachedList.length) {
        updateFarmsList(
          cachedList.map((f) => ({
            id: f.id,
            name: f.name,
            locationName: f.location.name,
            updatedAt: f.updatedAt,
          }))
        );
        const match =
          (await getFarmProfileCache(desiredId)) ?? cachedList[0];
        if (match) applyFarmRecordToState(match);
      }
      hydratedRef.current = true;
    },
    [
      activeFarmId,
      isOfflineActive,
      applyFarmRecordToState,
      updateFarmsList,
      normalizeSeededFarm,
    ]
  );

  useEffect(() => {
    void (async () => {
      const [packs] = await Promise.all([listFarmPacks(), bootstrapFarm()]);
      setSavedPacks(packs);
      await refreshSyncQueueCount();
    })();
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync queued IndexedDB mutations as soon as connectivity returns
  useEffect(() => {
    if (isOfflineActive || !hydratedRef.current) return;

    let cancelled = false;
    void (async () => {
      const queued = await listSyncQueue();
      if (!queued.length) {
        setPendingSyncCount(0);
        setSyncState('synced');
        return;
      }

      setSyncState('syncing');
      const byFarm = new Map<string, SyncQueueMutation[]>();
      for (const m of queued) {
        const list = byFarm.get(m.farmId) ?? [];
        list.push(m);
        byFarm.set(m.farmId, list);
      }

      for (const [fId, mutations] of byFarm.entries()) {
        try {
          const {farm} = await syncOfflineMutationsApi(fId, mutations);
          await clearSyncQueueItems(mutations.map((m) => m.id));
          await saveFarmProfileCache(farm);
          if (!cancelled && fId === activeFarmId) {
            applyFarmRecordToState(farm);
          }
        } catch {
          // Keep remaining queued mutations if sync fails transiently
        }
      }

      if (!cancelled) {
        const remaining = await listSyncQueue();
        setPendingSyncCount(remaining.length);
        setSyncState(remaining.length > 0 ? 'pending' : 'synced');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOfflineActive, activeFarmId, applyFarmRecordToState]);

  // Persist current farm snapshot into IndexedDB cache on local changes
  const updateLocalFarmCache = useCallback(
    async (mutator: (prev: FarmProfileRecord) => FarmProfileRecord) => {
      const existing = await getFarmProfileCache(activeFarmId);
      const base: FarmProfileRecord = existing ?? {
        id: activeFarmId,
        name:
          farms.find((f) => f.id === activeFarmId)?.name ??
          'North 40 · Story County, IA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        location: selectedLocation,
        settings: {
          currentCropId,
          harvestMonth,
          areaAcres,
          waterAvailability,
          laborAvailability,
          slopeClass,
          ownedEquipment,
          prioritizeOwnedEquipment,
          lang,
          unitSystem: unit,
          irrigationPlan,
          pestPlan,
        },
        alertThresholds: thresholds,
        harvestLogs,
        alertHistory,
      };
      await saveFarmProfileCache(mutator(base));
    },
    [
      activeFarmId,
      farms,
      selectedLocation,
      currentCropId,
      harvestMonth,
      areaAcres,
      waterAvailability,
      laborAvailability,
      slopeClass,
      ownedEquipment,
      prioritizeOwnedEquipment,
      lang,
      unit,
      irrigationPlan,
      pestPlan,
      thresholds,
      harvestLogs,
      alertHistory,
    ]
  );

  // Unified real-time settings persistence (Server JSON DB online, IndexedDB queue offline)
  const persistSettingsPatch = useCallback(
    async (patch: Partial<FarmSettings> & {location?: LocationOption}) => {
      if (isPreviewingLocation && !patch.location) {
        return;
      }
      if (patch.location) {
        const nextLocName = patch.location.name;
        updateFarmsList((prev) =>
          prev.map((f) =>
            f.id === activeFarmId
              ? {...f, locationName: nextLocName, updatedAt: new Date().toISOString()}
              : f
          )
        );
      }

      await updateLocalFarmCache((prev) => {
        const {location, ...settingsPatch} = patch;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          location: location ?? prev.location,
          settings: {...prev.settings, ...settingsPatch},
        };
      });

      if (isOfflineActive) {
        await enqueueSyncMutation({
          id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          farmId: activeFarmId,
          createdAt: new Date().toISOString(),
          type: 'settings',
          payload: patch,
        });
        await refreshSyncQueueCount();
        return;
      }

      setSyncState('syncing');
      try {
        const {farm} = await patchFarmSettingsApi(activeFarmId, patch);
        await saveFarmProfileCache(farm);
        setSyncState('synced');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('not found')) {
          const cached = await getFarmProfileCache(activeFarmId);
          if (cached) {
            try {
              const restored = await createFarmApi({
                id: cached.id,
                name: cached.name,
                location: cached.location,
                settings: cached.settings,
              });
              updateFarmsList(restored.farms);
              await saveFarmProfileCache(restored.farm);
              setSyncState('synced');
              return;
            } catch {
              // Fall through to sync queue
            }
          }
        }
        await enqueueSyncMutation({
          id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          farmId: activeFarmId,
          createdAt: new Date().toISOString(),
          type: 'settings',
          payload: patch,
        });
        await refreshSyncQueueCount();
      }
    },
    [
      activeFarmId,
      isOfflineActive,
      isPreviewingLocation,
      updateLocalFarmCache,
      refreshSyncQueueCount,
      updateFarmsList,
    ]
  );

  const handleSelectFarm = async (farmId: string) => {
    setSlopeOverridden(false);
    setIsPreviewingLocation(false);
    await bootstrapFarm(farmId);
  };

  const handleCreateFarm = async (name: string, location: LocationOption) => {
    const {farm, farms: updatedList} = await createFarmApi({
      name,
      location,
      settings: {
        currentCropId,
        harvestMonth,
        areaAcres,
        waterAvailability,
        laborAvailability,
        slopeClass,
        ownedEquipment,
        prioritizeOwnedEquipment,
        lang,
        unitSystem: unit,
        irrigationPlan,
        pestPlan,
      },
    });
    updateFarmsList(updatedList);
    applyFarmRecordToState(farm);
  };

  const handleChangeLang = (next: LanguageCode) => {
    setLang(next);
    localStorage.setItem('cosmic_crisp_lang', next);
    void persistSettingsPatch({lang: next});
  };

  const handleChangeUnit = (next: UnitSystem) => {
    setUnit(next);
    localStorage.setItem('cosmic_crisp_unit_system_v2', next);
    void persistSettingsPatch({unitSystem: next});
  };

  const handleChangeCurrentCrop = (cropId: string) => {
    setCurrentCropId(cropId);
    void persistSettingsPatch({currentCropId: cropId});
  };

  const handleChangeHarvestMonth = (month: number) => {
    setHarvestMonth(month);
    void persistSettingsPatch({harvestMonth: month});
  };

  const handleChangeAreaAcres = (acres: number) => {
    setAreaAcres(acres);
    void persistSettingsPatch({areaAcres: acres});
  };

  const handleChangeWater = (next: WaterAvailability) => {
    setWaterAvailability(next);
    void persistSettingsPatch({waterAvailability: next});
  };

  const handleChangeLabor = (next: LaborAvailability) => {
    setLaborAvailability(next);
    void persistSettingsPatch({laborAvailability: next});
  };

  const handleChangeSlope = (next: SlopeClass) => {
    setSlopeClass(next);
    setSlopeOverridden(true);
    void persistSettingsPatch({slopeClass: next});
  };

  const handleToggleEquipment = (eqId: EquipmentId) => {
    setOwnedEquipment((prev) => {
      const next = prev.includes(eqId)
        ? prev.filter((item) => item !== eqId)
        : [...prev, eqId];
      void persistSettingsPatch({ownedEquipment: next});
      return next;
    });
  };

  const handleChangePrioritizeEquipment = (val: boolean) => {
    setPrioritizeOwnedEquipment(val);
    void persistSettingsPatch({prioritizeOwnedEquipment: val});
  };

  const handleSelectLocation = (loc: LocationOption) => {
    setSlopeOverridden(false);
    setSelectedLocation(loc);
    const savedLoc = activeSavedLocationRef.current;
    const matchesSavedFarmLocation =
      savedLoc.id === loc.id ||
      (Math.abs(savedLoc.lat - loc.lat) < 0.01 &&
        Math.abs(savedLoc.lon - loc.lon) < 0.01);
    setIsPreviewingLocation(!matchesSavedFarmLocation);
  };

  // Load live satellite/soil/DEM insights for selected location
  const loadFarmInsights = useCallback(
    async (loc: LocationOption, offlineMode: boolean) => {
      setLoadingInsights(true);
      const packKey = makeLocationKey(loc.lat, loc.lon);

      if (offlineMode) {
        const cached = await getFarmPack(packKey);
        if (cached) {
          setBundle(cached.bundle);
          setServedFromCache(true);
        } else {
          setBundle(buildRegionalFallbackBundle(loc));
          setServedFromCache(false);
        }
        setLoadingInsights(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          lat: String(loc.lat),
          lon: String(loc.lon),
          name: loc.name,
          region: loc.region,
          country: loc.country,
        });
        const res = await fetch(`/api/farm-insights?${params.toString()}`);
        if (!res.ok) throw new Error('Upstream error');
        const data = (await res.json()) as FarmInsightBundle;
        setBundle(data);
        setServedFromCache(false);
      } catch {
        const cached = await getFarmPack(packKey);
        if (cached) {
          setBundle(cached.bundle);
          setServedFromCache(true);
        } else {
          setBundle(buildRegionalFallbackBundle(loc));
          setServedFromCache(false);
        }
      } finally {
        setLoadingInsights(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadFarmInsights(selectedLocation, isOfflineActive);
  }, [selectedLocation, isOfflineActive, loadFarmInsights]);

  // Load 6-month NOAA ONI + Open-Meteo Seasonal ensemble outlook (with offline cache fallback)
  const loadSeasonalOutlook = useCallback(
    async (loc: LocationOption, offlineMode: boolean) => {
      const cacheKey = `cosmic_crisp_seasonal_${makeLocationKey(loc.lat, loc.lon)}`;
      const readCached = (): SeasonalEnsoOutlook | null => {
        try {
          const raw = localStorage.getItem(cacheKey);
          return raw ? (JSON.parse(raw) as SeasonalEnsoOutlook) : null;
        } catch {
          return null;
        }
      };

      if (offlineMode) {
        setSeasonalOutlook(readCached());
        setLoadingOutlook(false);
        return;
      }

      setLoadingOutlook(true);
      try {
        const data = await fetchSeasonalOutlookApi(loc);
        setSeasonalOutlook(data);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {
          // Ignore localStorage quota errors
        }
      } catch {
        setSeasonalOutlook(readCached());
      } finally {
        setLoadingOutlook(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadSeasonalOutlook(selectedLocation, isOfflineActive);
  }, [selectedLocation, isOfflineActive, loadSeasonalOutlook]);

  const handleUpdateIrrigationPlan = useCallback(
    async (next: IrrigationPlanSettings) => {
      setIrrigationPlan(next);
      await persistSettingsPatch({irrigationPlan: next});
    },
    [persistSettingsPatch]
  );

  const handleUpdatePestPlan = useCallback(
    async (next: PestPlanSettings) => {
      setPestPlan(next);
      await persistSettingsPatch({pestPlan: next});
    },
    [persistSettingsPatch]
  );

  const handleChangeIrrigationMethodFromPest = useCallback(
    async (method: IrrigationMethodId) => {
      const nextIrr: IrrigationPlanSettings = {
        ...irrigationPlan,
        selectedMethod: method,
      };
      setIrrigationPlan(nextIrr);
      await persistSettingsPatch({irrigationPlan: nextIrr});
    },
    [irrigationPlan, persistSettingsPatch]
  );

  const activeFarmName = useMemo(() => {
    if (isPreviewingLocation) {
      return bundle?.location.name ?? selectedLocation.name;
    }
    return (
      farms.find((f) => f.id === activeFarmId)?.name ??
      bundle?.location.name ??
      selectedLocation.name
    );
  }, [isPreviewingLocation, farms, activeFarmId, bundle, selectedLocation.name]);

  useEffect(() => {
    if (bundle && !slopeOverridden) {
      setSlopeClass(bundle.currentSnapshot.inferredSlopeClass ?? 'flat');
    }
  }, [bundle, slopeOverridden]);

  const recentHistoryCropIds = useMemo(() => {
    if (!harvestLogs.length) return [];
    const locKey = bundle?.location.id;
    const localLogs = locKey
      ? harvestLogs.filter((l) => l.locationKey === locKey)
      : [];
    const source = localLogs.length ? localLogs : harvestLogs;
    return Array.from(new Set(source.slice(0, 3).map((l) => l.cropId)));
  }, [harvestLogs, bundle]);

  // Immediate local calculation (zero flicker + full offline capability)
  const localPredictions = useMemo(() => {
    if (!bundle) return [];
    return predictNextCrops(bundle, {
      currentCropId,
      harvestMonth,
      waterAvailability,
      laborAvailability,
      slopeClass,
      ownedEquipment,
      prioritizeOwnedEquipment,
      recentHistoryCropIds,
    });
  }, [
    bundle,
    currentCropId,
    harvestMonth,
    waterAvailability,
    laborAvailability,
    slopeClass,
    ownedEquipment,
    prioritizeOwnedEquipment,
    recentHistoryCropIds,
  ]);

  const localAlerts = useMemo(() => {
    if (!bundle) return [];
    return evaluateWeatherAlerts(bundle, thresholds);
  }, [bundle, thresholds]);

  // Server-side validated statistical prediction & hazard evaluation when online
  useEffect(() => {
    setServerPredictions(null);
    setServerAlerts(null);
    if (!bundle || isOfflineActive) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await predictNextCropsApi({
          farmId: activeFarmId,
          bundle,
          currentCropId,
          harvestMonth,
          waterAvailability,
          laborAvailability,
          slopeClass,
          ownedEquipment,
          prioritizeOwnedEquipment,
          recentHistoryCropIds,
          thresholds,
        });
        if (!cancelled) {
          setServerPredictions(res.predictions);
          setServerAlerts(res.alerts);
        }
      } catch {
        if (!cancelled) {
          setServerPredictions(null);
          setServerAlerts(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bundle,
    isOfflineActive,
    activeFarmId,
    currentCropId,
    harvestMonth,
    waterAvailability,
    laborAvailability,
    slopeClass,
    ownedEquipment,
    prioritizeOwnedEquipment,
    recentHistoryCropIds,
    thresholds,
  ]);

  const predictions = serverPredictions ?? localPredictions;
  const alerts = serverAlerts ?? localAlerts;

  const currentPackKey = bundle
    ? makeLocationKey(bundle.location.lat, bundle.location.lon)
    : '';
  const isCurrentSaved = savedPacks.some((p) => p.key === currentPackKey);

  const handleSaveOffline = async () => {
    if (!bundle) return;
    const jsonSize = new Blob([JSON.stringify(bundle)]).size;
    const pack: CachedFarmPack = {
      key: makeLocationKey(bundle.location.lat, bundle.location.lon),
      locationName: bundle.location.name,
      region: bundle.location.region,
      savedAt: new Date().toISOString(),
      sizeKb: Math.max(1, Math.round(jsonSize / 1024)),
      bundle,
    };
    await saveFarmPack(pack);
    setSavedPacks(await listFarmPacks());
  };

  const handleDeletePack = async (key: string) => {
    await deleteFarmPack(key);
    setSavedPacks(await listFarmPacks());
  };

  const handleLoadPack = (pack: CachedFarmPack) => {
    handleSelectLocation(pack.bundle.location);
    setBundle(pack.bundle);
    setServedFromCache(true);
    setActiveTab('overview');
  };

  const handleUpdateThresholds = async (next: AlertThresholds) => {
    setThresholds(next);
    await updateLocalFarmCache((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      alertThresholds: next,
    }));

    if (isOfflineActive) {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'thresholds',
        payload: next,
      });
      await refreshSyncQueueCount();
      return;
    }

    setSyncState('syncing');
    try {
      const {farm} = await updateAlertThresholdsApi(activeFarmId, next);
      await saveFarmProfileCache(farm);
      setSyncState('synced');
    } catch {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'thresholds',
        payload: next,
      });
      await refreshSyncQueueCount();
    }
  };

  const recordAlertDispatch = async (log: DispatchedAlertLog) => {
    setAlertHistory((prev) => [log, ...prev].slice(0, 20));
    await appendDispatchedAlert(log);
    await updateLocalFarmCache((prev) => ({
      ...prev,
      alertHistory: [log, ...prev.alertHistory].slice(0, 30),
    }));

    if (isOfflineActive) {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'alert_history',
        payload: log,
      });
      await refreshSyncQueueCount();
      return;
    }

    try {
      const res = await appendAlertHistoryApi(activeFarmId, log);
      setAlertHistory(res.alertHistory);
    } catch {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'alert_history',
        payload: log,
      });
      await refreshSyncQueueCount();
    }
  };

  const handleRequestPush = async () => {
    const perm = await requestPushPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      const next = {...thresholds, pushEnabled: true};
      await handleUpdateThresholds(next);

      if (alerts.length > 0) {
        const first = alerts[0];
        const {log} = await dispatchCropPushNotification({
          title: `${t(lang, first.titleKey as TranslationKey)} (${first.metricValue})`,
          body: `${bundle?.location.name ?? ''} — ${t(
            lang,
            first.actionKey as TranslationKey
          )}`,
          severity: first.severity,
        });
        await recordAlertDispatch(log);
      }
    }
  };

  const handleSendTestPush = async () => {
    const sample = alerts[0];
    const title = sample
      ? `${t(lang, sample.titleKey as TranslationKey)} (${sample.metricValue})`
      : t(lang, 'alert_frost_title');
    const body = sample
      ? `${bundle?.location.name ?? ''} — ${t(lang, sample.actionKey as TranslationKey)}`
      : `${bundle?.location.name ?? 'Farm'} — ${t(lang, 'alert_frost_action')}`;

    const res = await dispatchCropPushNotification({
      title,
      body,
      severity: sample?.severity ?? 'warning',
    });
    await recordAlertDispatch(res.log);
    setTestPushFeedback(
      res.deliveredVia === 'in_app_only'
        ? 'Alert logged in-app (grant browser notification permission above for system push banners).'
        : 'Push weather alert dispatched.'
    );
    setTimeout(() => setTestPushFeedback(null), 4000);
  };

  const handleAddHarvestLog = async (entry: Omit<HarvestLogEntry, 'id'>) => {
    const full: HarvestLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const nextLogs = [full, ...harvestLogs].sort((a, b) =>
      b.harvestDate.localeCompare(a.harvestDate)
    );
    setHarvestLogs(nextLogs);
    await updateLocalFarmCache((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      harvestLogs: nextLogs,
    }));

    if (isOfflineActive) {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'log_add',
        payload: full,
      });
      await refreshSyncQueueCount();
      return;
    }

    setSyncState('syncing');
    try {
      const res = await addHarvestLogApi(activeFarmId, full);
      setHarvestLogs(res.logs);
      setSyncState('synced');
    } catch {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'log_add',
        payload: full,
      });
      await refreshSyncQueueCount();
    }
  };

  const handleDeleteHarvestLog = async (id: string) => {
    const nextLogs = harvestLogs.filter((l) => l.id !== id);
    setHarvestLogs(nextLogs);
    await updateLocalFarmCache((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      harvestLogs: nextLogs,
    }));

    if (isOfflineActive) {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'log_delete',
        payload: {logId: id},
      });
      await refreshSyncQueueCount();
      return;
    }

    setSyncState('syncing');
    try {
      const res = await deleteHarvestLogApi(activeFarmId, id);
      setHarvestLogs(res.logs);
      setSyncState('synced');
    } catch {
      await enqueueSyncMutation({
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId: activeFarmId,
        createdAt: new Date().toISOString(),
        type: 'log_delete',
        payload: {logId: id},
      });
      await refreshSyncQueueCount();
    }
  };

  const handleLogPlannedCycle = async (cropId: string) => {
    await handleAddHarvestLog({
      locationKey: bundle?.location.id ?? 'story-ia',
      locationName: bundle?.location.name ?? 'Story County, Iowa',
      cropId,
      harvestDate: new Date().toISOString().slice(0, 10),
      areaAcres,
      actualYieldTHa:
        predictions.find((p) => p.cropId === cropId)?.expectedYieldTHa ?? 4.0,
      notes: `Planned next cycle after ${currentCropId}`,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] pb-20 md:pb-10">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        lang={lang}
        alertCount={alerts.length}
        onSaveOffline={handleSaveOffline}
        isCurrentSaved={isCurrentSaved}
      />

      <WorkspaceToolbar
        bundle={bundle}
        lang={lang}
        onChangeLang={handleChangeLang}
        unit={unit}
        onChangeUnit={handleChangeUnit}
        isOfflineActive={isOfflineActive}
        simulateOffline={simulateOffline}
        onToggleSimulateOffline={() => setSimulateOffline((v) => !v)}
        servedFromCache={servedFromCache}
        isCurrentSaved={isCurrentSaved}
        onSaveOffline={handleSaveOffline}
        farms={farms}
        activeFarmId={activeFarmId}
        selectedLocation={selectedLocation}
        isPreviewingLocation={isPreviewingLocation}
        onSelectFarm={(id) => void handleSelectFarm(id)}
        onCreateFarm={handleCreateFarm}
        syncState={syncState}
        pendingSyncCount={pendingSyncCount}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <OverviewDashboard
            lang={lang}
            unit={unit}
            bundle={bundle}
            loading={loadingInsights}
            isOfflineActive={isOfflineActive}
            currentCropId={currentCropId}
            onChangeCurrentCrop={handleChangeCurrentCrop}
            harvestMonth={harvestMonth}
            onChangeHarvestMonth={handleChangeHarvestMonth}
            areaAcres={areaAcres}
            onChangeAreaAcres={handleChangeAreaAcres}
            waterAvailability={waterAvailability}
            onChangeWaterAvailability={handleChangeWater}
            laborAvailability={laborAvailability}
            onChangeLaborAvailability={handleChangeLabor}
            slopeClass={slopeClass}
            onChangeSlopeClass={handleChangeSlope}
            ownedEquipment={ownedEquipment}
            onToggleEquipment={handleToggleEquipment}
            prioritizeOwnedEquipment={prioritizeOwnedEquipment}
            onChangePrioritizeEquipment={handleChangePrioritizeEquipment}
            recentHistoryCropIds={recentHistoryCropIds}
            onSelectLocation={handleSelectLocation}
            predictions={predictions}
            alerts={alerts}
            onGoToAlerts={() => setActiveTab('alerts')}
            onGoToLog={() => setActiveTab('log')}
            onLogPlannedCycle={handleLogPlannedCycle}
          />
        )}

        {activeTab === 'climate' && (
          <ClimateAnalyticsView
            lang={lang}
            unit={unit}
            bundle={bundle}
            activeFarmId={activeFarmId}
            isOfflineActive={isOfflineActive}
            currentCropId={currentCropId}
            harvestMonth={harvestMonth}
            waterAvailability={waterAvailability}
            laborAvailability={laborAvailability}
            slopeClass={slopeClass}
            ownedEquipment={ownedEquipment}
            prioritizeOwnedEquipment={prioritizeOwnedEquipment}
            recentHistoryCropIds={recentHistoryCropIds}
            baselinePredictions={predictions}
            sensitivity={sensitivity}
            onChangeSensitivity={setSensitivity}
          />
        )}

        {activeTab === 'irrigation' && (
          <IrrigationPlannerView
            lang={lang}
            unit={unit}
            bundle={bundle}
            outlook={seasonalOutlook}
            loadingOutlook={loadingOutlook}
            isOfflineActive={isOfflineActive}
            activeFarmName={activeFarmName}
            currentCropId={currentCropId}
            harvestMonth={harvestMonth}
            areaAcres={areaAcres}
            slopeClass={slopeClass}
            irrigationPlan={irrigationPlan}
            onUpdatePlan={handleUpdateIrrigationPlan}
          />
        )}

        {activeTab === 'pest_disease' && (
          <PestDiseaseView
            lang={lang}
            unit={unit}
            bundle={bundle}
            outlook={seasonalOutlook}
            loadingOutlook={loadingOutlook}
            isOfflineActive={isOfflineActive}
            activeFarmName={activeFarmName}
            currentCropId={currentCropId}
            slopeClass={slopeClass}
            irrigationMethod={irrigationPlan.selectedMethod}
            onChangeIrrigationMethod={handleChangeIrrigationMethodFromPest}
            pestPlan={pestPlan}
            onUpdatePestPlan={handleUpdatePestPlan}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsAndOfflineView
            lang={lang}
            unit={unit}
            alerts={alerts}
            thresholds={thresholds}
            onUpdateThresholds={handleUpdateThresholds}
            pushPermission={pushPermission}
            onRequestPush={handleRequestPush}
            onSendTestPush={handleSendTestPush}
            testPushFeedback={testPushFeedback}
            alertHistory={alertHistory}
            savedPacks={savedPacks}
            onLoadPack={handleLoadPack}
            onDeletePack={handleDeletePack}
          />
        )}

        {activeTab === 'log' && (
          <FarmLogView
            lang={lang}
            unit={unit}
            bundle={bundle}
            logs={harvestLogs}
            onAddLog={handleAddHarvestLog}
            onDeleteLog={handleDeleteHarvestLog}
            onPredictFromLog={(cropId) => {
              handleChangeCurrentCrop(cropId);
              setActiveTab('overview');
            }}
          />
        )}
      </main>

      {isOfflineActive && (
        <div
          role="status"
          className="fixed bottom-16 left-4 md:bottom-4 z-40 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-950 shadow-sm"
        >
          <WifiOff className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
          <span>
            {t(lang, 'status_offline_mode')} — {t(lang, 'status_cached')}
          </span>
        </div>
      )}

      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        lang={lang}
        alertCount={alerts.length}
      />
    </div>
  );
}
