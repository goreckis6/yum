import { ALL_SLOTS, AppState, DayKey } from '../types';
export { ALL_SLOTS as SLOTS };

export const DAYS: { day: DayKey; date: number }[] = [
  { day: 'Mon', date: 15 },
  { day: 'Tue', date: 16 },
  { day: 'Wed', date: 17 },
  { day: 'Thu', date: 18 },
  { day: 'Fri', date: 19 },
  { day: 'Sat', date: 20 },
  { day: 'Sun', date: 21 },
];


export const AISLE_ORDER = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Frozen',
] as const;

export const AISLE_DOT: Record<string, string> = {
  Produce: '#2A2A2A',
  'Meat & Seafood': '#454545',
  'Dairy & Eggs': '#606060',
  Bakery: '#7A7A7A',
  Pantry: '#959595',
  Frozen: '#AEAEAE',
};

export const SEED_STATE: AppState = {
  hasOnboarded: true,
  made: {},
  ingChecked: {},
  favorites: {},
  cookbookCovers: {},
  customCookbooks: [],
  receipts: [],
  pantry: [],
  recipes: [
    {
      id: 'r1',
      title: 'Creamy Tomato Rigatoni',
      time: 25,
      rating: '4.8',
      servings: 4,
      app: 'TikTok',
      handle: '@pastaqueen',
      tint: '#E4E4E2',
      sourceTint: '#161616',
      imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80',
      tags: ['Dinner'],
      kcal: 520,
      p: 18,
      c: 68,
      f: 19,
      ingredients: [
        { a: '400g', n: 'Rigatoni', aisle: 'Pantry' },
        { a: '2 tbsp', n: 'Olive oil', aisle: 'Pantry' },
        { a: '3 cloves', n: 'Garlic', aisle: 'Produce' },
        { a: '700g', n: 'Tomato passata', aisle: 'Pantry' },
        { a: '150ml', n: 'Heavy cream', aisle: 'Dairy & Eggs' },
        { a: '50g', n: 'Parmesan', aisle: 'Dairy & Eggs' },
        { a: 'handful', n: 'Fresh basil', aisle: 'Produce' },
      ],
      steps: [
        'Bring a large pot of salted water to a boil and cook the rigatoni until al dente.',
        'Gently saute the sliced garlic in olive oil until fragrant.',
        'Pour in the passata and simmer for 8 minutes.',
        'Stir through the cream and parmesan until silky.',
        'Toss the pasta in the sauce and finish with torn basil.',
      ],
    },
  ],
  grocery: [],
  mealPlan: {
    Mon: {},
    Tue: {},
    Wed: {},
    Thu: {},
    Fri: {},
    Sat: {},
    Sun: {},
  },
};
