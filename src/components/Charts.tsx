import {
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Flame,
  Snowflake,
  Sun,
  Wind,
  Wrench,
} from 'lucide-react';
import {useState} from 'react';
import {cropLabel, equipmentLabel, t} from '../i18n/translations';
import {
  convertPrecip,
  convertTemp,
  formatMarginPerArea,
  formatPrecip,
  formatSoilDepth,
  formatTemp,
  formatWind,
  precipUnitLabel,
  tempUnitLabel,
  type UnitSystem,
} from '../lib/units';
import type {
  CropPrediction,
  CurrentWeatherSnapshot,
  DailyForecastPoint,
  LanguageCode,
  MonthlyClimatePoint,
  SoilProfile,
  YearlyAnomalyPoint,
} from '../types/agronomy';
import {
  getCropFallbackPhoto,
  getCropPhoto,
  ResilientPhoto,
} from './VisualAssets';

interface CandidateChartProps {
  predictions: CropPrediction[];
  lang: LanguageCode;
  unit?: UnitSystem;
  selectedCropId: string;
  onSelectCandidate: (cropId: string) => void;
}

export function CandidateComparisonChart({
  predictions,
  lang,
  unit = 'imperial',
  selectedCropId,
  onSelectCandidate,
}: CandidateChartProps) {
  const topFour = predictions.slice(0, 4);

  return (
    <div className="space-y-2.5">
      {topFour.map((item, idx) => {
        const isSelected = item.cropId === selectedCropId;
        const barColor =
          idx === 0
            ? 'bg-[#15803D]'
            : idx === 1
            ? 'bg-[#16A34A]'
            : 'bg-[#64748B]';
        const isReady = item.missingEquipment.length === 0;
        const clampedScore = Math.max(0, Math.min(100, item.score));
        const yieldLabel =
          unit === 'imperial'
            ? `${item.expectedYieldBuAc} bu/ac`
            : `${item.expectedYieldTHa.toFixed(1)} t/ha`;

        return (
          <button
            key={item.cropId}
            type="button"
            onClick={() => onSelectCandidate(item.cropId)}
            className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
              isSelected
                ? 'border-[#15803D] bg-[#F0FDF4]'
                : 'border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white'
            }`}
          >
            <ResilientPhoto
              src={getCropPhoto(item.cropId)}
              fallbackSrc={getCropFallbackPhoto(item.cropId)}
              alt={cropLabel(lang, item.cropId)}
              className="h-14 w-16 shrink-0 rounded-md border border-[#E2E8F0]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-[#0F172A] truncate">
                  {idx + 1}. {cropLabel(lang, item.cropId)}
                </span>
                <span className="font-mono-tabular text-xs font-bold text-[#0F172A] shrink-0">
                  {item.score}/100
                </span>
              </div>

              {/* Consistent 0–100 score bar without minimum-width distortion */}
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-[#E2E8F0]">
                <div
                  className={`h-full transition-all duration-200 ${barColor}`}
                  style={{width: `${clampedScore}%`}}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#475569]">
                <span className="font-mono-tabular font-semibold text-[#0F172A]">
                  {yieldLabel} · {formatMarginPerArea(item.estNetMarginUsdHa, unit)}{' '}
                  · ROI {item.roiPct}%
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-medium shrink-0 ${
                    isReady ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}
                >
                  {isReady ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Wrench className="h-3 w-3" aria-hidden="true" />
                  )}
                  {isReady
                    ? t(lang, 'equipment_owned_tag')
                    : `${item.missingEquipment.length} ${t(
                        lang,
                        'equipment_missing_tag'
                      )}`}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getWmoCondition(
  code?: number,
  tempMinC?: number,
  tempMaxC?: number,
  precipMm?: number
) {
  if (typeof code === 'number' && Number.isFinite(code)) {
    if (code === 0) return {label: 'Clear', icon: Sun, color: 'text-[#D97706]'};
    if (code === 1 || code === 2)
      return {label: 'Partly Cloudy', icon: CloudSun, color: 'text-[#D97706]'};
    if (code === 3) return {label: 'Overcast', icon: Cloud, color: 'text-[#64748B]'};
    if (code === 45 || code === 48)
      return {label: 'Fog', icon: CloudFog, color: 'text-[#64748B]'};
    if (code >= 51 && code <= 57)
      return {label: 'Drizzle', icon: CloudDrizzle, color: 'text-[#0284C7]'};
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
      return {
        label: code === 65 || code === 82 ? 'Heavy Rain' : 'Rain',
        icon: CloudRain,
        color: 'text-[#0284C7]',
      };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86)
      return {label: 'Snow', icon: Snowflake, color: 'text-[#0284C7]'};
    if (code >= 95)
      return {label: 'T-Storm', icon: CloudLightning, color: 'text-[#4F46E5]'};
  }
  if ((tempMinC ?? 10) <= 1 && (precipMm ?? 0) > 0)
    return {label: 'Snow', icon: Snowflake, color: 'text-[#0284C7]'};
  if ((tempMaxC ?? 20) >= 34 && (precipMm ?? 0) < 2)
    return {label: 'Hot & Clear', icon: Flame, color: 'text-[#DC2626]'};
  if ((precipMm ?? 0) >= 6)
    return {label: 'Rain', icon: CloudRain, color: 'text-[#0284C7]'};
  return {label: 'Clear', icon: Sun, color: 'text-[#D97706]'};
}

// Consistent 0–50 mm (~2 in) daily rainfall gauge across all places on Earth
const DAILY_RAIN_SCALE_MM = 50;

export function Forecast16DayStrip({
  forecast,
  currentWeather,
  unit = 'imperial',
}: {
  forecast: DailyForecastPoint[];
  currentWeather?: CurrentWeatherSnapshot;
  unit?: UnitSystem;
}) {
  const days = forecast.slice(0, 10);
  const currentCond = currentWeather
    ? getWmoCondition(
        currentWeather.weatherCode,
        currentWeather.tempC,
        currentWeather.tempC,
        currentWeather.precipMm
      )
    : null;
  const CurrentIcon = currentCond?.icon ?? Sun;

  return (
    <div className="space-y-3">
      {currentWeather && currentCond && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2.5">
            <CurrentIcon
              className={`h-5 w-5 shrink-0 ${currentCond.color}`}
              aria-hidden="true"
            />
            <div>
              <span className="font-mono-tabular text-sm font-bold text-[#0F172A]">
                {formatTemp(currentWeather.tempC, unit, 1)}
              </span>
              <span className="ml-2 font-semibold text-[#334155]">
                {currentCond.label}
              </span>
              <span className="ml-2 text-[#64748B]">
                Feels {formatTemp(currentWeather.apparentTempC, unit, 1)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono-tabular text-[#475569]">
            <span className="inline-flex items-center gap-1">
              <Droplets className="h-3.5 w-3.5 text-[#0284C7]" aria-hidden="true" />
              {currentWeather.humidityPct}% RH
            </span>
            <span className="inline-flex items-center gap-1">
              <Wind className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
              {formatWind(currentWeather.windKmh, unit)}
            </span>
            <span>{formatPrecip(currentWeather.precipMm, unit)} now</span>
            <span className="text-[#64748B]">{currentWeather.timezone}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-10">
        {days.map((d, idx) => {
          const dt = new Date(`${d.date}T12:00:00`);
          const dayName =
            idx === 0
              ? 'Today'
              : dt.toLocaleDateString(undefined, {weekday: 'short'});
          const dateLabel = dt.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });
          const cond = getWmoCondition(
            d.weatherCode,
            d.tempMinC,
            d.tempMaxC,
            d.precipMm
          );
          const IconComp = cond.icon;
          const isFrost = d.tempMinC <= 1;
          const isHeat = d.tempMaxC >= 35;
          const rainPct = Number.isFinite(d.precipProbPct)
            ? d.precipProbPct
            : d.precipMm > 0
            ? 60
            : 10;
          const precipVal = Number.isFinite(d.precipMm) ? Math.max(0, d.precipMm) : 0;
          const rainBarPct = Math.min(100, (precipVal / DAILY_RAIN_SCALE_MM) * 100);

          return (
            <div
              key={d.date}
              className={`flex flex-col justify-between rounded-lg border px-2 py-2.5 text-center ${
                idx === 0
                  ? 'border-[#15803D]/40 bg-[#F0FDF4]/60'
                  : 'border-[#E2E8F0] bg-[#F8FAFC]'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-[#0F172A]">
                  {dayName}
                </div>
                <div className="text-[10px] text-[#64748B]">{dateLabel}</div>
              </div>

              <div className="my-2 flex flex-col items-center gap-1">
                <IconComp
                  className={`h-5 w-5 ${
                    isFrost
                      ? 'text-[#0284C7]'
                      : isHeat
                      ? 'text-[#DC2626]'
                      : cond.color
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[10px] font-medium text-[#475569] leading-tight truncate max-w-full">
                  {cond.label}
                </span>
              </div>

              <div>
                <div className="font-mono-tabular text-xs font-bold text-[#0F172A]">
                  {Math.round(convertTemp(d.tempMaxC, unit))}°
                  <span className="font-normal text-[#64748B]">
                    /{Math.round(convertTemp(d.tempMinC, unit))}°
                  </span>
                </div>

                <div className="mt-1.5 w-full">
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]"
                    title={`Scale: 0–${formatPrecip(DAILY_RAIN_SCALE_MM, unit, 0, 1)}`}
                  >
                    <div
                      className="h-full bg-[#0284C7]"
                      style={{width: `${rainBarPct}%`}}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono-tabular text-[10px] text-[#475569]">
                    <span>{formatPrecip(precipVal, unit, 1, 2)}</span>
                    <span className="text-[#0284C7]">{rainPct}%</span>
                  </div>
                </div>

                <div className="mt-1 border-t border-[#E2E8F0] pt-1 font-mono-tabular text-[9px] text-[#64748B] flex items-center justify-between">
                  <span>{formatWind(d.windMaxKmh ?? 10, unit)}</span>
                  <span>
                    ET₀ {convertPrecip(d.et0Mm, unit).toFixed(unit === 'imperial' ? 2 : 1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SoilHealthProfileChart({
  soil,
  lang,
  unit = 'imperial',
}: {
  soil: SoilProfile;
  lang: LanguageCode;
  unit?: UnitSystem;
}) {
  // Consistent 0-based scales on multiples of 5/10 without distorting low bars
  const rawMaxSoc = Math.max(...soil.layers.map((l) => l.socGKg ?? 15));
  const maxSoc = Math.max(50, Math.ceil(rawMaxSoc / 10) * 10);
  const rawMaxN = Math.max(...soil.layers.map((l) => l.nitrogenGKg ?? 1.4));
  const maxNitrogen = Math.max(5.0, Math.ceil(rawMaxN));

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Soil Organic Carbon */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#334155]">
            {t(lang, 'metric_organic_carbon')}
          </span>
          <span className="font-mono-tabular text-xs font-semibold text-[#15803D]">
            {soil.socGKg} g/kg
          </span>
        </div>
        <div className="space-y-2.5">
          {soil.layers.map((layer) => {
            const pct = Math.min(100, Math.max(0, (layer.socGKg / maxSoc) * 100));
            return (
              <div key={`soc-${layer.depth}`}>
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>{formatSoilDepth(layer.depth, unit)}</span>
                  <span className="font-mono-tabular font-semibold text-[#0F172A]">
                    {layer.socGKg.toFixed(1)} g/kg
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-sm bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-sm bg-[#15803D]"
                    style={{width: `${pct}%`}}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between font-mono-tabular text-[10px] text-[#64748B]">
          <span>0</span>
          <span>{maxSoc / 2}</span>
          <span>{maxSoc} g/kg</span>
        </div>
      </div>

      {/* Soil pH with Optimal Band (Consistent 4.0–9.0 scale) */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#334155]">
            {t(lang, 'metric_soil_ph')} (H2O)
          </span>
          <span className="font-mono-tabular text-xs font-semibold text-[#0F172A]">
            {soil.ph.toFixed(1)} pH
          </span>
        </div>
        <div className="space-y-2.5">
          {soil.layers.map((layer) => {
            const posPct = Math.min(
              100,
              Math.max(0, ((layer.ph - 4.0) / 5.0) * 100)
            );
            const isOptimal = layer.ph >= 6.0 && layer.ph <= 7.2;
            return (
              <div key={`ph-${layer.depth}`}>
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>{formatSoilDepth(layer.depth, unit)}</span>
                  <span className="font-mono-tabular font-semibold text-[#0F172A]">
                    {layer.ph.toFixed(1)}
                  </span>
                </div>
                <div className="relative mt-1 h-2.5 w-full rounded-sm bg-[#E2E8F0]">
                  <div
                    className="absolute inset-y-0 bg-[#15803D]/25"
                    style={{left: '40%', width: '24%'}}
                    title="Optimal 6.0–7.2 pH"
                  />
                  <div
                    className={`absolute top-1/2 h-3.5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-xs ${
                      isOptimal ? 'bg-[#15803D]' : 'bg-[#D97706]'
                    }`}
                    style={{left: `${posPct}%`}}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between font-mono-tabular text-[10px] text-[#64748B]">
          <span>4.0 Acid</span>
          <span className="text-[#15803D] font-semibold">6.0–7.2 Optimal</span>
          <span>9.0 Alk</span>
        </div>
      </div>

      {/* Total Soil Nitrogen */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#334155]">
            {t(lang, 'metric_soil_nitrogen')}
          </span>
          <span className="font-mono-tabular text-xs font-semibold text-[#0284C7]">
            {(soil.nitrogenGKg ?? 1.4).toFixed(2)} g/kg
          </span>
        </div>
        <div className="space-y-2.5">
          {soil.layers.map((layer) => {
            const pct = Math.min(
              100,
              Math.max(0, ((layer.nitrogenGKg ?? 1.4) / maxNitrogen) * 100)
            );
            return (
              <div key={`n-${layer.depth}`}>
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>{formatSoilDepth(layer.depth, unit)}</span>
                  <span className="font-mono-tabular font-semibold text-[#0F172A]">
                    {(layer.nitrogenGKg ?? 1.4).toFixed(2)} g/kg
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-sm bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-sm bg-[#0284C7]"
                    style={{width: `${pct}%`}}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between font-mono-tabular text-[10px] text-[#64748B]">
          <span>0</span>
          <span>{(maxNitrogen / 2).toFixed(1)}</span>
          <span>{maxNitrogen.toFixed(1)} g/kg</span>
        </div>
      </div>

      {/* Mineral Texture Composition Strip */}
      <div className="md:col-span-3 border-t border-[#E2E8F0] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
          <span className="font-bold text-[#0F172A]">
            {t(lang, 'metric_soil_texture')}: {soil.textureClass}
          </span>
          <span className="font-mono-tabular text-[#475569]">
            {t(lang, 'col_clay')} {soil.clayPct}% · {t(lang, 'col_silt')}{' '}
            {soil.siltPct}% · {t(lang, 'col_sand')} {soil.sandPct}%
          </span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-sm">
          <div
            className="bg-[#92400E]"
            style={{width: `${soil.clayPct}%`}}
            title={`Clay ${soil.clayPct}%`}
          />
          <div
            className="bg-[#D97706]"
            style={{width: `${soil.siltPct}%`}}
            title={`Silt ${soil.siltPct}%`}
          />
          <div
            className="bg-[#FDE68A]"
            style={{width: `${soil.sandPct}%`}}
            title={`Sand ${soil.sandPct}%`}
          />
        </div>
      </div>
    </div>
  );
}

interface MonthlyClimateChartProps {
  data: MonthlyClimatePoint[];
  lang: LanguageCode;
  unit?: UnitSystem;
}

export function MonthlyClimateChart({
  data,
  lang,
  unit = 'imperial',
}: MonthlyClimateChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const precips = data.map((d) => convertPrecip(d.precipMm, unit));
  const temps = data.map((d) => convertTemp(d.tempC, unit));

  // Consistent zero-based precipitation ceiling & multiple-of-5 temperature domain
  const maxPrecip =
    unit === 'imperial'
      ? Math.max(12, Math.ceil(Math.max(0, ...precips) / 4) * 4)
      : Math.max(300, Math.ceil(Math.max(0, ...precips) / 100) * 100);

  const minTemp =
    unit === 'imperial'
      ? Math.min(0, Math.floor(Math.min(0, ...temps) / 10) * 10)
      : Math.min(-15, Math.floor(Math.min(-15, ...temps) / 5) * 5);
  const maxTemp =
    unit === 'imperial'
      ? Math.max(120, Math.ceil(Math.max(120, ...temps) / 10) * 10)
      : Math.max(45, Math.ceil(Math.max(45, ...temps) / 5) * 5);

  const width = 640;
  const height = 215;
  const padL = 44;
  const padR = 44;
  const padT = 18;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yPrecip = (p: number) =>
    padT + innerH - (Math.max(0, p) / Math.max(1, maxPrecip)) * innerH;
  const yTemp = (temp: number) =>
    padT + innerH - ((temp - minTemp) / Math.max(1, maxTemp - minTemp)) * innerH;
  const xCenter = (i: number) => padL + ((i + 0.5) / data.length) * innerW;

  const linePoints = data
    .map(
      (d, i) =>
        `${xCenter(i).toFixed(1)},${yTemp(convertTemp(d.tempC, unit)).toFixed(1)}`
    )
    .join(' ');

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;
  const precipUnit = precipUnitLabel(unit);
  const tempUnit = tempUnitLabel(unit);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#15803D]" />
            Precipitation ({precipUnit})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#D97706]" />
            Temperature ({tempUnit})
          </span>
        </div>
        {hovered && (
          <span className="font-mono-tabular font-semibold text-[#0F172A]">
            {hovered.monthLabel}: {formatPrecip(hovered.precipMm, unit, 0, 2)} ·{' '}
            {formatTemp(hovered.tempC, unit, 1)} ·{' '}
            {hovered.relativeHumidityPct ?? 64}% RH · {hovered.rootWetnessPct}% soil
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={t(lang, 'monthly_chart_title')}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padT + innerH * (1 - ratio);
          const pVal = maxPrecip * ratio;
          const pLabel =
            unit === 'imperial' ? `${pVal.toFixed(0)} in` : `${Math.round(pVal)}`;
          const tVal = Math.round(minTemp + (maxTemp - minTemp) * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke={ratio === 0 ? '#CBD5E1' : '#E2E8F0'}
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-[#64748B] font-mono text-[10px]"
              >
                {pLabel}
              </text>
              <text
                x={width - padR + 6}
                y={y + 4}
                textAnchor="start"
                className="fill-[#B45309] font-mono text-[10px]"
              >
                {tVal}°
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const barW = (innerW / data.length) * 0.56;
          const x = xCenter(i) - barW / 2;
          const pVal = convertPrecip(d.precipMm, unit);
          const y = yPrecip(pVal);
          const barH = Math.max(0, padT + innerH - y);
          const isHover = hoveredIdx === i;
          return (
            <g
              key={d.monthLabel}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx="2"
                fill={isHover ? '#166534' : '#15803D'}
                fillOpacity={isHover ? 0.95 : 0.82}
              />
              <text
                x={xCenter(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-[#475569] text-[10px] font-medium"
              >
                {d.monthLabel}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="#D97706"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />
        {data.map((d, i) => (
          <circle
            key={`pt-${d.monthLabel}`}
            cx={xCenter(i)}
            cy={yTemp(convertTemp(d.tempC, unit))}
            r={hoveredIdx === i ? 4.5 : 3}
            fill="#FFFFFF"
            stroke="#D97706"
            strokeWidth="2"
          />
        ))}
      </svg>
    </div>
  );
}

export function RainfallAnomalyChart({data}: {data: YearlyAnomalyPoint[]}) {
  const width = 520;
  const height = 190;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  // Consistent symmetrical ±50% domain in multiples of 25% (no dynamic distortion)
  const rawMaxAbs = Math.max(0, ...data.map((d) => Math.abs(d.anomalyPct)));
  const maxAbs = Math.max(50, Math.ceil(rawMaxAbs / 25) * 25);
  const zeroY = padT + innerH / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((val) => {
        const y = zeroY - (val / maxAbs) * (innerH / 2);
        return (
          <g key={val}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke={val === 0 ? '#94A3B8' : '#E2E8F0'}
              strokeWidth={val === 0 ? '1.5' : '1'}
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-[#64748B] font-mono text-[10px]"
            >
              {val > 0 ? `+${Math.round(val)}%` : `${Math.round(val)}%`}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const slotW = innerW / data.length;
        const barW = Math.min(44, slotW * 0.52);
        const cx = padL + (i + 0.5) * slotW;
        const barH = Math.max(0, (Math.abs(d.anomalyPct) / maxAbs) * (innerH / 2));
        const y = d.anomalyPct >= 0 ? zeroY - barH : zeroY;
        const fill = d.anomalyPct >= 0 ? '#15803D' : '#D97706';
        return (
          <g key={d.year}>
            <rect
              x={cx - barW / 2}
              y={y}
              width={barW}
              height={barH}
              rx="2"
              fill={fill}
            />
            <text
              x={cx}
              y={d.anomalyPct >= 0 ? y - 5 : y + barH + 12}
              textAnchor="middle"
              className="fill-[#0F172A] font-mono text-[10px] font-semibold"
            >
              {d.anomalyPct > 0 ? `+${d.anomalyPct}%` : `${d.anomalyPct}%`}
            </text>
            <text
              x={cx}
              y={height - 6}
              textAnchor="middle"
              className="fill-[#475569] font-mono text-[11px] font-medium"
            >
              {d.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RootWetnessChart({data}: {data: MonthlyClimatePoint[]}) {
  const width = 520;
  const height = 190;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const xPos = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yPos = (pct: number) =>
    padT + innerH - (Math.max(0, Math.min(100, pct)) / 100) * innerH;

  const line = data
    .map((d, i) => `${xPos(i).toFixed(1)},${yPos(d.rootWetnessPct).toFixed(1)}`)
    .join(' ');
  const area = `${padL},${padT + innerH} ${line} ${xPos(data.length - 1).toFixed(
    1
  )},${padT + innerH}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <rect
        x={padL}
        y={yPos(75)}
        width={innerW}
        height={yPos(45) - yPos(75)}
        fill="#15803D"
        fillOpacity="0.08"
      />
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            y1={yPos(v)}
            x2={width - padR}
            y2={yPos(v)}
            stroke={v === 0 ? '#CBD5E1' : '#E2E8F0'}
            strokeWidth="1"
          />
          <text
            x={padL - 6}
            y={yPos(v) + 3}
            textAnchor="end"
            className="fill-[#64748B] font-mono text-[10px]"
          >
            {v}%
          </text>
        </g>
      ))}

      <polygon points={area} fill="#0284C7" fillOpacity="0.16" />
      <polyline
        fill="none"
        stroke="#0284C7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={line}
      />

      {data.map((d, i) => (
        <g key={d.monthLabel}>
          <circle
            cx={xPos(i)}
            cy={yPos(d.rootWetnessPct)}
            r="3"
            fill="#FFFFFF"
            stroke="#0284C7"
            strokeWidth="2"
          />
          <text
            x={xPos(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-[#475569] text-[10px]"
          >
            {d.monthLabel}
          </text>
        </g>
      ))}
    </svg>
  );
}

// Keep equipmentLabel referenced cleanly
export {equipmentLabel};
