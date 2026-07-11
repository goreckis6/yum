// A pool of meal-reminder notifications so every push doesn't read the same.
// One is picked at random each time a reminder is scheduled. {slot} = the meal
// name (Breakfast, Dinner, …), {name} = the recipe. Each line keeps at most one
// dash — no doubled "—" — and mixes emoji for a bit of personality.

type Lang = 'en' | 'pl';

interface Template {
  title: string; // uses {slot}
  body: string; // uses {name}
}

const EN: Template[] = [
  { title: '🍽️ {slot} coming up', body: '{name} — time to get started' },
  { title: '⏰ Almost {slot} time', body: "Let's make {name}" },
  { title: '🥘 {slot} is next', body: '{name} is on the menu' },
  { title: '👨‍🍳 Ready for {slot}?', body: 'Time to cook {name}' },
  { title: '🔔 {slot} reminder', body: 'Fire up the kitchen: {name}' },
  { title: '😋 {slot} time!', body: 'Your {name} is calling' },
  { title: '🍳 Get set for {slot}', body: '{name} — let’s get cooking' },
  { title: '🌿 {slot} coming up', body: 'Ready to prep {name}?' },
  { title: '🔥 {slot} in a bit', body: '{name} awaits' },
  { title: '🍴 {slot} soon', body: 'Grab your apron: {name}' },
  { title: '✨ {slot} time', body: 'Make something great: {name}' },
  { title: '🥗 {slot} ahead', body: '{name} is ready when you are' },
  { title: '🍲 Nearly {slot}', body: "Let's cook {name}" },
  { title: '📣 {slot} coming up', body: '{name} — chef’s on duty' },
];

const PL: Template[] = [
  { title: '🍽️ {slot} już wkrótce', body: '{name} — czas zaczynać' },
  { title: '⏰ Zaraz {slot}', body: 'Zróbmy {name}' },
  { title: '🥘 {slot} coraz bliżej', body: '{name} czeka w menu' },
  { title: '👨‍🍳 Gotowy na {slot}?', body: 'Czas ugotować {name}' },
  { title: '🔔 Przypomnienie: {slot}', body: 'Rozpal kuchnię: {name}' },
  { title: '😋 Pora na {slot}', body: '{name} już woła' },
  { title: '🍳 Szykuj się na {slot}', body: '{name} — do dzieła' },
  { title: '🌿 {slot} tuż-tuż', body: 'Przygotować {name}?' },
  { title: '🔥 Za chwilę {slot}', body: '{name} czeka' },
  { title: '🍴 Niedługo {slot}', body: 'Zakładaj fartuch: {name}' },
  { title: '✨ Czas na {slot}', body: 'Zrób coś pysznego: {name}' },
  { title: '🥗 {slot} przed nami', body: '{name} czeka, gdy będziesz gotowy' },
  { title: '🍲 Już prawie {slot}', body: 'Ugotujmy {name}' },
  { title: '📣 {slot} nadchodzi', body: '{name} — szef kuchni na start' },
];

export function pickReminderMessage(
  lang: Lang,
  slotLabel: string,
  recipeName: string,
): { title: string; body: string } {
  const list = lang === 'pl' ? PL : EN;
  const m = list[Math.floor(Math.random() * list.length)];
  return {
    title: m.title.replace('{slot}', slotLabel),
    body: m.body.replace('{name}', recipeName),
  };
}
