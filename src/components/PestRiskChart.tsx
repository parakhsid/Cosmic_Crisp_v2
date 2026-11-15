import {useState} from 'react';
import type {MonthlyPestRiskPoint} from '../types/agronomy';

interface PestRiskChartProps {
  months: MonthlyPestRiskPoint[];
  selectedMonthKey: string | null;
  onSelectMonth: (monthKey: string) => void;
}

export function PestRiskChart({
  months,
  selectedMonthKey,
  onSelectMonth,
}: PestRiskChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!months.length) return null;

  const width = 680;
  const height = 246;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const slotW = plotW / months.length;
  const barW = Math.min(18, slotW * 0.21);
  const yScale = (score: number) =>
    padTop + plotH - (clampScore(score) / 100) * plotH;

  const activeIdx =
    hoveredIdx !== null
      ? hoveredIdx
      : selectedMonthKey
      ? months.findIndex((m) => m.monthKey === selectedMonthKey)
      : -1;
  const inspected = activeIdx >= 0 ? months[activeIdx] : null;

  return (
    <div>
      {/* Unboxed legend + active hover/selected telemetry */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#0284C7]" />
            <span>Fungal &amp; Mildew Risk (0–100)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#D97706]" />
            <span>Insect &amp; Mite Risk (0–100)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#64748B]" />
            <span>Soil / Collar Rot (0–100)</span>
          </span>
        </div>

        {inspected && (
          <div className="font-mono-tabular text-xs font-semibold text-[#0F172A]">
            {inspected.monthLabel}: Fungal {inspected.fungalRisk} · Insect{' '}
            {inspected.insectRisk} · Soil {inspected.soilVectorRisk} (
            {inspected.precipAnomalyPct >= 0
              ? `+${inspected.precipAnomalyPct}%`
              : `${inspected.precipAnomalyPct}%`}{' '}
            rain)
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="6-month fungal disease versus insect pest risk index chart"
        className="w-full h-auto overflow-visible"
      >
        {/* High-risk 65 threshold guide */}
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={yScale(65)}
          y2={yScale(65)}
          stroke="#FCA5A5"
          strokeDasharray="4 4"
        />
        <text
          x={width - padRight}
          y={yScale(65) - 4}
          textAnchor="end"
          className="fill-[#DC2626] font-mono-tabular text-[9.5px] font-semibold"
        >
          High Threshold (65)
        </text>

        {/* Horizontal Y gridlines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = yScale(val);
          return (
            <g key={val}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray={val === 0 ? undefined : '3 3'}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-[#64748B] font-mono-tabular text-[10px]"
              >
                {val}
              </text>
            </g>
          );
        })}

        {months.map((m, idx) => {
          const cx = padLeft + idx * slotW + slotW / 2;
          const fungalX = cx - barW * 1.5 - 2;
          const insectX = cx - barW * 0.5;
          const soilX = cx + barW * 0.5 + 2;

          const yFungal = yScale(m.fungalRisk);
          const hFungal = Math.max(2, yScale(0) - yFungal);

          const yInsect = yScale(m.insectRisk);
          const hInsect = Math.max(2, yScale(0) - yInsect);

          const ySoil = yScale(m.soilVectorRisk);
          const hSoil = Math.max(2, yScale(0) - ySoil);

          const isSelected = selectedMonthKey === m.monthKey;
          const isHovered = hoveredIdx === idx;

          const fungalFill = '#0284C7';
          const insectFill = '#D97706';
          const soilFill = '#64748B';

          return (
            <g
              key={m.monthKey}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSelectMonth(m.monthKey)}
              className="cursor-pointer"
            >
              {(isHovered || isSelected) && (
                <rect
                  x={cx - slotW * 0.44}
                  y={padTop}
                  width={slotW * 0.88}
                  height={plotH}
                  rx={6}
                  fill={isSelected ? '#F0FDF4' : '#F1F5F9'}
                  stroke={isSelected ? '#BBF7D0' : 'none'}
                />
              )}

              <rect
                x={fungalX}
                y={yFungal}
                width={barW}
                height={hFungal}
                rx={3}
                fill={fungalFill}
                opacity={isHovered || isSelected ? 1 : 0.9}
              />
              <rect
                x={insectX}
                y={yInsect}
                width={barW}
                height={hInsect}
                rx={3}
                fill={insectFill}
                opacity={isHovered || isSelected ? 1 : 0.92}
              />
              <rect
                x={soilX}
                y={ySoil}
                width={barW}
                height={hSoil}
                rx={3}
                fill={soilFill}
                opacity={isHovered || isSelected ? 1 : 0.85}
              />

              {/* Month label + rain anomaly cue */}
              <text
                x={cx}
                y={height - 19}
                textAnchor="middle"
                className={`text-[11px] font-medium ${
                  isSelected ? 'fill-[#15803D] font-bold' : 'fill-[#334155]'
                }`}
              >
                {m.monthLabel}
              </text>
              <text
                x={cx}
                y={height - 6}
                textAnchor="middle"
                className={`font-mono-tabular text-[9.5px] ${
                  m.precipAnomalyPct <= -15
                    ? 'fill-[#B45309]'
                    : m.precipAnomalyPct >= 20
                    ? 'fill-[#0369A1]'
                    : 'fill-[#64748B]'
                }`}
              >
                {m.precipAnomalyPct >= 0
                  ? `+${m.precipAnomalyPct}% rain`
                  : `${m.precipAnomalyPct}% rain`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, v));
}
