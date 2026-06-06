export type EarringType = 'stud' | 'hoop' | 'dangle' | 'drop' | 'huggie';
export type Metal = 'gold' | 'silver' | 'rose gold' | 'brass' | 'copper';
export type Colour =
  | 'gold'
  | 'silver'
  | 'rose gold'
  | 'black'
  | 'white'
  | 'blue'
  | 'green'
  | 'red'
  | 'purple'
  | 'multicolour';

export interface Earring {
  id: string;
  name: string;
  price: number;
  type: EarringType;
  metal: Metal;
  colour: Colour;
  description: string;
  accentColor: string;
}

export const earrings: Earring[] = [
  {
    id: '1',
    name: 'Classic Gold Hoops',
    price: 28,
    type: 'hoop',
    metal: 'gold',
    colour: 'gold',
    description: 'Simple and elegant 14K gold-filled hoops, perfect for everyday wear.',
    accentColor: '#D4A853',
  },
  {
    id: '2',
    name: 'Amethyst Drop',
    price: 35,
    type: 'drop',
    metal: 'silver',
    colour: 'purple',
    description: 'Faceted amethyst drops set in sterling silver with a delicate chain.',
    accentColor: '#9B59B6',
  },
  {
    id: '3',
    name: 'Freshwater Pearl Studs',
    price: 22,
    type: 'stud',
    metal: 'gold',
    colour: 'white',
    description: 'Lustrous freshwater pearls in 14K gold-filled stud settings.',
    accentColor: '#C8B99A',
  },
  {
    id: '4',
    name: 'Hammered Copper Dangle',
    price: 30,
    type: 'dangle',
    metal: 'copper',
    colour: 'rose gold',
    description: 'Handcrafted copper dangles with a beautiful hammered finish.',
    accentColor: '#C0705A',
  },
  {
    id: '5',
    name: 'Sapphire Huggie',
    price: 40,
    type: 'huggie',
    metal: 'silver',
    colour: 'blue',
    description: 'Sapphire-set huggies in polished sterling silver.',
    accentColor: '#2E6DA4',
  },
  {
    id: '6',
    name: 'Emerald Leaf Dangle',
    price: 45,
    type: 'dangle',
    metal: 'brass',
    colour: 'green',
    description: 'Leaf-shaped brass dangles with hand-applied green enamel.',
    accentColor: '#27AE60',
  },
  {
    id: '7',
    name: 'Black Onyx Stud',
    price: 25,
    type: 'stud',
    metal: 'silver',
    colour: 'black',
    description: 'Polished black onyx cabochons in sterling silver bezel settings.',
    accentColor: '#3C3C3C',
  },
  {
    id: '8',
    name: 'Rose Gold Textured Hoop',
    price: 32,
    type: 'hoop',
    metal: 'rose gold',
    colour: 'rose gold',
    description: 'Delicate rose gold-filled hoops with a hand-textured finish.',
    accentColor: '#C49A6C',
  },
  {
    id: '9',
    name: 'Ruby Drop',
    price: 38,
    type: 'drop',
    metal: 'gold',
    colour: 'red',
    description: 'Deep red ruby drops suspended in gold-filled wire settings.',
    accentColor: '#C0392B',
  },
  {
    id: '10',
    name: 'Rainbow Stone Tassel',
    price: 29,
    type: 'dangle',
    metal: 'brass',
    colour: 'multicolour',
    description: 'Boho-inspired brass tassel earrings with mixed semi-precious stone beads.',
    accentColor: '#B5865A',
  },
  {
    id: '11',
    name: 'Minimal Silver Huggie',
    price: 26,
    type: 'huggie',
    metal: 'silver',
    colour: 'silver',
    description: 'Clean sterling silver huggies for everyday minimalist style.',
    accentColor: '#A8A8A8',
  },
  {
    id: '12',
    name: 'Geometric Brass Stud',
    price: 20,
    type: 'stud',
    metal: 'brass',
    colour: 'gold',
    description: 'Geometric square brass studs with a satin gold finish.',
    accentColor: '#B8860B',
  },
];

export const TYPES: { label: string; value: EarringType | 'all' }[] = [
  { label: 'All Types', value: 'all' },
  { label: 'Stud', value: 'stud' },
  { label: 'Hoop', value: 'hoop' },
  { label: 'Dangle', value: 'dangle' },
  { label: 'Drop', value: 'drop' },
  { label: 'Huggie', value: 'huggie' },
];

export const METALS: { label: string; value: Metal | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Gold', value: 'gold' },
  { label: 'Silver', value: 'silver' },
  { label: 'Rose Gold', value: 'rose gold' },
  { label: 'Brass', value: 'brass' },
  { label: 'Copper', value: 'copper' },
];

export const COLOURS: { label: string; value: Colour | 'all'; hex: string }[] = [
  { label: 'All', value: 'all', hex: '' },
  { label: 'Gold', value: 'gold', hex: '#D4A853' },
  { label: 'Silver', value: 'silver', hex: '#A8A8A8' },
  { label: 'Rose Gold', value: 'rose gold', hex: '#C49A6C' },
  { label: 'Black', value: 'black', hex: '#3C3C3C' },
  { label: 'White', value: 'white', hex: '#E8DDD0' },
  { label: 'Blue', value: 'blue', hex: '#2E6DA4' },
  { label: 'Green', value: 'green', hex: '#27AE60' },
  { label: 'Red', value: 'red', hex: '#C0392B' },
  { label: 'Purple', value: 'purple', hex: '#9B59B6' },
  { label: 'Multicolour', value: 'multicolour', hex: '' },
];
