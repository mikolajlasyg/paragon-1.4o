import { useState, useEffect, useMemo, useRef, Component } from "react";

/* ============================================================
   PARAGON AI · v3 "Velvet+"
   Nowości: aparat w aplikacji (getUserMedia), profil, ustawienia,
   plany Starter/Pro/Family z limitami, eksport CSV, trial 14 dni.
   ============================================================ */

const CATEGORIES = [
  { slug: "nabial", name: "Nabiał", icon: "🥛", color: "#5BB8E8" },
  { slug: "mieso", name: "Mięso i wędliny", icon: "🥩", color: "#E87E7E" },
  { slug: "pieczywo", name: "Pieczywo", icon: "🥖", color: "#D9A968" },
  { slug: "owoce_warzywa", name: "Owoce i warzywa", icon: "🥦", color: "#7FC97F" },
  { slug: "slodycze", name: "Słodycze i przekąski", icon: "🍫", color: "#BC85D4" },
  { slug: "napoje", name: "Napoje", icon: "🥤", color: "#54CBDC" },
  { slug: "alkohol", name: "Alkohol", icon: "🍺", color: "#EFB45C" },
  { slug: "jedzenie_inne", name: "Jedzenie — inne", icon: "🍝", color: "#A8CB6E" },
  { slug: "chemia", name: "Chemia domowa", icon: "🧴", color: "#8490DC" },
  { slug: "kosmetyki", name: "Kosmetyki i higiena", icon: "🧼", color: "#EC86B2" },
  { slug: "leki", name: "Apteka i zdrowie", icon: "💊", color: "#5FC6B5" },
  { slug: "dziecko", name: "Dziecko", icon: "🍼", color: "#F0D169" },
  { slug: "zwierzeta", name: "Zwierzęta", icon: "🐾", color: "#B0917D" },
  { slug: "paliwo", name: "Paliwo i auto", icon: "⛽", color: "#93A6B2" },
  { slug: "dom_ogrod", name: "Dom i ogród", icon: "🛠️", color: "#A07D6C" },
  { slug: "odziez", name: "Odzież i obuwie", icon: "👕", color: "#A189DB" },
  { slug: "elektronika", name: "Elektronika", icon: "🔌", color: "#6FA8EC" },
  { slug: "inne", name: "Inne", icon: "📦", color: "#A8B4BB" },
];
const catBySlug = (s) => CATEGORIES.find((c) => c.slug === s) || CATEGORIES[17];

const STORES = ["Biedronka", "Lidl", "Żabka", "Kaufland", "Rossmann", "Orlen", "Leroy Merlin", "Auchan", "Inny sklep"];
const MONTHS_PL = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

const PLANS = [
  { id: "free", name: "Free", price: "0", limit: 5, tagline: "Na start",
    features: ["5 skanów AI miesięcznie", "Ręczne dodawanie bez limitu", "Pulpit i analiza miesięczna", "1 konto"] },
  { id: "starter", name: "Starter", price: "9,99", limit: 30, tagline: "Na początek",
    features: ["30 skanów AI miesięcznie", "Cele oszczędnościowe (skarbonki)", "Historia i wyszukiwarka paragonów", "1 konto"] },
  { id: "pro", name: "Pro", price: "19,99", limit: null, tagline: "Najpopularniejszy",
    features: ["Wszystko ze Startera", "Paragony bez limitu", "Lista zakupów z Twojej historii", "Budżety kategorii + eksport CSV"] },
  { id: "family", name: "Family", price: "29,99", limit: null, tagline: "Dla domu",
    features: ["Wszystko z planu Pro", "Do 5 kont domowników", "Wspólne cele i lista zakupów", "Podział wydatków na osoby"] },
];

const zl = (n) => (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
const num = (n) => (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthKey = (d) => (d || "").slice(0, 7);
const todayKey = () => new Date().toISOString().slice(0, 10);
const nowMonth = () => todayKey().slice(0, 7);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* Pamięć trwała: w podglądzie Claude działa window.storage; poza nim (Vercel) localStorage. */
const store = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
        return await window.storage.get(key);
      }
    } catch (e) { /* fallback niżej */ }
    try {
      const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      return v != null ? { value: v } : null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.set === "function") {
        return await window.storage.set(key, value);
      }
    } catch (e) { /* fallback niżej */ }
    try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch (e) { /* brak miejsca */ }
  },
};

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS_SHORT[(m || 1) - 1]} ${y}`;
}
function monthLabel(mk) { const [y, m] = mk.split("-").map(Number); return `${MONTHS_PL[(m || 1) - 1]} ${y}`; }

/* Pełne statystyki miesiąca do podsumowania ("Twój miesiąc w liczbach") */
function computeMonthStats(receipts, mk) {
  const rs = receipts.filter((r) => (r.date || "").slice(0, 7) === mk);
  const total = rs.reduce((s, r) => s + (Number(r.total) || 0), 0);
  const prevMk = (() => { const [y, m] = mk.split("-").map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
  const prevTotal = receipts.filter((r) => (r.date || "").slice(0, 7) === prevMk).reduce((s, r) => s + (Number(r.total) || 0), 0);
  const delta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  // kategorie
  const catMap = {};
  rs.forEach((r) => r.items.forEach((i) => { if ((Number(i.total_price) || 0) > 0) { const cat = i.category || "inne"; catMap[cat] = (catMap[cat] || 0) + Number(i.total_price); } }));
  const cats = Object.entries(catMap).map(([slug, value]) => ({ slug, value })).sort((a, b) => b.value - a.value);
  // sklepy
  const storeMap = {};
  rs.forEach((r) => { const s = r.store || "Inny"; storeMap[s] = (storeMap[s] || 0) + (Number(r.total) || 0); });
  const stores = Object.entries(storeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const storeVisits = {};
  rs.forEach((r) => { const s = r.store || "Inny"; storeVisits[s] = (storeVisits[s] || 0) + 1; });
  const mostVisited = Object.entries(storeVisits).sort((a, b) => b[1] - a[1])[0];
  // dni
  const [y, m] = mk.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrent = mk === new Date().toISOString().slice(0, 7);
  const daysElapsed = isCurrent ? new Date().getDate() : daysInMonth;
  const dailyAvg = daysElapsed > 0 ? total / daysElapsed : 0;
  // największy paragon
  const biggest = rs.reduce((mx, r) => (Number(r.total) || 0) > (Number(mx?.total) || 0) ? r : mx, null);
  // liczba pozycji
  const itemCount = rs.reduce((s, r) => s + r.items.filter((i) => (Number(i.total_price) || 0) > 0).length, 0);
  return { mk, rs, total, prevTotal, delta, cats, stores, mostVisited, dailyAvg, biggest, itemCount, count: rs.length, daysInMonth };
}
function shiftMonth(mk, delta) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function daysInMonth(mk) { const [y, m] = mk.split("-").map(Number); return new Date(y, m, 0).getDate(); }

/* ---------- tokeny ---------- */
const T = {
  bg: "#0A1410", glass: "rgba(255,255,255,0.045)", glassBorder: "rgba(255,255,255,0.08)",
  glassBorderSoft: "rgba(255,255,255,0.055)", mint: "#2DD4A0", mintDeep: "#16916B",
  gold: "#D8B878", paper: "#FAF7F0", paperInk: "#1C2620", paperSub: "#8A938C",
  text: "#EDF3EF", sub: "#93A69C", faint: "#5E7268", danger: "#E6766D", warn: "#E5C46B",
  easeOut: "cubic-bezier(0.23, 1, 0.32, 1)",
};
const TIER_BADGE = {
  free: { label: "FREE", color: "#9FB3A9" },
  starter: { label: "STARTER", color: "#A8B8C2" },
  pro: { label: "PRO", color: T.mint },
  family: { label: "FAMILY", color: T.gold },
};
const MEMBER_COLORS = ["#2DD4A0", "#D8B878", "#5BB8E8", "#EC86B2", "#A189DB"];
const BUDGET_CATS = ["nabial", "mieso", "jedzenie_inne", "chemia", "kosmetyki", "napoje"];

/* ---------- przykładowe dane ---------- */
function demoReceipts() {
  const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const R = (date, store, items) => ({
    id: uid(), store, date,
    items: items.map(([name, total_price, category, qty = 1]) => ({ id: uid(), name, qty, total_price, category })),
    total: Math.round(items.reduce((s, i) => s + i[1], 0) * 100) / 100, createdAt: Date.now(),
  });
  // Produkty z powtarzalnym rytmem — daty liczone względem DZIŚ, by "Lista zakupów" miała dane.
  // Mleko ~co 4 dni (ostatnio 5 dni temu → pora dokupić). Chleb ~co 3 dni (ostatnio 4 dni temu → pora).
  // Kawa ~co 7 dni (ostatnio 6 dni temu → niedługo). Karma kota ~co 14 dni (ostatnio 13 dni temu → pora).
  return [
    R(dayOffset(4), "Biedronka", [["Mleko Łaciate 3,2% 1L", 4.29, "nabial", 2], ["Chleb wiejski krojony", 5.49, "pieczywo"], ["Masło ekstra 82%", 7.99, "nabial"], ["Pomidory malinowe", 9.98, "owoce_warzywa"]]),
    R(dayOffset(5), "Żabka", [["Bułka kajzerka ×4", 2.99, "pieczywo"], ["Coca-Cola 1,5L", 8.99, "napoje"]]),
    R(dayOffset(6), "Lidl", [["Kawa Lavazza mielona 250g", 21.99, "napoje"], ["Jogurt Pilos 4-pak", 6.49, "nabial"], ["Filet z piersi kurczaka", 14.67, "mieso"], ["Banany luz 0,82kg", 5.43, "owoce_warzywa"]]),
    R(dayOffset(8), "Biedronka", [["Mleko Łaciate 3,2% 1L", 4.29, "nabial", 2], ["Chleb wiejski krojony", 5.49, "pieczywo"], ["Ser Gouda w plastrach", 7.99, "nabial"]]),
    R(dayOffset(11), "Kaufland", [["Mleko Łaciate 3,2% 1L", 4.19, "nabial"], ["Chleb wiejski krojony", 5.29, "pieczywo"], ["Karma Whiskas ×12", 32.99, "zwierzeta"], ["Papier toaletowy 8 rolek", 12.99, "chemia"]]),
    R(dayOffset(13), "Lidl", [["Kawa Lavazza mielona 250g", 22.49, "napoje"], ["Jogurt Pilos 4-pak", 6.49, "nabial"], ["Masło ekstra 82%", 8.19, "nabial"]]),
    R(dayOffset(15), "Biedronka", [["Mleko Łaciate 3,2% 1L", 4.29, "nabial"], ["Chleb wiejski krojony", 5.49, "pieczywo"], ["Schab b/k ok. 0,75kg", 18.74, "mieso"], ["Czekolada Milka mleczna", 6.49, "slodycze"]]),
    R(dayOffset(18), "Rossmann", [["Szampon Head & Shoulders", 19.99, "kosmetyki"], ["Pasta Colgate Total", 8.49, "kosmetyki"], ["Płyn do naczyń Fairy", 9.99, "chemia"]]),
    R(dayOffset(20), "Lidl", [["Mleko Łaciate 3,2% 1L", 4.19, "nabial"], ["Kawa Lavazza mielona 250g", 21.99, "napoje"], ["Jogurt Pilos 4-pak", 6.29, "nabial"], ["Piwo Perła Export 4-pak", 14.96, "alkohol"]]),
    R(dayOffset(25), "Kaufland", [["Karma Whiskas ×12", 32.49, "zwierzeta"], ["Mleko Łaciate 3,2% 1L", 4.29, "nabial"], ["Chleb wiejski krojony", 5.29, "pieczywo"], ["Jabłka Ligol 1,2kg", 6.78, "owoce_warzywa"]]),
    R(dayOffset(28), "Orlen", [["Paliwo PB95 32,4L", 198.5, "paliwo"], ["Kawa latte z automatu", 9.99, "napoje"]]),
  ];
}

/* ---------- obraz: skalowanie ---------- */
async function dataUrlScaled(dataUrl, maxSide = 1568) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Nie udało się otworzyć zdjęcia"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: out.split(",")[1], mediaType: "image/jpeg", preview: out };
}
async function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Nie udało się odczytać pliku"));
    r.readAsDataURL(file);
  });
}

/* ---------- analiza powtarzalnych zakupów (Pro+) ---------- */
const normName = (s) => (s || "").toLowerCase().trim()
  .replace(/\d+([.,]\d+)?\s?(kg|g|l|ml|szt|x|%)\b/gi, "")
  .replace(/[.,;:()]/g, " ").replace(/\s+/g, " ").trim();
function analyzeRecurring(receipts) {
  const map = {};
  receipts.forEach((r) => {
    const day = r.date;
    if (!day) return;
    r.items.forEach((i) => {
      if (i.name === "Wydatek ręczny") return;
      const key = normName(i.name);
      if (key.length < 3) return;
      const e = map[key] = map[key] || { key, name: i.name, category: i.category, dates: [], lastPrice: 0, totalSpent: 0, times: 0 };
      e.dates.push(day); e.times += 1; e.totalSpent += Number(i.total_price) || 0;
      if (day >= (e.lastDay || "")) { e.lastDay = day; e.lastPrice = Number(i.total_price) || 0; e.name = i.name; }
    });
  });
  const today = new Date(todayKey());
  const out = [];
  Object.values(map).forEach((e) => {
    if (e.times < 2) return; // potrzebujemy min. 2 zakupów, by mówić o cyklu
    const sorted = [...new Set(e.dates)].sort();
    let gaps = [];
    for (let k = 1; k < sorted.length; k++) {
      const d = (new Date(sorted[k]) - new Date(sorted[k - 1])) / 864e5;
      if (d > 0) gaps.push(d);
    }
    if (!gaps.length) return;
    const avgGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const sinceLast = Math.round((today - new Date(e.lastDay)) / 864e5);
    const ratio = avgGap > 0 ? sinceLast / avgGap : 0;
    out.push({ ...e, avgGap, sinceLast, ratio, due: ratio >= 0.8 });
  });
  return out.sort((a, b) => b.ratio - a.ratio);
}
function cycleLabel(avgGap) {
  if (avgGap <= 2) return "co 1–2 dni";
  if (avgGap <= 4) return "co kilka dni";
  if (avgGap <= 9) return "co tydzień";
  if (avgGap <= 18) return "co ~2 tygodnie";
  if (avgGap <= 45) return "co miesiąc";
  return `co ~${Math.round(avgGap / 30)} mies.`;
}

/* Plan odkładania na cel z datą docelową */
function goalPace(goal) {
  if (!goal.deadline) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(goal.deadline); end.setHours(0, 0, 0, 0);
  const remaining = Math.max((Number(goal.target) || 0) - (Number(goal.saved) || 0), 0);
  const daysLeft = Math.round((end - today) / 864e5);
  const done = (Number(goal.saved) || 0) >= (Number(goal.target) || 0);
  if (done) return { done: true, daysLeft, status: "done" };
  const overdue = daysLeft < 0;
  // ile miesięcy zostało (min. ułamek), do wyliczenia rat
  const monthsLeft = Math.max(daysLeft / 30.44, 0);
  const perMonth = monthsLeft > 0.03 ? remaining / monthsLeft : remaining;
  const perWeek = daysLeft > 0 ? remaining / (daysLeft / 7) : remaining;
  // status: ile "powinno" być odłożone na dziś (liniowo od utworzenia? nie mamy startu — użyjemy prostego progu tempa)
  let status = "ontrack";
  if (overdue) status = "overdue";
  else if (perMonth > 0 && remaining > 0) {
    // jeśli zostało <7 dni i wciąż sporo — ostrzeżenie
    if (daysLeft <= 7 && remaining > (Number(goal.target) || 1) * 0.15) status = "behind";
  }
  return { done: false, daysLeft, monthsLeft, perMonth: Math.round(perMonth * 100) / 100, perWeek: Math.round(perWeek * 100) / 100, remaining, overdue, status };
}
function deadlineLabel(deadline) {
  if (!deadline) return "";
  const [y, m, d] = deadline.split("-").map(Number);
  return `${d} ${["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"][(m || 1) - 1]} ${y}`;
}

/* ---------- parsowanie przez Claude ---------- */
function extractJSON(text) {
  if (!text) return null;
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); } catch (e) { /* próbujemy wyłuskać */ }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch (e) { /* nadal nie */ }
  }
  return null;
}
async function parseReceiptWithAI(base64, mediaType) {
  const slugs = CATEGORIES.map((c) => c.slug).join("|");
  const prompt = `Jesteś precyzyjnym parserem polskich paragonów fiskalnych. Odczytaj zdjęcie i zwróć WYŁĄCZNIE poprawny JSON (bez markdown, bez komentarzy, bez tekstu wokół):
{"store":"<jedna z: ${STORES.join(", ")}>","date":"YYYY-MM-DD","total":0.00,"items":[{"name":"nazwa po polsku, czytelna","qty":1,"total_price":0.00,"category":"<slug>"}]}
Dozwolone slugi kategorii: ${slugs}.

KRYTYCZNE ZASADY DOT. RABATÓW I OPUSTÓW (najczęstszy błąd):
- Każdą linię typu "RABAT", "OPUST", "PROMOCJA", "ZNIŻKA", "-X,XX", linie zaczynające się od minusa, lub linie z ujemną kwotą — MUSISZ odjąć od pozycji bezpośrednio powyżej.
- Linia rabatu NIE jest osobną pozycją — NIGDY nie dodawaj jej do "items".
- Przykład: jeśli widzisz "JOGURT 8,99" a linijkę niżej "RABAT -2,00" — w JSON ma być JEDNA pozycja: {"name":"Jogurt","total_price":6.99}, NIE dwie.
- "total" to ostateczna kwota DO ZAPŁATY (linia SUMA/RAZEM/PLN) — po wszystkich rabatach.
- Suma wszystkich items.total_price MUSI być równa polu total (± 0,01 zł). To jest test poprawności — jeśli się nie zgadza, znalazłeś rabat którego nie odjąłeś.

POZOSTAŁE ZASADY:
- Czytaj WSZYSTKIE pozycje, nawet przy słabej jakości zdjęcia.
- Pomiń linie: PTU, SUMA PTU, NIP, numery systemowe, "Niefiskalny", "Reszta", reklamy, "Karta lojalnościowa".
- Rozwiń skróty ("MLEKO ŁAC.UHT 3,2%" → "Mleko Łaciate UHT 3,2%").
- Kwoty z przecinkiem zamień na kropkę.
- Jeśli daty nie widać, ustaw "date": null.
- Jeśli na zdjęciu NIE ma paragonu/rachunku, zwróć dokładnie {"error":"not_receipt"}.`;

  // Klucz Groq z env (Vite). NIGDY nie wpisuj klucza na sztywno w kodzie.
  const apiKey = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GROQ_API_KEY) || (typeof window !== "undefined" && window.GROQ_API_KEY) || "";
  if (!apiKey) throw new Error("nokey");

  let response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0,
        max_completion_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
        ]}],
      }),
    });
  } catch (e) {
    throw new Error("network");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("nokey");
    if (response.status === 429) throw new Error("rate");
    let bodyText = "";
    try { bodyText = (await response.text()).slice(0, 180); } catch (e) { /* nic */ }
    const err = new Error("http");
    err.detail = `HTTP ${response.status}${bodyText ? " · " + bodyText : ""}`;
    throw err;
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "";
  const parsed = extractJSON(text);
  if (!parsed) throw new Error("parse");
  if (parsed.error === "not_receipt") throw new Error("not_receipt");
  if (!Array.isArray(parsed.items)) parsed.items = [];

  // Post-walidacja rabatów: jeśli model nie odjął rabatów, suma items > total.
  // Dorzucamy pozycję "Rabat" z różnicą, żeby końcówka zgadzała się z paragonem.
  const itemsSum = parsed.items.reduce((s, i) => s + (Number(i.total_price) || 0), 0);
  const total = Number(parsed.total) || 0;
  if (total > 0 && itemsSum - total > 0.5) {
    const diff = Math.round((total - itemsSum) * 100) / 100; // ujemne
    parsed.items.push({ name: "Rabat / opust", qty: 1, total_price: diff, category: "inne" });
  }
  return parsed;
}

/* ---------- eksport CSV ---------- */
function exportCSV(receipts) {
  const rows = [["Data", "Sklep", "Produkt", "Kategoria", "Kwota (zł)"]];
  [...receipts].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((r) =>
    r.items.forEach((i) => rows.push([r.date, r.store, i.name, catBySlug(i.category).name, String(Number(i.total_price).toFixed(2)).replace(".", ",")]))
  );
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `paragon-ai-${todayKey()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- hooki ---------- */
function useCountUp(value, dur = 700) {
  const [v, setV] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current, to = Number(value) || 0;
    if (from === to) { setV(to); return; }
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return v;
}

/* ---------- style globalne ---------- */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      * { -webkit-tap-highlight-color: transparent; }
      .pa-display { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }
      .pa-body { font-family: 'Inter', sans-serif; }
      .pa-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
      .pa-press { transition: transform 130ms ${T.easeOut}, opacity 130ms ease; }
      .pa-press:active { transform: scale(0.97); }
      .pa-fade { animation: paFade 280ms ${T.easeOut} both; }
      @keyframes paFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .pa-rise { animation: paRise 320ms ${T.easeOut} both; }
      @keyframes paRise { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .pa-sheet { animation: paSheet 280ms ${T.easeOut} both; }
      @keyframes paSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
      .pa-dim { animation: paDim 200ms ease both; }
      @keyframes paDim { from { opacity: 0; } to { opacity: 1; } }
      .pa-pulse { animation: paPulse 1.3s ease-in-out infinite; }
      @keyframes paPulse { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
      .pa-scan { animation: paScan 1.7s ${T.easeOut} infinite; }
      @keyframes paScan { 0% { transform: translateY(0) } 50% { transform: translateY(128px) } 100% { transform: translateY(0) } }
      .pa-shimmer { background: linear-gradient(100deg, rgba(255,255,255,.04) 35%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.04) 65%); background-size: 220% 100%; animation: paShim 1.4s linear infinite; }
      @keyframes paShim { from { background-position: 200% 0 } to { background-position: -20% 0 } }
      .pa-pop { animation: paPop 360ms ${T.easeOut} both; }
      @keyframes paPop { 0% { opacity:0; transform: scale(.8) } 60% { transform: scale(1.04) } 100% { opacity:1; transform: scale(1) } }
      .pa-aurora { position: absolute; border-radius: 50%; filter: blur(34px); pointer-events: none; animation: paAurora 14s ease-in-out infinite alternate; }
      @keyframes paAurora { 0% { transform: translate(0,0) scale(1) } 100% { transform: translate(18px,-22px) scale(1.18) } }
      .pa-sheen { position: relative; overflow: hidden; }
      .pa-sheen::after { content:''; position:absolute; top:0; left:-60%; width:45%; height:100%;
        background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent); transform: skewX(-18deg);
        animation: paSheen 5.5s ease-in-out infinite; }
      @keyframes paSheen { 0%,72% { left:-60% } 86% { left:130% } 100% { left:130% } }
      .pa-glow { animation: paGlow 2.6s ease-in-out infinite; }
      @keyframes paGlow { 0%,100% { box-shadow: 0 10px 28px ${T.mint}44, inset 0 1.5px 0 rgba(255,255,255,.45), 0 0 0 5px rgba(10,20,16,.9) } 50% { box-shadow: 0 12px 34px ${T.mint}77, inset 0 1.5px 0 rgba(255,255,255,.5), 0 0 0 5px rgba(10,20,16,.9) } }
      .pa-zz-paper { height: 9px; background:
        linear-gradient(-45deg, transparent 6.5px, ${T.paper} 0) 0 0 / 13px 13px repeat-x,
        linear-gradient(45deg, transparent 6.5px, ${T.paper} 0) 0 0 / 13px 13px repeat-x; }
      .pa-zz-paper-top { height: 9px; background:
        linear-gradient(-135deg, transparent 6.5px, ${T.paper} 0) 0 0 / 13px 13px repeat-x,
        linear-gradient(135deg, transparent 6.5px, ${T.paper} 0) 0 0 / 13px 13px repeat-x; }
      .pa-barcode { height: 30px; background: repeating-linear-gradient(90deg,
        ${T.paperInk} 0 2px, transparent 2px 4px, ${T.paperInk} 4px 5px, transparent 5px 9px,
        ${T.paperInk} 9px 12px, transparent 12px 14px, ${T.paperInk} 14px 15px, transparent 15px 17px,
        ${T.paperInk} 17px 19px, transparent 19px 24px); opacity:.82; }
      input, select { color-scheme: dark; }
      input:focus, select:focus { outline: none; border-color: ${T.mint}99 !important; box-shadow: 0 0 0 3px ${T.mint}1F; }
      select { -webkit-appearance: none; appearance: none; }
      ::-webkit-scrollbar { display: none; }
      .pa-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
      @media (prefers-reduced-motion: reduce) {
        .pa-fade, .pa-rise, .pa-sheet, .pa-scan, .pa-shimmer, .pa-pop, .pa-aurora, .pa-glow { animation: none; }
        .pa-sheen::after { animation: none; display: none; }
      }
      .pa-noise { position: absolute; inset: 0; pointer-events: none; opacity: .035; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    `}</style>
  );
}

/* ---------- donut ---------- */
function Donut({ data, total, size = 168 }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(r); }, []);
  const r = 64, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  const animTotal = useCountUp(total, 800);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
      {data.map((d) => {
        const frac = total > 0 ? d.value / total : 0;
        const dash = ready ? Math.max(frac * C - 2.5, 0) : 0;
        const seg = (
          <circle key={d.slug} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="16"
            strokeDasharray={`${dash} ${C}`} strokeDashoffset={-acc * C} strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: `stroke-dasharray 700ms ${T.easeOut}` }} />
        );
        acc += frac;
        return seg;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" className="pa-mono" style={{ fontSize: 19, fontWeight: 600, fill: T.text }}>{num(animTotal)}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="pa-body" style={{ fontSize: 10.5, fill: T.faint, letterSpacing: ".08em" }}>ZŁ · TEN MIESIĄC</text>
    </svg>
  );
}

/* ---------- mini-wykres dzienny ---------- */
function DailyBars({ receipts, month }) {
  const days = daysInMonth(month);
  const per = useMemo(() => {
    const arr = Array(days).fill(0);
    receipts.forEach((r) => { const d = Number((r.date || "").slice(8, 10)); if (d >= 1 && d <= days) arr[d - 1] += Number(r.total) || 0; });
    return arr;
  }, [receipts, month, days]);
  const max = Math.max(...per, 1);
  const today = month === nowMonth() ? Number(todayKey().slice(8, 10)) : -1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 42 }}>
      {per.map((v, i) => {
        const h = v > 0 ? Math.max((v / max) * 42, 4) : 2;
        const isToday = i + 1 === today;
        return (
          <div key={i} title={`${i + 1}: ${zl(v)}`} style={{ flex: 1, height: h, borderRadius: 2,
            background: v > 0 ? (isToday ? T.gold : `linear-gradient(180deg, ${T.mint}, ${T.mintDeep})`) : "rgba(255,255,255,0.07)",
            transition: `height 500ms ${T.easeOut}`, opacity: v > 0 ? 1 : 0.6 }} />
        );
      })}
    </div>
  );
}

/* ---------- APARAT w aplikacji ---------- */
/* edycja profilu / dodanie domownika — własny stan = brak problemu z fokusem */
function InputSheet({ title, icon, note, fields, submitLabel, onSubmit, onClose }) {
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value || ""])));
  return (
    <div className="pa-dim" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(4,10,7,.62)", backdropFilter: "blur(3px)", zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div className="pa-sheet" onClick={(e) => e.stopPropagation()}
        style={{ background: "#13241C", border: "1px solid rgba(255,255,255,.08)", borderBottom: "none", width: "100%", borderRadius: "22px 22px 0 0", padding: "20px 18px 30px", boxShadow: "0 -16px 50px rgba(0,0,0,.5)" }}>
        <div className="pa-display" style={{ fontSize: 16.5, fontWeight: 600, color: T.text, marginBottom: note ? 6 : 16, display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <span style={{ fontSize: 18 }}>{icon}</span>}{title}
        </div>
        {note && <div className="pa-body" style={{ fontSize: 11.5, color: T.faint, marginBottom: 16, lineHeight: 1.5 }}>{note}</div>}
        {fields.map((f) => (
          <div key={f.key} style={{ marginBottom: 13 }}>
            <label className="pa-body" style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 }}>{f.label}</label>
            <input value={vals[f.key]} placeholder={f.placeholder || ""} type={f.type || "text"} min={f.min}
              onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
              className="pa-body" style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: `1px solid ${T.glassBorder}`, background: "rgba(255,255,255,.04)", fontSize: 14, color: T.text, boxSizing: "border-box" }} />
          </div>
        ))}
        <button className="pa-press pa-display" onClick={() => onSubmit(vals)}
          style={{ width: "100%", marginTop: 6, padding: "13px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, color: "#06251A", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 8px 24px ${T.mint}38` }}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/* szybkie ręczne dodawanie wydatku — długie przytrzymanie FAB */
function QuickAddSheet({ onSubmit, onClose }) {
  const [store, setStore] = useState(STORES[0]);
  const [date, setDate] = useState(todayKey());
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("jedzenie_inne");
  const [err, setErr] = useState("");
  const touchY = useRef(null);
  const fieldStyle = { width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", fontSize: 13.5, color: T.text, boxSizing: "border-box" };
  const submit = () => {
    const n = Number(String(amount).replace(",", ".").replace(/\s/g, ""));
    if (!(n > 0)) { setErr("Podaj kwotę większą od zera"); return; }
    onSubmit({ store, date: date || todayKey(), amount: Math.round(n * 100) / 100, category: cat });
  };
  return (
    <div className="pa-dim" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(4,10,7,.62)", backdropFilter: "blur(3px)", zIndex: 65, display: "flex", alignItems: "flex-end" }}>
      <div className="pa-sheet" onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
        onTouchMove={(e) => { if (touchY.current !== null && e.touches[0].clientY - touchY.current > 70) { touchY.current = null; onClose(); } }}
        onTouchEnd={() => { touchY.current = null; }}
        style={{ background: "#13241C", border: "1px solid rgba(255,255,255,.08)", borderBottom: "none", width: "100%", borderRadius: "22px 22px 0 0", padding: "14px 18px 30px", boxShadow: "0 -16px 50px rgba(0,0,0,.5)" }}>
        <div style={{ width: 38, height: 4, background: "rgba(255,255,255,.16)", borderRadius: 2, margin: "0 auto 12px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="pa-display" style={{ fontSize: 16.5, fontWeight: 600, color: T.text }}>⚡ Szybki wydatek</div>
          <button className="pa-press" onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: T.sub, fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <input type="text" inputMode="decimal" autoFocus value={amount} placeholder="0,00"
            onChange={(e) => { setAmount(e.target.value); if (err) setErr(""); }}
            className="pa-mono" style={{ width: 180, textAlign: "center", fontSize: 28, fontWeight: 600, padding: "10px 12px", borderRadius: 14,
              border: err ? `1.5px solid ${T.danger}` : "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: T.text, boxSizing: "border-box" }} />
          <div className="pa-body" style={{ fontSize: 11, color: T.faint, marginTop: 5 }}>kwota w zł</div>
          {err && <div className="pa-body" style={{ fontSize: 11.5, color: T.danger, marginTop: 6, fontWeight: 600 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <label className="pa-body" style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 }}>Sklep</label>
            <select value={store} onChange={(e) => setStore(e.target.value)} className="pa-body" style={fieldStyle}>
              {STORES.map((s) => <option key={s} style={{ background: "#13241C" }}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="pa-body" style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 }}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pa-body" style={fieldStyle} />
          </div>
          <div>
            <label className="pa-body" style={{ display: "block", fontSize: 10, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 }}>Kategoria</label>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="pa-body" style={fieldStyle}>
              {CATEGORIES.map((c) => <option key={c.slug} value={c.slug} style={{ background: "#13241C" }}>{c.icon} {c.name}</option>)}
            </select>
          </div>
        </div>
        <button className="pa-press pa-display" onClick={submit}
          style={{ width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, color: "#06251A", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 8px 24px ${T.mint}38` }}>
          Dodaj wydatek
        </button>
      </div>
    </div>
  );
}

/* ---------- przetwarzanie ---------- */
const PROCESSING_STEPS = ["Odczytuję paragon…", "Rozpoznaję produkty…", "Przypisuję kategorie…", "Liczę sumy…"];
function ProcessingView({ preview }) {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep((s) => (s + 1) % PROCESSING_STEPS.length), 1700); return () => clearInterval(t); }, []);
  return (
    <div className="pa-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ position: "relative", width: 138, height: 180, borderRadius: 12, overflow: "hidden", background: T.paper, boxShadow: "0 18px 50px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.08)" }}>
        {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div className="pa-shimmer" style={{ width: "100%", height: "100%" }} />}
        <div className="pa-scan" style={{ position: "absolute", left: -6, right: -6, top: 20, height: 2.5, background: T.mint, boxShadow: `0 0 18px 4px ${T.mint}77` }} />
      </div>
      <div className="pa-display pa-pulse" style={{ marginTop: 26, fontSize: 15.5, fontWeight: 600, color: T.text }}>{PROCESSING_STEPS[step]}</div>
      <div className="pa-body" style={{ marginTop: 7, fontSize: 12, color: T.faint }}>Claude analizuje zdjęcie · zwykle 5–10 sekund</div>
      <div style={{ display: "flex", gap: 5, marginTop: 18 }}>
        {PROCESSING_STEPS.map((_, i) => (
          <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? T.mint : "rgba(255,255,255,.14)", transition: `all 250ms ${T.easeOut}` }} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================ APLIKACJA */
function ParagonAIInner() {
  const [receipts, setReceipts] = useState([]);
  const [plan, setPlan] = useState(null);           // {tier, trialEndsAt?, members?[]}
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [settings, setSettings] = useState({ push: true, budget: true, weekly: true });
  const [quota, setQuota] = useState({ month: nowMonth(), used: 0 });
  const [budget, setBudget] = useState(null);
  const [budgets, setBudgets] = useState({});
  const [quickAdd, setQuickAdd] = useState(false);
  const [restockDone, setRestockDone] = useState({});
  const [goals, setGoals] = useState([]); // [{id,name,target,saved,icon}]
  const [income, setIncome] = useState(null); // miesięczny dochód (do "wolnych środków")
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState("pulpit");
  const [view, setView] = useState({ name: "tabs" }); // tabs|scan|camera|verify|details|plans
  const [month, setMonth] = useState(nowMonth());
  const [scan, setScan] = useState({ step: "pick" });
  const [draft, setDraft] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [inputSheet, setInputSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [drill, setDrill] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [selPlan, setSelPlan] = useState("pro");
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [tab, view.name]);

  /* ---- trwały zapis (jeden klucz) ---- */
  useEffect(() => {
    (async () => {
      let st = null;
      try {
        const res = await store.get("paragon-state");
        if (res && res.value) st = JSON.parse(res.value);
      } catch (e) { /* brak */ }
      if (!st) {
        // migracja ze starej wersji
        try {
          const old = await store.get("paragon-receipts");
          if (old && old.value) st = { receipts: JSON.parse(old.value) };
        } catch (e) { /* brak */ }
      }
      if (st) {
        setReceipts(st.receipts || []);
        setProfile(st.profile || { name: "", email: "" });
        setSettings(st.settings || { push: true, budget: true, weekly: true });
        setQuota(st.quota && st.quota.month === nowMonth() ? st.quota : { month: nowMonth(), used: 0 });
        setPlan(st.plan && st.plan.tier && st.plan.tier !== "trial" ? st.plan : { tier: "free" });
        setBudget(typeof st.budget === "number" && st.budget > 0 ? st.budget : null);
        setBudgets(st.budgets && typeof st.budgets === "object" ? st.budgets : {});
        setGoals(Array.isArray(st.goals) ? st.goals : []);
        setIncome(typeof st.income === "number" && st.income > 0 ? st.income : null);
      } else {
        // Pierwsze uruchomienie — czysty start: pusto, plan Free (jak u prawdziwego użytkownika).
        // Przykładowe dane można w każdej chwili wczytać z Profilu.
        setPlan({ tier: "free" });
      }
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { await store.set("paragon-state", JSON.stringify({ receipts, plan, profile, settings, quota, budget, budgets, goals, income })); }
      catch (e) { console.error(e); }
    })();
  }, [receipts, plan, profile, settings, quota, budget, budgets, goals, income, loaded]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  /* ---- plan / limity ---- */
  const effTier = plan?.tier && TIER_BADGE[plan.tier] ? plan.tier : "free";
  const tierLimit = effTier === "free" ? 5 : effTier === "starter" ? 30 : null;
  const canScan = tierLimit === null || quota.used < tierLimit;
  const badge = TIER_BADGE[effTier];
  const isPro = effTier === "pro" || effTier === "family";
  const hasGoals = effTier === "starter" || isPro; // cele: od Startera w górę
  const GOAL_ICONS = ["🎯", "✈️", "🏖️", "🚗", "🎁", "🏠", "💻", "📱", "🎓", "💍"];
  function addGoal(name, target, icon, deadline) {
    setGoals((g) => [...g, { id: uid(), name: name.trim(), target: Math.round(target * 100) / 100, saved: 0, icon: icon || "🎯", deadline: deadline || null }]);
  }
  function depositGoal(id, amount) {
    if (income != null && freeFunds != null && amount > freeFunds) return false;
    setGoals((g) => g.map((x) => x.id === id ? { ...x, saved: Math.max(0, Math.round((x.saved + amount) * 100) / 100) } : x));
    return true;
  }
  const members = effTier === "family" ? (plan?.members || []) : [];
  const memberName = (id) => members.find((m) => m.id === id)?.name || members[0]?.name || "Ty";

  function activatePlan(id) {
    setPlan((prev) => ({ tier: id, members: id === "family" ? (prev?.members?.length ? prev.members : [{ id: uid(), name: profile.name || "Ty", owner: true }]) : undefined }));
    setView({ name: "tabs" }); setTab("profil");
    showToast(id === "free" ? "Jesteś na planie Free" : `Plan ${PLANS.find((p) => p.id === id).name} aktywny 🎉`);
  }

  /* ---- długie przytrzymanie FAB → szybki wydatek ---- */
  const lpTimer = useRef(null);
  const lpFired = useRef(false);
  const fabDown = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    lpFired.current = false;
    lpTimer.current = setTimeout(() => { lpFired.current = true; navigator.vibrate?.(30); setQuickAdd(true); }, 500);
  };
  const fabUp = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
  const fabClick = () => { if (lpFired.current) { lpFired.current = false; return; } startScan(); };

  /* ---- skanowanie ---- */
  function startScan() {
    if (!canScan) { setView({ name: "plans", reason: "limit" }); return; }
    setView({ name: "scan" }); setScan({ step: "pick" });
  }
  async function processDataUrl(dataUrl) {
    setView({ name: "scan" });
    setScan({ step: "processing" });
    try {
      const { base64, mediaType, preview } = await dataUrlScaled(dataUrl);
      setScan({ step: "processing", preview });
      const parsed = await parseReceiptWithAI(base64, mediaType);
      const items = (parsed.items || []).map((i) => ({
        id: uid(), name: i.name || "Pozycja", qty: Number(i.qty) || 1,
        total_price: Math.round((Number(i.total_price) || 0) * 100) / 100,
        category: CATEGORIES.some((c) => c.slug === i.category) ? i.category : "inne",
      }));
      setDraft({
        id: uid(), store: STORES.includes(parsed.store) ? parsed.store : "Inny sklep",
        date: parsed.date || todayKey(),
        total: Math.round((Number(parsed.total) || items.reduce((s, i) => s + i.total_price, 0)) * 100) / 100,
        items, createdAt: Date.now(), scanned: true,
      });
      setView({ name: "verify" });
      setScan({ step: "pick" });
      if (!items.length) showToast("Odczytałem paragon, ale nie pozycje — dodaj je ręcznie");
    } catch (e) {
      const reasons = {
        nokey: "Brak klucza API Groq. Dodaj klucz w ustawieniach projektu (VITE_GROQ_API_KEY), aby włączyć skanowanie. Na razie możesz dodawać paragony ręcznie.",
        not_receipt: "To zdjęcie nie wygląda na paragon. Wykadruj sam paragon i spróbuj ponownie.",
        network: "Brak połączenia z internetem. Sprawdź sieć i spróbuj ponownie.",
        rate: "Za dużo zapytań w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.",
        http: "Usługa rozpoznawania chwilowo nie odpowiada. Spróbuj ponownie za moment.",
        parse: "Nie udało się odczytać tego paragonu. Zrób ostrzejsze zdjęcie w dobrym świetle albo dodaj wpis ręcznie.",
      };
      const reasonMsg = reasons[e.message] || `Nie udało się odczytać paragonu. ${e.detail || "Sprawdź ostrość i oświetlenie."}`;
      setScan({ step: "error", reason: reasonMsg });
    }
  }
  async function handleFile(file) {
    if (!file) return;
    if (!canScan) { setView({ name: "plans", reason: "limit" }); return; }
    try { processDataUrl(await fileToDataUrl(file)); }
    catch (e) { setScan({ step: "error", reason: "Nie udało się odczytać pliku." }); setView({ name: "scan" }); }
  }
  function newManualDraft() {
    setDraft({ id: uid(), store: "Biedronka", date: todayKey(), total: 0, items: [], createdAt: Date.now(), manual: true });
    setView({ name: "verify" });
  }
  function saveDraft() {
    const items = draft.items.map((i) => ({ ...i, total_price: Math.round((Number(String(i.total_price).replace(",", ".")) || 0) * 100) / 100 }));
    const total = items.length ? Math.round(items.reduce((s, i) => s + i.total_price, 0) * 100) / 100 : Number(draft.total) || 0;
    const rec = { ...draft, items, total, memberId: draft.memberId || members[0]?.id };
    setReceipts((rs) => [rec, ...rs]);
    if (rec.scanned && tierLimit !== null) setQuota((q) => ({ month: nowMonth(), used: (q.month === nowMonth() ? q.used : 0) + 1 }));
    setMonth(monthKey(rec.date) || nowMonth());
    setView({ name: "tabs" }); setTab("pulpit"); setDraft(null);
    showToast("Paragon zapisany ✓");
  }
  function updateItem(receiptId, itemId, patch) {
    if (receiptId === "draft") setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
    else setReceipts((rs) => rs.map((r) => r.id !== receiptId ? r : { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }));
  }
  function deleteReceipt(id) {
    setReceipts((rs) => rs.filter((r) => r.id !== id));
    setView({ name: "tabs" }); setTab("paragony"); setConfirmBox(null);
    showToast("Paragon usunięty");
  }

  /* ---- dane miesiąca ---- */
  const monthReceipts = useMemo(() => receipts.filter((r) => monthKey(r.date) === month).sort((a, b) => (a.date < b.date ? 1 : -1)), [receipts, month]);
  const monthTotal = useMemo(() => monthReceipts.reduce((s, r) => s + (Number(r.total) || 0), 0), [monthReceipts]);
  const prevTotal = useMemo(() => receipts.filter((r) => monthKey(r.date) === shiftMonth(month, -1)).reduce((s, r) => s + (Number(r.total) || 0), 0), [receipts, month]);
  const byCategory = useMemo(() => {
    const map = {};
    monthReceipts.forEach((r) => r.items.forEach((i) => { const cat = i.category || "inne"; map[cat] = (map[cat] || 0) + (Number(i.total_price) || 0); }));
    return Object.entries(map).map(([slug, value]) => ({ slug, value, ...catBySlug(slug) })).sort((a, b) => b.value - a.value);
  }, [monthReceipts]);
  const delta = prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null;
  const allTotal = useMemo(() => receipts.reduce((s, r) => s + (Number(r.total) || 0), 0), [receipts]);
  const totalSavedAll = useMemo(() => goals.reduce((s, g) => s + (Number(g.saved) || 0), 0), [goals]);
  const curMonthSpent = useMemo(() => receipts.filter((r) => monthKey(r.date) === nowMonth()).reduce((s, r) => s + (Number(r.total) || 0), 0), [receipts]);
  const freeFunds = income != null ? Math.round((income - curMonthSpent - totalSavedAll) * 100) / 100 : null;
  const recurring = useMemo(() => (isPro ? analyzeRecurring(receipts) : []), [receipts, isPro]);
  const dueItems = useMemo(() => recurring.filter((r) => r.due && !restockDone[r.key]), [recurring, restockDone]);
  const greeting = (() => { const h = new Date().getHours(); return h < 5 ? "Dobranoc" : h < 12 ? "Dzień dobry" : h < 18 ? "Miłego dnia" : "Dobry wieczór"; })();
  const initials = (profile.name || "Ty").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  /* ---- wspólne ---- */
  const navBtn = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.glassBorder}`, background: T.glass, color: T.sub, fontSize: 16, cursor: "pointer", lineHeight: "28px", textAlign: "center", padding: 0 };
  const primaryBtn = {
    background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, color: "#06251A", border: "none", borderRadius: 14,
    padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    boxShadow: `0 8px 24px ${T.mint}38, inset 0 1px 0 rgba(255,255,255,.35)`,
  };
  const lbl = { display: "block", fontSize: 10, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 5 };
  const input = { width: "100%", padding: "10px 11px", borderRadius: 11, border: `1px solid ${T.glassBorder}`, background: "rgba(255,255,255,.04)", fontSize: 13.5, color: T.text, boxSizing: "border-box", transition: "border-color 150ms ease, box-shadow 150ms ease" };
  const card = { background: T.glass, border: `1px solid ${T.glassBorderSoft}`, borderRadius: 17 };

  const MonthNav = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button className="pa-press" onClick={() => setMonth((m) => shiftMonth(m, -1))} style={navBtn}>‹</button>
      <div className="pa-display" style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 108, textAlign: "center", textTransform: "capitalize" }}>{monthLabel(month)}</div>
      <button className="pa-press" onClick={() => setMonth((m) => shiftMonth(m, 1))} style={navBtn}>›</button>
    </div>
  );
  const Header = ({ title, onBack }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 16px 10px" }}>
      <button className="pa-press" onClick={onBack} style={{ ...navBtn, fontSize: 17 }}>‹</button>
      <div className="pa-display" style={{ fontSize: 16.5, fontWeight: 600, color: T.text }}>{title}</div>
    </div>
  );
  const StoreMono = ({ store }) => (
    <div className="pa-display" style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0,
      background: `linear-gradient(145deg, ${T.mint}26, ${T.mint}0D)`, border: `1px solid ${T.mint}33`,
      color: T.mint, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
      {store[0]}
    </div>
  );
  const ReceiptRow = ({ r, idx = 0 }) => (
    <button className="pa-press pa-fade" onClick={() => setView({ name: "details", id: r.id })}
      style={{ animationDelay: `${Math.min(idx * 45, 320)}ms`, display: "flex", alignItems: "center", gap: 12, width: "100%",
        ...card, borderRadius: 16, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
      <StoreMono store={r.store} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pa-body" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{r.store}</div>
        <div className="pa-body" style={{ fontSize: 11.5, color: T.faint, marginTop: 1 }}>{fmtDate(r.date)} · {r.items.length} pozycji</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="pa-mono" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{zl(r.total)}</div>
        <div style={{ display: "flex", gap: 3, justifyContent: "flex-end", marginTop: 4 }}>
          {[...new Set(r.items.map((i) => i.category))].slice(0, 4).map((s) => (
            <span key={s} style={{ width: 7, height: 7, borderRadius: 2.5, background: catBySlug(s).color, display: "inline-block" }} />
          ))}
        </div>
      </div>
    </button>
  );
  const SettingRow = ({ ic, tint, label, sub, right, onClick, danger }) => (
    <button className={onClick ? "pa-press" : ""} onClick={onClick} disabled={!onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none",
        padding: "11px 14px", cursor: onClick ? "pointer" : "default", textAlign: "left" }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        background: danger ? "rgba(230,118,109,.12)" : `${tint || T.mint}16`, border: `1px solid ${danger ? "rgba(230,118,109,.3)" : (tint || T.mint) + "33"}` }}>
        <Icon name={ic} size={16} color={danger ? T.danger : (tint || T.mint)} sw={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="pa-body" style={{ fontSize: 13.5, fontWeight: 500, color: danger ? T.danger : T.text }}>{label}</div>
        {sub && <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </button>
  );
  const Divider = () => <div style={{ height: 1, background: "rgba(255,255,255,.055)", margin: "0 14px 0 58px" }} />;
  const SectionLabel = ({ children }) => (
    <div className="pa-body" style={{ fontSize: 10, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: ".11em", margin: "20px 6px 9px" }}>{children}</div>
  );

  /* ================= EKRANY ================= */

  const Pulpit = () => (
    <div className="pa-fade" style={{ padding: "18px 18px 118px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div className="pa-body" style={{ fontSize: 12, color: T.faint }}>{greeting}{profile.name ? `, ${profile.name.split(" ")[0]}` : ""} 👋</div>
          <div className="pa-display" style={{ fontSize: 22, fontWeight: 700, color: T.text, marginTop: 2 }}>Twoje wydatki</div>
        </div>
        <MonthNav />
      </div>

      {monthReceipts.length >= 3 && (
        <button className="pa-press pa-rise" onClick={() => setView({ name: "summary", mk: month })}
          style={{ width: "100%", textAlign: "left", marginBottom: 12, cursor: "pointer", position: "relative", overflow: "hidden",
            borderRadius: 16, border: `1px solid ${T.mint}3A`, background: `linear-gradient(120deg, ${T.mint}18, rgba(255,255,255,.02))`, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: `${T.mint}1E`, border: `1px solid ${T.mint}50`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="chart" size={17} color={T.mint} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pa-display" style={{ fontSize: 13.5, fontWeight: 600, color: T.text, textTransform: "capitalize" }}>Podsumowanie: {monthLabel(month)}</div>
              <div className="pa-body" style={{ fontSize: 11, color: T.faint }}>Zobacz swój miesiąc w liczbach · gotowe do udostępnienia</div>
            </div>
            <span style={{ color: T.mint, fontSize: 18 }}>›</span>
          </div>
        </button>
      )}

      {tierLimit !== null && (
        <div className="pa-fade" style={{ ...card, padding: "11px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span className="pa-body" style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>Skany AI w tym miesiącu {effTier === "free" && <span style={{ color: T.faint }}>· plan Free</span>}</span>
            <span className="pa-mono" style={{ fontSize: 11.5, color: quota.used >= tierLimit ? T.danger : T.text }}>{quota.used}/{tierLimit}</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min((quota.used / tierLimit) * 100, 100)}%`, borderRadius: 3,
              background: quota.used >= tierLimit ? T.danger : quota.used >= tierLimit * 0.8 ? T.warn : `linear-gradient(90deg, ${T.mint}, ${T.mintDeep})`, transition: `width 400ms ${T.easeOut}` }} />
          </div>
          {quota.used >= tierLimit * 0.8 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 7 }}>
              <button className="pa-body" onClick={() => setView({ name: "plans", reason: "limit" })} style={{ background: "none", border: "none", color: T.mint, fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                Skanuj bez limitu — zobacz plany →
              </button>
              {quota.used >= tierLimit && <span className="pa-body" style={{ fontSize: 10.5, color: T.faint }}>Ręczne wpisywanie nadal działa</span>}
            </div>
          )}
        </div>
      )}

      {isPro ? (
        budget ? (() => {
          const left = budget - monthTotal;
          const pct = Math.min(monthTotal / budget, 1);
          const col = left < 0 ? T.danger : pct >= 0.8 ? T.warn : T.mint;
          return (
            <button className="pa-press pa-fade" onClick={() => setInputSheet({
                title: "Budżet miesięczny", fields: [{ key: "amount", label: "Kwota budżetu (zł) — wpisz 0, aby usunąć", value: String(budget).replace(".", ","), placeholder: "3000" }], submitLabel: "Zapisz budżet",
                onSubmit: (v) => { const n = Number(String(v.amount).replace(",", ".").replace(/\s/g, "")); setBudget(n > 0 ? Math.round(n * 100) / 100 : null); setInputSheet(null); showToast(n > 0 ? "Budżet zapisany ✓" : "Budżet usunięty"); },
              })}
              style={{ width: "100%", textAlign: "left", ...card, padding: "12px 14px", marginBottom: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span className="pa-body" style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>🎯 Budżet · {monthLabel(month).split(" ")[0]}</span>
                <span className="pa-mono" style={{ fontSize: 12.5, fontWeight: 600, color: col }}>
                  {left >= 0 ? `zostało ${zl(left)}` : `przekroczony o ${zl(-left)}`}
                </span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(pct * 100, 2)}%`, borderRadius: 3, background: left < 0 ? T.danger : `linear-gradient(90deg, ${col}, ${col}99)`, transition: `width 500ms ${T.easeOut}` }} />
              </div>
              <div className="pa-body" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.faint, marginTop: 6 }}>
                <span>wydano {zl(monthTotal)}</span><span>z {zl(budget)} · dotknij, by zmienić</span>
              </div>
            </button>
          );
        })() : (
          <button className="pa-press pa-fade" onClick={() => setInputSheet({
              title: "Ustaw budżet miesięczny", fields: [{ key: "amount", label: "Kwota budżetu (zł)", placeholder: "3000" }], submitLabel: "Zapisz budżet",
              onSubmit: (v) => { const n = Number(String(v.amount).replace(",", ".").replace(/\s/g, "")); if (n > 0) { setBudget(Math.round(n * 100) / 100); showToast("Budżet zapisany ✓"); } setInputSheet(null); },
            })}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: `1.5px dashed rgba(255,255,255,.16)`, borderRadius: 14, padding: "12px 14px", marginBottom: 12, cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 15 }}>🎯</span>
            <span className="pa-body" style={{ flex: 1, fontSize: 12.5, color: T.sub, fontWeight: 500 }}>Ustaw budżet miesięczny — zobaczysz, ile Ci zostało</span>
            <span style={{ color: T.mint, fontSize: 16 }}>+</span>
          </button>
        )
      ) : receipts.length > 0 && (
        <button className="pa-press pa-fade" onClick={() => setView({ name: "plans", reason: "feature" })}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: `${T.gold}0C`, border: `1px solid ${T.gold}30`, borderRadius: 14, padding: "11px 14px", marginBottom: 12, cursor: "pointer", textAlign: "left" }}>
          <span>🎯</span>
          <span className="pa-body" style={{ flex: 1, fontSize: 12, color: "#D9CCA8" }}>Budżet miesięczny i licznik "ile zostało" — od planu <b>Pro</b></span>
          <span style={{ color: T.gold }}>→</span>
        </button>
      )}

      {receipts.length === 0 ? (
        <div className="pa-rise" style={{ background: `linear-gradient(160deg, rgba(255,255,255,.05), rgba(255,255,255,.02))`, border: `1px solid ${T.glassBorder}`, borderRadius: 22, padding: "38px 24px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, margin: "0 auto", borderRadius: 22, background: `linear-gradient(145deg, ${T.mint}22, ${T.mint}08)`, border: `1px solid ${T.mint}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>🧾</div>
          <div className="pa-display" style={{ fontSize: 17, fontWeight: 600, margin: "16px 0 7px", color: T.text }}>Zacznij od pierwszego paragonu</div>
          <div className="pa-body" style={{ fontSize: 13, color: T.sub, marginBottom: 22, lineHeight: 1.55 }}>Sfotografuj paragon, a pokażemy Ci,<br />gdzie uciekają pieniądze.</div>
          <button className="pa-press pa-display" onClick={startScan} style={primaryBtn}>Skanuj paragon</button>
          <div style={{ marginTop: 14 }}>
            <button className="pa-body" onClick={() => { setReceipts(demoReceipts()); showToast("Załadowano przykładowe dane"); }}
              style={{ background: "none", border: "none", color: T.mint, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              albo zobacz na przykładowych danych →
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pa-rise pa-sheen" style={{ position: "relative", borderRadius: 24, overflow: "hidden",
            background: `linear-gradient(140deg, #15493A 0%, #0E3528 45%, #0A2A1F 100%)`,
            border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)", padding: "20px 18px 16px" }}>
            <div style={{ position: "absolute", top: -70, right: -50, width: 220, height: 220, borderRadius: "50%", background: `radial-gradient(circle, ${T.mint}2E, transparent 65%)`, pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -90, left: -60, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, rgba(216,184,120,.10), transparent 65%)`, pointerEvents: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Donut data={byCategory.slice(0, 6)} total={monthTotal} size={168} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {delta !== null && (
                  <div className="pa-body" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
                    color: delta > 0 ? "#F2A69E" : "#9BE8CB", background: delta > 0 ? "rgba(230,118,109,.14)" : `${T.mint}1A`,
                    border: `1px solid ${delta > 0 ? "rgba(230,118,109,.3)" : T.mint + "33"}`, borderRadius: 999, padding: "4px 10px", marginBottom: 10 }}>
                    {delta > 0 ? "↑" : delta < 0 ? "↓" : "="} {Math.abs(delta)}% vs {monthLabel(shiftMonth(month, -1)).split(" ")[0]}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {byCategory.slice(0, 4).map((c) => (
                    <div key={c.slug} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: c.color, flexShrink: 0, boxShadow: `0 0 8px ${c.color}66` }} />
                      <span className="pa-body" style={{ fontSize: 11, color: "#BFD2C8", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      <span className="pa-mono" style={{ fontSize: 10.5, color: "#E6F0EA" }}>{Math.round((c.value / monthTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.09)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="pa-body" style={{ fontSize: 10.5, color: "#8FB3A3", letterSpacing: ".07em", fontWeight: 600 }}>DZIEŃ PO DNIU</span>
                <span className="pa-mono" style={{ fontSize: 10.5, color: "#8FB3A3" }}>{monthReceipts.length} paragonów</span>
              </div>
              <DailyBars receipts={monthReceipts} month={month} />
            </div>
            {isPro && (() => {
              const rows = BUDGET_CATS.map((slug) => ({
                slug,
                limit: Number(String(budgets[slug] ?? "").replace(",", ".").replace(/\s/g, "")) || 0,
                spent: byCategory.find((c) => c.slug === slug)?.value || 0,
              })).filter((r) => r.limit > 0 && r.spent > 0);
              if (!rows.length) return null;
              return (
                <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.09)", display: "flex", flexDirection: "column", gap: 9 }}>
                  {rows.map((r) => {
                    const c = catBySlug(r.slug);
                    const pct = Math.min(r.spent / r.limit, 1);
                    const hot = r.spent / r.limit >= 0.8;
                    return (
                      <div key={r.slug}>
                        <div className="pa-body" style={{ fontSize: 11, color: T.sub, marginBottom: 5 }}>
                          {c.icon} {c.name} · <span className="pa-mono">{num(r.spent)} / {num(r.limit)} zł</span>
                        </div>
                        <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(pct * 100, 2)}%`, borderRadius: 3,
                            background: hot ? `linear-gradient(90deg, ${T.warn}, ${T.danger})` : `linear-gradient(90deg, ${T.mint}, ${T.mintDeep})`,
                            transition: `width 500ms ${T.easeOut}` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {isPro && dueItems.length > 0 && (
            <button className="pa-press pa-rise" onClick={() => setView({ name: "restock" })}
              style={{ width: "100%", textAlign: "left", marginTop: 12, cursor: "pointer", position: "relative", overflow: "hidden",
                background: `linear-gradient(135deg, ${T.gold}14, rgba(255,255,255,.03))`, border: `1px solid ${T.gold}40`, borderRadius: 18, padding: "14px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: `${T.gold}1E`, border: `1px solid ${T.gold}50`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="cart" size={17} color={T.gold} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="pa-display" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>Pora dokupić</div>
                  <div className="pa-body" style={{ fontSize: 11, color: T.faint }}>{dueItems.length} {dueItems.length === 1 ? "produkt prawdopodobnie się kończy" : "produktów prawdopodobnie się kończy"}</div>
                </div>
                <span className="pa-mono" style={{ fontSize: 9, color: T.gold, letterSpacing: ".12em" }}>PRO</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {dueItems.slice(0, 4).map((it) => (
                  <span key={it.key} className="pa-body" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#E2D3A8", background: `${T.gold}12`, border: `1px solid ${T.gold}33`, borderRadius: 999, padding: "3px 9px" }}>
                    {catBySlug(it.category).icon} {it.name}
                  </span>
                ))}
                {dueItems.length > 4 && <span className="pa-body" style={{ fontSize: 11, color: T.faint, alignSelf: "center" }}>+{dueItems.length - 4}</span>}
              </div>
            </button>
          )}

          {hasGoals && goals.length > 0 && (
            <button className="pa-press pa-rise" onClick={() => setView({ name: "goals" })}
              style={{ width: "100%", textAlign: "left", marginTop: 12, cursor: "pointer", ...card, padding: "14px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: `${T.gold}1A`, border: `1px solid ${T.gold}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="piggy" size={17} color={T.gold} sw={1.6} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="pa-display" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>Cele oszczędnościowe</div>
                  <div className="pa-body" style={{ fontSize: 11, color: T.faint }}>{goals.length} {goals.length === 1 ? "aktywny cel" : "aktywne cele"}</div>
                </div>
                <span style={{ color: T.faint }}>›</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {goals.slice(0, 2).map((g) => {
                  const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0;
                  const done = g.saved >= g.target;
                  return (
                    <div key={g.id}>
                      <div className="pa-body" style={{ fontSize: 11, color: T.sub, marginBottom: 5, display: "flex", justifyContent: "space-between" }}>
                        <span>{g.icon} {g.name}</span>
                        <span className="pa-mono" style={{ color: done ? T.mint : T.sub }}>{num(g.saved)} / {num(g.target)} zł</span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(pct * 100, 3)}%`, borderRadius: 3,
                          background: done ? `linear-gradient(90deg, ${T.mint}, ${T.mintDeep})` : `linear-gradient(90deg, ${T.gold}, #B2945A)`, transition: `width 500ms ${T.easeOut}` }} />
                      </div>
                    </div>
                  );
                })}
                {goals.length > 2 && <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, textAlign: "center" }}>+ {goals.length - 2} {goals.length - 2 === 1 ? "kolejny cel" : "kolejne cele"}</div>}
              </div>
            </button>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 2px 12px" }}>
            <div className="pa-display" style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Ostatnie paragony</div>
            <button className="pa-body pa-press" onClick={() => setTab("paragony")} style={{ background: "none", border: "none", color: T.mint, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Zobacz wszystkie →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {monthReceipts.slice(0, 4).map((r, i) => <ReceiptRow key={r.id} r={r} idx={i} />)}
            {monthReceipts.length === 0 && <div className="pa-body" style={{ fontSize: 13, color: T.faint, textAlign: "center", padding: 20 }}>Brak paragonów w tym miesiącu.</div>}
          </div>
        </>
      )}
    </div>
  );

  const Paragony = () => {
    const q = searchQ.trim().toLowerCase();
    const filtered = q
      ? monthReceipts.filter((r) => r.store.toLowerCase().includes(q) || r.items.some((i) => (i.name || "").toLowerCase().includes(q)))
      : monthReceipts;
    const groups = {};
    filtered.forEach((r) => { (groups[r.date] = groups[r.date] || []).push(r); });
    const dates = Object.keys(groups).sort().reverse();
    let idx = 0;
    return (
      <div className="pa-fade" style={{ padding: "18px 18px 118px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="pa-display" style={{ fontSize: 22, fontWeight: 700, color: T.text }}>Paragony</div>
          <MonthNav />
        </div>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{ position: "absolute", left: 13, top: 12, opacity: .6, pointerEvents: "none" }}><Icon name="search" size={15} color={T.sub} /></span>
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Szukaj sklepu lub produktu…"
            className="pa-body" style={{ ...input, padding: "11px 12px 11px 38px", borderRadius: 14 }} />
          {searchQ && (
            <button className="pa-press" onClick={() => setSearchQ("")}
              style={{ position: "absolute", right: 9, top: 8, width: 24, height: 24, borderRadius: 8, border: "none", background: "rgba(255,255,255,.08)", color: T.sub, fontSize: 11, cursor: "pointer" }}>✕</button>
          )}
        </div>
        {dates.length === 0 ? (
          <div className="pa-body" style={{ textAlign: "center", color: T.faint, fontSize: 13, padding: "44px 0", lineHeight: 1.7 }}>
            {q ? <>Nic nie znaleziono dla „{searchQ.trim()}”.</> : <>Brak paragonów w tym miesiącu.<br />
            <button className="pa-press" onClick={startScan} style={{ ...primaryBtn, marginTop: 14, fontSize: 13, padding: "11px 20px" }}>Zeskanuj pierwszy</button></>}
          </div>
        ) : dates.map((d) => (
          <div key={d} style={{ marginBottom: 18 }}>
            <div className="pa-body" style={{ fontSize: 10.5, fontWeight: 700, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", margin: "0 2px 8px" }}>
              {d === todayKey() ? "Dzisiaj" : fmtDate(d)}
              <span className="pa-mono" style={{ float: "right", fontWeight: 500 }}>{zl(groups[d].reduce((s, r) => s + r.total, 0))}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {groups[d].map((r) => <ReceiptRow key={r.id} r={r} idx={idx++} />)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const Analiza = () => {
    const prodMap = {};
    monthReceipts.forEach((r) => r.items.forEach((i) => {
      const k = (i.name || "").trim().toLowerCase();
      if (!k) return;
      const e = prodMap[k] = prodMap[k] || { name: i.name, count: 0, sum: 0, category: i.category };
      e.count += Number(i.qty) || 1; e.sum += Number(i.total_price) || 0;
    }));
    const topProducts = Object.values(prodMap).sort((a, b) => b.sum - a.sum).slice(0, 5);
    const perMember = members.length > 1 ? members.map((m, mi) => ({
      ...m, color: MEMBER_COLORS[mi % MEMBER_COLORS.length],
      sum: monthReceipts.filter((r) => (r.memberId || members[0].id) === m.id).reduce((s, r) => s + (Number(r.total) || 0), 0),
    })).sort((a, b) => b.sum - a.sum) : [];
    return (
    <div className="pa-fade" style={{ padding: "18px 18px 118px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="pa-display" style={{ fontSize: 22, fontWeight: 700, color: T.text }}>Analiza</div>
        <MonthNav />
      </div>
      {byCategory.length === 0 ? (
        <div className="pa-body" style={{ textAlign: "center", color: T.faint, fontSize: 13, padding: "48px 0" }}>Zeskanuj paragony, żeby zobaczyć analizę.</div>
      ) : (
        <>
          <div className="pa-rise" style={{ ...card, padding: "14px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, letterSpacing: ".08em", fontWeight: 600 }}>SUMA MIESIĄCA</div>
              <div className="pa-mono" style={{ fontSize: 24, fontWeight: 600, color: T.text, marginTop: 3 }}>{zl(monthTotal)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, letterSpacing: ".08em", fontWeight: 600 }}>ŚREDNIO / PARAGON</div>
              <div className="pa-mono" style={{ fontSize: 15, fontWeight: 600, color: T.gold, marginTop: 6 }}>{zl(monthReceipts.length ? monthTotal / monthReceipts.length : 0)}</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {byCategory.map((c, ci) => {
              const pct = monthTotal > 0 ? c.value / monthTotal : 0;
              const open = drill === c.slug;
              const items = [];
              monthReceipts.forEach((r) => r.items.forEach((i) => { if (i.category === c.slug) items.push({ ...i, store: r.store }); }));
              return (
                <div key={c.slug} className="pa-fade" style={{ animationDelay: `${Math.min(ci * 40, 320)}ms`, background: T.glass, border: `1px solid ${open ? c.color + "55" : T.glassBorderSoft}`, borderRadius: 17, overflow: "hidden", transition: "border-color 200ms ease" }}>
                  <button className="pa-press" onClick={() => setDrill(open ? null : c.slug)}
                    style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <CatTile slug={c.slug} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pa-body" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{c.name}</div>
                        <div className="pa-body" style={{ fontSize: 11, color: T.faint, marginTop: 1 }}>{items.length} {items.length === 1 ? "produkt" : items.length < 5 ? "produkty" : "produktów"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="pa-mono" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>{zl(c.value)}</div>
                        <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 1 }}>{Math.round(pct * 100)}%</div>
                      </div>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(pct * 100, 2)}%`, background: `linear-gradient(90deg, ${c.color}, ${c.color}99)`, borderRadius: 3, transition: `width 500ms ${T.easeOut}`, boxShadow: `0 0 10px ${c.color}55` }} />
                    </div>
                  </button>
                  {open && (
                    <div className="pa-fade" style={{ borderTop: `1px dashed rgba(255,255,255,.12)`, padding: "9px 14px 13px" }}>
                      {items.sort((a, b) => b.total_price - a.total_price).map((i) => (
                        <div key={i.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5.5px 0" }}>
                          <div className="pa-body" style={{ flex: 1, fontSize: 12.5, color: "#C9D6CE", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                          <div className="pa-body" style={{ fontSize: 10, color: T.faint }}>{i.store}</div>
                          <div className="pa-mono" style={{ fontSize: 12, fontWeight: 500, color: T.text }}>{zl(i.total_price)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {perMember.length > 0 && (
            <>
              <div className="pa-display" style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: "20px 2px 10px" }}>Na osobę</div>
              <div className="pa-rise" style={{ ...card, padding: "5px 0" }}>
                {perMember.map((m) => {
                  const pct = monthTotal > 0 ? m.sum / monthTotal : 0;
                  return (
                    <div key={m.id} style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span className="pa-body" style={{ fontSize: 12.5, fontWeight: 600, color: T.text, display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: m.color }} />{m.name}
                        </span>
                        <span className="pa-mono" style={{ fontSize: 12, color: T.text }}>{zl(m.sum)} <span style={{ color: T.faint, fontSize: 10 }}>({Math.round(pct * 100)}%)</span></span>
                      </div>
                      <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(pct * 100, 2)}%`, background: m.color, borderRadius: 3, transition: `width 500ms ${T.easeOut}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {topProducts.length > 0 && (
            <>
              <div className="pa-display" style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: "20px 2px 10px" }}>Top produkty</div>
              <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
                {topProducts.map((p, i) => (
                  <div key={p.name + i}>
                    {i > 0 && <Divider />}
                    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px" }}>
                      <div className="pa-mono" style={{ width: 22, fontSize: 12, fontWeight: 600, color: i === 0 ? T.gold : T.faint }}>#{i + 1}</div>
                      <CatTile slug={p.category} size={30} fs={14} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pa-body" style={{ fontSize: 12.5, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div className="pa-body" style={{ fontSize: 10.5, color: T.faint }}>{p.count}× w tym miesiącu</div>
                      </div>
                      <div className="pa-mono" style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>{zl(p.sum)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
    );
  };

  /* ---------- PROFIL + USTAWIENIA ---------- */
  const Profil = () => {
    const planMetaMap = { free: { ic: "spark", c: "#9FB3A9", grad: "linear-gradient(140deg,#1A2B23,#0E1A14)" },
      starter: { ic: "spark", c: "#A8B8C2", grad: "linear-gradient(140deg,#1B2E33,#0E1A1D)" },
      pro: { ic: "crown", c: T.mint, grad: "linear-gradient(140deg,#15493A 0%,#0E3528 50%,#0A2A1F 100%)" },
      family: { ic: "crown", c: T.gold, grad: "linear-gradient(140deg,#3A3320 0%,#241E0E 55%,#1A1608 100%)" } };
    const planMeta = planMetaMap[effTier] || planMetaMap.free;
    const planName = PLANS.find((p) => p.id === effTier)?.name || "Free";
    // rangi "oszczędzacza" wg liczby paragonów — lekki grywalizacyjny detal
    const tiersR = [[0, "Nowicjusz"], [10, "Łowca paragonów"], [30, "Strateg wydatków"], [75, "Mistrz budżetu"], [150, "Legenda oszczędzania"]];
    const rankIdx = tiersR.reduce((acc, t, i) => receipts.length >= t[0] ? i : acc, 0);
    const rank = tiersR[rankIdx][1];
    const nextThresh = tiersR[rankIdx + 1]?.[0];
    const rankPct = nextThresh ? Math.min(receipts.length / nextThresh, 1) : 1;

    return (
    <div className="pa-fade" style={{ padding: "18px 18px 124px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="pa-display" style={{ fontSize: 22, fontWeight: 700, color: T.text }}>Profil</div>
        <button className="pa-press" onClick={() => setInputSheet({
            title: "Edytuj profil",
            fields: [{ key: "name", label: "Imię i nazwisko", value: profile.name, placeholder: "Jan Kowalski" }, { key: "email", label: "E-mail", value: profile.email, placeholder: "jan@example.com", type: "email" }],
            submitLabel: "Zapisz",
            onSubmit: (v) => { setProfile({ name: v.name.trim(), email: v.email.trim() }); setInputSheet(null); showToast("Profil zapisany ✓"); },
          })}
          style={{ ...navBtn, width: 34, height: 34, background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.12)", color: T.sub, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="pencil" size={15} color={T.sub} />
        </button>
      </div>

      {/* MEMBERSHIP CARD */}
      <div className="pa-rise pa-sheen" style={{ position: "relative", borderRadius: 26, overflow: "hidden",
        background: planMeta.grad, border: "1px solid rgba(255,255,255,.11)",
        boxShadow: "0 26px 64px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.14)", padding: "20px 18px 18px", marginBottom: 22 }}>
        <div className="pa-aurora" style={{ top: -90, right: -60, width: 220, height: 220, background: `radial-gradient(circle, ${planMeta.c}33, transparent 68%)` }} />
        {/* górny pasek: ranga + plan */}
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div className="pa-mono" style={{ fontSize: 9, letterSpacing: ".18em", color: "rgba(255,255,255,.55)" }}>PARAGON·AI</div>
          <button className="pa-press" onClick={() => setView({ name: "plans" })}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${planMeta.c}1E`, border: `1px solid ${planMeta.c}55`, borderRadius: 999, padding: "4px 11px 4px 8px", cursor: "pointer" }}>
            <Icon name={planMeta.ic} size={12} color={planMeta.c} sw={1.8} />
            <span className="pa-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".08em", color: planMeta.c }}>{planName.toUpperCase()}</span>
          </button>
        </div>
        {/* monogram + nazwa */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 15 }}>
          <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: -3, borderRadius: 22, background: `conic-gradient(from 140deg, ${planMeta.c}, ${T.gold}, ${planMeta.c})`, opacity: .85 }} />
            <div className="pa-display" style={{ position: "absolute", inset: 0, borderRadius: 20, background: "#0B1712", color: T.text,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, fontWeight: 700, letterSpacing: ".02em" }}>
              {initials}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pa-display" style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>{profile.name || "Twój profil"}</div>
            <div className="pa-body" style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{profile.email || "Dodaj swoje dane, by spersonalizować konto"}</div>
          </div>
        </div>
        {/* ranga */}
        <div style={{ position: "relative", marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <span className="pa-body" style={{ fontSize: 12, fontWeight: 600, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="spark" size={13} color={T.gold} sw={1.8} /> {rank}
            </span>
            <span className="pa-mono" style={{ fontSize: 10.5, color: "rgba(255,255,255,.55)" }}>
              {nextThresh ? `${receipts.length} / ${nextThresh} paragonów` : `${receipts.length} paragonów`}
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(0,0,0,.3)", borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,.4)" }}>
            <div style={{ height: "100%", width: `${Math.max(rankPct * 100, 4)}%`, borderRadius: 3,
              background: `linear-gradient(90deg, ${planMeta.c}, ${T.gold})`, transition: `width 700ms ${T.easeOut}`, boxShadow: `0 0 10px ${planMeta.c}77` }} />
          </div>
          {nextThresh && (
            <div className="pa-body" style={{ fontSize: 10, color: "rgba(255,255,255,.45)", marginTop: 6 }}>
              Jeszcze {nextThresh - receipts.length} do rangi „{tiersR[rankIdx + 1][1]}"
            </div>
          )}
        </div>
        {/* statystyki */}
        <div style={{ position: "relative", display: "flex", gap: 1, marginTop: 18, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 15, overflow: "hidden" }}>
          {[["Paragony", receipts.length, "receipt"], ["Wydano łącznie", zl(allTotal), "chart"], ["Ten miesiąc", zl(monthTotal), "cart"]].map(([k, v, ic], i) => (
            <div key={k} style={{ flex: 1, padding: "11px 10px", background: "rgba(0,0,0,.15)", borderLeft: i ? "1px solid rgba(255,255,255,.07)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                <Icon name={ic} size={11} color="rgba(255,255,255,.5)" sw={1.8} />
                <span className="pa-body" style={{ fontSize: 8.5, color: "rgba(255,255,255,.5)", letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</span>
              </div>
              <div className="pa-mono" style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PLAN / ZARZĄDZANIE */}
      <SectionLabel>Subskrypcja</SectionLabel>
      <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
        <SettingRow ic={planMeta.ic} tint={planMeta.c} label={`Plan ${planName}`}
          sub={tierLimit !== null ? `${quota.used}/${tierLimit} skanów AI w tym miesiącu` : "Subskrypcja aktywna · zarządzaj"}
          right={effTier === "free"
            ? <span className="pa-mono pa-press" style={{ fontSize: 10, fontWeight: 700, color: "#06251A", background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, borderRadius: 999, padding: "5px 12px", letterSpacing: ".05em" }}>ULEPSZ</span>
            : <span style={{ color: T.faint }}>›</span>}
          onClick={() => setView({ name: "plans" })} />
        <Divider />
        <SettingRow ic="repeat" tint={T.mint} label="Lista zakupów"
          sub={isPro ? (dueItems.length ? `${dueItems.length} produktów się kończy` : "Powtarzalne zakupy z historii") : "Inteligentna lista — od planu Pro"}
          right={isPro
            ? (dueItems.length > 0 ? <span className="pa-mono" style={{ fontSize: 11, color: T.gold, background: `${T.gold}18`, border: `1px solid ${T.gold}40`, borderRadius: 999, padding: "2px 8px" }}>{dueItems.length}</span> : <span style={{ color: T.faint }}>›</span>)
            : <span className="pa-mono" style={{ fontSize: 9, color: T.gold, letterSpacing: ".1em" }}>PRO</span>}
          onClick={() => isPro ? setView({ name: "restock" }) : setView({ name: "plans", reason: "feature" })} />
        <Divider />
        <SettingRow ic="piggy" tint={T.gold} label="Cele oszczędnościowe"
          sub={hasGoals ? (goals.length ? `${goals.length} ${goals.length === 1 ? "aktywny cel" : "aktywne cele"}` : "Odkładaj na wymarzone cele") : "Skarbonki — od planu Starter"}
          right={hasGoals
            ? (goals.length > 0 ? <span className="pa-mono" style={{ fontSize: 11, color: T.gold, background: `${T.gold}18`, border: `1px solid ${T.gold}40`, borderRadius: 999, padding: "2px 8px" }}>{goals.length}</span> : <span style={{ color: T.faint }}>›</span>)
            : <span className="pa-mono" style={{ fontSize: 9, color: "#A8B8C2", letterSpacing: ".1em" }}>STARTER</span>}
          onClick={() => hasGoals ? setView({ name: "goals" }) : setView({ name: "plans", reason: "feature" })} />
      </div>

      {/* BUDŻETY KATEGORII */}
      <SectionLabel>Budżety miesięczne</SectionLabel>
      {isPro ? (
        <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
          {BUDGET_CATS.map((slug, i) => {
            const c = catBySlug(slug);
            const set = (budgets[slug] ?? "") !== "" && Number(String(budgets[slug]).replace(",", ".")) > 0;
            return (
              <div key={slug}>
                {i > 0 && <Divider />}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px" }}>
                  <CatTile slug={slug} size={32} fs={15} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pa-body" style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{c.name}</div>
                    <div className="pa-body" style={{ fontSize: 10, color: set ? T.mint : T.faint, marginTop: 1 }}>{set ? "limit ustawiony" : "bez limitu"}</div>
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input type="text" inputMode="decimal" value={budgets[slug] ?? ""} placeholder="0"
                      onChange={(e) => setBudgets((b) => ({ ...b, [slug]: e.target.value }))}
                      onBlur={(e) => {
                        const n = Number(String(e.target.value).replace(",", ".").replace(/\s/g, ""));
                        setBudgets((b) => { const nb = { ...b }; if (n > 0) nb[slug] = Math.round(n * 100) / 100; else delete nb[slug]; return nb; });
                      }}
                      className="pa-mono" style={{ width: 90, textAlign: "right", fontSize: 13, padding: "8px 26px 8px 10px", borderRadius: 11,
                        border: `1px solid ${set ? T.mint + "55" : "rgba(255,255,255,.08)"}`, background: "rgba(255,255,255,.04)", color: T.text, boxSizing: "border-box" }} />
                    <span className="pa-body" style={{ position: "absolute", right: 9, fontSize: 11, color: T.faint, pointerEvents: "none" }}>zł</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, padding: "8px 14px 12px", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,.05)" }}>
            Paski postępu pojawią się na Pulpicie, gdy w kategorii z budżetem będą wydatki.
          </div>
        </div>
      ) : (
        <button className="pa-press pa-rise" onClick={() => setView({ name: "plans", reason: "feature" })}
          style={{ width: "100%", ...card, padding: "13px 14px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: `${T.gold}16`, border: `1px solid ${T.gold}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="alert" size={16} color={T.gold} sw={1.8} />
          </div>
          <span className="pa-body" style={{ flex: 1, fontSize: 12.5, color: T.sub }}>Budżety na kategorie — od planu <b style={{ color: T.text }}>Pro</b></span>
          <span style={{ color: T.gold }}>→</span>
        </button>
      )}

      {/* RODZINA */}
      {effTier === "family" && (
        <>
          <SectionLabel>Gospodarstwo domowe</SectionLabel>
          <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 14px 9px" }}>
              <div className="pa-body" style={{ fontSize: 12.5, fontWeight: 600, color: T.text }}>Domownicy <span className="pa-mono" style={{ color: T.faint, fontWeight: 500 }}>({(plan.members || []).length}/5)</span></div>
              {(plan.members || []).length < 5 && (
                <button className="pa-press pa-body" onClick={() => setInputSheet({
                    title: "Dodaj domownika", fields: [{ key: "name", label: "Imię", placeholder: "Kasia" }], submitLabel: "Dodaj",
                    onSubmit: (v) => { if (v.name.trim()) { setPlan((p) => ({ ...p, members: [...(p.members || []), { id: uid(), name: v.name.trim() }] })); showToast(`${v.name.trim()} dołącza do rodziny 🎉`); } setInputSheet(null); },
                  })}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${T.mint}14`, border: `1px solid ${T.mint}40`, borderRadius: 999, padding: "4px 11px", color: T.mint, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>+ Dodaj</button>
              )}
            </div>
            {(plan.members || []).map((m, i) => {
              const mc = MEMBER_COLORS[i % MEMBER_COLORS.length];
              const spent = receipts.filter((r) => monthKey(r.date) === nowMonth() && (r.memberId || (plan.members || [])[0]?.id) === m.id)
                .reduce((s, r) => s + (Number(r.total) || 0), 0);
              return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                <div className="pa-display" style={{ width: 34, height: 34, borderRadius: 12, background: `${mc}1C`, border: `1px solid ${mc}45`, color: mc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{(m.name[0] || "?").toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pa-body" style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{m.name}{m.owner && <span className="pa-mono" style={{ fontSize: 8, color: T.gold, letterSpacing: ".1em", marginLeft: 6, border: `1px solid ${T.gold}40`, borderRadius: 4, padding: "1px 4px" }}>WŁAŚCICIEL</span>}</div>
                  <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 1 }}>w tym miesiącu <span className="pa-mono" style={{ color: mc }}>{zl(spent)}</span></div>
                </div>
                {!m.owner && (
                  <button className="pa-press" onClick={() => setPlan((p) => ({ ...p, members: p.members.filter((x) => x.id !== m.id) }))}
                    style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: T.faint, fontSize: 12, cursor: "pointer" }}>✕</button>
                )}
              </div>
              );
            })}
            <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, padding: "9px 14px 12px", lineHeight: 1.55, borderTop: "1px solid rgba(255,255,255,.05)" }}>
              Przy zapisywaniu paragonu wybierasz, kto zrobił zakupy — podział wydatków zobaczysz w Analizie.
            </div>
          </div>
        </>
      )}

      {/* POWIADOMIENIA */}
      <SectionLabel>Powiadomienia</SectionLabel>
      <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
        <SettingRow ic="bell" tint="#5BB8E8" label="Przypomnienia o skanowaniu" right={<Toggle on={settings.push} onChange={(v) => setSettings((s) => ({ ...s, push: v }))} />} />
        <Divider />
        <SettingRow ic="report" tint={T.mint} label="Raport tygodniowy" right={<Toggle on={settings.weekly} onChange={(v) => setSettings((s) => ({ ...s, weekly: v }))} />} />
        <Divider />
        <SettingRow ic="alert" tint={T.warn} label="Alerty przekroczenia budżetu" right={<Toggle on={settings.budget} onChange={(v) => setSettings((s) => ({ ...s, budget: v }))} />} />
      </div>

      {/* DANE */}
      <SectionLabel>Dane</SectionLabel>
      <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
        <SettingRow ic="chart" tint={T.mint} label="Podsumowanie miesiąca" sub="Twój miesiąc w liczbach — gotowe do udostępnienia" right={<span style={{ color: T.faint }}>›</span>}
          onClick={() => setView({ name: "summary", mk: nowMonth() })} />
        <Divider />
        <SettingRow ic="download" tint={T.mint} label="Eksportuj dane" sub="CSV / Excel" right={<span style={{ color: T.faint }}>›</span>}
          onClick={() => {
            if (!isPro) { setView({ name: "plans", reason: "feature" }); return; }
            if (!receipts.length) { showToast("Brak danych do eksportu"); return; }
            exportCSV(receipts); showToast("Plik CSV pobrany ✓");
          }} />
        <Divider />
        <SettingRow ic="trash" danger label="Wyczyść wszystkie dane" right={<span style={{ color: T.faint }}>›</span>}
          onClick={() => setConfirmBox({ title: "Wyczyścić dane?", body: "Usunie wszystkie paragony zapisane w aplikacji. Tej operacji nie można cofnąć.", confirmLabel: "Wyczyść wszystko", onConfirm: () => { setReceipts([]); setQuota({ month: nowMonth(), used: 0 }); setConfirmBox(null); showToast("Dane wyczyszczone"); } })} />
      </div>

      {/* INFORMACJE */}
      <SectionLabel>Informacje</SectionLabel>
      <div className="pa-rise" style={{ ...card, overflow: "hidden" }}>
        <SettingRow ic="lock" tint="#8490DC" label="Polityka prywatności" right={<span style={{ color: T.faint }}>›</span>} onClick={() => showToast("Dokument dostępny w pełnej wersji")} />
        <Divider />
        <SettingRow ic="doc" tint="#A8B4BB" label="Regulamin" right={<span style={{ color: T.faint }}>›</span>} onClick={() => showToast("Dokument dostępny w pełnej wersji")} />
        <Divider />
        <SettingRow ic="info" tint="#5FC6B5" label="Wersja aplikacji" right={<span className="pa-mono" style={{ fontSize: 11.5, color: T.faint }}>0.4.0</span>} />
      </div>

      <div className="pa-body" style={{ textAlign: "center", fontSize: 10.5, color: T.faint, marginTop: 22, letterSpacing: ".03em" }}>
        Paragon AI · zaprojektowane w Polsce 🇵🇱
      </div>
    </div>
    );
  };

  /* ---------- PODSUMOWANIE MIESIĄCA ("Twój miesiąc w liczbach") ---------- */
  const SummaryView = () => {
    const mk = view.mk || nowMonth();
    const st = computeMonthStats(receipts, mk);
    const savedThisMonth = totalSavedAll; // suma odłożona (globalnie – cele nie są per miesiąc)
    const topCat = st.cats[0] ? { ...catBySlug(st.cats[0].slug), value: st.cats[0].value } : null;
    const topCatPct = topCat && st.total > 0 ? Math.round((topCat.value / st.total) * 100) : 0;
    const deltaDown = st.delta != null && st.delta < 0;

    const shareText = () => {
      const lines = [
        `📊 Mój ${monthLabel(mk)} w Paragon AI`,
        `Wydałem: ${zl(st.total)}`,
        st.delta != null ? `${deltaDown ? "📉" : "📈"} ${deltaDown ? "" : "+"}${st.delta}% vs poprzedni miesiąc` : null,
        topCat ? `Najwięcej na: ${topCat.name} (${zl(topCat.value)})` : null,
        st.mostVisited ? `Ulubiony sklep: ${st.mostVisited[0]}` : null,
        savedThisMonth > 0 ? `💰 Odłożone na cele: ${zl(savedThisMonth)}` : null,
      ].filter(Boolean);
      return lines.join("\n");
    };
    const doShare = async () => {
      const text = shareText();
      try {
        if (navigator.share) { await navigator.share({ title: "Mój miesiąc w Paragon AI", text }); }
        else { await navigator.clipboard?.writeText(text); showToast("Skopiowano do schowka ✓"); }
      } catch (e) { /* anulowano */ }
    };

    const Stat = ({ ic, tint, label, value, sub }) => (
      <div style={{ ...card, padding: "13px 14px", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${tint}18`, border: `1px solid ${tint}38`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={ic} size={13} color={tint} sw={1.9} />
          </div>
          <span className="pa-body" style={{ fontSize: 9.5, color: T.faint, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        </div>
        <div className="pa-mono" style={{ fontSize: 15, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        {sub && <div className="pa-body" style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>{sub}</div>}
      </div>
    );

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Header title="Podsumowanie miesiąca" onBack={() => setView({ name: "tabs" })} />
        <div className="pa-scroll" style={{ flex: 1, padding: "6px 18px 48px" }}>
          {st.count === 0 ? (
            <div className="pa-fade" style={{ textAlign: "center", padding: "44px 18px" }}>
              <div style={{ width: 66, height: 66, margin: "0 auto", borderRadius: 21, background: `${T.mint}14`, border: `1px solid ${T.mint}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="chart" size={28} color={T.mint} />
              </div>
              <div className="pa-display" style={{ fontSize: 16.5, fontWeight: 600, margin: "14px 0 7px", color: T.text }}>Brak danych za {monthLabel(mk)}</div>
              <div className="pa-body" style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, maxWidth: 280, margin: "0 auto" }}>
                Dodaj paragony z tego miesiąca, a przygotuję pełne podsumowanie Twoich wydatków.
              </div>
            </div>
          ) : (
            <>
              {/* HERO — udostępnialna karta */}
              <div className="pa-rise pa-sheen" style={{ position: "relative", overflow: "hidden", borderRadius: 24, padding: "22px 20px",
                background: `linear-gradient(155deg, #15493A 0%, #0E3528 55%, #0A2A1F 100%)`, border: "1px solid rgba(255,255,255,.11)",
                boxShadow: "0 24px 60px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.13)", marginBottom: 14 }}>
                <div className="pa-aurora" style={{ top: -90, right: -60, width: 230, height: 230, background: `radial-gradient(circle, ${T.mint}33, transparent 68%)` }} />
                <div style={{ position: "relative" }}>
                  <div className="pa-mono" style={{ fontSize: 10, letterSpacing: ".16em", color: "rgba(255,255,255,.55)" }}>PARAGON·AI</div>
                  <div className="pa-display" style={{ fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 10, textTransform: "capitalize" }}>Twój {monthLabel(mk)} w liczbach</div>
                  <div className="pa-mono" style={{ fontSize: 38, fontWeight: 600, color: "#fff", marginTop: 4, lineHeight: 1.05 }}>{zl(st.total)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {st.delta != null && (
                      <span className="pa-body" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600,
                        color: deltaDown ? "#7EE8C4" : "#F0B8B2", background: deltaDown ? "rgba(45,212,160,.16)" : "rgba(230,118,109,.16)",
                        border: `1px solid ${deltaDown ? "rgba(45,212,160,.35)" : "rgba(230,118,109,.35)"}`, borderRadius: 999, padding: "3px 10px" }}>
                        {deltaDown ? "▼" : "▲"} {Math.abs(st.delta)}% vs poprz. mies.
                      </span>
                    )}
                    <span className="pa-body" style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)" }}>{st.count} {st.count === 1 ? "paragon" : "paragonów"} · {st.itemCount} pozycji</span>
                  </div>
                </div>
              </div>

              {/* top kategoria */}
              {topCat && (
                <div className="pa-rise" style={{ ...card, padding: "15px 16px", marginBottom: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <CatTile slug={st.cats[0].slug} size={44} fs={21} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, textTransform: "uppercase", letterSpacing: ".06em" }}>Najwięcej wydałeś na</div>
                      <div className="pa-display" style={{ fontSize: 16, fontWeight: 600, color: T.text, marginTop: 1 }}>{topCat.name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="pa-mono" style={{ fontSize: 15, fontWeight: 600, color: T.mint }}>{zl(topCat.value)}</div>
                      <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 1 }}>{topCatPct}% budżetu</div>
                    </div>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,.07)", borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${topCatPct}%`, borderRadius: 3, background: `linear-gradient(90deg, ${T.mint}, ${T.mintDeep})` }} />
                  </div>
                </div>
              )}

              {/* statystyki 2x2 */}
              <div style={{ display: "flex", gap: 11, marginBottom: 11 }}>
                <Stat ic="cart" tint={T.gold} label="Śr. dziennie" value={zl(st.dailyAvg)} />
                <Stat ic="receipt" tint="#5BB8E8" label="Największy" value={st.biggest ? zl(st.biggest.total) : "—"} sub={st.biggest?.store} />
              </div>
              {st.mostVisited && (
                <div style={{ display: "flex", gap: 11, marginBottom: 11 }}>
                  <Stat ic="cart" tint="#EC86B2" label="Ulubiony sklep" value={st.mostVisited[0]} sub={`${st.mostVisited[1]} ${st.mostVisited[1] === 1 ? "wizyta" : "wizyt"}`} />
                  {savedThisMonth > 0
                    ? <Stat ic="piggy" tint={T.mint} label="Odłożone na cele" value={zl(savedThisMonth)} />
                    : <Stat ic="chart" tint="#A189DB" label="Kategorii" value={String(st.cats.length)} />}
                </div>
              )}

              {/* rozbicie top 5 kategorii */}
              {st.cats.length > 1 && (
                <div className="pa-rise" style={{ ...card, padding: "14px 16px", marginBottom: 14 }}>
                  <div className="pa-display" style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 12 }}>Na co poszły pieniądze</div>
                  {st.cats.slice(0, 5).map((c) => {
                    const meta = catBySlug(c.slug);
                    const pct = st.total > 0 ? Math.round((c.value / st.total) * 100) : 0;
                    return (
                      <div key={c.slug} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span className="pa-body" style={{ fontSize: 12, color: T.sub }}>{meta.icon} {meta.name}</span>
                          <span className="pa-mono" style={{ fontSize: 11.5, color: T.text }}>{zl(c.value)} <span style={{ color: T.faint }}>· {pct}%</span></span>
                        </div>
                        <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.max(pct, 2)}%`, borderRadius: 2, background: meta.color || T.mint }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* udostępnij */}
              <button className="pa-press pa-display" onClick={doShare}
                style={{ ...primaryBtn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Icon name="share" size={16} sw={2} color="#06251A" /> Udostępnij podsumowanie
              </button>
              <div className="pa-body" style={{ textAlign: "center", fontSize: 10.5, color: T.faint, marginTop: 12, lineHeight: 1.5 }}>
                Pochwal się postępami — udostępnij znajomym albo zapisz na pamiątkę.
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- CELE OSZCZĘDNOŚCIOWE (Starter+) ---------- */
  const GoalsView = () => {
    const totalSaved = goals.reduce((s, g) => s + (Number(g.saved) || 0), 0);
    const totalTarget = goals.reduce((s, g) => s + (Number(g.target) || 0), 0);
    const openNew = () => setInputSheet({
      title: "Nowy cel oszczędnościowy", icon: "🎯",
      note: "Data docelowa jest opcjonalna — jeśli ją podasz, policzę ile odkładać miesięcznie.",
      fields: [
        { key: "name", label: "Na co odkładasz?", placeholder: "np. Wakacje w Grecji" },
        { key: "target", label: "Kwota celu (zł)", placeholder: "3000", type: "text" },
        { key: "deadline", label: "Data docelowa (opcjonalnie)", type: "date", min: todayKey() },
      ],
      submitLabel: "Utwórz cel",
      onSubmit: (v) => {
        const t = Number(String(v.target).replace(",", ".").replace(/\s/g, ""));
        if (!v.name.trim()) { showToast("Podaj nazwę celu"); return; }
        if (!(t > 0)) { showToast("Podaj kwotę większą od zera"); return; }
        if (v.deadline && v.deadline < todayKey()) { showToast("Data docelowa nie może być w przeszłości"); return; }
        const used = goals.map((g) => g.icon);
        const icon = GOAL_ICONS.find((i) => !used.includes(i)) || "🎯";
        addGoal(v.name, t, icon, v.deadline || null); setInputSheet(null); showToast("Cel utworzony 🎯");
      },
    });
    const openIncome = () => setInputSheet({
      title: "Miesięczny dochód", icon: "💰",
      note: "Na tej podstawie liczymy wolne środki. Wpisz 0, aby wyłączyć.",
      fields: [{ key: "amount", label: "Dochód miesięczny (zł)", value: income ? String(income).replace(".", ",") : "", placeholder: "5000", type: "text" }],
      submitLabel: "Zapisz",
      onSubmit: (v) => {
        const n = Number(String(v.amount).replace(",", ".").replace(/\s/g, ""));
        setIncome(n > 0 ? Math.round(n * 100) / 100 : null);
        setInputSheet(null);
        showToast(n > 0 ? "Dochód zapisany ✓" : "Wyłączono wolne środki");
      },
    });
    const openDeposit = (g) => setInputSheet({
      title: `Wpłać na: ${g.name}`, icon: g.icon,
      note: freeFunds != null ? `Wolne środki w tym miesiącu: ${zl(Math.max(freeFunds, 0))}` : null,
      fields: [{ key: "amount", label: "Kwota wpłaty (zł)", placeholder: "100", type: "text" }],
      submitLabel: "Dodaj do skarbonki",
      onSubmit: (v) => {
        const a = Number(String(v.amount).replace(",", ".").replace(/\s/g, ""));
        if (!(a > 0)) { showToast("Podaj kwotę większą od zera"); return; }
        if (freeFunds != null && a > freeFunds) { showToast(`Brak wolnych środków — masz ${zl(Math.max(freeFunds, 0))}`); return; }
        const ok = depositGoal(g.id, a);
        if (!ok) { showToast("Brak wystarczających wolnych środków"); return; }
        setInputSheet(null);
        if (g.saved + a >= g.target) { navigator.vibrate?.([30, 60, 30]); showToast(`Cel „${g.name}" osiągnięty! 🎉`); }
        else { navigator.vibrate?.(20); showToast(`Wpłacono ${zl(a)} ✓`); }
      },
    });
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Header title="Cele oszczędnościowe" onBack={() => setView({ name: "tabs" })} />
        <div className="pa-scroll" style={{ flex: 1, padding: "6px 18px 48px" }}>
          {goals.length === 0 ? (
            <div className="pa-fade" style={{ textAlign: "center", padding: "40px 18px" }}>
              <div style={{ width: 68, height: 68, margin: "0 auto", borderRadius: 22, background: `${T.gold}16`, border: `1px solid ${T.gold}38`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="piggy" size={30} color={T.gold} sw={1.6} />
              </div>
              <div className="pa-display" style={{ fontSize: 17, fontWeight: 600, margin: "14px 0 7px", color: T.text }}>Zacznij odkładać na cel</div>
              <div className="pa-body" style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, maxWidth: 290, margin: "0 auto 22px" }}>
                Wakacje, nowy telefon, poduszka finansowa — ustaw cel i śledź, jak rośnie Twoja skarbonka.
              </div>
              <button className="pa-press pa-display" onClick={openNew} style={{ ...primaryBtn }}>+ Utwórz pierwszy cel</button>
            </div>
          ) : (
            <>
              {/* podsumowanie */}
              <div className="pa-rise pa-sheen" style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: "16px 18px", marginBottom: 16,
                background: `linear-gradient(140deg, #3A3320 0%, #241E0E 60%, #1A1608 100%)`, border: `1px solid ${T.gold}33`, boxShadow: "0 18px 44px rgba(0,0,0,.4)" }}>
                <div className="pa-aurora" style={{ top: -80, right: -50, width: 200, height: 200, background: `radial-gradient(circle, ${T.gold}30, transparent 68%)` }} />
                <div style={{ position: "relative" }}>
                  <div className="pa-body" style={{ fontSize: 11, color: "rgba(255,255,255,.6)", letterSpacing: ".06em", fontWeight: 600 }}>ODŁOŻONE ŁĄCZNIE</div>
                  <div className="pa-mono" style={{ fontSize: 26, fontWeight: 600, color: "#fff", marginTop: 4 }}>{zl(totalSaved)}</div>
                  <div className="pa-body" style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)", marginTop: 2 }}>z {zl(totalTarget)} we wszystkich celach</div>
                </div>
              </div>

              {income != null ? (
                <button className="pa-press" onClick={openIncome}
                  style={{ width: "100%", textAlign: "left", ...card, padding: "13px 15px", marginBottom: 16, cursor: "pointer",
                    border: freeFunds < 0 ? "1px solid rgba(230,118,109,.4)" : `1px solid ${T.mint}33` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="pa-body" style={{ fontSize: 11, color: T.faint, fontWeight: 600, letterSpacing: ".05em" }}>WOLNE ŚRODKI W TYM MIESIĄCU</div>
                      <div className="pa-mono" style={{ fontSize: 20, fontWeight: 600, color: freeFunds < 0 ? T.danger : T.mint, marginTop: 3 }}>{zl(Math.max(freeFunds, 0))}</div>
                    </div>
                    <Icon name="pencil" size={15} color={T.faint} />
                  </div>
                  <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
                    Dochód {zl(income)} − wydatki {zl(curMonthSpent)} − odłożone {zl(totalSaved)}
                    {freeFunds < 0 && <span style={{ color: T.danger }}> · przekroczono dostępne środki</span>}
                  </div>
                </button>
              ) : (
                <button className="pa-press" onClick={openIncome}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: `${T.mint}0C`, border: `1px dashed ${T.mint}45`, borderRadius: 14, padding: "12px 14px", marginBottom: 16, cursor: "pointer", textAlign: "left" }}>
                  <Icon name="spark" size={16} color={T.mint} />
                  <span className="pa-body" style={{ flex: 1, fontSize: 12, color: T.sub }}>Podaj miesięczny dochód, a wpłaty na cele będą pomniejszać <b style={{ color: T.text }}>wolne środki</b></span>
                  <span style={{ color: T.mint }}>+</span>
                </button>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {goals.map((g, gi) => {
                  const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) : 0;
                  const done = g.saved >= g.target;
                  const left = Math.max(g.target - g.saved, 0);
                  const pace = goalPace(g);
                  return (
                    <div key={g.id} className="pa-fade" style={{ animationDelay: `${Math.min(gi * 50, 300)}ms`, ...card,
                      border: done ? `1px solid ${T.mint}55` : `1px solid ${T.glassBorderSoft}`, padding: "14px", position: "relative", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 13, background: done ? `${T.mint}1C` : `${T.gold}16`, border: `1px solid ${done ? T.mint + "45" : T.gold + "38"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{g.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="pa-display" style={{ fontSize: 14.5, fontWeight: 600, color: T.text }}>{g.name}</div>
                          <div className="pa-body" style={{ fontSize: 11, color: done ? T.mint : T.faint, marginTop: 1 }}>
                            {done ? "✓ Cel osiągnięty!" : `zostało ${zl(left)}`}
                            {!done && g.deadline && <span> · do {deadlineLabel(g.deadline)}</span>}
                          </div>
                        </div>
                        <button className="pa-press" onClick={() => setConfirmBox({ title: "Usunąć cel?", body: `„${g.name}" — odłożone ${zl(g.saved)} zostanie usunięte z aplikacji.`, confirmLabel: "Usuń cel", onConfirm: () => { setGoals((arr) => arr.filter((x) => x.id !== g.id)); setConfirmBox(null); showToast("Cel usunięty"); } })}
                          style={{ width: 28, height: 28, borderRadius: 9, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: T.faint, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>✕</button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span className="pa-mono" style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{zl(g.saved)}</span>
                        <span className="pa-mono" style={{ fontSize: 11, color: T.faint }}>{Math.round(pct * 100)}% z {zl(g.target)}</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,.07)", borderRadius: 4, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,.3)" }}>
                        <div style={{ height: "100%", width: `${Math.max(pct * 100, 3)}%`, borderRadius: 4,
                          background: done ? `linear-gradient(90deg, ${T.mint}, ${T.mintDeep})` : `linear-gradient(90deg, ${T.gold}, #B2945A)`,
                          transition: `width 600ms ${T.easeOut}`, boxShadow: `0 0 10px ${done ? T.mint : T.gold}66` }} />
                      </div>

                      {/* plan odkładania — gdy cel ma datę */}
                      {!done && pace && (() => {
                        const cfg = pace.overdue
                          ? { c: T.danger, bg: "rgba(230,118,109,.1)", bd: "rgba(230,118,109,.3)", ic: "alert", txt: `Termin minął ${Math.abs(pace.daysLeft)} dni temu`, sub: `Brakuje jeszcze ${zl(pace.remaining)}` }
                          : pace.status === "behind"
                          ? { c: T.warn, bg: `${T.warn}12`, bd: `${T.warn}33`, ic: "alert", txt: `Zostało ${pace.daysLeft} dni`, sub: `Dołóż ${zl(pace.remaining)}, by zdążyć` }
                          : { c: T.mint, bg: `${T.mint}0E`, bd: `${T.mint}2E`, ic: "spark", txt: `Odkładaj ${zl(pace.perMonth)}/mies.`, sub: pace.daysLeft > 60 ? `lub ${zl(pace.perWeek)}/tydzień · zostało ${Math.round(pace.monthsLeft)} mies.` : `zostało ${pace.daysLeft} dni` };
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, padding: "9px 11px", borderRadius: 11, background: cfg.bg, border: `1px solid ${cfg.bd}` }}>
                            <Icon name={cfg.ic} size={15} color={cfg.c} sw={1.9} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="pa-body" style={{ fontSize: 12, fontWeight: 600, color: cfg.c }}>{cfg.txt}</div>
                              <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 1 }}>{cfg.sub}</div>
                            </div>
                          </div>
                        );
                      })()}

                      {!done && !g.deadline && (
                        <button className="pa-press pa-body" onClick={() => setInputSheet({
                            title: `Termin celu: ${g.name}`, icon: g.icon,
                            note: "Ustaw datę, a policzę ile odkładać miesięcznie, żeby zdążyć.",
                            fields: [{ key: "deadline", label: "Data docelowa", type: "date", min: todayKey() }],
                            submitLabel: "Ustaw termin",
                            onSubmit: (v) => { if (!v.deadline) { showToast("Wybierz datę"); return; } if (v.deadline < todayKey()) { showToast("Data nie może być w przeszłości"); return; } setGoals((arr) => arr.map((x) => x.id === g.id ? { ...x, deadline: v.deadline } : x)); setInputSheet(null); showToast("Termin ustawiony ✓"); },
                          })}
                          style={{ width: "100%", marginTop: 11, padding: "8px 0", borderRadius: 11, border: "1px dashed rgba(255,255,255,.15)", background: "none", color: T.faint, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                          + Dodaj termin (policzę tempo)
                        </button>
                      )}

                      {!done && (
                        <button className="pa-press pa-body" onClick={() => openDeposit(g)}
                          style={{ width: "100%", marginTop: 11, padding: "10px 0", borderRadius: 12, border: `1px solid ${T.gold}40`, background: `${T.gold}12`, color: T.gold, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                          + Wpłać do skarbonki
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button className="pa-press pa-body" onClick={openNew}
                style={{ width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 14, border: "1.5px dashed rgba(255,255,255,.18)", background: "none", color: T.sub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                + Dodaj kolejny cel
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- LISTA ZAKUPÓW / POWTARZALNE (Pro+) ---------- */
  const RestockView = () => {
    const due = recurring.filter((r) => r.due);
    const soon = recurring.filter((r) => !r.due && r.ratio >= 0.45);
    const cartCount = Object.values(restockDone).filter(Boolean).length;
    const Row = (it) => {
      const checked = !!restockDone[it.key];
      const c = catBySlug(it.category);
      const pct = Math.min(it.ratio, 1);
      const col = it.due ? T.gold : T.mint;
      return (
        <div key={it.key} className="pa-fade" style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", opacity: checked ? 0.5 : 1, transition: "opacity 200ms ease" }}>
          <button className="pa-press" onClick={() => { setRestockDone((d) => ({ ...d, [it.key]: !d[it.key] })); if (!checked) navigator.vibrate?.(20); }}
            style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              border: checked ? "none" : `1.5px solid rgba(255,255,255,.2)`, background: checked ? `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})` : "transparent" }}>
            {checked && <Icon name="check" size={15} sw={2.5} color="#06251A" />}
          </button>
          <CatTile slug={it.category} size={32} fs={15} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pa-body" style={{ fontSize: 13, fontWeight: 600, color: T.text, textDecoration: checked ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</div>
            <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>
              kupujesz {cycleLabel(it.avgGap)} · ostatnio {it.sinceLast === 0 ? "dziś" : it.sinceLast === 1 ? "wczoraj" : `${it.sinceLast} dni temu`}
            </div>
            <div style={{ height: 3, background: "rgba(255,255,255,.08)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(pct * 100, 4)}%`, background: col, borderRadius: 2, transition: `width 400ms ${T.easeOut}` }} />
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="pa-mono" style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{zl(it.lastPrice)}</div>
            <div className="pa-body" style={{ fontSize: 9.5, color: T.faint, marginTop: 1 }}>ost. cena</div>
          </div>
        </div>
      );
    };
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Header title="Lista zakupów" onBack={() => setView({ name: "tabs" })} />
        <div className="pa-scroll" style={{ flex: 1, padding: "6px 18px 48px" }}>
          {recurring.length === 0 ? (
            <div className="pa-fade" style={{ textAlign: "center", padding: "44px 18px" }}>
              <div style={{ width: 64, height: 64, margin: "0 auto", borderRadius: 20, background: `${T.mint}14`, border: `1px solid ${T.mint}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="repeat" size={26} color={T.mint} />
              </div>
              <div className="pa-display" style={{ fontSize: 16, fontWeight: 600, margin: "14px 0 7px", color: T.text }}>Jeszcze się uczę Twoich zakupów</div>
              <div className="pa-body" style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, maxWidth: 290, margin: "0 auto" }}>
                Skanuj paragony przez kilka tygodni. Gdy zobaczę, że jakiś produkt kupujesz regularnie, podpowiem, kiedy prawdopodobnie się kończy.
              </div>
            </div>
          ) : (
            <>
              <div className="pa-fade pa-body" style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.55, margin: "4px 2px 16px" }}>
                Na podstawie Twojej historii rozpoznałem rytm zakupów. <span style={{ color: T.text }}>Odhacz to, co masz w koszyku.</span>
              </div>

              {due.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 9px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: T.gold }} />
                    <span className="pa-display" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>Pora dokupić</span>
                    <span className="pa-mono" style={{ fontSize: 11, color: T.faint }}>({due.length})</span>
                  </div>
                  <div className="pa-rise" style={{ ...card, border: `1px solid ${T.gold}33`, overflow: "hidden", marginBottom: 18 }}>
                    {due.map((it, i) => (<div key={it.key}>{i > 0 && <Divider />}{Row(it)}</div>))}
                  </div>
                </>
              )}

              {soon.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 9px" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: T.mint }} />
                    <span className="pa-display" style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}>Niedługo</span>
                    <span className="pa-mono" style={{ fontSize: 11, color: T.faint }}>({soon.length})</span>
                  </div>
                  <div className="pa-rise" style={{ ...card, overflow: "hidden", marginBottom: 18 }}>
                    {soon.map((it, i) => (<div key={it.key}>{i > 0 && <Divider />}{Row(it)}</div>))}
                  </div>
                </>
              )}

              {due.length === 0 && soon.length === 0 && (
                <div className="pa-fade" style={{ textAlign: "center", padding: "30px 18px" }}>
                  <div style={{ fontSize: 34 }}>✅</div>
                  <div className="pa-display" style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 6px", color: T.text }}>Wszystko zaopatrzone</div>
                  <div className="pa-body" style={{ fontSize: 12.5, color: T.sub }}>Żaden z Twoich regularnych produktów nie kończy się w najbliższym czasie.</div>
                </div>
              )}

              {cartCount > 0 && (
                <button className="pa-press pa-body" onClick={() => { setRestockDone({}); showToast("Koszyk wyczyszczony"); }}
                  style={{ width: "100%", padding: "11px 0", borderRadius: 13, border: "1px solid rgba(255,255,255,.1)", background: "none", color: T.sub, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  Wyczyść koszyk ({cartCount})
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  /* ---------- PLANY / PAYWALL ---------- */
  const PlansView = () => {
    const reason = view.reason;
    const heading = reason === "limit" ? "Wykorzystałeś darmowe skany"
      : reason === "feature" ? "Ta funkcja wymaga planu Pro"
      : "Wybierz swój plan";
    const sub = reason === "limit" ? `${tierLimit ?? 5} skanów AI w tym miesiącu za Tobą. Wybierz plan albo dodawaj paragony ręcznie — to zawsze za darmo.`
      : reason === "feature" ? "Budżet miesięczny i eksport danych dostępne są w planach Pro i Family."
      : "Zacznij za darmo. Zmienisz plan w każdej chwili.";
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Header title="Plany" onBack={() => setView({ name: "tabs" })} />
        <div className="pa-scroll" style={{ flex: 1, padding: "6px 18px 48px" }}>
          <div className="pa-fade" style={{ textAlign: "center", margin: "8px 0 20px" }}>
            <div className="pa-display" style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{heading}</div>
            <div className="pa-body" style={{ fontSize: 12.5, color: T.sub, marginTop: 6, lineHeight: 1.55 }}>{sub}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {PLANS.map((p, i) => {
              const sel = selPlan === p.id;
              const isCurrent = effTier === p.id;
              const accent = p.id === "family" ? T.gold : T.mint;
              return (
                <button key={p.id} className="pa-press pa-fade" onClick={() => setSelPlan(p.id)}
                  style={{ animationDelay: `${i * 60}ms`, position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
                    background: sel ? `linear-gradient(150deg, ${accent}14, rgba(255,255,255,.03))` : T.glass,
                    border: sel ? `1.5px solid ${accent}` : `1px solid ${T.glassBorder}`,
                    borderRadius: 20, padding: "16px 16px 14px",
                    boxShadow: sel ? `0 12px 36px ${accent}22` : "none", transition: "border-color 200ms ease, box-shadow 200ms ease" }}>
                  {p.id === "pro" && (
                    <div className="pa-mono" style={{ position: "absolute", top: -9, right: 14, background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, color: "#06251A", fontSize: 8.5, fontWeight: 600, letterSpacing: ".1em", borderRadius: 999, padding: "3.5px 10px", boxShadow: `0 4px 12px ${T.mint}55` }}>NAJPOPULARNIEJSZY</div>
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div className="pa-display" style={{ fontSize: 17, fontWeight: 700, color: p.id === "family" ? T.gold : T.text }}>{p.name}</div>
                    <div className="pa-body" style={{ fontSize: 10.5, color: T.faint }}>{p.tagline}</div>
                    <div style={{ flex: 1 }} />
                    <div className="pa-mono" style={{ fontSize: 17, fontWeight: 600, color: T.text }}>{p.price} <span style={{ fontSize: 10.5, color: T.faint }}>zł/mies.</span></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="pa-mono" style={{ color: accent, fontSize: 11 }}>✓</span>
                        <span className="pa-body" style={{ fontSize: 12, color: "#C9D6CE" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrent && <div className="pa-mono" style={{ marginTop: 10, fontSize: 9.5, color: accent, letterSpacing: ".1em" }}>● TWÓJ AKTUALNY PLAN</div>}
                </button>
              );
            })}
          </div>

          <button className="pa-press pa-display" onClick={() => activatePlan(selPlan)}
            disabled={effTier === selPlan}
            style={{ ...primaryBtn, width: "100%", marginTop: 18, opacity: effTier === selPlan ? 0.45 : 1,
              background: selPlan === "family" ? `linear-gradient(135deg, ${T.gold}, #B2945A)` : primaryBtn.background,
              boxShadow: selPlan === "family" ? `0 8px 24px ${T.gold}38, inset 0 1px 0 rgba(255,255,255,.35)` : primaryBtn.boxShadow }}>
            {effTier === selPlan ? "Ten plan jest aktywny" : selPlan === "free" ? "Zostaję na planie Free" : `Wybieram ${PLANS.find((p) => p.id === selPlan).name} — ${PLANS.find((p) => p.id === selPlan).price} zł/mies.`}
          </button>
          {reason === "limit" && (
            <button className="pa-press pa-body" onClick={newManualDraft}
              style={{ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,.12)", background: "none", color: T.sub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              ✍️ Wpisz paragon ręcznie (za darmo)
            </button>
          )}
          <div className="pa-body" style={{ fontSize: 10.5, color: T.faint, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
            Prototyp — płatność symulowana. W pełnej aplikacji: subskrypcja przez App Store / Google Play,<br />anulujesz w każdej chwili. Plan odnawia się automatycznie.
          </div>
        </div>
      </div>
    );
  };

  /* ---------- SKANOWANIE ---------- */
  const ScanView = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header title="Skanowanie" onBack={() => { setView({ name: "tabs" }); setScan({ step: "pick" }); }} />
      {scan.step === "processing" ? <ProcessingView preview={scan.preview} />
        : scan.step === "error" ? (
        <div className="pa-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(230,118,109,.12)", border: "1px solid rgba(230,118,109,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📷</div>
          <div className="pa-display" style={{ fontSize: 16.5, fontWeight: 600, margin: "16px 0 7px", color: T.text }}>Nie udało się odczytać paragonu</div>
          <div className="pa-body" style={{ fontSize: 13, color: T.sub, marginBottom: 22, maxWidth: 280, lineHeight: 1.55 }}>{scan.reason}</div>
          <label htmlFor="pa-cam" className="pa-press pa-display" style={{ ...primaryBtn, display: "inline-block", textAlign: "center" }}>Zrób zdjęcie ponownie</label>
          <button className="pa-body pa-press" onClick={newManualDraft} style={{ marginTop: 13, background: "none", border: "none", color: T.mint, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Wpisz ręcznie</button>
        </div>
      ) : (
        <div className="pa-fade" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28 }}>
          {/* główna akcja: aparat systemowy telefonu */}
          <label htmlFor="pa-cam" className="pa-press"
            style={{ width: "100%", maxWidth: 320, borderRadius: 22, border: `1.5px solid ${T.mint}55`,
              background: `linear-gradient(150deg, ${T.mint}16, rgba(255,255,255,.02))`, padding: "26px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer",
              boxShadow: `0 14px 40px ${T.mint}1A`, boxSizing: "border-box" }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 10px 28px ${T.mint}50, inset 0 1.5px 0 rgba(255,255,255,.45)` }}>
              <Icon name="camera" size={28} sw={2} color="#06251A" />
            </div>
            <div className="pa-display" style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Zrób zdjęcie paragonu</div>
            <div className="pa-body" style={{ fontSize: 11.5, color: T.sub }}>Otwiera aparat Twojego telefonu</div>
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", maxWidth: 320, margin: "18px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.08)" }} />
            <span className="pa-body" style={{ fontSize: 10.5, color: T.faint }}>LUB</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.08)" }} />
          </div>

          <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
            <label htmlFor="pa-file" className="pa-press pa-body"
              style={{ flex: 1, ...card, padding: "13px 0", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: T.text, cursor: "pointer" }}>
              🖼️ Z galerii
            </label>
            <button className="pa-press pa-body" onClick={newManualDraft}
              style={{ flex: 1, ...card, padding: "13px 0", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: T.text, cursor: "pointer" }}>
              ✍️ Ręcznie
            </button>
          </div>
          <div className="pa-body" style={{ fontSize: 11, color: T.faint, marginTop: 18, textAlign: "center", lineHeight: 1.6 }}>
            Najlepsze wyniki: cały paragon w kadrze,<br />dobre światło, paragon wyprostowany.
          </div>
        </div>
      )}
    </div>
  );

  /* ---------- WERYFIKACJA ---------- */
  const VerifyView = () => {
    if (!draft) return null;
    const itemsSum = Math.round(draft.items.reduce((s, i) => s + (Number(String(i.total_price).replace(",", ".")) || 0), 0) * 100) / 100;
    const mismatch = !draft.manual && draft.total > 0 && draft.items.length > 0 && Math.abs(itemsSum - draft.total) > 0.01;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", minHeight: 0 }}>
        <Header title={draft.manual ? "Nowy paragon" : "Sprawdź wyniki"} onBack={() => { setView({ name: "tabs" }); setDraft(null); }} />
        <div className="pa-scroll" style={{ flex: 1, padding: "10px 16px 130px" }}>
          <div className="pa-rise" style={{ ...card, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="pa-body" style={lbl}>Sklep</label>
                <select value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} className="pa-body" style={input}>
                  {STORES.map((s) => <option key={s} style={{ background: "#13241C" }}>{s}</option>)}
                </select>
              </div>
              <div style={{ width: 142 }}>
                <label className="pa-body" style={lbl}>Data</label>
                <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="pa-body" style={input} />
              </div>
            </div>
          </div>

          {members.length > 1 && (
            <div className="pa-fade" style={{ ...card, padding: "11px 14px", marginBottom: 12 }}>
              <div className="pa-body" style={{ fontSize: 10, fontWeight: 600, color: T.faint, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 8 }}>Kto zrobił zakupy?</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {members.map((m, mi) => {
                  const mc = MEMBER_COLORS[mi % MEMBER_COLORS.length];
                  const sel = (draft.memberId || members[0].id) === m.id;
                  return (
                    <button key={m.id} className="pa-press pa-body" onClick={() => setDraft((d) => ({ ...d, memberId: m.id }))}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                        border: sel ? `1.5px solid ${mc}` : "1px solid rgba(255,255,255,.1)",
                        background: sel ? `${mc}18` : "rgba(255,255,255,.03)", color: sel ? T.text : T.sub, fontSize: 12, fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: mc }} />{m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mismatch && (
            <div className="pa-body pa-fade" style={{ display: "flex", gap: 9, background: "rgba(229,196,107,.1)", border: "1px solid rgba(229,196,107,.32)", color: "#EBD9A4", borderRadius: 13, padding: "10px 13px", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
              <span>⚠️</span>
              <span>Suma pozycji (<b className="pa-mono">{zl(itemsSum)}</b>) różni się od sumy z paragonu (<b className="pa-mono">{zl(draft.total)}</b>). Sprawdź pozycje.</span>
            </div>
          )}

          <div className="pa-display" style={{ fontSize: 13.5, fontWeight: 600, color: T.text, margin: "4px 2px 9px" }}>
            Pozycje <span className="pa-mono" style={{ color: T.faint, fontWeight: 500 }}>({draft.items.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.items.map((i, idx) => (
              <div key={i.id} className="pa-fade" style={{ animationDelay: `${Math.min(idx * 35, 280)}ms`, ...card, borderRadius: 14, padding: "10px 12px" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={i.name} placeholder="Nazwa produktu" onChange={(e) => updateItem("draft", i.id, { name: e.target.value })} className="pa-body" style={{ ...input, flex: 1, fontSize: 13 }} />
                  <input type="text" inputMode="decimal" value={String(i.total_price)} placeholder="0,00"
                    onChange={(e) => updateItem("draft", i.id, { total_price: e.target.value })}
                    onBlur={(e) => updateItem("draft", i.id, { total_price: Math.round((Number(String(e.target.value).replace(",", ".")) || 0) * 100) / 100 })}
                    className="pa-mono" style={{ ...input, width: 86, textAlign: "right", fontSize: 13 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9 }}>
                  <CategoryChip slug={i.category} onClick={() => setSheet({ itemId: i.id, context: "draft" })} />
                  <button className="pa-body pa-press" onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.id !== i.id) }))}
                    style={{ background: "none", border: "none", color: T.danger, fontSize: 11.5, fontWeight: 600, cursor: "pointer", opacity: .85 }}>Usuń</button>
                </div>
              </div>
            ))}
          </div>
          <button className="pa-press pa-body" onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { id: uid(), name: "", qty: 1, total_price: 0, category: "inne" }] }))}
            style={{ marginTop: 10, width: "100%", padding: "12px 0", borderRadius: 14, border: `1.5px dashed rgba(255,255,255,.18)`, background: "none", color: T.sub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Dodaj pozycję
          </button>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "26px 16px 20px", background: `linear-gradient(transparent, ${T.bg} 40%)` }}>
          <button className="pa-press pa-display" onClick={saveDraft} style={{ ...primaryBtn, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Zapisz paragon</span>
            <span className="pa-mono" style={{ fontWeight: 600 }}>{zl(draft.items.length ? itemsSum : draft.total)}</span>
          </button>
        </div>
        {sheet && sheet.context === "draft" && (
          <CategorySheet current={draft.items.find((i) => i.id === sheet.itemId)?.category}
            onPick={(slug) => { updateItem("draft", sheet.itemId, { category: slug }); setSheet(null); }}
            onClose={() => setSheet(null)} />
        )}
      </div>
    );
  };

  /* ---------- SZCZEGÓŁY ---------- */
  const DetailsView = () => {
    const r = receipts.find((x) => x.id === view.id);
    if (!r) return null;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", minHeight: 0 }}>
        <Header title="Szczegóły paragonu" onBack={() => setView({ name: "tabs" })} />
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 22px 36px" }}>
          <div className="pa-rise" style={{ filter: "drop-shadow(0 22px 40px rgba(0,0,0,.5))" }}>
            <div className="pa-zz-paper-top" />
            <div style={{ background: T.paper, padding: "20px 18px 8px" }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div className="pa-display" style={{ fontSize: 18, fontWeight: 700, color: T.paperInk, letterSpacing: ".01em" }}>{r.store.toUpperCase()}</div>
                <div className="pa-mono" style={{ fontSize: 10, color: T.paperSub, marginTop: 4, letterSpacing: ".12em" }}>PARAGON FISKALNY</div>
                <div className="pa-mono" style={{ fontSize: 10.5, color: T.paperSub, marginTop: 2 }}>{fmtDate(r.date)} · {r.items.length} poz.</div>
                {effTier === "family" && r.memberId && (
                  <div className="pa-mono" style={{ fontSize: 9.5, color: T.paperSub, marginTop: 3, letterSpacing: ".08em" }}>KUPIŁ(A): {memberName(r.memberId).toUpperCase()}</div>
                )}
              </div>
              <div style={{ borderTop: `1.5px dashed #D8D2C4`, paddingTop: 11 }}>
                {r.items.map((i) => (
                  <div key={i.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pa-mono" style={{ fontSize: 12.5, color: T.paperInk, fontWeight: 500, lineHeight: 1.35 }}>{i.name}</div>
                      <div style={{ marginTop: 5 }}>
                        <CategoryChip light slug={i.category} onClick={() => setSheet({ itemId: i.id, context: "details", receiptId: r.id })} />
                      </div>
                    </div>
                    <div className="pa-mono" style={{ fontSize: 13, fontWeight: 600, color: T.paperInk, paddingTop: 1 }}>{num(i.total_price)}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: `2px solid ${T.paperInk}`, marginTop: 10, paddingTop: 11, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="pa-mono" style={{ fontSize: 13, fontWeight: 600, color: T.paperInk, letterSpacing: ".05em" }}>SUMA PLN</div>
                <div className="pa-mono" style={{ fontSize: 17, fontWeight: 600, color: T.paperInk }}>{num(r.total)}</div>
              </div>
              <div style={{ margin: "16px 8px 10px" }}>
                <div className="pa-barcode" />
                <div className="pa-mono" style={{ textAlign: "center", fontSize: 9, color: T.paperSub, marginTop: 5, letterSpacing: ".22em" }}>PARAGON·AI·{r.id.slice(0, 8).toUpperCase()}</div>
              </div>
            </div>
            <div className="pa-zz-paper" />
          </div>

          <button className="pa-press pa-body" onClick={() => setConfirmBox({
              title: "Usunąć paragon?",
              body: `${r.store}, ${fmtDate(r.date)} — ${zl(r.total)}. Tej operacji nie można cofnąć.`,
              confirmLabel: "Usuń paragon", onConfirm: () => deleteReceipt(r.id),
            })}
            style={{ marginTop: 22, width: "100%", padding: "12px 0", borderRadius: 14, border: "1px solid rgba(230,118,109,.3)", background: "rgba(230,118,109,.07)", color: T.danger, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Usuń paragon
          </button>
        </div>
        {sheet && sheet.context === "details" && (
          <CategorySheet current={r.items.find((i) => i.id === sheet.itemId)?.category}
            onPick={(slug) => { updateItem(sheet.receiptId, sheet.itemId, { category: slug }); setSheet(null); showToast("Kategoria zmieniona"); }}
            onClose={() => setSheet(null)} />
        )}
      </div>
    );
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="pa-body" style={{ minHeight: "100vh", background: "#050B08", display: "flex", justifyContent: "center" }}>
      <GlobalStyle />
      <input id="pa-file" ref={fileRef} type="file" accept="image/*"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", clip: "rect(0 0 0 0)", pointerEvents: "none" }}
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input id="pa-cam" type="file" accept="image/*" capture="environment"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", clip: "rect(0 0 0 0)", pointerEvents: "none" }}
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />

      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
        background: `radial-gradient(1200px 500px at 50% -150px, #12281E 0%, ${T.bg} 55%), ${T.bg}`,
        boxShadow: "0 0 80px rgba(0,0,0,.6)" }}>

        <div className="pa-aurora" style={{ top: -120, left: -80, width: 260, height: 260, background: `radial-gradient(circle, ${T.mint}26, transparent 70%)` }} />
        <div className="pa-aurora" style={{ top: 40, right: -110, width: 240, height: 240, background: `radial-gradient(circle, ${T.gold}1C, transparent 70%)`, animationDelay: "-6s" }} />
        <div className="pa-noise" />

        {/* pasek marki */}
        <div style={{ position: "relative", zIndex: 1, padding: "16px 18px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div className="pa-mono pa-sheen" style={{ background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, color: "#06251A", borderRadius: 9, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, boxShadow: `0 4px 14px ${T.mint}40, inset 0 1px 0 rgba(255,255,255,.4)` }}>P</div>
            <div className="pa-display" style={{ color: T.text, fontSize: 15.5, fontWeight: 700 }}>Paragon <span style={{ color: T.mint }}>AI</span></div>
          </div>
          <button className="pa-press pa-mono" onClick={() => setView({ name: "plans" })}
            style={{ color: badge.color, fontSize: 9.5, letterSpacing: ".14em", border: `1px solid ${badge.color}55`, background: `${badge.color}12`, borderRadius: 999, padding: "4px 11px", fontWeight: 600, cursor: "pointer" }}>
            {tierLimit !== null ? `${badge.label} · ${quota.used}/${tierLimit}` : badge.label}
          </button>
        </div>

        {!loaded ? (
          <div style={{ flex: 1, padding: "18px" }}>
            <div className="pa-shimmer" style={{ height: 230, borderRadius: 24 }} />
            <div className="pa-shimmer" style={{ height: 64, borderRadius: 16, marginTop: 22 }} />
            <div className="pa-shimmer" style={{ height: 64, borderRadius: 16, marginTop: 9 }} />
          </div>
        ) : view.name === "scan" ? ScanView()
          : view.name === "verify" ? VerifyView()
          : view.name === "details" ? DetailsView()
          : view.name === "plans" ? PlansView()
          : view.name === "restock" ? RestockView()
          : view.name === "goals" ? GoalsView()
          : view.name === "summary" ? SummaryView()
          : (
          <>
            <div ref={scrollRef} className="pa-scroll" style={{ flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
              {tab === "pulpit" && Pulpit()}
              {tab === "paragony" && Paragony()}
              {tab === "analiza" && Analiza()}
              {tab === "profil" && Profil()}
            </div>
            {/* pływająca nawigacja */}
            <div style={{ position: "absolute", bottom: "calc(14px + env(safe-area-inset-bottom, 0px))", left: 14, right: 14, zIndex: 30,
              background: "rgba(14,26,20,.82)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,.09)", borderRadius: 24, display: "flex", alignItems: "center",
              padding: "9px 10px", boxShadow: "0 14px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07)" }}>
              <TabBtn k="pulpit" label="Pulpit" icon="home" tab={tab} setTab={setTab} />
              <TabBtn k="paragony" label="Paragony" icon="receipt" tab={tab} setTab={setTab} />
              <button className="pa-press pa-glow" onClick={fabClick}
                onTouchStart={fabDown} onTouchEnd={fabUp} onTouchCancel={fabUp}
                onMouseDown={fabDown} onMouseUp={fabUp} onMouseLeave={fabUp}
                onContextMenu={(e) => e.preventDefault()}
                title="Tap: skanuj · Przytrzymaj: szybki wydatek"
                style={{ width: 58, height: 58, borderRadius: 999, background: `linear-gradient(135deg, ${T.mint}, ${T.mintDeep})`, color: "#06251A",
                  border: "none", cursor: "pointer", margin: "-30px 8px 0", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  userSelect: "none", WebkitUserSelect: "none", touchAction: "manipulation" }}>
                <Icon name="camera" size={25} sw={2} color="#06251A" />
              </button>
              <TabBtn k="analiza" label="Analiza" icon="chart" tab={tab} setTab={setTab} />
              <TabBtn k="profil" label="Profil" icon="user" tab={tab} setTab={setTab} />
            </div>
          </>
        )}

        {toast && (
          <div className="pa-rise pa-body" style={{ position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "rgba(20,36,28,.95)", backdropFilter: "blur(8px)", border: `1px solid ${T.mint}40`, color: T.text, borderRadius: 999, padding: "10px 19px", fontSize: 12.5, fontWeight: 500, boxShadow: "0 10px 30px rgba(0,0,0,.45)", zIndex: 70, whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}
        {quickAdd && (
          <QuickAddSheet
            onClose={() => setQuickAdd(false)}
            onSubmit={(d) => {
              const rec = {
                id: uid(), store: d.store, date: d.date, total: d.amount,
                items: [{ id: uid(), name: "Wydatek ręczny", qty: 1, total_price: d.amount, category: d.category }],
                createdAt: Date.now(), manual: true, memberId: members[0]?.id,
              };
              setReceipts((rs) => [rec, ...rs]);
              setMonth(monthKey(d.date) || nowMonth());
              setQuickAdd(false);
              showToast("Wydatek dodany ✓");
            }} />
        )}
        {confirmBox && <ConfirmSheet {...confirmBox} onClose={() => setConfirmBox(null)} />}
        {inputSheet && <InputSheet {...inputSheet} onClose={() => setInputSheet(null)} />}
      </div>
    </div>
  );
}

function TabBtn({ k, label, icon, tab, setTab }) {
  const active = tab === k;
  return (
    <button className="pa-press pa-body" onClick={() => { if (tab !== k) { navigator.vibrate?.(8); setTab(k); } }}
      style={{ flex: 1, background: "none", border: "none", cursor: "pointer", color: active ? "#2DD4A0" : "#7E938A",
        fontSize: 10, fontWeight: active ? 700 : 500, padding: "3px 0", transition: "color 160ms ease", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 3, filter: active ? "drop-shadow(0 0 8px rgba(45,212,160,.55))" : "none", opacity: active ? 1 : 0.65 }}>
        <Icon name={icon} size={19} color={active ? "#2DD4A0" : "#8AA096"} sw={active ? 2 : 1.7} />
      </div>
      {label}
      {active && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", width: 18, height: 3, borderRadius: 2, background: "#2DD4A0", boxShadow: "0 0 10px rgba(45,212,160,.7)" }} />}
    </button>
  );
}

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />,
  receipt: <path d="M6 2.5h12V21l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V2.5ZM9 7.5h6M9 11h6M9 14.5h4" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  share: <path d="M12 3v13M12 3 8 7m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c.8-3.2 3.6-5 7-5s6.2 1.8 7 5" />,
  camera: <path d="M4 7.5h3l1.5-2.5h7L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Zm8 9.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm10 3-4.8-4.8" />,
  repeat: <path d="M4 9a5 5 0 0 1 5-5h8l-2.5-2.5M20 15a5 5 0 0 1-5 5H7l2.5 2.5" />,
  cart: <path d="M3 4h2l2.2 11.5a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  report: <path d="M3 3v18h18M8 17V9M13 17V5M18 17v-6" />,
  alert: <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />,
  trash: <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />,
  lock: <path d="M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Zm2 0V8a5 5 0 0 1 10 0v3" />,
  doc: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6" />,
  info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13h.01M11 12h1v4h1" />,
  crown: <path d="M3 7l4 5 5-7 5 7 4-5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />,
  pencil: <path d="M4 20h4L19 9a2 2 0 0 0-3-3L5 17v3ZM14 7l3 3" />,
  spark: <path d="M12 3v4m0 10v4m9-9h-4M7 12H3m13.5-6.5-2.5 2.5m-5 5-2.5 2.5m12.5 0-2.5-2.5m-5-5L7.5 5.5" />,
  target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
  piggy: <path d="M19 9c0-3-3-5-7-5s-7 2-7 5c0 1.4.7 2.7 1.8 3.6V16h2.4v-1.5c.9.3 1.8.5 2.8.5s1.9-.2 2.8-.5V16H19v-3.4c1.1-.9 1.8-2.2 1.8-3.6M9 8h.01M3 11h2" />,
  plus: <path d="M12 5v14M5 12h14" />,
};
function Icon({ name, size = 19, color = "currentColor", sw = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] || null}
    </svg>
  );
}

/* ---------- Error Boundary: łapie crash i pokazuje komunikat zamiast czarnego ekranu ---------- */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Paragon AI error:", error, info); }
  handleReset = () => {
    try { localStorage.removeItem("paragon-state"); } catch (e) { /* nic */ }
    this.setState({ hasError: false });
    if (typeof window !== "undefined") window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "#050B08", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
          <div style={{ maxWidth: 340, textAlign: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>🛠️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#EAF2ED", marginBottom: 8 }}>Coś poszło nie tak</div>
            <div style={{ fontSize: 13.5, color: "#9DB0A6", lineHeight: 1.6, marginBottom: 22 }}>
              Aplikacja napotkała nieoczekiwany błąd. Możesz odświeżyć — Twoje dane zwykle pozostają zapisane. Jeśli błąd wraca, użyj przycisku poniżej, aby wyczyścić pamięć aplikacji.
            </div>
            <button onClick={() => window.location.reload()}
              style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#2DD4A0,#1BA47D)", color: "#06251A", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
              Odśwież aplikację
            </button>
            <button onClick={this.handleReset}
              style={{ width: "100%", padding: "11px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,.12)", background: "none", color: "#9DB0A6", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Wyczyść dane i zacznij od nowa
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ParagonAI() {
  return (
    <ErrorBoundary>
      <ParagonAIInner />
    </ErrorBoundary>
  );
}
