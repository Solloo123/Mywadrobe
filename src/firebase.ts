import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  FitType,
  FormalityLevel,
  Outfit,
  OutfitCalendarEntry,
  SeasonType,
  StyleFeedback,
  TripPlan,
  UserProfile,
  WardrobeCategory,
  WardrobeItem,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Mandatory boot connection check per Firebase Integration Skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ============================================================================
// DEFENSIVE PAYLOAD SANITIZATION (Sync with firebase-blueprint.json & rules)
// ============================================================================
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function sanitizeId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (!cleaned || !ID_REGEX.test(cleaned)) {
    return `${fallbackPrefix}_${Date.now()}`;
  }
  return cleaned;
}

function clampString(val: unknown, maxLen: number, minLen = 0, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : '';
  const result = str.slice(0, maxLen);
  if (result.length < minLen) {
    return fallback.slice(0, maxLen);
  }
  return result;
}

function clampStringArray(arr: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxItemLen));
}

const VALID_CATEGORIES: WardrobeCategory[] = [
  'Tops',
  'Bottoms',
  'Footwear',
  'Accessories',
  'Traditional',
];
const VALID_FORMALITIES: FormalityLevel[] = [
  'Casual',
  'Smart Casual',
  'Business',
  'Formal',
  'Traditional / Ceremonial',
];
const VALID_SEASONS: SeasonType[] = [
  'All-Season',
  'Hot / Dry',
  'Warm / Humid',
  'Cool / Evening',
  'Rainy',
];
const VALID_FITS: FitType[] = [
  'Slim',
  'Regular',
  'Relaxed',
  'Tailored',
  'Oversized',
  'Standard',
];
const VALID_PROFILE_FITS: UserProfile['preferredFit'][] = [
  'Slim',
  'Regular',
  'Relaxed',
  'Tailored',
  'Oversized',
];

export function sanitizeUserProfilePayload(profile: Partial<UserProfile>, uid: string) {
  const fit = VALID_PROFILE_FITS.includes(profile.preferredFit as UserProfile['preferredFit'])
    ? (profile.preferredFit as UserProfile['preferredFit'])
    : 'Tailored';

  return {
    userId: sanitizeId(uid, 'user'),
    displayName: clampString(profile.displayName, 100, 1, 'Style Enthusiast'),
    bio: clampString(profile.bio, 300, 0, ''),
    favoriteColors: clampStringArray(profile.favoriteColors, 15, 50),
    preferredStyles: clampStringArray(profile.preferredStyles, 15, 60),
    preferredFit: fit,
    preferredOccasions: clampStringArray(profile.preferredOccasions, 20, 80),
    locationCity: clampString(profile.locationCity, 80, 0, 'Dar es Salaam, Tanzania'),
  };
}

export function sanitizeWardrobeItemPayload(item: Partial<WardrobeItem>, uid: string) {
  const category = VALID_CATEGORIES.includes(item.category as WardrobeCategory)
    ? (item.category as WardrobeCategory)
    : 'Tops';
  const formality = VALID_FORMALITIES.includes(item.formality as FormalityLevel)
    ? (item.formality as FormalityLevel)
    : 'Smart Casual';
  const season = VALID_SEASONS.includes(item.season as SeasonType)
    ? (item.season as SeasonType)
    : 'All-Season';
  const fit = VALID_FITS.includes(item.fit as FitType) ? (item.fit as FitType) : 'Regular';
  const usageCount =
    typeof item.usageCount === 'number' && Number.isFinite(item.usageCount)
      ? Math.max(0, Math.min(10000, Math.floor(item.usageCount)))
      : 0;

  return {
    itemId: sanitizeId(item.itemId || `item_${Date.now()}`, 'item'),
    userId: sanitizeId(uid, 'user'),
    name: clampString(item.name, 120, 1, 'Untitled Garment'),
    category,
    subcategory: clampString(item.subcategory, 60, 1, 'Shirt'),
    imageUrl: clampString(item.imageUrl, 750000, 1, 'studio://default'),
    primaryColor: clampString(item.primaryColor, 50, 1, 'Navy'),
    secondaryColor: clampString(item.secondaryColor, 50, 0, 'None'),
    pattern: clampString(item.pattern, 50, 1, 'Solid'),
    material: clampString(item.material, 60, 0, 'Cotton'),
    formality,
    style: clampString(item.style, 60, 1, 'Smart Casual'),
    season,
    brand: clampString(item.brand, 80, 0, ''),
    fit,
    occasions: clampStringArray(item.occasions, 15, 80),
    notes: clampString(item.notes, 500, 0, ''),
    isFavorite: Boolean(item.isFavorite),
    usageCount,
  };
}

export function sanitizeOutfitPayload(outfit: Partial<Outfit>, uid: string) {
  const validRatings: Outfit['rating'][] = ['love', 'good', 'dislike', 'unrated'];
  const rating = validRatings.includes(outfit.rating as Outfit['rating'])
    ? (outfit.rating as Outfit['rating'])
    : 'unrated';
  const wearCount =
    typeof outfit.wearCount === 'number' && Number.isFinite(outfit.wearCount)
      ? Math.max(0, Math.min(10000, Math.floor(outfit.wearCount)))
      : 0;

  return {
    outfitId: sanitizeId(outfit.outfitId || `outfit_${Date.now()}`, 'outfit'),
    userId: sanitizeId(uid, 'user'),
    title: clampString(outfit.title, 120, 1, 'Curated Ensemble'),
    occasion: clampString(outfit.occasion, 100, 1, 'Smart casual'),
    dressCode: clampString(outfit.dressCode, 80, 0, 'Smart Casual'),
    timeOfDay: clampString(outfit.timeOfDay, 40, 0, 'Evening'),
    locationContext: clampString(outfit.locationContext, 100, 0, 'City Venue'),
    weatherContext: clampString(outfit.weatherContext, 80, 0, 'Warm & Breezy'),
    desiredStyle: clampString(outfit.desiredStyle, 80, 0, 'Smart Casual'),
    itemIds: clampStringArray(outfit.itemIds, 12, 128),
    explanation: clampString(
      outfit.explanation,
      1000,
      1,
      'Balanced proportions and harmonious tones selected from your wardrobe.'
    ),
    missingItems: clampStringArray(outfit.missingItems, 10, 100),
    rating,
    isFavorite: Boolean(outfit.isFavorite),
    wearCount,
  };
}

export function sanitizeFeedbackPayload(feedback: Partial<StyleFeedback>, uid: string) {
  const validRatings: StyleFeedback['rating'][] = ['love', 'good', 'dislike'];
  const rating = validRatings.includes(feedback.rating as StyleFeedback['rating'])
    ? (feedback.rating as StyleFeedback['rating'])
    : 'good';

  return {
    feedbackId: sanitizeId(feedback.feedbackId || `fb_${Date.now()}`, 'fb'),
    userId: sanitizeId(uid, 'user'),
    outfitId: sanitizeId(feedback.outfitId || 'outfit_default', 'outfit'),
    rating,
    occasion: clampString(feedback.occasion, 100, 0, 'Smart casual'),
    preferredStyle: clampString(feedback.preferredStyle, 80, 0, 'Smart Casual'),
    dominantColors: clampStringArray(feedback.dominantColors, 10, 50),
    comments: clampString(feedback.comments, 500, 0, ''),
  };
}

export function sanitizeTripPlanPayload(trip: Partial<TripPlan>, uid: string) {
  const durationDays =
    typeof trip.durationDays === 'number' && Number.isFinite(trip.durationDays)
      ? Math.max(1, Math.min(30, Math.floor(trip.durationDays)))
      : 4;
  const outfitCombinationsCount =
    typeof trip.outfitCombinationsCount === 'number' && Number.isFinite(trip.outfitCombinationsCount)
      ? Math.max(1, Math.min(100, Math.floor(trip.outfitCombinationsCount)))
      : 4;

  return {
    tripId: sanitizeId(trip.tripId || `trip_${Date.now()}`, 'trip'),
    userId: sanitizeId(uid, 'user'),
    title: clampString(trip.title, 120, 1, 'Curated Trip Capsule'),
    destination: clampString(trip.destination, 100, 1, 'Zanzibar, Tanzania'),
    durationDays,
    climate: clampString(trip.climate, 80, 0, 'Warm & Breezy (28°C)'),
    tripVibe: clampString(trip.tripVibe, 80, 0, 'Smart Casual & Leisure'),
    itemIds: clampStringArray(trip.itemIds, 25, 128),
    packedItemIds: clampStringArray(trip.packedItemIds, 25, 128),
    rationale: clampString(
      trip.rationale,
      1000,
      1,
      'Versatile capsule wardrobe selected for effortless mix-and-match outfits.'
    ),
    outfitCombinationsCount,
    missingSuggestions: clampStringArray(trip.missingSuggestions, 10, 100),
  };
}

export function sanitizeCalendarEntryPayload(
  entry: Partial<OutfitCalendarEntry>,
  uid: string
) {
  const status = entry.status === 'worn' ? 'worn' : 'planned';
  const defaultDateKey = new Date().toISOString().slice(0, 10);
  const rawDateKey = clampString(entry.dateKey, 20, 10, defaultDateKey);

  return {
    entryId: sanitizeId(entry.entryId || `cal_${Date.now()}`, 'cal'),
    userId: sanitizeId(uid, 'user'),
    dateKey: rawDateKey,
    outfitId: sanitizeId(entry.outfitId || `outfit_${Date.now()}`, 'outfit'),
    title: clampString(entry.title, 150, 1, 'Scheduled Look'),
    occasion: clampString(entry.occasion, 100, 1, 'Smart casual'),
    status,
    itemIds: clampStringArray(entry.itemIds, 15, 128),
    notes: clampString(entry.notes, 400, 0, ''),
  };
}


