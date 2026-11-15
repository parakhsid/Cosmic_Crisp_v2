import {Layers, SlidersHorizontal} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {cropLabel, t} from '../i18n/translations';
import {predictNextCropsApi} from '../lib/apiClient';
import {predictNextCrops} from '../lib/statisticalModel';
import {
  formatNitrogenDelta,
  formatSoilDepth,
  tHaToTonsAc,
  type UnitSystem,
} from '../lib/units';
import type {
  CropPrediction,
  EquipmentId,
  FarmInsightBundle,
  LaborAvailability,
  LanguageCode,
  SlopeClass,
  WaterAvailability,
  YieldSensitivity,
} from '../types/agronomy';
import {
  RainfallAnomalyChart,
  RootWetnessChart,
  SoilHealthProfileChart,
} from './Charts';
import {CircularGauge, ResilientPhoto, VISUAL_ASSETS} from './VisualAssets';

interface ClimateAnalyticsViewProps {
  lang: LanguageCode;
  unit: UnitSystem;
  bundle: FarmInsightBundle | null;
  activeFarmId: string;
  isOfflineActive: boolean;
  currentCropId: string;
  harvestMonth: number;
  waterAvailability: WaterAvailability;
  laborAvailability: LaborAvailability;
  slopeClass: SlopeClass;
  ownedEquipment: EquipmentId[];
  prioritizeOwnedEquipment: boolean;
  recentHistoryCropIds: string[];
  baselinePredictions: CropPrediction[];
  sensitivity: YieldSensitivity;
  onChangeSensitivity: (next: YieldSensitivity) => void;
}

export function ClimateAnalyticsView({
  lang,
  unit,
  bundle,
  activeFarmId,
  isOfflineActive,
  currentCropId,
  harvestMonth,
  waterAvailability,
  laborAvailability,
  slopeClass,
  ownedEquipment,
  prioritizeOwnedEquipment,
  recentHistoryCropIds,
  baselinePredictions,
  sensitivity,
  onChangeSensitivity,
}: ClimateAnalyticsViewProps) {
  const localSimulated = useMemo(() => {
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
      sensitivity,
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
    sensitivity,
  ]);

  const [serverSimulated, setServerSimulated] = useState<CropPrediction[] | null>(
    null
  );

  useEffect(() => {
    if (!bundle || isOfflineActive) {
      setServerSimulated(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
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
          sensitivity,
        });
        if (!cancelled) setServerSimulated(res.predictions);
      } catch {
        if (!cancelled) setServerSimulated(null);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    bundle,
    activeFarmId,
    isOfflineActive,
    currentCropId,
    harvestMonth,
    waterAvailability,
    laborAvailability,
    slopeClass,
    ownedEquipment,
    prioritizeOwnedEquipment,
    recentHistoryCropIds,
    sensitivity,
  ]);

  const simulatedPredictions = serverSimulated ?? localSimulated;

  if (!bundle) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#475569]">
        Loading satellite climate and soil health analytics...
      </div>
    );
  }

  const topThreeBase = baselinePredictions.slice(0, 3);

  const phStatus =
    bundle.soil.ph < 6.0
      ? t(lang, 'soil_status_acidic')
      : bundle.soil.ph > 7.3
      ? t(lang, 'soil_status_alkaline')
      : t(lang, 'soil_status_optimal');

  const socStatus =
    bundle.soil.socGKg >= 20
      ? t(lang, 'soil_status_rich')
      : bundle.soil.socGKg >= 12
      ? t(lang, 'soil_status_moderate')
      : t(lang, 'soil_status_low');

  const nitrogenStatus =
    bundle.soil.nitrogenGKg >= 1.8
      ? t(lang, 'soil_status_rich')
      : bundle.soil.nitrogenGKg >= 1.1
      ? t(lang, 'soil_status_moderate')
      : t(lang, 'soil_status_low');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#0F172A] text-balance">
          {t(lang, 'climate_title')}
        </h1>
        <p className="mt-1 text-sm text-[#475569]">{t(lang, 'climate_subtitle')}</p>
      </div>

      {/* Detailed Soil Health Breakdown View with Soil Photography & Visual Gauges */}
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-center border-b border-[#E2E8F0] pb-6">
          <div className="lg:col-span-4">
            <ResilientPhoto
              src={VISUAL_ASSETS.soilHealth}
              alt={t(lang, 'soil_health_title')}
              className="h-44 w-full rounded-lg border border-[#E2E8F0]"
            />
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-[#0F172A]">
                  {t(lang, 'soil_health_title')}
                </h2>
              </div>
              <p className="mt-1 text-sm text-[#475569]">
                {t(lang, 'soil_health_subtitle')}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-1">
              <CircularGauge
                value={bundle.soil.ph ?? 6.5}
                max={14}
                displayValue={(bundle.soil.ph ?? 6.5).toFixed(1)}
                label={t(lang, 'metric_soil_ph')}
                sublabel={phStatus}
                color="#15803D"
              />
              <CircularGauge
                value={bundle.soil.socGKg ?? 15}
                max={45}
                displayValue={`${bundle.soil.socGKg ?? 15}`}
                label={`${t(lang, 'metric_organic_carbon')} (g/kg)`}
                sublabel={socStatus}
                color="#92400E"
              />
              <CircularGauge
                value={bundle.soil.nitrogenGKg ?? 1.4}
                max={4}
                displayValue={`${(bundle.soil.nitrogenGKg ?? 1.4).toFixed(2)}`}
                label={`${t(lang, 'metric_soil_nitrogen')} (g/kg)`}
                sublabel={nitrogenStatus}
                color="#0284C7"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <SoilHealthProfileChart soil={bundle.soil} lang={lang} unit={unit} />
        </div>
      </section>

      {/* Climate Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {t(lang, 'anomaly_chart_title')}
            </h2>
            <span className="font-mono-tabular text-xs text-[#64748B]">
              NASA POWER 2021–2025
            </span>
          </div>
          <RainfallAnomalyChart data={bundle.yearlyAnomalies} />
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {t(lang, 'wetness_chart_title')}
            </h2>
            <span className="font-mono-tabular text-xs text-[#64748B]">
              {unit === 'imperial' ? 'GWETROOT (0–39 in)' : 'GWETROOT (0–100 cm)'}
            </span>
          </div>
          <RootWetnessChart data={bundle.monthlyClimate} />
        </div>
      </div>

      {/* Predictive Yield Sensitivity Simulator & SoilGrids Depth Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              className="h-4 w-4 text-[#15803D]"
              aria-hidden="true"
            />
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {t(lang, 'sim_title')}
            </h2>
          </div>
          <p className="mt-1 text-sm text-[#475569]">{t(lang, 'sim_subtitle')}</p>

          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#334155]">
                <label htmlFor="sim-rain-slider">{t(lang, 'sim_rain_label')}</label>
                <span className="font-mono-tabular text-sm text-[#0F172A]">
                  {sensitivity.rainfallDeltaPct > 0
                    ? `+${sensitivity.rainfallDeltaPct}%`
                    : `${sensitivity.rainfallDeltaPct}%`}
                </span>
              </div>
              <input
                id="sim-rain-slider"
                type="range"
                min={-30}
                max={30}
                step={5}
                value={sensitivity.rainfallDeltaPct}
                onChange={(e) =>
                  onChangeSensitivity({
                    ...sensitivity,
                    rainfallDeltaPct: Number(e.target.value),
                  })
                }
                className="mt-2 w-full accent-[#15803D] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#334155]">
                <label htmlFor="sim-n-slider">
                  {unit === 'imperial'
                    ? 'Nitrogen Adjustment (lb/ac)'
                    : t(lang, 'sim_n_label')}
                </label>
                <span className="font-mono-tabular text-sm text-[#0F172A]">
                  {formatNitrogenDelta(sensitivity.nitrogenBoostKgHa, unit)}
                </span>
              </div>
              <input
                id="sim-n-slider"
                type="range"
                min={-40}
                max={80}
                step={10}
                value={sensitivity.nitrogenBoostKgHa}
                onChange={(e) =>
                  onChangeSensitivity({
                    ...sensitivity,
                    nitrogenBoostKgHa: Number(e.target.value),
                  })
                }
                className="mt-2 w-full accent-[#15803D] cursor-pointer"
              />
            </div>

            <label className="flex min-h-[44px] items-center gap-3 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={sensitivity.conservationTillage}
                onChange={(e) =>
                  onChangeSensitivity({
                    ...sensitivity,
                    conservationTillage: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-[#15803D]"
              />
              <span className="text-sm font-medium text-[#0F172A]">
                {t(lang, 'sim_tillage_label')}
              </span>
            </label>
          </div>

          <div className="mt-5 border-t border-[#E2E8F0] pt-4">
            <div className="grid grid-cols-3 text-xs font-semibold text-[#64748B] pb-2">
              <span>Crop</span>
              <span className="text-right">{t(lang, 'sim_baseline')}</span>
              <span className="text-right">{t(lang, 'sim_simulated')}</span>
            </div>
            <div className="divide-y divide-[#E2E8F0]">
              {topThreeBase.map((base) => {
                const sim =
                  simulatedPredictions.find((s) => s.cropId === base.cropId) ?? base;
                const baseVal =
                  unit === 'imperial'
                    ? tHaToTonsAc(base.expectedYieldTHa)
                    : base.expectedYieldTHa;
                const simVal =
                  unit === 'imperial'
                    ? tHaToTonsAc(sim.expectedYieldTHa)
                    : sim.expectedYieldTHa;
                const diff = Number((simVal - baseVal).toFixed(2));
                const unitSuffix = unit === 'imperial' ? 't/ac' : 't/ha';
                return (
                  <div
                    key={base.cropId}
                    className="grid grid-cols-3 items-center py-2.5 text-sm"
                  >
                    <span className="font-semibold text-[#0F172A]">
                      {cropLabel(lang, base.cropId)}
                    </span>
                    <span className="text-right font-mono-tabular text-[#475569]">
                      {baseVal.toFixed(2)} {unitSuffix}
                    </span>
                    <span className="text-right font-mono-tabular font-bold text-[#0F172A]">
                      {simVal.toFixed(2)} {unitSuffix}{' '}
                      <span
                        className={`text-xs ${
                          diff > 0
                            ? 'text-[#15803D]'
                            : diff < 0
                            ? 'text-[#DC2626]'
                            : 'text-[#64748B]'
                        }`}
                      >
                        ({diff > 0 ? `+${diff}` : diff})
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* SoilGrids Depth Table with Nitrogen */}
        <div className="lg:col-span-6 rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-base font-bold text-[#0F172A]">
              {t(lang, 'soil_table_title')}
            </h2>
            <span className="font-mono-tabular text-xs text-[#64748B]">
              {bundle.soil.textureClass}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs font-semibold text-[#475569]">
                  <th className="py-2.5 pr-2">{t(lang, 'col_depth')}</th>
                  <th className="py-2.5 px-2 text-right">{t(lang, 'col_ph')}</th>
                  <th className="py-2.5 px-2 text-right">{t(lang, 'col_soc')}</th>
                  <th className="py-2.5 px-2 text-right">{t(lang, 'col_nitrogen')}</th>
                  <th className="py-2.5 px-2 text-right">{t(lang, 'col_clay')}</th>
                  <th className="py-2.5 pl-2 text-right">{t(lang, 'col_sand')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {bundle.soil.layers.map((layer) => (
                  <tr key={layer.depth} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 pr-2 font-medium text-[#0F172A] whitespace-nowrap">
                      {formatSoilDepth(layer.depth, unit)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono-tabular text-[#0F172A]">
                      {layer.ph.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono-tabular text-[#0F172A]">
                      {layer.socGKg.toFixed(1)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono-tabular font-semibold text-[#0284C7]">
                      {layer.nitrogenGKg.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono-tabular text-[#0F172A]">
                      {layer.clayPct}%
                    </td>
                    <td className="py-3 pl-2 text-right font-mono-tabular text-[#0F172A]">
                      {layer.sandPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
