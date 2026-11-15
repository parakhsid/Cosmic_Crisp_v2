import {ECOCROP_BY_ID} from '../data/ecoCrop';
import type {
  ContingencyActionItem,
  EnsoPhase,
  EnsoScenarioMode,
  FarmInsightBundle,
  IrrigationDecisionResult,
  IrrigationMethodId,
  IrrigationMethodRecommendation,
  MonthlyIrrigationBalance,
  SeasonalEnsoOutlook,
  SeasonalOutlookMonth,
  SlopeClass,
  WaterScarcityLevel,
  WaterSourceType,
} from '../types/agronomy';

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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Estimates monthly potential reference evapotranspiration (mm/month)
 * via Hargreaves-calibrated solar & temperature curve when upstream ET0 isn't provided.
 */
export function estimateMonthlyEt0Mm(
  tempC: number,
  solarKwhM2: number,
  humidityPct: number,
  daysInMonth = 30
): number {
  const safeTemp = Number.isFinite(tempC) ? tempC : 18;
  const safeSolar = Number.isFinite(solarKwhM2) ? solarKwhM2 : 4.2;
  const rhFactor = 1 - clamp((humidityPct - 55) * 0.004, -0.18, 0.22);
  // Jensen-Haise / Hargreaves proxy calibrated for monthly AG ET0 (mm/day)
  const dailyMm = Math.max(
    0.7,
    0.0135 * (safeTemp + 17.8) * (safeSolar / 2.45) * rhFactor * 1.15
  );
  return Math.round(dailyMm * daysInMonth);
}

/**
 * Builds an offline/benchmark 6-month seasonal outlook from NASA POWER monthly normals
 * when live NOAA/Open-Meteo calls are unavailable.
 */
export function buildFallbackSeasonalOutlook(
  bundle: FarmInsightBundle
): SeasonalEnsoOutlook {
  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();
  const months: SeasonalOutlookMonth[] = [];

  for (let offset = 0; offset < 6; offset++) {
    const absMonth = startMonth + offset;
    const year = startYear + Math.floor(absMonth / 12);
    const monthIndex = absMonth % 12;
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const mc =
      bundle.monthlyClimate.find((m) => m.monthIndex === monthIndex) ??
      bundle.monthlyClimate[0];

    const normalPrecip = mc?.precipMm ?? 65;
    const normalTemp = mc?.tempC ?? 18;
    const solar = mc?.solarKwhM2 ?? 4.2;
    const rh = mc?.relativeHumidityPct ?? 62;
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const et0 = estimateMonthlyEt0Mm(normalTemp, solar, rh, days);

    months.push({
      monthKey,
      monthIndex,
      monthLabel: `${SHORT_MONTHS[monthIndex]} ${String(year).slice(-2)}`,
      precipMeanMm: Math.round(normalPrecip),
      precipP10Mm: Math.round(normalPrecip * 0.52),
      precipP90Mm: Math.round(normalPrecip * 1.65),
      normalPrecipMm: Math.round(normalPrecip),
      tempMeanC: Number(normalTemp.toFixed(1)),
      normalTempC: Number(normalTemp.toFixed(1)),
      et0Mm: et0,
      heavyRainDaysAvg: normalPrecip >= 130 ? 2.4 : normalPrecip >= 80 ? 1.1 : 0.3,
    });
  }

  return {
    fetchedAt: new Date().toISOString(),
    source: 'regional_benchmark',
    currentSeasonLabel: 'Historical Climatology Baseline',
    oniValueC: 0.0,
    oniTrendDeltaC: 0.0,
    phase: 'neutral',
    probabilities: {
      elNinoPct: 33,
      neutralPct: 44,
      laNinaPct: 23,
    },
    ensoSummaryNote:
      'Using NASA POWER 5-year monthly normals offline; toggle El Niño or La Niña scenarios below to stress-test water supply and flood drainage.',
    months,
  };
}

export interface TeleconnectionEffect {
  label: string;
  rainShiftPct: number;
  tempShiftC: number;
  stormBoost: number;
}

/**
 * Computes regional ENSO rainfall/temperature teleconnections from parcel coordinates
 * so El Niño / La Niña scenarios behave realistically across hemispheres & monsoon belts.
 */
export function resolveTeleconnection(
  lat: number,
  lon: number,
  scenario: EnsoPhase
): TeleconnectionEffect {
  if (scenario === 'neutral') {
    return {
      label: 'ENSO-Neutral baseline',
      rainShiftPct: 0,
      tempShiftC: 0,
      stormBoost: 1,
    };
  }

  // South & Southeast Asia / Indian monsoon & Australia belt
  const isMonsoonIndoPac = lon >= 65 && lon <= 155 && lat >= -40 && lat <= 38;
  // Western Americas / California / US West Coast / Gulf & Southern US
  const isSouthernUsWest = lon >= -126 && lon <= -75 && lat >= 24 && lat <= 38;
  // US Corn Belt / Northern Plains / Canada
  const isNorthernMidwest = lon >= -115 && lon <= -70 && lat > 38 && lat <= 55;
  // South America (Pampas Wet vs Northeast Brazil Dry)
  const isSouthAmericaSouth = lon >= -72 && lon <= -45 && lat <= -18;

  if (scenario === 'el_nino') {
    if (isMonsoonIndoPac) {
      return {
        label: 'El Niño weakens monsoon rainfall & raises peak ET0 demand',
        rainShiftPct: -24,
        tempShiftC: 1.4,
        stormBoost: 0.85,
      };
    }
    if (isSouthernUsWest || isSouthAmericaSouth) {
      return {
        label: 'El Niño amplifies storm tracks & heavy winter/spring rain risk',
        rainShiftPct: 32,
        tempShiftC: -0.3,
        stormBoost: 1.45,
      };
    }
    if (isNorthernMidwest) {
      return {
        label: 'El Niño warms northern soils early with episodic spring storms',
        rainShiftPct: 12,
        tempShiftC: 1.1,
        stormBoost: 1.2,
      };
    }
    return {
      label: 'El Niño shifts subtropical jet & elevates rainfall variability',
      rainShiftPct: 10,
      tempShiftC: 0.8,
      stormBoost: 1.18,
    };
  }

  // La Niña
  if (isMonsoonIndoPac) {
    return {
      label: 'La Niña intensifies monsoon deluges & floodwater drainage load',
      rainShiftPct: 28,
      tempShiftC: -0.5,
      stormBoost: 1.4,
    };
  }
  if (isSouthernUsWest || isSouthAmericaSouth) {
    return {
      label: 'La Niña dries southern storm tracks, raising irrigation scarcity',
      rainShiftPct: -28,
      tempShiftC: 1.3,
      stormBoost: 0.78,
    };
  }
  if (isNorthernMidwest) {
    return {
      label: 'La Niña sharpens continental drought risk & mid-season heat',
      rainShiftPct: -18,
      tempShiftC: 1.0,
      stormBoost: 0.88,
    };
  }
  return {
    label: 'La Niña favors drier spells with higher evaporative water demand',
    rainShiftPct: -16,
    tempShiftC: 0.9,
    stormBoost: 0.9,
  };
}

/**
 * Estimates crop coefficient (Kc) by month relative to growing season & harvest month.
 */
function estimateCropKcForMonth(
  cropId: string,
  monthIndex: number,
  harvestMonth: number
): number {
  const eco = ECOCROP_BY_ID[cropId];
  const cat = eco?.CAT ?? 'Cereals';
  const cycleMonths = clamp(Math.round((eco?.growingDays ?? 120) / 30), 2, 11);

  if (cat === 'Fruits & Orchards' || eco?.LIFE_FORM === 'Perennial') {
    // Perennial orchards/forage maintain canopy Kc 0.65–1.05 across warm months
    const distFromHarvest = (harvestMonth - monthIndex + 12) % 12;
    if (distFromHarvest >= 1 && distFromHarvest <= 4) return 1.02;
    if (distFromHarvest === 0) return 0.82;
    return 0.62;
  }

  const monthsBeforeHarvest = (harvestMonth - monthIndex + 12) % 12;
  if (monthsBeforeHarvest > cycleMonths) {
    // Off-season bare/cover soil evaporation coefficient
    return 0.42;
  }
  const progress = 1 - monthsBeforeHarvest / Math.max(1, cycleMonths);
  if (progress < 0.22) return 0.55; // Initial emergence
  if (progress < 0.45) return 0.82; // Vegetative canopy fill
  if (progress < 0.82) return cropId === 'rice' ? 1.18 : 1.08; // Flowering / grain fill peak
  return 0.74; // Maturation / dry-down
}

/**
 * Derives soil available water capacity (mm/m) and storm runoff loss factor from SoilGrids + slope.
 */
function computeSoilHydrology(bundle: FarmInsightBundle, slopeClass: SlopeClass): {
  awcMmPerM: number;
  effectiveRainRatio: number;
  drainageBottleneck: number; // 0..1 higher = poorly drained clay flat
} {
  const clay = bundle.soil.clayPct ?? 25;
  const sand = bundle.soil.sandPct ?? 35;
  const soc = bundle.soil.socGKg ?? 16;

  // Saxton-Rawls style AWC proxy (mm/m) boosted by organic carbon
  const rawAwc = 135 + clay * 0.45 - sand * 0.72 + Math.min(28, soc * 0.8);
  const awcMmPerM = Math.round(clamp(rawAwc, 65, 225));

  const slopePenalty =
    slopeClass === 'steep' ? 0.2 : slopeClass === 'gentle' ? 0.08 : 0.0;
  const clayRunoffPenalty = clay >= 36 ? 0.09 : 0;
  const effectiveRainRatio = clamp(0.86 - slopePenalty - clayRunoffPenalty, 0.54, 0.9);

  const drainageBottleneck = clamp(
    (clay >= 35 ? 0.55 : clay >= 27 ? 0.3 : 0.12) +
      (slopeClass === 'flat' ? 0.25 : 0.05),
    0.1,
    0.92
  );

  return {awcMmPerM, effectiveRainRatio, drainageBottleneck};
}

export function evaluateIrrigationPlan(params: {
  bundle: FarmInsightBundle;
  outlook: SeasonalEnsoOutlook | null;
  cropId: string;
  harvestMonth: number;
  areaAcres: number;
  slopeClass: SlopeClass;
  scenarioMode: EnsoScenarioMode;
  scarcityLevel: WaterScarcityLevel;
  waterSource: WaterSourceType;
}): IrrigationDecisionResult {
  const {
    bundle,
    cropId,
    harvestMonth,
    slopeClass,
    scenarioMode,
    scarcityLevel,
    waterSource,
  } = params;

  const baseOutlook = params.outlook ?? buildFallbackSeasonalOutlook(bundle);
  const activeScenario: EnsoPhase =
    scenarioMode === 'live' ? baseOutlook.phase : scenarioMode;

  const tele = resolveTeleconnection(
    bundle.location.lat,
    bundle.location.lon,
    activeScenario
  );
  // If using Live Outlook, seasonal ensemble already embeds much of current ENSO forcing;
  // apply partial teleconnection confirmation or full delta when user explicitly stress-tests.
  const stressFactor = scenarioMode === 'live' ? 0.35 : 1.0;
  const hydro = computeSoilHydrology(bundle, slopeClass);
  const eco = ECOCROP_BY_ID[cropId];

  let total6MoPrecipMm = 0;
  let total6MoCropEtcMm = 0;
  let total6MoIrrigationNeedMm = 0;
  let total6MoDrainageSurplusMm = 0;
  let floodAlertMonths = 0;
  let droughtAlertMonths = 0;

  const monthlyBalances: MonthlyIrrigationBalance[] = baseOutlook.months
    .slice(0, 6)
    .map((m) => {
      const rainScale = 1 + (tele.rainShiftPct / 100) * stressFactor;
      const tempShift = tele.tempShiftC * stressFactor;

      const forecastPrecipMm = Math.max(2, Math.round(m.precipMeanMm * rainScale));
      const p10PrecipMm = Math.max(1, Math.round(m.precipP10Mm * rainScale));
      const p90PrecipMm = Math.max(
        forecastPrecipMm + 12,
        Math.round(m.precipP90Mm * rainScale * (scenarioMode === 'live' ? 1 : tele.stormBoost))
      );

      const tempC = Number((m.tempMeanC + tempShift).toFixed(1));
      const et0Adjusted = Math.max(
        18,
        Math.round(m.et0Mm * (1 + tempShift * 0.032))
      );

      const cropKc = Number(
        estimateCropKcForMonth(cropId, m.monthIndex, harvestMonth).toFixed(2)
      );
      const cropEtcMm = Math.round(et0Adjusted * cropKc);
      const effectiveRainMm = Math.round(
        forecastPrecipMm * hydro.effectiveRainRatio
      );
      const netBalanceMm = effectiveRainMm - cropEtcMm;

      const irrigationNeedMm = netBalanceMm < 0 ? Math.abs(netBalanceMm) : 0;
      const drainageSurplusMm =
        netBalanceMm > 25 ? Math.round(netBalanceMm - 20) : 0;

      const heavyStormRisk =
        p90PrecipMm >= 175 ||
        drainageSurplusMm >= 55 ||
        (m.heavyRainDaysAvg * tele.stormBoost >= 2.2 && hydro.drainageBottleneck >= 0.45);

      const floodRisk: 'low' | 'moderate' | 'high' =
        drainageSurplusMm >= 70 || p90PrecipMm >= 210
          ? 'high'
          : heavyStormRisk || drainageSurplusMm >= 30
          ? 'moderate'
          : 'low';

      const droughtRisk: 'low' | 'moderate' | 'high' =
        irrigationNeedMm >= 85 ||
        (irrigationNeedMm >= 55 && scarcityLevel === 'severe')
          ? 'high'
          : irrigationNeedMm >= 40 || p10PrecipMm < 18
          ? 'moderate'
          : 'low';

      if (floodRisk !== 'low') floodAlertMonths++;
      if (droughtRisk !== 'low') droughtAlertMonths++;

      total6MoPrecipMm += forecastPrecipMm;
      total6MoCropEtcMm += cropEtcMm;
      total6MoIrrigationNeedMm += irrigationNeedMm;
      total6MoDrainageSurplusMm += drainageSurplusMm;

      let recommendedFocus: IrrigationMethodId = 'sprinkler';
      let actionSummary = 'Maintain standard schedule';

      if (floodRisk === 'high') {
        recommendedFocus = 'drainage';
        actionSummary =
          'Open drainage furrows, halt irrigation, capture runoff in retention basin';
      } else if (droughtRisk === 'high' && scarcityLevel !== 'abundant') {
        recommendedFocus =
          eco?.CAT === 'Fruits & Orchards' ? 'drip' : 'rain_pipes';
        actionSummary =
          recommendedFocus === 'rain_pipes'
            ? 'Deploy Rain Pipes at dawn/dusk; split deficit irrigation passes'
            : 'Run pulsed drip cycles at root zone with soil moisture check';
      } else if (irrigationNeedMm > 25) {
        recommendedFocus =
          scarcityLevel === 'severe'
            ? eco?.CAT === 'Fruits & Orchards'
              ? 'drip'
              : 'rain_pipes'
            : scarcityLevel === 'moderate'
            ? 'rain_pipes'
            : 'sprinkler';
        actionSummary = `Supplement net deficit (${cropKc >= 1 ? 'peak canopy Kc' : 'vegetative stage'})`;
      } else if (floodRisk === 'moderate') {
        recommendedFocus = 'drainage';
        actionSummary =
          'Check field outlet ditches before P90 storm band arrives';
      }

      const normal = Math.max(10, m.normalPrecipMm);
      const precipAnomalyPct = Math.round(
        ((forecastPrecipMm - normal) / normal) * 100
      );

      return {
        monthKey: m.monthKey,
        monthIndex: m.monthIndex,
        monthLabel: m.monthLabel,
        forecastPrecipMm,
        p10PrecipMm,
        p90PrecipMm,
        normalPrecipMm: m.normalPrecipMm,
        precipAnomalyPct,
        tempC,
        et0Mm: et0Adjusted,
        cropKc,
        cropEtcMm,
        effectiveRainMm,
        netBalanceMm,
        irrigationNeedMm,
        drainageSurplusMm,
        floodRisk,
        droughtRisk,
        actionSummary,
        recommendedFocus,
      };
    });

  // Score all 5 irrigation & contingency systems
  const baselineFurrowGross = Math.round(total6MoIrrigationNeedMm / 0.54);
  const isOrchardOrVeg =
    eco?.CAT === 'Fruits & Orchards' || eco?.CAT === 'Vegetables & Specialty';
  const isPaddyRice = cropId === 'rice';
  const isSteep = slopeClass === 'steep';
  const isSandy = (bundle.soil.sandPct ?? 35) >= 55;
  const highFloodExposure =
    floodAlertMonths >= 2 || total6MoDrainageSurplusMm >= 110;
  const highScarcity =
    scarcityLevel === 'severe' || droughtAlertMonths >= 3;

  const rawMethods: Array<{
    methodId: IrrigationMethodId;
    name: string;
    shortLabel: string;
    effPct: number;
    capexHa: number;
    opexHa: number;
    scarcityFit: 'optimal' | 'good' | 'poor';
    floodResilience: 'high' | 'moderate' | 'low';
    score: number;
    rationale: string;
    bestUseCase: string;
    contingencyNote: string;
  }> = [
    {
      methodId: 'rain_pipes',
      name: 'Rain Pipes (Perforated Micro-Spray)',
      shortLabel: 'Rain Pipes',
      effPct: 82,
      capexHa: 540,
      opexHa: 95,
      scarcityFit: 'optimal',
      floodResilience: 'high',
      score:
        72 +
        (scarcityLevel === 'severe' ? 20 : scarcityLevel === 'moderate' ? 16 : 2) +
        (waterSource === 'well' || waterSource === 'rain_harvest' ? 7 : 4) +
        (isSandy ? 5 : 0) +
        (isSteep ? -4 : 4) +
        (isPaddyRice ? -14 : 3),
      rationale:
        'Low-head flexible Rain Pipe laterals deliver fine gentle micro-droplets with ~82% efficiency—cutting evaporation 34% vs. flood and rolling up swiftly before heavy El Niño storms.',
      bestUseCase:
        'Ideal for water-scarce row crops, legumes, vegetables, and limited pump/capital setups.',
      contingencyNote:
        'Quickly uncouple and coil laterals ahead of floodwater surges; flush sediment screens after canal/rain-pond recharge.',
    },
    {
      methodId: 'drip',
      name: 'Drip / Subsurface Drip (SDI)',
      shortLabel: 'Drip / SDI',
      effPct: 92,
      capexHa: 1850,
      opexHa: 135,
      scarcityFit: 'optimal',
      floodResilience: 'moderate',
      score:
        68 +
        (scarcityLevel === 'severe' ? 22 : scarcityLevel === 'moderate' ? 10 : -4) +
        (isOrchardOrVeg ? 14 : 2) +
        (isSteep ? 10 : 2) +
        (waterSource === 'canal' ? -6 : 4) +
        (isPaddyRice ? -24 : 0),
      rationale:
        'Delivers pressurized water directly to the root zone at ~92% efficiency with near-zero wind drift or surface evaporation.',
      bestUseCase:
        'Best for severe multi-month water deficits, orchards (apples, grapes, almonds), and sloped parcels.',
      contingencyNote:
        waterSource === 'canal'
          ? 'Requires sand media + disc filtration during muddy El Niño canal runoff to stop emitter clogging.'
          : 'Flush lateral end-caps after heavy rain inundation to expel silt.',
    },
    {
      methodId: 'sprinkler',
      name: 'Center Pivot / Overhead Sprinkler',
      shortLabel: 'Sprinkler',
      effPct: 76,
      capexHa: 1450,
      opexHa: 165,
      scarcityFit: 'good',
      floodResilience: 'moderate',
      score:
        64 +
        (scarcityLevel === 'abundant' ? 14 : scarcityLevel === 'moderate' ? 7 : -10) +
        (!isOrchardOrVeg && !isPaddyRice ? 10 : -4) +
        (slopeClass === 'flat' ? 7 : slopeClass === 'gentle' ? 3 : -12),
      rationale:
        'Automated uniform coverage (~76% efficiency) with low field labor per acre for broadacre cereals and oilseeds.',
      bestUseCase:
        'Broadacre corn, wheat, soybeans, and hay on flat to gently rolling fields with steady well/canal flow.',
      contingencyNote:
        'Switch to low-elevation spray heads (LEPA) during windy hot spells; shut off end-guns before forecasted storm fronts.',
    },
    {
      methodId: 'furrow',
      name: 'Furrow / Surface Flood Irrigation',
      shortLabel: 'Furrow / Flood',
      effPct: 54,
      capexHa: 280,
      opexHa: 115,
      scarcityFit: 'poor',
      floodResilience: 'moderate',
      score:
        48 +
        (scarcityLevel === 'abundant' ? 18 : scarcityLevel === 'moderate' ? -14 : -32) +
        (isPaddyRice ? 28 : 0) +
        (slopeClass === 'flat' ? 8 : -24) +
        (isSandy ? -14 : 4),
      rationale:
        'Lowest upfront hardware cost, but ~46% water is lost to deep percolation and surface evaporation under dry conditions.',
      bestUseCase:
        'Level clay-loam soils with abundant canal water or paddy rice basins.',
      contingencyNote:
        'Keep tailwater ditches laser-graded so furrows double as emergency stormwater drains during excess El Niño rains.',
    },
    {
      methodId: 'drainage',
      name: 'Contour / Subsurface Drainage + Rain Harvesting',
      shortLabel: 'Drainage + Harvest',
      effPct: 86,
      capexHa: 920,
      opexHa: 65,
      scarcityFit: waterSource === 'rain_harvest' ? 'optimal' : 'good',
      floodResilience: 'high',
      score:
        55 +
        (highFloodExposure ? 32 : floodAlertMonths === 1 ? 14 : -4) +
        (waterSource === 'rain_harvest' ? 16 : 4) +
        (hydro.drainageBottleneck >= 0.5 ? 10 : 0) +
        (highScarcity && total6MoDrainageSurplusMm < 30 ? -6 : 4),
      rationale:
        'Prevents root-zone hypoxia and nitrogen leaching during heavy ENSO storm surplus while routing excess runoff into lined farm ponds for Rain Pipe or Drip reuse.',
      bestUseCase:
        'El Niño / La Niña wet-phase flood contingency, heavy clay flats, and rainwater-harvesting farms.',
      contingencyNote:
        'Pair lined retention ponds with gravity-fed or low-head Rain Pipes so storm surplus offsets dry-month deficits.',
    },
  ];

  const methods: IrrigationMethodRecommendation[] = rawMethods
    .map((m) => {
      const score = Math.round(clamp(m.score, 18, 98));
      const seasonalAppliedWaterMm = Math.round(
        total6MoIrrigationNeedMm / (m.effPct / 100)
      );
      const waterSavedVsFurrowPct = Math.max(
        0,
        Math.round(
          ((baselineFurrowGross - seasonalAppliedWaterMm) /
            Math.max(1, baselineFurrowGross)) *
            100
        )
      );
      return {
        methodId: m.methodId,
        name: m.name,
        shortLabel: m.shortLabel,
        score,
        applicationEfficiencyPct: m.effPct,
        seasonalAppliedWaterMm,
        waterSavedVsFurrowPct,
        scarcityFit: m.scarcityFit,
        floodResilience: m.floodResilience,
        estCapexUsdPerHa: m.capexHa,
        estSeasonalOpexUsdPerHa: m.opexHa,
        rationale: m.rationale,
        bestUseCase: m.bestUseCase,
        contingencyNote: m.contingencyNote,
      };
    })
    .sort((a, b) => b.score - a.score);

  const topMethod = methods[0];

  // Build tailored scarcity + flood + ENSO contingency actions
  const contingencyActions: ContingencyActionItem[] = [
    {
      id: 'act-rain-pipes-scarcity',
      category: 'scarcity',
      priority: scarcityLevel === 'severe' || droughtAlertMonths >= 2 ? 'critical' : 'high',
      title: 'Stage Rain Pipe micro-spray laterals for low-pressure water conservation',
      detail:
        'Space portable perforated Rain Pipe lines every 16–20 ft (5–6 m) and irrigate between 5:00–9:00 AM or after dusk to eliminate 30–38% daytime wind-drift evaporation.',
      targetTiming: 'Before peak ETc deficit month',
    },
    {
      id: 'act-drainage-outlets',
      category: 'flood',
      priority: floodAlertMonths >= 1 || total6MoDrainageSurplusMm >= 40 ? 'critical' : 'moderate',
      title: 'Clear perimeter ditches, tile outlets, and emergency relief furrows',
      detail:
        'Remove silt and crop residue from field headlands and culverts before P90 heavy-rain bands arrive so standing water clears within 24 hours without drowning roots.',
      targetTiming: 'Pre-storm / 30 days ahead of wet peak',
    },
    {
      id: 'act-retention-harvest',
      category: 'flood',
      priority: total6MoDrainageSurplusMm > 25 || waterSource === 'rain_harvest' ? 'high' : 'moderate',
      title: 'Capture excess rainfall runoff into lined retention ponds for dry-spell reuse',
      detail:
        'Divert surplus storm drainage through a silt-trap weir into farm storage, then gravity- or booster-feed Rain Pipes or Drip lines during subsequent dry weeks.',
      targetTiming: 'Continuous wet-to-dry transition',
    },
    {
      id: 'act-deficit-scheduling',
      category: 'scarcity',
      priority: droughtAlertMonths >= 2 ? 'high' : 'moderate',
      title: 'Prioritize water allocation during flowering & yield-formation Kc peaks',
      detail:
        'When allocation is capped, concentrate Rain Pipe / Drip passes on peak-Kc reproductive stages and apply straw/cover-crop mulch to curb bare-soil evaporation by 15–20%.',
      targetTiming: 'Mid-season canopy & reproductive window',
    },
    {
      id: 'act-enso-fertilizer-split',
      category: 'enso',
      priority: 'high',
      title:
        activeScenario === 'el_nino'
          ? 'Split nitrogen applications around El Niño heavy-rain forecasts'
          : activeScenario === 'la_nina'
          ? 'Monitor deep root moisture weekly for La Niña heat/drought intensification'
          : 'Calibrate irrigation timer weekly against live 16-day ET0 & rain forecasts',
      detail:
        activeScenario === 'el_nino'
          ? 'Avoid single heavy pre-plant fertilizer passes ahead of P90 storm months to prevent nitrate leaching and runoff loss.'
          : activeScenario === 'la_nina'
          ? 'Maintain a 20% soil-moisture reserve buffer in the top 12 in (30 cm) and verify backup pump intake depth.'
          : 'Adjust application frequency every 7 days using Cosmic Crisp live forecast rainfall subtraction.',
      targetTiming: 'Monthly ENSO outlook review',
    },
  ];

  return {
    activeScenario,
    teleconnectionLabel: tele.label,
    teleconnectionRainShiftPct: Math.round(tele.rainShiftPct * stressFactor),
    teleconnectionTempShiftC: Number((tele.tempShiftC * stressFactor).toFixed(1)),
    soilAwcMmPerM: hydro.awcMmPerM,
    total6MoPrecipMm,
    total6MoCropEtcMm,
    total6MoIrrigationNeedMm,
    total6MoDrainageSurplusMm,
    floodAlertMonths,
    droughtAlertMonths,
    monthlyBalances,
    methods,
    topMethod,
    contingencyActions,
  };
}
