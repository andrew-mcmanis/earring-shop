'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';

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

function reducer(state: CartItem[], action: Action): CartItem[] {
  switch (action.type) {
    case 'hydrate':
      return action.items;
    case 'add': {
      const existing = state.find((i) => i.id === action.item.id);
      if (existing) {
        return state.map((i) =>
          i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...state, { ...action.item, qty: 1 }];
    }
    case 'setQty': {
      if (action.qty <= 0) return state.filter((i) => i.id !== action.id);
      return state.map((i) => (i.id === action.id ? { ...i, qty: action.qty } : i));
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

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  addItem: (item: AddInput) => void;
  setQty: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load any persisted cart once on mount (client-only API).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) dispatch({ type: 'hydrate', items: parsed });
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

  const totalCount = items.reduce((n, i) => n + i.qty, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.qty, 0);

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
