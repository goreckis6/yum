# Analityka i raportowanie awarii — jak to działa i jak włączyć

## Po co to w ogóle jest

**Analityka = liczydło zdarzeń.** Za każdym razem, gdy ktoś zrobi w apce coś
ważnego (skończy onboarding, zaimportuje przepis, zobaczy paywall, kupi
subskrypcję), aplikacja wysyła krótki sygnał „to się wydarzyło". Z tych sygnałów
powstaje **lejek** — widać, ilu ludzi przechodzi z jednego kroku do następnego:

```
100 otworzyło apkę
 → 62 skończyło onboarding
 → 48 zaimportowało 1. przepis   ← tu jest Twój "moment wow"
 → 15 zobaczyło paywall
 →  3 kupiły
```

Bez tego nie wiesz, gdzie ludzie odpadają, więc nie wiesz, co poprawić. Z tym —
widzisz np. „połowa ludzi rzuca apkę zanim zaimportuje choć jeden przepis" i wiesz,
że problem jest w onboardingu/imporcie, a nie w cenie.

**Sentry = czujnik awarii.** Gdy apka komuś się wywali, dostajesz raport (który
ekran, jaki błąd, jaki telefon) — zamiast czekać na 1-gwiazdkową recenzję.

## Co już jest wpięte (działa teraz, bez żadnych kont)

Zdarzenia są już rozstawione w kodzie i **na razie wypisują się do konsoli Metro**
w trybie deweloperskim. Włącz apkę przez `npx expo start`, poklikaj, a w terminalu
zobaczysz linie w stylu:

```
📊 [analytics] app_opened {}
📊 [analytics] import_started { source: 'link' }
📊 [analytics] import_succeeded { source: 'link', creditsLeft: 9 }
📊 [analytics] paywall_viewed { reason: 'out_of_credits' }
```

To jest Twój lejek na żywo — świetny sposób, żeby zobaczyć na własne oczy, o co
chodzi. W produkcji te logi milkną (nic nie wysyłają), dopóki nie podłączysz
prawdziwego dostawcy poniżej.

Mierzone zdarzenia (plik `src/lib/analytics.ts`):
`app_opened`, `onboarding_completed`, `signed_in`, `import_started/succeeded/failed`,
`import_credit_spent`, `paywall_viewed`, `paywall_plan_selected`,
`purchase_started/succeeded/failed/cancelled`, `purchases_restored`,
`recipe_cooked`, `meal_planned`.

## Jak to działa pod spodem (żebyś rozumiał)

Ekrany **nigdy** nie wołają PostHoga/Sentry bezpośrednio. Wołają tylko
`track('nazwa_zdarzenia')`. Jeden „sink" (ujście) decyduje, gdzie te zdarzenia
naprawdę lecą. Dziś sink = konsola. Jak założysz konto, podmieniasz **jedną
funkcję** i te same zdarzenia lecą do prawdziwego dashboardu — bez dotykania
ekranów. Cały przełącznik jest w `src/lib/analyticsProviders.ts`.

Wzorzec jest taki sam jak przy RevenueCat: **brak klucza = funkcja po cichu
wyłączona**, więc apka działa normalnie w Expo Go i w developmencie bez kont.

## Jak włączyć PostHog (analityka — darmowy plan wystarcza na start)

1. Załóż konto na https://posthog.com (wybierz region EU, jeśli chcesz dane w UE).
2. Skopiuj **Project API Key** i host.
3. Dopisz do `mobile/.env` (to są klucze publiczne `EXPO_PUBLIC_*`, bezpieczne w apce):
   ```
   EXPO_PUBLIC_POSTHOG_KEY=phc_twoj_klucz
   EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
   ```
4. Zainstaluj pakiet:
   ```
   npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
   ```
5. W `src/lib/analyticsProviders.ts` odkomentuj blok PostHog (jest tam gotowy).
6. **Przebuduj klienta** (dochodzi moduł natywny — sam JS nie wystarczy):
   ```
   npx expo run:ios
   ```
7. Gotowe — otwórz PostHog → **Funnels**, złóż lejek z powyższych zdarzeń.

## Jak włączyć Sentry (awarie)

1. Załóż konto na https://sentry.io, utwórz projekt „React Native", skopiuj **DSN**.
2. Dopisz do `mobile/.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://...@...ingest.sentry.io/...
   ```
3. Zainstaluj: `npx expo install @sentry/react-native`
4. Dodaj plugin Sentry do `app.json` w sekcji `plugins` (wg instrukcji Sentry dla Expo).
5. W `src/lib/analyticsProviders.ts` odkomentuj blok Sentry.
6. Przebuduj: `npx expo run:ios`.

## Uwaga o prywatności (App Store)

Gdy włączysz PostHog/Sentry, w App Store Connect trzeba zadeklarować zbieranie
danych (App Privacy). Zwykle: „Usage Data / Diagnostics", zwykle **nie** powiązane
z tożsamością do celów śledzenia reklamowego. Nie zbieraj PII w propsach zdarzeń
(używamy tylko `userId` z Supabase + nieosobowe liczby jak `creditsLeft`).
