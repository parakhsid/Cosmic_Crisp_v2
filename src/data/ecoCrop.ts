import ecoCropRaw from './EcoCrop_DB.json';
import type {TranslationKey} from '../i18n/translations';
import type {
  CropFamily,
  CropSpec,
  EquipmentId,
  LaborAvailability,
} from '../types/agronomy';

export type EcoCropCategory =
  | 'Cereals'
  | 'Legumes'
  | 'Tubers & Roots'
  | 'Oilseeds & Fiber'
  | 'Vegetables & Specialty'
  | 'Fruits & Orchards'
  | 'Forage & Cover Crops';

export interface EcoCropRecord {
  cropId: string;
  ECO_ID: number;
  ScientificName: string;
  CommonName: string;
  CAT: EcoCropCategory;
  HABIT: string;
  LIFE_FORM: string;
  TOPMN: number;
  TOPMX: number;
  TMIN?: number;
  TMAX?: number;
  PHOPMN: number;
  PHOPMX: number;
  ROPMN: number;
  ROPMX: number;
  GMIN: number;
  GMAX: number;
  family: CropFamily;
  nitrogenBalanceKgHa: number;
  droughtTolerance: number;
  frostTolerance: number;
  erosionProtection: number;
  waterNeedMm: number;
  growingDays: number;
  baseYieldTHa: number;
  buPerTonne: number;
  avgPriceUsdPerTonne: number;
  estInputCostUsdPerHa: number;
  preferredTextures: string[];
  requiredEquipment: EquipmentId[];
  laborIntensity: LaborAvailability;
  laborHoursPerHa: number;
}

export const ECOCROP_RECORDS: EcoCropRecord[] = ecoCropRaw as EcoCropRecord[];

export const ECOCROP_BY_ID: Record<string, EcoCropRecord> = Object.fromEntries(
  ECOCROP_RECORDS.map((r) => [r.cropId, r])
);

export const ECOCROP_CATEGORY_ORDER: EcoCropCategory[] = [
  'Cereals',
  'Legumes',
  'Tubers & Roots',
  'Oilseeds & Fiber',
  'Vegetables & Specialty',
  'Fruits & Orchards',
  'Forage & Cover Crops',
];

export const ECOCROP_CATEGORY_LABEL_KEYS: Record<EcoCropCategory, TranslationKey> = {
  Cereals: 'crop_cat_cereals',
  Legumes: 'crop_cat_legumes',
  'Tubers & Roots': 'crop_cat_tubers',
  'Oilseeds & Fiber': 'crop_cat_oilseeds_fiber',
  'Vegetables & Specialty': 'crop_cat_vegetables',
  'Fruits & Orchards': 'crop_cat_orchards',
  'Forage & Cover Crops': 'crop_cat_forage',
};

export interface EcoCropCategoryGroup {
  category: EcoCropCategory;
  labelKey: TranslationKey;
  crops: EcoCropRecord[];
}

export const ECOCROP_GROUPS: EcoCropCategoryGroup[] = ECOCROP_CATEGORY_ORDER.map(
  (category) => ({
    category,
    labelKey: ECOCROP_CATEGORY_LABEL_KEYS[category],
    crops: ECOCROP_RECORDS.filter((r) => r.CAT === category),
  })
).filter((g) => g.crops.length > 0);

export function ecoRecordToCropSpec(rec: EcoCropRecord): CropSpec {
  return {
    id: rec.cropId,
    family: rec.family,
    category: rec.CAT,
    scientificName: rec.ScientificName,
    commonName: rec.CommonName,
    lifeForm: rec.LIFE_FORM,
    nitrogenBalanceKgHa: rec.nitrogenBalanceKgHa,
    optimalPh: [rec.PHOPMN, rec.PHOPMX],
    optimalTempC: [rec.TOPMN, rec.TOPMX],
    absTempC: [
      rec.TMIN ?? Math.max(-20, rec.TOPMN - 10),
      rec.TMAX ?? rec.TOPMX + 8,
    ],
    waterNeedMm: rec.waterNeedMm,
    growingDays: rec.growingDays,
    baseYieldTHa: rec.baseYieldTHa,
    buPerTonne: rec.buPerTonne,
    preferredTextures: rec.preferredTextures,
    droughtTolerance: rec.droughtTolerance,
    frostTolerance: rec.frostTolerance,
    avgPriceUsdPerTonne: rec.avgPriceUsdPerTonne,
    estInputCostUsdPerHa: rec.estInputCostUsdPerHa,
    requiredEquipment: rec.requiredEquipment,
    laborIntensity: rec.laborIntensity,
    laborHoursPerHa: rec.laborHoursPerHa,
    erosionProtection: rec.erosionProtection,
  };
}
