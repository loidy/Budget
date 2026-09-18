'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const SWIPE_THRESHOLD = 64;
const MOVE_SLOP = 10;
const LONG_PRESS_MS = 400;
const CONFIRM_TIMEOUT_MS = 4000;
const DELETE_REVEAL = 96;

export interface MobileRowReorder {
  enabled: boolean;
  groupKey: string;
  onDropOn: (targetId: string, place: 'before' | 'after') => void;
}

interface MobileRowCardProps {
  id: string;
  onTap?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  reorder?: MobileRowReorder;
  accentClass?: string;
  surfaceClassName?: string;
  className?: string;
  children: React.ReactNode;
}

type Gesture =
  | { kind: 'idle' }
  | { kind: 'pending'; pointerId: number; startX: number; startY: number }
  | { kind: 'swipe'; pointerId: number; startX: number }
  | { kind: 'reorder'; pointerId: number };

export function MobileRowCard({
  id,
  onTap,
  onEdit,
  onDelete,
  deleteLabel,
  reorder,
  accentClass = 'border-l-4 border-l-transparent',
  surfaceClassName = 'bg-white',
  className = '',
  children,
}: MobileRowCardProps) {
  const t = useTranslations('common');
  const resolvedDeleteLabel = deleteLabel ?? t('confirm');
  const rootRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture>({ kind: 'idle' });
  const offsetRef = useRef(0);
  const longPressTimer = useRef<number | null>(null);
  const confirmTimer = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState(false);

  const setSwipeOffset = (value: number) => {
    offsetRef.current = value;
    setOffsetX(value);
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const clearConfirmTimer = () => {
    if (confirmTimer.current !== null) {
      window.clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
  };

  const resetSwipe = () => {
    setSwipeOffset(0);
    setConfirming(false);
    clearConfirmTimer();
  };

  useEffect(() => {
    return () => {
      clearLongPress();
      clearConfirmTimer();
    };
  }, []);

  const findDropTarget = (clientY: number) => {
    const group = reorder?.groupKey;
    if (!group) return null;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-row]')).filter(
      (node) => node.dataset.groupKey === group
    );
    for (const node of nodes) {
      const rowId = node.dataset.rowId;
      if (!rowId || rowId === id) continue;
      const rect = node.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return { id: rowId, place: clientY < rect.top + rect.height / 2 ? 'before' : 'after' } as const;
      }
    }
    return null;
  };

  const beginReorder = (pointerId: number) => {
    const root = rootRef.current;
    if (!root || !reorder?.enabled) return;
    try {
      root.setPointerCapture(pointerId);
    } catch {
      // Pointer may already be gone.
    }
    gestureRef.current = { kind: 'reorder', pointerId };
    setDragging(true);
    setSwipeOffset(0);
    setConfirming(false);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a, [data-no-gesture]')) {
      return;
    }
    resetSwipe();
    gestureRef.current = {
      kind: 'pending',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (reorder?.enabled) {
      clearLongPress();
      longPressTimer.current = window.setTimeout(() => {
        const current = gestureRef.current;
        if (current.kind === 'pending' && current.pointerId === event.pointerId) {
          beginReorder(event.pointerId);
        }
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = gestureRef.current;
    if (current.kind === 'idle' || current.pointerId !== event.pointerId) return;

    if (current.kind === 'pending') {
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (Math.abs(dx) < MOVE_SLOP && Math.abs(dy) < MOVE_SLOP) return;

      if (Math.abs(dy) > Math.abs(dx)) {
        clearLongPress();
        gestureRef.current = { kind: 'idle' };
        return;
      }

      clearLongPress();
      try {
        rootRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Pointer may already be gone.
      }
      gestureRef.current = { kind: 'swipe', pointerId: event.pointerId, startX: current.startX };
      setSwipeOffset(dx);
      return;
    }

    if (current.kind === 'swipe') {
      const dx = event.clientX - current.startX;
      const canLeft = Boolean(onDelete);
      const canRight = Boolean(onEdit);
      const next =
        dx > 0 ? (canRight ? Math.min(dx, 120) : 0) : canLeft ? Math.max(dx, -DELETE_REVEAL) : 0;
      setSwipeOffset(next);
      return;
    }

    if (current.kind === 'reorder') {
      document.querySelectorAll('[data-mobile-drop]').forEach((node) => {
        node.removeAttribute('data-mobile-drop');
      });
      const target = findDropTarget(event.clientY);
      if (target) {
        const el = Array.from(document.querySelectorAll<HTMLElement>('[data-mobile-row]')).find(
          (node) => node.dataset.rowId === target.id
        );
        el?.setAttribute('data-mobile-drop', target.place);
      }
    }
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = gestureRef.current;
    if (current.kind === 'idle' || current.pointerId !== event.pointerId) return;

    clearLongPress();
    const root = rootRef.current;
    if (root?.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }

    if (current.kind === 'pending') {
      gestureRef.current = { kind: 'idle' };
      if (!cancelled) onTap?.();
      return;
    }

    if (current.kind === 'swipe') {
      const dx = offsetRef.current;
      gestureRef.current = { kind: 'idle' };
      if (!cancelled && dx >= SWIPE_THRESHOLD && onEdit) {
        setSwipeOffset(0);
        onEdit();
        return;
      }
      if (!cancelled && dx <= -SWIPE_THRESHOLD && onDelete) {
        setSwipeOffset(-DELETE_REVEAL);
        setConfirming(true);
        clearConfirmTimer();
        confirmTimer.current = window.setTimeout(() => resetSwipe(), CONFIRM_TIMEOUT_MS);
        return;
      }
      setSwipeOffset(0);
      return;
    }

    if (current.kind === 'reorder') {
      const target = cancelled ? null : findDropTarget(event.clientY);
      document.querySelectorAll('[data-mobile-drop]').forEach((node) => {
        node.removeAttribute('data-mobile-drop');
      });
      setDragging(false);
      gestureRef.current = { kind: 'idle' };
      if (target && reorder) {
        reorder.onDropOn(target.id, target.place);
      }
    }
  };

  const handleConfirmDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    resetSwipe();
    onDelete?.();
  };

  return (
    <div
      ref={rootRef}
      data-mobile-row=""
      data-row-id={id}
      data-group-key={reorder?.groupKey ?? ''}
      className={`relative overflow-hidden select-none ${dragging ? 'z-10 opacity-70' : ''} ${
        '[&[data-mobile-drop=before]]:shadow-[inset_0_2px_0_0_#2563eb] [&[data-mobile-drop=after]]:shadow-[inset_0_-2px_0_0_#2563eb]'
      } ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishGesture(event, false)}
      onPointerCancel={(event) => finishGesture(event, true)}
      onContextMenu={(event) => {
        if (gestureRef.current.kind !== 'idle') event.preventDefault();
      }}
      style={{ touchAction: 'pan-y' }}
    >
      {onDelete && (
        <div
          className={`absolute inset-y-0 right-0 flex w-24 items-stretch ${
            offsetX < 0 || confirming ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!(offsetX < 0 || confirming)}
        >
          <button
            type="button"
            data-no-gesture=""
            tabIndex={confirming ? 0 : -1}
            onClick={handleConfirmDelete}
            className="flex w-full items-center justify-center bg-rose-600 px-2 text-[11px] font-semibold text-white"
            aria-label={resolvedDeleteLabel}
          >
            {resolvedDeleteLabel}
          </button>
        </div>
      )}
      <div
        className={`relative bg-white ${surfaceClassName} ${accentClass} ${dragging ? 'scale-[1.01] shadow-md' : ''} ${
          confirming ? '' : 'transition-transform duration-150'
        }`}
        style={{ transform: `translateX(${offsetX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
