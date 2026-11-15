import {
  CheckCircle2,
  CloudRain,
  Flame,
  Snowflake,
  Sun,
  Wrench,
} from 'lucide-react';
import {useState} from 'react';
import {cropLabel, equipmentLabel, t} from '../i18n/translations';
import type {
  CropPrediction,
  DailyForecastPoint,
  LanguageCode,
  MonthlyClimatePoint,
  SoilProfile,
  YearlyAnomalyPoint,
} from '../types/agronomy';
import {getCropPhoto, ResilientPhoto} from './VisualAssets';

interface CandidateChartProps {
  predictions: CropPrediction[];
  lang: LanguageCode;
  selectedCropId: string;
  onSelectCandidate: (cropId: string) => void;
}

export function CandidateComparisonChart({
  predictions,
  lang,
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
              alt={cropLabel(lang, item.cropId)}
              className="h-14 w-16 shrink-0 rounded-md"
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

              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-[#E2E8F0]">
                <div
                  className={`h-full transition-all duration-200 ${barColor}`}
                  style={{width: `${Math.max(8, item.score)}%`}}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-[#475569]">
                <span className="font-mono-tabular font-semibold text-[#0F172A]">
                  {item.expectedYieldTHa.toFixed(1)} t/ha ·{' '}
                  {item.estNetMarginUsdHa >= 0
                    ? `+$${item.estNetMarginUsdHa}`
                    : `-$${Math.abs(item.estNetMarginUsdHa)}`}
                  /ha · ROI {item.roiPct}%
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

export function Forecast16DayStrip({forecast}: {forecast: DailyForecastPoint[]}) {
  const days = forecast.slice(0, 8);
  const maxRain = Math.max(25, ...days.map((d) => d.precipMm));

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {days.map((d) => {
        const dt = new Date(`${d.date}T12:00:00`);
        const dayName = dt.toLocaleDateString(undefined, {weekday: 'short'});
        const isFrost = d.tempMinC <= 2;
        const isHeat = d.tempMaxC >= 34;
        const isRain = d.precipMm >= 8;

        return (
          <div
            key={d.date}
            className="flex flex-col items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-2.5 text-center"
          >
            <span className="text-[11px] font-semibold text-[#475569]">
              {dayName}
            </span>
            <div className="my-1.5">
              {isFrost ? (
                <Snowflake className="h-5 w-5 text-[#0284C7]" aria-hidden="true" />
              ) : isHeat ? (
                <Flame className="h-5 w-5 text-[#DC2626]" aria-hidden="true" />
              ) : isRain ? (
                <CloudRain className="h-5 w-5 text-[#0284C7]" aria-hidden="true" />
              ) : (
                <Sun className="h-5 w-5 text-[#D97706]" aria-hidden="true" />
              )}
            </div>
            <div className="font-mono-tabular text-xs font-bold text-[#0F172A]">
              {Math.round(d.tempMaxC)}°
              <span className="font-normal text-[#64748B]">
                /{Math.round(d.tempMinC)}°
              </span>
            </div>
            <div className="mt-1.5 w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                <div
                  className="h-full bg-[#0284C7]"
                  style={{width: `${Math.min(100, (d.precipMm / maxRain) * 100)}%`}}
                />
              </div>
              <span className="mt-0.5 block font-mono-tabular text-[10px] text-[#64748B]">
                {Math.round(d.precipMm)}mm
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SoilHealthProfileChart({
  soil,
  lang,
}: {
  soil: SoilProfile;
  lang: LanguageCode;
}) {
  const maxSoc = Math.max(40, ...soil.layers.map((l) => l.socGKg ?? 15));
  const maxNitrogen = Math.max(3.5, ...soil.layers.map((l) => l.nitrogenGKg ?? 1.4));

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
            const pct = Math.min(100, Math.round((layer.socGKg / maxSoc) * 100));
            return (
              <div key={`soc-${layer.depth}`}>
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>{layer.depth}</span>
                  <span className="font-mono-tabular font-semibold text-[#0F172A]">
                    {layer.socGKg.toFixed(1)} g/kg
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-sm bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-sm bg-[#15803D]"
                    style={{width: `${Math.max(6, pct)}%`}}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Soil pH with Optimal Band */}
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
              96,
              Math.max(4, Math.round(((layer.ph - 4.0) / 5.0) * 100))
            );
            const isOptimal = layer.ph >= 6.0 && layer.ph <= 7.2;
            return (
              <div key={`ph-${layer.depth}`}>
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>{layer.depth}</span>
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
              Math.round(((layer.nitrogenGKg ?? 1.4) / maxNitrogen) * 100)
            );
            return (
              <div key={`n-${layer.depth}`}>
                <div className="flex justify-between text-xs text-[#475569]">
                  <span>{layer.depth}</span>
                  <span className="font-mono-tabular font-semibold text-[#0F172A]">
                    {(layer.nitrogenGKg ?? 1.4).toFixed(2)} g/kg
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full rounded-sm bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-sm bg-[#0284C7]"
                    style={{width: `${Math.max(6, pct)}%`}}
                  />
                </div>
              </div>
            );
          })}
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
}

export function MonthlyClimateChart({data, lang}: MonthlyClimateChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxPrecip = Math.max(120, ...data.map((d) => d.precipMm)) * 1.15;
  const temps = data.map((d) => d.tempC);
  const minTemp = Math.min(-5, ...temps) - 3;
  const maxTemp = Math.max(35, ...temps) + 3;

  const width = 640;
  const height = 210;
  const padL = 42;
  const padR = 42;
  const padT = 18;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const yPrecip = (p: number) => padT + innerH - (p / maxPrecip) * innerH;
  const yTemp = (temp: number) =>
    padT + innerH - ((temp - minTemp) / Math.max(1, maxTemp - minTemp)) * innerH;
  const xCenter = (i: number) => padL + ((i + 0.5) / data.length) * innerW;

  const linePoints = data
    .map((d, i) => `${xCenter(i).toFixed(1)},${yTemp(d.tempC).toFixed(1)}`)
    .join(' ');

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#15803D]" />
            {t(lang, 'precip_mm')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#D97706]" />
            {t(lang, 'temp_c')}
          </span>
        </div>
        {hovered && (
          <span className="font-mono-tabular font-semibold text-[#0F172A]">
            {hovered.monthLabel}: {hovered.precipMm} mm · {hovered.tempC}°C ·{' '}
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
          const pVal = Math.round(maxPrecip * ratio);
          const tVal = Math.round(minTemp + (maxTemp - minTemp) * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-[#64748B] font-mono text-[10px]"
              >
                {pVal}
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
          const y = yPrecip(d.precipMm);
          const barH = Math.max(2, padT + innerH - y);
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
            cy={yTemp(d.tempC)}
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
  const maxAbs = Math.max(30, ...data.map((d) => Math.abs(d.anomalyPct))) + 5;
  const zeroY = padT + innerH / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[-maxAbs, 0, maxAbs].map((val) => {
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
        const barH = (Math.abs(d.anomalyPct) / maxAbs) * (innerH / 2);
        const y = d.anomalyPct >= 0 ? zeroY - barH : zeroY;
        const fill = d.anomalyPct >= 0 ? '#15803D' : '#D97706';
        return (
          <g key={d.year}>
            <rect
              x={cx - barW / 2}
              y={y}
              width={barW}
              height={Math.max(3, barH)}
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
  const yPos = (pct: number) => padT + innerH - (pct / 100) * innerH;

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
      {[20, 40, 60, 80].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            y1={yPos(v)}
            x2={width - padR}
            y2={yPos(v)}
            stroke="#E2E8F0"
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
