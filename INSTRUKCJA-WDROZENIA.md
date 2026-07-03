# Paragon AI — wdrożenie na Vercel + Groq

## Co jest w paczce
- `src/App.jsx` — cała aplikacja
- `src/main.jsx`, `index.html`, `vite.config.js`, `package.json` — projekt Vite
- `.env.example` — wzór pliku z kluczem API

## 1. Klucz API Groq (darmowy)
1. Wejdź na https://console.groq.com → załóż konto
2. Sekcja **API Keys** → **Create API Key** → skopiuj klucz (zaczyna się od `gsk_...`)

## 2. Wdrożenie na Vercel (najprościej — przez GitHub)
1. Wrzuć te pliki do swojego repo na GitHubie (podmień stare `src/`)
2. W panelu Vercel projekt zimportuje się sam jako **Vite** (Framework Preset: Vite)
3. **Settings → Environment Variables** → dodaj:
   - Name: `VITE_GROQ_API_KEY`
   - Value: Twój klucz `gsk_...`
4. **Redeploy** (Deployments → ... → Redeploy) — zmienne środowiskowe działają dopiero po przebudowaniu

## 3. Test lokalnie (opcjonalnie)
```
npm install
cp .env.example .env     # wklej swój klucz do .env
npm run dev
```

## WAŻNE — bezpieczeństwo
Ten setup wkłada klucz do frontendu — jest widoczny w przeglądarce.
To OK do **testów i MVP**, ale przy publicznej aplikacji KTOŚ może go podejrzeć i zużyć Twój limit.
Docelowo klucz powinien być na serwerze (Vercel Serverless Function `/api/scan`).
Daj znać — przygotuję tę wersję, gdy będziesz gotowy wyjść z testów.

## Czego się spodziewać
- Skanowanie działa po dodaniu klucza (model Llama 4 Scout — darmowy, ale słabszy
  na polskich paragonach niż Claude; do testów wystarczy)
- Bez klucza: aplikacja działa w całości poza skanem (ręczne dodawanie, cele,
  budżety, analiza) — zobaczysz komunikat o braku klucza przy próbie skanu
