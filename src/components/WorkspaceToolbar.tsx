import {
  BookmarkCheck,
  BookmarkPlus,
  Globe,
  Plus,
  RefreshCw,
  WifiOff,
  X,
} from 'lucide-react';
import {useState} from 'react';
import {t} from '../i18n/translations';
import type {
  FarmInsightBundle,
  FarmProfileSummary,
  LanguageCode,
} from '../types/agronomy';

interface WorkspaceToolbarProps {
  bundle: FarmInsightBundle | null;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  isOfflineActive: boolean;
  simulateOffline: boolean;
  onToggleSimulateOffline: () => void;
  servedFromCache: boolean;
  isCurrentSaved: boolean;
  onSaveOffline: () => void;
  farms: FarmProfileSummary[];
  activeFarmId: string;
  onSelectFarm: (farmId: string) => void;
  onCreateFarm: (name: string) => Promise<void>;
  syncState: 'synced' | 'syncing' | 'pending';
  pendingSyncCount: number;
}

const LANGS: LanguageCode[] = ['en', 'es', 'hi', 'fr', 'pt'];

export function WorkspaceToolbar({
  bundle,
  lang,
  onChangeLang,
  isOfflineActive,
  simulateOffline,
  onToggleSimulateOffline,
  servedFromCache,
  isCurrentSaved,
  onSaveOffline,
  farms,
  activeFarmId,
  onSelectFarm,
  onCreateFarm,
  syncState,
  pendingSyncCount,
}: WorkspaceToolbarProps) {
  const [creatingFarm, setCreatingFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provenanceLabel =
    isOfflineActive || servedFromCache
      ? t(lang, 'status_cached')
      : bundle?.dataSources.nasaPower === 'live'
      ? t(lang, 'status_live')
      : t(lang, 'status_benchmark');

  const syncLabel =
    syncState === 'syncing'
      ? t(lang, 'sync_syncing')
      : syncState === 'pending' || pendingSyncCount > 0
      ? `${t(lang, 'sync_pending')} (${pendingSyncCount})`
      : t(lang, 'sync_synced');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFarmName.trim();
    if (trimmed.length < 2) {
      setCreateError('Enter at least 2 characters');
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      await onCreateFarm(trimmed);
      setNewFarmName('');
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
              value={activeFarmId}
              onChange={(e) => onSelectFarm(e.target.value)}
              className="min-h-[34px] rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-[#0F172A] focus:border-[#15803D] focus:outline-none cursor-pointer"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={isOfflineActive}
              onClick={() => {
                setCreatingFarm((v) => !v);
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
              <span className="font-mono-tabular text-xs">
                {bundle.location.lat.toFixed(2)}°, {bundle.location.lon.toFixed(2)}°
              </span>
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
              <span aria-hidden="true">·</span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  syncState === 'pending' || pendingSyncCount > 0
                    ? 'text-[#B45309]'
                    : 'text-[#475569]'
                }`}
              >
                {syncState === 'syncing' && (
                  <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                )}
                {syncLabel}
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
              className="min-h-[38px] w-full sm:w-72 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs text-[#0F172A] focus:border-[#15803D] focus:outline-none"
            />
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
