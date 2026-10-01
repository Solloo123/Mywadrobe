import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  AIAnalysisResult,
  ALL_OCCASIONS,
  COMMON_COLORS,
  FIT_OPTIONS,
  FitType,
  FORMALITY_OPTIONS,
  FormalityLevel,
  SEASON_OPTIONS,
  SeasonType,
  STYLE_OPTIONS,
  SUBCATEGORIES_BY_CATEGORY,
  WardrobeCategory,
  WardrobeItem,
} from '../types';
import { analyzeGarmentImageWithAI } from '../services/compatibilityEngine';
import { compressImageFile, getGarmentStudioSvgDataUrl } from '../utils/garmentVisuals';
import { GarmentImage } from './GarmentImage';

interface AddEditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: Partial<WardrobeItem>) => Promise<void>;
  initialItem?: WardrobeItem | null;
}

export const AddEditItemModal: React.FC<AddEditItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<WardrobeCategory>('Tops');
  const [subcategory, setSubcategory] = useState('Shirt');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedMimeType, setUploadedMimeType] = useState('image/jpeg');
  const [primaryColor, setPrimaryColor] = useState('Navy');
  const [secondaryColor, setSecondaryColor] = useState('None');
  const [pattern, setPattern] = useState('Solid');
  const [material, setMaterial] = useState('Cotton');
  const [formality, setFormality] = useState<FormalityLevel>('Smart Casual');
  const [style, setStyle] = useState('Smart Casual');
  const [season, setSeason] = useState<SeasonType>('All-Season');
  const [brand, setBrand] = useState('');
  const [fit, setFit] = useState<FitType>('Tailored');
  const [occasions, setOccasions] = useState<string[]>(['Smart casual', 'Office']);
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);

  // AI Clothing Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiSource, setAiSource] = useState<'gemini' | 'fallback' | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialItem) {
      setName(initialItem.name);
      setCategory(initialItem.category);
      setSubcategory(initialItem.subcategory);
      setImageUrl(initialItem.imageUrl);
      setPrimaryColor(initialItem.primaryColor);
      setSecondaryColor(initialItem.secondaryColor || 'None');
      setPattern(initialItem.pattern || 'Solid');
      setMaterial(initialItem.material || 'Cotton');
      setFormality(initialItem.formality);
      setStyle(initialItem.style || 'Smart Casual');
      setSeason(initialItem.season || 'All-Season');
      setBrand(initialItem.brand || '');
      setFit(initialItem.fit || 'Tailored');
      setOccasions(initialItem.occasions || ['Smart casual']);
      setNotes(initialItem.notes || '');
      setIsFavorite(initialItem.isFavorite || false);
      setAiResult(null);
      setAiApplied(false);
    } else {
      setName('');
      setCategory('Tops');
      setSubcategory('Shirt');
      setImageUrl('');
      setPrimaryColor('Ivory');
      setSecondaryColor('None');
      setPattern('Solid');
      setMaterial('Linen');
      setFormality('Smart Casual');
      setStyle('Smart Casual');
      setSeason('All-Season');
      setBrand('');
      setFit('Tailored');
      setOccasions(['Smart casual', 'Date']);
      setNotes('');
      setIsFavorite(false);
      setAiResult(null);
      setAiApplied(false);
    }
    setErrorMsg(null);
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: WardrobeCategory) => {
    setCategory(newCat);
    const validSubs = SUBCATEGORIES_BY_CATEGORY[newCat];
    if (validSubs && !validSubs.includes(subcategory)) {
      setSubcategory(validSubs[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const { dataUrl, mimeType } = await compressImageFile(file);
      setImageUrl(dataUrl);
      setUploadedMimeType(mimeType);
      // Automatically run AI analysis on the newly uploaded image, but DO NOT overwrite fields without user confirmation!
      await triggerAiAnalysis(dataUrl, mimeType, name || file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not process image file.');
    }
  };

  const triggerAiAnalysis = async (
    imgData = imageUrl,
    mime = uploadedMimeType,
    hint = name
  ) => {
    setIsAnalyzing(true);
    setAiApplied(false);
    setErrorMsg(null);
    try {
      const effectiveImage =
        imgData ||
        getGarmentStudioSvgDataUrl({
          category,
          subcategory,
          primaryColor,
          secondaryColor,
          pattern,
          name: hint || `${primaryColor} ${subcategory}`,
        });
      const { analysis, source } = await analyzeGarmentImageWithAI({
        imageBase64: effectiveImage,
        mimeType: mime,
        hintName: hint || `${primaryColor} ${subcategory}`,
      });
      setAiResult(analysis);
      setAiSource(source);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI analysis encountered an error.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmApplyAiAnalysis = () => {
    if (!aiResult) return;
    setName(aiResult.name || name);
    setCategory(aiResult.category);
    setSubcategory(aiResult.subcategory);
    setPrimaryColor(aiResult.primaryColor);
    setSecondaryColor(aiResult.secondaryColor || 'None');
    setPattern(aiResult.pattern || 'Solid');
    setMaterial(aiResult.material || material);
    setFormality(aiResult.formality);
    setStyle(aiResult.style || style);
    setSeason(aiResult.season || season);
    setFit(aiResult.fit || fit);
    if (Array.isArray(aiResult.suitableOccasions) && aiResult.suitableOccasions.length > 0) {
      setOccasions(aiResult.suitableOccasions.slice(0, 10));
    }
    if (aiResult.stylistTip && !notes) {
      setNotes(aiResult.stylistTip);
    }
    setAiApplied(true);
  };

  const toggleOccasion = (occ: string) => {
    setOccasions((prev) =>
      prev.includes(occ) ? prev.filter((o) => o !== occ) : [...prev, occ].slice(0, 15)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const finalImageUrl =
        imageUrl && !imageUrl.startsWith('data:image/svg+xml')
          ? imageUrl
          : getGarmentStudioSvgDataUrl({
              category,
              subcategory,
              primaryColor,
              secondaryColor,
              pattern,
              name: name || `${primaryColor} ${subcategory}`,
            });

      await onSave({
        itemId: initialItem?.itemId,
        name: name.trim() || `${primaryColor} ${subcategory}`,
        category,
        subcategory,
        imageUrl: finalImageUrl,
        primaryColor,
        secondaryColor,
        pattern,
        material,
        formality,
        style,
        season,
        brand,
        fit,
        occasions: occasions.length > 0 ? occasions : ['Smart casual'],
        notes,
        isFavorite,
        usageCount: initialItem?.usageCount ?? 0,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-2xl bg-[#FAF8F5] dark:bg-[#181615] border border-stone-200 dark:border-stone-800 shadow-2xl">
        {/* Sticky Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#FAF8F5]/95 dark:bg-[#181615]/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800">
          <div>
            <h2 className="text-2xl font-display font-semibold text-stone-900 dark:text-stone-100">
              {initialItem ? 'Edit Wardrobe Piece' : 'Add to Digital Wardrobe'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Upload a photo for AI garment extraction or customize studio details
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Photo & AI Clothing Analysis Section */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
            <div className="sm:col-span-5">
              <div className="aspect-3/4 w-full rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 relative">
                <GarmentImage
                  imageUrl={
                    imageUrl && !imageUrl.startsWith('data:image/svg+xml') ? imageUrl : undefined
                  }
                  name={name || `${primaryColor} ${subcategory}`}
                  category={category}
                  subcategory={subcategory}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  pattern={pattern}
                  className="w-full h-full object-cover"
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerAiAnalysis()}
                  disabled={isAnalyzing}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#8C5A32] hover:bg-[#734825] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isAnalyzing ? 'Analyzing...' : 'AI Analyze'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: AI Clothing Analysis Preview OR Core Fields */}
            <div className="sm:col-span-7 space-y-4">
              {aiResult && (
                <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-[#8C5A32]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8C5A32] dark:text-[#D4A373]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        AI Clothing Analysis{' '}
                        {aiSource === 'gemini' ? '(Gemini Vision)' : '(Smart Classifier)'}
                      </span>
                    </div>
                    {aiApplied && (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Applied
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-stone-700 dark:text-stone-300 space-y-1.5">
                    <p>
                      <span className="text-stone-500">Category:</span>{' '}
                      <strong className="font-medium">{aiResult.category}</strong> ·{' '}
                      <span className="text-stone-500">Type:</span>{' '}
                      <strong className="font-medium">{aiResult.subcategory}</strong>
                    </p>
                    <p>
                      <span className="text-stone-500">Color:</span>{' '}
                      <strong className="font-medium">{aiResult.primaryColor}</strong>
                      {aiResult.secondaryColor && aiResult.secondaryColor !== 'None'
                        ? ` / ${aiResult.secondaryColor}`
                        : ''}{' '}
                      · <span className="text-stone-500">Pattern:</span>{' '}
                      <strong className="font-medium">{aiResult.pattern}</strong>
                    </p>
                    <p>
                      <span className="text-stone-500">Style:</span>{' '}
                      <strong className="font-medium">
                        {aiResult.style} ({aiResult.formality})
                      </strong>
                    </p>
                    {aiResult.possibleMatchingColors?.length > 0 && (
                      <p>
                        <span className="text-stone-500">Matching colors:</span>{' '}
                        {aiResult.possibleMatchingColors.join(' · ')}
                      </p>
                    )}
                    {aiResult.suitableOccasions?.length > 0 && (
                      <p>
                        <span className="text-stone-500">Suitable occasions:</span>{' '}
                        {aiResult.suitableOccasions.join(' · ')}
                      </p>
                    )}
                    {aiResult.stylistTip && (
                      <p className="italic text-stone-500 dark:text-stone-400 pt-1">
                        “{aiResult.stylistTip}”
                      </p>
                    )}
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={confirmApplyAiAnalysis}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      {aiApplied ? 'Re-apply AI Details' : 'Confirm & Apply AI Details'}
                    </button>
                    <span className="text-[11px] text-stone-500">
                      You can review and adjust any field below.
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  Item Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Burnished Cognac Leather Derby Shoes"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8C5A32]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as WardrobeCategory)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                  >
                    {(Object.keys(SUBCATEGORIES_BY_CATEGORY) as WardrobeCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Subcategory
                  </label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                  >
                    {SUBCATEGORIES_BY_CATEGORY[category].map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Primary Color
                  </label>
                  <select
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                  >
                    {COMMON_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                    Secondary Color
                  </label>
                  <select
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100"
                  >
                    <option value="None">None (Solid)</option>
                    {COMMON_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Attributes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-200/70 dark:border-stone-800">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Pattern
              </label>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              >
                {[
                  'Solid',
                  'Striped',
                  'Kitenge Geometric',
                  'Checked',
                  'Embroidered',
                  'Textured',
                ].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Formality Level
              </label>
              <select
                value={formality}
                onChange={(e) => setFormality(e.target.value as FormalityLevel)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              >
                {FORMALITY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Material
              </label>
              <input
                type="text"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="e.g., Linen, Cotton, Leather"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Season / Climate
              </label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value as SeasonType)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              >
                {SEASON_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Fit
              </label>
              <select
                value={fit}
                onChange={(e) => setFit(e.target.value as FitType)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              >
                {FIT_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Brand / Tailor (Optional)
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Bongo Bespoke, Suitsupply"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Styling Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Personal fit or pairing note"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
          </div>

          {/* Suitable Occasions Selector (Interactive Buttons) */}
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">
              Suitable Occasions (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_OCCASIONS.map((occ) => {
                const selected = occasions.includes(occ);
                return (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => toggleOccasion(occ)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      selected
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                        : 'bg-stone-200/70 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 hover:bg-stone-300/70 dark:hover:bg-stone-700'
                    }`}
                  >
                    {occ}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-800">
            <label className="flex items-center gap-2.5 text-sm text-stone-700 dark:text-stone-300 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
                className="w-4 h-4 accent-[#8C5A32] rounded"
              />
              <span>Mark as Wardrobe Favorite</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] px-6 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : initialItem ? 'Update Item' : 'Save to Wardrobe'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
