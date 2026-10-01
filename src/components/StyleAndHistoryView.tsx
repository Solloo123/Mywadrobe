import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Check,
  Heart,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  ALL_OCCASIONS,
  CalendarEntryStatus,
  COMMON_COLORS,
  Outfit,
  OutfitCalendarEntry,
  STYLE_OPTIONS,
  StyleFeedback,
  UserProfile,
  WardrobeItem,
} from '../types';
import { getColorSwatchHex } from '../utils/garmentVisuals';
import { GarmentImage } from './GarmentImage';
import { OutfitCalendar } from './OutfitCalendar';

interface StyleAndHistoryViewProps {
  mode: 'history' | 'profile';
  wardrobe: WardrobeItem[];
  outfits: Outfit[];
  calendarEntries?: OutfitCalendarEntry[];
  feedbackList: StyleFeedback[];
  userProfile: UserProfile;
  isDemoMode: boolean;
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  onToggleFavoriteOutfit: (outfit: Outfit) => Promise<void>;
  onDeleteOutfit: (outfitId: string) => Promise<void>;
  onWearAgainOutfit: (outfit: Outfit) => Promise<void>;
  onModifyOutfitInStylist: (outfit: Outfit) => void;
  onScheduleOrLogCalendarEntry?: (params: {
    dateKey: string;
    outfitId: string;
    title: string;
    occasion: string;
    status: CalendarEntryStatus;
    itemIds: string[];
    notes: string;
  }) => Promise<void>;
  onMarkCalendarEntryAsWorn?: (entry: OutfitCalendarEntry) => Promise<void>;
  onDeleteCalendarEntry?: (entryId: string) => Promise<void>;
  onResetDemoData?: () => void;
}

export const StyleAndHistoryView: React.FC<StyleAndHistoryViewProps> = ({
  mode,
  wardrobe,
  outfits,
  calendarEntries = [],
  feedbackList,
  userProfile,
  isDemoMode,
  onUpdateProfile,
  onToggleFavoriteOutfit,
  onDeleteOutfit,
  onWearAgainOutfit,
  onModifyOutfitInStylist,
  onScheduleOrLogCalendarEntry,
  onMarkCalendarEntryAsWorn,
  onDeleteCalendarEntry,
  onResetDemoData,
}) => {
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);
  const [showCalendarSection, setShowCalendarSection] = useState(true);
  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [locationCity, setLocationCity] = useState(userProfile.locationCity);
  const [bio, setBio] = useState(userProfile.bio);
  const [preferredFit, setPreferredFit] = useState<UserProfile['preferredFit']>(
    userProfile.preferredFit
  );
  const [favoriteColors, setFavoriteColors] = useState<string[]>(userProfile.favoriteColors);
  const [preferredStyles, setPreferredStyles] = useState<string[]>(userProfile.preferredStyles);
  const [preferredOccasions, setPreferredOccasions] = useState<string[]>(
    userProfile.preferredOccasions
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  const itemMap = useMemo(
    () => new Map<string, WardrobeItem>(wardrobe.map((i) => [i.itemId, i])),
    [wardrobe]
  );

  // Compute "My Style" Learning Insights from wardrobe & feedback
  const styleInsights = useMemo(() => {
    const colorCounts = new Map<string, number>();
    for (const item of wardrobe) {
      colorCounts.set(
        item.primaryColor,
        (colorCounts.get(item.primaryColor) || 0) + 1 + (item.isFavorite ? 2 : 0)
      );
    }
    for (const fb of feedbackList) {
      if (fb.rating === 'love' || fb.rating === 'good') {
        for (const c of fb.dominantColors) {
          colorCounts.set(c, (colorCounts.get(c) || 0) + (fb.rating === 'love' ? 3 : 1));
        }
      }
    }
    const topColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => color);

    const subCounts = new Map<string, number>();
    for (const item of wardrobe) {
      subCounts.set(item.subcategory, (subCounts.get(item.subcategory) || 0) + item.usageCount + 1);
    }
    const topCategories = Array.from(subCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([sub]) => sub);

    const mostUsedShoes = wardrobe
      .filter((i) => i.category === 'Footwear')
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 3);

    const favoriteOutfits = outfits.filter((o) => o.isFavorite || o.rating === 'love');

    return {
      topColors,
      topCategories,
      mostUsedShoes,
      favoriteOutfits,
    };
  }, [wardrobe, feedbackList, outfits]);

  const displayedOutfits = useMemo(() => {
    return outfits.filter((o) => (filterFavoritesOnly ? o.isFavorite : true));
  }, [outfits, filterFavoritesOnly]);

  const toggleArrayValue = (list: string[], val: string, setter: (next: string[]) => void, max = 15) => {
    if (list.includes(val)) {
      setter(list.filter((x) => x !== val));
    } else {
      setter([...list, val].slice(0, max));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      displayName,
      locationCity,
      bio,
      preferredFit,
      favoriteColors,
      preferredStyles,
      preferredOccasions,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (mode === 'history') {
    return (
      <div className="space-y-10 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Saved Ensembles, Wear Calendar & Style Learning ·{' '}
              <span className="font-mono-num">{outfits.length}</span> Looks
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
              Outfit History, Calendar & My Style
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCalendarSection((v) => !v)}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showCalendarSection
                  ? 'bg-[#8C5A32] text-white'
                  : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{showCalendarSection ? 'Calendar View Active' : 'Show Calendar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterFavoritesOnly(false)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                !filterFavoritesOnly
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              All Outfits ({outfits.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterFavoritesOnly(true)}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                filterFavoritesOnly
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              Favorites ({outfits.filter((o) => o.isFavorite).length})
            </button>
          </div>
        </div>

        {/* Interactive Outfit Calendar & Date Planner */}
        {showCalendarSection && (
          <OutfitCalendar
            wardrobe={wardrobe}
            outfits={outfits}
            calendarEntries={calendarEntries}
            onScheduleOrLogEntry={
              onScheduleOrLogCalendarEntry || (async () => {})
            }
            onMarkEntryAsWorn={
              onMarkCalendarEntryAsWorn || (async () => {})
            }
            onDeleteCalendarEntry={
              onDeleteCalendarEntry || (async () => {})
            }
            onOpenOutfitInStylist={onModifyOutfitInStylist}
          />
        )}

        {/* Section 10: "My Style" Learning Summary Dashboard */}
        <section className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-6">
          <div>
            <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
              My Style Profile
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Automatically refined from your wardrobe favorites, wear counts, and outfit ratings
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Preferred Colors */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                Preferred Palette
              </p>
              <div className="space-y-2">
                {styleInsights.topColors.map((color) => (
                  <div key={color} className="flex items-center gap-2.5 text-sm text-stone-800 dark:text-stone-200">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-stone-300 dark:border-stone-600 shrink-0"
                      style={{ backgroundColor: getColorSwatchHex(color) }}
                    />
                    <span>{color}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most-Used Subcategories */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                Signature Silhouettes
              </p>
              <div className="space-y-1.5 text-sm text-stone-800 dark:text-stone-200">
                {styleInsights.topCategories.map((cat, idx) => (
                  <p key={cat}>
                    <span className="font-mono-num text-xs text-stone-400 mr-2">0{idx + 1}.</span>
                    {cat}
                  </p>
                ))}
              </div>
            </div>

            {/* Most-Used Footwear */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                Most-Worn Footwear
              </p>
              <div className="space-y-2">
                {styleInsights.mostUsedShoes.map((shoe) => (
                  <div key={shoe.itemId} className="flex items-center justify-between text-sm">
                    <span className="text-stone-800 dark:text-stone-200 truncate pr-2">
                      {shoe.name}
                    </span>
                    <span className="font-mono-num text-xs text-stone-500 shrink-0">
                      {shoe.usageCount}× worn
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 11: Outfit History List */}
        {displayedOutfits.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-center space-y-3">
            <h3 className="text-xl font-display font-semibold text-stone-900 dark:text-stone-100">
              No saved outfits yet
            </h3>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Generate a look in the Stylist tab and tap “Save outfit” to build your personal lookbook.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayedOutfits.map((outfit, idx) => {
              const resolvedItems = Array.from(new Set(outfit.itemIds))
                .map((id) => itemMap.get(id))
                .filter((i): i is WardrobeItem => Boolean(i));

              const formattedDate = outfit.createdAt
                ? new Date(outfit.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recent';

              const lastWornDate = outfit.updatedAt
                ? new Date(outfit.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : formattedDate;

              return (
                <motion.article
                  key={outfit.outfitId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(idx * 0.04, 0.2),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <span>{outfit.occasion}</span>
                        <span aria-hidden="true">·</span>
                        <span>{outfit.dressCode}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-stone-700 dark:text-stone-300">
                          {outfit.wearCount > 0
                            ? `Worn on ${lastWornDate}`
                            : `Saved on ${formattedDate}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">Worn {outfit.wearCount}×</span>
                        {outfit.rating !== 'unrated' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[#8C5A32] dark:text-[#D4A373]">
                              Rated: {outfit.rating === 'love' ? 'Loved' : outfit.rating === 'good' ? 'Good' : 'Not for me'}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
                        {outfit.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteOutfit(outfit)}
                        aria-label="Toggle favorite outfit"
                        className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium flex items-center gap-1.5"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            outfit.isFavorite ? 'fill-rose-600 text-rose-600' : ''
                          }`}
                        />
                        <span>{outfit.isFavorite ? 'Favorited' : 'Favorite'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onWearAgainOutfit(outfit)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#8C5A32] hover:bg-[#734825] text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Wear Today</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onModifyOutfitInStylist(outfit)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Modify</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteOutfit(outfit.outfitId)}
                        aria-label="Delete outfit"
                        className="min-h-[40px] min-w-[40px] rounded-lg text-stone-400 hover:text-red-600 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Item Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {resolvedItems.map((item) => (
                      <div
                        key={item.itemId}
                        className="rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200/70 dark:border-stone-800 overflow-hidden"
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
                        <div className="p-2.5">
                          <p className="text-[11px] text-stone-500 truncate">
                            {item.subcategory} · <span className="font-mono-num">{item.usageCount}×</span>
                          </p>
                          <p className="text-xs font-medium text-stone-900 dark:text-stone-100 truncate">
                            {item.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                    “{outfit.explanation}”
                  </p>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Profile & Style Preferences Mode
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Personal Styling Calibration · {isDemoMode ? 'Guest Demo Mode' : 'Authenticated Account'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
            Style Preferences & Profile
          </h1>
        </div>

        {isDemoMode && onResetDemoData && (
          <button
            type="button"
            onClick={onResetDemoData}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1.5 self-start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Wardrobe</span>
          </button>
        )}
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              City / Climate Context
            </label>
            <input
              type="text"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              placeholder="e.g., Dar es Salaam, Tanzania"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Preferred Garment Fit
            </label>
            <select
              value={preferredFit}
              onChange={(e) => setPreferredFit(e.target.value as UserProfile['preferredFit'])}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            >
              {(['Slim', 'Regular', 'Relaxed', 'Tailored', 'Oversized'] as const).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
              Personal Style Bio
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
        </div>

        {/* Favorite Colors */}
        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
            Favorite Colors
          </label>
          <div className="flex flex-wrap gap-2">
            {COMMON_COLORS.map((color) => {
              const active = favoriteColors.includes(color);
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => toggleArrayValue(favoriteColors, color, setFavoriteColors)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                    active
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-stone-400"
                    style={{ backgroundColor: getColorSwatchHex(color) }}
                  />
                  <span>{color}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred Clothing Styles */}
        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
            Preferred Clothing Styles
          </label>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((sty) => {
              const active = preferredStyles.includes(sty);
              return (
                <button
                  key={sty}
                  type="button"
                  onClick={() => toggleArrayValue(preferredStyles, sty, setPreferredStyles)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {sty}
                </button>
              );
            })}
          </div>
        </div>

        {/* Preferred Occasions */}
        <div>
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
            Preferred Occasions
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_OCCASIONS.map((occ) => {
              const active = preferredOccasions.includes(occ);
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() =>
                    toggleArrayValue(preferredOccasions, occ, setPreferredOccasions, 20)
                  }
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {occ}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
          {saveSuccess ? (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Style preferences saved
            </span>
          ) : (
            <span className="text-xs text-stone-500">
              Used by the AI Personal Stylist on every recommendation
            </span>
          )}

          <button
            type="submit"
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
