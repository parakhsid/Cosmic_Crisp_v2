export type UnitSystem = 'metric' | 'imperial';

function finiteOr(val: number, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

export function cToF(c: number): number {
  return (finiteOr(c) * 9) / 5 + 32;
}

export function fToC(f: number): number {
  return ((finiteOr(f) - 32) * 5) / 9;
}

export function mmToIn(mm: number): number {
  return finiteOr(mm) / 25.4;
}

export function inToMm(inches: number): number {
  return finiteOr(inches) * 25.4;
}

export function kmhToMph(kmh: number): number {
  return finiteOr(kmh) * 0.621371;
}

export function mToFt(m: number): number {
  return finiteOr(m) * 3.28084;
}

export function acresToHa(acres: number): number {
  return finiteOr(acres) * 0.404686;
}

export function haToAcres(ha: number): number {
  return finiteOr(ha) / 0.404686;
}

export function tHaToTonsAc(tHa: number): number {
  return finiteOr(tHa) * 0.44609;
}

export function tonsAcToTHa(tonsAc: number): number {
  return finiteOr(tonsAc) / 0.44609;
}

export function usdHaToUsdAc(usdHa: number): number {
  return finiteOr(usdHa) / 2.47105;
}

export function kgHaToLbAc(kgHa: number): number {
  return finiteOr(kgHa) * 0.892179;
}

export function convertTemp(c: number, unit: UnitSystem): number {
  return unit === 'imperial' ? cToF(c) : finiteOr(c);
}

export function formatTemp(c: number, unit: UnitSystem, decimals = 1): string {
  return `${convertTemp(c, unit).toFixed(decimals)}°${
    unit === 'imperial' ? 'F' : 'C'
  }`;
}

export function tempUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? '°F' : '°C';
}

export function convertPrecip(mm: number, unit: UnitSystem): number {
  return unit === 'imperial' ? mmToIn(mm) : finiteOr(mm);
}

export function formatPrecip(
  mm: number,
  unit: UnitSystem,
  decimalsMetric = 1,
  decimalsImp = 2
): string {
  if (unit === 'imperial') {
    return `${mmToIn(mm).toFixed(decimalsImp)} in`;
  }
  return `${finiteOr(mm).toFixed(decimalsMetric)} mm`;
}

export function precipUnitLabel(unit: UnitSystem): string {
  return unit === 'imperial' ? 'in' : 'mm';
}

export function formatWind(kmh: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    return `${Math.round(kmhToMph(kmh))} mph`;
  }
  return `${Math.round(finiteOr(kmh))} km/h`;
}

export function formatElevation(m: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    return `${Math.round(mToFt(m))} ft`;
  }
  return `${Math.round(finiteOr(m))} m`;
}

export function formatArea(acres: number, unit: UnitSystem): string {
  if (unit === 'imperial') {
    return `${Math.round(finiteOr(acres))} ac`;
  }
  return `${acresToHa(acres).toFixed(1)} ha`;
}

export function formatNitrogenDelta(kgHa: number, unit: UnitSystem): string {
  const val = unit === 'imperial' ? Math.round(kgHaToLbAc(kgHa)) : Math.round(finiteOr(kgHa));
  const sign = val > 0 ? `+${val}` : `${val}`;
  return `${sign} ${unit === 'imperial' ? 'lb/ac' : 'kg/ha'}`;
}

export function formatMarginPerArea(usdHa: number, unit: UnitSystem): string {
  const val =
    unit === 'imperial'
      ? Math.round(usdHaToUsdAc(usdHa))
      : Math.round(finiteOr(usdHa));
  const areaSuffix = unit === 'imperial' ? '/ac' : '/ha';
  return `${val >= 0 ? `+$${val}` : `-$${Math.abs(val)}`}${areaSuffix}`;
}

export function formatSoilDepth(depth: string, unit: UnitSystem): string {
  if (unit === 'metric') return depth;
  if (depth.includes('0–5') || depth.includes('0-5')) return '0–2 in';
  if (depth.includes('5–15') || depth.includes('5-15')) return '2–6 in';
  if (depth.includes('15–30') || depth.includes('15-30')) return '6–12 in';
  return depth;
}

export function formatAlertMetricValue(raw: string, unit: UnitSystem): string {
  if (unit === 'metric') return raw;
  const trimmed = raw.trim();
  if (trimmed.endsWith('°C')) {
    const num = Number(trimmed.slice(0, -2));
    if (Number.isFinite(num)) return `${cToF(num).toFixed(1)}°F`;
  }
  if (trimmed.toLowerCase().endsWith('mm')) {
    const num = Number(trimmed.slice(0, -2).trim());
    if (Number.isFinite(num)) return `${mmToIn(num).toFixed(2)} in`;
  }
  return raw;
}
