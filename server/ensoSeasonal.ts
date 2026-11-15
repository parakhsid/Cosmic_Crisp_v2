import {estimateMonthlyEt0Mm} from '../src/lib/irrigationModel.ts';
import type {
  EnsoPhase,
  MonthlyClimatePoint,
  SeasonalEnsoOutlook,
  SeasonalOutlookMonth,
} from '../src/types/agronomy.ts';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

interface CachedEnsoData {
  fetchedAtMs: number;
  currentSeasonLabel: string;
  oniValueC: number;
  oniTrendDeltaC: number;
  phase: EnsoPhase;
  probabilities: {
    elNinoPct: number;
    neutralPct: number;
    laNinaPct: number;
  };
  ensoSummaryNote: string;
}

interface CachedSeasonalLocation {
  fetchedAtMs: number;
  months: SeasonalOutlookMonth[];
  liveSource: boolean;
}

let ensoCache: CachedEnsoData | null = null;
const seasonalCache = new Map<string, CachedSeasonalLocation>();

const ENSO_TTL_MS = 6 * 60 * 60 * 1000;
const SEASONAL_TTL_MS = 3 * 60 * 60 * 1000;

async function fetchWithTimeout(url: string, timeoutMs = 5500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {'User-Agent': 'CosmicCrisp-Agronomy/1.0'},
    });
  } finally {
    clearTimeout(timer);
  }
}

function derivePhaseProbabilities(
  oni: number,
  trendDelta: number
): {
  phase: EnsoPhase;
  probabilities: {elNinoPct: number; neutralPct: number; laNinaPct: number};
} {
  const projectedOni = oni + trendDelta * 0.5;
  const phase: EnsoPhase =
    oni >= 0.5 ? 'el_nino' : oni <= -0.5 ? 'la_nina' : 'neutral';

  if (projectedOni >= 1.2) {
    return {phase, probabilities: {elNinoPct: 86, neutralPct: 12, laNinaPct: 2}};
  }
  if (projectedOni >= 0.5) {
    return {phase, probabilities: {elNinoPct: 68, neutralPct: 26, laNinaPct: 6}};
  }
  if (projectedOni <= -1.2) {
    return {phase, probabilities: {elNinoPct: 2, neutralPct: 14, laNinaPct: 84}};
  }
  if (projectedOni <= -0.5) {
    return {phase, probabilities: {elNinoPct: 7, neutralPct: 28, laNinaPct: 65}};
  }
  if (projectedOni > 0.15) {
    return {phase, probabilities: {elNinoPct: 44, neutralPct: 44, laNinaPct: 12}};
  }
  if (projectedOni < -0.15) {
    return {phase, probabilities: {elNinoPct: 13, neutralPct: 45, laNinaPct: 42}};
  }
  return {phase, probabilities: {elNinoPct: 26, neutralPct: 50, laNinaPct: 24}};
}

async function fetchLiveNoaaOni(): Promise<CachedEnsoData> {
  if (ensoCache && Date.now() - ensoCache.fetchedAtMs < ENSO_TTL_MS) {
    return ensoCache;
  }

  try {
    const res = await fetchWithTimeout(
      'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
      4500
    );
    if (res.ok) {
      const txt = await res.text();
      const lines = txt
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[A-Z]{3}\s+\d{4}\s+[-+]?\d/.test(l));

      if (lines.length >= 2) {
        const latestParts = lines[lines.length - 1].split(/\s+/);
        const prevParts = lines[Math.max(0, lines.length - 3)].split(/\s+/);
        const season = latestParts[0];
        const year = latestParts[1];
        const oni = Number(latestParts[3]);
        const prevOni = Number(prevParts[3]);
        if (Number.isFinite(oni)) {
          const trendDelta = Number.isFinite(prevOni)
            ? Number((oni - prevOni).toFixed(2))
            : 0;
          const {phase, probabilities} = derivePhaseProbabilities(oni, trendDelta);
          const phaseLabel =
            phase === 'el_nino'
              ? 'El Niño Active'
              : phase === 'la_nina'
              ? 'La Niña Active'
              : 'ENSO-Neutral';
          const strength =
            Math.abs(oni) >= 1.5
              ? 'Strong'
              : Math.abs(oni) >= 1.0
              ? 'Moderate'
              : Math.abs(oni) >= 0.5
              ? 'Weak'
              : 'Neutral';

          ensoCache = {
            fetchedAtMs: Date.now(),
            currentSeasonLabel: `NOAA CPC ONI (${season} ${year})`,
            oniValueC: Number(oni.toFixed(2)),
            oniTrendDeltaC: trendDelta,
            phase,
            probabilities,
            ensoSummaryNote: `${strength} ${phaseLabel} signal (ONI ${
              oni >= 0 ? '+' : ''
            }${oni.toFixed(2)}°C, 2-season trend ${
              trendDelta >= 0 ? '+' : ''
            }${trendDelta.toFixed(2)}°C).`,
          };
          return ensoCache;
        }
      }
    }
  } catch {
    // Fall back to safe benchmark below
  }

  return {
    fetchedAtMs: Date.now(),
    currentSeasonLabel: 'ENSO Reference Baseline',
    oniValueC: 0.4,
    oniTrendDeltaC: 0.1,
    phase: 'neutral',
    probabilities: {elNinoPct: 42, neutralPct: 45, laNinaPct: 13},
    ensoSummaryNote:
      'Live NOAA CPC feed temporarily unreachable; showing reference ENSO distribution with scenario stress-testing active.',
  };
}

function getNormalsForMonth(
  monthlyNormals: MonthlyClimatePoint[],
  monthIndex: number
): {precipMm: number; tempC: number; solarKwhM2: number; humidityPct: number} {
  const found = monthlyNormals.find((m) => m.monthIndex === monthIndex);
  return {
    precipMm: found?.precipMm ?? 65,
    tempC: found?.tempC ?? 18,
    solarKwhM2: found?.solarKwhM2 ?? 4.2,
    humidityPct: found?.relativeHumidityPct ?? 62,
  };
}

async function fetchOpenMeteoSeasonalMonths(
  lat: number,
  lon: number,
  monthlyNormals: MonthlyClimatePoint[]
): Promise<{months: SeasonalOutlookMonth[]; liveSource: boolean}> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const existing = seasonalCache.get(cacheKey);
  if (existing && Date.now() - existing.fetchedAtMs < SEASONAL_TTL_MS) {
    return {months: existing.months, liveSource: existing.liveSource};
  }

  try {
    const url = `https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${lat.toFixed(
      4
    )}&longitude=${lon.toFixed(
      4
    )}&daily=temperature_2m_mean,precipitation_sum&forecast_days=185`;
    const res = await fetchWithTimeout(url, 6000);
    if (res.ok) {
      const json = (await res.json()) as {
        daily?: Record<string, Array<number | string | null>>;
      };
      const daily = json?.daily;
      const times = Array.isArray(daily?.time) ? (daily.time as string[]) : [];
      if (times.length >= 90 && daily) {
        const precipKeys = Object.keys(daily).filter((k) =>
          k.startsWith('precipitation_sum')
        );
        const tempKeys = Object.keys(daily).filter((k) =>
          k.startsWith('temperature_2m_mean')
        );

        const monthBuckets = new Map<
          string,
          {
            year: number;
            monthIndex: number;
            dayCount: number;
            memberPrecips: number[];
            memberHeavyDays: number[];
            tempSums: number[];
            tempCounts: number[];
          }
        >();

        for (let i = 0; i < times.length; i++) {
          const dt = times[i];
          if (typeof dt !== 'string' || dt.length < 7) continue;
          const ym = dt.slice(0, 7);
          const year = Number(dt.slice(0, 4));
          const monthIndex = Number(dt.slice(5, 7)) - 1;
          let b = monthBuckets.get(ym);
          if (!b) {
            b = {
              year,
              monthIndex,
              dayCount: 0,
              memberPrecips: precipKeys.map(() => 0),
              memberHeavyDays: precipKeys.map(() => 0),
              tempSums: tempKeys.map(() => 0),
              tempCounts: tempKeys.map(() => 0),
            };
            monthBuckets.set(ym, b);
          }
          b.dayCount++;
          precipKeys.forEach((k, idx) => {
            const val = daily[k]?.[i];
            if (typeof val === 'number' && Number.isFinite(val)) {
              b!.memberPrecips[idx] += val;
              if (val >= 20) b!.memberHeavyDays[idx] += 1;
            }
          });
          tempKeys.forEach((k, idx) => {
            const val = daily[k]?.[i];
            if (typeof val === 'number' && Number.isFinite(val)) {
              b!.tempSums[idx] += val;
              b!.tempCounts[idx] += 1;
            }
          });
        }

        // Keep up to 6 full/major months (>= 12 days remaining in month)
        const ordered = Array.from(monthBuckets.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .filter(([, b]) => b.dayCount >= 10)
          .slice(0, 6);

        if (ordered.length >= 4) {
          const months: SeasonalOutlookMonth[] = ordered.map(([ym, b]) => {
            const daysInFullMonth = new Date(b.year, b.monthIndex + 1, 0).getDate();
            const scaleToMonth = daysInFullMonth / Math.max(1, b.dayCount);
            const scaledPrecips = b.memberPrecips
              .map((v) => v * scaleToMonth)
              .sort((x, y) => x - y);
            const meanPrecip =
              scaledPrecips.reduce((a, c) => a + c, 0) /
              Math.max(1, scaledPrecips.length);
            const p10 =
              scaledPrecips[Math.floor(scaledPrecips.length * 0.1)] ??
              meanPrecip * 0.55;
            const p90 =
              scaledPrecips[Math.floor(scaledPrecips.length * 0.9)] ??
              meanPrecip * 1.6;

            const memberTemps: number[] = [];
            b.tempSums.forEach((s, idx) => {
              if (b.tempCounts[idx] > 0) memberTemps.push(s / b.tempCounts[idx]);
            });
            const normals = getNormalsForMonth(monthlyNormals, b.monthIndex);
            const tempMeanC = memberTemps.length
              ? memberTemps.reduce((a, c) => a + c, 0) / memberTemps.length
              : normals.tempC;

            const heavyDaysAvg =
              (b.memberHeavyDays.reduce((a, c) => a + c, 0) /
                Math.max(1, b.memberHeavyDays.length)) *
              scaleToMonth;

            return {
              monthKey: ym,
              monthIndex: b.monthIndex,
              monthLabel: `${SHORT_MONTHS[b.monthIndex]} ${String(b.year).slice(-2)}`,
              precipMeanMm: Math.round(meanPrecip),
              precipP10Mm: Math.round(p10),
              precipP90Mm: Math.round(p90),
              normalPrecipMm: Math.round(normals.precipMm),
              tempMeanC: Number(tempMeanC.toFixed(1)),
              normalTempC: Number(normals.tempC.toFixed(1)),
              et0Mm: estimateMonthlyEt0Mm(
                tempMeanC,
                normals.solarKwhM2,
                normals.humidityPct,
                daysInFullMonth
              ),
              heavyRainDaysAvg: Number(heavyDaysAvg.toFixed(1)),
            };
          });

          seasonalCache.set(cacheKey, {
            fetchedAtMs: Date.now(),
            months,
            liveSource: true,
          });
          return {months, liveSource: true};
        }
      }
    }
  } catch {
    // Fall back to NASA POWER monthly normals below
  }

  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();
  const fallbackMonths: SeasonalOutlookMonth[] = [];
  for (let offset = 0; offset < 6; offset++) {
    const absM = startMonth + offset;
    const year = startYear + Math.floor(absM / 12);
    const monthIndex = absM % 12;
    const normals = getNormalsForMonth(monthlyNormals, monthIndex);
    const days = new Date(year, monthIndex + 1, 0).getDate();
    fallbackMonths.push({
      monthKey: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      monthIndex,
      monthLabel: `${SHORT_MONTHS[monthIndex]} ${String(year).slice(-2)}`,
      precipMeanMm: Math.round(normals.precipMm),
      precipP10Mm: Math.round(normals.precipMm * 0.55),
      precipP90Mm: Math.round(normals.precipMm * 1.65),
      normalPrecipMm: Math.round(normals.precipMm),
      tempMeanC: Number(normals.tempC.toFixed(1)),
      normalTempC: Number(normals.tempC.toFixed(1)),
      et0Mm: estimateMonthlyEt0Mm(
        normals.tempC,
        normals.solarKwhM2,
        normals.humidityPct,
        days
      ),
      heavyRainDaysAvg: normals.precipMm >= 120 ? 2.0 : 0.6,
    });
  }
  return {months: fallbackMonths, liveSource: false};
}

export async function resolveSeasonalEnsoOutlook(
  lat: number,
  lon: number,
  monthlyNormals: MonthlyClimatePoint[]
): Promise<SeasonalEnsoOutlook> {
  const [enso, seasonal] = await Promise.all([
    fetchLiveNoaaOni(),
    fetchOpenMeteoSeasonalMonths(lat, lon, monthlyNormals),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    source: seasonal.liveSource ? 'live_noaa_openmeteo' : 'regional_benchmark',
    currentSeasonLabel: enso.currentSeasonLabel,
    oniValueC: enso.oniValueC,
    oniTrendDeltaC: enso.oniTrendDeltaC,
    phase: enso.phase,
    probabilities: enso.probabilities,
    ensoSummaryNote: enso.ensoSummaryNote,
    months: seasonal.months,
  };
}
