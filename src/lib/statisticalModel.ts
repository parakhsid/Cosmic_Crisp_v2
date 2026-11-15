import {
  CROP_SPECS,
  DEFAULT_OWNED_EQUIPMENT,
  inferRegionalCropProfile,
} from '../data/cropsAndLocations';
import type {
  AlertThresholds,
  CropPrediction,
  CropSpec,
  EquipmentId,
  FarmInsightBundle,
  LaborAvailability,
  SlopeClass,
  WaterAvailability,
  WeatherAlert,
  YieldSensitivity,
} from '../types/agronomy';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreRange(
  value: number,
  [low, high]: [number, number],
  tolerance: number
): number {
  if (value >= low && value <= high) return 100;
  const dist = value < low ? low - value : value - high;
  return clamp(Math.round(100 - (dist / tolerance) * 72), 10, 99);
}

interface WindowClimate {
  avgTempC: number;
  totalPrecipMm: number;
  avgWetnessPct: number;
  avgHumidityPct: number;
  avgSolar: number;
}

function computeWindowFromStart(
  bundle: FarmInsightBundle,
  startMonthIdx: number,
  durationMonths = 4
): WindowClimate {
  const windowMonths = [];
  for (let i = 0; i < durationMonths; i++) {
    const idx = (startMonthIdx + i) % 12;
    windowMonths.push(bundle.monthlyClimate[idx]);
  }
  const len = Math.max(1, windowMonths.length);
  return {
    avgTempC: windowMonths.reduce((acc, m) => acc + m.tempC, 0) / len,
    totalPrecipMm: windowMonths.reduce((acc, m) => acc + m.precipMm, 0),
    avgWetnessPct:
      windowMonths.reduce((acc, m) => acc + m.rootWetnessPct, 0) / len,
    avgHumidityPct:
      windowMonths.reduce((acc, m) => acc + (m.relativeHumidityPct ?? 62), 0) /
      len,
    avgSolar: windowMonths.reduce((acc, m) => acc + m.solarKwhM2, 0) / len,
  };
}

function selectOptimalWindowForCrop(
  bundle: FarmInsightBundle,
  harvestMonth: number,
  candidate: CropSpec
): WindowClimate {
  const immediate = computeWindowFromStart(bundle, (harvestMonth + 1) % 12, 4);
  const optMidTemp = (candidate.optimalTempC[0] + candidate.optimalTempC[1]) / 2;

  // Evaluate candidate 4-month growing windows across the upcoming year
  let best = immediate;
  let bestDelta = Math.abs(immediate.avgTempC - optMidTemp);

  // Cool-season / overwintering crops strongly prefer immediate post-harvest autumn seeding if close
  const isOverwinter =
    candidate.optimalTempC[0] <= 12 && candidate.frostTolerance >= 0.65;
  const maxOffsets = isOverwinter ? [1, 2, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8];

  for (const offset of maxOffsets) {
    const win = computeWindowFromStart(bundle, (harvestMonth + offset) % 12, 4);
    const delta = Math.abs(win.avgTempC - optMidTemp);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = win;
    }
  }
  return best;
}

function computeRotationSynergy(
  currentCrop: CropSpec,
  candidate: CropSpec,
  recentHistoryCropIds: string[]
): {
  score: number;
  diseaseBreak: 'high' | 'moderate' | 'low';
  historyConflict: boolean;
  reason: string;
} {
  const repeatedInHistory = recentHistoryCropIds.includes(candidate.id);

  if (candidate.id === currentCrop.id) {
    return {
      score: 22,
      diseaseBreak: 'low',
      historyConflict: true,
      reason: 'reason_monocrop_risk',
    };
  }
  if (repeatedInHistory) {
    return {
      score: 50,
      diseaseBreak: 'moderate',
      historyConflict: true,
      reason: 'reason_history_repeat',
    };
  }
  if (candidate.family === currentCrop.family) {
    return {
      score: 46,
      diseaseBreak: 'low',
      historyConflict: false,
      reason: 'reason_same_family',
    };
  }
  if (candidate.family === 'legume' && currentCrop.nitrogenBalanceKgHa < -55) {
    return {
      score: 96,
      diseaseBreak: 'high',
      historyConflict: false,
      reason: 'reason_legume_nitrogen_fix',
    };
  }
  if (currentCrop.family === 'legume' && candidate.nitrogenBalanceKgHa < -55) {
    return {
      score: 94,
      diseaseBreak: 'high',
      historyConflict: false,
      reason: 'reason_residual_nitrogen',
    };
  }
  if (
    candidate.family === 'brassica' ||
    candidate.family === 'root' ||
    candidate.family === 'allium' ||
    candidate.family === 'solanaceae' ||
    candidate.family === 'cucurbit'
  ) {
    return {
      score: 86,
      diseaseBreak: 'high',
      historyConflict: false,
      reason: 'reason_pest_break',
    };
  }
  return {
    score: 80,
    diseaseBreak: 'moderate',
    historyConflict: false,
    reason: 'reason_balanced_rotation',
  };
}

function laborRank(level: LaborAvailability): number {
  if (level === 'low') return 1;
  if (level === 'moderate') return 2;
  return 3;
}

export interface PredictionOptions {
  currentCropId: string;
  harvestMonth: number;
  waterAvailability: WaterAvailability;
  laborAvailability: LaborAvailability;
  slopeClass: SlopeClass;
  ownedEquipment?: EquipmentId[];
  prioritizeOwnedEquipment?: boolean;
  recentHistoryCropIds?: string[];
  sensitivity?: YieldSensitivity;
}

export function predictNextCrops(
  bundle: FarmInsightBundle,
  options: PredictionOptions
): CropPrediction[] {
  const {
    currentCropId,
    harvestMonth,
    waterAvailability,
    laborAvailability,
    slopeClass,
    ownedEquipment = DEFAULT_OWNED_EQUIPMENT,
    prioritizeOwnedEquipment = false,
    recentHistoryCropIds = [],
    sensitivity = {
      rainfallDeltaPct: 0,
      nitrogenBoostKgHa: 0,
      conservationTillage: false,
    },
  } = options;

  const currentCrop =
    CROP_SPECS.find((c) => c.id === currentCropId) ?? CROP_SPECS[0];

  const monthlyTemps = bundle.monthlyClimate.map((m) => m.tempC);
  const meanTempC =
    monthlyTemps.reduce((acc, t) => acc + t, 0) / Math.max(1, monthlyTemps.length);
  const coldestMonthC = Math.min(...monthlyTemps, 15);
  const warmestMonthC = Math.max(...monthlyTemps, 20);
  const annualPrecipMm = bundle.monthlyClimate.reduce(
    (acc, m) => acc + m.precipMm,
    0
  );

  const regionalProfile = inferRegionalCropProfile(bundle.location, {
    meanTempC,
    annualPrecipMm,
    coldestTempC: coldestMonthC,
  });
  const traditionalCrops = regionalProfile.crops;
  const regionalRankMap = new Map<string, number>();
  traditionalCrops.forEach((id, idx) => {
    if (!regionalRankMap.has(id)) regionalRankMap.set(id, idx);
  });

  const avgAbsAnomaly =
    bundle.yearlyAnomalies.reduce((acc, y) => acc + Math.abs(y.anomalyPct), 0) /
    Math.max(1, bundle.yearlyAnomalies.length);
  const stabilityBase = clamp(Math.round(100 - avgAbsAnomaly * 0.9), 42, 96);

  const minForecastTemp = Math.min(
    ...bundle.forecast16d.map((d) => d.tempMinC),
    15
  );
  const frostFreeDays = bundle.currentSnapshot.frostFreeDays ?? 180;

  const predictions: CropPrediction[] = CROP_SPECS.map((candidate) => {
    const rotation = computeRotationSynergy(
      currentCrop,
      candidate,
      recentHistoryCropIds
    );
    const regionalRank = regionalRankMap.get(candidate.id) ?? null;
    const isTraditionalRegional = regionalRank !== null;

    const windowStats = selectOptimalWindowForCrop(
      bundle,
      harvestMonth,
      candidate
    );
    const adjustedPrecipMm =
      windowStats.totalPrecipMm * (1 + sensitivity.rainfallDeltaPct / 100);

    // 1. Water & Humidity Fit
    const irrigationSupplyMm =
      waterAvailability === 'full'
        ? candidate.waterNeedMm * 0.92
        : waterAvailability === 'limited'
        ? Math.min(candidate.waterNeedMm * 0.58, adjustedPrecipMm + 140)
        : adjustedPrecipMm;

    const effectiveWaterMm =
      Math.max(adjustedPrecipMm, irrigationSupplyMm) +
      (bundle.currentSnapshot.rootWetnessPct / 100) * 90;
    const waterRatio = effectiveWaterMm / candidate.waterNeedMm;
    const waterDeviation = Math.abs(1 - waterRatio);

    const fungalSensitive =
      candidate.family === 'solanaceae' ||
      candidate.family === 'allium' ||
      ['chickpeas', 'wine_grapes', 'strawberries', 'sunflower', 'lentils'].includes(
        candidate.id
      );
    const humidityPenalty =
      windowStats.avgHumidityPct > 82 && fungalSensitive
        ? 9
        : windowStats.avgHumidityPct < 38 && candidate.droughtTolerance < 0.5
        ? 8
        : 0;

    let moistureFit = clamp(
      Math.round(
        100 -
          waterDeviation * (candidate.droughtTolerance > 0.7 ? 48 : 74) -
          humidityPenalty
      ),
      15,
      98
    );
    if (sensitivity.conservationTillage && waterRatio < 1) {
      moistureFit = clamp(moistureFit + 6, 15, 99);
    }

    // 2. Thermal, Growing Season Length & Plant Hardiness Fit
    const thermalScore = scoreRange(
      windowStats.avgTempC,
      candidate.optimalTempC,
      11
    );
    const solarScore = clamp(Math.round(68 + windowStats.avgSolar * 5.2), 55, 98);

    const isPerennial = candidate.lifeForm === 'Perennial';
    const absMinTemp = candidate.absTempC?.[0] ?? -5;
    const absMaxTemp = candidate.absTempC?.[1] ?? 38;

    // Hardiness check for perennials & winter crops against coldest month temperature
    let winterSurvivalPenalty = 0;
    if (isPerennial && coldestMonthC < absMinTemp) {
      winterSurvivalPenalty = clamp(
        Math.round((absMinTemp - coldestMonthC) * 4.2),
        12,
        55
      );
    }
    // Tropical crops in cool high-latitude regions cannot mature if summer peak < optimal min
    let heatDeficitPenalty = 0;
    if (warmestMonthC < candidate.optimalTempC[0] - 1) {
      heatDeficitPenalty = clamp(
        Math.round((candidate.optimalTempC[0] - warmestMonthC) * 6),
        8,
        45
      );
    }
    // Cool-adapted crops in year-round hot tropics suffer heat stress
    let heatStressPenalty = 0;
    if (coldestMonthC > candidate.optimalTempC[1] + 1 || warmestMonthC > absMaxTemp) {
      const excess = Math.max(
        0,
        coldestMonthC - candidate.optimalTempC[1],
        warmestMonthC - absMaxTemp
      );
      heatStressPenalty = clamp(Math.round(excess * 5.5), 6, 42);
    }

    const seasonFitsWindow =
      candidate.frostTolerance >= 0.72 ||
      candidate.growingDays <= frostFreeDays + 15;
    const seasonPenalty = seasonFitsWindow ? 0 : 20;
    const frostPenalty =
      minForecastTemp < 1 && candidate.frostTolerance < 0.35 ? 8 : 0;

    const thermalSolarFit = clamp(
      Math.round(
        thermalScore * 0.78 +
          solarScore * 0.22 -
          frostPenalty -
          seasonPenalty -
          winterSurvivalPenalty -
          heatDeficitPenalty -
          heatStressPenalty
      ),
      10,
      98
    );

    const hardinessLevel: 'hardy' | 'moderate' | 'sensitive' =
      candidate.frostTolerance >= 0.72
        ? 'hardy'
        : candidate.frostTolerance >= 0.35
        ? 'moderate'
        : 'sensitive';

    // 3. Soil Quality & Health Fit (pH + organic carbon + SoilGrids nitrogen + texture)
    const phScore = scoreRange(bundle.soil.ph, candidate.optimalPh, 1.5);
    const socBonus = clamp((bundle.soil.socGKg - 12) * 0.8, -8, 10);
    const nFactor =
      candidate.family === 'legume'
        ? 6
        : clamp(((bundle.soil.nitrogenGKg ?? 1.5) - 1.3) * 4, -5, 7);
    const textureBonus = candidate.preferredTextures.includes(
      bundle.soil.textureClass
    )
      ? 10
      : 0;
    const soilSuitability = clamp(
      Math.round(phScore * 0.82 + 8 + socBonus + nFactor + textureBonus),
      20,
      99
    );

    // 4. Climate Stability
    const climateStability = clamp(
      Math.round(
        stabilityBase +
          (candidate.droughtTolerance - 0.5) * 14 -
          (candidate.id === 'rice' && avgAbsAnomaly > 18 ? 10 : 0)
      ),
      28,
      97
    );

    // 5. Farmer Labor Availability & Land Slope Fit
    const laborDiff =
      laborRank(candidate.laborIntensity) - laborRank(laborAvailability);
    const laborFits = laborDiff <= 0;
    const laborScore =
      laborDiff <= 0 ? 96 : laborDiff === 1 ? 66 : 38;

    const slopeSuitable =
      slopeClass === 'flat' ||
      (slopeClass === 'gentle' && candidate.erosionProtection >= 0.42) ||
      (slopeClass === 'steep' && candidate.erosionProtection >= 0.68);
    const slopeScore =
      slopeClass === 'flat'
        ? 95
        : slopeClass === 'gentle'
        ? Math.round(62 + candidate.erosionProtection * 36)
        : Math.round(32 + candidate.erosionProtection * 66);

    const laborAndSlopeFit = Math.round(laborScore * 0.55 + slopeScore * 0.45);

    // Base agronomic core for yield scaling
    const agronomicCore =
      rotation.score * 0.22 +
      moistureFit * 0.22 +
      thermalSolarFit * 0.24 +
      soilSuitability * 0.16 +
      climateStability * 0.07 +
      laborAndSlopeFit * 0.09;

    // 6. Yield & Economic ROI
    const nitrogenEffect =
      candidate.family === 'legume'
        ? 0.03
        : clamp(
            ((currentCrop.family === 'legume' ? 35 : 0) +
              sensitivity.nitrogenBoostKgHa) /
              450,
            -0.12,
            0.16
          );
    const tillageEffect = sensitivity.conservationTillage ? 0.04 : 0;
    const regionalYieldFactor = isTraditionalRegional
      ? 1.06 - Math.min(0.04, (regionalRank ?? 0) * 0.004)
      : 0.9;
    const suitabilityMultiplier =
      (0.55 + (agronomicCore / 100) * 0.6) * regionalYieldFactor;

    const expectedYieldTHa = Number(
      (
        candidate.baseYieldTHa *
        suitabilityMultiplier *
        (1 + nitrogenEffect + tillageEffect)
      ).toFixed(2)
    );
    const expectedYieldBuAc = Number(
      (expectedYieldTHa * candidate.buPerTonne * 0.404686).toFixed(1)
    );

    const estGrossRevenueUsdHa = Math.round(
      expectedYieldTHa * candidate.avgPriceUsdPerTonne
    );
    const nitrogenCostSavings =
      currentCrop.family === 'legume' && candidate.nitrogenBalanceKgHa < 0
        ? 45
        : 0;
    const missingEquipment = candidate.requiredEquipment.filter(
      (eq) => !ownedEquipment.includes(eq)
    );
    const customHireCost = missingEquipment.length * 85;
    const totalCostHa = Math.max(
      100,
      candidate.estInputCostUsdPerHa - nitrogenCostSavings + customHireCost
    );
    const estNetMarginUsdHa = Math.round(estGrossRevenueUsdHa - totalCostHa);
    const roiPct = clamp(
      Math.round((estNetMarginUsdHa / totalCostHa) * 100),
      -60,
      240
    );

    const economicViability: 'strong' | 'moderate' | 'tight' =
      roiPct >= 45 ? 'strong' : roiPct >= 15 ? 'moderate' : 'tight';

    // Regional Production Prevalence Score (Strong differentiation by region)
    const regionalPrevalenceScore =
      regionalRank !== null
        ? clamp(Math.round(98 - regionalRank * 2.5), 68, 98)
        : thermalSolarFit >= 75 && moistureFit >= 70
        ? 38
        : 22;

    const marginScore = clamp(Math.round(48 + roiPct * 0.38), 20, 96);
    const regionalEconomics = Math.round(
      regionalPrevalenceScore * 0.68 + marginScore * 0.32
    );

    const equipmentPenalty = prioritizeOwnedEquipment
      ? missingEquipment.length * 14
      : missingEquipment.length * 2;

    // Penalize ecologically incompatible crops sharply so non-viable plants drop cleanly
    const ecologicalGatePenalty =
      (thermalSolarFit < 42 ? (42 - thermalSolarFit) * 0.45 : 0) +
      (moistureFit < 40 ? (40 - moistureFit) * 0.35 : 0);

    const compositeScore = clamp(
      Math.round(
        rotation.score * 0.17 +
          moistureFit * 0.16 +
          thermalSolarFit * 0.18 +
          soilSuitability * 0.12 +
          climateStability * 0.05 +
          regionalEconomics * 0.24 +
          laborAndSlopeFit * 0.08 -
          equipmentPenalty -
          ecologicalGatePenalty
      ),
      10,
      99
    );

    const monoPenaltyFactor = candidate.id === currentCrop.id ? -12 : 1;
    const yieldGainVsMonoPct =
      candidate.id === currentCrop.id
        ? -12
        : Math.round(((compositeScore - 54) / 45) * 24 * monoPenaltyFactor);

    const confidenceIntervalTHa = Number(
      (expectedYieldTHa * (0.08 + (100 - climateStability) / 450)).toFixed(2)
    );

    const reasonKeys = [rotation.reason];
    if (isTraditionalRegional) reasonKeys.push('reason_traditional_market');
    if (economicViability === 'strong') reasonKeys.push('reason_economic_strong');
    if (!laborFits) reasonKeys.push('reason_labor_stretch');
    if (!slopeSuitable) reasonKeys.push('reason_slope_erosion');
    if (moistureFit >= 78) reasonKeys.push('reason_moisture_optimal');
    else if (moistureFit < 55) reasonKeys.push('reason_moisture_tight');
    if (missingEquipment.length > 0) reasonKeys.push('reason_equipment_needed');

    return {
      cropId: candidate.id,
      score: compositeScore,
      expectedYieldTHa,
      expectedYieldBuAc,
      confidenceIntervalTHa,
      yieldGainVsMonoPct,
      nitrogenDeltaKgHa: candidate.nitrogenBalanceKgHa,
      waterMatchPct: clamp(Math.round(waterRatio * 100), 25, 135),
      diseaseBreakRating: rotation.diseaseBreak,
      isTraditionalRegional,
      regionalRank: regionalRank !== null ? regionalRank + 1 : null,
      regionalPrevalenceScore,
      estGrossRevenueUsdHa,
      estNetMarginUsdHa,
      roiPct,
      economicViability,
      growingDays: candidate.growingDays,
      seasonFitsWindow,
      hardinessLevel,
      laborIntensity: candidate.laborIntensity,
      laborHoursPerHa: candidate.laborHoursPerHa,
      laborFits,
      slopeSuitable,
      historyConflict: rotation.historyConflict,
      requiredEquipment: candidate.requiredEquipment,
      missingEquipment,
      breakdown: {
        rotationSynergy: rotation.score,
        moistureFit,
        thermalSolarFit,
        soilSuitability,
        climateStability,
        regionalEconomics,
        laborAndSlopeFit,
      },
      reasonKeys,
    };
  });

  return predictions.sort((a, b) => b.score - a.score);
}

export function evaluateWeatherAlerts(
  bundle: FarmInsightBundle,
  thresholds: AlertThresholds
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  const frostDay = bundle.forecast16d.find(
    (d) => d.tempMinC <= thresholds.frostTempC
  );
  if (frostDay) {
    alerts.push({
      id: `frost-${frostDay.date}`,
      type: 'frost',
      severity: frostDay.tempMinC <= 0 ? 'critical' : 'warning',
      date: frostDay.date,
      metricValue: `${frostDay.tempMinC.toFixed(1)}°C`,
      titleKey: 'alert_frost_title',
      detailKey: 'alert_frost_detail',
      actionKey: 'alert_frost_action',
    });
  }

  const heatDay = bundle.forecast16d.find(
    (d) => d.tempMaxC >= thresholds.heatTempC
  );
  if (heatDay) {
    alerts.push({
      id: `heat-${heatDay.date}`,
      type: 'heat',
      severity: heatDay.tempMaxC >= thresholds.heatTempC + 3 ? 'critical' : 'warning',
      date: heatDay.date,
      metricValue: `${heatDay.tempMaxC.toFixed(1)}°C`,
      titleKey: 'alert_heat_title',
      detailKey: 'alert_heat_detail',
      actionKey: 'alert_heat_action',
    });
  }

  const heavyRainDay = bundle.forecast16d.find(
    (d) => d.precipMm >= thresholds.heavyRainMm
  );
  if (heavyRainDay) {
    alerts.push({
      id: `rain-${heavyRainDay.date}`,
      type: 'heavy_rain',
      severity:
        heavyRainDay.precipMm >= thresholds.heavyRainMm + 15
          ? 'critical'
          : 'warning',
      date: heavyRainDay.date,
      metricValue: `${Math.round(heavyRainDay.precipMm)} mm`,
      titleKey: 'alert_rain_title',
      detailKey: 'alert_rain_detail',
      actionKey: 'alert_rain_action',
    });
  }

  if (bundle.currentSnapshot.rootWetnessPct <= thresholds.droughtWetnessPct) {
    alerts.push({
      id: `drought-${bundle.location.id}`,
      type: 'drought',
      severity:
        bundle.currentSnapshot.rootWetnessPct <= thresholds.droughtWetnessPct - 8
          ? 'critical'
          : 'warning',
      date: bundle.forecast16d[0]?.date ?? new Date().toISOString().slice(0, 10),
      metricValue: `${Math.round(bundle.currentSnapshot.rootWetnessPct)}%`,
      titleKey: 'alert_drought_title',
      detailKey: 'alert_drought_detail',
      actionKey: 'alert_drought_action',
    });
  }

  return alerts;
}
