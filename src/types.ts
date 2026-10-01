export type WardrobeCategory =
  | 'Tops'
  | 'Bottoms'
  | 'Footwear'
  | 'Accessories'
  | 'Traditional';

export type FormalityLevel =
  | 'Casual'
  | 'Smart Casual'
  | 'Business'
  | 'Formal'
  | 'Traditional / Ceremonial';

export type SeasonType =
  | 'All-Season'
  | 'Hot / Dry'
  | 'Warm / Humid'
  | 'Cool / Evening'
  | 'Rainy';

export type FitType =
  | 'Slim'
  | 'Regular'
  | 'Relaxed'
  | 'Tailored'
  | 'Oversized'
  | 'Standard';

export interface WardrobeItem {
  itemId: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  imageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  material: string;
  formality: FormalityLevel;
  style: string;
  season: SeasonType;
  brand: string;
  fit: FitType;
  occasions: string[];
  notes: string;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type OutfitRating = 'love' | 'good' | 'dislike' | 'unrated';

export type OutfitSlotKey =
  | 'top'
  | 'bottom'
  | 'footwear'
  | 'jacket'
  | 'belt'
  | 'watch'
  | 'accessory';

export interface Outfit {
  outfitId: string;
  userId: string;
  title: string;
  occasion: string;
  dressCode: string;
  timeOfDay: string;
  locationContext: string;
  weatherContext: string;
  desiredStyle: string;
  itemIds: string[];
  explanation: string;
  missingItems: string[];
  rating: OutfitRating;
  isFavorite: boolean;
  wearCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StyleFeedback {
  feedbackId: string;
  userId: string;
  outfitId: string;
  rating: 'love' | 'good' | 'dislike';
  occasion: string;
  preferredStyle: string;
  dominantColors: string[];
  comments: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  bio: string;
  favoriteColors: string[];
  preferredStyles: string[];
  preferredFit: 'Slim' | 'Regular' | 'Relaxed' | 'Tailored' | 'Oversized';
  preferredOccasions: string[];
  locationCity: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysisResult {
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  primaryColor: string;
  secondaryColor: string;
  pattern: string;
  material: string;
  formality: FormalityLevel;
  style: string;
  season: SeasonType;
  fit: FitType;
  possibleMatchingColors: string[];
  suitableOccasions: string[];
  stylistTip: string;
}

export interface OccasionInterpretation {
  occasion: string;
  dressCode: string;
  timeOfDay: string;
  locationContext: string;
  weatherContext: string;
  desiredStyle: string;
  summary: string;
}

export interface OutfitSlotsMap {
  top?: WardrobeItem | null;
  bottom?: WardrobeItem | null;
  footwear?: WardrobeItem | null;
  jacket?: WardrobeItem | null;
  belt?: WardrobeItem | null;
  watch?: WardrobeItem | null;
  accessory?: WardrobeItem | null;
}

export interface GeneratedOutfitResult {
  title: string;
  occasion: string;
  dressCode: string;
  timeOfDay: string;
  locationContext: string;
  weatherContext: string;
  desiredStyle: string;
  slots: OutfitSlotsMap;
  itemIds: string[];
  explanation: string;
  missingItems: string[];
  source: 'gemini' | 'compatibility-engine';
  compatibilityBreakdown?: {
    colorHarmony: string;
    formalityBalance: string;
    leatherMatch: string;
    climateFit: string;
  };
}

export interface TripDaySampleOutfit {
  day: number;
  label: string;
  itemIds: string[];
}

export interface GeneratedTripCapsule {
  title: string;
  destination: string;
  durationDays: number;
  climate: string;
  tripVibe: string;
  itemIds: string[];
  rationale: string;
  outfitCombinationsCount: number;
  missingSuggestions: string[];
  dayOutfits: TripDaySampleOutfit[];
  source: 'gemini' | 'compatibility-engine';
}

export interface TripPlan {
  tripId: string;
  userId: string;
  title: string;
  destination: string;
  durationDays: number;
  climate: string;
  tripVibe: string;
  itemIds: string[];
  packedItemIds: string[];
  rationale: string;
  outfitCombinationsCount: number;
  missingSuggestions: string[];
  createdAt: string;
  updatedAt: string;
}

export type CalendarEntryStatus = 'worn' | 'planned';

export interface OutfitCalendarEntry {
  entryId: string;
  userId: string;
  dateKey: string; // YYYY-MM-DD
  outfitId: string;
  title: string;
  occasion: string;
  status: CalendarEntryStatus;
  itemIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const SUBCATEGORIES_BY_CATEGORY: Record<WardrobeCategory, string[]> = {
  Tops: ['T-shirt', 'Polo', 'Shirt', 'Sweater', 'Hoodie', 'Jacket', 'Coat'],
  Bottoms: ['Jeans', 'Chinos', 'Formal trousers', 'Cargo pants', 'Shorts', 'Other'],
  Footwear: ['Sneakers', 'Loafers', 'Oxford shoes', 'Derby shoes', 'Boots', 'Sandals', 'Other'],
  Accessories: ['Watch', 'Belt', 'Hat/cap', 'Sunglasses', 'Tie', 'Bracelet', 'Bag', 'Other'],
  Traditional: ['Kanzu', 'Kitenge', 'Dashiki', 'Traditional shirts', 'Other cultural clothing'],
};

export const ALL_OCCASIONS: string[] = [
  'Everyday casual',
  'Smart casual',
  'Formal',
  'Business',
  'Office',
  'College',
  'Church',
  'Date',
  'Wedding',
  'Graduation',
  'Family ceremony',
  'Business meeting',
  'Casual evening',
  'University/college',
  'Birthday',
  'Party',
  'Dinner',
  'Evening',
  'Interview',
  'Travel',
  'Sports',
  'Outdoor',
  'Hot-weather casual',
  'Funeral',
  'Special event',
];

export const QUICK_OCCASIONS = [
  { id: 'Everyday casual', label: 'Casual', subtitle: 'Relaxed daily comfort' },
  { id: 'Office', label: 'Work', subtitle: 'Sharp professional' },
  { id: 'Date', label: 'Date', subtitle: 'Refined & effortless' },
  { id: 'Church', label: 'Church', subtitle: 'Modest & polished' },
  { id: 'Wedding', label: 'Wedding', subtitle: 'Ceremonial elegance' },
  { id: 'Evening', label: 'Evening', subtitle: 'Elevated night look' },
];

export const COMMON_COLORS: string[] = [
  'Ivory',
  'White',
  'Black',
  'Navy',
  'Charcoal',
  'Sand Beige',
  'Olive',
  'Cognac Brown',
  'Dark Brown',
  'Sky Blue',
  'Terracotta',
  'Burgundy',
  'Emerald',
  'Ochre Gold',
  'Grey',
  'Khaki',
];

export const STYLE_OPTIONS: string[] = [
  'Smart Casual',
  'Minimalist Tailored',
  'Classic Formal',
  'Contemporary Heritage',
  'Relaxed Weekend',
  'Coastal Linen',
  'Executive Business',
  'Streetwear Clean',
];

export const FORMALITY_OPTIONS: FormalityLevel[] = [
  'Casual',
  'Smart Casual',
  'Business',
  'Formal',
  'Traditional / Ceremonial',
];

export const SEASON_OPTIONS: SeasonType[] = [
  'All-Season',
  'Hot / Dry',
  'Warm / Humid',
  'Cool / Evening',
  'Rainy',
];

export const FIT_OPTIONS: FitType[] = [
  'Slim',
  'Regular',
  'Relaxed',
  'Tailored',
  'Oversized',
  'Standard',
];
