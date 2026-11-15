import {Download, X} from 'lucide-react';
import {useState} from 'react';
import {usePWAInstall} from '../hooks/usePWAInstall';
import {t} from '../i18n/translations';
import type {LanguageCode, NavTab} from '../types/agronomy';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  lang: LanguageCode;
  alertCount: number;
  onSaveOffline: () => void;
  isCurrentSaved: boolean;
}

export function TopBar({
  activeTab,
  onSelectTab,
  lang,
  alertCount,
  onSaveOffline,
  isCurrentSaved,
}: TopBarProps) {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const navItems: Array<{id: NavTab; label: string}> = [
    {id: 'overview', label: t(lang, 'nav_overview')},
    {id: 'climate', label: t(lang, 'nav_climate')},
    {
      id: 'alerts',
      label:
        alertCount > 0 ? `${t(lang, 'nav_alerts')} (${alertCount})` : t(lang, 'nav_alerts'),
    },
    {id: 'log', label: t(lang, 'nav_log')},
  ];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 md:h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className="font-display text-xl font-extrabold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]"
          >
            CropNext
          </button>

          {/* Zone 2: Single-line navigation links */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D] ${
                    isActive
                      ? 'text-[#15803D] font-semibold'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#15803D]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            {!isInstalled && isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t(lang, 'btn_install_app')}
              </button>
            ) : !isInstalled && isIOS ? (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t(lang, 'btn_install_app')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onSaveOffline}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D] ${
                  isCurrentSaved
                    ? 'border border-[#15803D] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7]'
                    : 'bg-[#15803D] text-white hover:bg-[#166534]'
                }`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {isCurrentSaved
                  ? t(lang, 'btn_saved_offline')
                  : t(lang, 'btn_save_offline')}
              </button>
            )}
          </div>
        </div>
      </header>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-[#E2E8F0] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-lg font-bold text-[#0F172A]">
                {t(lang, 'btn_install_app')}
              </h2>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[#475569] hover:bg-[#F1F5F9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-[#475569]">
              <li>1. Tap the Share button in Safari toolbar.</li>
              <li>2. Scroll down and choose Add to Home Screen.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-lg bg-[#15803D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534]"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
