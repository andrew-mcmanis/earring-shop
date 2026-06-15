'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface PhotoItem {
  /** Stable id for dnd: the URL for existing photos, `new-<n>` for new files. */
  id: string;
  kind: 'existing' | 'new';
  /** Existing public URL, or an object URL preview for a new file. */
  url: string;
  /** Present only when kind === 'new'. */
  file?: File;
}

interface SortablePhotoProps {
  item: PhotoItem;
  isMain: boolean;
  onRemove: (id: string) => void;
}

export function SortablePhoto({ item, isMain, onRemove }: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square overflow-hidden rounded-lg border border-cream-dark bg-cream touch-none"
    >
      {/* Whole tile is the drag handle (keyboard-draggable via dnd-kit). */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder photo"
        className="absolute inset-0 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt="" className="pointer-events-none h-full w-full object-cover" />
      </button>

      {isMain && (
        <span className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-ink/85 px-1.5 py-0.5 font-body text-[10px] font-medium text-cream">
          Main
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label="Remove photo"
        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink/85 text-xs text-cream hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-kraft"
      >
        ×
      </button>
    </div>
  );
}
