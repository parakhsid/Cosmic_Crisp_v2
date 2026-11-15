import {Sprout} from 'lucide-react';
import {useState} from 'react';
import {ECOCROP_BY_ID} from '../data/ecoCrop';
import cropGrainImg from '../assets/images/crop_grain_fields_1794707225601.jpg';
import cropLegumeImg from '../assets/images/crop_legume_soy_1794707225412.jpg';
import cropSpecialtyImg from '../assets/images/crop_specialty_harvest_1794707226671.jpg';
import heroFarmlandImg from '../assets/images/hero_farmland_banner_1794707224087.jpg';
import soilHealthImg from '../assets/images/soil_health_profile_1794707227127.jpg';

export const VISUAL_ASSETS = {
  heroFarmland: heroFarmlandImg,
  cropLegume: cropLegumeImg,
  cropGrain: cropGrainImg,
  cropSpecialty: cropSpecialtyImg,
  soilHealth: soilHealthImg,
};

export function getCropPhoto(cropId: string): string {
  const eco = ECOCROP_BY_ID[cropId];
  const cat = eco?.CAT;
  if (cat === 'Legumes' || cat === 'Forage & Cover Crops') {
    return cropLegumeImg;
  }
  if (
    cat === 'Oilseeds & Fiber' ||
    cat === 'Tubers & Roots' ||
    cat === 'Vegetables & Specialty' ||
    cat === 'Fruits & Orchards'
  ) {
    return cropSpecialtyImg;
  }
  if (['soybeans', 'chickpeas', 'alfalfa'].includes(cropId)) {
    return cropLegumeImg;
  }
  if (['canola', 'sunflower', 'cotton', 'potatoes'].includes(cropId)) {
    return cropSpecialtyImg;
  }
  return cropGrainImg;
}

interface ResilientPhotoProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function ResilientPhoto({
  src,
  alt,
  className = '',
  fallbackTitle,
}: ResilientPhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#DCFCE7] via-[#F0FDF4] to-[#E2E8F0] text-[#15803D] ${className}`}
      >
        <Sprout className="h-8 w-8" aria-hidden="true" />
        {fallbackTitle && (
          <span className="mt-2 text-xs font-semibold text-[#0F172A]">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

interface CircularGaugeProps {
  value: number;
  max?: number;
  displayValue: string;
  label: string;
  sublabel?: string;
  color?: string;
  size?: number;
}

export function CircularGauge({
  value,
  max = 100,
  displayValue,
  label,
  sublabel,
  color = '#15803D',
  size = 88,
}: CircularGaugeProps) {
  const strokeWidth = 8;
  const safeSize = Number.isFinite(size) && size > 20 ? size : 88;
  const radius = (safeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const safeMax = typeof max === 'number' && Number.isFinite(max) && max > 0 ? max : 100;
  const ratio = Math.max(0, Math.min(1, safeValue / safeMax));
  const dashOffset = Number((circumference * (1 - ratio)).toFixed(2));

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{width: safeSize, height: safeSize}}>
        <svg
          width={safeSize}
          height={safeSize}
          viewBox={`0 0 ${safeSize} ${safeSize}`}
          className="-rotate-90"
        >
          <circle
            cx={safeSize / 2}
            cy={safeSize / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={safeSize / 2}
            cy={safeSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={Number(circumference.toFixed(2))}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono-tabular text-base font-extrabold text-[#0F172A]">
            {displayValue}
          </span>
        </div>
      </div>
      <span className="mt-1.5 text-xs font-semibold text-[#0F172A]">{label}</span>
      {sublabel && <span className="text-[11px] text-[#64748B]">{sublabel}</span>}
    </div>
  );
}
