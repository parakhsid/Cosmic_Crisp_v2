import {
  BookmarkCheck,
  BookmarkPlus,
  Globe,
  MapPin,
  Plus,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import {useEffect, useState} from 'react';
import {GLOBAL_FARM_HUBS} from '../data/cropsAndLocations';
import {t} from '../i18n/translations';
import type {
  FarmInsightBundle,
  FarmProfileSummary,
  LanguageCode,
  LocationOption,
  UnitSystem,
} from '../types/agronomy';

interface WorkspaceToolbarProps {
  bundle: FarmInsightBundle | null;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  unit: UnitSystem;
  onChangeUnit: (unit: UnitSystem) => void;
  isOfflineActive: boolean;
  simulateOffline: boolean;
  onToggleSimulateOffline: () => void;
  servedFromCache: boolean;
  isCurrentSaved: boolean;
  onSaveOffline: () => void;
  farms: FarmProfileSummary[];
  activeFarmId: string;
  selectedLocation: LocationOption;
  isPreviewingLocation: boolean;
  onSelectFarm: (farmId: string) => void;
  onCreateFarm: (name: string, location: LocationOption) => Promise<void>;
  syncState: 'synced' | 'syncing' | 'pending';
  pendingSyncCount: number;
}

const LANGS: LanguageCode[] = ['en', 'es', 'hi', 'fr', 'pt'];

export function WorkspaceToolbar({
  bundle,
  lang,
  onChangeLang,
  unit,
  onChangeUnit,
  isOfflineActive,
  simulateOffline,
  onToggleSimulateOffline,
  servedFromCache,
  isCurrentSaved,
  onSaveOffline,
  farms,
  activeFarmId,
  selectedLocation,
  isPreviewingLocation,
  onSelectFarm,
  onCreateFarm,
  syncState: _syncState,
  pendingSyncCount: _pendingSyncCount,
}: WorkspaceToolbarProps) {
  const [creatingFarm, setCreatingFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmLocation, setNewFarmLocation] =
    useState<LocationOption>(selectedLocation);
  const [newFarmLocQuery, setNewFarmLocQuery] = useState('');
  const [newFarmLocResults, setNewFarmLocResults] = useState<LocationOption[]>(
    []
  );
  const [showNewFarmLocDropdown, setShowNewFarmLocDropdown] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!creatingFarm) return;
    const q = newFarmLocQuery.trim();
    if (q.length < 2) {
      setNewFarmLocResults([]);
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
        setNewFarmLocResults(localHits);
        return;
      }
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as {results: LocationOption[]};
          setNewFarmLocResults(data.results?.length ? data.results : localHits);
        } else {
          setNewFarmLocResults(localHits);
        }
      } catch {
        setNewFarmLocResults(localHits);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [creatingFarm, newFarmLocQuery, isOfflineActive]);

  const provenanceLabel =
    isOfflineActive || servedFromCache
      ? t(lang, 'status_cached')
      : bundle?.dataSources.nasaPower === 'live'
      ? t(lang, 'status_live')
      : t(lang, 'status_benchmark');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFarmName.trim();
    if (trimmed.length < 2) {
      setCreateError('Enter at least 2 characters for farm name');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      await onCreateFarm(trimmed, newFarmLocation);
      setNewFarmName('');
      setNewFarmLocQuery('');
      setShowNewFarmLocDropdown(false);
      setCreatingFarm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create farm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Left: Farm Profile Switcher + Unboxed Location & DB Sync Metadata */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs sm:text-sm text-[#475569]">
          <div className="flex items-center gap-1.5">
            <label htmlFor="farm-profile-select" className="sr-only">
              {t(lang, 'farm_profile_label')}
            </label>
            <select
              id="farm-profile-select"
              value={isPreviewingLocation ? '__preview__' : activeFarmId}
              onChange={(e) => {
                if (e.target.value !== '__preview__') {
                  onSelectFarm(e.target.value);
                }
              }}
              className="min-h-[34px] rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-[#0F172A] focus:border-[#15803D] focus:outline-none cursor-pointer"
            >
              {isPreviewingLocation && (
                <option value="__preview__">
                  Exploring · {selectedLocation.name} (Unsaved)
                </option>
              )}
              {(farms.some((f) => f.id === activeFarmId)
                ? farms
                : [
                    ...farms,
                    {
                      id: activeFarmId,
                      name: bundle?.location.name ?? activeFarmId,
                      locationName: bundle?.location.name ?? '',
                      updatedAt: '',
                    },
                  ]
              ).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={isOfflineActive}
              onClick={() => {
                setCreatingFarm((v) => {
                  const next = !v;
                  if (next) {
                    setNewFarmLocation(selectedLocation);
                    setNewFarmLocQuery('');
                    setShowNewFarmLocDropdown(false);
                    if (isPreviewingLocation && !newFarmName.trim()) {
                      setNewFarmName(selectedLocation.name);
                    }
                  }
                  return next;
                });
                setCreateError(null);
              }}
              title={t(lang, 'new_farm_btn')}
              aria-label={t(lang, 'new_farm_btn')}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
              <span className="hidden sm:inline">{t(lang, 'new_farm_btn')}</span>
            </button>
          </div>

          {bundle && (
            <>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isOfflineActive
                    ? 'font-semibold text-[#D97706]'
                    : 'font-medium text-[#15803D]'
                }
              >
                {provenanceLabel}
              </span>
            </>
          )}
        </div>

        {/* Right: Field offline test toggle, save offline button, and 5-language switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSaveOffline}
            className="hidden sm:inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isCurrentSaved ? (
              <BookmarkCheck
                className="h-3.5 w-3.5 text-[#15803D]"
                aria-hidden="true"
              />
            ) : (
              <BookmarkPlus
                className="h-3.5 w-3.5 text-[#475569]"
                aria-hidden="true"
              />
            )}
            {isCurrentSaved
              ? t(lang, 'btn_saved_offline')
              : t(lang, 'btn_save_offline')}
          </button>

          <button
            type="button"
            onClick={onToggleSimulateOffline}
            aria-pressed={simulateOffline}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              simulateOffline || isOfflineActive
                ? 'border-amber-300 bg-amber-50 text-[#B45309]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            {t(lang, 'simulate_offline')}
          </button>

          <div
            role="group"
            aria-label="Unit System"
            className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5"
          >
            {(['imperial', 'metric'] as UnitSystem[]).map((sys) => {
              const active = unit === sys;
              return (
                <button
                  key={sys}
                  type="button"
                  onClick={() => onChangeUnit(sys)}
                  className={`min-h-[30px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0F172A] text-white'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {sys === 'metric' ? t(lang, 'unit_metric') : t(lang, 'unit_imperial')}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label={t(lang, 'language_label')}
            className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5"
          >
            <Globe
              className="mx-1.5 h-3.5 w-3.5 text-[#64748B] shrink-0"
              aria-hidden="true"
            />
            {LANGS.map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => onChangeLang(code)}
                  className={`min-h-[30px] rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#15803D] text-white'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inline New Farm Profile Creation Bar */}
      {creatingFarm && (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <form
            onSubmit={handleCreateSubmit}
            className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8"
          >
            <input
              type="text"
              value={newFarmName}
              onChange={(e) => setNewFarmName(e.target.value)}
              placeholder={t(lang, 'new_farm_placeholder')}
              autoFocus
              className="min-h-[38px] w-full sm:w-60 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#15803D] focus:outline-none"
            />

            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={newFarmLocQuery}
                onFocus={() => setShowNewFarmLocDropdown(true)}
                onChange={(e) => {
                  setNewFarmLocQuery(e.target.value);
                  setShowNewFarmLocDropdown(true);
                }}
                placeholder={`Location: ${newFarmLocation.name}`}
                aria-label="New farm location search"
                className="min-h-[38px] w-full rounded-lg border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs text-[#0F172A] placeholder:text-[#475569] focus:border-[#15803D] focus:outline-none"
              />
              {showNewFarmLocDropdown && newFarmLocResults.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-auto rounded-lg border border-[#CBD5E1] bg-white py-1 shadow-lg"
                >
                  {newFarmLocResults.map((loc) => (
                    <li key={loc.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setNewFarmLocation(loc);
                          setNewFarmLocQuery('');
                          setShowNewFarmLocDropdown(false);
                          if (!newFarmName.trim()) {
                            setNewFarmName(loc.name);
                          }
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#F0FDF4] cursor-pointer"
                      >
                        <span className="font-medium text-[#0F172A] truncate">
                          {loc.name}
                        </span>
                        <span className="ml-2 text-[11px] text-[#64748B] shrink-0">
                          {loc.country}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#15803D]">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{newFarmLocation.name}</span>
            </span>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[38px] rounded-lg bg-[#15803D] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60 cursor-pointer"
            >
              {t(lang, 'create_farm_btn')}
            </button>
            <button
              type="button"
              onClick={() => setCreatingFarm(false)}
              aria-label="Close"
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:text-[#0F172A] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            {createError && (
              <span className="text-xs font-semibold text-[#DC2626]">
                {createError}
              </span>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
