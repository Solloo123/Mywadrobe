import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  Briefcase,
  Calendar,
  Check,
  CloudSun,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import {
  ALL_OCCASIONS,
  GeneratedOutfitResult,
  GeneratedTripCapsule,
  OutfitRating,
  OutfitSlotKey,
  STYLE_OPTIONS,
  StyleFeedback,
  TripPlan,
  UserProfile,
  WardrobeItem,
} from '../types';
import {
  buildHumanExplanation,
  findCompatibleAlternativesForSlot,
  generateRuleBasedTripCapsule,
  generateTripCapsule,
  interpretOccasionWithAI,
  SwapAlternative,
} from '../services/compatibilityEngine';
import {
  detectAndFetchLocalWeather,
  fetchWeatherByCity,
  LiveWeatherReport,
  WEATHER_CONTEXT_PRESETS,
} from '../services/weatherService';
import { GarmentImage } from './GarmentImage';

interface StylistViewProps {
  wardrobe: WardrobeItem[];
  userProfile: UserProfile;
  feedbackList: StyleFeedback[];
  currentResult: GeneratedOutfitResult | null;
  isGenerating: boolean;
  selectedOccasion: string;
  setSelectedOccasion: (occ: string) => void;
  timeOfDay: string;
  setTimeOfDay: (t: string) => void;
  locationContext: string;
  setLocationContext: (l: string) => void;
  weatherContext: string;
  setWeatherContext: (w: string) => void;
  desiredStyle: string;
  setDesiredStyle: (s: string) => void;
  onStyleMe: (generateAnother?: boolean) => Promise<void>;
  onUpdateCurrentResult: (updated: GeneratedOutfitResult) => void;
  onRateCurrentOutfit: (rating: OutfitRating) => Promise<void>;
  onSaveCurrentOutfit: (wearNow?: boolean) => Promise<unknown>;
  onOpenAddModal: () => void;
  onViewHistory?: () => void;
  savedNotice: string | null;
  currentRating: OutfitRating;
  isWornToday?: boolean;
  trips?: TripPlan[];
  onSaveTripPlan?: (capsule: GeneratedTripCapsule, packedIds: string[]) => Promise<void>;
  onToggleTripPackedItem?: (trip: TripPlan, itemId: string) => Promise<void>;
  onDeleteTripPlan?: (tripId: string) => Promise<void>;
}

const SLOT_METADATA: { key: OutfitSlotKey; label: string; swapButtonLabel: string; required: boolean }[] = [
  { key: 'top', label: 'Top / Tunic', swapButtonLabel: 'Change shirt', required: true },
  { key: 'bottom', label: 'Bottom / Trousers', swapButtonLabel: 'Change trousers', required: true },
  { key: 'footwear', label: 'Shoes', swapButtonLabel: 'Change shoes', required: true },
  { key: 'jacket', label: 'Layer / Jacket (Optional)', swapButtonLabel: 'Change jacket', required: false },
  { key: 'belt', label: 'Belt', swapButtonLabel: 'Change belt', required: false },
  { key: 'watch', label: 'Watch', swapButtonLabel: 'Change watch', required: false },
  { key: 'accessory', label: 'Extra Accessory', swapButtonLabel: 'Change accessory', required: false },
];

const POPULAR_DESTINATIONS = [
  'Zanzibar, Tanzania',
  'Arusha & Serengeti',
  'Nairobi, Kenya',
  'Dodoma, Tanzania',
  'Cape Town, South Africa',
  'London, UK',
];

const TRIP_VIBES = [
  'Smart Casual & Leisure',
  'Business & Executive',
  'Wedding & Ceremonial',
  'Safari & Outdoor',
];

export const StylistView: React.FC<StylistViewProps> = ({
  wardrobe,
  userProfile,
  feedbackList,
  currentResult,
  isGenerating,
  selectedOccasion,
  setSelectedOccasion,
  timeOfDay,
  setTimeOfDay,
  locationContext,
  setLocationContext,
  weatherContext,
  setWeatherContext,
  desiredStyle,
  setDesiredStyle,
  onStyleMe,
  onUpdateCurrentResult,
  onRateCurrentOutfit,
  onSaveCurrentOutfit,
  onOpenAddModal,
  onViewHistory,
  savedNotice,
  currentRating,
  isWornToday = false,
  trips = [],
  onSaveTripPlan,
  onToggleTripPackedItem,
  onDeleteTripPlan,
}) => {
  const [stylistSectionMode, setStylistSectionMode] = useState<'occasion' | 'trip'>('occasion');
  const [customOccasionPrompt, setCustomOccasionPrompt] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretationBanner, setInterpretationBanner] = useState<string | null>(null);

  // Swap Item Drawer State
  const [activeSwapSlot, setActiveSwapSlot] = useState<OutfitSlotKey | null>(null);
  const [showCompatibilityNotes, setShowCompatibilityNotes] = useState(false);

  // Trip Packing List State
  const [tripDestination, setTripDestination] = useState('Zanzibar, Tanzania');
  const [tripDurationDays, setTripDurationDays] = useState<number>(4);
  const [tripVibe, setTripVibe] = useState<string>('Smart Casual & Leisure');
  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);
  const [currentTripCapsule, setCurrentTripCapsule] = useState<GeneratedTripCapsule | null>(null);
  const [packedDraftIds, setPackedDraftIds] = useState<string[]>([]);
  const [tripSavedBanner, setTripSavedBanner] = useState<string | null>(null);

  // Live Weather API State
  const [liveWeather, setLiveWeather] = useState<LiveWeatherReport | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherCityInput, setWeatherCityInput] = useState(
    userProfile.locationCity || 'Dar es Salaam, Tanzania'
  );
  const [showCityWeatherInput, setShowCityWeatherInput] = useState(false);

  const wardrobeMap = useMemo(
    () => new Map<string, WardrobeItem>(wardrobe.map((item) => [item.itemId, item])),
    [wardrobe]
  );

  // Automatically fetch local weather conditions on mount and update Weather Context
  useEffect(() => {
    let cancelled = false;
    const autoLoadWeather = async () => {
      setIsFetchingWeather(true);
      try {
        const report = await detectAndFetchLocalWeather(
          userProfile.locationCity || 'Dar es Salaam, Tanzania',
          true
        );
        if (!cancelled) {
          setLiveWeather(report);
          setWeatherContext(report.weatherContext);
          setWeatherCityInput(
            report.country ? `${report.city}, ${report.country}` : report.city
          );
        }
      } finally {
        if (!cancelled) {
          setIsFetchingWeather(false);
        }
      }
    };
    autoLoadWeather();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile.locationCity]);

  const handleAutoFetchLocalWeather = async () => {
    setIsFetchingWeather(true);
    try {
      const report = await detectAndFetchLocalWeather(
        weatherCityInput || userProfile.locationCity || 'Dar es Salaam, Tanzania',
        true
      );
      setLiveWeather(report);
      setWeatherContext(report.weatherContext);
      setWeatherCityInput(
        report.country ? `${report.city}, ${report.country}` : report.city
      );
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const handleFetchWeatherForCity = async (cityOverride?: string) => {
    const target = (cityOverride ?? weatherCityInput).trim() || userProfile.locationCity;
    if (!target) return;
    setIsFetchingWeather(true);
    try {
      const report = await fetchWeatherByCity(target);
      setLiveWeather(report);
      setWeatherContext(report.weatherContext);
      setWeatherCityInput(
        report.country ? `${report.city}, ${report.country}` : report.city
      );
      setShowCityWeatherInput(false);
    } finally {
      setIsFetchingWeather(false);
    }
  };

  // Initialize default Trip Capsule once wardrobe is ready
  useEffect(() => {
    if (!currentTripCapsule && wardrobe.length > 0) {
      const initialCapsule = generateRuleBasedTripCapsule({
        destination: tripDestination,
        durationDays: tripDurationDays,
        tripVibe,
        wardrobe,
        userProfile,
        feedbackList,
      });
      setCurrentTripCapsule(initialCapsule);
    }
  }, [wardrobe, currentTripCapsule, tripDestination, tripDurationDays, tripVibe, userProfile, feedbackList]);

  const handleGenerateTripList = async (e?: React.FormEvent, overrideDestination?: string) => {
    if (e) e.preventDefault();
    const targetDest = (overrideDestination ?? tripDestination).trim() || 'Zanzibar, Tanzania';
    const days = Math.max(1, Math.min(30, Number(tripDurationDays) || 4));
    setIsGeneratingTrip(true);
    setTripSavedBanner(null);
    try {
      const capsule = await generateTripCapsule({
        destination: targetDest,
        durationDays: days,
        tripVibe,
        wardrobe,
        userProfile,
        feedbackList,
      });
      setCurrentTripCapsule(capsule);
      setPackedDraftIds([]);
    } finally {
      setIsGeneratingTrip(false);
    }
  };

  const toggleDraftPacked = (itemId: string) => {
    setPackedDraftIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSaveCurrentTrip = async () => {
    if (!currentTripCapsule || !onSaveTripPlan) return;
    await onSaveTripPlan(currentTripCapsule, packedDraftIds);
    setTripSavedBanner(
      `Saved "${currentTripCapsule.title}" (${currentTripCapsule.itemIds.length} pieces for ${currentTripCapsule.durationDays} days) to your Trip Lists.`
    );
  };

  const handleCustomOccasionInterpret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customOccasionPrompt.trim()) return;
    setIsInterpreting(true);
    setInterpretationBanner(null);
    try {
      const { interpretation } = await interpretOccasionWithAI(
        customOccasionPrompt.trim(),
        userProfile.locationCity
      );
      setSelectedOccasion(interpretation.occasion);
      setTimeOfDay(interpretation.timeOfDay);
      setLocationContext(interpretation.locationContext);
      setWeatherContext(interpretation.weatherContext);
      setDesiredStyle(interpretation.desiredStyle);
      setInterpretationBanner(
        `${interpretation.summary} (Dress code: ${interpretation.dressCode})`
      );
    } finally {
      setIsInterpreting(false);
    }
  };

  const swapAlternatives: SwapAlternative[] =
    activeSwapSlot && currentResult
      ? findCompatibleAlternativesForSlot({
          slot: activeSwapSlot,
          currentSlots: currentResult.slots,
          wardrobe,
          occasion: currentResult.occasion,
          desiredStyle: currentResult.desiredStyle,
          weatherContext: currentResult.weatherContext,
          userProfile,
          feedbackList,
        })
      : [];

  const handleSelectSwapItem = (slot: OutfitSlotKey, newItem: WardrobeItem | null) => {
    if (!currentResult) return;
    const updatedSlots = {
      ...currentResult.slots,
      [slot]: newItem,
    };
    const updatedIds = [
      updatedSlots.top?.itemId,
      updatedSlots.jacket?.itemId,
      updatedSlots.bottom?.itemId,
      updatedSlots.footwear?.itemId,
      updatedSlots.belt?.itemId,
      updatedSlots.watch?.itemId,
      updatedSlots.accessory?.itemId,
    ].filter((id): id is string => Boolean(id));

    const updatedExplanation = buildHumanExplanation(
      updatedSlots,
      currentResult.occasion,
      currentResult.dressCode,
      currentResult.weatherContext
    );

    onUpdateCurrentResult({
      ...currentResult,
      slots: updatedSlots,
      itemIds: updatedIds,
      explanation: updatedExplanation,
    });
    setActiveSwapSlot(null);
  };

  const resolvedCapsuleItems = useMemo(() => {
    if (!currentTripCapsule) return [];
    return currentTripCapsule.itemIds
      .map((id) => wardrobeMap.get(id))
      .filter((item): item is WardrobeItem => Boolean(item));
  }, [currentTripCapsule, wardrobeMap]);

  return (
    <div className="space-y-12 pb-12">
      {/* Mode Switcher Bar: Single Occasion Stylist vs. Trip Packing List */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-stone-800">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            AI Personal Stylist & Travel Capsule Engine · {userProfile.locationCity}
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
            {stylistSectionMode === 'trip'
              ? 'Trip Packing List & Capsule Planner'
              : 'Style Me for Any Occasion'}
          </h1>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-stone-200/75 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStylistSectionMode('occasion')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              stylistSectionMode === 'occasion'
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8C5A32] dark:text-[#D4A373]" />
            <span>Occasion Stylist</span>
          </button>
          <button
            type="button"
            onClick={() => setStylistSectionMode('trip')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              stylistSectionMode === 'trip'
                ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-[#8C5A32] dark:text-[#D4A373]" />
            <span>Trip Packing List</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION A: SINGLE OCCASION STYLIST (Shown first when mode === 'occasion')
         ===================================================================== */}
      <section
        className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-start ${
          stylistSectionMode === 'trip' ? 'order-2 pt-8 border-t border-stone-200 dark:border-stone-800' : 'order-1'
        }`}
      >
        <div className="lg:col-span-5 space-y-5">
          <div>
            <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
              Single Occasion Outfit
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
              Every outfit is curated strictly from the{' '}
              <span className="font-mono-num font-medium text-stone-900 dark:text-stone-100">
                {wardrobe.length}
              </span>{' '}
              pieces in your wardrobe, balanced for color harmony, formality, and climate.
            </p>
          </div>

          {/* Custom Occasion Prompt Box */}
          <form
            onSubmit={handleCustomOccasionInterpret}
            className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-3"
          >
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              Describe your event in your own words (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customOccasionPrompt}
                onChange={(e) => setCustomOccasionPrompt(e.target.value)}
                placeholder="e.g., I am attending a wedding at 4 PM in Masaki"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
              />
              <button
                type="submit"
                disabled={isInterpreting || !customOccasionPrompt.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isInterpreting ? 'Reading...' : 'Interpret'}
              </button>
            </div>
            {interpretationBanner && (
              <p className="text-xs text-[#8C5A32] dark:text-[#D4A373] leading-relaxed">
                {interpretationBanner}
              </p>
            )}
          </form>

          {/* Structured Context Selectors */}
          <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                Occasion
              </label>
              <select
                value={selectedOccasion}
                onChange={(e) => setSelectedOccasion(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
              >
                {ALL_OCCASIONS.map((occ) => (
                  <option key={occ} value={occ}>
                    {occ}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Time of Day
                </label>
                <select
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                >
                  {['Morning', 'Afternoon', 'Evening', 'Night'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Location / Setting
                </label>
                <select
                  value={locationContext}
                  onChange={(e) => setLocationContext(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                >
                  {[
                    'Restaurant',
                    'Corporate Office',
                    'Garden / Outdoor Venue',
                    'Church / Sanctuary',
                    'University Campus',
                    'Hotel Ballroom',
                    'Coastal / Beachside',
                    'Airport / Travel',
                  ].map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="stylist-weather-context"
                    className="block text-xs font-medium text-stone-700 dark:text-stone-300"
                  >
                    Weather Context
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAutoFetchLocalWeather}
                      disabled={isFetchingWeather}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#8C5A32] dark:text-[#D4A373] hover:underline disabled:opacity-50"
                      title="Detect local coordinates or city and fetch live weather conditions"
                    >
                      {isFetchingWeather ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Navigation className="w-3 h-3" />
                      )}
                      <span>{isFetchingWeather ? 'Fetching weather...' : 'Auto-Fetch Local'}</span>
                    </button>
                    <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">
                      |
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCityWeatherInput((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{showCityWeatherInput ? 'Hide City' : 'Change City'}</span>
                    </button>
                  </div>
                </div>

                {showCityWeatherInput && (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={weatherCityInput}
                      onChange={(e) => setWeatherCityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFetchWeatherForCity();
                        }
                      }}
                      placeholder="Enter city (e.g., Dar es Salaam, Nairobi, London)"
                      aria-label="Weather City Lookup"
                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchWeatherForCity()}
                      disabled={isFetchingWeather}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium whitespace-nowrap disabled:opacity-50"
                    >
                      Fetch Weather
                    </button>
                  </div>
                )}

                <input
                  id="stylist-weather-context"
                  type="text"
                  aria-label="Weather Context"
                  value={weatherContext}
                  onChange={(e) => setWeatherContext(e.target.value)}
                  placeholder="e.g., Warm & Breezy (28°C)"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                />

                {/* Quick Weather Preset Selector */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {WEATHER_CONTEXT_PRESETS.map((preset) => {
                    const isSelected = weatherContext === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWeatherContext(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                          isSelected
                            ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-medium'
                            : 'bg-[#FAF8F5] dark:bg-stone-950 text-stone-600 dark:text-stone-400 border border-stone-200/80 dark:border-stone-800 hover:border-stone-400'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                {/* Live Weather Telemetry Banner */}
                {liveWeather && (
                  <div className="mt-2.5 p-3 rounded-xl bg-[#FAF8F5] dark:bg-stone-950/90 border border-stone-200/80 dark:border-stone-800 flex items-start gap-2.5">
                    <CloudSun className="w-4 h-4 text-[#8C5A32] dark:text-[#D4A373] shrink-0 mt-0.5" />
                    <div className="text-xs text-stone-600 dark:text-stone-400 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-stone-800 dark:text-stone-200 font-medium">
                        <span>
                          {liveWeather.city}
                          {liveWeather.country ? `, ${liveWeather.country}` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{liveWeather.tempC}°C</span>
                        <span>({liveWeather.condition})</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{liveWeather.humidity}% humidity</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        {liveWeather.stylingTip}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Desired Style
                </label>
                <select
                  value={desiredStyle}
                  onChange={(e) => setDesiredStyle(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                >
                  {STYLE_OPTIONS.map((sty) => (
                    <option key={sty} value={sty}>
                      {sty}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStyleMe(false)}
              disabled={isGenerating || wardrobe.length === 0}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#8C5A32] hover:bg-[#734825] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Curating Your Look...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>STYLE ME</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Outfit Result Screen */}
        <div className="lg:col-span-7">
          {!currentResult ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-center space-y-4">
              <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
                Ready to Assemble Your Outfit
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
                Select your occasion, time, and desired aesthetic on the left, then tap{' '}
                <strong>STYLE ME</strong> to receive a complete look from your wardrobe.
              </p>
              <button
                type="button"
                onClick={() => onStyleMe(false)}
                disabled={isGenerating}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate First Outfit</span>
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentResult.itemIds.join('-') || currentResult.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-6"
              >
                {/* Outfit Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200/80 dark:border-stone-800">
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      <span>{currentResult.occasion}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{currentResult.timeOfDay}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{currentResult.locationContext}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{currentResult.dressCode}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
                      {currentResult.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCompatibilityNotes((v) => !v)}
                    className="self-start sm:self-auto min-h-[36px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
                  >
                    {showCompatibilityNotes ? 'Hide Stylist Notes' : 'Compatibility Details'}
                  </button>
                </div>

                {/* Missing from Wardrobe Alert if applicable */}
                {currentResult.missingItems.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        Wardrobe Gap Detected
                      </p>
                      <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                        {currentResult.missingItems.map((msg, idx) => (
                          <li key={idx}>• {msg}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenAddModal}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg bg-amber-900 text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap self-start sm:self-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Missing Piece</span>
                    </button>
                  </motion.div>
                )}

                {/* Outfit Slots Grid: Top, Bottom, Shoes, Jacket, Belt, Watch, Accessory */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {SLOT_METADATA.map(({ key, label, swapButtonLabel, required }, slotIdx) => {
                    const rawItem = currentResult.slots[key];
                    const item = rawItem ? wardrobeMap.get(rawItem.itemId) || rawItem : null;
                    if (!item && !required && key === 'accessory') {
                      return null;
                    }

                    return (
                      <motion.div
                        key={`${key}-${item?.itemId || 'empty'}`}
                        initial={{ opacity: 0, y: 12, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          duration: 0.2,
                          delay: slotIdx * 0.03,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="flex flex-col justify-between rounded-xl bg-[#FAF8F5] dark:bg-stone-950/80 border border-stone-200/70 dark:border-stone-800 overflow-hidden"
                      >
                        {item ? (
                          <>
                            <div className="aspect-3/4 w-full bg-stone-100 dark:bg-stone-900 overflow-hidden">
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
                            <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                              <div>
                                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                                  {label} · {item.primaryColor}
                                </p>
                                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 line-clamp-1 mt-0.5">
                                  {item.name}
                                </h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                  {item.subcategory} · {item.formality} ·{' '}
                                  <span className="font-mono-num">{item.usageCount}× worn</span>
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setActiveSwapSlot(key)}
                                className="w-full min-h-[38px] mt-2 px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>{swapButtonLabel}</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-4 flex flex-col justify-between h-full min-h-[210px] text-left">
                            <div>
                              <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
                              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mt-2">
                                {required ? 'Missing from wardrobe' : 'Not layered for this look'}
                              </p>
                              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                                {required
                                  ? `Add a suitable ${label.toLowerCase()} to complete this slot.`
                                  : 'Tap below if you want to add a layer from your wardrobe.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveSwapSlot(key)}
                              className="w-full min-h-[38px] mt-3 px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>{swapButtonLabel}</span>
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* "Why this works" Card */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="p-5 rounded-xl bg-[#F2EFE9] dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 space-y-2"
                >
                  <p className="text-xs font-semibold text-[#8C5A32] dark:text-[#D4A373]">
                    Why this works
                  </p>
                  <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed">
                    “{currentResult.explanation}”
                  </p>

                  {showCompatibilityNotes && currentResult.compatibilityBreakdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="pt-3 mt-3 border-t border-stone-300/60 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 dark:text-stone-400"
                    >
                      <div>
                        <strong className="text-stone-800 dark:text-stone-200">Color Harmony:</strong>{' '}
                        {currentResult.compatibilityBreakdown.colorHarmony}
                      </div>
                      <div>
                        <strong className="text-stone-800 dark:text-stone-200">Formality:</strong>{' '}
                        {currentResult.compatibilityBreakdown.formalityBalance}
                      </div>
                      <div>
                        <strong className="text-stone-800 dark:text-stone-200">Leather & Details:</strong>{' '}
                        {currentResult.compatibilityBreakdown.leatherMatch}
                      </div>
                      <div>
                        <strong className="text-stone-800 dark:text-stone-200">Climate Comfort:</strong>{' '}
                        {currentResult.compatibilityBreakdown.climateFit}
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Feedback & Action Bar */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onRateCurrentOutfit('love')}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          currentRating === 'love'
                            ? 'bg-rose-700 text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${currentRating === 'love' ? 'fill-current' : ''}`} />
                        <span>Love it</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRateCurrentOutfit('good')}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          currentRating === 'good'
                            ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Good</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onRateCurrentOutfit('dislike')}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          currentRating === 'dislike'
                            ? 'bg-stone-700 text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Not for me</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSaveCurrentOutfit(true)}
                        disabled={isWornToday}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          isWornToday
                            ? 'bg-emerald-700 text-white cursor-default'
                            : 'bg-[#8C5A32] hover:bg-[#734825] text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isWornToday ? 'Wearing Today' : 'Wear Today'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSaveCurrentOutfit(false)}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Save outfit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStyleMe(true)}
                        disabled={isGenerating}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                        <span>Generate another</span>
                      </button>
                    </div>
                  </div>

                  {savedNotice && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{savedNotice}</span>
                      </div>
                      {onViewHistory && (
                        <button
                          type="button"
                          onClick={onViewHistory}
                          className="underline underline-offset-4 hover:opacity-80 whitespace-nowrap font-semibold"
                        >
                          View in History
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* =====================================================================
          SECTION B: TRIP PACKING LIST & CAPSULE PLANNER
         ===================================================================== */}
      <section
        id="trip-packing-planner"
        className={`space-y-8 ${
          stylistSectionMode === 'trip' ? 'order-1' : 'order-2 pt-8 border-t border-stone-200 dark:border-stone-800'
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Trip Builder Form */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <p className="text-xs font-medium text-[#8C5A32] dark:text-[#D4A373]">
                Smart Travel Capsule Optimizer
              </p>
              <h2 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
                Create a Trip Packing List
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-1.5 leading-relaxed">
                Select your destination and trip duration to receive an optimized, mix-and-match set of clothes from your wardrobe to pack.
              </p>
            </div>

            <form
              onSubmit={handleGenerateTripList}
              className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-4"
            >
              <div>
                <label
                  htmlFor="trip-destination-input"
                  className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5"
                >
                  Destination
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="trip-destination-input"
                    type="text"
                    value={tripDestination}
                    onChange={(e) => setTripDestination(e.target.value)}
                    placeholder="e.g., Zanzibar, Arusha, Nairobi, London..."
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POPULAR_DESTINATIONS.map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => {
                        setTripDestination(dest);
                        handleGenerateTripList(undefined, dest);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        tripDestination === dest
                          ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                      }`}
                    >
                      {dest}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="trip-duration-input"
                    className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5"
                  >
                    Duration (Days)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="trip-duration-input"
                      type="number"
                      min={1}
                      max={30}
                      value={tripDurationDays}
                      onChange={(e) =>
                        setTripDurationDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                      }
                      className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm font-mono-num text-stone-900 dark:text-stone-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="trip-vibe-select"
                    className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5"
                  >
                    Trip Purpose / Style
                  </label>
                  <select
                    id="trip-vibe-select"
                    value={tripVibe}
                    onChange={(e) => setTripVibe(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                  >
                    {TRIP_VIBES.map((vibe) => (
                      <option key={vibe} value={vibe}>
                        {vibe}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGeneratingTrip || wardrobe.length === 0}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isGeneratingTrip ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Optimizing Capsule Packing List...</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-4 h-4" />
                    <span>Create Trip List</span>
                  </>
                )}
              </button>
            </form>

            {/* Saved Trip Lists Summary */}
            {trips.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-display font-semibold text-stone-900 dark:text-stone-100">
                    Saved Trip Lists ({trips.length})
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {trips.map((trip) => (
                    <div
                      key={trip.tripId}
                      className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setTripDestination(trip.destination);
                          setTripDurationDays(trip.durationDays);
                          setTripVibe(trip.tripVibe);
                          setCurrentTripCapsule({
                            title: trip.title,
                            destination: trip.destination,
                            durationDays: trip.durationDays,
                            climate: trip.climate,
                            tripVibe: trip.tripVibe,
                            itemIds: trip.itemIds,
                            rationale: trip.rationale,
                            outfitCombinationsCount: trip.outfitCombinationsCount,
                            missingSuggestions: trip.missingSuggestions,
                            dayOutfits: [],
                            source: 'compatibility-engine',
                          });
                          setPackedDraftIds(trip.packedItemIds || []);
                          if (onToggleTripPackedItem) {
                            // Keep interactive
                          }
                        }}
                        className="text-left flex-1 min-w-0"
                      >
                        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {trip.title}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          {trip.destination} · <span className="font-mono-num">{trip.durationDays}d</span> ·{' '}
                          <span className="font-mono-num">
                            {trip.packedItemIds.length}/{trip.itemIds.length} packed
                          </span>
                        </p>
                      </button>

                      {onDeleteTripPlan && (
                        <button
                          type="button"
                          onClick={() => onDeleteTripPlan(trip.tripId)}
                          aria-label={`Delete ${trip.title}`}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-stone-400 hover:text-red-600 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Suggested Capsule Packing List */}
          <div className="lg:col-span-7">
            {currentTripCapsule && (
              <motion.div
                key={`${currentTripCapsule.destination}-${currentTripCapsule.durationDays}-${currentTripCapsule.tripVibe}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80 dark:border-stone-800">
                  <div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      <span>{currentTripCapsule.destination}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-num">{currentTripCapsule.durationDays} Days</span>
                      <span aria-hidden="true"> · </span>
                      <span>{currentTripCapsule.climate}</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
                      {currentTripCapsule.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSaveCurrentTrip}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#8C5A32] hover:bg-[#734825] text-white text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Save Trip List</span>
                    </button>
                  </div>
                </div>

                {tripSavedBanner && (
                  <div className="p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{tripSavedBanner}</span>
                  </div>
                )}

                {/* Capsule Metrics & Rationale */}
                <div className="p-4 rounded-xl bg-[#F2EFE9] dark:bg-stone-950 border border-stone-200/80 dark:border-stone-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#8C5A32] dark:text-[#D4A373]">
                    <span>
                      Optimized Packing Set ·{' '}
                      <span className="font-mono-num">{resolvedCapsuleItems.length}</span> Pieces Unlock{' '}
                      <span className="font-mono-num">{currentTripCapsule.outfitCombinationsCount}</span>{' '}
                      Outfit Combinations
                    </span>
                    <span className="font-mono-num text-stone-600 dark:text-stone-400">
                      {packedDraftIds.length}/{resolvedCapsuleItems.length} Packed
                    </span>
                  </div>
                  <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed">
                    “{currentTripCapsule.rationale}”
                  </p>
                </div>

                {/* Suggested Wardrobe Pieces to Pack */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Suggested Clothes from Your Wardrobe to Pack
                    </h4>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      Tap any piece to mark as packed
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {resolvedCapsuleItems.map((item, idx) => {
                      const isPacked = packedDraftIds.includes(item.itemId);
                      return (
                        <motion.div
                          key={item.itemId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.18,
                            delay: Math.min(idx * 0.025, 0.2),
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          onClick={() => toggleDraftPacked(item.itemId)}
                          className={`cursor-pointer rounded-xl border overflow-hidden flex flex-col justify-between transition-colors ${
                            isPacked
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-600/60'
                              : 'bg-[#FAF8F5] dark:bg-stone-950/80 border-stone-200/70 dark:border-stone-800'
                          }`}
                        >
                          <div className="aspect-3/4 w-full bg-stone-100 dark:bg-stone-900 relative overflow-hidden">
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
                            <div
                              className={`absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 ${
                                isPacked
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-white/90 dark:bg-stone-900/90 text-stone-700 dark:text-stone-200'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>{isPacked ? 'Packed' : 'Pack'}</span>
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="text-[11px] text-stone-500 dark:text-stone-400">
                              {item.category} · {item.primaryColor}
                            </p>
                            <h5 className="text-xs font-semibold text-stone-900 dark:text-stone-100 line-clamp-1 mt-0.5">
                              {item.name}
                            </h5>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                              {item.subcategory} · {item.formality}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Day-by-Day Itinerary Outfit Preview */}
                {currentTripCapsule.dayOutfits.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-stone-200/80 dark:border-stone-800">
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      Sample Day-by-Day Outfits from This Packing List
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentTripCapsule.dayOutfits.map((dayPlan) => {
                        const dayPieces = dayPlan.itemIds
                          .map((id) => wardrobeMap.get(id))
                          .filter((i): i is WardrobeItem => Boolean(i));
                        return (
                          <div
                            key={dayPlan.day}
                            className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-stone-950 border border-stone-200/70 dark:border-stone-800 space-y-1.5"
                          >
                            <p className="text-xs font-semibold text-[#8C5A32] dark:text-[#D4A373]">
                              {dayPlan.label}
                            </p>
                            <ul className="text-xs text-stone-700 dark:text-stone-300 space-y-0.5">
                              {dayPieces.map((piece) => (
                                <li key={piece.itemId} className="truncate">
                                  • {piece.name} ({piece.primaryColor})
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Swap Item Modal / Bottom Sheet */}
      {activeSwapSlot && currentResult && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-t-3xl md:rounded-2xl bg-[#FAF8F5] dark:bg-[#181615] border border-stone-200 dark:border-stone-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
              <div>
                <h3 className="text-xl font-display font-semibold text-stone-900 dark:text-stone-100">
                  Swap {SLOT_METADATA.find((s) => s.key === activeSwapSlot)?.label}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Compatible alternatives from your wardrobe ranked for this outfit
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSwapSlot(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSwapSlot === 'jacket' && currentResult.slots.jacket && (
              <button
                type="button"
                onClick={() => handleSelectSwapItem('jacket', null)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-left"
              >
                Remove Jacket Layer (Wear shirt solo for warm weather)
              </button>
            )}

            {swapAlternatives.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  No other items in this category were found in your wardrobe.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSwapSlot(null);
                    onOpenAddModal();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Piece to Wardrobe</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {swapAlternatives.map(({ item, reason }) => (
                  <div
                    key={item.itemId}
                    className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 flex items-center gap-4"
                  >
                    <div className="w-16 h-20 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 shrink-0">
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {item.subcategory} · {item.primaryColor} · {item.formality}
                      </p>
                      <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 line-clamp-2">
                        {reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectSwapItem(activeSwapSlot, item)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium whitespace-nowrap shrink-0"
                    >
                      Select
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
