import {
  Apple,
  Bean,
  Carrot,
  Check,
  ChevronDown,
  Flower2,
  Leaf,
  Search,
  Sprout,
  Wheat,
} from 'lucide-react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  ECOCROP_BY_ID,
  ECOCROP_GROUPS,
  type EcoCropCategory,
  type EcoCropRecord,
} from '../data/ecoCrop';
import {cropLabel, t} from '../i18n/translations';
import type {LanguageCode} from '../types/agronomy';
import {
  getCropFallbackPhoto,
  getCropPhoto,
  ResilientPhoto,
} from './VisualAssets';

interface CropSelectorDropdownProps {
  id?: string;
  lang: LanguageCode;
  value: string;
  onChange: (cropId: string) => void;
}

export function EcoCategoryIcon({
  category,
  className = 'h-4 w-4 shrink-0',
}: {
  category: EcoCropCategory;
  className?: string;
}) {
  switch (category) {
    case 'Cereals':
      return <Wheat className={`${className} text-[#B45309]`} aria-hidden="true" />;
    case 'Legumes':
      return <Bean className={`${className} text-[#15803D]`} aria-hidden="true" />;
    case 'Tubers & Roots':
      return <Carrot className={`${className} text-[#9A3412]`} aria-hidden="true" />;
    case 'Oilseeds & Fiber':
      return <Flower2 className={`${className} text-[#0369A1]`} aria-hidden="true" />;
    case 'Vegetables & Specialty':
      return <Sprout className={`${className} text-[#0D9488]`} aria-hidden="true" />;
    case 'Fruits & Orchards':
      return <Apple className={`${className} text-[#DC2626]`} aria-hidden="true" />;
    case 'Forage & Cover Crops':
      return <Leaf className={`${className} text-[#4D7C0F]`} aria-hidden="true" />;
  }
}

function formatEcoSummary(rec: EcoCropRecord): string {
  return `${rec.GMIN}–${rec.GMAX}d · ${rec.TOPMN}–${rec.TOPMX}°C · pH ${rec.PHOPMN}–${rec.PHOPMX}`;
}

export function CropSelectorDropdown({
  id = 'current-crop-select',
  lang,
  value,
  onChange,
}: CropSelectorDropdownProps) {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = ECOCROP_BY_ID[value] ?? ECOCROP_GROUPS[0]?.crops[0];

  const filteredGroups = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return ECOCROP_GROUPS;
    return ECOCROP_GROUPS.map((g) => ({
      ...g,
      crops: g.crops.filter(
        (rec) =>
          cropLabel(lang, rec.cropId).toLowerCase().includes(q) ||
          rec.CommonName.toLowerCase().includes(q) ||
          rec.ScientificName.toLowerCase().includes(q) ||
          rec.CAT.toLowerCase().includes(q)
      ),
    })).filter((g) => g.crops.length > 0);
  }, [filterText, lang]);

  useEffect(() => {
    if (!open) {
      setFilterText('');
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const totalSpecies = ECOCROP_GROUPS.reduce((s, g) => s + g.crops.length, 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-left transition-colors hover:border-[#94A3B8] focus:border-[#15803D] focus:outline-none cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selected && (
            <ResilientPhoto
              src={getCropPhoto(selected.cropId)}
              fallbackSrc={getCropFallbackPhoto(selected.cropId)}
              alt={cropLabel(lang, selected.cropId)}
              className="h-8 w-8 shrink-0 rounded-md border border-[#E2E8F0]"
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#0F172A]">
              {cropLabel(lang, value)}
            </span>
            {selected && (
              <span className="block truncate font-mono-tabular text-[11px] text-[#64748B]">
                {selected.CAT} · {selected.GMIN}–{selected.GMAX}d ·{' '}
                {selected.TOPMN}–{selected.TOPMX}°C
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t(lang, 'label_current_crop')}
          className="absolute z-30 mt-1.5 w-full rounded-xl border border-[#CBD5E1] bg-white shadow-xl"
        >
          <div className="border-b border-[#E2E8F0] p-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="text"
                autoFocus
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={`Filter ${totalSpecies} EcoCrop plants...`}
                className="w-full rounded-md border border-[#CBD5E1] bg-[#F8FAFC] py-1.5 pl-8 pr-3 text-xs text-[#0F172A] placeholder:text-[#64748B] focus:border-[#15803D] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-auto py-1">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#64748B]">
                No EcoCrop species match &ldquo;{filterText}&rdquo;
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.category} className="py-0.5">
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-y border-[#F1F5F9] bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                    <span className="flex items-center gap-1.5">
                      <EcoCategoryIcon
                        category={group.category}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span>{t(lang, group.labelKey)}</span>
                    </span>
                    <span className="font-mono-tabular text-[10px] font-semibold text-[#64748B]">
                      {group.crops.length}
                    </span>
                  </div>

                  <div className="divide-y divide-[#F8FAFC]">
                    {group.crops.map((rec) => {
                      const isSelected = rec.cropId === value;
                      return (
                        <button
                          key={rec.cropId}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange(rec.cropId);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#F0FDF4] text-[#0F172A]'
                              : 'hover:bg-[#F8FAFC] text-[#0F172A]'
                          }`}
                        >
                          <ResilientPhoto
                            src={getCropPhoto(rec.cropId)}
                            fallbackSrc={getCropFallbackPhoto(rec.cropId)}
                            alt={cropLabel(lang, rec.cropId)}
                            loading="lazy"
                            className="h-8 w-8 shrink-0 rounded-md border border-[#E2E8F0]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-1.5">
                              <span
                                className={`truncate text-sm ${
                                  isSelected
                                    ? 'font-bold text-[#15803D]'
                                    : 'font-medium'
                                }`}
                              >
                                {cropLabel(lang, rec.cropId)}
                              </span>
                              <span className="truncate text-[11px] italic text-[#64748B]">
                                {rec.ScientificName}
                              </span>
                            </span>
                            <span className="mt-0.5 block font-mono-tabular text-[11px] text-[#64748B]">
                              {formatEcoSummary(rec)}
                            </span>
                          </span>

                          {isSelected && (
                            <Check
                              className="h-4 w-4 shrink-0 text-[#15803D]"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[10px] text-[#64748B]">
            FAO EcoCrop_DB ({totalSpecies} species · cycle days, T_opt, pH_opt)
          </div>
        </div>
      )}
    </div>
  );
}
