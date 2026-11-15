import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Globe,
  History,
  MapPin,
  Mountain,
  Search,
  Sprout,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {useEffect, useState} from 'react';
import {
  ALL_EQUIPMENT_IDS,
  GLOBAL_FARM_HUBS,
  makeLocationKey,
} from '../data/cropsAndLocations';
import {
  ECOCROP_BY_ID,
  ECOCROP_CATEGORY_LABEL_KEYS,
} from '../data/ecoCrop';
import {
  cropLabel,
  equipmentLabel,
  monthLabel,
  t,
  type TranslationKey,
} from '../i18n/translations';
import {
  acresToHa,
  formatAlertMetricValue,
  formatElevation,
  formatMarginPerArea,
  formatNitrogenDelta,
  haToAcres,
  tHaToTonsAc,
  type UnitSystem,
} from '../lib/units';
import type {
  CropPrediction,
  EquipmentId,
  FarmInsightBundle,
  LaborAvailability,
  LanguageCode,
  LocationOption,
  SlopeClass,
  WaterAvailability,
  WeatherAlert,
} from '../types/agronomy';
import {
  CandidateComparisonChart,
  Forecast16DayStrip,
  MonthlyClimateChart,
} from './Charts';
import {CropSelectorDropdown} from './CropSelectorDropdown';
import {EcoCropExplorer} from './EcoCropExplorer';
import {
  CircularGauge,
  getCropFallbackPhoto,
  getCropPhoto,
  ResilientPhoto,
  VISUAL_ASSETS,
} from './VisualAssets';

interface OverviewDashboardProps {
  lang: LanguageCode;
  unit: UnitSystem;
  bundle: FarmInsightBundle | null;
  loading: boolean;
  isOfflineActive: boolean;
  currentCropId: string;
  onChangeCurrentCrop: (cropId: string) => void;
  harvestMonth: number;
  onChangeHarvestMonth: (month: number) => void;
  areaAcres: number;
  onChangeAreaAcres: (acres: number) => void;
  waterAvailability: WaterAvailability;
  onChangeWaterAvailability: (val: WaterAvailability) => void;
  laborAvailability: LaborAvailability;
  onChangeLaborAvailability: (val: LaborAvailability) => void;
  slopeClass: SlopeClass;
  onChangeSlopeClass: (val: SlopeClass) => void;
  ownedEquipment: EquipmentId[];
  onToggleEquipment: (eqId: EquipmentId) => void;
  prioritizeOwnedEquipment: boolean;
  onChangePrioritizeEquipment: (val: boolean) => void;
  recentHistoryCropIds: string[];
  onSelectLocation: (loc: LocationOption) => void;
  predictions: CropPrediction[];
  alerts: WeatherAlert[];
  onGoToAlerts: () => void;
  onGoToLog: () => void;
  onLogPlannedCycle: (cropId: string) => void;
}

export function OverviewDashboard({
  lang,
  unit,
  bundle,
  loading,
  isOfflineActive,
  currentCropId,
  onChangeCurrentCrop,
  harvestMonth,
  onChangeHarvestMonth,
  areaAcres,
  onChangeAreaAcres,
  waterAvailability,
  onChangeWaterAvailability,
  laborAvailability,
  onChangeLaborAvailability,
  slopeClass,
  onChangeSlopeClass,
  ownedEquipment,
  onToggleEquipment,
  prioritizeOwnedEquipment,
  onChangePrioritizeEquipment,
  recentHistoryCropIds,
  onSelectLocation,
  predictions,
  alerts,
  onGoToAlerts,
  onGoToLog,
  onLogPlannedCycle,
}: OverviewDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inspectedCropId, setInspectedCropId] = useState<string>('');
  const [loggedToast, setLoggedToast] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showDetailedScores, setShowDetailedScores] = useState(false);
  const [showCoordEntry, setShowCoordEntry] = useState(false);
  const [coordLatInput, setCoordLatInput] = useState('35.6762');
  const [coordLonInput, setCoordLonInput] = useState('139.6503');
  const [coordError, setCoordError] = useState<string | null>(null);

  const parseCoordsInput = (
    raw: string
  ): {lat: number; lon: number} | null => {
    const cleaned = raw.trim().replace(/[°]/g, '');
    const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
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
  };

  const buildCoordLocation = (lat: number, lon: number): LocationOption => ({
    id: makeLocationKey(lat, lon),
    name: `Coordinates (${lat.toFixed(3)}, ${lon.toFixed(3)})`,
    region: `${lat >= 0 ? 'N' : 'S'} ${Math.abs(lat).toFixed(2)}°, ${
      lon >= 0 ? 'E' : 'W'
    } ${Math.abs(lon).toFixed(2)}°`,
    country: 'Global Grid',
    lat,
    lon,
    climateZone: 'Global Coordinates',
    usdaZone: '7a',
  });

  const topPrediction = predictions[0];
  const activePrediction =
    (inspectedCropId
      ? predictions.find((p) => p.cropId === inspectedCropId)
      : undefined) ?? topPrediction;

  useEffect(() => {
    setInspectedCropId('');
  }, [
    bundle?.location.id,
    currentCropId,
    harvestMonth,
    areaAcres,
    waterAvailability,
    laborAvailability,
    slopeClass,
    ownedEquipment,
    prioritizeOwnedEquipment,
    recentHistoryCropIds,
  ]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const parsedCoords = parseCoordsInput(q);
    if (parsedCoords) {
      setSearchResults([buildCoordLocation(parsedCoords.lat, parsedCoords.lon)]);
      return;
    }

    const timer = setTimeout(async () => {
      const qLower = q.toLowerCase();
      const localHits = GLOBAL_FARM_HUBS.filter(
        (h) =>
          h.name.toLowerCase().includes(qLower) ||
          h.region.toLowerCase().includes(qLower) ||
          h.country.toLowerCase().includes(qLower)
      );

      if (isOfflineActive) {
        setSearchResults(localHits);
        return;
      }

      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as {results: LocationOption[]};
          setSearchResults(data.results ?? localHits);
        } else {
          setSearchResults(localHits);
        }
      } catch {
        setSearchResults(localHits);
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [searchQuery, isOfflineActive]);

  const criticalAlert = alerts[0];

  const handleLogClick = () => {
    if (!activePrediction) return;
    onLogPlannedCycle(activePrediction.cropId);
    setLoggedToast(true);
    setTimeout(() => setLoggedToast(false), 2600);
  };

  return (
    <div className="space-y-6">
      {/* Visual Farmland Hero Banner */}
      <section className="relative overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#0F172A]">
        <ResilientPhoto
          src={VISUAL_ASSETS.heroFarmland}
          alt={bundle?.location.name ?? 'Agricultural farmland'}
          className="h-44 sm:h-52 w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#BBF7D0]">
                {bundle?.location.name ?? 'Story County, Iowa'} ·{' '}
                {bundle?.soil.textureClass ?? 'Loam'} · USDA{' '}
                {bundle?.currentSnapshot.usdaZone ?? '5a'} ·{' '}
                {bundle?.currentSnapshot.frostFreeDays ?? 165}d{' '}
                {t(lang, 'metric_growing_season')}
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance">
                {activePrediction
                  ? `${cropLabel(lang, activePrediction.cropId)} — ${
                      unit === 'imperial'
                        ? `${activePrediction.expectedYieldBuAc} bu/ac`
                        : `${activePrediction.expectedYieldTHa} t/ha`
                    }`
                  : t(lang, 'top_rec_kicker')}
              </h1>
            </div>

            {bundle && activePrediction && (
              <div className="flex items-center gap-5 text-white">
                <div className="text-right">
                  <div className="text-[11px] text-white/75">
                    {t(lang, 'metric_humidity')}
                  </div>
                  <div className="font-mono-tabular text-lg font-bold">
                    {bundle.currentSnapshot.relativeHumidityPct ?? 64}%
                  </div>
                </div>
                <div className="h-8 w-px bg-white/25" />
                <div className="text-right">
                  <div className="text-[11px] text-white/75">
                    {t(lang, 'metric_roi')}
                  </div>
                  <div className="font-mono-tabular text-lg font-bold text-[#86EFAC]">
                    {activePrediction.roiPct}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {criticalAlert && (
        <div
          role="alert"
          className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-3.5 ${
            criticalAlert.severity === 'critical'
              ? 'border-red-300 bg-red-50 text-red-950'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <AlertTriangle
              className={`h-5 w-5 shrink-0 mt-0.5 sm:mt-0 ${
                criticalAlert.severity === 'critical'
                  ? 'text-[#DC2626]'
                  : 'text-[#D97706]'
              }`}
              aria-hidden="true"
            />
            <div className="text-sm">
              <span className="font-bold">
                {t(lang, criticalAlert.titleKey as TranslationKey)}
              </span>{' '}
              <span className="font-mono-tabular font-semibold">
                ({formatAlertMetricValue(criticalAlert.metricValue, unit)})
              </span>{' '}
              <span className="text-[#334155]">
                — {t(lang, criticalAlert.actionKey as TranslationKey)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToAlerts}
            className="inline-flex min-h-[36px] items-center gap-1 text-xs font-bold underline underline-offset-4 hover:opacity-80 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t(lang, 'nav_alerts')} ({alerts.length})
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Simple Farm Inputs & Visual Satellite/Terrain/Soil Gauges */}
        <section className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              {t(lang, 'inputs_title')}
            </h2>

            {/* Location Search (Any City, Village, or Lat/Lon on Earth) */}
            <div className="relative">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="farm-location-search"
                  className="block text-xs font-semibold text-[#334155]"
                >
                  {t(lang, 'label_location')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (bundle) {
                      setCoordLatInput(bundle.location.lat.toFixed(4));
                      setCoordLonInput(bundle.location.lon.toFixed(4));
                    }
                    setCoordError(null);
                    setShowCoordEntry((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D] hover:underline cursor-pointer"
                >
                  <Globe className="h-3 w-3" aria-hidden="true" />
                  {showCoordEntry ? 'Hide Lat/Lon' : 'Enter Lat/Lon'}
                </button>
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                  aria-hidden="true"
                />
                <input
                  id="farm-location-search"
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      e.preventDefault();
                      onSelectLocation(searchResults[0]);
                      setSearchQuery('');
                      setShowDropdown(false);
                    }
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  placeholder={
                    bundle?.location.name ?? t(lang, 'placeholder_location')
                  }
                  className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] bg-white pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:border-[#15803D] focus:outline-none"
                />
              </div>

              {showCoordEntry && (
                <div className="mt-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="coord-lat"
                        className="block text-[10px] font-semibold text-[#475569]"
                      >
                        Latitude (-90..90)
                      </label>
                      <input
                        id="coord-lat"
                        type="number"
                        step="0.0001"
                        min={-90}
                        max={90}
                        value={coordLatInput}
                        onChange={(e) => setCoordLatInput(e.target.value)}
                        className="mt-0.5 w-full min-h-[36px] rounded-md border border-[#CBD5E1] bg-white px-2 font-mono-tabular text-xs text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="coord-lon"
                        className="block text-[10px] font-semibold text-[#475569]"
                      >
                        Longitude (-180..180)
                      </label>
                      <input
                        id="coord-lon"
                        type="number"
                        step="0.0001"
                        min={-180}
                        max={180}
                        value={coordLonInput}
                        onChange={(e) => setCoordLonInput(e.target.value)}
                        className="mt-0.5 w-full min-h-[36px] rounded-md border border-[#CBD5E1] bg-white px-2 font-mono-tabular text-xs text-[#0F172A]"
                      />
                    </div>
                  </div>
                  {coordError && (
                    <p className="text-[11px] font-medium text-[#DC2626]">
                      {coordError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const lat = Number(coordLatInput);
                      const lon = Number(coordLonInput);
                      if (
                        !Number.isFinite(lat) ||
                        !Number.isFinite(lon) ||
                        lat < -90 ||
                        lat > 90 ||
                        lon < -180 ||
                        lon > 180
                      ) {
                        setCoordError('Enter valid lat (-90..90) and lon (-180..180).');
                        return;
                      }
                      setCoordError(null);
                      onSelectLocation(buildCoordLocation(lat, lon));
                      setShowCoordEntry(false);
                    }}
                    className="w-full min-h-[34px] rounded-md bg-[#15803D] px-3 py-1 text-xs font-semibold text-white hover:bg-[#166534] cursor-pointer"
                  >
                    Load 10-Day Forecast for Coordinates
                  </button>
                </div>
              )}

              {showDropdown && searchResults.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#CBD5E1] bg-white py-1 shadow-lg"
                >
                  {searchResults.map((loc) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLocation(loc);
                          setSearchQuery('');
                          setShowDropdown(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-[#F0FDF4] cursor-pointer"
                      >
                        <span className="font-medium text-[#0F172A] truncate">
                          {loc.name}
                        </span>
                        <span className="ml-2 text-xs text-[#64748B] shrink-0">
                          {loc.country}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searching && (
                <p className="mt-1 text-xs text-[#64748B]">Searching...</p>
              )}
            </div>

            {/* Quick Global Region Presets */}
            <div className="flex flex-wrap gap-1.5">
              {GLOBAL_FARM_HUBS.slice(0, 6).map((hub) => {
                const isCurrent = bundle?.location.id === hub.id;
                return (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => onSelectLocation(hub)}
                    className={`min-h-[34px] rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D] font-semibold'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    {hub.name.split(',')[0]}
                  </button>
                );
              })}
            </div>

            {/* Current Crop (Grouped by EcoCrop Category) */}
            <div>
              <label
                htmlFor="current-crop-select"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {t(lang, 'label_current_crop')}
              </label>
              <CropSelectorDropdown
                id="current-crop-select"
                lang={lang}
                value={currentCropId}
                onChange={(cropId) => {
                  onChangeCurrentCrop(cropId);
                  setInspectedCropId('');
                }}
              />
            </div>

            {/* Harvest Month & Acres */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="harvest-month-select"
                  className="block text-xs font-semibold text-[#334155] mb-1.5"
                >
                  {t(lang, 'label_harvest_month')}
                </label>
                <select
                  id="harvest-month-select"
                  value={harvestMonth}
                  onChange={(e) => onChangeHarvestMonth(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-sm text-[#0F172A] focus:border-[#15803D] focus:outline-none"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i} value={i}>
                      {monthLabel(lang, i)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="field-area-input"
                  className="block text-xs font-semibold text-[#334155] mb-1.5"
                >
                  {unit === 'metric'
                    ? t(lang, 'label_field_area_ha')
                    : t(lang, 'label_field_area')}
                </label>
                <input
                  id="field-area-input"
                  type="number"
                  min={1}
                  max={50000}
                  value={
                    unit === 'metric'
                      ? Math.max(1, Math.round(acresToHa(areaAcres)))
                      : Math.round(areaAcres)
                  }
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 1);
                    onChangeAreaAcres(
                      unit === 'metric' ? Math.max(1, Math.round(haToAcres(val))) : val
                    );
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] bg-white px-3 font-mono-tabular text-sm text-[#0F172A] focus:border-[#15803D] focus:outline-none"
                />
              </div>
            </div>

            {/* Water Availability for Irrigation */}
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#334155] mb-2">
                <Droplets className="h-3.5 w-3.5 text-[#0284C7]" aria-hidden="true" />
                <span>{t(lang, 'label_water_availability')}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                {(
                  [
                    ['rainfed', 'water_rainfed'],
                    ['limited', 'water_limited'],
                    ['full', 'water_full'],
                  ] as Array<[WaterAvailability, TranslationKey]>
                ).map(([val, key]) => {
                  const active = waterAvailability === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChangeWaterAvailability(val)}
                      className={`min-h-[36px] rounded-md px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#15803D] text-white'
                          : 'text-[#475569] hover:text-[#0F172A]'
                      }`}
                    >
                      {t(lang, key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Farmer Labor Availability Input */}
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#334155] mb-2">
                <Users className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                <span>{t(lang, 'label_labor_availability')}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                {(
                  [
                    ['low', 'labor_low'],
                    ['moderate', 'labor_moderate'],
                    ['high', 'labor_high'],
                  ] as Array<[LaborAvailability, TranslationKey]>
                ).map(([val, key]) => {
                  const active = laborAvailability === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChangeLaborAvailability(val)}
                      className={`min-h-[36px] rounded-md px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#15803D] text-white'
                          : 'text-[#475569] hover:text-[#0F172A]'
                      }`}
                    >
                      {t(lang, key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Land Slope */}
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#334155] mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Mountain className="h-3.5 w-3.5 text-[#92400E]" aria-hidden="true" />
                  {t(lang, 'label_land_slope')}
                </span>
                {bundle && (
                  <span className="font-mono-tabular text-[11px] font-medium text-[#64748B]">
                    DEM {bundle.currentSnapshot.slopePct}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                {(
                  [
                    ['flat', 'slope_flat'],
                    ['gentle', 'slope_gentle'],
                    ['steep', 'slope_steep'],
                  ] as Array<[SlopeClass, TranslationKey]>
                ).map(([val, key]) => {
                  const active = slopeClass === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChangeSlopeClass(val)}
                      className={`min-h-[36px] rounded-md px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0F172A] text-white'
                          : 'text-[#475569] hover:text-[#0F172A]'
                      }`}
                    >
                      {t(lang, key)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Equipment Inventory Trigger */}
            <div className="border-t border-[#E2E8F0] pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]">
                    <Wrench className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                    {t(lang, 'label_equipment_inventory')}
                  </div>
                  <div className="mt-0.5 font-mono-tabular text-xs text-[#64748B]">
                    {ownedEquipment.length}/{ALL_EQUIPMENT_IDS.length}{' '}
                    {t(lang, 'equipment_owned_tag')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(true)}
                  className="min-h-[38px] rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  Edit
                </button>
              </div>

              <label className="mt-3 flex min-h-[36px] items-center gap-2 text-xs font-medium text-[#15803D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={prioritizeOwnedEquipment}
                  onChange={(e) => onChangePrioritizeEquipment(e.target.checked)}
                  className="h-4 w-4 accent-[#15803D]"
                />
                <span>{t(lang, 'label_prioritize_equipment')}</span>
              </label>
            </div>
          </div>

          {/* Visual Satellite, Terrain & Soil Snapshot with Circular Gauges */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-base font-bold text-[#0F172A]">
                {t(lang, 'snapshot_title')}
              </h2>
              <span className="font-mono-tabular text-xs text-[#64748B]">
                NASA + DEM + SoilGrids
              </span>
            </div>

            {loading || !bundle ? (
              <div className="grid grid-cols-2 gap-4 animate-pulse">
                <div className="h-28 rounded-lg bg-[#F1F5F9]" />
                <div className="h-28 rounded-lg bg-[#F1F5F9]" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 pb-4 border-b border-[#E2E8F0]">
                  <CircularGauge
                    value={bundle.currentSnapshot.rootWetnessPct ?? 50}
                    max={100}
                    displayValue={`${bundle.currentSnapshot.rootWetnessPct ?? 50}%`}
                    label={t(lang, 'metric_root_moisture')}
                    size={76}
                    color="#0284C7"
                  />
                  <CircularGauge
                    value={bundle.currentSnapshot.relativeHumidityPct ?? 64}
                    max={100}
                    displayValue={`${bundle.currentSnapshot.relativeHumidityPct ?? 64}%`}
                    label={t(lang, 'metric_humidity')}
                    size={76}
                    color="#0EA5E9"
                  />
                  <CircularGauge
                    value={bundle.soil.ph ?? 6.5}
                    max={14}
                    displayValue={(bundle.soil.ph ?? 6.5).toFixed(1)}
                    label={t(lang, 'metric_soil_ph')}
                    size={76}
                    color="#15803D"
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <dt className="text-[#64748B]">{t(lang, 'metric_growing_season')}</dt>
                    <dd className="mt-0.5 font-mono-tabular text-sm font-bold text-[#0F172A]">
                      {bundle.currentSnapshot.frostFreeDays ?? 165} d
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">{t(lang, 'metric_slope')}</dt>
                    <dd className="mt-0.5 font-mono-tabular text-sm font-bold text-[#0F172A]">
                      {bundle.currentSnapshot.slopePct ?? 1.2}% (
                      {formatElevation(bundle.currentSnapshot.elevationM ?? 220, unit)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">{t(lang, 'metric_organic_carbon')}</dt>
                    <dd className="mt-0.5 font-mono-tabular text-sm font-bold text-[#0F172A]">
                      {bundle.soil.socGKg ?? 15} g/kg
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">{t(lang, 'metric_soil_nitrogen')}</dt>
                    <dd className="mt-0.5 font-mono-tabular text-sm font-bold text-[#0284C7]">
                      {(bundle.soil.nitrogenGKg ?? 1.4).toFixed(2)} g/kg
                    </dd>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border-t border-[#F1F5F9] pt-2">
                    <dt className="text-[#64748B]">{t(lang, 'metric_soil_texture')}</dt>
                    <dd className="font-semibold text-[#0F172A]">
                      {bundle.soil.textureClass}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </div>
        </section>

        {/* Right Column: Visual Crop Recommendation Hero & Charts */}
        <section className="lg:col-span-8 space-y-6">
          <div
            id="hero-recommendation-card"
            className="rounded-xl border border-[#E2E8F0] bg-white p-6"
          >
            {loading || !activePrediction ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 w-48 rounded bg-[#F1F5F9]" />
                <div className="h-36 rounded-lg bg-[#F1F5F9]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                {/* Visual Crop Card + Key Metrics */}
                <div className="xl:col-span-7 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-4">
                      <ResilientPhoto
                        src={getCropPhoto(activePrediction.cropId)}
                        fallbackSrc={getCropFallbackPhoto(activePrediction.cropId)}
                        alt={cropLabel(lang, activePrediction.cropId)}
                        className="h-24 w-32 shrink-0 rounded-lg border border-[#E2E8F0]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                          <Sprout className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{t(lang, 'top_rec_kicker')}</span>
                          {ECOCROP_BY_ID[activePrediction.cropId] && (
                            <span className="font-normal text-[#64748B]">
                              ·{' '}
                              {t(
                                lang,
                                ECOCROP_CATEGORY_LABEL_KEYS[
                                  ECOCROP_BY_ID[activePrediction.cropId].CAT
                                ] as TranslationKey
                              )}
                            </span>
                          )}
                          {topPrediction &&
                            activePrediction.cropId !== topPrediction.cropId && (
                              <button
                                type="button"
                                onClick={() => setInspectedCropId('')}
                                className="ml-1 font-semibold text-[#0284C7] hover:underline cursor-pointer"
                              >
                                · Reset to #1 ({cropLabel(lang, topPrediction.cropId)})
                              </button>
                            )}
                        </div>
                        <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
                          {cropLabel(lang, activePrediction.cropId)}
                        </h2>
                        {ECOCROP_BY_ID[activePrediction.cropId] && (
                          <p className="mt-0.5 text-xs italic text-[#64748B]">
                            {ECOCROP_BY_ID[activePrediction.cropId].ScientificName}
                            {bundle?.location.regionalZoneLabel
                              ? ` · ${bundle.location.regionalZoneLabel}`
                              : ''}
                          </p>
                        )}
                        <p className="mt-1 text-xs font-medium text-[#475569]">
                          {activePrediction.isTraditionalRegional
                            ? t(lang, 'regional_fit_traditional')
                            : t(lang, 'regional_fit_emerging')}{' '}
                          {bundle?.location.regionalSource === 'usda_cropscape'
                            ? '(USDA CropScape)'
                            : ''}{' '}
                          ·{' '}
                          <span
                            className={
                              activePrediction.yieldGainVsMonoPct >= 0
                                ? 'font-bold text-[#15803D]'
                                : 'font-bold text-[#DC2626]'
                            }
                          >
                            {activePrediction.yieldGainVsMonoPct >= 0
                              ? `+${activePrediction.yieldGainVsMonoPct}%`
                              : `${activePrediction.yieldGainVsMonoPct}%`}{' '}
                            {t(lang, 'vs_monocrop')}
                          </span>
                        </p>
                      </div>

                      <div className="hidden sm:block shrink-0">
                        <CircularGauge
                          value={activePrediction.score}
                          max={100}
                          displayValue={`${activePrediction.score}`}
                          label={t(lang, 'score_label')}
                          size={76}
                          color="#15803D"
                        />
                      </div>
                    </div>

                    {/* Visual KPI Strip covering Yield, ROI, Growing Season, Hardiness, Labor & Slope */}
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 border-y border-[#E2E8F0] py-4">
                      <div>
                        <div className="text-xs text-[#475569]">
                          {t(lang, 'expected_yield')}
                        </div>
                        <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#0F172A]">
                          {unit === 'imperial'
                            ? `${activePrediction.expectedYieldBuAc} bu/ac`
                            : `${activePrediction.expectedYieldTHa} t/ha`}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#64748B]">
                          {unit === 'imperial'
                            ? `${tHaToTonsAc(activePrediction.expectedYieldTHa).toFixed(2)} tons/ac`
                            : `${activePrediction.expectedYieldBuAc} bu/ac`}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[#475569]">
                          {t(lang, 'est_net_margin')}
                        </div>
                        <div
                          className={`mt-0.5 font-mono-tabular text-lg font-bold ${
                            activePrediction.estNetMarginUsdHa >= 0
                              ? 'text-[#15803D]'
                              : 'text-[#DC2626]'
                          }`}
                        >
                          {formatMarginPerArea(activePrediction.estNetMarginUsdHa, unit)}
                        </div>
                        <div className="font-mono-tabular text-[11px] font-semibold text-[#475569]">
                          {t(lang, 'metric_roi')} {activePrediction.roiPct}% ·{' '}
                          {t(
                            lang,
                            `viability_${activePrediction.economicViability}` as TranslationKey
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[#475569]">
                          {t(lang, 'metric_season_length')}
                        </div>
                        <div className="mt-0.5 font-mono-tabular text-lg font-bold text-[#0F172A]">
                          {activePrediction.growingDays} d
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          {bundle?.currentSnapshot.frostFreeDays ?? 165}d{' '}
                          {t(lang, 'metric_growing_season')}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[#475569]">
                          {t(lang, 'metric_hardiness')}
                        </div>
                        <div className="mt-0.5 text-sm font-bold text-[#0F172A]">
                          {t(
                            lang,
                            `hardiness_${activePrediction.hardinessLevel}` as TranslationKey
                          )}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#64748B]">
                          USDA {bundle?.currentSnapshot.usdaZone ?? '5a'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[#475569]">
                          {t(lang, 'metric_labor_fit')}
                        </div>
                        <div
                          className={`mt-0.5 text-sm font-bold ${
                            activePrediction.laborFits
                              ? 'text-[#15803D]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          {activePrediction.laborFits
                            ? t(lang, 'labor_fits_ok')
                            : t(lang, 'labor_stretch')}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#64748B]">
                          {unit === 'imperial'
                            ? `${(activePrediction.laborHoursPerHa * 0.404686).toFixed(1)} h/ac`
                            : `${activePrediction.laborHoursPerHa} h/ha`}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[#475569]">
                          {t(lang, 'metric_slope_fit')}
                        </div>
                        <div
                          className={`mt-0.5 text-sm font-bold ${
                            activePrediction.slopeSuitable
                              ? 'text-[#15803D]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          {activePrediction.slopeSuitable
                            ? t(lang, 'slope_safe')
                            : t(lang, 'slope_risk')}
                        </div>
                        <div className="font-mono-tabular text-[11px] text-[#64748B]">
                          N {formatNitrogenDelta(activePrediction.nitrogenDeltaKgHa, unit)} ·{' '}
                          {activePrediction.waterMatchPct}% H₂O
                        </div>
                      </div>
                    </div>

                    {/* Compact Field History Strip */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3 text-xs">
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <History className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                        <span className="font-semibold">
                          {t(lang, 'field_history_label')}:
                        </span>
                        <span>
                          {recentHistoryCropIds.length > 0
                            ? recentHistoryCropIds
                                .map((id) => cropLabel(lang, id))
                                .join(' → ')
                            : t(lang, 'field_history_empty')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={onGoToLog}
                        className="font-semibold text-[#15803D] hover:underline cursor-pointer"
                      >
                        {t(lang, 'nav_log')} →
                      </button>
                    </div>

                    {/* Concise Equipment Readiness List */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                          {t(lang, 'equipment_needed_title')}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            activePrediction.missingEquipment.length === 0
                              ? 'text-[#15803D]'
                              : 'text-[#B45309]'
                          }`}
                        >
                          {activePrediction.missingEquipment.length === 0
                            ? t(lang, 'equipment_ready_label')
                            : t(lang, 'equipment_missing_label')}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {activePrediction.requiredEquipment.map((eqId) => {
                          const isOwned = ownedEquipment.includes(eqId);
                          return (
                            <div
                              key={eqId}
                              className="flex items-center justify-between gap-2 py-1 border-b border-[#F1F5F9]"
                            >
                              <span className="flex items-center gap-1.5 text-[#0F172A] font-medium truncate">
                                {isOwned ? (
                                  <CheckCircle2
                                    className="h-3.5 w-3.5 text-[#15803D] shrink-0"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Wrench
                                    className="h-3.5 w-3.5 text-[#D97706] shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="truncate">
                                  {equipmentLabel(lang, eqId)}
                                </span>
                              </span>
                              <span
                                className={`font-semibold shrink-0 ${
                                  isOwned ? 'text-[#15803D]' : 'text-[#B45309]'
                                }`}
                              >
                                {isOwned
                                  ? t(lang, 'equipment_owned_tag')
                                  : t(lang, 'equipment_missing_tag')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top Concise Insights + Expandable 7-Factor Breakdown */}
                    <ul className="mt-4 space-y-1.5 text-sm text-[#334155]">
                      {activePrediction.reasonKeys.slice(0, 3).map((rk) => (
                        <li key={rk} className="flex items-start gap-2">
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-[#15803D] mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{t(lang, rk as TranslationKey)}</span>
                        </li>
                      ))}
                    </ul>

                    {showDetailedScores && (
                      <div className="mt-4 grid grid-cols-3 sm:grid-cols-7 gap-2 border-t border-[#E2E8F0] pt-3 text-xs">
                        {[
                          ['factor_rotation', activePrediction.breakdown.rotationSynergy],
                          ['factor_moisture', activePrediction.breakdown.moistureFit],
                          ['factor_thermal', activePrediction.breakdown.thermalSolarFit],
                          ['factor_soil', activePrediction.breakdown.soilSuitability],
                          ['factor_stability', activePrediction.breakdown.climateStability],
                          ['factor_economics', activePrediction.breakdown.regionalEconomics],
                          ['factor_labor_slope', activePrediction.breakdown.laborAndSlopeFit],
                        ].map(([labelKey, score]) => (
                          <div key={String(labelKey)}>
                            <div className="text-[#475569] truncate">
                              {t(lang, labelKey as TranslationKey)}
                            </div>
                            <div className="mt-0.5 font-mono-tabular font-bold text-[#0F172A]">
                              {score}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleLogClick}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#15803D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] cursor-pointer"
                    >
                      <Droplets className="h-4 w-4" aria-hidden="true" />
                      {t(lang, 'log_this_plan')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowDetailedScores((v) => !v)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-white cursor-pointer"
                    >
                      {showDetailedScores ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                      {t(lang, 'score_label')}
                    </button>

                    {loggedToast && (
                      <span className="text-sm font-semibold text-[#15803D]">
                        Saved to Farm Log
                      </span>
                    )}
                  </div>
                </div>

                {/* Candidate Crop Comparison with Thumbnails */}
                <div className="xl:col-span-5 xl:border-l xl:border-[#E2E8F0] xl:pl-6">
                  <h3 className="font-display text-sm font-bold text-[#0F172A] mb-3">
                    {t(lang, 'candidate_chart_title')}
                  </h3>
                  <CandidateComparisonChart
                    predictions={predictions}
                    lang={lang}
                    unit={unit}
                    selectedCropId={activePrediction.cropId}
                    onSelectCandidate={(id) => setInspectedCropId(id)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 10-Day Open-Meteo Global Weather Forecast */}
          {bundle && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="font-display text-base font-bold text-[#0F172A]">
                    {t(lang, 'weather_10d_title')}
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    {bundle.location.name} ·{' '}
                    <span className="font-mono-tabular">
                      {bundle.location.lat.toFixed(3)}°,{' '}
                      {bundle.location.lon.toFixed(3)}°
                    </span>
                  </p>
                </div>
                <span
                  className={`font-mono-tabular text-xs font-semibold ${
                    bundle.dataSources.forecast === 'live'
                      ? 'text-[#15803D]'
                      : 'text-[#B45309]'
                  }`}
                >
                  {bundle.dataSources.forecast === 'live'
                    ? 'Open-Meteo Live · 10-Day'
                    : 'Regional Benchmark · 10-Day'}
                </span>
              </div>
              <Forecast16DayStrip
                forecast={bundle.forecast16d}
                currentWeather={bundle.currentWeather}
                unit={unit}
              />
            </div>
          )}

          {/* 12-Month Climate & Precipitation Chart */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
            <h2 className="font-display text-base font-bold text-[#0F172A] mb-3">
              {t(lang, 'monthly_chart_title')}
            </h2>
            {loading || !bundle ? (
              <div className="h-52 rounded-lg bg-[#F1F5F9] animate-pulse" />
            ) : (
              <MonthlyClimateChart
                data={bundle.monthlyClimate}
                lang={lang}
                unit={unit}
              />
            )}
          </div>
        </section>
      </div>

      {/* Full 80+ Species FAO EcoCrop Compatibility & Future Rotation Explorer */}
      {bundle && predictions.length > 0 && (
        <EcoCropExplorer
          lang={lang}
          unit={unit}
          bundle={bundle}
          predictions={predictions}
          selectedCropId={activePrediction?.cropId ?? ''}
          onSelectCrop={(cropId) => {
            setInspectedCropId(cropId);
            document
              .getElementById('hero-recommendation-card')
              ?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
          }}
        />
      )}

      {/* Visual Equipment Inventory Modal */}
      {showEquipmentModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#E2E8F0] bg-white p-6">
            <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3">
              <h2 className="font-display text-lg font-bold text-[#0F172A]">
                {t(lang, 'label_equipment_inventory')}
              </h2>
              <button
                type="button"
                onClick={() => setShowEquipmentModal(false)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F1F5F9] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_EQUIPMENT_IDS.map((eqId) => {
                const checked = ownedEquipment.includes(eqId);
                return (
                  <button
                    key={eqId}
                    type="button"
                    onClick={() => onToggleEquipment(eqId)}
                    className={`flex min-h-[48px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                      checked
                        ? 'border-[#15803D] bg-[#F0FDF4] text-[#0F172A]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]'
                    }`}
                  >
                    <span>{equipmentLabel(lang, eqId)}</span>
                    {checked && (
                      <CheckCircle2
                        className="h-4 w-4 text-[#15803D] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEquipmentModal(false)}
                className="min-h-[44px] rounded-lg bg-[#15803D] px-5 py-2 text-sm font-semibold text-white hover:bg-[#166534] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
