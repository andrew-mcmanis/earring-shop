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
  if (image) {
    return (
      <Image
        src={image}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    );
  }
  return <ProductIcon color={accentColor} category={category} className={iconClassName} />;
}
