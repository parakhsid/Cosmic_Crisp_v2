import {
  AlertTriangle,
  BookmarkCheck,
  Bug,
  Check,
  CheckCircle2,
  Droplets,
  Leaf,
  ShieldAlert,
  Sprout,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {ECOCROP_BY_ID} from '../data/ecoCrop';
import {cropLabel, t} from '../i18n/translations';
import {evaluatePestDiseaseStrategy} from '../lib/pestDiseaseModel';
import {formatIrrigationDepth, formatTemp, type UnitSystem} from '../lib/units';
import type {
  EnsoPhase,
  EnsoScenarioMode,
  FarmInsightBundle,
  IrrigationMethodId,
  LanguageCode,
  PestControlPosture,
  PestPlanSettings,
  SeasonalEnsoOutlook,
  SlopeClass,
  ThreatGuild,
} from '../types/agronomy';
import {PestRiskChart} from './PestRiskChart';
import {getCropFallbackPhoto, getCropPhoto, ResilientPhoto} from './VisualAssets';

interface PestDiseaseViewProps {
  lang: LanguageCode;
  unit: UnitSystem;
  bundle: FarmInsightBundle | null;
  outlook: SeasonalEnsoOutlook | null;
  loadingOutlook: boolean;
  isOfflineActive: boolean;
  activeFarmName: string;
  currentCropId: string;
  slopeClass: SlopeClass;
  irrigationMethod: IrrigationMethodId;
  onChangeIrrigationMethod: (method: IrrigationMethodId) => Promise<void> | void;
  pestPlan: PestPlanSettings;
  onUpdatePestPlan: (next: PestPlanSettings) => Promise<void> | void;
}

const ENSO_SCENARIO_OPTIONS: Array<{id: EnsoScenarioMode; label: string}> = [
  {id: 'live', label: 'Live NOAA Outlook'},
  {id: 'el_nino', label: 'El Niño Stress'},
  {id: 'la_nina', label: 'La Niña Stress'},
  {id: 'neutral', label: 'Neutral Normal'},
];

const POSTURE_OPTIONS: Array<{id: PestControlPosture; label: string}> = [
  {id: 'ipm', label: 'IPM Balance'},
  {id: 'organic', label: 'Organic & Bio-First'},
  {id: 'conventional', label: 'Conventional Proactive'},
];

const IRRIGATION_METHOD_LABELS: Record<IrrigationMethodId, string> = {
  rain_pipes: 'Rain Pipes',
  drip: 'Drip / SDI',
  sprinkler: 'Sprinkler',
  furrow: 'Furrow',
  drainage: 'Drainage',
};

function phaseDisplayName(phase: EnsoPhase): string {
  if (phase === 'el_nino') return 'El Niño';
  if (phase === 'la_nina') return 'La Niña';
  return 'ENSO-Neutral';
}

function guildLabel(guild: ThreatGuild): string {
  if (guild === 'fungal') return 'Fungal / Oomycete';
  if (guild === 'insect') return 'Insect & Mite Vector';
  return 'Soil / Collar Rot';
}

function severityBadgeStyle(severity: 'critical' | 'high' | 'moderate' | 'low'): string {
  if (severity === 'critical') return 'text-[#DC2626]';
  if (severity === 'high') return 'text-[#D97706]';
  if (severity === 'moderate') return 'text-[#0369A1]';
  return 'text-[#15803D]';
}

export function PestDiseaseView({
  lang,
  unit,
  bundle,
  outlook,
  loadingOutlook,
  isOfflineActive,
  activeFarmName,
  currentCropId,
  slopeClass,
  irrigationMethod,
  onChangeIrrigationMethod,
  pestPlan,
  onUpdatePestPlan,
}: PestDiseaseViewProps) {
  const [savedNotice, setSavedNotice] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const strategy = useMemo(() => {
    if (!bundle) return null;
    return evaluatePestDiseaseStrategy({
      bundle,
      outlook,
      cropId: currentCropId,
      slopeClass,
      irrigationMethod,
      posture: pestPlan.posture,
      scenarioMode: pestPlan.scenarioOverride,
    });
  }, [
    bundle,
    outlook,
    currentCropId,
    slopeClass,
    irrigationMethod,
    pestPlan.posture,
    pestPlan.scenarioOverride,
  ]);

  const activeCrop = ECOCROP_BY_ID[currentCropId];
  const activeCropName = cropLabel(lang, currentCropId);

  const focusedThreat = useMemo(() => {
    if (!strategy || !strategy.threats.length) return null;
    if (pestPlan.focusedThreatId) {
      const found = strategy.threats.find((x) => x.id === pestPlan.focusedThreatId);
      if (found) return found;
    }
    return strategy.threats[0];
  }, [strategy, pestPlan.focusedThreatId]);

  if (!bundle || !strategy) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-xl border border-[#E2E8F0] bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-[#E2E8F0] bg-white" />
      </div>
    );
  }

  const updatePlan = (patch: Partial<PestPlanSettings>, flashSaved = false) => {
    const next: PestPlanSettings = {
      ...pestPlan,
      ...patch,
    };
    void onUpdatePestPlan(next);
    if (flashSaved) {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2400);
    }
  };

  const togglePrepItem = (id: string) => {
    const exists = pestPlan.completedPrepIds.includes(id);
    const nextIds = exists
      ? pestPlan.completedPrepIds.filter((x) => x !== id)
      : [...pestPlan.completedPrepIds, id];
    updatePlan({completedPrepIds: nextIds});
  };

  const completedCount = strategy.prepChecklist.filter((item) =>
    pestPlan.completedPrepIds.includes(item.id)
  ).length;
  const readinessPct = Math.round(
    (completedCount / Math.max(1, strategy.prepChecklist.length)) * 100
  );

  const livePhase = outlook?.phase ?? 'neutral';
  const liveOni = outlook?.oniValueC ?? 0;

  return (
    <div className="space-y-6">
      {/* Header Band with Farm & Crop Sync + Save Button */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F1F5F9]">
              <ResilientPhoto
                src={getCropPhoto(currentCropId)}
                fallbackSrc={getCropFallbackPhoto(currentCropId)}
                alt={activeCropName}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                <span>{activeFarmName}</span>
                <span aria-hidden="true">·</span>
                <span>{strategy.regionLabel}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {activeCropName}
                  {activeCrop?.ScientificName ? ` (${activeCrop.ScientificName})` : ''}
                </span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#0F172A] text-balance">
                {t(lang, 'pest_title')}
              </h1>
              <p className="mt-1 text-sm text-[#475569] max-w-3xl">
                {t(lang, 'pest_subtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="text-right text-xs text-[#475569]">
              <div className="font-semibold text-[#0F172A]">
                NOAA ONI:{' '}
                <span className="font-mono-tabular">
                  {liveOni >= 0 ? `+${liveOni.toFixed(2)}°C` : `${liveOni.toFixed(2)}°C`}
                </span>{' '}
                · {phaseDisplayName(livePhase)}
              </div>
              <div className="mt-0.5 text-[#64748B]">
                {loadingOutlook
                  ? 'Updating seasonal forecast...'
                  : isOfflineActive || outlook?.source === 'regional_benchmark'
                  ? 'Cached / climatology baseline'
                  : `Live ${outlook?.currentSeasonLabel ?? 'NOAA + Open-Meteo'}`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => updatePlan({}, true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]"
            >
              <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
              {savedNotice ? t(lang, 'pest_saved_plan') : t(lang, 'pest_save_plan')}
            </button>
          </div>
        </div>

        {/* Interactive Controls Strip */}
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[#E2E8F0] pt-5 lg:grid-cols-12">
          {/* ENSO Scenario Stress Test */}
          <div className="lg:col-span-5">
            <div className="text-xs font-semibold text-[#334155]">
              ENSO Climate Scenario Stress Test
            </div>
            <div className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#F1F5F9] p-1">
              {ENSO_SCENARIO_OPTIONS.map((opt) => {
                const active = pestPlan.scenarioOverride === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePlan({scenarioOverride: opt.id})}
                    className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white text-[#0F172A] shadow-xs font-semibold'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control Posture Selector */}
          <div className="lg:col-span-4">
            <div className="text-xs font-semibold text-[#334155]">
              Protection Posture (Default: IPM)
            </div>
            <div className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#F1F5F9] p-1">
              {POSTURE_OPTIONS.map((opt) => {
                const active = pestPlan.posture === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePlan({posture: opt.id})}
                    className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white text-[#15803D] shadow-xs font-semibold'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Synced Irrigation Method Link */}
          <div className="lg:col-span-3">
            <div className="text-xs font-semibold text-[#334155]">
              Synced Irrigation Method
            </div>
            <div className="mt-2">
              <select
                aria-label="Synced Irrigation Method"
                value={irrigationMethod}
                onChange={(e) =>
                  void onChangeIrrigationMethod(e.target.value as IrrigationMethodId)
                }
                className="min-h-[40px] w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]"
              >
                {(Object.keys(IRRIGATION_METHOD_LABELS) as IrrigationMethodId[]).map(
                  (mId) => (
                    <option key={mId} value={mId}>
                      {IRRIGATION_METHOD_LABELS[mId]}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Threat Briefing & 4-Column KPI Strip */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#475569]">
              <span>
                Active Phase: <strong className="text-[#0F172A]">{phaseDisplayName(strategy.activeScenario)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                Rain shift {strategy.teleconnectionRainShiftPct >= 0 ? `+${strategy.teleconnectionRainShiftPct}%` : `${strategy.teleconnectionRainShiftPct}%`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                Temp shift {strategy.teleconnectionTempShiftC >= 0 ? `+${strategy.teleconnectionTempShiftC}°C` : `${strategy.teleconnectionTempShiftC}°C`}
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-xl font-bold text-[#0F172A] text-balance">
              {strategy.headlineSummary}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">
              {strategy.fungalVsInsectSummary}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#334155]">
              <strong className="font-semibold text-[#0F172A]">
                Irrigation Epidemiology Link ({IRRIGATION_METHOD_LABELS[irrigationMethod]}):
              </strong>{' '}
              {strategy.irrigationModifierSummary}
            </p>
          </div>
        </div>

        {/* 4-column KPI strip separated by hairline dividers */}
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-5 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Droplets className="h-3.5 w-3.5 text-[#0284C7]" aria-hidden="true" />
              <span>Peak Fungal / Mildew Risk</span>
            </div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-[#0F172A]">
              {strategy.peakFungalRisk}
              <span className="text-sm font-normal text-[#64748B]">/100</span>
            </div>
            <div className="mt-0.5 text-xs text-[#475569]">
              6-mo avg {strategy.avgFungalRisk}/100
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Bug className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
              <span>Peak Insect &amp; Mite Pressure</span>
            </div>
            <div
              className={`mt-1 font-mono-tabular text-2xl font-bold ${
                strategy.peakInsectRisk >= 65 ? 'text-[#DC2626]' : 'text-[#0F172A]'
              }`}
            >
              {strategy.peakInsectRisk}
              <span className="text-sm font-normal text-[#64748B]">/100</span>
            </div>
            <div className="mt-0.5 text-xs text-[#475569]">
              6-mo avg {strategy.avgInsectRisk}/100
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <Sprout className="h-3.5 w-3.5 text-[#475569]" aria-hidden="true" />
              <span>Soil / Collar Rot Peak</span>
            </div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-[#0F172A]">
              {strategy.peakSoilVectorRisk}
              <span className="text-sm font-normal text-[#64748B]">/100</span>
            </div>
            <div className="mt-0.5 text-xs text-[#475569]">
              Clay {Math.round(bundle.soil.clayPct ?? 25)}% · {slopeClass} slope
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
              <span>Prep Checklist Readiness</span>
            </div>
            <div className="mt-1 font-mono-tabular text-2xl font-bold text-[#15803D]">
              {readinessPct}%
            </div>
            <div className="mt-0.5 font-mono-tabular text-xs text-[#475569]">
              {completedCount}/{strategy.prepChecklist.length} actions complete
            </div>
          </div>
        </div>
      </section>

      {/* 6-Month Fungal vs Insect Risk Chart + Monthly Table */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              6-Month ENSO Fungal vs. Insect Risk Outlook
            </h2>
            <p className="mt-0.5 text-xs text-[#475569]">
              {strategy.teleconnectionLabel}. Click any month column to inspect drivers and pre-emptive defense timing.
            </p>
          </div>
          {selectedMonthKey && (
            <button
              type="button"
              onClick={() => setSelectedMonthKey(null)}
              className="text-xs font-medium text-[#15803D] hover:underline cursor-pointer"
            >
              Clear Month Focus
            </button>
          )}
        </div>

        <div className="mt-4">
          <PestRiskChart
            months={strategy.monthlyRisks}
            selectedMonthKey={selectedMonthKey}
            onSelectMonth={(key) =>
              setSelectedMonthKey((prev) => (prev === key ? null : key))
            }
          />
        </div>

        <div className="mt-5 overflow-x-auto border-t border-[#E2E8F0] pt-4">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                <th className="py-2 pr-3 font-semibold">Month</th>
                <th className="py-2 px-3 font-semibold text-right">Rain / Temp</th>
                <th className="py-2 px-3 font-semibold text-right">Fungal</th>
                <th className="py-2 px-3 font-semibold text-right">Insect</th>
                <th className="py-2 px-3 font-semibold text-right">Soil Rot</th>
                <th className="py-2 pl-3 font-semibold">Primary Target &amp; Driver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {strategy.monthlyRisks.map((m) => {
                const isSelected = selectedMonthKey === m.monthKey;
                return (
                  <tr
                    key={m.monthKey}
                    onClick={() =>
                      setSelectedMonthKey((prev) =>
                        prev === m.monthKey ? null : m.monthKey
                      )
                    }
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-semibold text-[#0F172A] whitespace-nowrap">
                      {m.monthLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#475569] whitespace-nowrap">
                      {formatIrrigationDepth(m.forecastPrecipMm, unit)} ·{' '}
                      {formatTemp(m.tempC, unit)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                        m.fungalRisk >= 65 ? 'text-[#0369A1]' : 'text-[#334155]'
                      }`}
                    >
                      {m.fungalRisk}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular font-semibold ${
                        m.insectRisk >= 65 ? 'text-[#DC2626]' : 'text-[#334155]'
                      }`}
                    >
                      {m.insectRisk}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono-tabular ${
                        m.soilVectorRisk >= 65
                          ? 'font-semibold text-[#DC2626]'
                          : 'text-[#475569]'
                      }`}
                    >
                      {m.soilVectorRisk}
                    </td>
                    <td className="py-2.5 pl-3 text-[#334155]">
                      <div className="font-semibold text-[#0F172A]">
                        {m.primaryAgentName}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {m.weatherDriverNote}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Regional Threat Profiles ("What to Prepare Beforehand") */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Area-Sourced Threats &amp; Advance Preparation for {activeCropName}
            </h2>
            <p className="mt-0.5 text-xs text-[#475569]">
              Ranked for {strategy.regionLabel} under {phaseDisplayName(strategy.activeScenario)} and{' '}
              {POSTURE_OPTIONS.find((p) => p.id === pestPlan.posture)?.label}. Select a threat to view full field protocol.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left column: Threat selector list */}
          <div className="divide-y divide-[#E2E8F0] border-t border-b border-[#E2E8F0] lg:col-span-5">
            {strategy.threats.map((threat) => {
              const isFocused = focusedThreat?.id === threat.id;
              return (
                <button
                  key={threat.id}
                  type="button"
                  onClick={() => updatePlan({focusedThreatId: threat.id})}
                  className={`flex w-full items-start justify-between gap-3 px-3 py-3.5 text-left transition-colors cursor-pointer ${
                    isFocused ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                      <span>{guildLabel(threat.guild)}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${severityBadgeStyle(threat.severity)}`}>
                        {threat.severity === 'critical'
                          ? 'Critical Watch'
                          : threat.severity === 'high'
                          ? 'High Watch'
                          : threat.severity === 'moderate'
                          ? 'Moderate'
                          : 'Low Risk'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm font-bold text-[#0F172A]">
                      {threat.commonName}
                    </div>
                    <div className="text-xs italic text-[#64748B]">
                      {threat.scientificName}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono-tabular text-lg font-bold text-[#0F172A]">
                      {threat.riskScore}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {threat.peakMonths.join(', ')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right column: Detailed Advance Prep Protocol */}
          {focusedThreat && (
            <div className="lg:col-span-7 lg:pl-2">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                <div>
                  <div className="text-xs text-[#64748B]">
                    {guildLabel(focusedThreat.guild)} · Peak: {focusedThreat.peakMonths.join(', ')}
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-bold text-[#0F172A]">
                    {focusedThreat.commonName}
                  </h3>
                  <div className="text-xs italic text-[#64748B]">
                    {focusedThreat.scientificName}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${severityBadgeStyle(
                      focusedThreat.severity
                    )}`}
                  >
                    {focusedThreat.severity === 'critical' ||
                    focusedThreat.severity === 'high' ? (
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Risk Index {focusedThreat.riskScore}/100
                  </span>
                </div>
              </div>

              <dl className="mt-4 space-y-3 text-xs leading-relaxed">
                <div>
                  <dt className="font-semibold text-[#0F172A]">
                    ENSO &amp; Weather Trigger
                  </dt>
                  <dd className="mt-0.5 text-[#475569]">
                    {focusedThreat.ensoShiftNote} ({focusedThreat.weatherTrigger})
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-[#0F172A]">
                    Irrigation Interaction ({IRRIGATION_METHOD_LABELS[irrigationMethod]})
                  </dt>
                  <dd className="mt-0.5 text-[#475569]">
                    {focusedThreat.irrigationEffectNote}
                  </dd>
                </div>

                <div>
                  <dt className="font-semibold text-[#0F172A]">
                    Early Scouting Sign
                  </dt>
                  <dd className="mt-0.5 text-[#475569]">
                    {focusedThreat.earlyScoutingSign}
                  </dd>
                </div>

                <div className="border-t border-[#E2E8F0] pt-3">
                  <dt className="flex items-center gap-1.5 font-semibold text-[#15803D]">
                    <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Recommended{' '}
                      {POSTURE_OPTIONS.find((p) => p.id === pestPlan.posture)?.label} Protocol
                    </span>
                  </dt>
                  <dd className="mt-1 text-sm text-[#0F172A]">
                    {focusedThreat.recommendedActionForPosture}
                  </dd>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-[#E2E8F0] pt-3 sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-[#334155]">Cultural Prep</dt>
                    <dd className="mt-0.5 text-[#475569]">{focusedThreat.culturalPrep}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#334155]">Biological Control</dt>
                    <dd className="mt-0.5 text-[#475569]">
                      {focusedThreat.biologicalControl}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-[#334155]">Threshold Rescue</dt>
                    <dd className="mt-0.5 text-[#475569]">
                      {focusedThreat.targetedIntervention}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          )}
        </div>
      </section>

      {/* Pre-Season Preparation Checklist (Persisted per Farm) */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Pre-Season Protection &amp; Readiness Checklist
            </h2>
            <p className="mt-0.5 text-xs text-[#475569]">
              Track advance traps, bio-inoculants, canopy hygiene, and irrigation alignment for {activeFarmName}. Saved automatically per farm profile.
            </p>
          </div>
          <div className="font-mono-tabular text-xs font-semibold text-[#15803D]">
            {completedCount} of {strategy.prepChecklist.length} completed ({readinessPct}%)
          </div>
        </div>

        <div className="mt-4 divide-y divide-[#E2E8F0] border-t border-[#E2E8F0]">
          {strategy.prepChecklist.map((item) => {
            const done = pestPlan.completedPrepIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => togglePrepItem(item.id)}
                className="flex cursor-pointer items-start gap-3.5 py-3.5 transition-colors hover:bg-[#F8FAFC]"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={item.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePrepItem(item.id);
                  }}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors cursor-pointer ${
                    done
                      ? 'border-[#15803D] bg-[#15803D] text-white'
                      : 'border-[#CBD5E1] bg-white hover:border-[#15803D]'
                  }`}
                >
                  {done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span>
                      {item.category === 'monitoring'
                        ? 'Monitoring & Traps'
                        : item.category === 'biological_cultural'
                        ? 'Biological & Canopy Prep'
                        : item.category === 'irrigation_hygiene'
                        ? 'Water & Drainage Defense'
                        : 'Targeted Threshold Control'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        item.priority === 'critical'
                          ? 'text-[#DC2626]'
                          : item.priority === 'high'
                          ? 'text-[#D97706]'
                          : 'text-[#475569]'
                      }`}
                    >
                      {item.priority === 'critical'
                        ? 'Critical Priority'
                        : item.priority === 'high'
                        ? 'High Priority'
                        : 'Standard Prep'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.timingWindow}</span>
                  </div>
                  <div
                    className={`mt-0.5 text-sm font-semibold ${
                      done ? 'text-[#64748B] line-through' : 'text-[#0F172A]'
                    }`}
                  >
                    {item.title}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#475569]">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
