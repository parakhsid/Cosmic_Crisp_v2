import {inferTraditionalRegionalCrops, makeLocationKey} from './cropsAndLocations';
import type {
  DailyForecastPoint,
  FarmInsightBundle,
  LocationOption,
  MonthlyClimatePoint,
  SlopeClass,
  SoilProfile,
  YearlyAnomalyPoint,
} from '../types/agronomy';

const MONTH_NAMES = [
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

function classifySoilTexture(clay: number, sand: number): string {
  const silt = Math.max(0, 100 - clay - sand);
  if (clay >= 40) return 'Clay';
  if (clay >= 27 && sand < 20) return 'Silty Clay Loam';
  if (clay >= 27 && sand <= 45) return 'Clay Loam';
  if (sand >= 70 && clay < 15) return 'Sandy Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  return 'Loam';
}

export function classifySlope(slopePct: number): SlopeClass {
  if (slopePct < 2.2) return 'flat';
  if (slopePct < 6.0) return 'gentle';
  return 'steep';
}

export function estimateFrostFreeDays(monthly: MonthlyClimatePoint[]): number {
  const warmMonths = monthly.filter((m) => m.tempC >= 7.5).length;
  return Math.min(365, Math.max(110, warmMonths * 30 + 10));
}

export function buildRegionalFallbackBundle(loc: LocationOption): FarmInsightBundle {
  const absLat = Math.abs(loc.lat);
  const isSouth = loc.lat < 0;
  const baseTemp = 27 - absLat * 0.42;
  const tempSwing = Math.min(18, Math.max(3, absLat * 0.36));

  const seed = Math.abs(Math.sin(loc.lat * 12.9898 + loc.lon * 78.233));
  const ph = Number((5.9 + seed * 1.4).toFixed(1));
  const socGKg = Number((13 + (1 - absLat / 90) * 8 + seed * 11).toFixed(1));
  const nitrogenGKg = Number((1.1 + socGKg * 0.082).toFixed(2));
  const clayPct = Math.round(20 + seed * 16);
  const sandPct = Math.round(28 + (1 - seed) * 22);
  const siltPct = Math.max(5, 100 - clayPct - sandPct);
  const textureClass = classifySoilTexture(clayPct, sandPct);

  const soil: SoilProfile = {
    ph,
    socGKg,
    nitrogenGKg,
    clayPct,
    sandPct,
    siltPct,
    textureClass,
    source: 'regional_benchmark',
    layers: [
      {depth: '0–5 cm', ph, socGKg, nitrogenGKg, clayPct, sandPct, siltPct},
      {
        depth: '5–15 cm',
        ph: Number((ph + 0.1).toFixed(1)),
        socGKg: Number((socGKg * 0.84).toFixed(1)),
        nitrogenGKg: Number((nitrogenGKg * 0.82).toFixed(2)),
        clayPct: clayPct + 2,
        sandPct: Math.max(10, sandPct - 1),
        siltPct: Math.max(5, siltPct - 1),
      },
      {
        depth: '15–30 cm',
        ph: Number((ph + 0.2).toFixed(1)),
        socGKg: Number((socGKg * 0.62).toFixed(1)),
        nitrogenGKg: Number((nitrogenGKg * 0.64).toFixed(2)),
        clayPct: clayPct + 4,
        sandPct: Math.max(10, sandPct - 2),
        siltPct: Math.max(5, siltPct - 2),
      },
    ],
  };

  const monthlyClimate: MonthlyClimatePoint[] = MONTH_NAMES.map((label, idx) => {
    const phase = isSouth ? idx + 6 : idx;
    const seasonalWave = Math.cos(((phase - 6) / 12) * Math.PI * 2);
    const tempC = Number((baseTemp + seasonalWave * tempSwing).toFixed(1));
    const precipBase = absLat < 24 ? 115 : absLat < 45 ? 74 : 58;
    const precipMm = Math.max(
      14,
      Math.round(precipBase + seasonalWave * 36 + Math.sin(idx + seed * 5) * 18)
    );
    const rootWetnessPct = Math.min(
      88,
      Math.max(24, Math.round(46 + (precipMm - 50) * 0.28))
    );
    const relativeHumidityPct = Math.min(
      92,
      Math.max(36, Math.round(58 + (precipMm - 60) * 0.18))
    );
    const solarKwhM2 = Number(
      Math.max(2.1, 4.4 + seasonalWave * 1.9).toFixed(1)
    );
    return {
      monthIndex: idx,
      monthLabel: label,
      tempC,
      precipMm,
      rootWetnessPct,
      relativeHumidityPct,
      solarKwhM2,
    };
  });

  const currentMonth = new Date().getMonth();
  const currentMonthStats = monthlyClimate[currentMonth];
  const avgAnnualPrecip = monthlyClimate.reduce((a, m) => a + m.precipMm, 0);

  const yearlyAnomalies: YearlyAnomalyPoint[] = [2021, 2022, 2023, 2024, 2025].map(
    (year, i) => {
      const wave = Math.sin(year * 1.7 + seed * 9) * 22;
      const anomalyPct = Math.round(wave);
      const annualPrecipMm = Math.round(avgAnnualPrecip * (1 + anomalyPct / 100));
      return {
        year,
        annualPrecipMm,
        anomalyPct,
        meanTempC: Number((baseTemp + (i - 2) * 0.18).toFixed(1)),
        avgWetnessPct: Math.min(
          84,
          Math.max(28, Math.round(currentMonthStats.rootWetnessPct + anomalyPct * 0.25))
        ),
      };
    }
  );

  const today = new Date();
  const forecast16d: DailyForecastPoint[] = Array.from({length: 16}, (_, i) => {
    const d = new Date(today.getTime() + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const swing = Math.sin(i * 0.7 + seed * 4) * 5;
    const tempMaxC = Number((currentMonthStats.tempC + 5.5 + swing).toFixed(1));
    const tempMinC = Number((currentMonthStats.tempC - 6.0 + swing * 0.8).toFixed(1));
    const precipMm =
      i === 4 || i === 10
        ? Math.round(14 + seed * 32)
        : i % 3 === 0
        ? Math.round(3 + seed * 6)
        : 0;
    const weatherCode =
      tempMinC <= 0 && precipMm > 0
        ? 73
        : precipMm >= 14
        ? 63
        : precipMm > 0
        ? 61
        : i % 2 === 0
        ? 1
        : 2;
    const precipProbPct =
      precipMm >= 14 ? 80 : precipMm > 0 ? 55 : Math.round(10 + seed * 20);
    const windMaxKmh = Number((11 + seed * 14 + (i % 4) * 2.5).toFixed(1));
    return {
      date,
      tempMinC,
      tempMaxC,
      precipMm,
      et0Mm: Number(Math.max(1.2, (tempMaxC - 4) * 0.18).toFixed(1)),
      weatherCode,
      precipProbPct,
      windMaxKmh,
      uvIndexMax: Number(Math.max(1.5, Math.min(10, 6.5 - absLat * 0.06)).toFixed(1)),
    };
  });

  const slopePct = Number((1.2 + seed * 4.5).toFixed(1));

  return {
    location: {
      ...loc,
      id: loc.id || makeLocationKey(loc.lat, loc.lon),
      traditionalCrops: inferTraditionalRegionalCrops(loc),
    },
    fetchedAt: new Date().toISOString(),
    dataSources: {
      nasaPower: 'regional_benchmark',
      soilGrids: 'regional_benchmark',
      forecast: 'regional_benchmark',
    },
    currentSnapshot: {
      rootWetnessPct: currentMonthStats.rootWetnessPct,
      relativeHumidityPct: currentMonthStats.relativeHumidityPct,
      surfaceTempC: currentMonthStats.tempC,
      precipLast7dMm: Math.round(currentMonthStats.precipMm * 0.25),
      solarKwhM2: currentMonthStats.solarKwhM2,
      usdaZone: loc.usdaZone || '6b',
      frostFreeDays: estimateFrostFreeDays(monthlyClimate),
      elevationM: Math.round(180 + seed * 260),
      slopePct,
      inferredSlopeClass: classifySlope(slopePct),
    },
    soil,
    monthlyClimate,
    yearlyAnomalies,
    forecast16d,
    currentWeather: {
      tempC: currentMonthStats.tempC,
      apparentTempC: currentMonthStats.tempC,
      humidityPct: currentMonthStats.relativeHumidityPct,
      precipMm: forecast16d[0]?.precipMm ?? 0,
      windKmh: forecast16d[0]?.windMaxKmh ?? 12,
      weatherCode: forecast16d[0]?.weatherCode ?? 1,
      observedAt: new Date().toISOString(),
      timezone: 'UTC',
    },
  };
}
