import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  HardDriveDownload,
  Trash2,
} from 'lucide-react';
import {t, type TranslationKey} from '../i18n/translations';
import type {PushPermissionState} from '../lib/notifications';
import {
  cToF,
  fToC,
  formatAlertMetricValue,
  inToMm,
  mmToIn,
  type UnitSystem,
} from '../lib/units';
import type {
  AlertThresholds,
  CachedFarmPack,
  DispatchedAlertLog,
  LanguageCode,
  WeatherAlert,
} from '../types/agronomy';

interface AlertsAndOfflineViewProps {
  lang: LanguageCode;
  unit: UnitSystem;
  alerts: WeatherAlert[];
  thresholds: AlertThresholds;
  onUpdateThresholds: (next: AlertThresholds) => void;
  pushPermission: PushPermissionState;
  onRequestPush: () => void;
  onSendTestPush: () => void;
  testPushFeedback: string | null;
  alertHistory: DispatchedAlertLog[];
  savedPacks: CachedFarmPack[];
  onLoadPack: (pack: CachedFarmPack) => void;
  onDeletePack: (key: string) => void;
}

export function AlertsAndOfflineView({
  lang,
  unit,
  alerts,
  thresholds,
  onUpdateThresholds,
  pushPermission,
  onRequestPush,
  onSendTestPush,
  testPushFeedback,
  alertHistory,
  savedPacks,
  onLoadPack,
  onDeletePack,
}: AlertsAndOfflineViewProps) {
  const pushStatusLabel =
    pushPermission === 'granted' && thresholds.pushEnabled
      ? t(lang, 'push_status_granted')
      : pushPermission === 'denied'
      ? t(lang, 'push_status_denied')
      : t(lang, 'push_status_default');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#0F172A] text-balance">
          {t(lang, 'alerts_title')}
        </h1>
        <p className="mt-1 text-sm text-[#475569]">{t(lang, 'alerts_subtitle')}</p>
      </div>

      {/* Top Grid: Push Notification Controls + Threshold Settings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-xl border border-[#E2E8F0] bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0F172A]">
                {t(lang, 'push_panel_title')}
              </h2>
            </div>
            <span
              className={`text-xs font-semibold ${
                pushPermission === 'granted' && thresholds.pushEnabled
                  ? 'text-[#15803D]'
                  : 'text-[#B45309]'
              }`}
            >
              {pushStatusLabel}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRequestPush}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534] cursor-pointer"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              {t(lang, 'btn_enable_push')}
            </button>

            <button
              type="button"
              onClick={onSendTestPush}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
            >
              {t(lang, 'btn_test_push')}
            </button>
          </div>

          {testPushFeedback && (
            <p className="mt-3 text-xs font-medium text-[#15803D]">
              {testPushFeedback}
            </p>
          )}

          {/* Recent Push Log */}
          {alertHistory.length > 0 && (
            <div className="mt-5 border-t border-[#E2E8F0] pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">
                {t(lang, 'alert_history_title')}
              </h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {alertHistory.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 text-xs border-b border-[#F1F5F9] pb-2"
                  >
                    <div>
                      <span className="font-semibold text-[#0F172A]">
                        {item.title}
                      </span>
                      <p className="text-[#475569]">{item.body}</p>
                    </div>
                    <span className="font-mono-tabular text-[#64748B] shrink-0">
                      {new Date(item.sentAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Alert Thresholds */}
        <div className="lg:col-span-6 rounded-xl border border-[#E2E8F0] bg-white p-6">
          <h2 className="font-display text-base font-bold text-[#0F172A] mb-4">
            {t(lang, 'thresholds_title')}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="thresh-frost"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {unit === 'imperial'
                  ? 'Frost Warning Below (°F)'
                  : t(lang, 'thresh_frost')}
              </label>
              <input
                id="thresh-frost"
                type="number"
                value={
                  unit === 'imperial'
                    ? Math.round(cToF(thresholds.frostTempC))
                    : thresholds.frostTempC
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateThresholds({
                    ...thresholds,
                    frostTempC:
                      unit === 'imperial' ? Number(fToC(val).toFixed(1)) : val,
                  });
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
              />
            </div>

            <div>
              <label
                htmlFor="thresh-heat"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {unit === 'imperial'
                  ? 'Heat Stress Above (°F)'
                  : t(lang, 'thresh_heat')}
              </label>
              <input
                id="thresh-heat"
                type="number"
                value={
                  unit === 'imperial'
                    ? Math.round(cToF(thresholds.heatTempC))
                    : thresholds.heatTempC
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateThresholds({
                    ...thresholds,
                    heatTempC:
                      unit === 'imperial' ? Number(fToC(val).toFixed(1)) : val,
                  });
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
              />
            </div>

            <div>
              <label
                htmlFor="thresh-drought"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {t(lang, 'thresh_drought')}
              </label>
              <input
                id="thresh-drought"
                type="number"
                value={thresholds.droughtWetnessPct}
                onChange={(e) =>
                  onUpdateThresholds({
                    ...thresholds,
                    droughtWetnessPct: Number(e.target.value),
                  })
                }
                className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
              />
            </div>

            <div>
              <label
                htmlFor="thresh-rain"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {unit === 'imperial'
                  ? 'Heavy Rain Above (in/day)'
                  : t(lang, 'thresh_rain')}
              </label>
              <input
                id="thresh-rain"
                type="number"
                step={unit === 'imperial' ? '0.1' : '1'}
                value={
                  unit === 'imperial'
                    ? Number(mmToIn(thresholds.heavyRainMm).toFixed(1))
                    : thresholds.heavyRainMm
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateThresholds({
                    ...thresholds,
                    heavyRainMm:
                      unit === 'imperial' ? Math.round(inToMm(val)) : val,
                  });
                }}
                className="w-full min-h-[44px] rounded-lg border border-[#CBD5E1] px-3 font-mono-tabular text-sm text-[#0F172A]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Active 16-Day Weather Hazards */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <h2 className="font-display text-base font-bold text-[#0F172A] mb-4">
          {t(lang, 'active_alerts_title')}
        </h2>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#334155]">
            <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0" aria-hidden="true" />
            <span>{t(lang, 'no_active_alerts')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 ${
                  alert.severity === 'critical'
                    ? 'border-red-300 bg-red-50'
                    : 'border-amber-300 bg-amber-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`h-4 w-4 ${
                        alert.severity === 'critical'
                          ? 'text-[#DC2626]'
                          : 'text-[#D97706]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm font-bold text-[#0F172A]">
                      {t(lang, alert.titleKey as TranslationKey)}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-xs font-bold text-[#0F172A]">
                    {formatAlertMetricValue(alert.metricValue, unit)} · {alert.date}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#334155]">
                  {t(lang, alert.detailKey as TranslationKey)}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#0F172A]">
                  Action: {t(lang, alert.actionKey as TranslationKey)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cached Offline Farm Packs */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
        <div className="flex items-center gap-2">
          <HardDriveDownload className="h-5 w-5 text-[#15803D]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#0F172A]">
            {t(lang, 'offline_packs_title')}
          </h2>
        </div>
        <p className="mt-1 text-sm text-[#475569]">
          {t(lang, 'offline_packs_subtitle')}
        </p>

        {savedPacks.length === 0 ? (
          <p className="mt-4 text-sm text-[#64748B]">{t(lang, 'no_packs_saved')}</p>
        ) : (
          <div className="mt-4 divide-y divide-[#E2E8F0] border-t border-[#E2E8F0]">
            {savedPacks.map((pack) => (
              <div
                key={pack.key}
                className="flex flex-wrap items-center justify-between gap-4 py-3.5"
              >
                <div>
                  <div className="font-semibold text-sm text-[#0F172A]">
                    {pack.locationName}
                  </div>
                  <div className="font-mono-tabular text-xs text-[#64748B]">
                    {pack.sizeKb} KB · {new Date(pack.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadPack(pack)}
                    className="min-h-[38px] rounded-lg bg-[#15803D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#166534] cursor-pointer"
                  >
                    {t(lang, 'btn_load_pack')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePack(pack.key)}
                    aria-label={t(lang, 'btn_delete_pack')}
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
  );
}
