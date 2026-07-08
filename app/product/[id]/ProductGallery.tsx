'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ProductImage } from '../../components/ProductImage';
import { GalleryLightbox } from './GalleryLightbox';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  accentColor: string;
  category?: string;
}

// Main photo plus a thumbnail strip (shown only when there's more than one
// photo). Clicking/keying a thumbnail or swiping the main photo changes the
// selection. Falls back to a single image, and then the placeholder, exactly
// like the old single-image layout.
export function ProductGallery({ images, alt, accentColor, category }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const zoomBtnRef = useRef<HTMLButtonElement>(null);

  const count = images.length;
  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const current = count > 0 ? images[safeIndex] : null;

  function select(next: number) {
    if (count === 0) return;
    setIndex(((next % count) + count) % count);
  }

  function onThumbKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (i + 1) % count : (i - 1 + count) % count;
    select(next);
    thumbRefs.current[next]?.focus();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) select(safeIndex + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  }

  return (
    <div className="w-full lg:w-1/2 flex-shrink-0 flex flex-col gap-3">
      <div
        className="relative overflow-hidden aspect-square w-full rounded-lg border border-cream-dark flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}12` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {count > 0 ? (
          <button
            type="button"
            ref={zoomBtnRef}
            onClick={() => setLightboxOpen(true)}
            aria-label="View photo full screen"
            className="relative block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-inset"
          >
            <ProductImage
              image={current}
              accentColor={accentColor}
              category={category}
              alt={count > 1 ? `${alt} — photo ${safeIndex + 1} of ${count}` : alt}
              sizes="(max-width: 1024px) 100vw, 50vw"
              iconClassName="w-40 h-60"
              priority
            />
          </button>
        ) : (
          <ProductImage
            image={current}
            accentColor={accentColor}
            category={category}
            alt={alt}
            sizes="(max-width: 1024px) 100vw, 50vw"
            iconClassName="w-40 h-60"
            priority
          />
        )}
      </div>

      {count > 1 && (
        <ul className="grid grid-cols-5 gap-2 list-none p-0 m-0">
          {images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                onClick={() => select(i)}
                onKeyDown={(e) => onThumbKey(e, i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === safeIndex ? 'true' : undefined}
                className={`relative block aspect-square w-full overflow-hidden rounded border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft focus-visible:ring-offset-1 ${
                  i === safeIndex
                    ? 'border-kraft ring-1 ring-kraft'
                    : 'border-cream-dark hover:border-kraft-light'
                }`}
                style={{ backgroundColor: `${accentColor}12` }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 20vw, 96px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lightboxOpen && count > 0 && (
        <GalleryLightbox
          images={images}
          alt={alt}
          index={safeIndex}
          onIndexChange={select}
          onClose={() => {
            setLightboxOpen(false);
            zoomBtnRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
