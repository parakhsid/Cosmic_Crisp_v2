import {
  ChevronDown,
  ChevronUp,
  Database,
  Layers,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {useState} from 'react';
import {t} from '../i18n/translations';
import type {
  AiAgronomyAnalysis,
  GeospatialIngestionPayload,
  GeospatialLayerSummary,
  LanguageCode,
} from '../types/agronomy';

interface GeospatialAiPanelProps {
  lang: LanguageCode;
  lat: number;
  lon: number;
  locationName: string;
  isOfflineActive: boolean;
  geospatial: GeospatialIngestionPayload | null;
  analysis: AiAgronomyAnalysis | null;
  loadingIngest: boolean;
  loadingAi: boolean;
  error: string | null;
  onRunIngestOnly: (bbox?: [number, number, number, number]) => void;
  onRunAiAnalysis: (bbox?: [number, number, number, number]) => void;
}

const LAYER_LABELS: Record<string, string> = {
  elevation_m: 'NASADEM Elevation',
  terrain_slope_deg: 'NASADEM Slope (xrspatial)',
  growing_season_days: 'MODIS Growing Season',
  era5_temp_min_c: 'ERA5 Min Temperature',
  era5_relative_humidity_pct: 'ERA5 Relative Humidity',
  era5_precip_mm: 'ERA5 Precipitation',
  pc_gpm_imerg_mm: 'PC GPM IMERG',
  smap_sm_surface: 'SMAP L4 Surface Moisture',
  smap_sm_rootzone: 'SMAP L4 Rootzone Moisture',
  earthdata_gpm_imerg_mm_day: 'Earthdata GPM IMERG',
  earthdata_mcd12q2_gsl: 'Earthdata MODIS MCD12Q2 GSL',
  earthdata_nasadem_slope_deg: 'Earthdata NASADEM Slope',
  soil_ph: 'SoilGrids pH (0–5 cm)',
  soil_organic_carbon_g_kg: 'SoilGrids Org. Carbon (0–5 cm)',
  soil_clay_pct: 'SoilGrids Clay (0–5 cm)',
  soil_sand_pct: 'SoilGrids Sand (0–5 cm)',
};

function LayerStatsRow({
  layerKey,
  stat,
}: {
  layerKey: string;
  stat: GeospatialLayerSummary;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] py-2 text-xs last:border-b-0">
      <div className="min-w-0">
        <div className="font-semibold text-[#0F172A]">
          {LAYER_LABELS[layerKey] ?? layerKey}
        </div>
        <div className="text-[11px] text-[#64748B]">{stat.dataset}</div>
      </div>
      <div className="text-right font-mono-tabular shrink-0">
        <div className="font-bold text-[#0F172A]">
          {stat.mean !== null ? `${stat.mean} ${stat.units}` : '—'}
        </div>
        {stat.min !== null && stat.max !== null && (
          <div className="text-[11px] text-[#64748B]">
            min {stat.min} · max {stat.max}
          </div>
        )}
      </div>
    </div>
  );
}

export function GeospatialAiPanel({
  lang,
  lat,
  lon,
  locationName,
  isOfflineActive,
  geospatial,
  analysis,
  loadingIngest,
  loadingAi,
  error,
  onRunIngestOnly,
  onRunAiAnalysis,
}: GeospatialAiPanelProps) {
  const [showBboxControls, setShowBboxControls] = useState(false);
  const [bufferDeg, setBufferDeg] = useState(0.05);

  const customBbox: [number, number, number, number] = [
    Number((lon - bufferDeg).toFixed(4)),
    Number((lat - bufferDeg).toFixed(4)),
    Number((lon + bufferDeg).toFixed(4)),
    Number((lat + bufferDeg).toFixed(4)),
  ];

  const busy = loadingIngest || loadingAi;

  const pc = geospatial?.sources.planetaryComputer;
  const ed = geospatial?.sources.nasaEarthdata;
  const sg = geospatial?.sources.isricSoilGrids;

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-5">
      {/* Header & Action Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#15803D]">
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span>{t(lang, 'geo_ai_kicker')}</span>
          </div>
          <h2 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
            {t(lang, 'geo_ai_title')} — {locationName}
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            {t(lang, 'geo_ai_subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || isOfflineActive}
            onClick={() => onRunIngestOnly(customBbox)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-white disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingIngest ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {loadingIngest ? t(lang, 'geo_streaming') : t(lang, 'geo_stream_btn')}
          </button>

          <button
            type="button"
            disabled={busy || isOfflineActive}
            onClick={() => onRunAiAnalysis(customBbox)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#15803D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-50 cursor-pointer"
          >
            <Sparkles
              className={`h-3.5 w-3.5 ${loadingAi ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
            {loadingAi ? t(lang, 'ai_analyzing') : t(lang, 'ai_analyze_btn')}
          </button>
        </div>
      </div>

      {/* Collapsible Unified Grid Bounding Box Controls */}
      <div>
        <button
          type="button"
          onClick={() => setShowBboxControls((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F172A] cursor-pointer"
        >
          {showBboxControls ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="font-mono-tabular">
            EPSG:4326 BBOX [{customBbox.join(', ')}]
          </span>
        </button>

        {showBboxControls && (
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
            <label className="flex items-center gap-2 font-medium text-[#334155]">
              <span>Field Buffer Radius (°):</span>
              <select
                value={bufferDeg}
                onChange={(e) => setBufferDeg(Number(e.target.value))}
                className="min-h-[34px] rounded border border-[#CBD5E1] bg-white px-2 font-mono-tabular text-xs text-[#0F172A]"
              >
                <option value={0.02}>±0.02° (~4 km)</option>
                <option value={0.05}>±0.05° (~11 km)</option>
                <option value={0.1}>±0.10° (~22 km)</option>
              </select>
            </label>
            <span className="font-mono-tabular text-[#64748B]">
              Center: {lat.toFixed(4)}, {lon.toFixed(4)}
            </span>
          </div>
        )}
      </div>

      {isOfflineActive && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#D97706]" aria-hidden="true" />
          <span>
            Live xarray streaming and AI analysis require an active connection.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626] mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Gemini AI Agronomy Analysis Output */}
      {analysis && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/60 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#15803D]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t(lang, 'ai_synthesis_heading')}</span>
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-[#0F172A]">
                {analysis.headline}
              </h3>
            </div>
            <div className="text-right text-xs">
              <div className="text-[#475569]">{t(lang, 'ai_top_pick')}</div>
              <div className="font-display text-base font-extrabold text-[#15803D]">
                {analysis.recommendedNextCrop}
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[#1E293B]">
            {analysis.executiveSummary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#DCFCE7] pt-3 text-xs">
            <div>
              <div className="font-bold text-[#0F172A] mb-1">
                {t(lang, 'ai_soil_moisture_title')}
              </div>
              <p className="text-[#334155] leading-relaxed">
                {analysis.soilAndMoistureDiagnosis}
              </p>
            </div>
            <div>
              <div className="font-bold text-[#0F172A] mb-1">
                {t(lang, 'ai_terrain_season_title')}
              </div>
              <p className="text-[#334155] leading-relaxed">
                {analysis.terrainAndSeasonRisk}
              </p>
            </div>
          </div>

          {analysis.actionChecklist.length > 0 && (
            <div className="border-t border-[#DCFCE7] pt-3">
              <div className="text-xs font-bold text-[#0F172A] mb-2">
                {t(lang, 'ai_checklist_title')}
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#1E293B]">
                {analysis.actionChecklist.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-[#15803D] mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-[#475569] border-t border-[#DCFCE7] pt-2">
            {analysis.dataProvenanceNotes}
          </p>
        </div>
      )}

      {/* Extracted Unified EPSG:4326 xarray Layer Summaries */}
      {geospatial ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Microsoft Planetary Computer */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                <Database className="h-3.5 w-3.5 text-[#0284C7]" aria-hidden="true" />
                Planetary Computer
              </span>
              <span className="font-mono-tabular text-[11px] font-semibold text-[#15803D]">
                {pc?.status ?? '—'}
              </span>
            </div>
            <div className="mt-2">
              {pc && Object.keys(pc.layers).length > 0 ? (
                Object.entries(pc.layers).map(([k, stat]) => (
                  <LayerStatsRow key={k} layerKey={k} stat={stat} />
                ))
              ) : (
                <p className="py-2 text-xs text-[#64748B]">
                  {pc?.error || 'No layers returned.'}
                </p>
              )}
            </div>
          </div>

          {/* ISRIC SoilGrids /vsicurl/ */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                <Database className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                ISRIC SoilGrids (250m)
              </span>
              <span className="font-mono-tabular text-[11px] font-semibold text-[#15803D]">
                {sg?.status ?? '—'}
              </span>
            </div>
            <div className="mt-2">
              {sg && Object.keys(sg.layers).length > 0 ? (
                Object.entries(sg.layers).map(([k, stat]) => (
                  <LayerStatsRow key={k} layerKey={k} stat={stat} />
                ))
              ) : (
                <p className="py-2 text-xs text-[#64748B]">
                  {sg?.error || 'No SoilGrids layers returned.'}
                </p>
              )}
            </div>
          </div>

          {/* NASA Earthdata Cloud (earthaccess + xarray) */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A]">
                <Database className="h-3.5 w-3.5 text-[#D97706]" aria-hidden="true" />
                NASA Earthdata Cloud
              </span>
              <span className="font-mono-tabular text-[11px] font-semibold text-[#475569]">
                {ed?.status ?? '—'}
              </span>
            </div>
            <div className="mt-2">
              {ed && Object.keys(ed.layers).length > 0 ? (
                Object.entries(ed.layers).map(([k, stat]) => (
                  <LayerStatsRow key={k} layerKey={k} stat={stat} />
                ))
              ) : (
                <div className="py-2 space-y-2 text-xs leading-relaxed text-[#64748B]">
                  <p>
                    {ed?.message ||
                      ed?.error ||
                      'Configure EARTHDATA_USERNAME and EARTHDATA_PASSWORD on the server to stream SMAP L4 (SPL4SMGP v008) & GPM IMERG.'}
                  </p>
                  {ed?.discoveredGranules &&
                    Object.keys(ed.discoveredGranules).length > 0 && (
                      <ul className="space-y-1 border-t border-[#E2E8F0] pt-2 font-mono-tabular text-[11px] text-[#334155]">
                        {Object.entries(ed.discoveredGranules).map(([k, v]) => (
                          <li key={k} className="truncate" title={v}>
                            <span className="font-semibold text-[#0F172A]">{k}:</span>{' '}
                            {v}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-5 text-center text-xs text-[#64748B]">
          {t(lang, 'geo_ai_empty')}
        </div>
      )}
    </section>
  );
}
