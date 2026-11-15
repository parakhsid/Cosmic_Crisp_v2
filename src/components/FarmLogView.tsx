import {ArrowRight, PlusCircle, Trash2} from 'lucide-react';
import {useState} from 'react';
import {ECOCROP_GROUPS} from '../data/ecoCrop';
import {cropLabel, t} from '../i18n/translations';
import {
  acresToHa,
  formatArea,
  haToAcres,
  tHaToTonsAc,
  tonsAcToTHa,
  type UnitSystem,
} from '../lib/units';
import type {
  FarmInsightBundle,
  HarvestLogEntry,
  LanguageCode,
} from '../types/agronomy';

interface FarmLogViewProps {
  lang: LanguageCode;
  unit: UnitSystem;
  bundle: FarmInsightBundle | null;
  logs: HarvestLogEntry[];
  onAddLog: (entry: Omit<HarvestLogEntry, 'id'>) => void;
  onDeleteLog: (id: string) => void;
  onPredictFromLog: (cropId: string) => void;
}

export function FarmLogView({
  lang,
  unit,
  bundle,
  logs,
  onAddLog,
  onDeleteLog,
  onPredictFromLog,
}: FarmLogViewProps) {
  const [cropId, setCropId] = useState('corn');
  const [harvestDate, setHarvestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [areaAcres, setAreaAcres] = useState(80);
  const [actualYieldTHa, setActualYieldTHa] = useState(8.5);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddLog({
      locationKey: bundle?.location.id ?? 'story-ia',
      locationName: bundle?.location.name ?? 'Story County, Iowa',
      cropId,
      harvestDate,
      areaAcres,
      actualYieldTHa,
      notes: notes.trim(),
    });
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#0F172A] text-balance">
          {t(lang, 'log_title')}
        </h1>
        <p className="mt-1 text-sm text-[#475569]">{t(lang, 'log_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-[#0F172A]">
            {t(lang, 'log_form_title')}
          </h2>

          <div>
            <label
              htmlFor="log-crop"
              className="block text-xs font-semibold text-[#334155] mb-1.5"
            >
              {t(lang, 'label_current_crop')}
            </label>
            <select
              id="log-crop"
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 text-sm text-[#0F172A]"
            >
              {ECOCROP_GROUPS.map((group) => (
                <optgroup key={group.category} label={t(lang, group.labelKey)}>
                  {group.crops.map((c) => (
                    <option key={c.cropId} value={c.cropId}>
                      {cropLabel(lang, c.cropId)} ({c.ScientificName})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="log-date"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {t(lang, 'label_harvest_date')}
              </label>
              <input
                id="log-date"
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
              />
            </div>

            <div>
              <label
                htmlFor="log-yield"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {unit === 'imperial'
                  ? t(lang, 'label_actual_yield_tons_ac')
                  : t(lang, 'label_actual_yield')}
              </label>
              <input
                id="log-yield"
                type="number"
                step="0.1"
                min={0.1}
                value={
                  unit === 'imperial'
                    ? Number(tHaToTonsAc(actualYieldTHa).toFixed(2))
                    : actualYieldTHa
                }
                onChange={(e) => {
                  const val = Math.max(0.1, Number(e.target.value) || 0.1);
                  setActualYieldTHa(
                    unit === 'imperial' ? Number(tonsAcToTHa(val).toFixed(2)) : val
                  );
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="log-area"
              className="block text-xs font-semibold text-[#334155] mb-1.5"
            >
              {unit === 'metric'
                ? t(lang, 'label_field_area_ha')
                : t(lang, 'label_field_area')}
            </label>
            <input
              id="log-area"
              type="number"
              min={1}
              value={
                unit === 'metric'
                  ? Math.max(1, Math.round(acresToHa(areaAcres)))
                  : Math.round(areaAcres)
              }
              onChange={(e) => {
                const val = Math.max(1, Number(e.target.value) || 1);
                setAreaAcres(
                  unit === 'metric' ? Math.max(1, Math.round(haToAcres(val))) : val
                );
              }}
              className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
            />
          </div>

          <div>
            <label
              htmlFor="log-notes"
              className="block text-xs font-semibold text-[#334155] mb-1.5"
            >
              {t(lang, 'label_notes')}
            </label>
            <textarea
              id="log-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-[#CBD5E1] p-3 text-sm text-[#0F172A]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534] cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t(lang, 'btn_add_log')}
          </button>
        </form>

        <div className="lg:col-span-7 rounded-xl border border-[#E2E8F0] bg-white p-6">
          {logs.length === 0 ? (
            <p className="text-sm text-[#64748B]">{t(lang, 'no_logs')}</p>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-bold text-[#0F172A]">
                        {cropLabel(lang, entry.cropId)}
                      </span>
                      <span className="text-xs text-[#64748B]">·</span>
                      <span className="font-mono-tabular text-xs text-[#475569]">
                        {entry.harvestDate}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[#475569] font-mono-tabular">
                      {entry.locationName} · {formatArea(entry.areaAcres, unit)} ·{' '}
                      {unit === 'imperial'
                        ? `${tHaToTonsAc(entry.actualYieldTHa).toFixed(2)} tons/ac`
                        : `${entry.actualYieldTHa.toFixed(1)} t/ha`}
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-xs text-[#64748B]">{entry.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPredictFromLog(entry.cropId)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#15803D] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7] cursor-pointer"
                    >
                      {t(lang, 'btn_predict_from_log')}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLog(entry.id)}
                      aria-label="Delete"
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] hover:text-[#DC2626] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
