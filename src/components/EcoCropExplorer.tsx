import {ArrowUpDown, ChevronDown, ChevronUp, Search, X} from 'lucide-react';
import {useMemo, useState} from 'react';
import {
  ECOCROP_BY_ID,
  ECOCROP_CATEGORY_LABEL_KEYS,
  ECOCROP_CATEGORY_ORDER,
  type EcoCropCategory,
} from '../data/ecoCrop';
import {cropLabel, t} from '../i18n/translations';
import {
  convertTemp,
  formatMarginPerArea,
  formatNitrogenDelta,
  tempUnitLabel,
  type UnitSystem,
} from '../lib/units';
import type {
  CropPrediction,
  FarmInsightBundle,
  LanguageCode,
} from '../types/agronomy';
import {EcoCategoryIcon} from './CropSelectorDropdown';
import {
  getCropFallbackPhoto,
  getCropPhoto,
  ResilientPhoto,
} from './VisualAssets';

interface EcoCropExplorerProps {
  lang: LanguageCode;
  unit: UnitSystem;
  bundle: FarmInsightBundle;
  predictions: CropPrediction[];
  selectedCropId: string;
  onSelectCrop: (cropId: string) => void;
}

type CompatibilityFilter = 'all' | 'high_fit' | 'regional' | 'nitrogen';
type SortOption = 'score' | 'margin' | 'cycle' | 'nitrogen';

export function EcoCropExplorer({
  lang,
  unit,
  bundle,
  predictions,
  selectedCropId,
  onSelectCrop,
}: EcoCropExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | EcoCropCategory>(
    'all'
  );
  const [compatFilter, setCompatFilter] = useState<CompatibilityFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [showAllRows, setShowAllRows] = useState(false);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {all: predictions.length};
    for (const cat of ECOCROP_CATEGORY_ORDER) counts[cat] = 0;
    for (const p of predictions) {
      const rec = ECOCROP_BY_ID[p.cropId];
      if (rec) counts[rec.CAT] = (counts[rec.CAT] ?? 0) + 1;
    }
    return counts;
  }, [predictions]);

  const filteredPredictions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = predictions.filter((p) => {
      const rec = ECOCROP_BY_ID[p.cropId];
      if (!rec) return false;
      if (selectedCategory !== 'all' && rec.CAT !== selectedCategory) {
        return false;
      }
      if (compatFilter === 'high_fit' && p.score < 70) return false;
      if (compatFilter === 'regional' && !p.isTraditionalRegional) return false;
      if (compatFilter === 'nitrogen' && p.nitrogenDeltaKgHa <= 0) return false;

      if (q) {
        const label = cropLabel(lang, p.cropId).toLowerCase();
        const hay = `${label} ${rec.CommonName} ${rec.ScientificName} ${rec.CAT} ${rec.family}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'margin') return b.estNetMarginUsdHa - a.estNetMarginUsdHa;
      if (sortBy === 'cycle') return a.growingDays - b.growingDays;
      if (sortBy === 'nitrogen') return b.nitrogenDeltaKgHa - a.nitrogenDeltaKgHa;
      return b.score - a.score;
    });
    return sorted;
  }, [
    predictions,
    searchQuery,
    selectedCategory,
    compatFilter,
    sortBy,
    lang,
  ]);

  const isFiltered =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'all' ||
    compatFilter !== 'all';
  const visibleRows =
    showAllRows || isFiltered
      ? filteredPredictions
      : filteredPredictions.slice(0, 18);

  const regionalProvenance =
    bundle.location.regionalSource === 'usda_cropscape'
      ? 'USDA CropScape + EcoCrop'
      : 'Regional Agro-Biome + EcoCrop';

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-medium text-[#64748B]">
            <span>{regionalProvenance}</span>
            {bundle.location.regionalZoneLabel && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-[#15803D] font-semibold">
                  {bundle.location.regionalZoneLabel}
                </span>
              </>
            )}
          </div>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-[#0F172A]">
            {t(lang, 'explorer_title')}
          </h2>
          <p className="mt-0.5 text-xs text-[#475569]">
            {t(lang, 'explorer_subtitle')}{' '}
            <span className="font-mono-tabular font-semibold text-[#0F172A]">
              ({filteredPredictions.length}/{predictions.length} species)
            </span>
          </p>
        </div>

        {/* Search + Sort + Compatibility Segmented Control */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(lang, 'explorer_search_placeholder')}
              aria-label={t(lang, 'explorer_search_placeholder')}
              className="w-full min-h-[40px] rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] pl-9 pr-8 text-xs text-[#0F172A] placeholder:text-[#64748B] focus:border-[#15803D] focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative flex items-center">
            <ArrowUpDown
              className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#64748B]"
              aria-hidden="true"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort EcoCrop species"
              className="min-h-[40px] rounded-lg border border-[#CBD5E1] bg-white pl-8 pr-3 text-xs font-semibold text-[#0F172A] focus:border-[#15803D] focus:outline-none cursor-pointer"
            >
              <option value="score">Sort: Best Match</option>
              <option value="margin">Sort: Net Margin</option>
              <option value="cycle">Sort: Shortest Cycle</option>
              <option value="nitrogen">Sort: Nitrogen Gain</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Filter Bars (Compatibility Tier + 7 EcoCrop Categories) */}
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F1F5F9] p-1 w-fit">
          {(
            [
              ['all', t(lang, 'explorer_filter_all')],
              ['high_fit', t(lang, 'explorer_filter_high_fit')],
              ['regional', t(lang, 'explorer_filter_regional')],
              ['nitrogen', t(lang, 'explorer_filter_nitrogen')],
            ] as Array<[CompatibilityFilter, string]>
          ).map(([key, label]) => {
            const active = compatFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCompatFilter(key)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            <span>All Categories</span>
            <span className="font-mono-tabular text-[11px] opacity-75">
              {categoryCounts.all}
            </span>
          </button>

          {ECOCROP_CATEGORY_ORDER.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                    : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <EcoCategoryIcon category={cat} className="h-3.5 w-3.5 shrink-0" />
                <span>{t(lang, ECOCROP_CATEGORY_LABEL_KEYS[cat])}</span>
                <span className="font-mono-tabular text-[11px] opacity-75">
                  {categoryCounts[cat] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* High-Density EcoCrop Compatibility Table */}
      <div className="mt-4 overflow-x-auto">
        {visibleRows.length === 0 ? (
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center text-xs text-[#475569]">
            <p className="font-semibold text-[#0F172A]">
              No EcoCrop species match your current filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setCompatFilter('all');
              }}
              className="mt-2 font-semibold text-[#15803D] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                <th className="py-2.5 pr-3">#</th>
                <th className="py-2.5 pr-3">EcoCrop Species</th>
                <th className="py-2.5 pr-3">Regional Fit</th>
                <th className="py-2.5 px-3 text-right">Score</th>
                <th className="py-2.5 px-3 text-right">Expected Yield</th>
                <th className="py-2.5 px-3 text-right">Net Margin · ROI</th>
                <th className="py-2.5 px-3 text-right">Cycle</th>
                <th className="py-2.5 px-3 text-right">Opt. Temp · pH</th>
                <th className="py-2.5 pl-3 text-right">N Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {visibleRows.map((item, idx) => {
                const eco = ECOCROP_BY_ID[item.cropId];
                if (!eco) return null;
                const isSelected = item.cropId === selectedCropId;
                const yieldText =
                  unit === 'imperial'
                    ? `${item.expectedYieldBuAc} bu/ac`
                    : `${item.expectedYieldTHa.toFixed(1)} t/ha`;
                const tLow = Math.round(convertTemp(eco.TOPMN, unit));
                const tHigh = Math.round(convertTemp(eco.TOPMX, unit));
                const scoreColor =
                  item.score >= 75
                    ? 'text-[#15803D]'
                    : item.score >= 55
                    ? 'text-[#0F172A]'
                    : 'text-[#64748B]';

                return (
                  <tr
                    key={item.cropId}
                    onClick={() => {
                      onSelectCrop(item.cropId);
                      const el = document.getElementById('hero-recommendation-card');
                      el?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
                    }}
                    className={`h-[44px] transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F0FDF4]'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-2 pr-3 font-mono-tabular font-semibold text-[#64748B]">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ResilientPhoto
                          src={getCropPhoto(item.cropId)}
                          fallbackSrc={getCropFallbackPhoto(item.cropId)}
                          alt={cropLabel(lang, item.cropId)}
                          loading="lazy"
                          className="h-8 w-8 shrink-0 rounded-md border border-[#E2E8F0]"
                        />
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={`font-semibold truncate ${
                                isSelected ? 'text-[#15803D]' : 'text-[#0F172A]'
                              }`}
                            >
                              {cropLabel(lang, item.cropId)}
                            </span>
                            <span className="text-[11px] italic text-[#64748B] truncate">
                              {eco.ScientificName}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {eco.CAT} · {eco.LIFE_FORM}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {item.isTraditionalRegional ? (
                        <span className="font-semibold text-[#15803D]">
                          {t(lang, 'explorer_regional_staple')}
                          {item.regionalRank ? ` #${item.regionalRank}` : ''}
                        </span>
                      ) : (
                        <span className="text-[#64748B]">
                          {t(lang, 'explorer_climate_option')}
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono-tabular font-bold ${scoreColor}`}
                    >
                      {item.score}/100
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular font-medium text-[#0F172A]">
                      {yieldText}
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular">
                      <span
                        className={
                          item.estNetMarginUsdHa >= 0
                            ? 'font-semibold text-[#15803D]'
                            : 'font-semibold text-[#DC2626]'
                        }
                      >
                        {formatMarginPerArea(item.estNetMarginUsdHa, unit)}
                      </span>
                      <span className="text-[#64748B]"> · {item.roiPct}%</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#334155]">
                      {item.growingDays} d
                    </td>
                    <td className="py-2 px-3 text-right font-mono-tabular text-[#475569]">
                      {tLow}–{tHigh}
                      {tempUnitLabel(unit)} · pH {eco.PHOPMN}–{eco.PHOPMX}
                    </td>
                    <td
                      className={`py-2 pl-3 text-right font-mono-tabular font-semibold ${
                        item.nitrogenDeltaKgHa >= 0
                          ? 'text-[#15803D]'
                          : 'text-[#64748B]'
                      }`}
                    >
                      {formatNitrogenDelta(item.nitrogenDeltaKgHa, unit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!isFiltered && filteredPredictions.length > 18 && (
        <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
          <span className="font-mono-tabular text-xs text-[#64748B]">
            Showing {visibleRows.length} of {filteredPredictions.length} EcoCrop species
          </span>
          <button
            type="button"
            onClick={() => setShowAllRows((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-white cursor-pointer"
          >
            {showAllRows ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
                {t(lang, 'explorer_show_top')}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                {t(lang, 'explorer_show_all')} ({filteredPredictions.length})
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
