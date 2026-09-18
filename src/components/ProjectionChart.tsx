'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BankAccount, CashFlowPoint } from '../types';
import { parseMonthKey } from '../utils/formatters';
import { intlTag } from '../i18n/config';
import { useBudgetFormat } from '../i18n/useBudgetFormat';
import {
  effectiveAsOf,
  summarizeCashFlow,
  type CashFlowAsOf,
} from '../utils/budgetLogic';
import { Calendar, Clock, Info, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { MonthYearPicker } from './MonthYearPicker';

const ALL_SERIES_COLOR = '#2563eb';

interface ProjectionChartProps {
  title: string;
  infoText: string;
  points: CashFlowPoint[];
  openingByAccount: Record<string, number>;
  accounts: BankAccount[];
  rangeStartMonthKey: string;
  rangeEndMonthKey: string;
  todayMonthKey: string;
  todayDay: number;
  xAxis: 'days' | 'months';
  openingLabel: string;
  currentLabel: string;
  netLabel: string;
  endLabel: string;
  monthKey?: string;
  onChangeMonth?: (monthKey: string) => void;
  chartId: string;
}

function sumVisible(map: Record<string, number>, accountIds: string[]): number {
  return accountIds.reduce((sum, id) => sum + (map[id] ?? 0), 0);
}

function buildSmoothPath(xs: number[], ys: number[]): string {
  return xs.reduce((acc, x, index) => {
    const y = ys[index];
    if (index === 0) return `M ${x},${y}`;
    const prevX = xs[index - 1];
    const prevY = ys[index - 1];
    const controlX = (prevX + x) / 2;
    return `${acc} C ${controlX},${prevY} ${controlX},${y} ${x},${y}`;
  }, '');
}

function formatAxisValue(value: number, compact: boolean, locale: string): string {
  if (compact) {
    const thousands = value / 1000;
    const formatted = thousands.toLocaleString(intlTag(locale), {
      minimumFractionDigits: Math.abs(thousands) >= 10 ? 0 : 1,
      maximumFractionDigits: Math.abs(thousands) >= 10 ? 0 : 1,
    });
    return `${formatted} k€`;
  }
  return `${Math.round(value).toLocaleString(intlTag(locale))} €`;
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({
  title,
  infoText,
  points,
  openingByAccount,
  accounts,
  rangeStartMonthKey,
  rangeEndMonthKey,
  todayMonthKey,
  todayDay,
  xAxis,
  openingLabel,
  currentLabel,
  netLabel,
  endLabel,
  monthKey,
  onChangeMonth,
  chartId,
}) => {
  const t = useTranslations('cashflow');
  const { formatCurrency, formatSignedCurrency, getMonthShortName, locale } = useBudgetFormat();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(() => new Set());
  const [showAllLine, setShowAllLine] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(Math.max(entries[0].contentRect.width, 320));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const accountIdsKey = accounts.map((account) => account.id).join('|');

  useEffect(() => {
    setHiddenAccountIds(new Set());
    setShowAllLine(true);
  }, [accountIdsKey]);

  const visibleAccounts = accounts.filter((account) => !hiddenAccountIds.has(account.id));
  const visibleAccountIds = visibleAccounts.map((account) => account.id);

  const asOf: CashFlowAsOf = effectiveAsOf(
    rangeStartMonthKey,
    rangeEndMonthKey,
    todayMonthKey,
    todayDay
  );

  const summary = useMemo(
    () => summarizeCashFlow(points, openingByAccount, visibleAccountIds, asOf),
    [points, openingByAccount, visibleAccountIds, asOf.monthKey, asOf.day]
  );

  const compact = containerWidth < 640;
  const height = compact ? 240 : 280;
  const padding = compact
    ? { top: 28, right: 10, bottom: 32, left: 52 }
    : { top: 35, right: 30, bottom: 45, left: 65 };
  const chartWidth = Math.max(containerWidth - padding.left - padding.right, 200);
  const chartHeight = height - padding.top - padding.bottom;
  const totalPoints = points.length;

  const getX = (index: number) => {
    if (totalPoints <= 1) return padding.left;
    return padding.left + (index / (totalPoints - 1)) * chartWidth;
  };

  const seriesValues = useMemo(() => {
    const all = points.map((point) => sumVisible(point.balanceByAccount, visibleAccountIds));
    const byAccount: Record<string, number[]> = {};
    for (const account of visibleAccounts) {
      byAccount[account.id] = points.map((point) => point.balanceByAccount[account.id] ?? 0);
    }
    const openingTotal = sumVisible(openingByAccount, visibleAccountIds);
    return { all, byAccount, openingTotal };
  }, [points, visibleAccounts, visibleAccountIds, openingByAccount]);

  const allValues = [
    seriesValues.openingTotal,
    ...seriesValues.all,
    ...visibleAccounts.flatMap((account) => seriesValues.byAccount[account.id] ?? []),
  ];
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 0;
  const range = maxVal - minVal || 100;
  const yMin = Math.floor((minVal - range * 0.1) / 100) * 100;
  const yMax = Math.ceil((maxVal + range * 0.15) / 100) * 100;
  const yRange = yMax - yMin || 1;

  const getY = (val: number) => padding.top + chartHeight - ((val - yMin) / yRange) * chartHeight;

  const xs = points.map((_, index) => getX(index));
  const allPath = showAllLine && seriesValues.all.length ? buildSmoothPath(xs, seriesValues.all.map(getY)) : '';
  const bottomY = getY(Math.max(yMin, 0));
  const areaD =
    allPath && points.length
      ? `${allPath} L ${xs[xs.length - 1]},${bottomY} L ${xs[0]},${bottomY} Z`
      : '';

  const todayIndex = points.findIndex(
    (point) => point.monthKey === todayMonthKey && point.day === todayDay
  );
  const showToday = todayIndex >= 0;
  const currentDayX = showToday ? getX(todayIndex) : 0;
  const currentDayY = showToday ? getY(seriesValues.all[todayIndex] ?? summary.currentDayBalance) : 0;

  const yTicks = [0, 0.33, 0.66, 1].map((ratio) => {
    const value = yMin + ratio * yRange;
    return { value, y: getY(value) };
  });

  const xTicks = points.filter((point, index) => {
    if (xAxis === 'months') {
      return point.day === 1;
    }
    if (compact) {
      return (
        point.day === 1 ||
        point.day === 10 ||
        point.day === 20 ||
        index === points.length - 1 ||
        index === todayIndex
      );
    }
    return (
      point.day === 1 ||
      point.day === 5 ||
      point.day === 10 ||
      point.day === 15 ||
      point.day === 20 ||
      point.day === 25 ||
      index === points.length - 1 ||
      index === todayIndex
    );
  });

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;
  const hoveredItems =
    hoveredPoint?.items.filter((item) => visibleAccountIds.includes(item.accountId)) ?? [];
  const hoveredNet = hoveredPoint ? sumVisible(hoveredPoint.flowByAccount, visibleAccountIds) : 0;

  const pickIndexFromEvent = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || totalPoints === 0) return;
    const x = clientX - rect.left;
    const ratio = (x - padding.left) / chartWidth;
    const index = Math.round(Math.min(Math.max(ratio, 0), 1) * Math.max(totalPoints - 1, 0));
    setHoveredIndex(index);
    setTooltipPos({ x, y: 48 });
  };

  const toggleAccount = (accountId: string) => {
    setHiddenAccountIds((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const isCurrentMonth = monthKey === todayMonthKey;

  return (
    <div className="bg-white rounded-none lg:rounded-2xl border border-slate-200/90 border-x-0 lg:border-x shadow-sm overflow-hidden mb-4 lg:mb-6">
      <div className="px-4 py-3 lg:px-6 lg:py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 lg:gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h2>
          <span className="relative group inline-flex">
            <button
              type="button"
              className="text-slate-400 hover:text-blue-600 transition-colors"
              aria-label={t('projectionInfo')}
            >
              <Info className="w-4 h-4" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {infoText}
            </span>
          </span>
        </div>

        {onChangeMonth && monthKey && (
          <div className="flex items-center gap-2">
            <MonthYearPicker
              monthKey={monthKey}
              todayMonthKey={todayMonthKey}
              onChange={onChangeMonth}
            />
            <button
              type="button"
              onClick={() => onChangeMonth(todayMonthKey)}
              disabled={isCurrentMonth}
              title={t('goToCurrentMonth')}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200/60 transition-colors disabled:opacity-50 disabled:hover:bg-blue-50"
            >
              {t('today')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 bg-slate-50/50 border-b border-slate-100">
        <div className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {openingLabel}
            </div>
            <div className="text-base font-semibold text-slate-800">
              {formatCurrency(summary.startingTotalBalance)}
            </div>
          </div>
        </div>

        <div className={`p-4 flex items-center gap-3 ${showToday ? 'bg-blue-50/40' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-blue-800 uppercase tracking-wider">
              {currentLabel}
            </div>
            <div className="text-base font-bold text-blue-900">
              {formatCurrency(summary.currentDayBalance)}
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              summary.netCashFlow >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}
          >
            {summary.netCashFlow >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {netLabel}
            </div>
            <div
              className={`text-base font-semibold ${
                summary.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatSignedCurrency(summary.netCashFlow)}
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {endLabel}
            </div>
            <div className="text-base font-semibold text-slate-900">
              {formatCurrency(summary.projectedEndBalance)}
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full p-0 lg:p-2 select-none">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${containerWidth} ${height}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={`proj-area-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#3b82f6" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={containerWidth - padding.right}
                y2={tick.y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {formatAxisValue(tick.value, compact, locale)}
              </text>
            </g>
          ))}

          {areaD && <path d={areaD} fill={`url(#proj-area-${chartId})`} />}

          {visibleAccounts.map((account) => {
            const values = seriesValues.byAccount[account.id] ?? [];
            const path = buildSmoothPath(xs, values.map(getY));
            if (!path) return null;
            return (
              <path
                key={account.id}
                d={path}
                fill="none"
                stroke={account.color}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
            );
          })}

          {allPath && (
            <path
              d={allPath}
              fill="none"
              stroke={ALL_SERIES_COLOR}
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showToday && (
            <g>
              <rect
                x={currentDayX - 16}
                y={padding.top}
                width="32"
                height={chartHeight}
                fill="#3b82f6"
                fillOpacity="0.05"
                rx="6"
              />
              <line
                x1={currentDayX}
                y1={padding.top}
                x2={currentDayX}
                y2={height - padding.bottom}
                stroke="#2563eb"
                strokeWidth="1.75"
                strokeDasharray="4 3"
              />
              <g transform={`translate(${currentDayX}, ${padding.top - 12})`}>
                <rect x="-32" y="-14" width="64" height="20" rx="10" fill="#1d4ed8" />
                <text x="0" y="0" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="600">
                  {t('todayWithDay', { day: todayDay })}
                </text>
              </g>
              <circle
                cx={currentDayX}
                cy={currentDayY}
                r="7"
                fill="#2563eb"
                fillOpacity="0.25"
                className="animate-ping"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
              <circle
                cx={currentDayX}
                cy={currentDayY}
                r="5"
                fill="#1d4ed8"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {showAllLine &&
            points.map((point, index) => {
              const visibleItems = point.items.filter((item) =>
                visibleAccountIds.includes(item.accountId)
              );
              if (visibleItems.length === 0) return null;
              const net = sumVisible(point.flowByAccount, visibleAccountIds);
              return (
                <circle
                  key={`tx-${point.monthKey}-${point.day}`}
                  cx={xs[index]}
                  cy={getY(seriesValues.all[index] ?? 0)}
                  r={net > 0 ? 4.5 : 4}
                  fill={net > 0 ? '#10b981' : net < 0 ? '#f43f5e' : '#64748b'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              );
            })}

          {xTicks.map((point) => {
            const x = getX(point.index);
            const isTodayTick = point.index === todayIndex;
            const { month } = parseMonthKey(point.monthKey);
            const label = xAxis === 'months' ? getMonthShortName(month) : `${point.day}.`;
            return (
              <text
                key={`tick-${point.monthKey}-${point.day}`}
                x={x}
                y={height - padding.bottom + 18}
                textAnchor="middle"
                fontSize={isTodayTick ? '11' : '10'}
                fontWeight={isTodayTick ? '700' : '500'}
                fill={isTodayTick ? '#1d4ed8' : '#64748b'}
              >
                {label}
              </text>
            );
          })}

          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={chartHeight}
            fill="transparent"
            className="cursor-crosshair"
            onMouseMove={(event) => pickIndexFromEvent(event.clientX)}
            onMouseEnter={(event) => pickIndexFromEvent(event.clientX)}
            onMouseLeave={() => {
              setHoveredIndex(null);
              setTooltipPos(null);
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (touch) pickIndexFromEvent(touch.clientX);
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (touch) pickIndexFromEvent(touch.clientX);
            }}
            onTouchEnd={() => {
              setHoveredIndex(null);
              setTooltipPos(null);
            }}
          />
        </svg>

        {hoveredPoint && tooltipPos && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-sm border border-slate-700/80 min-w-[220px] transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: `${Math.min(Math.max(tooltipPos.x, 110), containerWidth - 110)}px`,
              top: `${Math.max(tooltipPos.y, 10)}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="font-semibold text-slate-200">{hoveredPoint.dateStr}</span>
              {hoveredPoint.index === todayIndex && (
                <span className="px-1.5 py-0.5 rounded bg-blue-500 text-[10px] font-bold text-white">
                  {t('today')}
                </span>
              )}
            </div>
            <div className="space-y-1 text-slate-300">
              <div className="flex justify-between items-center gap-3">
                <span>{t('allAccounts')}</span>
                <span className="font-semibold text-white font-mono">
                  {formatCurrency(sumVisible(hoveredPoint.balanceByAccount, visibleAccountIds))}
                </span>
              </div>
              {visibleAccounts.map((account) => (
                <div key={account.id} className="flex justify-between items-center gap-3">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: account.color }}
                    />
                    <span className="truncate max-w-[120px]">{account.name}</span>
                  </span>
                  <span className="font-mono">
                    {formatCurrency(hoveredPoint.balanceByAccount[account.id] ?? 0)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-1">
                <span>{t('dailyChange')}</span>
                <span
                  className={`font-semibold font-mono ${
                    hoveredNet > 0
                      ? 'text-emerald-400'
                      : hoveredNet < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                  }`}
                >
                  {formatSignedCurrency(hoveredNet)}
                </span>
              </div>
            </div>
            {hoveredItems.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1">
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  {t('dayTransactions', { count: hoveredItems.length })}
                </div>
                {hoveredItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-[11px] gap-2">
                    <span className="truncate max-w-[120px] text-slate-300">{item.name}</span>
                    <span
                      className={`font-mono font-medium ${
                        item.type === 'income' ? 'text-emerald-400' : 'text-rose-300'
                      }`}
                    >
                      {item.type === 'income' ? '+' : '-'}
                      {formatCurrency(Math.abs(item.amount))}
                    </span>
                  </div>
                ))}
                {hoveredItems.length > 4 && (
                  <div className="text-[10px] text-slate-400 text-right">
                    {t('moreItems', { count: hoveredItems.length - 4 })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 lg:px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => setShowAllLine((value) => !value)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
            showAllLine
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-transparent border-transparent text-slate-400 line-through'
          }`}
        >
          <span className="w-3 h-0.5 rounded" style={{ backgroundColor: ALL_SERIES_COLOR }} />
          <span>{t('allAccounts')}</span>
        </button>
        {accounts.map((account) => {
          const hidden = hiddenAccountIds.has(account.id);
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => toggleAccount(account.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                hidden
                  ? 'bg-transparent border-transparent text-slate-400 line-through'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account.color }} />
              <span>{account.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
