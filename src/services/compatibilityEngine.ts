import {
  AIAnalysisResult,
  FormalityLevel,
  GeneratedOutfitResult,
  GeneratedTripCapsule,
  OccasionInterpretation,
  OutfitSlotKey,
  OutfitSlotsMap,
  StyleFeedback,
  TripDaySampleOutfit,
  UserProfile,
  WardrobeItem,
} from '../types';

const NEUTRAL_COLORS = new Set([
  'ivory',
  'white',
  'off-white',
  'black',
  'navy',
  'charcoal',
  'grey',
  'sand beige',
  'beige',
  'khaki',
  'olive',
  'cognac brown',
  'dark brown',
  'brown',
]);

const COMPLEMENTARY_COLOR_PAIRS: Record<string, string[]> = {
  ivory: ['olive', 'navy', 'cognac brown', 'sand beige', 'charcoal', 'terracotta', 'dark brown'],
  white: ['navy', 'charcoal', 'black', 'olive', 'sand beige', 'sky blue', 'cognac brown'],
  navy: ['ivory', 'white', 'sand beige', 'sky blue', 'cognac brown', 'khaki', 'ochre gold', 'grey'],
  olive: ['ivory', 'white', 'sand beige', 'cognac brown', 'dark brown', 'terracotta', 'black'],
  'sand beige': ['ivory', 'white', 'navy', 'olive', 'terracotta', 'cognac brown', 'dark brown', 'sky blue'],
  charcoal: ['white', 'ivory', 'sky blue', 'black', 'navy', 'burgundy', 'silver'],
  terracotta: ['sand beige', 'ivory', 'olive', 'navy', 'dark brown', 'cognac brown'],
  'sky blue': ['navy', 'charcoal', 'sand beige', 'olive', 'cognac brown', 'white'],
  black: ['white', 'ivory', 'charcoal', 'grey', 'olive', 'sand beige'],
  'cognac brown': ['navy', 'olive', 'ivory', 'sand beige', 'white', 'sky blue', 'terracotta'],
  'dark brown': ['ivory', 'sand beige', 'olive', 'navy', 'terracotta', 'khaki'],
};

const FORMALITY_RANK: Record<FormalityLevel, number> = {
  Casual: 1,
  'Smart Casual': 2,
  Business: 3,
  Formal: 4,
  'Traditional / Ceremonial': 3.5,
};

export function inferTargetFormalityForOccasion(occasion: string, desiredStyle?: string): {
  targetRank: number;
  allowTraditional: boolean;
  needsJacket: boolean;
  dressCodeLabel: string;
} {
  const occ = (occasion || '').toLowerCase();
  const sty = (desiredStyle || '').toLowerCase();

  if (
    occ.includes('interview') ||
    occ.includes('formal') ||
    occ.includes('funeral') ||
    sty.includes('classic formal')
  ) {
    return {
      targetRank: 3.8,
      allowTraditional: occ.includes('funeral') || occ.includes('special'),
      needsJacket: true,
      dressCodeLabel: 'Formal Tailored',
    };
  }

  if (occ.includes('business') || occ.includes('office') || sty.includes('executive')) {
    return {
      targetRank: 3.0,
      allowTraditional: false,
      needsJacket: occ.includes('meeting') || sty.includes('executive'),
      dressCodeLabel: 'Business Smart',
    };
  }

  if (
    occ.includes('wedding') ||
    occ.includes('family ceremony') ||
    occ.includes('graduation') ||
    occ.includes('church') ||
    occ.includes('special event')
  ) {
    return {
      targetRank: 3.0,
      allowTraditional: true,
      needsJacket: !sty.includes('heritage'),
      dressCodeLabel: sty.includes('heritage')
        ? 'Contemporary Heritage Elegance'
        : 'Ceremonial Smart-Formal',
    };
  }

  if (
    occ.includes('date') ||
    occ.includes('dinner') ||
    occ.includes('evening') ||
    occ.includes('birthday') ||
    occ.includes('party') ||
    occ.includes('smart casual')
  ) {
    return {
      targetRank: 2.2,
      allowTraditional: true,
      needsJacket: false,
      dressCodeLabel: 'Refined Smart Casual',
    };
  }

  return {
    targetRank: 1.3,
    allowTraditional: true,
    needsJacket: false,
    dressCodeLabel: 'Relaxed Everyday Casual',
  };
}

export function isTopItem(item: WardrobeItem): boolean {
  if (item.category === 'Traditional') return true;
  if (item.category !== 'Tops') return false;
  const sub = item.subcategory.toLowerCase();
  return !sub.includes('jacket') && !sub.includes('coat') && !sub.includes('blazer');
}

export function isJacketItem(item: WardrobeItem): boolean {
  if (item.category !== 'Tops') return false;
  const sub = item.subcategory.toLowerCase();
  return sub.includes('jacket') || sub.includes('coat') || sub.includes('blazer');
}

export function isBottomItem(item: WardrobeItem): boolean {
  return item.category === 'Bottoms';
}

export function isFootwearItem(item: WardrobeItem): boolean {
  return item.category === 'Footwear';
}

export function isBeltItem(item: WardrobeItem): boolean {
  return item.category === 'Accessories' && item.subcategory.toLowerCase().includes('belt');
}

export function isWatchItem(item: WardrobeItem): boolean {
  return item.category === 'Accessories' && item.subcategory.toLowerCase().includes('watch');
}

export function isExtraAccessoryItem(item: WardrobeItem): boolean {
  if (item.category !== 'Accessories') return false;
  const sub = item.subcategory.toLowerCase();
  return !sub.includes('belt') && !sub.includes('watch');
}

function colorHarmonyScore(c1Raw: string, c2Raw: string): number {
  const c1 = (c1Raw || '').toLowerCase().trim();
  const c2 = (c2Raw || '').toLowerCase().trim();
  if (!c1 || !c2) return 5;
  if (c1 === c2) return 6; // monochrome / tonal
  if (COMPLEMENTARY_COLOR_PAIRS[c1]?.includes(c2) || COMPLEMENTARY_COLOR_PAIRS[c2]?.includes(c1)) {
    return 12;
  }
  if (NEUTRAL_COLORS.has(c1) || NEUTRAL_COLORS.has(c2)) {
    return 9;
  }
  return 3;
}

function isPatterned(item?: WardrobeItem | null): boolean {
  if (!item) return false;
  const pat = (item.pattern || '').toLowerCase();
  return pat !== 'solid' && pat !== 'none' && pat !== '';
}

function leatherToneGroup(colorRaw: string): 'brown' | 'black' | 'neutral' {
  const c = (colorRaw || '').toLowerCase();
  if (c.includes('black') || c.includes('charcoal')) return 'black';
  if (c.includes('brown') || c.includes('cognac') || c.includes('tan') || c.includes('espresso')) {
    return 'brown';
  }
  return 'neutral';
}

export function scoreItemForContext(
  item: WardrobeItem,
  occasion: string,
  desiredStyle: string,
  weatherContext: string,
  userProfile?: UserProfile | null,
  feedbackList?: StyleFeedback[]
): number {
  let score = 50;
  const { targetRank, allowTraditional } = inferTargetFormalityForOccasion(occasion, desiredStyle);
  const itemRank = FORMALITY_RANK[item.formality] ?? 2;

  // 1. Formality proximity
  const rankDiff = Math.abs(itemRank - targetRank);
  score += Math.max(0, 22 - rankDiff * 11);

  if (item.category === 'Traditional' && !allowTraditional) {
    score -= 15;
  }

  // 2. Occasion match
  const occLower = occasion.toLowerCase();
  const matchesOccasion = item.occasions.some(
    (o) => o.toLowerCase() === occLower || occLower.includes(o.toLowerCase()) || o.toLowerCase().includes(occLower)
  );
  if (matchesOccasion) {
    score += 20;
  }

  // 3. Hard incompatibility guards
  const sub = item.subcategory.toLowerCase();
  if (targetRank >= 3.2 && (sub.includes('sandal') || sub.includes('short') || sub.includes('hoodie') || sub.includes('t-shirt'))) {
    score -= 45;
  }
  if (targetRank <= 1.5 && sub.includes('oxford')) {
    score -= 25;
  }

  // 4. Desired style alignment
  if (desiredStyle && item.style.toLowerCase().includes(desiredStyle.toLowerCase())) {
    score += 12;
  }

  // 5. Weather / East African warm-weather suitability
  const weather = (weatherContext || '').toLowerCase();
  if (weather.includes('hot') || weather.includes('warm') || weather.includes('humid') || weather.includes('coastal') || weather.includes('sunny')) {
    if (item.season === 'Hot / Dry' || item.season === 'Warm / Humid' || item.season === 'All-Season') {
      score += 8;
    }
    if (item.material.toLowerCase().includes('linen') || item.material.toLowerCase().includes('cotton')) {
      score += 6;
    }
    if (sub.includes('sweater') || sub.includes('hoodie') || sub.includes('coat')) {
      score -= 18;
    }
  } else if (weather.includes('cool') || weather.includes('rain') || weather.includes('evening')) {
    if (item.season === 'Cool / Evening' || item.season === 'Rainy' || item.season === 'All-Season') {
      score += 8;
    }
  }

  // 6. User Profile Preferences
  if (userProfile) {
    if (userProfile.favoriteColors.some((c) => c.toLowerCase() === item.primaryColor.toLowerCase())) {
      score += 8;
    }
    if (userProfile.preferredStyles.some((s) => s.toLowerCase() === item.style.toLowerCase())) {
      score += 8;
    }
    if (userProfile.preferredFit && item.fit.toLowerCase() === userProfile.preferredFit.toLowerCase()) {
      score += 5;
    }
  }

  if (item.isFavorite) {
    score += 5;
  }

  // 7. Style Learning from User Feedback
  if (feedbackList && feedbackList.length > 0) {
    for (const fb of feedbackList) {
      const colorMatch = fb.dominantColors.some(
        (c) => c.toLowerCase() === item.primaryColor.toLowerCase()
      );
      const styleMatch = fb.preferredStyle.toLowerCase() === item.style.toLowerCase();
      if (fb.rating === 'love') {
        if (colorMatch) score += 4;
        if (styleMatch) score += 4;
      } else if (fb.rating === 'good') {
        if (colorMatch) score += 2;
        if (styleMatch) score += 2;
      } else if (fb.rating === 'dislike') {
        if (colorMatch && styleMatch) score -= 5;
      }
    }
  }

  return score;
}

export function buildHumanExplanation(
  slots: OutfitSlotsMap,
  occasion: string,
  dressCode: string,
  weatherContext: string
): string {
  const { top, bottom, footwear, jacket, belt, watch } = slots;
  const parts: string[] = [];

  if (top && bottom) {
    parts.push(
      `This combination balances ${dressCode.toLowerCase()} polish for ${occasion.toLowerCase()}: the ${top.primaryColor.toLowerCase()} ${top.name.toLowerCase()} pairs cleanly with the ${bottom.primaryColor.toLowerCase()} ${bottom.subcategory.toLowerCase()}.`
    );
  } else if (top) {
    parts.push(
      `Anchored by the ${top.primaryColor.toLowerCase()} ${top.name.toLowerCase()} for a refined ${dressCode.toLowerCase()} silhouette.`
    );
  }

  if (jacket) {
    parts.push(
      `Layering the ${jacket.primaryColor.toLowerCase()} ${jacket.subcategory.toLowerCase()} adds tailored structure without overheating in ${weatherContext ? weatherContext.toLowerCase() : 'warm'} conditions.`
    );
  }

  if (footwear && belt) {
    parts.push(
      `The ${footwear.primaryColor.toLowerCase()} ${footwear.subcategory.toLowerCase()} connect naturally with the ${belt.primaryColor.toLowerCase()} belt${watch ? ` and ${watch.name.toLowerCase()}` : ''}.`
    );
  } else if (footwear) {
    parts.push(
      `Grounded by the ${footwear.primaryColor.toLowerCase()} ${footwear.subcategory.toLowerCase()} to complete the look.`
    );
  }

  return (
    parts.join(' ') ||
    'Curated from your wardrobe for balanced color harmony, occasion appropriateness, and effortless comfort.'
  );
}

export function generateRuleBasedOutfit(params: {
  wardrobe: WardrobeItem[];
  occasion: string;
  timeOfDay: string;
  locationContext: string;
  weatherContext: string;
  desiredStyle: string;
  userProfile?: UserProfile | null;
  feedbackList?: StyleFeedback[];
  excludeCombinationKeys?: string[];
  variationIndex?: number;
}): GeneratedOutfitResult {
  const {
    wardrobe,
    occasion,
    timeOfDay,
    locationContext,
    weatherContext,
    desiredStyle,
    userProfile,
    feedbackList = [],
    excludeCombinationKeys = [],
    variationIndex = 0,
  } = params;

  const { targetRank, needsJacket, dressCodeLabel } = inferTargetFormalityForOccasion(
    occasion,
    desiredStyle
  );

  const tops = wardrobe
    .filter(isTopItem)
    .sort(
      (a, b) =>
        scoreItemForContext(b, occasion, desiredStyle, weatherContext, userProfile, feedbackList) -
        scoreItemForContext(a, occasion, desiredStyle, weatherContext, userProfile, feedbackList)
    );

  const bottoms = wardrobe
    .filter(isBottomItem)
    .sort(
      (a, b) =>
        scoreItemForContext(b, occasion, desiredStyle, weatherContext, userProfile, feedbackList) -
        scoreItemForContext(a, occasion, desiredStyle, weatherContext, userProfile, feedbackList)
    );

  const footwearList = wardrobe
    .filter(isFootwearItem)
    .sort(
      (a, b) =>
        scoreItemForContext(b, occasion, desiredStyle, weatherContext, userProfile, feedbackList) -
        scoreItemForContext(a, occasion, desiredStyle, weatherContext, userProfile, feedbackList)
    );

  const jackets = wardrobe
    .filter(isJacketItem)
    .sort(
      (a, b) =>
        scoreItemForContext(b, occasion, desiredStyle, weatherContext, userProfile, feedbackList) -
        scoreItemForContext(a, occasion, desiredStyle, weatherContext, userProfile, feedbackList)
    );

  const belts = wardrobe.filter(isBeltItem);
  const watches = wardrobe.filter(isWatchItem);
  const extraAccessories = wardrobe.filter(isExtraAccessoryItem);

  const missingItems: string[] = [];

  // Pick best Top + Bottom + Footwear triad that hasn't been excluded
  let chosenTop: WardrobeItem | null = tops[0] || null;
  let chosenBottom: WardrobeItem | null = bottoms[0] || null;
  let chosenFootwear: WardrobeItem | null = footwearList[0] || null;

  if (!chosenTop) missingItems.push('Missing from wardrobe: Suitable Top / Shirt');
  if (!chosenBottom) missingItems.push('Missing from wardrobe: Suitable Trousers / Bottoms');
  if (!chosenFootwear) missingItems.push('Missing from wardrobe: Suitable Footwear / Shoes');

  if (tops.length > 0 && bottoms.length > 0 && footwearList.length > 0) {
    const candidates: {
      top: WardrobeItem;
      bottom: WardrobeItem;
      shoe: WardrobeItem;
      totalScore: number;
      key: string;
    }[] = [];

    for (const t of tops.slice(0, 6)) {
      for (const b of bottoms.slice(0, 5)) {
        // Avoid competing patterns between top and bottom
        const patternPenalty = isPatterned(t) && isPatterned(b) ? -25 : 0;
        // Avoid Kanzu with shorts
        const kanzuShortsPenalty =
          t.subcategory.toLowerCase().includes('kanzu') &&
          b.subcategory.toLowerCase().includes('short')
            ? -50
            : 0;

        for (const s of footwearList.slice(0, 5)) {
          // Avoid Formal top/bottom with sandals or athletic sneakers
          const shoeFormalityRank = FORMALITY_RANK[s.formality] ?? 2;
          const topFormalityRank = FORMALITY_RANK[t.formality] ?? 2;
          const formalityGapPenalty =
            Math.abs(topFormalityRank - shoeFormalityRank) > 1.8 ? -30 : 0;

          const triadScore =
            scoreItemForContext(t, occasion, desiredStyle, weatherContext, userProfile, feedbackList) +
            scoreItemForContext(b, occasion, desiredStyle, weatherContext, userProfile, feedbackList) +
            scoreItemForContext(s, occasion, desiredStyle, weatherContext, userProfile, feedbackList) +
            colorHarmonyScore(t.primaryColor, b.primaryColor) * 2 +
            colorHarmonyScore(b.primaryColor, s.primaryColor) * 1.5 +
            patternPenalty +
            kanzuShortsPenalty +
            formalityGapPenalty;

          const key = `${t.itemId}|${b.itemId}|${s.itemId}`;
          candidates.push({ top: t, bottom: b, shoe: s, totalScore: triadScore, key });
        }
      }
    }

    candidates.sort((a, b) => b.totalScore - a.totalScore);
    const nonExcluded = candidates.filter((c) => !excludeCombinationKeys.includes(c.key));
    const pool = nonExcluded.length > 0 ? nonExcluded : candidates;
    const picked = pool[variationIndex % pool.length] || pool[0];
    if (picked) {
      chosenTop = picked.top;
      chosenBottom = picked.bottom;
      chosenFootwear = picked.shoe;
    }
  }

  // Optional Jacket selection
  let chosenJacket: WardrobeItem | null = null;
  const isKanzuOrDashiki =
    chosenTop &&
    (chosenTop.subcategory.toLowerCase().includes('kanzu') ||
      chosenTop.subcategory.toLowerCase().includes('dashiki'));

  if (
    !isKanzuOrDashiki &&
    (needsJacket ||
      timeOfDay.toLowerCase() === 'evening' ||
      weatherContext.toLowerCase().includes('cool') ||
      targetRank >= 2.8)
  ) {
    const compatibleJacket = jackets.find((j) => {
      if (!chosenTop || !chosenBottom) return true;
      const rankDiff = Math.abs((FORMALITY_RANK[j.formality] ?? 2) - targetRank);
      return rankDiff <= 1.5 && colorHarmonyScore(j.primaryColor, chosenBottom.primaryColor) >= 6;
    });
    if (compatibleJacket) {
      chosenJacket = compatibleJacket;
    } else if (needsJacket) {
      missingItems.push('Missing from wardrobe: Tailored Blazer / Jacket');
    }
  }

  // Belt selection: match shoe leather tone
  let chosenBelt: WardrobeItem | null = null;
  if (belts.length > 0 && chosenFootwear) {
    const shoeTone = leatherToneGroup(chosenFootwear.primaryColor);
    chosenBelt =
      belts.find((b) => leatherToneGroup(b.primaryColor) === shoeTone) || belts[0];
  } else if (belts.length === 0) {
    missingItems.push('Missing from wardrobe: Coordinating Belt');
  }

  // Watch selection: match belt/shoe tone & formality
  let chosenWatch: WardrobeItem | null = null;
  if (watches.length > 0) {
    const shoeTone = chosenFootwear ? leatherToneGroup(chosenFootwear.primaryColor) : 'neutral';
    chosenWatch =
      watches.find((w) => leatherToneGroup(w.primaryColor) === shoeTone) ||
      watches.find((w) => Math.abs((FORMALITY_RANK[w.formality] ?? 2) - targetRank) <= 1.2) ||
      watches[0];
  } else {
    missingItems.push('Missing from wardrobe: Wristwatch');
  }

  // Extra accessory if available & appropriate
  let chosenAccessory: WardrobeItem | null = null;
  if (extraAccessories.length > 0) {
    chosenAccessory =
      extraAccessories.find((a) =>
        a.occasions.some((o) => o.toLowerCase() === occasion.toLowerCase())
      ) || null;
  }

  const slots: OutfitSlotsMap = {
    top: chosenTop,
    bottom: chosenBottom,
    footwear: chosenFootwear,
    jacket: chosenJacket,
    belt: chosenBelt,
    watch: chosenWatch,
    accessory: chosenAccessory,
  };

  const itemIds = [
    chosenTop?.itemId,
    chosenJacket?.itemId,
    chosenBottom?.itemId,
    chosenFootwear?.itemId,
    chosenBelt?.itemId,
    chosenWatch?.itemId,
    chosenAccessory?.itemId,
  ].filter((id): id is string => Boolean(id));

  const explanation = buildHumanExplanation(slots, occasion, dressCodeLabel, weatherContext);

  return {
    title: `${occasion} — ${dressCodeLabel}`,
    occasion,
    dressCode: dressCodeLabel,
    timeOfDay,
    locationContext,
    weatherContext,
    desiredStyle,
    slots,
    itemIds,
    explanation,
    missingItems,
    source: 'compatibility-engine',
    compatibilityBreakdown: {
      colorHarmony:
        chosenTop && chosenBottom
          ? `${chosenTop.primaryColor} + ${chosenBottom.primaryColor} balanced neutral/accent pairing`
          : 'Harmonious palette',
      formalityBalance: `Aligned to ${dressCodeLabel}`,
      leatherMatch:
        chosenFootwear && chosenBelt
          ? `${chosenFootwear.primaryColor} footwear coordinated with ${chosenBelt.primaryColor} belt`
          : 'Coordinated accessories',
      climateFit: weatherContext || 'Adapted for local climate comfort',
    },
  };
}

// ============================================================================
// SWAP ITEM ENGINE: Suggests compatible alternatives from the user's wardrobe
// ============================================================================
export interface SwapAlternative {
  item: WardrobeItem;
  reason: string;
}

export function findCompatibleAlternativesForSlot(params: {
  slot: OutfitSlotKey;
  currentSlots: OutfitSlotsMap;
  wardrobe: WardrobeItem[];
  occasion: string;
  desiredStyle: string;
  weatherContext: string;
  userProfile?: UserProfile | null;
  feedbackList?: StyleFeedback[];
}): SwapAlternative[] {
  const {
    slot,
    currentSlots,
    wardrobe,
    occasion,
    desiredStyle,
    weatherContext,
    userProfile,
    feedbackList,
  } = params;

  const currentItem = currentSlots[slot];
  let candidates: WardrobeItem[] = [];

  switch (slot) {
    case 'top':
      candidates = wardrobe.filter(isTopItem);
      break;
    case 'bottom':
      candidates = wardrobe.filter(isBottomItem);
      break;
    case 'footwear':
      candidates = wardrobe.filter(isFootwearItem);
      break;
    case 'jacket':
      candidates = wardrobe.filter(isJacketItem);
      break;
    case 'belt':
      candidates = wardrobe.filter(isBeltItem);
      break;
    case 'watch':
      candidates = wardrobe.filter(isWatchItem);
      break;
    case 'accessory':
      candidates = wardrobe.filter(isExtraAccessoryItem);
      break;
  }

  const otherItems = Object.entries(currentSlots)
    .filter(([k, v]) => k !== slot && Boolean(v))
    .map(([, v]) => v as WardrobeItem);

  const scored = candidates
    .filter((item) => item.itemId !== currentItem?.itemId)
    .map((item) => {
      let score = scoreItemForContext(
        item,
        occasion,
        desiredStyle,
        weatherContext,
        userProfile,
        feedbackList
      );

      for (const other of otherItems) {
        score += colorHarmonyScore(item.primaryColor, other.primaryColor);
        if (isPatterned(item) && isPatterned(other)) {
          score -= 15;
        }
      }

      if (slot === 'footwear' && currentSlots.belt) {
        if (
          leatherToneGroup(item.primaryColor) ===
          leatherToneGroup(currentSlots.belt.primaryColor)
        ) {
          score += 15;
        }
      }
      if (slot === 'belt' && currentSlots.footwear) {
        if (
          leatherToneGroup(item.primaryColor) ===
          leatherToneGroup(currentSlots.footwear.primaryColor)
        ) {
          score += 15;
        }
      }

      let reason = `Maintains ${item.formality.toLowerCase()} harmony in ${item.primaryColor.toLowerCase()}.`;
      if (slot === 'footwear' && currentSlots.bottom) {
        reason = `Pairs cleanly with the ${currentSlots.bottom.primaryColor.toLowerCase()} ${currentSlots.bottom.subcategory.toLowerCase()} while keeping a ${item.formality.toLowerCase()} profile.`;
      } else if (slot === 'top' && currentSlots.bottom) {
        reason = `Complements the ${currentSlots.bottom.primaryColor.toLowerCase()} ${currentSlots.bottom.subcategory.toLowerCase()} with ${item.material || item.style} texture.`;
      } else if (slot === 'bottom' && currentSlots.top) {
        reason = `Grounds the ${currentSlots.top.primaryColor.toLowerCase()} ${currentSlots.top.subcategory.toLowerCase()} with a ${item.fit.toLowerCase()} cut.`;
      } else if (slot === 'belt' && currentSlots.footwear) {
        reason = `Coordinates with your ${currentSlots.footwear.primaryColor.toLowerCase()} ${currentSlots.footwear.subcategory.toLowerCase()}.`;
      }

      return { item, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item, reason }) => ({ item, reason }));
}

// ============================================================================
// FULL AI + FALLBACK STYLIST ORCHESTRATOR
// ============================================================================
export async function generateStylistOutfit(params: {
  wardrobe: WardrobeItem[];
  occasion: string;
  timeOfDay: string;
  locationContext: string;
  weatherContext: string;
  desiredStyle: string;
  userProfile?: UserProfile | null;
  feedbackList?: StyleFeedback[];
  excludeCombinationKeys?: string[];
  variationIndex?: number;
}): Promise<GeneratedOutfitResult> {
  const { wardrobe } = params;
  const itemMap = new Map<string, WardrobeItem>(wardrobe.map((i) => [i.itemId, i]));

  try {
    const response = await fetch('/api/style-me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userProfile: params.userProfile,
        wardrobe: params.wardrobe,
        occasion: params.occasion,
        timeOfDay: params.timeOfDay,
        locationContext: params.locationContext,
        weatherContext: params.weatherContext,
        desiredStyle: params.desiredStyle,
        previousFeedback: params.feedbackList,
        excludeCombinationKeys: params.excludeCombinationKeys,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const rec = data.recommendation;
      if (rec && rec.outfit) {
        const top = itemMap.get(rec.outfit.topId) || null;
        const bottom = itemMap.get(rec.outfit.bottomId) || null;
        const footwear = itemMap.get(rec.outfit.footwearId) || null;
        const jacket = itemMap.get(rec.outfit.jacketId) || null;
        const belt = itemMap.get(rec.outfit.beltId) || null;
        const watch = itemMap.get(rec.outfit.watchId) || null;
        const accessory = itemMap.get(rec.outfit.accessoryId) || null;

        // Verify at least primary pieces resolved from the user's actual wardrobe
        if (top || bottom || footwear) {
          const slots: OutfitSlotsMap = {
            top,
            bottom,
            footwear,
            jacket,
            belt,
            watch,
            accessory,
          };

          const resolvedIds = [
            top?.itemId,
            jacket?.itemId,
            bottom?.itemId,
            footwear?.itemId,
            belt?.itemId,
            watch?.itemId,
            accessory?.itemId,
          ].filter((id): id is string => Boolean(id));

          const computedMissing: string[] = Array.isArray(rec.missingItems)
            ? [...rec.missingItems]
            : [];
          if (!top && !computedMissing.some((m) => m.toLowerCase().includes('top'))) {
            computedMissing.push('Missing from wardrobe: Suitable Top / Shirt');
          }
          if (!bottom && !computedMissing.some((m) => m.toLowerCase().includes('bottom') || m.toLowerCase().includes('trouser'))) {
            computedMissing.push('Missing from wardrobe: Suitable Bottom / Trousers');
          }
          if (!footwear && !computedMissing.some((m) => m.toLowerCase().includes('shoe') || m.toLowerCase().includes('footwear'))) {
            computedMissing.push('Missing from wardrobe: Suitable Shoes');
          }

          return {
            title: rec.title || `${params.occasion} Ensemble`,
            occasion: rec.occasion || params.occasion,
            dressCode: rec.dressCode || params.desiredStyle || 'Smart Casual',
            timeOfDay: params.timeOfDay,
            locationContext: params.locationContext,
            weatherContext: params.weatherContext,
            desiredStyle: params.desiredStyle,
            slots,
            itemIds: resolvedIds,
            explanation:
              rec.reasoning ||
              buildHumanExplanation(
                slots,
                params.occasion,
                rec.dressCode || 'Smart Casual',
                params.weatherContext
              ),
            missingItems: computedMissing,
            source: 'gemini',
            compatibilityBreakdown: {
              colorHarmony:
                top && bottom
                  ? `${top.primaryColor} & ${bottom.primaryColor} tonal balance`
                  : 'Balanced palette',
              formalityBalance: `Matched to ${rec.dressCode || params.desiredStyle}`,
              leatherMatch:
                footwear && belt
                  ? `${footwear.primaryColor} shoes paired with ${belt.primaryColor} belt`
                  : 'Coordinated details',
              climateFit: params.weatherContext || 'Tailored for local conditions',
            },
          };
        }
      }
    }
  } catch {
    // Gracefully fall back to the deterministic Compatibility Engine
  }

  return generateRuleBasedOutfit(params);
}

// ============================================================================
// AI CLOTHING IMAGE ANALYZER WITH RULE-BASED FALLBACK
// ============================================================================
export async function analyzeGarmentImageWithAI(params: {
  imageBase64: string;
  mimeType: string;
  hintName?: string;
}): Promise<{ analysis: AIAnalysisResult; source: 'gemini' | 'fallback' }> {
  try {
    const res = await fetch('/api/analyze-clothing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.analysis) {
        return { analysis: data.analysis as AIAnalysisResult, source: 'gemini' };
      }
    }
  } catch {
    // Fall back to deterministic analysis below
  }

  const hint = (params.hintName || '').toLowerCase();
  let category: AIAnalysisResult['category'] = 'Tops';
  let subcategory = 'Shirt';
  let primaryColor = 'Navy';
  let formality: AIAnalysisResult['formality'] = 'Smart Casual';
  let style = 'Smart Casual';
  let pattern = 'Solid';
  let material = 'Cotton';

  if (hint.includes('shoe') || hint.includes('derby') || hint.includes('loafer') || hint.includes('sneaker') || hint.includes('oxford') || hint.includes('boot')) {
    category = 'Footwear';
    subcategory = hint.includes('sneaker')
      ? 'Sneakers'
      : hint.includes('loafer')
      ? 'Loafers'
      : hint.includes('oxford')
      ? 'Oxford shoes'
      : 'Derby shoes';
    primaryColor = hint.includes('black') ? 'Black' : 'Cognac Brown';
    material = 'Full-Grain Leather';
  } else if (hint.includes('trouser') || hint.includes('chino') || hint.includes('jean') || hint.includes('pant') || hint.includes('short')) {
    category = 'Bottoms';
    subcategory = hint.includes('jean')
      ? 'Jeans'
      : hint.includes('formal')
      ? 'Formal trousers'
      : 'Chinos';
    primaryColor = hint.includes('olive') ? 'Olive' : 'Sand Beige';
    material = 'Cotton Twill';
  } else if (hint.includes('kanzu') || hint.includes('kitenge') || hint.includes('dashiki')) {
    category = 'Traditional';
    subcategory = hint.includes('kanzu') ? 'Kanzu' : hint.includes('dashiki') ? 'Dashiki' : 'Kitenge';
    primaryColor = hint.includes('kanzu') ? 'Ivory' : 'Terracotta';
    pattern = hint.includes('kanzu') ? 'Embroidered' : 'Kitenge Geometric';
    formality = 'Traditional / Ceremonial';
    style = 'Contemporary Heritage';
  } else if (hint.includes('watch') || hint.includes('belt') || hint.includes('tie') || hint.includes('sunglass')) {
    category = 'Accessories';
    subcategory = hint.includes('belt') ? 'Belt' : hint.includes('tie') ? 'Tie' : 'Watch';
    primaryColor = 'Cognac Brown';
  }

  return {
    source: 'fallback',
    analysis: {
      name: params.hintName || `${primaryColor} ${subcategory}`,
      category,
      subcategory,
      primaryColor,
      secondaryColor: 'None',
      pattern,
      material,
      formality,
      style,
      season: 'All-Season',
      fit: 'Tailored',
      possibleMatchingColors: ['Ivory', 'Sand Beige', 'Olive', 'Navy'],
      suitableOccasions: ['Smart casual', 'Office', 'Date', 'Dinner', 'Wedding'],
      stylistTip: `Pairs well with neutral ${category === 'Footwear' ? 'trousers and a matching leather belt' : 'chinos and burnished leather footwear'}.`,
    },
  };
}

// ============================================================================
// CUSTOM OCCASION INTERPRETER WITH LOCAL NLP FALLBACK
// ============================================================================
export async function interpretOccasionWithAI(
  customText: string,
  locationCity: string
): Promise<{ interpretation: OccasionInterpretation; source: 'gemini' | 'fallback' }> {
  try {
    const res = await fetch('/api/interpret-occasion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customOccasionText: customText, locationCity }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.interpretation) {
        return { interpretation: data.interpretation, source: 'gemini' };
      }
    }
  } catch {
    // Use deterministic interpreter below
  }

  const lower = customText.toLowerCase();
  let occasion = 'Special event';
  if (lower.includes('wedding') || lower.includes('harusi') || lower.includes('nikah')) occasion = 'Wedding';
  else if (lower.includes('church') || lower.includes('sunday') || lower.includes('service')) occasion = 'Church';
  else if (lower.includes('interview')) occasion = 'Interview';
  else if (lower.includes('date') || lower.includes('anniversary')) occasion = 'Date';
  else if (lower.includes('dinner') || lower.includes('restaurant')) occasion = 'Dinner';
  else if (lower.includes('graduation') || lower.includes('mahafali')) occasion = 'Graduation';
  else if (lower.includes('meeting') || lower.includes('board') || lower.includes('office')) occasion = 'Business meeting';
  else if (lower.includes('funeral') || lower.includes('msiba')) occasion = 'Funeral';
  else if (lower.includes('birthday') || lower.includes('party')) occasion = 'Birthday';
  else if (lower.includes('college') || lower.includes('university') || lower.includes('lecture')) occasion = 'University/college';
  else if (lower.includes('travel') || lower.includes('flight') || lower.includes('safari')) occasion = 'Travel';

  let timeOfDay = 'Evening';
  if (lower.includes('morning') || lower.includes('am') || lower.includes('9') || lower.includes('10') || lower.includes('11')) {
    timeOfDay = 'Morning';
  } else if (lower.includes('afternoon') || lower.includes('2 pm') || lower.includes('3 pm') || lower.includes('4 pm') || lower.includes('4pm') || lower.includes('16:00')) {
    timeOfDay = 'Afternoon';
  } else if (lower.includes('night') || lower.includes('9 pm') || lower.includes('10 pm')) {
    timeOfDay = 'Night';
  }

  const { dressCodeLabel } = inferTargetFormalityForOccasion(occasion);
  const locationContext = lower.includes('outdoor') || lower.includes('garden') || lower.includes('beach')
    ? 'Outdoor / Garden Venue'
    : lower.includes('office') || lower.includes('boardroom')
    ? 'Corporate Office'
    : 'Reception / Restaurant Venue';

  const weatherContext = timeOfDay === 'Afternoon'
    ? 'Warm Afternoon (29°C — Breathable Fabrics)'
    : 'Warm & Breezy Evening (26°C)';

  const desiredStyle =
    occasion === 'Wedding' || occasion === 'Family ceremony'
      ? 'Minimalist Tailored'
      : occasion === 'Interview' || occasion === 'Business meeting'
      ? 'Executive Business'
      : 'Smart Casual';

  return {
    source: 'fallback',
    interpretation: {
      occasion,
      dressCode: dressCodeLabel,
      timeOfDay,
      locationContext,
      weatherContext,
      desiredStyle,
      summary: `Interpreted as a ${timeOfDay.toLowerCase()} ${occasion.toLowerCase()} calling for ${dressCodeLabel.toLowerCase()} attire suited to ${locationContext.toLowerCase()}.`,
    },
  };
}

// ============================================================================
// TRIP CAPSULE PACKING OPTIMIZER (RULE-BASED + GEMINI)
// ============================================================================
export function inferClimateFromDestination(destination: string): string {
  const d = (destination || '').toLowerCase();
  if (d.includes('zanzibar') || d.includes('dar') || d.includes('mombasa') || d.includes('coast') || d.includes('beach') || d.includes('tanga')) {
    return 'Warm & Humid Coastal (30°C)';
  }
  if (d.includes('arusha') || d.includes('kilimanjaro') || d.includes('nairobi') || d.includes('mbeya') || d.includes('iringa') || d.includes('lushoto')) {
    return 'Cool Highland & Breezy Evening (20°C)';
  }
  if (d.includes('serengeti') || d.includes('ngorongoro') || d.includes('mikumi') || d.includes('safari') || d.includes('dodoma')) {
    return 'Warm Dry Days & Cool Evenings (26°C)';
  }
  if (d.includes('london') || d.includes('paris') || d.includes('new york') || d.includes('europe')) {
    return 'Cool & Crisp Layered Climate (16°C)';
  }
  return 'Warm & Breezy (28°C)';
}

function buildDaySampleOutfits(
  durationDays: number,
  selectedItems: WardrobeItem[],
  tripVibe: string
): TripDaySampleOutfit[] {
  const tops = selectedItems.filter(isTopItem);
  const bottoms = selectedItems.filter(isBottomItem);
  const shoes = selectedItems.filter(isFootwearItem);
  const jackets = selectedItems.filter(isJacketItem);
  const belts = selectedItems.filter(isBeltItem);
  const watches = selectedItems.filter(isWatchItem);

  const maxPreviewDays = Math.min(durationDays, 7);
  const dayOutfits: TripDaySampleOutfit[] = [];

  const dayContexts = [
    'Arrival & Evening Dinner',
    'Daytime Exploration & Meetings',
    'Smart-Casual Social Outing',
    'Signature Occasion Look',
    'Relaxed City / Coastal Stroll',
    'Evening Lounge & Dining',
    'Departure Day Comfort',
  ];

  for (let d = 0; d < maxPreviewDays; d++) {
    const top = tops.length > 0 ? tops[d % tops.length] : undefined;
    const bottom = bottoms.length > 0 ? bottoms[d % bottoms.length] : undefined;
    const shoe = shoes.length > 0 ? shoes[d % shoes.length] : undefined;
    const jacket = jackets.length > 0 && (d === 0 || d === 3) ? jackets[0] : undefined;
    const belt = belts.length > 0 ? belts[0] : undefined;
    const watch = watches.length > 0 ? watches[0] : undefined;

    const ids = [
      top?.itemId,
      jacket?.itemId,
      bottom?.itemId,
      shoe?.itemId,
      belt?.itemId,
      watch?.itemId,
    ].filter((id): id is string => Boolean(id));

    dayOutfits.push({
      day: d + 1,
      label: `Day ${d + 1} · ${dayContexts[d % dayContexts.length]} (${tripVibe})`,
      itemIds: ids,
    });
  }

  return dayOutfits;
}

export function generateRuleBasedTripCapsule(params: {
  destination: string;
  durationDays: number;
  tripVibe: string;
  wardrobe: WardrobeItem[];
  userProfile?: UserProfile | null;
  feedbackList?: StyleFeedback[];
}): GeneratedTripCapsule {
  const days = Math.max(1, Math.min(30, Number(params.durationDays) || 4));
  const climate = inferClimateFromDestination(params.destination);
  const vibeLower = (params.tripVibe || '').toLowerCase();

  const targetOccasion = vibeLower.includes('business')
    ? 'Business meeting'
    : vibeLower.includes('wedding') || vibeLower.includes('ceremonial')
    ? 'Wedding'
    : vibeLower.includes('safari') || vibeLower.includes('outdoor')
    ? 'Travel'
    : 'Smart casual';

  const desiredStyle = vibeLower.includes('business')
    ? 'Executive Business'
    : vibeLower.includes('wedding')
    ? 'Contemporary Heritage'
    : 'Smart Casual';

  const rankPool = (pool: WardrobeItem[]) =>
    [...pool].sort((a, b) => {
      const scoreA =
        scoreItemForContext(a, targetOccasion, desiredStyle, climate, params.userProfile, params.feedbackList) +
        (NEUTRAL_COLORS.has(a.primaryColor.toLowerCase()) ? 6 : 0);
      const scoreB =
        scoreItemForContext(b, targetOccasion, desiredStyle, climate, params.userProfile, params.feedbackList) +
        (NEUTRAL_COLORS.has(b.primaryColor.toLowerCase()) ? 6 : 0);
      return scoreB - scoreA;
    });

  const topsPool = rankPool(params.wardrobe.filter(isTopItem));
  const bottomsPool = rankPool(params.wardrobe.filter(isBottomItem));
  const shoesPool = rankPool(params.wardrobe.filter(isFootwearItem));
  const jacketsPool = rankPool(params.wardrobe.filter(isJacketItem));
  const beltsPool = rankPool(params.wardrobe.filter(isBeltItem));
  const watchesPool = rankPool(params.wardrobe.filter(isWatchItem));
  const extraAccPool = rankPool(params.wardrobe.filter(isExtraAccessoryItem));

  const targetTopsCount = Math.min(topsPool.length, Math.max(2, Math.min(8, Math.ceil(days * 0.85))));
  const targetBottomsCount = Math.min(bottomsPool.length, Math.max(1, Math.min(4, Math.ceil(days * 0.5))));
  const targetShoesCount = Math.min(shoesPool.length, days >= 3 ? 2 : 1);
  const needsLayer =
    climate.toLowerCase().includes('cool') ||
    vibeLower.includes('business') ||
    vibeLower.includes('wedding') ||
    days >= 3;

  const selectedTops = topsPool.slice(0, targetTopsCount);
  const selectedBottoms = bottomsPool.slice(0, targetBottomsCount);
  const selectedShoes = shoesPool.slice(0, targetShoesCount);
  const selectedJackets = needsLayer && jacketsPool.length > 0 ? [jacketsPool[0]] : [];

  // Match belt to primary shoe leather group
  const primaryShoeGroup = selectedShoes[0]
    ? leatherToneGroup(selectedShoes[0].primaryColor)
    : 'brown';
  const matchedBelt =
    beltsPool.find((b) => leatherToneGroup(b.primaryColor) === primaryShoeGroup) ||
    beltsPool[0];

  const selectedWatches = watchesPool.length > 0 ? [watchesPool[0]] : [];
  const selectedExtras = extraAccPool.length > 0 ? [extraAccPool[0]] : [];

  const allSelected: WardrobeItem[] = [
    ...selectedTops,
    ...selectedBottoms,
    ...selectedShoes,
    ...selectedJackets,
    ...(matchedBelt ? [matchedBelt] : []),
    ...selectedWatches,
    ...selectedExtras,
  ];

  const itemIds = allSelected.map((i) => i.itemId);
  const missingSuggestions: string[] = [];
  if (selectedTops.length < 2) missingSuggestions.push('Missing from wardrobe: Additional versatile shirts/tops for multi-day rotation');
  if (selectedBottoms.length === 0) missingSuggestions.push('Missing from wardrobe: Versatile trousers or chinos');
  if (selectedShoes.length === 0) missingSuggestions.push('Missing from wardrobe: Travel-ready footwear');

  const combinationsCount = Math.max(
    1,
    selectedTops.length * Math.max(1, selectedBottoms.length) * Math.max(1, selectedJackets.length + 1)
  );

  const dayOutfits = buildDaySampleOutfits(days, allSelected, params.tripVibe);

  return {
    title: `${days}-Day ${params.destination} Capsule`,
    destination: params.destination,
    durationDays: days,
    climate,
    tripVibe: params.tripVibe,
    itemIds,
    rationale: `Curated ${allSelected.length} interchangeable pieces from your wardrobe for ${days} days in ${params.destination} (${climate}). Neutral bottoms (${selectedBottoms.map((b) => b.primaryColor).join(' & ') || 'tailored trousers'}) anchor ${selectedTops.length} tops and ${selectedShoes.length} pair${selectedShoes.length === 1 ? '' : 's'} of shoes, unlocking ${combinationsCount} harmonious outfit combinations without overpacking.`,
    outfitCombinationsCount: combinationsCount,
    missingSuggestions,
    dayOutfits,
    source: 'compatibility-engine',
  };
}

export async function generateTripCapsule(params: {
  destination: string;
  durationDays: number;
  tripVibe: string;
  wardrobe: WardrobeItem[];
  userProfile?: UserProfile | null;
  feedbackList?: StyleFeedback[];
}): Promise<GeneratedTripCapsule> {
  const itemMap = new Map<string, WardrobeItem>(params.wardrobe.map((i) => [i.itemId, i]));
  const days = Math.max(1, Math.min(30, Number(params.durationDays) || 4));

  try {
    const res = await fetch('/api/plan-trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: params.destination,
        durationDays: days,
        tripVibe: params.tripVibe,
        wardrobe: params.wardrobe,
        userProfile: params.userProfile,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const cap = data.tripCapsule;
      if (cap && Array.isArray(cap.itemIds)) {
        const validItems = Array.from(new Set<string>(cap.itemIds))
          .map((id) => itemMap.get(id))
          .filter((i): i is WardrobeItem => Boolean(i));

        if (validItems.length >= 3) {
          const dayOutfits = buildDaySampleOutfits(days, validItems, params.tripVibe);
          return {
            title: cap.title || `${days}-Day ${params.destination} Capsule`,
            destination: params.destination,
            durationDays: days,
            climate: cap.climate || inferClimateFromDestination(params.destination),
            tripVibe: params.tripVibe,
            itemIds: validItems.map((i) => i.itemId),
            rationale: cap.rationale || `Optimized ${validItems.length}-piece capsule for ${params.destination}.`,
            outfitCombinationsCount:
              typeof cap.outfitCombinationsCount === 'number' && cap.outfitCombinationsCount > 0
                ? cap.outfitCombinationsCount
                : Math.max(days, validItems.length),
            missingSuggestions: Array.isArray(cap.missingSuggestions) ? cap.missingSuggestions : [],
            dayOutfits,
            source: 'gemini',
          };
        }
      }
    }
  } catch {
    // Fall back to deterministic rule-based trip capsule engine
  }

  return generateRuleBasedTripCapsule(params);
}

