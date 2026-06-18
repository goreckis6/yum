# YumShare

Recipe library app built from the design prototype, with Expo React Native (TypeScript), local device storage, and a Node.js/Express backend for OpenAI recipe extraction.

## Project structure

- `mobile/` — Expo React Native app (runs in Expo Go on iPhone)
- `backend/` — Express API (keeps OpenAI API key off the device)
- `YumShare.dc.html` — interactive design prototype

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm start
```

The API listens on `http://0.0.0.0:3001`. Without an API key it returns demo recipe data so you can test the full flow.

### 2. Mobile app

```bash
cd mobile
npm start
```

- **iPhone (Expo Go):** Scan the QR code. The app auto-detects your computer's LAN IP from the Metro bundler for API calls.
- **Web preview:** Press `w` in the terminal or open the web URL.

### 3. Recipe import flow

1. Tap **+** → **Paste Recipe Link**
2. Paste a blog, TikTok, Instagram, or YouTube URL
3. Backend fetches the page and uses OpenAI to extract structured recipe data
4. Review and edit on the import screen, then save to your local library

## Data storage

All recipes, grocery lists, and meal plans are saved with **AsyncStorage** on the device. Nothing is sent to a cloud database.

## Design fidelity

The app implements the main YumShare screens from the design file:

- Home (Organize / Plan / Cook / Track tabs)
- Recipe detail (ingredients, steps, nutrition)
- Link import + AI processing + review
- Grocery list (group by aisle or recipe)
- Meal plan
- Profile + onboarding

Features marked "coming soon" in the design (scan recipe, cookbooks, grocery ordering, CGM) show toast placeholders.

## Environment

| Variable | Where | Purpose |
|----------|-------|---------|
| `OPENAI_API_KEY` | `backend/.env` | Live recipe extraction |
| `EXPO_PUBLIC_API_URL` | optional | Override API URL (e.g. `http://192.168.1.5:3001`) |

## API endpoints

- `GET /health` — server status
- `POST /api/extract-recipe` — `{ "url": "https://..." }` → structured recipe JSON
