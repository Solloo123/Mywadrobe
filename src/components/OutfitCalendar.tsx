import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  ALL_OCCASIONS,
  CalendarEntryStatus,
  Outfit,
  OutfitCalendarEntry,
  WardrobeItem,
} from '../types';
import { GarmentImage } from './GarmentImage';

interface OutfitCalendarProps {
  wardrobe: WardrobeItem[];
  outfits: Outfit[];
  calendarEntries: OutfitCalendarEntry[];
  onScheduleOrLogEntry: (params: {
    dateKey: string;
    outfitId: string;
    title: string;
    occasion: string;
    status: CalendarEntryStatus;
    itemIds: string[];
    notes: string;
  }) => Promise<void>;
  onMarkEntryAsWorn: (entry: OutfitCalendarEntry) => Promise<void>;
  onDeleteCalendarEntry: (entryId: string) => Promise<void>;
  onOpenOutfitInStylist?: (outfit: Outfit) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export const OutfitCalendar: React.FC<OutfitCalendarProps> = ({
  wardrobe,
  outfits,
  calendarEntries,
  onScheduleOrLogEntry,
  onMarkEntryAsWorn,
  onDeleteCalendarEntry,
  onOpenOutfitInStylist,
}) => {
  const todayKey = useMemo(() => toLocalDateKey(new Date()), []);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // Composer State for Selected Date
  const [composerSource, setComposerSource] = useState<'saved' | 'custom'>('saved');
  const [selectedOutfitId, setSelectedOutfitId] = useState<string>(() => outfits[0]?.outfitId || '');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customOccasion, setCustomOccasion] = useState<string>('Smart casual');
  const [customTopId, setCustomTopId] = useState<string>('');
  const [customBottomId, setCustomBottomId] = useState<string>('');
  const [customFootwearId, setCustomFootwearId] = useState<string>('');
  const [customLayerId, setCustomLayerId] = useState<string>('');
  const [entryStatus, setEntryStatus] = useState<CalendarEntryStatus>('planned');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [plannerFeedback, setPlannerFeedback] = useState<string | null>(null);

  const itemMap = useMemo(
    () => new Map<string, WardrobeItem>(wardrobe.map((item) => [item.itemId, item])),
    [wardrobe]
  );

  const outfitMap = useMemo(
    () => new Map<string, Outfit>(outfits.map((o) => [o.outfitId, o])),
    [outfits]
  );

  // Combine explicit calendarEntries with any worn outfits from history not yet in calendarEntries
  const combinedEntries = useMemo(() => {
    const list: OutfitCalendarEntry[] = [...calendarEntries];
    const existingKeys = new Set(
      calendarEntries.map((e) => `${e.dateKey}_${e.outfitId}`)
    );

    for (const outfit of outfits) {
      if (outfit.wearCount > 0) {
        const rawIso = outfit.updatedAt || outfit.createdAt;
        const parsed = rawIso ? new Date(rawIso) : new Date();
        const dKey = Number.isNaN(parsed.getTime())
          ? todayKey
          : toLocalDateKey(parsed);
        const composite = `${dKey}_${outfit.outfitId}`;
        if (!existingKeys.has(composite)) {
          existingKeys.add(composite);
          list.push({
            entryId: `history_${outfit.outfitId}_${dKey}`,
            userId: outfit.userId,
            dateKey: dKey,
            outfitId: outfit.outfitId,
            title: outfit.title,
            occasion: outfit.occasion,
            status: 'worn',
            itemIds: outfit.itemIds,
            notes: `Logged from Outfit History (${outfit.dressCode})`,
            createdAt: outfit.createdAt,
            updatedAt: outfit.updatedAt,
          });
        }
      }
    }

    return list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [calendarEntries, outfits, todayKey]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, OutfitCalendarEntry[]>();
    for (const entry of combinedEntries) {
      const existing = map.get(entry.dateKey) || [];
      existing.push(entry);
      map.set(entry.dateKey, existing);
    }
    return map;
  }, [combinedEntries]);

  // Build 6-week (42-cell) or 5-week calendar grid for currentMonthDate
  const calendarCells = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
    }[] = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const dKey = toLocalDateKey(d);
      cells.push({
        dateKey: dKey,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dKey === todayKey,
        isPast: dKey < todayKey,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dKey = toLocalDateKey(d);
      cells.push({
        dateKey: dKey,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dKey === todayKey,
        isPast: dKey < todayKey,
      });
    }

    // Trailing days to complete row of 7
    const remainder = cells.length % 7;
    const trailingCount = remainder === 0 ? 0 : 7 - remainder;
    for (let i = 1; i <= trailingCount; i++) {
      const d = new Date(year, month + 1, i);
      const dKey = toLocalDateKey(d);
      cells.push({
        dateKey: dKey,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dKey === todayKey,
        isPast: dKey < todayKey,
      });
    }

    return cells;
  }, [currentMonthDate, todayKey]);

  const selectedDateEntries = useMemo(
    () => entriesByDate.get(selectedDateKey) || [],
    [entriesByDate, selectedDateKey]
  );

  const handleSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setPlannerFeedback(null);
    // Default status to 'planned' for future dates and 'worn' for past dates
    if (dateKey > todayKey) {
      setEntryStatus('planned');
    } else {
      setEntryStatus('worn');
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleJumpToday = () => {
    const now = new Date();
    setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
    handleSelectDate(todayKey);
  };

  const topsList = useMemo(
    () =>
      wardrobe.filter(
        (i) =>
          (i.category === 'Tops' && i.subcategory !== 'Jacket' && i.subcategory !== 'Coat') ||
          i.category === 'Traditional'
      ),
    [wardrobe]
  );
  const bottomsList = useMemo(
    () => wardrobe.filter((i) => i.category === 'Bottoms'),
    [wardrobe]
  );
  const footwearList = useMemo(
    () => wardrobe.filter((i) => i.category === 'Footwear'),
    [wardrobe]
  );
  const layersAndAccList = useMemo(
    () =>
      wardrobe.filter(
        (i) =>
          i.category === 'Accessories' ||
          i.subcategory === 'Jacket' ||
          i.subcategory === 'Coat'
      ),
    [wardrobe]
  );

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPlannerFeedback(null);

    try {
      if (composerSource === 'saved') {
        const chosenOutfit =
          outfitMap.get(selectedOutfitId) || outfits[0];
        if (!chosenOutfit) return;

        await onScheduleOrLogEntry({
          dateKey: selectedDateKey,
          outfitId: chosenOutfit.outfitId,
          title: chosenOutfit.title,
          occasion: chosenOutfit.occasion,
          status: entryStatus,
          itemIds: chosenOutfit.itemIds,
          notes: entryNotes.trim(),
        });

        setPlannerFeedback(
          entryStatus === 'planned'
            ? `Scheduled "${chosenOutfit.title}" for ${selectedDateKey}.`
            : `Logged "${chosenOutfit.title}" as worn on ${selectedDateKey}.`
        );
      } else {
        const chosenIds = [
          customTopId || topsList[0]?.itemId,
          customBottomId || bottomsList[0]?.itemId,
          customFootwearId || footwearList[0]?.itemId,
          customLayerId,
        ].filter((id): id is string => Boolean(id));

        const titleToUse =
          customTitle.trim() || `${customOccasion} Planned Look`;

        await onScheduleOrLogEntry({
          dateKey: selectedDateKey,
          outfitId: `custom_${Date.now()}`,
          title: titleToUse,
          occasion: customOccasion,
          status: entryStatus,
          itemIds: chosenIds,
          notes: entryNotes.trim(),
        });

        setPlannerFeedback(
          entryStatus === 'planned'
            ? `Planned "${titleToUse}" for ${selectedDateKey}.`
            : `Logged "${titleToUse}" as worn on ${selectedDateKey}.`
        );
        setCustomTitle('');
      }
      setEntryNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthTitle = currentMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const selectedDateFormatted = parseDateKey(selectedDateKey).toLocaleDateString(
    'en-US',
    {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  );

  const totalWornCount = combinedEntries.filter((e) => e.status === 'worn').length;
  const totalPlannedCount = combinedEntries.filter((e) => e.status === 'planned').length;

  return (
    <section
      aria-label="Outfit Calendar & Schedule Planner"
      className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-6"
    >
      {/* Calendar Header & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 dark:border-stone-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <CalendarIcon className="w-3.5 h-3.5 text-[#8C5A32] dark:text-[#D4A373]" />
            <span>Wardrobe Schedule & Wear Log</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{totalWornCount} Logged</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num text-[#8C5A32] dark:text-[#D4A373] font-medium">
              {totalPlannedCount} Planned
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
            Outfit Calendar & Date Planner
          </h2>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="min-h-[38px] min-w-[38px] rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-stone-900 dark:text-stone-100">
            {monthTitle}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="min-h-[38px] min-w-[38px] rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleJumpToday}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Main Split Grid: Left 7 cols Month Calendar, Right 5 cols Selected Date Detail & Planner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Month Grid */}
        <div className="lg:col-span-7 space-y-3">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-[11px] font-medium text-stone-500 dark:text-stone-400 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell) => {
              const dayEntries = entriesByDate.get(cell.dateKey) || [];
              const isSelected = cell.dateKey === selectedDateKey;
              const hasPlanned = dayEntries.some((e) => e.status === 'planned');
              const hasWorn = dayEntries.some((e) => e.status === 'worn');
              const firstEntry = dayEntries[0];
              const previewItem = firstEntry
                ? itemMap.get(firstEntry.itemIds[0])
                : undefined;

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => handleSelectDate(cell.dateKey)}
                  aria-label={`Select date ${cell.dateKey}`}
                  className={`min-h-[76px] sm:min-h-[88px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-[#8C5A32] dark:border-[#D4A373] bg-[#FAF8F5] dark:bg-stone-950 ring-2 ring-[#8C5A32]/20'
                      : cell.isCurrentMonth
                        ? 'border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-400'
                        : 'border-stone-100 dark:border-stone-900 bg-stone-50/60 dark:bg-stone-950/40 opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`font-mono-num text-xs font-medium ${
                        cell.isToday
                          ? 'px-1.5 py-0.5 rounded-md bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                          : 'text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {dayEntries.length > 0 && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasPlanned
                            ? 'bg-[#8C5A32] dark:bg-[#D4A373]'
                            : 'bg-emerald-700 dark:bg-emerald-400'
                        }`}
                        title={hasPlanned ? 'Scheduled outfit' : 'Logged worn outfit'}
                      />
                    )}
                  </div>

                  {firstEntry ? (
                    <div className="mt-1.5 space-y-1 w-full overflow-hidden">
                      {previewItem && (
                        <div className="w-7 h-7 rounded-md overflow-hidden bg-stone-100 dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700">
                          <GarmentImage
                            imageUrl={previewItem.imageUrl}
                            name={previewItem.name}
                            category={previewItem.category}
                            subcategory={previewItem.subcategory}
                            primaryColor={previewItem.primaryColor}
                            secondaryColor={previewItem.secondaryColor}
                            pattern={previewItem.pattern}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <p
                        className={`text-[10px] font-medium truncate ${
                          hasPlanned
                            ? 'text-[#8C5A32] dark:text-[#D4A373]'
                            : 'text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {firstEntry.title}
                      </p>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400 dark:text-stone-600">
                      {cell.isToday ? 'Today' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 dark:bg-emerald-400" />
              <span>Past / Logged Worn Outfit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8C5A32] dark:bg-[#D4A373]" />
              <span>Upcoming / Scheduled Outfit</span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Date Inspector & Outfit Scheduler */}
        <div className="lg:col-span-5 space-y-5 p-5 rounded-2xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200/90 dark:border-stone-800">
          <div className="flex items-start justify-between gap-2 border-b border-stone-200/80 dark:border-stone-800 pb-3.5">
            <div>
              <p className="text-xs font-medium text-[#8C5A32] dark:text-[#D4A373]">
                {selectedDateKey === todayKey
                  ? 'Today’s Schedule'
                  : selectedDateKey > todayKey
                    ? 'Upcoming Date Plan'
                    : 'Past Outfit Log'}
              </p>
              <h3 className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mt-0.5">
                {selectedDateFormatted}
              </h3>
            </div>
            <input
              type="date"
              aria-label="Jump to specific date"
              value={selectedDateKey}
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectDate(e.target.value);
                  const d = parseDateKey(e.target.value);
                  setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }
              }}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs font-mono-num text-stone-800 dark:text-stone-200"
            />
          </div>

          {/* Existing Outfits for Selected Date */}
          {selectedDateEntries.length === 0 ? (
            <div className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/70 dark:border-stone-800 text-xs text-stone-600 dark:text-stone-400">
              No outfit logged or scheduled for this date yet. Use the planner below to schedule a saved outfit or build a custom look.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateEntries.map((entry) => {
                const entryItems = entry.itemIds
                  .map((id) => itemMap.get(id))
                  .filter((i): i is WardrobeItem => Boolean(i));
                const linkedOutfit = outfitMap.get(entry.outfitId);
                const isSyntheticHistory = entry.entryId.startsWith('history_');

                return (
                  <div
                    key={entry.entryId}
                    className="p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span
                            className={`font-semibold ${
                              entry.status === 'planned'
                                ? 'text-[#8C5A32] dark:text-[#D4A373]'
                                : 'text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {entry.status === 'planned' ? 'Scheduled' : 'Worn & Logged'}
                          </span>
                          <span aria-hidden="true" className="text-stone-400">
                            ·
                          </span>
                          <span className="text-stone-500 dark:text-stone-400">
                            {entry.occasion}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mt-0.5">
                          {entry.title}
                        </h4>
                      </div>

                      {!isSyntheticHistory && (
                        <button
                          type="button"
                          onClick={() => onDeleteCalendarEntry(entry.entryId)}
                          aria-label="Remove scheduled outfit"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {entryItems.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {entryItems.slice(0, 4).map((item) => (
                          <div
                            key={item.itemId}
                            className="rounded-lg bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200/60 dark:border-stone-800 overflow-hidden"
                          >
                            <div className="aspect-3/4 w-full bg-stone-100 dark:bg-stone-900">
                              <GarmentImage
                                imageUrl={item.imageUrl}
                                name={item.name}
                                category={item.category}
                                subcategory={item.subcategory}
                                primaryColor={item.primaryColor}
                                secondaryColor={item.secondaryColor}
                                pattern={item.pattern}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="p-1 text-[10px] text-stone-700 dark:text-stone-300 truncate">
                              {item.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.notes && (
                      <p className="text-xs text-stone-600 dark:text-stone-400 italic">
                        “{entry.notes}”
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {entry.status === 'planned' && !isSyntheticHistory && (
                        <button
                          type="button"
                          onClick={() => onMarkEntryAsWorn(entry)}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-[#8C5A32] hover:bg-[#734825] text-white text-xs font-medium flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark as Worn</span>
                        </button>
                      )}
                      {linkedOutfit && onOpenOutfitInStylist && (
                        <button
                          type="button"
                          onClick={() => onOpenOutfitInStylist(linkedOutfit)}
                          className="min-h-[34px] px-3 py-1 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Open in Stylist</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Plan / Log Outfit Composer Form */}
          <form
            onSubmit={handleScheduleSubmit}
            className="pt-4 border-t border-stone-200/80 dark:border-stone-800 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                Plan or Log Outfit for Date
              </h4>

              <div className="inline-flex rounded-lg bg-stone-200/70 dark:bg-stone-900 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setComposerSource('saved')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    composerSource === 'saved'
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  Saved Outfit
                </button>
                <button
                  type="button"
                  onClick={() => setComposerSource('custom')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    composerSource === 'custom'
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  Custom Pieces
                </button>
              </div>
            </div>

            {composerSource === 'saved' ? (
              <div>
                <label
                  htmlFor="calendar-outfit-select"
                  className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Select Saved Outfit
                </label>
                <select
                  id="calendar-outfit-select"
                  value={selectedOutfitId}
                  onChange={(e) => setSelectedOutfitId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100"
                >
                  {outfits.map((o) => (
                    <option key={o.outfitId} value={o.outfitId}>
                      {o.title} ({o.occasion})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Look Title
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g., Friday Client Lunch"
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Occasion
                    </label>
                    <select
                      value={customOccasion}
                      onChange={(e) => setCustomOccasion(e.target.value)}
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                    >
                      {ALL_OCCASIONS.map((occ) => (
                        <option key={occ} value={occ}>
                          {occ}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Top / Tunic
                    </label>
                    <select
                      value={customTopId || topsList[0]?.itemId || ''}
                      onChange={(e) => setCustomTopId(e.target.value)}
                      className="w-full min-h-[38px] px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                    >
                      {topsList.map((i) => (
                        <option key={i.itemId} value={i.itemId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Bottom
                    </label>
                    <select
                      value={customBottomId || bottomsList[0]?.itemId || ''}
                      onChange={(e) => setCustomBottomId(e.target.value)}
                      className="w-full min-h-[38px] px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                    >
                      {bottomsList.map((i) => (
                        <option key={i.itemId} value={i.itemId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Footwear
                    </label>
                    <select
                      value={customFootwearId || footwearList[0]?.itemId || ''}
                      onChange={(e) => setCustomFootwearId(e.target.value)}
                      className="w-full min-h-[38px] px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                    >
                      {footwearList.map((i) => (
                        <option key={i.itemId} value={i.itemId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Layer / Accessory
                    </label>
                    <select
                      value={customLayerId}
                      onChange={(e) => setCustomLayerId(e.target.value)}
                      className="w-full min-h-[38px] px-2 py-1.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                    >
                      <option value="">None</option>
                      {layersAndAccList.map((i) => (
                        <option key={i.itemId} value={i.itemId}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Status & Event Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Calendar Status
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEntryStatus('planned')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-colors ${
                      entryStatus === 'planned'
                        ? 'bg-[#8C5A32] text-white border-[#8C5A32]'
                        : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>Planned</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryStatus('worn')}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-colors ${
                      entryStatus === 'worn'
                        ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 border-stone-900'
                        : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    <span>Worn</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Event / Schedule Note
                </label>
                <input
                  type="text"
                  value={entryNotes}
                  onChange={(e) => setEntryNotes(e.target.value)}
                  placeholder="e.g., 4 PM ceremony or client dinner"
                  className="w-full min-h-[36px] px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            {plannerFeedback && (
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                {plannerFeedback}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (composerSource === 'saved' && outfits.length === 0)}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {entryStatus === 'planned'
                  ? 'Schedule Outfit for This Date'
                  : 'Log Outfit as Worn on This Date'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
