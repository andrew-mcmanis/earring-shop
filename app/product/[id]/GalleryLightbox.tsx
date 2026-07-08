'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface GalleryLightboxProps {
  images: string[];
  alt: string;
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

// Full-screen photo viewer over a deep-ink backdrop. Rendered through a portal
// (z-[100], above the header and cart drawer). Esc closes, arrows navigate,
// focus stays trapped inside; the opener restores focus on close.
export function GalleryLightbox({ images, alt, index, onIndexChange, onClose }: GalleryLightboxProps) {
  const count = images.length;
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  function step(delta: number) {
    onIndexChange(((index + delta) % count + count) % count);
  }

  // Lock page scroll while open and move focus into the dialog.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Don't let the same keypress reach the cart drawer's document-level
      // Escape listener — one press closes one layer.
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
      return;
    }
    if (e.key === 'Tab') {
      // Keep focus cycling inside the dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || count < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  }

  const controlClass =
    'cursor-pointer flex items-center justify-center rounded bg-cream/10 border border-cream/30 text-cream hover:bg-cream/20 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft';

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${alt}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        // Tap/click anywhere that isn't a control (arrows, close, thumbnails)
        // dismisses the viewer — one rule for photo, gutters and top bar.
        if (!(e.target as HTMLElement).closest('button, ul')) onClose();
      }}
      className="fixed inset-0 z-[110] bg-ink/95 flex flex-col focus:outline-none"
      style={{ animation: 'blg-fade 0.2s ease-out both' }}
    >
      {/* Top bar: counter + close */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-body text-sm text-cream/75 tabular-nums" aria-live="polite">
          {count > 1 ? `${index + 1} / ${count}` : ''}
        </span>
        <button type="button" onClick={onClose} aria-label="Close photo viewer" className={`${controlClass} h-10 w-10 text-xl leading-none`}>
          ×
        </button>
      </div>

      {/* Photo area — swipe to navigate; clicks fall through to the dialog's
          tap-to-dismiss handler above */}
      <div
        className="relative flex-1 min-h-0 mx-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={images[index]}
          alt={`${alt} — photo ${index + 1} of ${count}`}
          fill
          sizes="100vw"
          className="object-contain pointer-events-none"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className={`${controlClass} absolute left-0 top-1/2 -translate-y-1/2 h-11 w-11 text-2xl`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className={`${controlClass} absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 text-2xl`}
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {count > 1 && (
        <ul className="flex justify-center gap-2 px-4 py-4 list-none m-0 overflow-x-auto">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="flex-shrink-0">
              <button
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
                className={`relative block h-14 w-14 overflow-hidden rounded border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft ${
                  i === index ? 'border-kraft ring-1 ring-kraft' : 'border-cream/30 hover:border-kraft-light'
                }`}
              >
                <Image src={src} alt="" fill sizes="56px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
