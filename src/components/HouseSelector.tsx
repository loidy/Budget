'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { House } from '../types';
import type { SessionUser } from '../types';
import { Building2, Check, ChevronDown, Plus, MoreVertical } from 'lucide-react';
import { DEFAULT_HOUSE_ICON } from '../lib/houseIcons';
import { HouseGlyph, HouseIconPicker } from './HouseIconPicker';
import { HouseSettingsModal } from './HouseSettingsModal';
import { ModalPortal } from './ModalPortal';
import { UserMenu } from './UserMenu';

interface HouseSelectorProps {
  user: SessionUser;
  houses: House[];
  activeHouseId: string;
  onSelectHouse: (houseId: string) => void;
  onAddHouse: (name: string, description: string, icon: string) => void;
  onUpdateHouse: (houseId: string, name: string, description: string, icon: string) => void;
  onDeleteHouse: (houseId: string) => void;
  onShareHouse: (houseId: string, email: string) => void;
  onUnshareHouse: (houseId: string, userId: string) => void;
  layout?: 'bar' | 'menu';
}

export const HouseSelector: React.FC<HouseSelectorProps> = ({
  user,
  houses,
  activeHouseId,
  onSelectHouse,
  onAddHouse,
  onUpdateHouse,
  onDeleteHouse,
  onShareHouse,
  onUnshareHouse,
  layout = 'bar',
}) => {
  const t = useTranslations('houses');
  const tc = useTranslations('common');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [settingsHouseId, setSettingsHouseId] = useState<string | null>(null);
  const [houseMenuOpen, setHouseMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState(DEFAULT_HOUSE_ICON);
  const houseMenuRef = useRef<HTMLDivElement>(null);

  const settingsHouse = houses.find((house) => house.id === settingsHouseId) ?? null;
  const activeHouse = houses.find((house) => house.id === activeHouseId) ?? houses[0];

  useEffect(() => {
    if (!houseMenuOpen) return;

    const handlePointer = (event: MouseEvent) => {
      if (!houseMenuRef.current?.contains(event.target as Node)) {
        setHouseMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHouseMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [houseMenuOpen]);

  const handleOpenAdd = () => {
    setHouseMenuOpen(false);
    setNewName('');
    setNewDesc('');
    setNewIcon(DEFAULT_HOUSE_ICON);
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddHouse(newName.trim(), newDesc.trim(), newIcon);
    setIsAddModalOpen(false);
  };

  const handleOpenSettings = (house: House) => {
    onSelectHouse(house.id);
    setSettingsHouseId(house.id);
  };

  const houseList = houses.map((house) => {
    const isActive = house.id === activeHouseId;
    return (
      <div
        key={house.id}
        className={`flex items-center gap-0.5 pl-3 pr-1.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/30'
            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectHouse(house.id)}
          className="flex items-center gap-2 py-0.5 pr-1"
        >
          <HouseGlyph icon={house.icon} className="w-3.5 h-3.5 opacity-80" />
          <span>{house.name}</span>
          {house.role === 'member' && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isActive ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {t('shared')}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleOpenSettings(house)}
          className={`p-1 rounded ${
            isActive
              ? 'text-blue-100 hover:text-white hover:bg-blue-700/80'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
          title={t('houseSettings')}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  });

  const addHouseButton = (
      <button
        onClick={handleOpenAdd}
        className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-blue-400 border border-dashed border-slate-700 hover:border-blue-500 transition-colors shrink-0"
        title={t('newHouse')}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    );

  const menuHousePicker = (
    <div className="flex items-center gap-1">
      <div ref={houseMenuRef} className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setHouseMenuOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={houseMenuOpen}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-slate-800 px-3 text-left text-sm font-medium text-white hover:bg-slate-700"
        >
          {activeHouse ? (
            <>
              <HouseGlyph icon={activeHouse.icon} className="h-4 w-4 shrink-0 opacity-80" />
              <span className="min-w-0 flex-1 truncate">{activeHouse.name}</span>
              {activeHouse.role === 'member' && (
                <span className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  {t('shared')}
                </span>
              )}
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-slate-400">{t('selectHouse')}</span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${houseMenuOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {houseMenuOpen && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-lg"
          >
            {houses.map((house) => {
              const isActive = house.id === activeHouseId;
              return (
                <li key={house.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      setHouseMenuOpen(false);
                      onSelectHouse(house.id);
                    }}
                    className={`flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <HouseGlyph icon={house.icon} className="h-4 w-4 shrink-0 opacity-80" />
                    <span className="min-w-0 flex-1 truncate">{house.name}</span>
                    {house.role === 'member' && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          isActive ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {t('shared')}
                      </span>
                    )}
                    {isActive && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
            <li className="mt-1 border-t border-slate-700 pt-1">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium text-blue-400 hover:bg-slate-700"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>{t('newHouse')}</span>
              </button>
            </li>
          </ul>
        )}
      </div>
      {activeHouse && (
        <button
          type="button"
          onClick={() => handleOpenSettings(activeHouse)}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          title={t('houseSettings')}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div
      className={
        layout === 'menu'
          ? 'flex flex-col bg-slate-900 text-white'
          : 'bg-slate-900 text-white border-b border-slate-800'
      }
    >
      {layout === 'menu' ? (
        <div className="flex flex-col gap-3 px-4 py-3">
          {menuHousePicker}
        </div>
      ) : (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {houseList}
          {addHouseButton}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <UserMenu user={user} />
        </div>
      </div>
      )}

      {isAddModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              {t('addHouse')}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {t('addHouseLead')}
            </p>

            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t('houseNameRequired')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('houseNamePlaceholder')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {tc('optionalDescription')}
                </label>
                <input
                  type="text"
                  placeholder={t('descriptionPlaceholder')}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <HouseIconPicker value={newIcon} onChange={setNewIcon} />

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm"
                >
                  {t('createHouse')}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {settingsHouse && (
        <HouseSettingsModal
          house={settingsHouse}
          onClose={() => setSettingsHouseId(null)}
          onUpdate={(name, description, icon) => {
            onUpdateHouse(settingsHouse.id, name, description, icon);
            setSettingsHouseId(null);
          }}
          onDelete={() => onDeleteHouse(settingsHouse.id)}
          onShare={(email) => onShareHouse(settingsHouse.id, email)}
          onUnshare={(userId) => onUnshareHouse(settingsHouse.id, userId)}
        />
      )}
    </div>
  );
};
