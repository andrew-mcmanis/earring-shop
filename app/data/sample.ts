// In-repo sample catalogue used until the Supabase database is live.
// Shapes match app/data/types.ts and supabase/schema.sql exactly, so the
// data-access layer (app/data/products.ts) can swap this for real DB queries
// without any component changes.

import type { Category, Subcategory, Colour, Product } from './types';

export const sampleCategories: Category[] = [
  { slug: 'earrings', name: 'Earrings', sortOrder: 1 },
  { slug: 'bookmarks', name: 'Bookmarks', sortOrder: 2 },
  { slug: 'gifts', name: 'Gifts', sortOrder: 3 },
];

export const sampleSubcategories: Subcategory[] = [
  { slug: 'dangles', name: 'Dangles', categorySlug: 'earrings', sortOrder: 1 },
  { slug: 'hoops', name: 'Hoops', categorySlug: 'earrings', sortOrder: 2 },
  { slug: 'studs', name: 'Studs', categorySlug: 'earrings', sortOrder: 3 },
];

export const sampleColours: Colour[] = [
  { slug: 'gold', name: 'Gold', hex: '#D4A853' },
  { slug: 'silver', name: 'Silver', hex: '#A8A8A8' },
  { slug: 'rose-gold', name: 'Rose Gold', hex: '#C49A6C' },
  { slug: 'black', name: 'Black', hex: '#3C3C3C' },
  { slug: 'white', name: 'White', hex: '#E8DDD0' },
  { slug: 'blue', name: 'Blue', hex: '#2E6DA4' },
  { slug: 'green', name: 'Green', hex: '#27AE60' },
  { slug: 'red', name: 'Red', hex: '#C0392B' },
  { slug: 'purple', name: 'Purple', hex: '#9B59B6' },
  { slug: 'multicolour', name: 'Multicolour', hex: '' },
];

export const sampleProducts: Product[] = [
  // — Earrings —
  { id: '1', name: 'Classic Gold Hoops', price: 28, categorySlug: 'earrings', subcategorySlug: 'hoops', colourSlug: 'gold', description: 'Simple and elegant 14K gold-filled hoops, perfect for everyday wear.', accentColor: '#D4A853', image: null, visible: true, soldOut: false, sortOrder: 1 },
  { id: '2', name: 'Amethyst Drop', price: 35, categorySlug: 'earrings', subcategorySlug: 'dangles', colourSlug: 'purple', description: 'Faceted amethyst drops set in sterling silver with a delicate chain.', accentColor: '#9B59B6', image: null, visible: true, soldOut: false, sortOrder: 2 },
  { id: '3', name: 'Freshwater Pearl Studs', price: 22, categorySlug: 'earrings', subcategorySlug: 'studs', colourSlug: 'white', description: 'Lustrous freshwater pearls in 14K gold-filled stud settings.', accentColor: '#C8B99A', image: null, visible: true, soldOut: false, sortOrder: 3 },
  { id: '4', name: 'Hammered Copper Dangle', price: 30, categorySlug: 'earrings', subcategorySlug: 'dangles', colourSlug: 'rose-gold', description: 'Handcrafted copper dangles with a beautiful hammered finish.', accentColor: '#C0705A', image: null, visible: true, soldOut: false, sortOrder: 4 },
  { id: '5', name: 'Sapphire Huggie', price: 40, categorySlug: 'earrings', subcategorySlug: 'hoops', colourSlug: 'blue', description: 'Sapphire-set huggies in polished sterling silver.', accentColor: '#2E6DA4', image: null, visible: true, soldOut: true, sortOrder: 5 },
  { id: '6', name: 'Emerald Leaf Dangle', price: 45, categorySlug: 'earrings', subcategorySlug: 'dangles', colourSlug: 'green', description: 'Leaf-shaped brass dangles with hand-applied green enamel.', accentColor: '#27AE60', image: null, visible: true, soldOut: false, sortOrder: 6 },
  { id: '7', name: 'Black Onyx Stud', price: 25, categorySlug: 'earrings', subcategorySlug: 'studs', colourSlug: 'black', description: 'Polished black onyx cabochons in sterling silver bezel settings.', accentColor: '#3C3C3C', image: null, visible: true, soldOut: false, sortOrder: 7 },
  { id: '8', name: 'Rose Gold Textured Hoop', price: 32, categorySlug: 'earrings', subcategorySlug: 'hoops', colourSlug: 'rose-gold', description: 'Delicate rose gold-filled hoops with a hand-textured finish.', accentColor: '#C49A6C', image: null, visible: true, soldOut: false, sortOrder: 8 },
  { id: '9', name: 'Ruby Drop', price: 38, categorySlug: 'earrings', subcategorySlug: 'dangles', colourSlug: 'red', description: 'Deep red ruby drops suspended in gold-filled wire settings.', accentColor: '#C0392B', image: null, visible: true, soldOut: false, sortOrder: 9 },
  { id: '10', name: 'Rainbow Stone Tassel', price: 29, categorySlug: 'earrings', subcategorySlug: 'dangles', colourSlug: 'multicolour', description: 'Boho-inspired brass tassel earrings with mixed semi-precious stone beads.', accentColor: '#B5865A', image: null, visible: true, soldOut: false, sortOrder: 10 },
  { id: '11', name: 'Minimal Silver Huggie', price: 26, categorySlug: 'earrings', subcategorySlug: 'hoops', colourSlug: 'silver', description: 'Clean sterling silver huggies for everyday minimalist style.', accentColor: '#A8A8A8', image: null, visible: true, soldOut: false, sortOrder: 11 },
  { id: '12', name: 'Geometric Brass Stud', price: 20, categorySlug: 'earrings', subcategorySlug: 'studs', colourSlug: 'gold', description: 'Geometric square brass studs with a satin gold finish.', accentColor: '#B8860B', image: null, visible: true, soldOut: false, sortOrder: 12 },

  // — Bookmarks —
  { id: '13', name: 'Pressed Flower Bookmark', price: 12, categorySlug: 'bookmarks', subcategorySlug: null, colourSlug: 'green', description: 'A real pressed flower sealed in a slim, clear resin bookmark.', accentColor: '#27AE60', image: null, visible: true, soldOut: false, sortOrder: 13 },
  { id: '14', name: 'Beaded Tassel Bookmark', price: 10, categorySlug: 'bookmarks', subcategorySlug: null, colourSlug: 'blue', description: 'A glass-beaded strand finished with a hand-knotted tassel.', accentColor: '#2E6DA4', image: null, visible: true, soldOut: false, sortOrder: 14 },
  { id: '15', name: 'Gold Leaf Bookmark', price: 14, categorySlug: 'bookmarks', subcategorySlug: null, colourSlug: 'gold', description: 'A brushed gold-tone metal bookmark with a delicate leaf motif.', accentColor: '#D4A853', image: null, visible: true, soldOut: false, sortOrder: 15 },

  // — Gifts —
  { id: '16', name: 'Ceramic Trinket Dish', price: 18, categorySlug: 'gifts', subcategorySlug: null, colourSlug: 'white', description: 'A hand-painted ceramic trinket dish — perfect for rings and earrings.', accentColor: '#C8B99A', image: null, visible: true, soldOut: false, sortOrder: 16 },
  { id: '17', name: 'Soy Wax Melts (Set)', price: 9, categorySlug: 'gifts', subcategorySlug: null, colourSlug: 'purple', description: 'A set of hand-poured soy wax melts with a soft floral scent.', accentColor: '#9B59B6', image: null, visible: true, soldOut: false, sortOrder: 17 },
  { id: '18', name: 'Mini Gift Bundle', price: 25, categorySlug: 'gifts', subcategorySlug: null, colourSlug: 'multicolour', description: 'A surprise mix of small handmade pieces, picked and wrapped by hand.', accentColor: '#B5865A', image: null, visible: true, soldOut: false, sortOrder: 18 },
];
