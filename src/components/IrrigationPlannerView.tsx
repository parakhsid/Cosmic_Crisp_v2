import {
  AlertTriangle,
  BookmarkCheck,
  Check,
  CheckCircle2,
  CloudRain,
  Droplets,
  ShieldAlert,
  Waves,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {ECOCROP_BY_ID} from '../data/ecoCrop';
import {cropLabel, t} from '../i18n/translations';
import {evaluateIrrigationPlan} from '../lib/irrigationModel';
import {
  formatArea,
  formatCurrencyPerArea,
  formatIrrigationDepth,
  formatIrrigationVolume,
  formatTemp,
  type UnitSystem,
} from '../lib/units';
import type {
  EnsoPhase,
  EnsoScenarioMode,
  FarmInsightBundle,
  IrrigationMethodId,
  IrrigationPlanSettings,
  LanguageCode,
  SeasonalEnsoOutlook,
  SlopeClass,
  WaterScarcityLevel,
  WaterSourceType,
} from '../types/agronomy';
import {IrrigationChart} from './IrrigationChart';
import {getCropFallbackPhoto, getCropPhoto, ResilientPhoto} from './VisualAssets';

interface IrrigationPlannerViewProps {
  lang: LanguageCode;
  unit: UnitSystem;
  bundle: FarmInsightBundle | null;
  outlook: SeasonalEnsoOutlook | null;
  loadingOutlook: boolean;
  isOfflineActive: boolean;
  activeFarmName: string;
  currentCropId: string;
  harvestMonth: number;
  areaAcres: number;
  slopeClass: SlopeClass;
  irrigationPlan: IrrigationPlanSettings;
  onUpdatePlan: (next: IrrigationPlanSettings, persistNow?: boolean) => Promise<void> | void;
}

const ENSO_SCENARIO_OPTIONS: Array<{id: EnsoScenarioMode; label: string}> = [
  {id: 'live', label: 'Live NOAA Outlook'},
  {id: 'el_nino', label: 'El Niño Stress'},
  {id: 'la_nina', label: 'La Niña Stress'},
  {id: 'neutral', label: 'Neutral Normal'},
];

const SCARCITY_OPTIONS: Array<{id: WaterScarcityLevel; label: string}> = [
  {id: 'severe', label: 'Severe Scarcity'},
  {id: 'moderate', label: 'Moderate Limit'},
  {id: 'abundant', label: 'Abundant Supply'},
];

const SOURCE_OPTIONS: Array<{id: WaterSourceType; label: string}> = [
  {id: 'well', label: 'Well / Borehole'},
  {id: 'canal', label: 'Canal / Surface'},
  {id: 'rain_harvest', label: 'Rainwater Harvest'},
  {id: 'mixed', label: 'Mixed Sources'},
];

function phaseDisplayName(phase: EnsoPhase): string {
  if (phase === 'el_nino') return 'El Niño';
  if (phase === 'la_nina') return 'La Niña';
  return 'ENSO-Neutral';
}

export function IrrigationPlannerView({
  lang,
  unit,
  bundle,
  outlook,
  loadingOutlook,
  isOfflineActive,
  activeFarmName,
  currentCropId,
  harvestMonth,
  areaAcres,
  slopeClass,
  irrigationPlan,
  onUpdatePlan,
}: IrrigationPlannerViewProps) {
  const [savedNotice, setSavedNotice] = useState(false);

  const decision = useMemo(() => {
    if (!bundle) return null;
    return evaluateIrrigationPlan({
      bundle,
      outlook,
      cropId: currentCropId,
      harvestMonth,
      areaAcres,
      slopeClass,
      scenarioMode: irrigationPlan.scenarioOverride,
      scarcityLevel: irrigationPlan.scarcityLevel,
      waterSource: irrigationPlan.waterSource,
    });
  }, [
    bundle,
    outlook,
    currentCropId,
    harvestMonth,
    areaAcres,
    slopeClass,
    irrigationPlan.scenarioOverride,
    irrigationPlan.scarcityLevel,
    irrigationPlan.waterSource,
  ]);

  const activeCropEco = ECOCROP_BY_ID[currentCropId];
  const selectedMethodObj =
    decision?.methods.find((m) => m.methodId === irrigationPlan.selectedMethod) ??
    decision?.topMethod ??
    null;

  const patchPlan = (partial: Partial<IrrigationPlanSettings>, persistNow = true) => {
    const next: IrrigationPlanSettings = {
      ...irrigationPlan,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    void onUpdatePlan(next, persistNow);
  };

  const handleSaveFullPlan = async () => {
    const chosen = selectedMethodObj?.methodId ?? irrigationPlan.selectedMethod;
    await onUpdatePlan(
      {
        ...irrigationPlan,
        selectedMethod: chosen,
        updatedAt: new Date().toISOString(),
      },
      true
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2600);
  };

  const toggleChecklistItem = (id: string) => {
    const exists = irrigationPlan.completedContingencyIds.includes(id);
    const nextIds = exists
      ? irrigationPlan.completedContingencyIds.filter((item) => item !== id)
      : [...irrigationPlan.completedContingencyIds, id];
    patchPlan({completedContingencyIds: nextIds});
  };

  if (!bundle || !decision) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-80 animate-pulse rounded-lg bg-[#E2E8F0]" />
        <div className="h-44 animate-pulse rounded-xl border border-[#E2E8F0] bg-white" />
        <div className="h-72 animate-pulse rounded-xl border border-[#E2E8F0] bg-white" />
      </div>
    );
  }

  const scarcityChecklist = decision.contingencyActions.filter(
    (a) => a.category === 'scarcity'
  );
  const floodAndEnsoChecklist = decision.contingencyActions.filter(
    (a) => a.category !== 'scarcity'
  );
  const completedCount = decision.contingencyActions.filter((a) =>
    irrigationPlan.completedContingencyIds.includes(a.id)
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Title & Unboxed Farm Context Metadata */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] text-balance">
            {t(lang, 'irrig_title')}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-[#475569]">
            <span className="font-semibold text-[#0F172A]">{activeFarmName}</span>
            <span aria-hidden="true">·</span>
            <span>{cropLabel(lang, currentCropId)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{formatArea(areaAcres, unit)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {bundle.soil.textureClass} (AWC{' '}
              <span className="font-mono-tabular">{decision.soilAwcMmPerM} mm/m</span>)
            </span>
            <span aria-hidden="true">·</span>
            <span className={isOfflineActive ? 'font-medium text-[#B45309]' : 'font-medium text-[#15803D]'}>
              {outlook?.source === 'live_noaa_openmeteo' && !isOfflineActive
                ? 'Live NOAA CPC + Open-Meteo Seasonal'
                : 'NASA POWER Climatology Baseline'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveFullPlan()}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {savedNotice ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
          )}
          <span>
            {savedNotice ? t(lang, 'irrig_saved_plan') : t(lang, 'irrig_save_plan')}
          </span>
        </button>
      </div>

      {/* Live NOAA ENSO Status + Stress-Test Scenario & Scarcity Controls */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#0284C7]">
              <Waves className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {outlook?.currentSeasonLabel ?? 'ENSO Outlook'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-[#0F172A]">
                ONI {outlook ? `${outlook.oniValueC >= 0 ? '+' : ''}${outlook.oniValueC.toFixed(2)}°C` : '0.00°C'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-[#0F172A]">
                Active: {phaseDisplayName(decision.activeScenario)}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-[#475569]">
              {loadingOutlook
                ? 'Refreshing NOAA CPC Oceanic Niño Index and 51-member Open-Meteo 6-month seasonal ensemble...'
                : `${outlook?.ensoSummaryNote ?? ''} ${decision.teleconnectionLabel}.`}
            </p>
          </div>

          {outlook && (
            <div className="grid grid-cols-3 gap-4 text-right font-mono-tabular text-xs shrink-0">
              <div>
                <div className="text-[#64748B]">El Niño</div>
                <div className="mt-0.5 text-base font-bold text-[#D97706]">
                  {outlook.probabilities.elNinoPct}%
                </div>
              </div>
              <div>
                <div className="text-[#64748B]">Neutral</div>
                <div className="mt-0.5 text-base font-bold text-[#0F172A]">
                  {outlook.probabilities.neutralPct}%
                </div>
              </div>
              <div>
                <div className="text-[#64748B]">La Niña</div>
                <div className="mt-0.5 text-base font-bold text-[#0284C7]">
                  {outlook.probabilities.laNinaPct}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Controls Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Control 1: ENSO Stress Test */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-[#334155]">
              Seasonal Weather Pattern / Stress Test
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              {ENSO_SCENARIO_OPTIONS.map((opt) => {
                const active = irrigationPlan.scenarioOverride === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchPlan({scenarioOverride: opt.id})}
                    className={`min-h-[36px] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                      active
                        ? 'bg-[#0F172A] text-white'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control 2: Water Scarcity Tier */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-[#334155]">
              Regional Water Scarcity Level
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1">
              {SCARCITY_OPTIONS.map((opt) => {
                const active = irrigationPlan.scarcityLevel === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchPlan({scarcityLevel: opt.id})}
                    className={`min-h-[36px] rounded-md px-2 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                      active
                        ? 'bg-[#15803D] text-white'
                        : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control 3: Primary Water Source */}
          <div>
            <label
              htmlFor="irrigation-water-source"
              className="mb-1.5 block text-xs font-semibold text-[#334155]"
            >
              Farm Water Supply Source
            </label>
            <select
              id="irrigation-water-source"
              value={irrigationPlan.waterSource}
              onChange={(e) =>
                patchPlan({waterSource: e.target.value as WaterSourceType})
              }
              className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#15803D] focus:outline-none cursor-pointer"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Dominant Decision Support Hero Card */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7 flex items-start gap-4">
            <ResilientPhoto
              src={getCropPhoto(currentCropId)}
              fallbackSrc={getCropFallbackPhoto(currentCropId)}
              alt={cropLabel(lang, currentCropId)}
              className="h-20 w-24 shrink-0 rounded-lg border border-[#E2E8F0]"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#15803D]">
                <Droplets className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Recommended Irrigation & Contingency Strategy</span>
                {activeCropEco && (
                  <span className="font-normal text-[#64748B]">
                    · {cropLabel(lang, currentCropId)} ({activeCropEco.waterNeedMm} mm seasonal crop need)
                  </span>
                )}
              </div>
              <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#0F172A] text-balance">
                {decision.topMethod.name}
              </h2>
              <p className="mt-1.5 text-sm text-[#475569]">
                {decision.topMethod.rationale}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475569]">
                <span className="font-semibold text-[#15803D]">
                  Fit Score {decision.topMethod.score}/100
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {decision.topMethod.applicationEfficiencyPct}% efficiency
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular font-semibold text-[#0284C7]">
                  Saves {decision.topMethod.waterSavedVsFurrowPct}% water vs. flood
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Selected on farm:{' '}
                  <strong className="text-[#0F172A]">
                    {selectedMethodObj?.shortLabel ?? decision.topMethod.shortLabel}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* 4-Metric Quantitative Summary Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4 border-t border-[#E2E8F0] pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
            <div>
              <div className="text-xs text-[#64748B]">6-Mo Forecast Rain</div>
              <div className="mt-0.5 font-mono-tabular text-xl font-extrabold text-[#0284C7]">
                {formatIrrigationDepth(decision.total6MoPrecipMm, unit)}
              </div>
              <div className="text-[11px] text-[#64748B]">
                ENSO shift{' '}
                <span className="font-mono-tabular font-semibold">
                  {decision.teleconnectionRainShiftPct >= 0
                    ? `+${decision.teleconnectionRainShiftPct}%`
                    : `${decision.teleconnectionRainShiftPct}%`}
                </span>
              </div>
            </div>

            <div>
              <div className="text-xs text-[#64748B]">6-Mo Crop Demand (ETc)</div>
              <div className="mt-0.5 font-mono-tabular text-xl font-extrabold text-[#0F172A]">
                {formatIrrigationDepth(decision.total6MoCropEtcMm, unit)}
              </div>
              <div className="text-[11px] text-[#64748B]">
                Harvest target month {harvestMonth + 1}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#64748B]">Net Irrigation Deficit</div>
              <div className="mt-0.5 font-mono-tabular text-xl font-extrabold text-[#D97706]">
                {formatIrrigationDepth(decision.total6MoIrrigationNeedMm, unit)}
              </div>
              <div className="font-mono-tabular text-[11px] text-[#64748B]">
                {formatIrrigationVolume(
                  decision.total6MoIrrigationNeedMm,
                  areaAcres,
                  unit
                )}{' '}
                across {formatArea(areaAcres, unit)}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#64748B]">Excess Rain / Flood Load</div>
              <div
                className={`mt-0.5 font-mono-tabular text-xl font-extrabold ${
                  decision.floodAlertMonths > 0
                    ? 'text-[#DC2626]'
                    : 'text-[#15803D]'
                }`}
              >
                {formatIrrigationDepth(decision.total6MoDrainageSurplusMm, unit)}
              </div>
              <div className="text-[11px] text-[#64748B]">
                {decision.floodAlertMonths} wet-risk · {decision.droughtAlertMonths} dry-risk mo
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6-Month Water Balance Chart + Monthly Forecast & Contingency Schedule */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Upcoming 6-Month Water Balance & Adversity Schedule
            </h2>
            <p className="text-xs text-[#64748B]">
              Compares projected monthly rainfall (with P10 dry and P90 storm spread) against crop evapotranspiration (ETc).
            </p>
          </div>
          <span className="font-mono-tabular text-xs text-[#475569]">
            {decision.floodAlertMonths > 0
              ? `${decision.floodAlertMonths} flood-contingency month(s)`
              : 'No high flood surplus'}
          </span>
        </div>

        <IrrigationChart months={decision.monthlyBalances} unit={unit} />

        <div className="mt-5 overflow-x-auto border-t border-[#E2E8F0] pt-4">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-[11px] font-bold text-[#64748B]">
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 px-3 text-right">Forecast Rain (P10–P90)</th>
                <th className="py-2 px-3 text-right">Avg Temp</th>
                <th className="py-2 px-3 text-right">Crop ETc (Kc)</th>
                <th className="py-2 px-3 text-right">Irrigation Need</th>
                <th className="py-2 px-3 text-right">Drainage Surplus</th>
                <th className="py-2 px-3">Risk Status</th>
                <th className="py-2 pl-3">Operational Focus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {decision.monthlyBalances.map((m) => (
                <tr key={m.monthKey} className="h-[42px] hover:bg-[#F8FAFC]">
                  <td className="py-2 pr-3 font-semibold text-[#0F172A] whitespace-nowrap">
                    {m.monthLabel}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular text-[#0284C7] whitespace-nowrap">
                    <span className="font-bold">
                      {formatIrrigationDepth(m.forecastPrecipMm, unit)}
                    </span>{' '}
                    <span className="text-[11px] text-[#64748B]">
                      ({formatIrrigationDepth(m.p10PrecipMm, unit)}–
                      {formatIrrigationDepth(m.p90PrecipMm, unit)})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular text-[#0F172A]">
                    {formatTemp(m.tempC, unit, 0)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular text-[#0F172A]">
                    {formatIrrigationDepth(m.cropEtcMm, unit)}{' '}
                    <span className="text-[11px] text-[#64748B]">
                      ({m.cropKc.toFixed(2)})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-[#D97706]">
                    {m.irrigationNeedMm > 0
                      ? formatIrrigationDepth(m.irrigationNeedMm, unit)
                      : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-[#DC2626]">
                    {m.drainageSurplusMm > 0
                      ? `+${formatIrrigationDepth(m.drainageSurplusMm, unit)}`
                      : '—'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {m.floodRisk === 'high' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#DC2626]">
                        <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
                        Flood / Excess Rain
                      </span>
                    ) : m.droughtRisk === 'high' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#B45309]">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        High Deficit
                      </span>
                    ) : m.floodRisk === 'moderate' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#0284C7]">
                        <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
                        Watch Runoff
                      </span>
                    ) : (
                      <span className="text-[#15803D] font-medium">Balanced</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-[#475569]">{m.actionSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5-Method Irrigation & Scarcity Decision Support Matrix */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Irrigation & Drainage Method Comparison Matrix
            </h2>
            <p className="text-xs text-[#64748B]">
              Select your preferred farm method below to save it with this parcel. Rain Pipes and Drip lead under water scarcity; Drainage captures flood surplus.
            </p>
          </div>
          <span className="text-xs text-[#475569]">
            Baseline: Furrow flood (~54% efficiency)
          </span>
        </div>

        <div className="divide-y divide-[#E2E8F0]">
          {decision.methods.map((method, idx) => {
            const isSelected = irrigationPlan.selectedMethod === method.methodId;
            return (
              <div
                key={method.methodId}
                className={`py-4 first:pt-1 last:pb-1 transition-colors ${
                  isSelected ? 'bg-[#F0FDF4]/60 -mx-3 px-3 rounded-lg' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-[#0F172A]">
                        {idx + 1}. {method.name}
                      </span>
                      <span className="font-mono-tabular text-xs font-bold text-[#15803D]">
                        Score {method.score}/100
                      </span>
                      <span aria-hidden="true" className="text-[#CBD5E1]">
                        ·
                      </span>
                      <span className="font-mono-tabular text-xs font-semibold text-[#0284C7]">
                        {method.applicationEfficiencyPct}% efficiency
                      </span>
                      {method.waterSavedVsFurrowPct > 0 && (
                        <>
                          <span aria-hidden="true" className="text-[#CBD5E1]">
                            ·
                          </span>
                          <span className="text-xs font-semibold text-[#15803D]">
                            {method.waterSavedVsFurrowPct}% water saved
                          </span>
                        </>
                      )}
                    </div>

                    <p className="mt-1 text-xs sm:text-sm text-[#475569]">
                      {method.rationale}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#475569]">
                      <span>
                        Gross applied:{' '}
                        <strong className="font-mono-tabular text-[#0F172A]">
                          {formatIrrigationVolume(
                            method.seasonalAppliedWaterMm,
                            areaAcres,
                            unit
                          )}
                        </strong>
                      </span>
                      <span>
                        Setup:{' '}
                        <strong className="font-mono-tabular text-[#0F172A]">
                          {formatCurrencyPerArea(method.estCapexUsdPerHa, unit)}
                        </strong>
                      </span>
                      <span>
                        Seasonal op:{' '}
                        <strong className="font-mono-tabular text-[#0F172A]">
                          {formatCurrencyPerArea(method.estSeasonalOpexUsdPerHa, unit)}
                        </strong>
                      </span>
                      <span>
                        Scarcity fit:{' '}
                        <strong
                          className={
                            method.scarcityFit === 'optimal'
                              ? 'text-[#15803D]'
                              : method.scarcityFit === 'good'
                              ? 'text-[#0284C7]'
                              : 'text-[#B45309]'
                          }
                        >
                          {method.scarcityFit}
                        </strong>
                      </span>
                      <span>
                        Flood resilience:{' '}
                        <strong className="text-[#0F172A]">
                          {method.floodResilience}
                        </strong>
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-[#64748B]">
                      <strong className="text-[#334155]">Contingency note:</strong>{' '}
                      {method.contingencyNote}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      patchPlan({selectedMethod: method.methodId as IrrigationMethodId})
                    }
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'border border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                        : 'border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span>{isSelected ? 'Selected Plan' : 'Select Method'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scarcity & Flood Contingency Readiness Playbooks */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F172A]">
              Drought Scarcity & Heavy-Rain Contingency Playbook
            </h2>
            <p className="text-xs text-[#64748B]">
              Check off field readiness actions for {activeFarmName}; progress saves directly to your farm profile.
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-semibold text-[#15803D]">
            {completedCount}/{decision.contingencyActions.length} actions ready
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Column 1: Water Scarcity Mitigation */}
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#B45309]">
              <Droplets className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Water Scarcity & Rain-Pipe Optimization</span>
            </div>
            <div className="divide-y divide-[#F1F5F9] border-t border-[#E2E8F0]">
              {scarcityChecklist.map((item) => {
                const done = irrigationPlan.completedContingencyIds.includes(
                  item.id
                );
                return (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="mt-0.5 h-4 w-4 accent-[#15803D] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            done
                              ? 'line-through text-[#64748B]'
                              : 'text-[#0F172A]'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          · {item.targetTiming}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#475569]">{item.detail}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Column 2: Flood, Heavy Rain & ENSO Adversity Readiness */}
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#DC2626]">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Flood, Excess Rain & ENSO Contingency</span>
            </div>
            <div className="divide-y divide-[#F1F5F9] border-t border-[#E2E8F0]">
              {floodAndEnsoChecklist.map((item) => {
                const done = irrigationPlan.completedContingencyIds.includes(
                  item.id
                );
                return (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 py-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="mt-0.5 h-4 w-4 accent-[#15803D] cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            done
                              ? 'line-through text-[#64748B]'
                              : 'text-[#0F172A]'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-[11px] font-medium text-[#64748B]">
                          · {item.targetTiming}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#475569]">{item.detail}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
