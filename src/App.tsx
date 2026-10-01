/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowRight,
  Bookmark,
  Clock,
  Heart,
  Home,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Shirt,
  Sparkles,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeCalendarEntryPayload,
  sanitizeFeedbackPayload,
  sanitizeId,
  sanitizeOutfitPayload,
  sanitizeTripPlanPayload,
  sanitizeUserProfilePayload,
  sanitizeWardrobeItemPayload,
} from './firebase';
import {
  CalendarEntryStatus,
  GeneratedOutfitResult,
  GeneratedTripCapsule,
  Outfit,
  OutfitCalendarEntry,
  OutfitRating,
  OutfitSlotsMap,
  QUICK_OCCASIONS,
  StyleFeedback,
  TripPlan,
  UserProfile,
  WardrobeItem,
} from './types';
import {
  DEMO_CALENDAR_ENTRIES,
  DEMO_FEEDBACK,
  DEMO_OUTFITS,
  DEMO_TRIPS,
  DEMO_USER_PROFILE,
  DEMO_WARDROBE_ITEMS,
  HERO_EDITORIAL_IMAGE,
} from './data/demoData';
import {
  generateRuleBasedOutfit,
  generateStylistOutfit,
  isBeltItem,
  isBottomItem,
  isExtraAccessoryItem,
  isFootwearItem,
  isJacketItem,
  isTopItem,
  isWatchItem,
} from './services/compatibilityEngine';
import { GarmentImage } from './components/GarmentImage';
import { AddEditItemModal } from './components/AddEditItemModal';
import { StylistView } from './components/StylistView';
import { WardrobeView } from './components/WardrobeView';
import { StyleAndHistoryView } from './components/StyleAndHistoryView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

type ActiveTab = 'home' | 'stylist' | 'wardrobe' | 'history' | 'profile';

const LS_DEMO_WARDROBE = 'mywardrobe_ai_demo_wardrobe_v1';
const LS_DEMO_OUTFITS = 'mywardrobe_ai_demo_outfits_v1';
const LS_DEMO_FEEDBACK = 'mywardrobe_ai_demo_feedback_v1';
const LS_DEMO_PROFILE = 'mywardrobe_ai_demo_profile_v1';
const LS_DEMO_TRIPS = 'mywardrobe_ai_demo_trips_v1';
const LS_DEMO_CALENDAR = 'mywardrobe_ai_demo_calendar_v1';
const LS_THEME = 'mywardrobe_ai_theme_v1';

function timestampToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

export default function App() {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(LS_THEME) === 'dark';
  });

  // Auth & Demo State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSeedingCloud, setIsSeedingCloud] = useState(false);

  // Data State (Synced with Firestore when logged in, or localStorage in Guest/Demo Mode)
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(() => {
    try {
      const saved = localStorage.getItem(LS_DEMO_WARDROBE);
      return saved ? JSON.parse(saved) : DEMO_WARDROBE_ITEMS;
    } catch {
      return DEMO_WARDROBE_ITEMS;
    }
  });

  const [outfits, setOutfits] = useState<Outfit[]>(() => {
    try {
      const saved = localStorage.getItem(LS_DEMO_OUTFITS);
      return saved ? JSON.parse(saved) : DEMO_OUTFITS;
    } catch {
      return DEMO_OUTFITS;
    }
  });

  const [feedbackList, setFeedbackList] = useState<StyleFeedback[]>(() => {
    try {
      const saved = localStorage.getItem(LS_DEMO_FEEDBACK);
      return saved ? JSON.parse(saved) : DEMO_FEEDBACK;
    } catch {
      return DEMO_FEEDBACK;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(LS_DEMO_PROFILE);
      return saved ? JSON.parse(saved) : DEMO_USER_PROFILE;
    } catch {
      return DEMO_USER_PROFILE;
    }
  });

  const [trips, setTrips] = useState<TripPlan[]>(() => {
    try {
      const saved = localStorage.getItem(LS_DEMO_TRIPS);
      return saved ? JSON.parse(saved) : DEMO_TRIPS;
    } catch {
      return DEMO_TRIPS;
    }
  });

  const [calendarEntries, setCalendarEntries] = useState<OutfitCalendarEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LS_DEMO_CALENDAR);
      return saved ? JSON.parse(saved) : DEMO_CALENDAR_ENTRIES;
    } catch {
      return DEMO_CALENDAR_ENTRIES;
    }
  });

  // Add / Edit Clothing Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  // Stylist Session State
  const [selectedOccasion, setSelectedOccasion] = useState<string>('Date');
  const [timeOfDay, setTimeOfDay] = useState<string>('Evening');
  const [locationContext, setLocationContext] = useState<string>('Restaurant');
  const [weatherContext, setWeatherContext] = useState<string>('Warm & Breezy (28°C)');
  const [desiredStyle, setDesiredStyle] = useState<string>('Smart Casual');
  const [currentResult, setCurrentResult] = useState<GeneratedOutfitResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [seenCombinationKeys, setSeenCombinationKeys] = useState<string[]>([]);
  const [variationCounter, setVariationCounter] = useState(0);
  const [currentRating, setCurrentRating] = useState<OutfitRating>('unrated');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [currentSavedOutfitId, setCurrentSavedOutfitId] = useState<string | null>(null);
  const [isWornToday, setIsWornToday] = useState<boolean>(false);

  const isDemoMode = !currentUser;

  // Sync Dark Mode class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(LS_THEME, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(LS_THEME, 'light');
    }
  }, [darkMode]);

  // Persist Demo Mode changes to localStorage
  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(LS_DEMO_WARDROBE, JSON.stringify(wardrobe));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [wardrobe, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(LS_DEMO_OUTFITS, JSON.stringify(outfits));
      } catch {
        // Ignore
      }
    }
  }, [outfits, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(LS_DEMO_FEEDBACK, JSON.stringify(feedbackList));
      } catch {
        // Ignore
      }
    }
  }, [feedbackList, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(LS_DEMO_PROFILE, JSON.stringify(userProfile));
      } catch {
        // Ignore
      }
    }
  }, [userProfile, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(LS_DEMO_TRIPS, JSON.stringify(trips));
      } catch {
        // Ignore
      }
    }
  }, [trips, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      try {
        localStorage.setItem(LS_DEMO_CALENDAR, JSON.stringify(calendarEntries));
      } catch {
        // Ignore
      }
    }
  }, [calendarEntries, isDemoMode]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore Real-Time Listeners when Authenticated
  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const uid = currentUser.uid;
    const profileRef = doc(db, 'users', uid);

    const unsubProfile = onSnapshot(
      profileRef,
      async (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setUserProfile({
            userId: d.userId,
            displayName: d.displayName || currentUser.displayName || 'Style Enthusiast',
            bio: d.bio || '',
            favoriteColors: d.favoriteColors || ['Ivory', 'Navy', 'Olive'],
            preferredStyles: d.preferredStyles || ['Smart Casual'],
            preferredFit: d.preferredFit || 'Tailored',
            preferredOccasions: d.preferredOccasions || ['Smart casual', 'Office', 'Date'],
            locationCity: d.locationCity || 'Dar es Salaam, Tanzania',
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          });
        } else {
          // Initialize profile document for new user
          const initial = sanitizeUserProfilePayload(
            {
              displayName: currentUser.displayName || 'Style Enthusiast',
              bio: 'Personal digital wardrobe & AI styling profile.',
              favoriteColors: ['Ivory', 'Navy', 'Olive', 'Cognac Brown'],
              preferredStyles: ['Smart Casual', 'Minimalist Tailored'],
              preferredFit: 'Tailored',
              preferredOccasions: ['Smart casual', 'Office', 'Date', 'Wedding', 'Church'],
              locationCity: 'Dar es Salaam, Tanzania',
            },
            uid
          );
          try {
            await setDoc(profileRef, {
              ...initial,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const wardrobeQuery = query(collection(db, 'wardrobeItems'), where('userId', '==', uid));
    const unsubWardrobe = onSnapshot(
      wardrobeQuery,
      (snap) => {
        const items: WardrobeItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            ...(d as Omit<WardrobeItem, 'createdAt' | 'updatedAt'>),
            createdAt: timestampToIso(d.createdAt),
            updatedAt: timestampToIso(d.updatedAt),
          };
        });
        setWardrobe(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'wardrobeItems');
      }
    );

    const outfitsQuery = query(collection(db, 'outfits'), where('userId', '==', uid));
    const unsubOutfits = onSnapshot(
      outfitsQuery,
      (snap) => {
        const loaded: Outfit[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              ...(d as Omit<Outfit, 'createdAt' | 'updatedAt'>),
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setOutfits(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'outfits');
      }
    );

    const feedbackQuery = query(collection(db, 'feedback'), where('userId', '==', uid));
    const unsubFeedback = onSnapshot(
      feedbackQuery,
      (snap) => {
        const loaded: StyleFeedback[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            ...(d as Omit<StyleFeedback, 'createdAt'>),
            createdAt: timestampToIso(d.createdAt),
          };
        });
        setFeedbackList(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'feedback');
      }
    );

    const tripsQuery = query(collection(db, 'trips'), where('userId', '==', uid));
    const unsubTrips = onSnapshot(
      tripsQuery,
      (snap) => {
        const loaded: TripPlan[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              ...(d as Omit<TripPlan, 'createdAt' | 'updatedAt'>),
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setTrips(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'trips');
      }
    );

    const calendarQuery = query(
      collection(db, 'calendarEntries'),
      where('userId', '==', uid)
    );
    const unsubCalendar = onSnapshot(
      calendarQuery,
      (snap) => {
        const loaded: OutfitCalendarEntry[] = snap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              ...(d as Omit<OutfitCalendarEntry, 'createdAt' | 'updatedAt'>),
              createdAt: timestampToIso(d.createdAt),
              updatedAt: timestampToIso(d.updatedAt),
            };
          })
          .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        setCalendarEntries(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'calendarEntries');
      }
    );

    return () => {
      unsubProfile();
      unsubWardrobe();
      unsubOutfits();
      unsubFeedback();
      unsubTrips();
      unsubCalendar();
    };
  }, [isAuthReady, currentUser]);

  // Initialize initial Stylist recommendation once wardrobe is ready
  useEffect(() => {
    if (!currentResult && wardrobe.length > 0) {
      const initialLook = generateRuleBasedOutfit({
        wardrobe,
        occasion: selectedOccasion,
        timeOfDay,
        locationContext,
        weatherContext,
        desiredStyle,
        userProfile,
        feedbackList,
      });
      setCurrentResult(initialLook);
    }
  }, [wardrobe, currentResult, selectedOccasion, timeOfDay, locationContext, weatherContext, desiredStyle, userProfile, feedbackList]);

  // ==========================================================================
  // AUTHENTICATION HANDLERS
  // ==========================================================================
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Sign-in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    // Restore Demo Mode data on logout
    setWardrobe(DEMO_WARDROBE_ITEMS);
    setOutfits(DEMO_OUTFITS);
    setFeedbackList(DEMO_FEEDBACK);
    setUserProfile(DEMO_USER_PROFILE);
    setTrips(DEMO_TRIPS);
    setCalendarEntries(DEMO_CALENDAR_ENTRIES);
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(LS_DEMO_WARDROBE);
    localStorage.removeItem(LS_DEMO_OUTFITS);
    localStorage.removeItem(LS_DEMO_FEEDBACK);
    localStorage.removeItem(LS_DEMO_PROFILE);
    localStorage.removeItem(LS_DEMO_TRIPS);
    localStorage.removeItem(LS_DEMO_CALENDAR);
    setWardrobe(DEMO_WARDROBE_ITEMS);
    setOutfits(DEMO_OUTFITS);
    setFeedbackList(DEMO_FEEDBACK);
    setUserProfile(DEMO_USER_PROFILE);
    setTrips(DEMO_TRIPS);
    setCalendarEntries(DEMO_CALENDAR_ENTRIES);
  };

  const handleSeedSampleWardrobeToCloud = async () => {
    if (!currentUser) return;
    setIsSeedingCloud(true);
    const uid = currentUser.uid;
    try {
      const batch = writeBatch(db);
      for (const demoItem of DEMO_WARDROBE_ITEMS) {
        const newItemId = sanitizeId(`${uid.slice(0, 8)}_${demoItem.itemId}`, 'item');
        const sanitized = sanitizeWardrobeItemPayload(
          {
            ...demoItem,
            itemId: newItemId,
          },
          uid
        );
        batch.set(doc(db, 'wardrobeItems', newItemId), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'wardrobeItems');
    } finally {
      setIsSeedingCloud(false);
    }
  };

  // ==========================================================================
  // WARDROBE CRUD HANDLERS
  // ==========================================================================
  const handleSaveWardrobeItem = async (itemData: Partial<WardrobeItem>) => {
    if (currentUser) {
      const uid = currentUser.uid;
      const isEditing = Boolean(itemData.itemId && wardrobe.some((w) => w.itemId === itemData.itemId));
      const sanitized = sanitizeWardrobeItemPayload(itemData, uid);
      const ref = doc(db, 'wardrobeItems', sanitized.itemId);

      try {
        if (isEditing) {
          const { itemId: _id, userId: _uid, ...mutableFields } = sanitized;
          await updateDoc(ref, {
            ...mutableFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(ref, {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          isEditing ? OperationType.UPDATE : OperationType.CREATE,
          `wardrobeItems/${sanitized.itemId}`
        );
      }
    } else {
      // Guest / Demo Mode
      const now = new Date().toISOString();
      const existingIdx = wardrobe.findIndex((i) => i.itemId === itemData.itemId);
      const sanitized = sanitizeWardrobeItemPayload(itemData, 'demo_user');
      if (existingIdx >= 0) {
        const updated = [...wardrobe];
        updated[existingIdx] = {
          ...updated[existingIdx],
          ...sanitized,
          updatedAt: now,
        };
        setWardrobe(updated);
      } else {
        const newItem: WardrobeItem = {
          ...sanitized,
          createdAt: now,
          updatedAt: now,
        };
        setWardrobe((prev) => [newItem, ...prev]);
      }
    }
  };

  const handleDeleteWardrobeItem = async (itemId: string) => {
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'wardrobeItems', itemId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `wardrobeItems/${itemId}`);
      }
    } else {
      setWardrobe((prev) => prev.filter((i) => i.itemId !== itemId));
    }
  };

  const handleToggleFavoriteItem = async (item: WardrobeItem) => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'wardrobeItems', item.itemId), {
          isFavorite: !item.isFavorite,
          usageCount: item.usageCount,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `wardrobeItems/${item.itemId}`);
      }
    } else {
      setWardrobe((prev) =>
        prev.map((i) =>
          i.itemId === item.itemId ? { ...i, isFavorite: !i.isFavorite } : i
        )
      );
    }
  };

  // ==========================================================================
  // STYLIST & OUTFIT HANDLERS
  // ==========================================================================
  const handleStyleMe = useCallback(
    async (
      generateAnother = false,
      overrideOccasion?: string,
      anchorItem?: WardrobeItem
    ) => {
      const targetOccasion = overrideOccasion || selectedOccasion;
      setIsGenerating(true);
      setSavedNotice(null);
      setCurrentRating('unrated');
      setCurrentSavedOutfitId(null);
      setIsWornToday(false);

      const nextVariation = generateAnother ? variationCounter + 1 : 0;
      setVariationCounter(nextVariation);

      try {
        const result = await generateStylistOutfit({
          wardrobe,
          occasion: targetOccasion,
          timeOfDay,
          locationContext,
          weatherContext,
          desiredStyle,
          userProfile,
          feedbackList,
          excludeCombinationKeys: generateAnother ? seenCombinationKeys : [],
          variationIndex: nextVariation,
        });

        // If user clicked "Style Piece" on a specific item in their wardrobe, anchor that slot
        if (anchorItem) {
          if (isTopItem(anchorItem)) result.slots.top = anchorItem;
          else if (isJacketItem(anchorItem)) result.slots.jacket = anchorItem;
          else if (isBottomItem(anchorItem)) result.slots.bottom = anchorItem;
          else if (isFootwearItem(anchorItem)) result.slots.footwear = anchorItem;
          else if (isBeltItem(anchorItem)) result.slots.belt = anchorItem;
          else if (isWatchItem(anchorItem)) result.slots.watch = anchorItem;
          else if (isExtraAccessoryItem(anchorItem)) result.slots.accessory = anchorItem;
        }

        const key = `${result.slots.top?.itemId || ''}|${result.slots.bottom?.itemId || ''}|${result.slots.footwear?.itemId || ''}`;
        setSeenCombinationKeys((prev) => [...prev.slice(-8), key]);
        setCurrentResult(result);
      } finally {
        setIsGenerating(false);
      }
    },
    [
      selectedOccasion,
      variationCounter,
      wardrobe,
      timeOfDay,
      locationContext,
      weatherContext,
      desiredStyle,
      userProfile,
      feedbackList,
      seenCombinationKeys,
    ]
  );

  const handleSaveCurrentOutfit = async (wearNow = false, ratingOverride?: OutfitRating): Promise<string> => {
    if (!currentResult) return '';
    if (wearNow && isWornToday && currentSavedOutfitId) {
      return currentSavedOutfitId;
    }

    const effectiveRating = ratingOverride || currentRating;
    const existingOutfit = currentSavedOutfitId
      ? outfits.find((o) => o.outfitId === currentSavedOutfitId)
      : undefined;
    const outfitId = existingOutfit
      ? existingOutfit.outfitId
      : sanitizeId(`outfit_${Date.now()}`, 'outfit');
    const now = new Date().toISOString();
    const uniqueItemIds = Array.from(new Set(currentResult.itemIds));

    if (currentUser) {
      const uid = currentUser.uid;
      try {
        if (existingOutfit) {
          await updateDoc(doc(db, 'outfits', outfitId), {
            rating: effectiveRating,
            isFavorite: effectiveRating === 'love' || existingOutfit.isFavorite,
            wearCount: wearNow ? existingOutfit.wearCount + 1 : existingOutfit.wearCount,
            updatedAt: serverTimestamp(),
          });
        } else {
          const sanitized = sanitizeOutfitPayload(
            {
              outfitId,
              title: currentResult.title,
              occasion: currentResult.occasion,
              dressCode: currentResult.dressCode,
              timeOfDay: currentResult.timeOfDay,
              locationContext: currentResult.locationContext,
              weatherContext: currentResult.weatherContext,
              desiredStyle: currentResult.desiredStyle,
              itemIds: uniqueItemIds,
              explanation: currentResult.explanation,
              missingItems: currentResult.missingItems,
              rating: effectiveRating,
              isFavorite: effectiveRating === 'love',
              wearCount: wearNow ? 1 : 0,
            },
            uid
          );
          await setDoc(doc(db, 'outfits', sanitized.outfitId), {
            ...sanitized,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        if (wearNow) {
          for (const itemId of uniqueItemIds) {
            const found = wardrobe.find((w) => w.itemId === itemId);
            if (found) {
              await updateDoc(doc(db, 'wardrobeItems', itemId), {
                isFavorite: found.isFavorite,
                usageCount: Math.min(10000, found.usageCount + 1),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (err) {
        handleFirestoreError(
          err,
          existingOutfit ? OperationType.UPDATE : OperationType.CREATE,
          `outfits/${outfitId}`
        );
      }
    } else {
      if (existingOutfit) {
        setOutfits((prev) =>
          prev.map((o) =>
            o.outfitId === outfitId
              ? {
                  ...o,
                  rating: effectiveRating,
                  isFavorite: effectiveRating === 'love' || o.isFavorite,
                  wearCount: wearNow ? o.wearCount + 1 : o.wearCount,
                  updatedAt: now,
                }
              : o
          )
        );
      } else {
        const newOutfit: Outfit = {
          ...sanitizeOutfitPayload(
            {
              outfitId,
              title: currentResult.title,
              occasion: currentResult.occasion,
              dressCode: currentResult.dressCode,
              timeOfDay: currentResult.timeOfDay,
              locationContext: currentResult.locationContext,
              weatherContext: currentResult.weatherContext,
              desiredStyle: currentResult.desiredStyle,
              itemIds: uniqueItemIds,
              explanation: currentResult.explanation,
              missingItems: currentResult.missingItems,
              rating: effectiveRating,
              isFavorite: effectiveRating === 'love',
              wearCount: wearNow ? 1 : 0,
            },
            'demo_user'
          ),
          createdAt: now,
          updatedAt: now,
        };
        setOutfits((prev) => [newOutfit, ...prev]);
      }

      if (wearNow) {
        setWardrobe((prev) =>
          prev.map((w) =>
            uniqueItemIds.includes(w.itemId)
              ? { ...w, usageCount: w.usageCount + 1, updatedAt: now }
              : w
          )
        );
      }
    }

    setCurrentSavedOutfitId(outfitId);

    if (wearNow) {
      setIsWornToday(true);
      const formattedToday = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      setSavedNotice(
        `Worn today (${formattedToday}) — logged to Outfit History & incremented usage count for ${uniqueItemIds.length} pieces.`
      );
    } else {
      setSavedNotice('Outfit saved to your Outfit History.');
    }
    return outfitId;
  };

  const handleRateCurrentOutfit = async (rating: OutfitRating) => {
    if (!currentResult || rating === 'unrated') return;
    setCurrentRating(rating);

    // Ensure the outfit exists in outfits collection first (required by relational security rule on /feedback)
    const savedOutfitId = await handleSaveCurrentOutfit(false, rating);
    if (!savedOutfitId) return;

    const dominantColors = Object.values(currentResult.slots)
      .filter((i): i is WardrobeItem => Boolean(i))
      .map((i) => i.primaryColor)
      .slice(0, 6);

    const feedbackId = sanitizeId(`fb_${Date.now()}`, 'fb');

    if (currentUser) {
      const uid = currentUser.uid;
      const sanitizedFb = sanitizeFeedbackPayload(
        {
          feedbackId,
          outfitId: savedOutfitId,
          rating,
          occasion: currentResult.occasion,
          preferredStyle: currentResult.desiredStyle,
          dominantColors,
          comments: `Rated ${rating} for ${currentResult.occasion}`,
        },
        uid
      );
      try {
        await setDoc(doc(db, 'feedback', sanitizedFb.feedbackId), {
          ...sanitizedFb,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `feedback/${sanitizedFb.feedbackId}`);
      }
    } else {
      const newFb: StyleFeedback = {
        ...sanitizeFeedbackPayload(
          {
            feedbackId,
            outfitId: savedOutfitId,
            rating,
            occasion: currentResult.occasion,
            preferredStyle: currentResult.desiredStyle,
            dominantColors,
            comments: `Rated ${rating}`,
          },
          'demo_user'
        ),
        createdAt: new Date().toISOString(),
      };
      setFeedbackList((prev) => [newFb, ...prev]);
    }

    setSavedNotice(
      rating === 'love'
        ? 'Marked as “Love it” — saved to Favorites & calibrated your Style Profile.'
        : rating === 'good'
        ? 'Rated “Good” — saved to History & updated Style Learning.'
        : 'Noted — the AI stylist will deprioritize this combination.'
    );
  };

  const handleToggleFavoriteOutfit = async (outfit: Outfit) => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'outfits', outfit.outfitId), {
          rating: outfit.rating,
          isFavorite: !outfit.isFavorite,
          wearCount: outfit.wearCount,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `outfits/${outfit.outfitId}`);
      }
    } else {
      setOutfits((prev) =>
        prev.map((o) =>
          o.outfitId === outfit.outfitId ? { ...o, isFavorite: !o.isFavorite } : o
        )
      );
    }
  };

  const handleDeleteOutfit = async (outfitId: string) => {
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'outfits', outfitId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `outfits/${outfitId}`);
      }
    } else {
      setOutfits((prev) => prev.filter((o) => o.outfitId !== outfitId));
    }
  };

  const handleWearAgainOutfit = async (outfit: Outfit) => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'outfits', outfit.outfitId), {
          rating: outfit.rating,
          isFavorite: outfit.isFavorite,
          wearCount: outfit.wearCount + 1,
          updatedAt: serverTimestamp(),
        });
        // Increment usageCount on each worn wardrobe item
        for (const itemId of outfit.itemIds) {
          const found = wardrobe.find((w) => w.itemId === itemId);
          if (found) {
            await updateDoc(doc(db, 'wardrobeItems', itemId), {
              isFavorite: found.isFavorite,
              usageCount: found.usageCount + 1,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `outfits/${outfit.outfitId}`);
      }
    } else {
      const now = new Date().toISOString();
      setOutfits((prev) =>
        prev.map((o) =>
          o.outfitId === outfit.outfitId
            ? { ...o, wearCount: o.wearCount + 1, updatedAt: now }
            : o
        )
      );
      setWardrobe((prev) =>
        prev.map((w) =>
          outfit.itemIds.includes(w.itemId)
            ? { ...w, usageCount: w.usageCount + 1, updatedAt: now }
            : w
        )
      );
    }
  };

  const handleModifyOutfitInStylist = (outfit: Outfit) => {
    const itemMap = new Map<string, WardrobeItem>(wardrobe.map((i) => [i.itemId, i]));
    const resolved = outfit.itemIds
      .map((id) => itemMap.get(id))
      .filter((i): i is WardrobeItem => Boolean(i));

    const slots: OutfitSlotsMap = {
      top: resolved.find(isTopItem) || null,
      jacket: resolved.find(isJacketItem) || null,
      bottom: resolved.find(isBottomItem) || null,
      footwear: resolved.find(isFootwearItem) || null,
      belt: resolved.find(isBeltItem) || null,
      watch: resolved.find(isWatchItem) || null,
      accessory: resolved.find(isExtraAccessoryItem) || null,
    };

    setSelectedOccasion(outfit.occasion);
    setTimeOfDay(outfit.timeOfDay || 'Evening');
    setLocationContext(outfit.locationContext || 'Restaurant');
    setWeatherContext(outfit.weatherContext || 'Warm & Breezy (28°C)');
    setDesiredStyle(outfit.desiredStyle || 'Smart Casual');
    setCurrentSavedOutfitId(outfit.outfitId);
    setCurrentRating(outfit.rating || 'unrated');
    setIsWornToday(false);
    setSavedNotice(null);
    setCurrentResult({
      title: outfit.title,
      occasion: outfit.occasion,
      dressCode: outfit.dressCode,
      timeOfDay: outfit.timeOfDay,
      locationContext: outfit.locationContext,
      weatherContext: outfit.weatherContext,
      desiredStyle: outfit.desiredStyle,
      slots,
      itemIds: outfit.itemIds,
      explanation: outfit.explanation,
      missingItems: outfit.missingItems || [],
      source: 'compatibility-engine',
    });
    setActiveTab('stylist');
  };

  const handleUpdateUserProfile = async (updated: Partial<UserProfile>) => {
    if (currentUser) {
      const uid = currentUser.uid;
      const sanitized = sanitizeUserProfilePayload({ ...userProfile, ...updated }, uid);
      try {
        const { userId: _uid, ...mutableFields } = sanitized;
        await updateDoc(doc(db, 'users', uid), {
          ...mutableFields,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    } else {
      setUserProfile((prev) => ({
        ...prev,
        ...updated,
        updatedAt: new Date().toISOString(),
      }));
    }
  };

  const handleSaveTripPlan = async (capsule: GeneratedTripCapsule, packedIds: string[]) => {
    const tripId = sanitizeId(`trip_${Date.now()}`, 'trip');
    const now = new Date().toISOString();

    if (currentUser) {
      const uid = currentUser.uid;
      const sanitized = sanitizeTripPlanPayload(
        {
          tripId,
          title: capsule.title,
          destination: capsule.destination,
          durationDays: capsule.durationDays,
          climate: capsule.climate,
          tripVibe: capsule.tripVibe,
          itemIds: capsule.itemIds,
          packedItemIds: packedIds,
          rationale: capsule.rationale,
          outfitCombinationsCount: capsule.outfitCombinationsCount,
          missingSuggestions: capsule.missingSuggestions,
        },
        uid
      );
      try {
        await setDoc(doc(db, 'trips', sanitized.tripId), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `trips/${sanitized.tripId}`);
      }
    } else {
      const newTrip: TripPlan = {
        ...sanitizeTripPlanPayload(
          {
            tripId,
            title: capsule.title,
            destination: capsule.destination,
            durationDays: capsule.durationDays,
            climate: capsule.climate,
            tripVibe: capsule.tripVibe,
            itemIds: capsule.itemIds,
            packedItemIds: packedIds,
            rationale: capsule.rationale,
            outfitCombinationsCount: capsule.outfitCombinationsCount,
            missingSuggestions: capsule.missingSuggestions,
          },
          'demo_user'
        ),
        createdAt: now,
        updatedAt: now,
      };
      setTrips((prev) => [newTrip, ...prev]);
    }
  };

  const handleDeleteTripPlan = async (tripId: string) => {
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'trips', tripId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `trips/${tripId}`);
      }
    } else {
      setTrips((prev) => prev.filter((t) => t.tripId !== tripId));
    }
  };

  const handleScheduleOrLogCalendarEntry = async (params: {
    dateKey: string;
    outfitId: string;
    title: string;
    occasion: string;
    status: CalendarEntryStatus;
    itemIds: string[];
    notes: string;
  }) => {
    const entryId = sanitizeId(`cal_${Date.now()}`, 'cal');
    const now = new Date().toISOString();
    const uniqueIds = Array.from(new Set(params.itemIds));

    if (currentUser) {
      const uid = currentUser.uid;
      const sanitized = sanitizeCalendarEntryPayload(
        {
          entryId,
          dateKey: params.dateKey,
          outfitId: params.outfitId,
          title: params.title,
          occasion: params.occasion,
          status: params.status,
          itemIds: uniqueIds,
          notes: params.notes,
        },
        uid
      );
      try {
        await setDoc(doc(db, 'calendarEntries', sanitized.entryId), {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (params.status === 'worn') {
          for (const itemId of uniqueIds) {
            const found = wardrobe.find((w) => w.itemId === itemId);
            if (found) {
              await updateDoc(doc(db, 'wardrobeItems', itemId), {
                isFavorite: found.isFavorite,
                usageCount: found.usageCount + 1,
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `calendarEntries/${sanitized.entryId}`);
      }
    } else {
      const newEntry: OutfitCalendarEntry = {
        ...sanitizeCalendarEntryPayload(
          {
            entryId,
            dateKey: params.dateKey,
            outfitId: params.outfitId,
            title: params.title,
            occasion: params.occasion,
            status: params.status,
            itemIds: uniqueIds,
            notes: params.notes,
          },
          'demo_user'
        ),
        createdAt: now,
        updatedAt: now,
      };
      setCalendarEntries((prev) => [...prev, newEntry]);

      if (params.status === 'worn') {
        setWardrobe((prev) =>
          prev.map((w) =>
            uniqueIds.includes(w.itemId)
              ? { ...w, usageCount: w.usageCount + 1, updatedAt: now }
              : w
          )
        );
      }
    }
  };

  const handleMarkCalendarEntryAsWorn = async (entry: OutfitCalendarEntry) => {
    const now = new Date().toISOString();
    const uniqueIds = Array.from(new Set(entry.itemIds));

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'calendarEntries', entry.entryId), {
          status: 'worn',
          notes: entry.notes,
          updatedAt: serverTimestamp(),
        });
        for (const itemId of uniqueIds) {
          const found = wardrobe.find((w) => w.itemId === itemId);
          if (found) {
            await updateDoc(doc(db, 'wardrobeItems', itemId), {
              isFavorite: found.isFavorite,
              usageCount: found.usageCount + 1,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `calendarEntries/${entry.entryId}`);
      }
    } else {
      setCalendarEntries((prev) =>
        prev.map((e) =>
          e.entryId === entry.entryId
            ? { ...e, status: 'worn', updatedAt: now }
            : e
        )
      );
      setWardrobe((prev) =>
        prev.map((w) =>
          uniqueIds.includes(w.itemId)
            ? { ...w, usageCount: w.usageCount + 1, updatedAt: now }
            : w
        )
      );
    }
  };

  const handleDeleteCalendarEntry = async (entryId: string) => {
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'calendarEntries', entryId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `calendarEntries/${entryId}`);
      }
    } else {
      setCalendarEntries((prev) => prev.filter((e) => e.entryId !== entryId));
    }
  };

  // Time-of-day greeting for Home Screen
  const greetingPrefix = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const favoriteOutfits = useMemo(
    () => outfits.filter((o) => o.isFavorite).slice(0, 3),
    [outfits]
  );

  const recentlyAddedItems = useMemo(() => wardrobe.slice(0, 4), [wardrobe]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#11100F] text-[#181615] dark:text-[#F5F2EB] transition-colors">
      <OfflineIndicator />

      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT (frontend-design/SKILL.md Section 2)
          Zone 1: Single text wordmark | Zone 2: 5 nav links | Zone 3: 2 actions
         ===================================================================== */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-8 flex items-center justify-between bg-[#FAF8F5]/90 dark:bg-[#11100F]/90 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800/80">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="text-xl font-display font-semibold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap"
        >
          MyWardrobe AI
        </button>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600 dark:text-stone-400">
          {(
            [
              { id: 'home', label: 'Home' },
              { id: 'stylist', label: 'Style Me' },
              { id: 'wardrobe', label: 'Wardrobe' },
              { id: 'history', label: 'Outfits' },
              { id: 'profile', label: 'My Style' },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`py-1 transition-colors whitespace-nowrap ${
                activeTab === nav.id
                  ? 'text-stone-900 dark:text-stone-100 underline underline-offset-8 decoration-[#8C5A32] dark:decoration-[#D4A373] decoration-2'
                  : 'hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 2 primary actions (Theme/Install + Auth) */}
        <div className="flex items-center gap-2.5">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-h-[40px] min-w-[40px] rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] px-3.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSigningIn ? 'Signing in...' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container (1440px desktop baseline with max-w-6xl content container) */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-24 md:pb-14">
        {/* If signed in and cloud wardrobe is empty, offer 1-click sample wardrobe import */}
        {currentUser && wardrobe.length === 0 && (
          <div className="mb-8 p-6 rounded-2xl bg-white dark:bg-stone-900 border border-[#8C5A32]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-display font-semibold text-stone-900 dark:text-stone-100">
                Welcome to Your Private Cloud Wardrobe, {userProfile.displayName}
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Start adding your own clothes or load our curated 31-piece East African & tailored sample collection to test styling immediately.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleSeedSampleWardrobeToCloud}
                disabled={isSeedingCloud}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#8C5A32] hover:bg-[#734825] text-white text-xs font-medium whitespace-nowrap disabled:opacity-50"
              >
                {isSeedingCloud ? 'Loading 31 Pieces...' : 'Load Sample Collection'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setIsItemModalOpen(true);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium whitespace-nowrap"
              >
                Add First Item
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 1: HOME SCREEN (Section 12)
           =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-12">
            {/* Hero Focal Anchor */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  <span>{userProfile.locationCity}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{isDemoMode ? 'Interactive Demo Wardrobe (31 Pieces)' : 'Personal Cloud Wardrobe'}</span>
                </div>

                <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-stone-900 dark:text-stone-100 leading-[1.1]">
                  {greetingPrefix}, {userProfile.displayName}.
                  <span className="block text-stone-600 dark:text-stone-400 font-normal italic mt-1">
                    What are you wearing today?
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed max-w-xl">
                  Your wardrobe. Your occasions. Your personal AI stylist. Receive complete, harmonious outfit recommendations crafted exclusively from the clothes you own.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('stylist');
                      handleStyleMe(false);
                    }}
                    className="min-h-[48px] px-7 py-3 rounded-xl bg-[#8C5A32] hover:bg-[#734825] text-white text-sm font-medium flex items-center gap-2.5 transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>STYLE ME</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsItemModalOpen(true);
                    }}
                    className="min-h-[48px] px-5 py-3 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-sm font-medium hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Piece</span>
                  </button>
                </div>
              </div>

              {/* Editorial Flat-Lay Showcase Card */}
              <div className="lg:col-span-6">
                <div className="aspect-16/9 w-full rounded-2xl overflow-hidden relative bg-stone-900 border border-stone-200/80 dark:border-stone-800">
                  <img
                    src={HERO_EDITORIAL_IMAGE}
                    alt="Curated minimalist luxury outfit flat-lay on travertine stone"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex flex-col justify-end p-6">
                    <p className="text-xs text-stone-300">
                      Featured Today · {selectedOccasion} · {weatherContext}
                    </p>
                    <div className="flex items-end justify-between gap-4 mt-1">
                      <h2 className="text-2xl font-display font-semibold text-white">
                        {currentResult?.title || 'Oysterbay Smart-Casual Linen & Cognac'}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('stylist')}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-white text-stone-900 text-xs font-medium whitespace-nowrap shrink-0 hover:bg-stone-100 transition-colors"
                      >
                        View Outfit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Occasions Selector: CASUAL, WORK, DATE, CHURCH, WEDDING, EVENING */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
                  Quick Occasions
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('stylist')}
                  className="text-xs font-medium text-[#8C5A32] dark:text-[#D4A373] hover:underline flex items-center gap-1"
                >
                  <span>All 25 Occasions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {QUICK_OCCASIONS.map((occ) => {
                  const isSelected =
                    selectedOccasion.toLowerCase() === occ.id.toLowerCase();
                  return (
                    <button
                      key={occ.id}
                      type="button"
                      onClick={() => {
                        setSelectedOccasion(occ.id);
                        setActiveTab('stylist');
                        handleStyleMe(false, occ.id);
                      }}
                      className={`min-h-[76px] p-4 rounded-2xl border text-left transition-colors flex flex-col justify-between ${
                        isSelected
                          ? 'bg-stone-900 dark:bg-stone-100 border-stone-900 dark:border-stone-100 text-white dark:text-stone-900'
                          : 'bg-white dark:bg-stone-900 border-stone-200/90 dark:border-stone-800 text-stone-900 dark:text-stone-100 hover:border-[#8C5A32]'
                      }`}
                    >
                      <span className="text-sm font-semibold">{occ.label}</span>
                      <span
                        className={`text-xs ${
                          isSelected
                            ? 'text-stone-300 dark:text-stone-600'
                            : 'text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        {occ.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Your Wardrobe Summary + Recently Added */}
            <section className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
                    Your Wardrobe & Recently Added
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    <span className="font-mono-num">{wardrobe.filter((i) => i.category === 'Tops' || i.category === 'Traditional').length}</span> Tops & Traditional ·{' '}
                    <span className="font-mono-num">{wardrobe.filter((i) => i.category === 'Bottoms').length}</span> Bottoms ·{' '}
                    <span className="font-mono-num">{wardrobe.filter((i) => i.category === 'Footwear').length}</span> Footwear ·{' '}
                    <span className="font-mono-num">{wardrobe.filter((i) => i.category === 'Accessories').length}</span> Accessories
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('wardrobe')}
                  className="text-xs font-medium text-[#8C5A32] dark:text-[#D4A373] hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Explore Wardrobe ({wardrobe.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {recentlyAddedItems.map((item) => (
                  <div
                    key={item.itemId}
                    onClick={() => {
                      setEditingItem(item);
                      setIsItemModalOpen(true);
                    }}
                    className="cursor-pointer rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 overflow-hidden transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    <div className="aspect-3/4 w-full bg-[#F9F9F8] dark:bg-stone-950 overflow-hidden">
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
                    <div className="p-3.5">
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {item.subcategory} · {item.primaryColor}
                      </p>
                      <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate mt-0.5">
                        {item.name}
                      </h3>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Favorite Outfits Section */}
            <section className="space-y-5">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
                    Favorite Outfits
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Ready-to-wear combinations curated from your collection
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-medium text-[#8C5A32] dark:text-[#D4A373] hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  <span>View Outfit History</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(favoriteOutfits.length > 0 ? favoriteOutfits : outfits.slice(0, 3)).map(
                  (outfit) => (
                    <div
                      key={outfit.outfitId}
                      className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          <span>{outfit.occasion}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{outfit.dressCode}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono-num">Worn {outfit.wearCount}×</span>
                        </div>
                        <h3 className="text-xl font-display font-semibold text-stone-900 dark:text-stone-100">
                          {outfit.title}
                        </h3>
                        <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-3 leading-relaxed">
                          “{outfit.explanation}”
                        </p>
                      </div>

                      <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                        <span className="text-xs text-stone-500 font-mono-num">
                          {outfit.itemIds.length} pieces
                        </span>
                        <button
                          type="button"
                          onClick={() => handleModifyOutfitInStylist(outfit)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#F2EFE9] dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        >
                          Open in Stylist
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 2: AI PERSONAL STYLIST (Sections 5, 6, 7, 8, 9)
           =================================================================== */}
        {activeTab === 'stylist' && (
          <StylistView
            wardrobe={wardrobe}
            userProfile={userProfile}
            feedbackList={feedbackList}
            currentResult={currentResult}
            isGenerating={isGenerating}
            selectedOccasion={selectedOccasion}
            setSelectedOccasion={setSelectedOccasion}
            timeOfDay={timeOfDay}
            setTimeOfDay={setTimeOfDay}
            locationContext={locationContext}
            setLocationContext={setLocationContext}
            weatherContext={weatherContext}
            setWeatherContext={setWeatherContext}
            desiredStyle={desiredStyle}
            setDesiredStyle={setDesiredStyle}
            onStyleMe={(another) => handleStyleMe(another)}
            onUpdateCurrentResult={(updated) => {
              setCurrentResult(updated);
              setCurrentSavedOutfitId(null);
              setIsWornToday(false);
              setSavedNotice(null);
            }}
            onRateCurrentOutfit={handleRateCurrentOutfit}
            onSaveCurrentOutfit={handleSaveCurrentOutfit}
            onOpenAddModal={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            onViewHistory={() => setActiveTab('history')}
            savedNotice={savedNotice}
            currentRating={currentRating}
            isWornToday={isWornToday}
            trips={trips}
            onSaveTripPlan={handleSaveTripPlan}
            onDeleteTripPlan={handleDeleteTripPlan}
          />
        )}

        {/* ===================================================================
            TAB 3: DIGITAL WARDROBE (Sections 3, 4, 16)
           =================================================================== */}
        {activeTab === 'wardrobe' && (
          <WardrobeView
            wardrobe={wardrobe}
            onOpenAdd={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            onOpenEdit={(item) => {
              setEditingItem(item);
              setIsItemModalOpen(true);
            }}
            onDeleteItem={handleDeleteWardrobeItem}
            onToggleFavorite={handleToggleFavoriteItem}
            onStyleWithItem={(item) => {
              setActiveTab('stylist');
              handleStyleMe(false, selectedOccasion, item);
            }}
          />
        )}

        {/* ===================================================================
            TAB 4 & 5: OUTFIT HISTORY & MY STYLE / PROFILE (Sections 2, 10, 11)
           =================================================================== */}
        {(activeTab === 'history' || activeTab === 'profile') && (
          <StyleAndHistoryView
            mode={activeTab}
            wardrobe={wardrobe}
            outfits={outfits}
            calendarEntries={calendarEntries}
            feedbackList={feedbackList}
            userProfile={userProfile}
            isDemoMode={isDemoMode}
            onUpdateProfile={handleUpdateUserProfile}
            onToggleFavoriteOutfit={handleToggleFavoriteOutfit}
            onDeleteOutfit={handleDeleteOutfit}
            onWearAgainOutfit={handleWearAgainOutfit}
            onModifyOutfitInStylist={handleModifyOutfitInStylist}
            onScheduleOrLogCalendarEntry={handleScheduleOrLogCalendarEntry}
            onMarkCalendarEntryAsWorn={handleMarkCalendarEntryAsWorn}
            onDeleteCalendarEntry={handleDeleteCalendarEntry}
            onResetDemoData={handleResetDemoData}
          />
        )}
      </main>

      {/* =====================================================================
          MOBILE FIXED BOTTOM TAB BAR (10_mobile_touch_apps.md Pattern 1)
          5 evenly distributed tabs, 56px height (<15% combined sticky height)
         ===================================================================== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#FAF8F5]/95 dark:bg-[#11100F]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 grid grid-cols-5 items-center">
        {(
          [
            { id: 'home', label: 'Home', Icon: Home },
            { id: 'stylist', label: 'Style Me', Icon: Sparkles },
            { id: 'wardrobe', label: 'Wardrobe', Icon: Shirt },
            { id: 'history', label: 'Outfits', Icon: Clock },
            { id: 'profile', label: 'My Style', Icon: UserIcon },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
                active
                  ? 'text-[#8C5A32] dark:text-[#D4A373]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Add / Edit Wardrobe Item Modal with Gemini Clothing Analysis */}
      <AddEditItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveWardrobeItem}
        initialItem={editingItem}
      />
    </div>
  );
}
