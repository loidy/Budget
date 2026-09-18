'use client';

import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Briefcase,
  Building2,
  Car,
  Castle,
  Factory,
  Globe,
  Heart,
  Home,
  Landmark,
  Laptop,
  PiggyBank,
  Store,
  Trees,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import {
  DEFAULT_HOUSE_ICON,
  HOUSE_ICON_IDS,
  isHouseIconId,
  type HouseIconId,
} from '../lib/houseIcons';

const ICONS: Record<HouseIconId, LucideIcon> = {
  home: Home,
  building: Building2,
  briefcase: Briefcase,
  landmark: Landmark,
  warehouse: Warehouse,
  store: Store,
  factory: Factory,
  castle: Castle,
  trees: Trees,
  car: Car,
  heart: Heart,
  wallet: Wallet,
  piggyBank: PiggyBank,
  globe: Globe,
  laptop: Laptop,
  users: Users,
};

export function HouseGlyph({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = ICONS[isHouseIconId(icon) ? icon : DEFAULT_HOUSE_ICON];
  return <Icon className={className} />;
}

interface HouseIconPickerProps {
  value: string;
  onChange: (icon: HouseIconId) => void;
  variant?: 'dark' | 'light';
}

export function HouseIconPicker({
  value,
  onChange,
  variant = 'dark',
}: HouseIconPickerProps) {
  const t = useTranslations('icons');
  const tc = useTranslations('common');
  const selected = isHouseIconId(value) ? value : DEFAULT_HOUSE_ICON;
  const isDark = variant === 'dark';

  return (
    <div>
      <label
        className={`block text-xs font-medium mb-1.5 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {tc('icon')}
      </label>
      <div className="grid grid-cols-8 gap-1.5">
        {HOUSE_ICON_IDS.map((id) => {
          const isSelected = id === selected;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              title={t(id)}
              className={`flex items-center justify-center p-2 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-500'
                  : isDark
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-blue-500 hover:text-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-700'
              }`}
            >
              <HouseGlyph icon={id} className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
