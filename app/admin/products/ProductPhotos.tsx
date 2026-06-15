'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { MAX_PRODUCT_PHOTOS, MAX_PHOTO_BYTES } from '../../data/types';
import { SortablePhoto, type PhotoItem } from './SortablePhoto';

interface ProductPhotosProps {
  initialUrls: string[];
  /** Called whenever the ordered photo list changes, so the form can submit it. */
  onChange: (items: PhotoItem[]) => void;
}

let newCounter = 0;

export function ProductPhotos({ initialUrls, onChange }: ProductPhotosProps) {
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initialUrls.map((url) => ({ id: url, kind: 'existing' as const, url })),
  );
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // NOTE: `onChange` must be referentially stable (the parent wraps it in
  // useCallback) — it's a dependency of this effect, so an unstable reference
  // would make it re-run on every render.
  useEffect(() => {
    onChange(items);
  }, [items, onChange]);

  // Keep the latest items in a ref so the unmount cleanup can revoke object URLs
  // for files added after mount (the cleanup effect below has empty deps).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Revoke object URLs when the component unmounts.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        if (it.kind === 'new') URL.revokeObjectURL(it.url);
      });
    };
  }, []);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.id === active.id);
      const to = prev.findIndex((i) => i.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const room = MAX_PRODUCT_PHOTOS - items.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_PRODUCT_PHOTOS} photos.`);
      return;
    }
    const chosen = Array.from(fileList).slice(0, room);
    const rejected: string[] = [];
    const tooBig: string[] = [];
    const next: PhotoItem[] = [];
    for (const file of chosen) {
      if (!file.type.startsWith('image/')) {
        rejected.push(file.name);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        tooBig.push(file.name);
        continue;
      }
      next.push({ id: `new-${newCounter++}`, kind: 'new', url: URL.createObjectURL(file), file });
    }
    if (fileList.length > room) {
      setError(`Only ${MAX_PRODUCT_PHOTOS} photos allowed — extra files were skipped.`);
    } else if (tooBig.length) {
      setError(`Photo(s) over 8MB were skipped: ${tooBig.join(', ')}.`);
    } else if (rejected.length) {
      setError(`Skipped non-image file(s): ${rejected.join(', ')}.`);
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.kind === 'new') URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
    setError(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-sm font-medium text-ink">Photos</span>
      <p className="font-body text-xs text-ink-light">
        The first photo is the main one shown in the shop. Drag to reorder. Up to{' '}
        {MAX_PRODUCT_PHOTOS}.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item, i) => (
              <SortablePhoto key={item.id} item={item} isMain={i === 0} onRemove={removeItem} />
            ))}

            {items.length < MAX_PRODUCT_PHOTOS && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-kraft bg-kraft/5 text-kraft-dark transition-colors hover:bg-kraft/10">
                <span className="text-2xl leading-none">+</span>
                <span className="font-body text-xs font-medium">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {error && (
        <p className="font-body text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
