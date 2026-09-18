'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookmarkPlus, Pencil, Table } from 'lucide-react';
import type { CatalogItem, CatalogKind, CatalogTableView, House } from '../types';
import { sanitizeCatalogViewState } from '../lib/catalogView';
import { INLINE_INPUT_CLASS, DeleteConfirmButton } from './BudgetTableUi';
import { IncomeExpenseTable } from './IncomeExpenseTable';

export function SaveCatalogViewButton({ onSave }: { onSave: (name: string) => void }) {
  const t = useTranslations('catalog');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setName('');
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    close();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
      >
        <BookmarkPlus className="w-3.5 h-3.5" />
        {t('saveView')}
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            close();
          }
        }}
        placeholder={t('tableName')}
        className={`${INLINE_INPUT_CLASS} w-48`}
        aria-label={t('savedViewName')}
      />
      <button
        type="submit"
        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md"
      >
        {tc('save')}
      </button>
      <button
        type="button"
        onClick={close}
        className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        {tc('cancel')}
      </button>
    </form>
  );
}

function ViewTitleEditor({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const t = useTranslations('catalog');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    if (trimmed !== name) onRename(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        className="min-w-0 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
          className={`${INLINE_INPUT_CLASS} max-w-xs text-sm font-semibold h-8`}
          aria-label={t('tableName')}
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <h3 className="text-lg font-semibold text-slate-900 truncate">{name}</h3>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100"
        title={t('renameTable')}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface SavedCatalogTablesProps {
  house: House;
  onSaveItem: (
    item: CatalogItem,
    previousKind?: CatalogKind,
    placement?: { beforeId?: string; afterId?: string },
    snapshotId?: string | null
  ) => void;
  onDeleteItem: (itemId: string, snapshotId?: string | null) => void;
  onReorderItems: (orderedItemIds: string[], snapshotId?: string | null) => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
}

export function SavedCatalogTables({
  house,
  onSaveItem,
  onDeleteItem,
  onReorderItems,
  onRenameView,
  onDeleteView,
}: SavedCatalogTablesProps) {
  const t = useTranslations('catalog');

  if (house.catalogTableViews.length === 0) {
    return (
      <div className="bg-white rounded-none lg:rounded-2xl border border-slate-200/90 border-x-0 lg:border-x shadow-sm px-6 py-16 text-center">
        <Table className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">{t('noSavedTables')}</h3>
        <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
          {t('noSavedTablesLead')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {house.catalogTableViews.map((saved: CatalogTableView) => (
        <IncomeExpenseTable
          key={saved.id}
          house={house}
          viewState={sanitizeCatalogViewState(saved.view, house)}
          title={<ViewTitleEditor name={saved.name} onRename={(name) => onRenameView(saved.id, name)} />}
          headerActions={
            <DeleteConfirmButton
              onConfirm={() => onDeleteView(saved.id)}
              title={t('deleteTable')}
            />
          }
          onSaveItem={onSaveItem}
          onDeleteItem={onDeleteItem}
          onReorderItems={onReorderItems}
        />
      ))}
    </div>
  );
}
