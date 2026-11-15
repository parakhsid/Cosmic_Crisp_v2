import {useState} from 'react';
import {
  convertPrecip,
  formatIrrigationDepth,
  precipUnitLabel,
  type UnitSystem,
} from '../lib/units';
import type {MonthlyIrrigationBalance} from '../types/agronomy';

interface IrrigationChartProps {
  months: MonthlyIrrigationBalance[];
  unit: UnitSystem;
}

export function IrrigationChart({months, unit}: IrrigationChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!months.length) return null;

  const width = 680;
  const height = 240;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxDepthMm = Math.max(
    100,
    ...months.map((m) => Math.max(m.p90PrecipMm, m.cropEtcMm * 1.15))
  );

  const slotW = plotW / months.length;
  const barW = Math.min(22, slotW * 0.24);
  const yScale = (mm: number) =>
    padTop + plotH - (Math.max(0, mm) / maxDepthMm) * plotH;

  const hovered = hoveredIdx !== null ? months[hoveredIdx] : null;
  const unitLabel = precipUnitLabel(unit);

  return (
    <div>
      {/* Clean unboxed legend + active hover summary */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#0284C7]" />
            <span>Forecast Rain ({unitLabel})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#D97706]" />
            <span>Crop Water Demand ETc ({unitLabel})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-0.5 bg-[#64748B]" />
            <span>P10–P90 Ensemble Spread</span>
          </span>
        </div>

        {hovered && (
          <div className="font-mono-tabular text-xs font-semibold text-[#0F172A]">
            {hovered.monthLabel}: Rain {formatIrrigationDepth(hovered.forecastPrecipMm, unit)} · ETc{' '}
            {formatIrrigationDepth(hovered.cropEtcMm, unit)} ·{' '}
            {hovered.netBalanceMm >= 0
              ? `Surplus +${formatIrrigationDepth(hovered.netBalanceMm, unit)}`
              : `Deficit -${formatIrrigationDepth(Math.abs(hovered.netBalanceMm), unit)}`}
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="6-month seasonal rainfall versus crop evapotranspiration chart"
        className="w-full h-auto overflow-visible"
      >
        {/* Horizontal Y gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const valMm = maxDepthMm * frac;
          const y = yScale(valMm);
          const disp = convertPrecip(valMm, unit);
          const label =
            unit === 'imperial' ? disp.toFixed(1) : String(Math.round(disp));
          return (
            <g key={frac}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray={frac === 0 ? undefined : '3 3'}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-[#64748B] font-mono-tabular text-[10px]"
              >
                {label}
              </text>
            </g>
          );
        })}

        {months.map((m, idx) => {
          const cx = padLeft + idx * slotW + slotW / 2;
          const rainX = cx - barW - 2;
          const etcX = cx + 2;

          const yRain = yScale(m.forecastPrecipMm);
          const hRain = Math.max(2, yScale(0) - yRain);

          const yEtc = yScale(m.cropEtcMm);
          const hEtc = Math.max(2, yScale(0) - yEtc);

          const yP90 = yScale(m.p90PrecipMm);
          const yP10 = yScale(m.p10PrecipMm);
          const whiskerX = rainX + barW / 2;

          const isHovered = hoveredIdx === idx;
          const rainFill =
            m.floodRisk === 'high'
              ? '#DC2626'
              : m.floodRisk === 'moderate'
              ? '#0369A1'
              : '#0284C7';
          const etcFill =
            m.droughtRisk === 'high' ? '#B45309' : '#D97706';

          return (
            <g
              key={m.monthKey}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              {isHovered && (
                <rect
                  x={padLeft + idx * slotW + 4}
                  y={padTop}
                  width={slotW - 8}
                  height={plotH}
                  rx={6}
                  fill="#F1F5F9"
                />
              )}

              {/* Forecast Rain Bar */}
              <rect
                x={rainX}
                y={yRain}
                width={barW}
                height={hRain}
                rx={3}
                fill={rainFill}
                opacity={isHovered ? 1 : 0.9}
              />

              {/* P10-P90 Ensemble Whisker */}
              <line
                x1={whiskerX}
                x2={whiskerX}
                y1={yP90}
                y2={yP10}
                stroke="#334155"
                strokeWidth={1.5}
              />
              <line
                x1={whiskerX - 4}
                x2={whiskerX + 4}
                y1={yP90}
                y2={yP90}
                stroke="#334155"
                strokeWidth={1.5}
              />
              <line
                x1={whiskerX - 4}
                x2={whiskerX + 4}
                y1={yP10}
                y2={yP10}
                stroke="#334155"
                strokeWidth={1.5}
              />

              {/* Crop Demand ETc Bar */}
              <rect
                x={etcX}
                y={yEtc}
                width={barW}
                height={hEtc}
                rx={3}
                fill={etcFill}
                opacity={isHovered ? 1 : 0.88}
              />

              {/* Month Label */}
              <text
                x={cx}
                y={height - 16}
                textAnchor="middle"
                className="fill-[#0F172A] font-sans text-[11px] font-semibold"
              >
                {m.monthLabel}
              </text>

              {/* Anomaly Subtitle */}
              <text
                x={cx}
                y={height - 3}
                textAnchor="middle"
                className={`font-mono-tabular text-[9px] ${
                  m.floodRisk === 'high'
                    ? 'fill-[#DC2626]'
                    : m.droughtRisk === 'high'
                    ? 'fill-[#B45309]'
                    : 'fill-[#64748B]'
                }`}
              >
                {m.precipAnomalyPct >= 0
                  ? `+${m.precipAnomalyPct}%`
                  : `${m.precipAnomalyPct}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
