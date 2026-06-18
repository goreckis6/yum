import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';
import { Aisle } from '../types';

interface Props {
  name: string;
  aisle?: Aisle;
  size?: number;
  muted?: boolean;
}

// Keyword → emoji. Polish + English. First match wins, so order matters
// (more specific keywords before generic ones).
const RULES: { kw: string[]; emoji: string }[] = [
  // — Seafood (specific before generic) —
  { kw: ['crab', 'krab'], emoji: '🦀' },
  { kw: ['lobster', 'homar', 'langost'], emoji: '🦞' },
  { kw: ['squid', 'kalmar', 'octopus', 'ośmior', 'osmior'], emoji: '🦑' },
  { kw: ['mussel', 'małże', 'malze', 'clam', 'oyster', 'ostryg', 'małż', 'malz'], emoji: '🦪' },
  { kw: ['shrimp', 'prawn', 'krewet', 'scampi', 'seafood', 'owoce morza'], emoji: '🦐' },
  { kw: ['salmon', 'łosoś', 'losos', 'sushi', 'sashimi'], emoji: '🍣' },
  { kw: ['tuna', 'tuńczyk', 'tunczyk', 'cod', 'dorsz', 'fish', 'ryba', 'filet rybny', 'mackerel', 'makrela', 'herring', 'śledź', 'sledz', 'anchov', 'sardyn', 'trout', 'pstrąg', 'pstrag'], emoji: '🐟' },

  // — Meat & poultry —
  { kw: ['chicken', 'kurczak', 'drumstick', 'pałka', 'palka', 'udko', 'turkey', 'indyk', 'poultry', 'drób', 'drob', 'wing', 'skrzydeł', 'breast', 'pierś', 'piers', 'duck', 'kacz'], emoji: '🍗' },
  { kw: ['sausage', 'kiełbas', 'kielbas', 'parówk', 'parowk', 'hot dog', 'frankfurter', 'chorizo'], emoji: '🌭' },
  { kw: ['bacon', 'boczek', 'pancetta', 'prosciutto', 'ham', 'szynka', 'salami'], emoji: '🥓' },
  { kw: ['beef', 'wołow', 'wolow', 'pork', 'wieprz', 'steak', 'stek', 'mięso', 'mieso', 'meat', 'lamb', 'jagnięc', 'jagniec', 'veal', 'cielęc', 'cielec', 'mince', 'mielon', 'farsz', 'ribs', 'żeber', 'zeber'], emoji: '🥩' },
  { kw: ['egg', 'jajk', 'jaja', 'jajo', 'yolk', 'żółtk', 'zoltk', 'białk jaj', 'bialk jaj'], emoji: '🥚' },

  // — Ground / powdered spices (a powder, NOT the fresh vegetable) —
  // Placed before the fresh-veg rules so "garlic powder" ≠ fresh garlic, etc.
  { kw: ['garlic powder', 'czosnek w proszk', 'czosnek granulow', 'czosnek suszon', 'onion powder', 'cebula w proszk', 'cebula granulow', 'cebula suszon', 'ground ginger', 'imbir mielon', 'imbir w proszk', 'imbir suszon', 'chili powder', 'chilli powder', 'chili w proszk', 'chilli w proszk', 'chili mielon'], emoji: 'svg:spice' },

  // — Vegetables —
  { kw: ['carrot', 'marchew', 'marchewk'], emoji: '🥕' },
  { kw: ['cucumber', 'ogórek', 'ogorek', 'ogórk', 'ogork', 'pickle', 'korniszon', 'zucchini', 'cukini', 'courgette'], emoji: '🥒' },
  { kw: ['cabbage', 'kapust', 'lettuce', 'sałat', 'salat', 'spinach', 'szpinak', 'kale', 'jarmuż', 'jarmuz', 'rukola', 'arugula', 'chard', 'botwin', 'greens', 'liście', 'liscie'], emoji: '🥬' },
  { kw: ['garlic', 'czosnek', 'czosnk'], emoji: '🧄' },
  { kw: ['red onion', 'czerwona cebul', 'cebula czerwon'], emoji: 'svg:onion-red' },
  { kw: ['onion', 'cebul', 'shallot', 'szalotk', 'spring onion', 'dymk', 'szczypior', 'leek', 'pora', 'pory', 'scallion', 'chive'], emoji: '🧅' },
  { kw: ['tomato', 'pomidor', 'passata', 'ketchup', 'concentrate', 'koncentrat'], emoji: '🍅' },
  { kw: ['chili', 'chilli', 'jalapeño', 'jalapeno', 'papryczk', 'ostra papryk', 'cayenne', 'pieprz cayenne', 'sriracha', 'tabasco', 'płatki chili', 'platki chili', 'pieprz cayenn', 'gochujang', 'harissa', 'sambal'], emoji: '🌶️' },
  { kw: ['black pepper', 'ground pepper', 'white pepper', 'peppercorn', 'pieprz'], emoji: 'svg:pepper' },
  { kw: ['smoked paprika', 'sweet paprika', 'ground paprika', 'paprika', 'papryka wędz', 'papryka wedz', 'papryka mielon', 'papryka słodk', 'papryka slodk', 'papryka ostr', 'papryka w proszk', 'papryka sypk'], emoji: 'svg:spice' },
  { kw: ['bell pepper', 'pepper', 'papryk', 'capsicum'], emoji: 'svg:pepper-bell' },
  { kw: ['broccoli', 'brokuł', 'brokul', 'cauliflower', 'kalafior', 'asparagus', 'szparag'], emoji: '🥦' },
  { kw: ['sweet potato', 'słodki ziemniak', 'slodki ziemniak', 'batat', 'yam'], emoji: '🍠' },
  { kw: ['potato', 'ziemniak', 'kartofel'], emoji: '🥔' },
  { kw: ['mushroom', 'grzyb', 'pieczark', 'champignon', 'borowik', 'shiitake', 'boletus'], emoji: '🍄' },
  { kw: ['corn', 'kukurydz', 'maize', 'popcorn'], emoji: '🌽' },
  { kw: ['eggplant', 'bakłażan', 'baklazan', 'aubergine'], emoji: '🍆' },
  { kw: ['avocado', 'awokado', 'guacamole'], emoji: '🥑' },
  { kw: ['peas', 'groszek', 'groch', 'edamame', 'green bean', 'fasolk szparagow', 'szparagow'], emoji: '🫛' },
  { kw: ['ginger', 'imbir'], emoji: '🫚' },

  // — Fruit —
  { kw: ['lime', 'limonk', 'limet'], emoji: 'svg:lime' },
  { kw: ['lemon', 'cytryn'], emoji: '🍋' },
  { kw: ['orange', 'pomarańcz', 'pomarancz', 'mandarynk', 'grapefruit', 'grejpfrut', 'citrus', 'cytrus'], emoji: '🍊' },
  { kw: ['banana', 'banan'], emoji: '🍌' },
  { kw: ['green apple', 'granny smith', 'jabłko zielon', 'jablko zielon', 'zielone jabłk', 'zielone jablk'], emoji: '🍏' },
  { kw: ['apple', 'jabłk', 'jablk'], emoji: '🍎' },
  { kw: ['pear', 'grusz'], emoji: '🍐' },
  { kw: ['peach', 'brzoskw', 'nektaryn'], emoji: '🍑' },
  { kw: ['mango'], emoji: '🥭' },
  { kw: ['kiwi'], emoji: '🥝' },
  { kw: ['pineapple', 'ananas'], emoji: '🍍' },
  { kw: ['watermelon', 'arbuz', 'melon'], emoji: '🍉' },
  { kw: ['coconut', 'kokos'], emoji: '🥥' },
  { kw: ['strawberry', 'truskawk'], emoji: '🍓' },
  { kw: ['blueberry', 'borówk', 'borowk', 'raspberry', 'malin', 'jeżyn', 'jezyn', 'currant', 'porzeczk', 'berry', 'jagod'], emoji: '🫐' },
  { kw: ['grape', 'winogron', 'plum', 'śliwk', 'sliwk', 'rodzynk', 'raisin'], emoji: '🍇' },
  { kw: ['cherry', 'wiśn', 'wisn', 'czereśn', 'czeresn'], emoji: '🍒' },

  // — Sauces, marinades & condiments —
  { kw: ['marinade', 'marynat', 'dressing', 'sos sałatkow', 'sos salatkow', 'vinaigrette', 'winegret', 'glaze', 'glazur', 'salsa', 'dip ', 'sos do'], emoji: '🥣' },
  { kw: ['pesto'], emoji: '🌿' },
  { kw: ['mustard', 'musztard', 'mayo', 'majonez', 'aioli', 'ajoli', 'horseradish', 'chrzan', 'relish', 'tartar', 'tatarsk'], emoji: '🫙' },
  { kw: ['jam', 'dżem', 'dzem', 'marmolad', 'preserve', 'konfitur', 'powidł', 'powidl', 'nutella'], emoji: '🍓' },
  { kw: ['canned', 'puszk', 'konserw', 'tinned', 'słoik', 'sloik', 'pickled', 'marynowan'], emoji: '🥫' },

  // — Bottles & liquids —
  { kw: ['soy sauce', 'sos sojowy', 'sojowy', 'fish sauce', 'sos rybny', 'sos ', 'sauce', 'worcestershire', 'mirin', 'tamari', 'teriyaki', 'hoisin'], emoji: '🍶' },
  { kw: ['vinegar', 'ocet'], emoji: '🧴' },
  { kw: ['olive oil', 'oliwa', 'olive', 'oliwk', 'sesame oil', 'olej sezamow'], emoji: 'svg:oil' },
  { kw: ['oil', 'olej', 'ghee'], emoji: 'svg:oil' },
  { kw: ['white wine', 'białe wino', 'biale wino', 'wino białe', 'wino biale', 'prosecco', 'champagne', 'szampan'], emoji: '🥂' },
  { kw: ['wine', 'wino'], emoji: '🍷' },
  { kw: ['beer', 'piwo'], emoji: '🍺' },
  { kw: ['stock', 'bulion', 'broth', 'rosół', 'rosol', 'soup', 'zupa'], emoji: '🍲' },
  { kw: ['vodka', 'wódk', 'wodk', 'rum', 'whisky', 'gin', 'liqueur', 'likier'], emoji: '🍸' },
  { kw: ['water', 'woda'], emoji: '💧' },
  { kw: ['coffee', 'kawa', 'espresso', 'latte', 'cappuccino'], emoji: '☕' },
  { kw: ['tea', 'herbat', 'matcha'], emoji: '🍵' },
  { kw: ['juice', 'sok ', 'smoothie'], emoji: '🧃' },
  { kw: ['soda', 'cola', 'lemoniad', 'sparkling', 'gazowan', 'tonic'], emoji: '🥤' },

  // — Grains, pasta, bread —
  { kw: ['noodle', 'ramen', 'udon', 'soba', 'pho', 'kluski', 'makaron ryżow', 'makaron ryzow'], emoji: '🍜' },
  { kw: ['pasta', 'makaron', 'spaghetti', 'rigatoni', 'penne', 'tagliatel', 'lasagne', 'fettuc', 'gnocchi', 'tortellini', 'ravioli', 'farfalle', 'fusilli', 'orzo', 'macaroni', 'świderk', 'swiderk', 'kokard', 'nitki', 'wstążk', 'wstazk'], emoji: 'svg:pasta' },
  { kw: ['rice', 'ryż', 'ryz', 'risotto', 'quinoa', 'komos', 'couscous', 'kuskus', 'kasza', 'bulgur', 'groats', 'millet', 'jaglan'], emoji: '🍚' },
  { kw: ['baguette', 'bagiet'], emoji: '🥖' },
  { kw: ['croissant', 'rogal'], emoji: '🥐' },
  { kw: ['tortilla', 'wrap', 'pita', 'flatbread', 'placek', 'naan', 'lawasz'], emoji: '🫓' },
  { kw: ['bread', 'chleb', 'bułk', 'bulk', 'toast', 'bun', 'crouton', 'grzank', 'breadcrumb', 'tart', 'panko'], emoji: '🍞' },
  { kw: ['flour', 'mąk', 'mak', 'starch', 'skrobi', 'baking', 'proszek do piec', 'soda oczyszcz', 'yeast', 'drożdż', 'drozdz', 'wheat', 'pszen'], emoji: '🌾' },
  { kw: ['oats', 'owsian', 'owsiank', 'cereal', 'granola', 'musli', 'muesli', 'porridge', 'płatki owsian', 'platki owsian'], emoji: '🥣' },
  { kw: ['seaweed', 'nori', 'wodorost', 'algi', 'kombu', 'wakame'], emoji: '🍙' },

  // — Pantry / nuts / seeds —
  { kw: ['peanut', 'arachid', 'nut', 'orzech', 'almond', 'migdał', 'migdal', 'cashew', 'nerkow', 'walnut', 'włosk', 'wlosk', 'hazelnut', 'lask', 'pistachio', 'pistacj', 'pecan', 'tahini'], emoji: '🥜' },
  { kw: ['sesame', 'sezam', 'seed', 'nasion', 'ziarn', 'pestki', 'chia', 'flax', 'siemię', 'siemie', 'poppy', 'słonecznik', 'slonecznik', 'sunflower', 'pumpkin seed'], emoji: '🌰' },
  { kw: ['bean', 'fasol', 'chickpea', 'ciecierzyc', 'cieciork', 'lentil', 'soczewic', 'tofu', 'tempeh', 'hummus', 'humus'], emoji: '🫘' },
  { kw: ['chocolate', 'czekolad', 'cocoa', 'kakao', 'nutella'], emoji: '🍫' },

  // — Dairy —
  { kw: ['cheese', 'ser ', 'serek', 'parmesan', 'parmezan', 'mozzarella', 'cheddar', 'feta', 'halloumi', 'ricotta', 'mascarpone', 'gouda', 'twaróg', 'twarog'], emoji: '🧀' },
  { kw: ['butter', 'masło', 'maslo', 'margaryn'], emoji: '🧈' },
  { kw: ['cream', 'śmietan', 'smietan', 'creme', 'crème', 'yogurt', 'jogurt', 'joghurt', 'kefir', 'skyr', 'cottage', 'milk', 'mleko', 'mlek', 'buttermilk', 'maślank', 'maslank'], emoji: '🥛' },

  // — Desserts & frozen —
  { kw: ['ice cream', 'lody', 'gelato', 'sorbet'], emoji: '🍦' },
  { kw: ['cake', 'ciast', 'dessert', 'deser', 'muffin', 'cookie', 'ciastk', 'biscuit', 'herbatnik', 'brownie', 'pastry'], emoji: '🍰' },

  // — Sweeteners & seasoning —
  { kw: ['honey', 'miód', 'miod', 'syrup', 'syrop', 'maple', 'klonow', 'agave', 'agaw'], emoji: '🍯' },
  { kw: ['sugar', 'cukier', 'cukr', 'sweetener', 'słodzik', 'slodzik', 'erytrol', 'stevia'], emoji: '🍬' },
  { kw: ['salt', 'sól', 'sol ', 'soli'], emoji: 'svg:salt' },
  { kw: ['herb', 'zioł', 'ziol', 'basil', 'bazyli', 'parsley', 'pietrusz', 'cilantro', 'coriander', 'kolendr', 'mint', 'mięt', 'miet', 'thyme', 'tymian', 'rosemary', 'rozmaryn', 'oregano', 'dill', 'koperek', 'koper', 'sage', 'szałwi', 'szalwi', 'bay leaf', 'liść laurow', 'lisc laurow'], emoji: '🌿' },
  { kw: ['cinnamon', 'cynamon', 'cumin', 'kmin', 'curry', 'turmeric', 'kurkum', 'nutmeg', 'gałk', 'galk', 'clove', 'goździk', 'gozdzik', 'allspice', 'ziele angiel', 'cardamom', 'kardamon', 'coriander ground', 'kolendra mielon', 'garam', 'sumak', 'sumac', 'spice', 'przypraw', 'seasoning', 'vanilla', 'wanili'], emoji: 'svg:spice' },
];

const AISLE_FALLBACK: Record<Aisle, string> = {
  Produce: '🥗',
  'Meat & Seafood': '🍖',
  'Dairy & Eggs': '🥛',
  Bakery: '🍞',
  Pantry: '🫙',
  Frozen: '🧊',
};

type PepperColor = 'red' | 'yellow' | 'orange' | 'green';

// Detect a colour word in the ingredient name (PL + EN). Used to pick a
// colour variant for icons like bell pepper.
function detectColor(name: string): PepperColor | undefined {
  const n = name.toLowerCase();
  if (/(czerwon|red)/.test(n)) return 'red';
  if (/(żółt|zolt|yellow)/.test(n)) return 'yellow';
  if (/(pomarańcz|pomarancz|orange)/.test(n)) return 'orange';
  if (/(zielon|green)/.test(n)) return 'green';
  return undefined;
}

// Powder colour for a ground spice, picked from the name. Only consulted when
// a name already resolved to the 'svg:spice' glyph.
function detectSpiceColor(name: string): { fill: string; shade: string } {
  const n = name.toLowerCase();
  if (/(papryk|paprika|chili|chilli|cayenn|sumak|sumac|harissa)/.test(n)) return { fill: '#C44232', shade: '#9E3225' }; // red
  if (/(turmeric|kurkum|curry|szafran|saffron|musztard|mustard)/.test(n)) return { fill: '#E3A81B', shade: '#BC8910' }; // yellow
  if (/(garlic|czosnek|onion|cebul)/.test(n)) return { fill: '#E6DCC4', shade: '#BCAE8C' }; // cream
  if (/(cynamon|cinnamon)/.test(n)) return { fill: '#A5642E', shade: '#7C4A20' }; // warm brown
  return { fill: '#9C6B3A', shade: '#76502A' }; // generic brown (cumin, nutmeg, clove, ginger…)
}

function resolveEmoji(name: string, aisle?: Aisle): string {
  const n = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.kw.some((k) => n.includes(k))) return rule.emoji;
  }
  if (aisle && AISLE_FALLBACK[aisle]) return AISLE_FALLBACK[aisle];
  return '🫙';
}

// Plate-less pasta: three rigatoni/penne tubes (emoji has no bare-pasta glyph).
function PastaGlyph({ size }: { size: number }) {
  const tubes = [
    { x: 4.5, y: 7.5, r: -22 },
    { x: 9.5, y: 6, r: -22 },
    { x: 14, y: 8, r: -22 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {tubes.map((t, i) => (
        <G key={i} transform={`rotate(${t.r} ${t.x + 2.5} ${t.y + 5.5})`}>
          <Rect x={t.x} y={t.y} width={5} height={11} rx={2.5} fill="#E8C27A" stroke="#C99A4B" strokeWidth={1.1} />
          <Ellipse cx={t.x + 2.5} cy={t.y + 1.5} rx={1.7} ry={0.9} fill="#C99A4B" />
        </G>
      ))}
    </Svg>
  );
}

// Salt & pepper shakers — same shape, different grain colour so they read
// as a clearly distinguishable pair (emoji 🧂 alone can't tell them apart).
function ShakerGlyph({ size, grain }: { size: number; grain: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 11a6 6 0 0 1 12 0v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-6Z"
        fill="#F0EEE8"
        stroke="#A8A498"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path d="M6.2 14.5h11.6V17a3 3 0 0 1-3 3H9.2a3 3 0 0 1-3-3v-2.5Z" fill={grain} />
      <Ellipse cx={9.8} cy={8} rx={0.8} ry={0.8} fill="#6B6B63" />
      <Ellipse cx={12} cy={7.3} rx={0.8} ry={0.8} fill="#6B6B63" />
      <Ellipse cx={14.2} cy={8} rx={0.8} ry={0.8} fill="#6B6B63" />
    </Svg>
  );
}

// Green lime — half-citrus with segments (emoji 🍋‍🟩 breaks on many systems).
function LimeGlyph({ size }: { size: number }) {
  const seg = '#4F8A3D';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} fill="#E3F0D8" stroke="#4F8A3D" strokeWidth={1.4} />
      <Circle cx={12} cy={12} r={6} fill="#CDE5B8" />
      <Path
        d="M12 12L12 6.2M12 12L17.8 12M12 12L12 17.8M12 12L6.2 12M12 12L8.1 8.1M12 12L15.9 8.1M12 12L15.9 15.9M12 12L8.1 15.9"
        stroke={seg}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={12} r={1} fill={seg} />
    </Svg>
  );
}

// Olive-oil bottle (emoji 🫒 renders as an unclear blob).
function OilGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={10} y={2.5} width={4} height={2.6} rx={0.8} fill="#7A9E5C" />
      <Rect x={10.7} y={5} width={2.6} height={2.6} fill="#C2A94B" />
      <Path
        d="M8 10c0-1.4 1.2-2.4 2.7-2.4h2.6c1.5 0 2.7 1 2.7 2.4v8a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-8Z"
        fill="#EFE7B8"
        stroke="#C2A94B"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Path d="M8 13.5h8V18a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4.5Z" fill="#D9B94B" />
    </Svg>
  );
}

// Bell pepper with colour variants (emoji only offers a green one).
const PEPPER_PALETTE: Record<PepperColor, { fill: string; shade: string }> = {
  red: { fill: '#E0392B', shade: '#B82C20' },
  yellow: { fill: '#F4C430', shade: '#D9A91E' },
  orange: { fill: '#EF8B2C', shade: '#D2701A' },
  green: { fill: '#5DA130', shade: '#47811F' },
};

function BellPepperGlyph({ size, color }: { size: number; color: PepperColor }) {
  const p = PEPPER_PALETTE[color];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* stem */}
      <Path d="M12 7.5C12 5.5 11.4 4 12.6 3" stroke="#4E8A3D" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M11 6.2C9.8 5.4 9.2 5.6 8.7 6.4" stroke="#4E8A3D" strokeWidth={1.5} strokeLinecap="round" fill="none" />
      {/* body with lobed bottom */}
      <Path
        d="M6.4 11C6.4 8.4 8.6 6.8 12 6.8C15.4 6.8 17.6 8.4 17.6 11C17.6 14 16.9 17 15.3 18.7C14.7 19.3 14 18.9 13.6 18.3C13.2 17.6 12.6 17.6 12 18.4C11.4 17.6 10.8 17.6 10.4 18.3C10 18.9 9.3 19.3 8.7 18.7C7.1 17 6.4 14 6.4 11Z"
        fill={p.fill}
        stroke={p.shade}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* highlight */}
      <Path d="M9 10C8.7 12 8.8 14.5 9.6 16.6" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// Red onion — purple-skinned bulb (emoji 🧅 is always brown).
function RedOnionGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* sprout */}
      <Path d="M12 5.5C12 4 11.4 3 12.4 2.4M12 5.5C12 4 12.6 3 11.6 2.4" stroke="#7BA85A" strokeWidth={1.3} strokeLinecap="round" fill="none" />
      {/* bulb */}
      <Path
        d="M12 5.6C16.2 5.6 18 9 18 13C18 17 15.3 20.5 12 20.5C8.7 20.5 6 17 6 13C6 9 7.8 5.6 12 5.6Z"
        fill="#9B3B6E"
        stroke="#6E2A4E"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* skin lines */}
      <Path d="M9.4 6.6C8 9 7.6 13 9.2 18.2" stroke="#6E2A4E" strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.7} />
      <Path d="M14.6 6.6C16 9 16.4 13 14.8 18.2" stroke="#6E2A4E" strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.7} />
      <Path d="M12 5.8V20.3" stroke="#C77AA3" strokeWidth={0.9} strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

// Ground spice — a small heap of powder with scattered grains. Tinted per
// spice so paprika/turmeric/cinnamon etc. read as powders, not vegetables.
function SpiceGlyph({ size, fill, shade }: { size: number; fill: string; shade: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* ground shadow */}
      <Ellipse cx={12} cy={18.6} rx={8.6} ry={1.7} fill={shade} opacity={0.32} />
      {/* powder mound */}
      <Path d="M3.8 18.6 Q12 7.2 20.2 18.6 Z" fill={fill} stroke={shade} strokeWidth={1} strokeLinejoin="round" />
      {/* texture on the mound */}
      <Circle cx={10.2} cy={15} r={0.7} fill={shade} opacity={0.55} />
      <Circle cx={13.4} cy={13.6} r={0.6} fill={shade} opacity={0.55} />
      <Circle cx={12} cy={16.6} r={0.6} fill={shade} opacity={0.45} />
      {/* loose grains beside the heap */}
      <Circle cx={2.8} cy={19.2} r={0.7} fill={fill} />
      <Circle cx={21.2} cy={19.2} r={0.7} fill={fill} />
      <Circle cx={5.4} cy={20.1} r={0.5} fill={shade} />
      <Circle cx={18.6} cy={20.1} r={0.5} fill={shade} />
    </Svg>
  );
}

export function IngredientIcon({ name, aisle, size = 30, muted = false }: Props) {
  const emoji = resolveEmoji(name, aisle);
  const inner = Math.round(size * 0.62);
  let content;
  if (emoji === 'svg:pasta') content = <PastaGlyph size={inner} />;
  else if (emoji === 'svg:salt') content = <ShakerGlyph size={inner} grain="#CFCBC0" />;
  else if (emoji === 'svg:pepper') content = <ShakerGlyph size={inner} grain="#2A2A2A" />;
  else if (emoji === 'svg:lime') content = <LimeGlyph size={inner} />;
  else if (emoji === 'svg:oil') content = <OilGlyph size={inner} />;
  else if (emoji === 'svg:pepper-bell') content = <BellPepperGlyph size={inner} color={detectColor(name) ?? 'green'} />;
  else if (emoji === 'svg:onion-red') content = <RedOnionGlyph size={inner} />;
  else if (emoji === 'svg:spice') {
    const sc = detectSpiceColor(name);
    content = <SpiceGlyph size={inner} fill={sc.fill} shade={sc.shade} />;
  }
  else content = <Text style={{ fontSize: Math.round(size * 0.52) }}>{emoji}</Text>;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: muted ? 0.4 : 1,
      }}
    >
      {content}
    </View>
  );
}
