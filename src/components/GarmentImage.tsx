import React, { useMemo, useState } from 'react';
import { WardrobeCategory } from '../types';
import { getGarmentStudioSvgDataUrl } from '../utils/garmentVisuals';

interface GarmentImageProps {
  imageUrl?: string;
  name: string;
  category: WardrobeCategory;
  subcategory: string;
  primaryColor: string;
  secondaryColor?: string;
  pattern?: string;
  className?: string;
}

export const GarmentImage: React.FC<GarmentImageProps> = ({
  imageUrl,
  name,
  category,
  subcategory,
  primaryColor,
  secondaryColor,
  pattern,
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);

  const fallbackSvgUrl = useMemo(
    () =>
      getGarmentStudioSvgDataUrl({
        category,
        subcategory,
        primaryColor,
        secondaryColor,
        pattern,
        name,
      }),
    [category, subcategory, primaryColor, secondaryColor, pattern, name]
  );

  const effectiveSrc =
    !imageUrl || imageUrl === 'studio://default' || hasError ? fallbackSvgUrl : imageUrl;

  return (
    <img
      src={effectiveSrc}
      alt={`${name} — ${primaryColor} ${subcategory}`}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!hasError) setHasError(true);
      }}
      className={className}
      loading="lazy"
    />
  );
};
