import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Heart,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  COMMON_COLORS,
  FORMALITY_OPTIONS,
  SUBCATEGORIES_BY_CATEGORY,
  WardrobeCategory,
  WardrobeItem,
} from '../types';
import { getColorSwatchHex } from '../utils/garmentVisuals';
import { GarmentImage } from './GarmentImage';

interface WardrobeViewProps {
  wardrobe: WardrobeItem[];
  onOpenAdd: () => void;
  onOpenEdit: (item: WardrobeItem) => void;
  onDeleteItem: (itemId: string) => Promise<void>;
  onToggleFavorite: (item: WardrobeItem) => Promise<void>;
  onStyleWithItem: (item: WardrobeItem) => void;
}

type CategoryFilter = 'All' | WardrobeCategory;
type SortOption = 'Recently Added' | 'Most Worn' | 'Alphabetical';

export const WardrobeView: React.FC<WardrobeViewProps> = ({
  wardrobe,
  onOpenAdd,
  onOpenEdit,
  onDeleteItem,
  onToggleFavorite,
  onStyleWithItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('All');
  const [selectedColor, setSelectedColor] = useState<string>('All');
  const [selectedFormality, setSelectedFormality] = useState<string>('All');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('Recently Added');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const availableSubcategories = useMemo(() => {
    if (selectedCategory === 'All') {
      return Array.from(new Set(Object.values(SUBCATEGORIES_BY_CATEGORY).flat()));
    }
    return SUBCATEGORIES_BY_CATEGORY[selectedCategory] || [];
  }, [selectedCategory]);

  const filteredItems = useMemo(() => {
    return wardrobe
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        if (selectedSubcategory !== 'All' && item.subcategory !== selectedSubcategory) return false;
        if (
          selectedColor !== 'All' &&
          item.primaryColor.toLowerCase() !== selectedColor.toLowerCase()
        ) {
          return false;
        }
        if (selectedFormality !== 'All' && item.formality !== selectedFormality) return false;
        if (onlyFavorites && !item.isFavorite) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.name.toLowerCase().includes(q);
          const matchSub = item.subcategory.toLowerCase().includes(q);
          const matchColor = item.primaryColor.toLowerCase().includes(q);
          const matchBrand = (item.brand || '').toLowerCase().includes(q);
          const matchMat = (item.material || '').toLowerCase().includes(q);
          if (!matchName && !matchSub && !matchColor && !matchBrand && !matchMat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'Most Worn') {
          if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'Alphabetical') {
          return a.name.localeCompare(b.name);
        }
        // 'Recently Added'
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [
    wardrobe,
    selectedCategory,
    selectedSubcategory,
    selectedColor,
    selectedFormality,
    onlyFavorites,
    searchQuery,
    sortBy,
  ]);

  const categories: CategoryFilter[] = [
    'All',
    'Tops',
    'Bottoms',
    'Footwear',
    'Accessories',
    'Traditional',
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Personal Archive · <span className="font-mono-num">{wardrobe.length}</span> Pieces
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-900 dark:text-stone-100 mt-1">
            Digital Wardrobe
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 min-h-[44px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <label
              htmlFor="wardrobe-sort-dropdown"
              className="text-xs text-stone-500 dark:text-stone-400 whitespace-nowrap"
            >
              Sort by:
            </label>
            <select
              id="wardrobe-sort-dropdown"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort wardrobe items"
              className="bg-transparent text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer pr-1"
            >
              <option value="Recently Added">Recently Added</option>
              <option value="Most Worn">Most Worn</option>
              <option value="Alphabetical">Alphabetical</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onOpenAdd}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Clothing Item</span>
          </button>
        </div>
      </div>

      {/* Interactive Category Segmented Filter Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 p-1.5 bg-stone-200/70 dark:bg-stone-900 rounded-xl overflow-x-auto">
          {categories.map((cat) => {
            const count =
              cat === 'All'
                ? wardrobe.length
                : wardrobe.filter((i) => i.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedSubcategory('All');
                }}
                className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <span>{cat}</span>
                <span className="font-mono-num text-[11px] text-stone-400 dark:text-stone-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shirt, Kitenge, linen, derby..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          <select
            value={selectedSubcategory}
            onChange={(e) => setSelectedSubcategory(e.target.value)}
            aria-label="Filter by subcategory"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-200"
          >
            <option value="All">All Types</option>
            {availableSubcategories.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            aria-label="Filter by color"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-200"
          >
            <option value="All">All Colors</option>
            {COMMON_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedFormality}
            onChange={(e) => setSelectedFormality(e.target.value)}
            aria-label="Filter by formality"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-200"
          >
            <option value="All">All Formality Levels</option>
            {FORMALITY_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-label="Toggle favorites filter"
            className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-colors ${
              onlyFavorites
                ? 'bg-rose-700 border-rose-700 text-white'
                : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300'
            }`}
          >
            <Heart className={`w-4 h-4 ${onlyFavorites ? 'fill-current' : ''}`} />
            <span>Favorites Only</span>
          </button>
        </div>
      </div>

      {/* Wardrobe Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 text-center space-y-4">
          <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
            No matching pieces found
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            Try clearing your search filters or add a new garment to your digital wardrobe.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSelectedSubcategory('All');
                setSelectedColor('All');
                setSelectedFormality('All');
                setOnlyFavorites(false);
                setSearchQuery('');
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={onOpenAdd}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium"
            >
              Add Clothing Item
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.itemId}
              className="group rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div>
                {/* Image Container (70% height dominance) */}
                <div className="aspect-3/4 w-full bg-[#F9F9F8] dark:bg-stone-950 relative overflow-hidden">
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

                  {/* Favorite Hitbox (44x44px touch target) */}
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item)}
                    aria-label={item.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                    className="absolute top-2 right-2 min-h-[44px] min-w-[44px] rounded-full bg-white/85 dark:bg-stone-900/85 backdrop-blur-xs flex items-center justify-center text-stone-700 dark:text-stone-200 hover:scale-105 transition-transform"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        item.isFavorite ? 'fill-rose-600 text-rose-600' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Unboxed Clean Typography Metadata (Zero-Pill Compliance) */}
                <div className="p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                    <span>{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.subcategory}</span>
                    {item.brand && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{item.brand}</span>
                      </>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100 line-clamp-1">
                    {item.name}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 pt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-stone-300 dark:border-stone-600 shrink-0"
                      style={{ backgroundColor: getColorSwatchHex(item.primaryColor) }}
                    />
                    <span>{item.primaryColor}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.formality}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{item.usageCount}×</span>
                  </div>
                </div>
              </div>

              {/* Action Row */}
              <div className="px-4 pb-4 pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onStyleWithItem(item)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#F2EFE9] dark:bg-stone-800 text-xs font-medium text-stone-900 dark:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#8C5A32] dark:text-[#D4A373]" />
                  <span>Style Piece</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onOpenEdit(item)}
                    aria-label={`Edit ${item.name}`}
                    className="min-h-[40px] min-w-[40px] rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {confirmDeleteId === item.itemId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteItem(item.itemId);
                        setConfirmDeleteId(null);
                      }}
                      className="min-h-[40px] px-2.5 rounded-lg bg-red-600 text-white text-xs font-medium whitespace-nowrap"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.itemId)}
                      aria-label={`Delete ${item.name}`}
                      className="min-h-[40px] min-w-[40px] rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
