'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { getUnavailableProductIds } from '../lib/availability';
import { getDeliveryRates } from '../lib/delivery';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  accentColor: string;
  categorySlug: string;
  image: string | null;
  qty: number;
}

type AddInput = Omit<CartItem, 'qty'>;

type Action =
  | { type: 'hydrate'; items: CartItem[] }
  | { type: 'add'; item: AddInput }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

// Sanity ceiling, not a stock rule — no real order needs more, and it bounds
// what a stored cart can claim. Enforced in the reducer so every caller
// (steppers, add, hydration) inherits it.
const MAX_QTY = 99;

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'hydrate':
      return action.items;
    case 'add': {
      const existing = state.find((i) => i.id === action.item.id);
      if (existing) {
        return state.map((i) =>
          i.id === action.item.id ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY) } : i,
        );
      }
      return [...state, { ...action.item, qty: 1 }];
    }
    case 'setQty': {
      if (action.qty <= 0) return state.filter((i) => i.id !== action.id);
      return state.map((i) =>
        i.id === action.id ? { ...i, qty: Math.min(action.qty, MAX_QTY) } : i,
      );
    }
    case 'remove':
      return state.filter((i) => i.id !== action.id);
    case 'clear':
      return [];
    default:
      return state;
  }
}

const STORAGE_KEY = 'blg-cart';

// Persisted carts can be stale (old schema) or hand-edited; a malformed item
// would poison the totals with NaN. Drop structurally invalid items; an
// oversized qty is clamped on hydrate rather than destroying the line.
function isValidItem(v: unknown): v is CartItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    typeof o.name === 'string' &&
    typeof o.price === 'number' &&
    Number.isFinite(o.price) &&
    o.price >= 0 &&
    typeof o.accentColor === 'string' &&
    typeof o.categorySlug === 'string' &&
    (o.image === null || typeof o.image === 'string') &&
    typeof o.qty === 'number' &&
    Number.isInteger(o.qty) &&
    o.qty >= 1
  );
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  addItem: (item: AddInput) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  unavailableIds: Set<string>;
  refreshAvailability: () => Promise<void>;
  shippingEstimate: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [deliveryRates, setDeliveryRates] = useState<Record<string, number>>({});
  const availabilityRequest = useRef(0);
  const deliveryRatesFetched = useRef(false);

  // Load any persisted cart once on mount (client-only API).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const items = parsed
            .filter(isValidItem)
            .map((i) => ({ ...i, qty: Math.min(i.qty, MAX_QTY) }));
          dispatch({ type: 'hydrate', items });
        }
      }
    } catch {
      // Ignore malformed or unavailable storage.
    }
    setHydrated(true);
  }, []);

  // Persist on change, but only after the initial hydration pass so we
  // never overwrite saved data with the empty starting state.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota / private-mode write errors.
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: AddInput) => dispatch({ type: 'add', item }), []);
  const setQty = useCallback(
    (id: string, qty: number) => dispatch({ type: 'setQty', id, qty }),
    [],
  );
  const removeItem = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const refreshAvailability = useCallback(async () => {
    const ids = items.map((i) => i.id);
    const requestId = ++availabilityRequest.current;
    if (ids.length === 0) {
      setUnavailableIds(new Set());
      return;
    }
    try {
      const unavailable = await getUnavailableProductIds(ids);
      if (requestId === availabilityRequest.current) {
        setUnavailableIds(new Set(unavailable));
      }
    } catch {
      if (requestId === availabilityRequest.current) {
        setUnavailableIds(new Set());
      }
    }
  }, [items]);

  // Re-check availability whenever the cart opens (and when items change
  // while it is open). The localStorage snapshot may be stale. Also fetch
  // delivery rates once per session — guarded by a ref (not the state's
  // shape) because an empty-but-legitimate `{}` result (e.g. pre-migration
  // DB) is a new object reference every fetch, which would otherwise keep
  // re-triggering this effect forever via the `deliveryRates` dependency.
  useEffect(() => {
    if (!isOpen) return;
    void refreshAvailability();
    if (!deliveryRatesFetched.current) {
      deliveryRatesFetched.current = true;
      getDeliveryRates()
        .then(setDeliveryRates)
        .catch(() => {});
    }
  }, [isOpen, refreshAvailability]);

  const totalCount = items.reduce((n, i) => n + i.qty, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shippingEstimate = items.reduce(
    (max, i) => Math.max(max, deliveryRates[i.categorySlug] ?? 0),
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        totalCount,
        totalPrice,
        addItem,
        setQty,
        removeItem,
        clear,
        unavailableIds,
        refreshAvailability,
        shippingEstimate,
        isOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
