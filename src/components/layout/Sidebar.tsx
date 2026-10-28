import React, { useState } from 'react';
import { CompanySettings } from '../../types';
import { I18nService } from '../../services/i18nService';
import {
  LayoutGrid,
  Utensils,
  ChefHat,
  Package,
  Boxes,
  RotateCcw,
  Coins,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Tv,
  LogOut,
  ShieldCheck,
  ChevronRight,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

export type ActiveTab =
  | 'pos'
  | 'restaurant'
  | 'kds'
  | 'products'
  | 'inventory'
  | 'returns'
  | 'shifts'
  | 'customers'
  | 'installments'
  | 'reports'
  | 'backup'
  | 'settings'
  | 'customer_display'
  | 'license';

interface Props {
  activeTab: ActiveTab;
  settings?: CompanySettings | null;
  onSelectTab: (tab: ActiveTab) => void;
  onLogout: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<Props> = ({ activeTab, settings, onSelectTab, onLogout, isCollapsed: externalCollapsed, onToggleCollapse }) => {
  const isRestaurant = settings?.business_mode === 'RESTAURANT';
  // Responsive default: On square or smaller screens (< 1280px), start auto-collapsed (icon-only) to maximize POS work area
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1280;
    }
    return true;
  });
  const [isHovered, setIsHovered] = useState(false);

  // If externally controlled collapsed, use that; otherwise use internal state
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : (!isPinned && !isHovered);

  const allMenuItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }>; restaurantOnly?: boolean }> = [
    { id: 'pos', label: I18nService.t('nav.pos'), icon: LayoutGrid },
    { id: 'restaurant', label: I18nService.t('nav.restaurant'), icon: Utensils, restaurantOnly: true },
    { id: 'kds', label: I18nService.t('nav.kds'), icon: ChefHat, restaurantOnly: true },
    { id: 'products', label: I18nService.t('nav.products'), icon: Package },
    { id: 'inventory', label: I18nService.t('nav.inventory'), icon: Boxes },
    { id: 'returns', label: I18nService.t('nav.returns'), icon: RotateCcw },
    { id: 'shifts', label: I18nService.t('nav.shifts'), icon: Coins },
    { id: 'customers', label: I18nService.t('nav.customers'), icon: Users },
    { id: 'installments', label: 'Installments', icon: Calendar },
    { id: 'reports', label: I18nService.t('nav.reports'), icon: BarChart3 },
    { id: 'backup', label: 'Backup & Cloud', icon: HardDrive },
    { id: 'settings', label: I18nService.t('nav.settings'), icon: Settings },
    { id: 'customer_display', label: I18nService.t('nav.customer_display'), icon: Tv },
    { id: 'license', label: I18nService.t('lic.title'), icon: ShieldCheck },
  ];

  const menuItems = allMenuItems.filter((item) => !item.restaurantOnly || isRestaurant);

  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col justify-between transition-all duration-200 shrink-0 select-none z-20 relative ${
        isCollapsed ? 'w-14' : 'w-56'
      }`}
      onMouseEnter={() => { if (!isPinned) setIsHovered(true); }}
      onMouseLeave={() => { if (!isPinned) setIsHovered(false); }}
    >
      {/* Navigation Items */}
      <nav className="p-2 space-y-1 overflow-y-auto overflow-x-hidden flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl font-semibold text-xs transition duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
                {!isCollapsed && isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-200 shrink-0" />}
              </button>
              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                  {item.label}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer: Pin/Unpin + Logout */}
      <div className="p-2 border-t border-slate-800 space-y-1">
        {/* Pin/Unpin toggle */}
        <button
          onClick={() => {
            const next = !isPinned;
            setIsPinned(next);
            if (!next) setIsHovered(false);
            if (onToggleCollapse) onToggleCollapse();
          }}
          title={isPinned ? 'Auto-hide sidebar' : 'Pin sidebar open'}
          className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-200 hover:bg-slate-800/70 transition"
        >
          {isPinned
            ? <PanelLeftClose className="w-4 h-4 shrink-0" />
            : <PanelLeftOpen className="w-4 h-4 shrink-0" />
          }
          {!isCollapsed && <span>{isPinned ? 'Auto-hide' : 'Pin open'}</span>}
        </button>

        {/* Logout */}
        <div className="relative group">
          <button
            onClick={onLogout}
            title={isCollapsed ? I18nService.t('common.logout') : undefined}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl font-semibold text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>{I18nService.t('common.logout')}</span>}
          </button>
          {isCollapsed && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
              {I18nService.t('common.logout')}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
