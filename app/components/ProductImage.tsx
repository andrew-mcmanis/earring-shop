'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ProductIcon } from './ProductIcon';

interface ProductImageProps {
  image: string | null;
  accentColor: string;
  category?: string;
  alt: string;
  /** next/image `sizes` hint for responsive loading. */
  sizes?: string;
  /** Placeholder icon size when there's no photo. */
  iconClassName?: string;
  /** Eager-load + preload — set on above-the-fold LCP images. */
  priority?: boolean;
}

// Renders a real product photo (filling its relative parent) when one exists,
// otherwise the category-aware placeholder. Parent must be `relative` with a
// defined size and `overflow-hidden`.
export function ProductImage({
  image,
  accentColor,
  category,
  alt,
  sizes = '100vw',
  iconClassName,
  priority = false,
}: ProductImageProps) {
  // A photo that fails to load falls back to the same placeholder used when a
  // product has no photo at all. Without this the browser draws its broken-file
  // icon, which is what shoppers saw when image delivery broke — a shop full of
  // broken icons reads as "this site is broken", where the placeholder reads as
  // "no photo yet". Tracking the failed src (rather than a boolean) means the
  // gallery recovers when it moves to a different photo.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (image && failedSrc !== image) {
    return (
      <Image
        src={image}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        onError={() => setFailedSrc(image)}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    );
  }
  return <ProductIcon color={accentColor} category={category} className={iconClassName} />;
}
