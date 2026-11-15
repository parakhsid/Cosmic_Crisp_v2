import {Bell, BookOpen, Droplets, LineChart, Sprout} from 'lucide-react';
import {t} from '../i18n/translations';
import type {LanguageCode, NavTab} from '../types/agronomy';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  lang: LanguageCode;
  alertCount: number;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  lang,
  alertCount,
}: MobileBottomNavProps) {
  const items: Array<{id: NavTab; label: string; icon: typeof Sprout}> = [
    {id: 'overview', label: t(lang, 'nav_overview'), icon: Sprout},
    {id: 'climate', label: t(lang, 'nav_climate'), icon: LineChart},
    {id: 'irrigation', label: t(lang, 'nav_irrigation'), icon: Droplets},
    {
      id: 'alerts',
      label: alertCount > 0 ? `${t(lang, 'nav_alerts')} (${alertCount})` : t(lang, 'nav_alerts'),
      icon: Bell,
    },
    {id: 'log', label: t(lang, 'nav_log'), icon: BookOpen},
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-sm md:hidden"
    >
      <div className="grid h-14 grid-cols-5 items-center">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex min-h-[44px] flex-col items-center justify-center px-1 text-[11px] font-medium transition-colors cursor-pointer ${
                active ? 'text-[#15803D] font-bold' : 'text-[#475569]'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="mt-0.5 truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
