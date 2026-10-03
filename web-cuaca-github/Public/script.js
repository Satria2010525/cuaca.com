"use strict";

// Kosong = langsung ke Open-Meteo (GitHub Pages). Diisi "/api" oleh server.js (lewat /config.js).
const BASE = window.WEATHER_API_BASE || "";
const GEO_URL = BASE ? `${BASE}/geocode` : "https://geocoding-api.open-meteo.com/v1/search";
const WX_URL = BASE ? `${BASE}/forecast` : "https://api.open-meteo.com/v1/forecast";
const DEFAULT_PLACE = { name: "Jakarta", country: "Indonesia", latitude: -6.2146, longitude: 106.8451 };

// Kode cuaca WMO -> teks, ikon, dan tema langit
const CODES = {
  0:  ["Cerah", "☀️", "clear"],
  1:  ["Cerah berawan", "🌤️", "clear"],
  2:  ["Berawan sebagian", "⛅", "cloud"],
  3:  ["Berawan tebal", "☁️", "cloud"],
  45: ["Berkabut", "🌫️", "fog"],
  48: ["Kabut beku", "🌫️", "fog"],
  51: ["Gerimis ringan", "🌦️", "rain"],
  53: ["Gerimis", "🌦️", "rain"],
  55: ["Gerimis lebat", "🌧️", "rain"],
  56: ["Gerimis beku", "🌧️", "rain"],
  57: ["Gerimis beku lebat", "🌧️", "rain"],
  61: ["Hujan ringan", "🌦️", "rain"],
  63: ["Hujan sedang", "🌧️", "rain"],
  65: ["Hujan lebat", "🌧️", "rain"],
  66: ["Hujan beku", "🌧️", "rain"],
  67: ["Hujan beku lebat", "🌧️", "rain"],
  71: ["Salju ringan", "🌨️", "snow"],
  73: ["Salju sedang", "🌨️", "snow"],
  75: ["Salju lebat", "❄️", "snow"],
  77: ["Butiran salju", "❄️", "snow"],
  80: ["Hujan lokal ringan", "🌦️", "rain"],
  81: ["Hujan lokal sedang", "🌧️", "rain"],
  82: ["Hujan lokal deras", "⛈️", "rain"],
  85: ["Hujan salju ringan", "🌨️", "snow"],
  86: ["Hujan salju lebat", "🌨️", "snow"],
  95: ["Badai petir", "⛈️", "storm"],
  96: ["Badai petir & es", "⛈️", "storm"],
  99: ["Badai petir & es lebat", "⛈️", "storm"],
};
const info = (code) => CODES[code] || ["Tidak diketahui", "🌡️", "cloud"];

const $ = (id) => document.getElementById(id);
const els = {
  form: $("searchForm"), q: $("q"), geo: $("geoBtn"), unit: $("unitBtn"),
  status: $("status"), app: $("app"),
};

let unit = localStorage.getItem("unit") || "celsius";
let place = JSON.parse(localStorage.getItem("place") || "null") || DEFAULT_PLACE;
let lastData = null;

const deg = (n) => `${Math.round(n)}°`;
const placeLabel = (p) => [p.name, p.admin1 && p.admin1 !== p.name ? p.admin1 : null, p.country].filter(Boolean).join(", ");

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.className = "status" + (isError ? " error" : "");
  els.status.hidden = !msg;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server membalas ${res.status}`);
  return res.json();
}

async function searchCity(name) {
  const data = await getJSON(`${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=id&format=json`);
  if (!data.results || !data.results.length) throw new Error(`Kota "${name}" tidak ditemukan. Coba ejaan lain.`);
  return data.results[0];
}

async function fetchWeather(p) {
  const params = new URLSearchParams({
    latitude: p.latitude, longitude: p.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: "auto", forecast_days: 7,
    temperature_unit: unit, wind_speed_unit: unit === "celsius" ? "kmh" : "mph",
  });
  return getJSON(`${WX_URL}?${params}`);
}

async function load(p) {
  setStatus("Memuat cuaca…");
  try {
    lastData = await fetchWeather(p);
    place = p;
    localStorage.setItem("place", JSON.stringify(p));
    render(lastData, p);
    setStatus("");
  } catch (err) {
    setStatus(navigator.onLine
      ? `Gagal memuat cuaca. ${err.message}`
      : "Kamu sedang offline. Sambungkan internet lalu coba lagi.", true);
  }
}

function render(d, p) {
  const c = d.current;
  const [text, icon, kind] = info(c.weather_code);
  const speedUnit = unit === "celsius" ? "km/j" : "mph";

  let sky = kind;
  if (kind === "clear" || kind === "cloud") sky += c.is_day ? "-day" : "-night";
  document.body.dataset.sky = sky;

  $("city").textContent = placeLabel(p);
  $("date").textContent = new Date(c.time).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
    + ", " + c.time.slice(11, 16);
  $("icon").textContent = icon;
  $("temp").textContent = deg(c.temperature_2m);
  $("desc").textContent = text;
  $("feels").textContent = deg(c.apparent_temperature);
  $("humidity").textContent = `${c.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(c.wind_speed_10m)} ${speedUnit}`;
  $("pressure").textContent = `${Math.round(c.surface_pressure)} hPa`;
  $("sunrise").textContent = d.daily.sunrise[0].slice(11, 16);
  $("sunset").textContent = d.daily.sunset[0].slice(11, 16);

  // 24 jam ke depan, mulai dari jam sekarang
  const h = d.hourly;
  const start = Math.max(0, h.time.findIndex((t) => t.slice(0, 13) === c.time.slice(0, 13)));
  $("hourly").innerHTML = h.time.slice(start, start + 24).map((t, i) => {
    const k = start + i;
    const prob = h.precipitation_probability[k];
    return `<li>
      <div class="h-time">${i === 0 ? "Sekarang" : t.slice(11, 16)}</div>
      <span class="h-icon" aria-hidden="true">${info(h.weather_code[k])[1]}</span>
      <div class="h-temp">${deg(h.temperature_2m[k])}</div>
      <div class="h-rain">${prob >= 20 ? prob + "%" : ""}</div>
    </li>`;
  }).join("");

  // Prakiraan harian dengan batang rentang suhu
  const dd = d.daily;
  const min = Math.min(...dd.temperature_2m_min);
  const max = Math.max(...dd.temperature_2m_max);
  const span = Math.max(max - min, 1);
  $("daily").innerHTML = dd.time.map((t, i) => {
    const name = i === 0 ? "Hari ini" : new Date(t + "T12:00").toLocaleDateString("id-ID", { weekday: "long" });
    const left = ((dd.temperature_2m_min[i] - min) / span) * 100;
    const width = ((dd.temperature_2m_max[i] - dd.temperature_2m_min[i]) / span) * 100;
    const rain = dd.precipitation_probability_max[i];
    return `<li>
      <span class="d-name">${name}</span>
      <span class="d-icon" aria-hidden="true">${info(dd.weather_code[i])[1]}</span>
      <span class="d-bar" aria-hidden="true"><span style="left:${left}%;width:${Math.max(width, 6)}%"></span></span>
      <span class="d-range"><span class="lo">${deg(dd.temperature_2m_min[i])}</span><span>${deg(dd.temperature_2m_max[i])}</span></span>
      ${rain >= 20 ? `<span class="d-rain">Peluang hujan ${rain}%</span>` : ""}
    </li>`;
  }).join("");

  els.app.hidden = false;
  document.title = `${deg(c.temperature_2m)} ${p.name} · Cuaca`;
}

// Event
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = els.q.value.trim();
  if (!name) return;
  setStatus("Mencari kota…");
  try {
    await load(await searchCity(name));
    els.q.value = "";
  } catch (err) {
    setStatus(err.message, true);
  }
});

els.geo.addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Browser ini tidak mendukung lokasi.", true);
  setStatus("Mengambil lokasimu…");
  navigator.geolocation.getCurrentPosition(
    (pos) => load({ name: "Lokasi saya", latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
    () => setStatus("Izin lokasi ditolak. Cari kota lewat kolom pencarian.", true),
    { timeout: 10000 }
  );
});

function syncUnitButton() { els.unit.textContent = unit === "celsius" ? "°C" : "°F"; }
els.unit.addEventListener("click", () => {
  unit = unit === "celsius" ? "fahrenheit" : "celsius";
  localStorage.setItem("unit", unit);
  syncUnitButton();
  load(place);
});

syncUnitButton();
load(place);
