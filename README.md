# Cosmic Crisp

**Space-to-Soil Crop, Irrigation & Pest Resilience Advisor**  
*Built for the 2026 NASA Space Apps Challenge — "Field Shift: Adapting Farms with NASA Data"*

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline_First-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## Overview & Purpose

**Cosmic Crisp** (*Crop Optimization through Satellite Monitoring, Insights, and Climate Intelligence*) is an offline-first decision-support Progressive Web App (PWA) that translates planetary Earth observations into practical, parcel-level agricultural action.

Farmers around the world make high-stakes planting, watering, and crop-protection decisions using static almanacs or fragmented intuition that no longer hold under shifting temperatures, erratic monsoons, and declining groundwater. Cosmic Crisp closes the **Crop Rotation & Climate Adaptation Gap** by linking three operational pillars onto a single synced farm profile:

1. **Crop Rotation & Economics (`Overview` & `Climate & Soil`):** Ranks next-cycle rotation options across **88 FAO EcoCrop species** by balancing soil nitrogen dynamics, terrain slope erosion, thermal/moisture suitability, machinery ownership, and projected net margin ROI.
2. **Water-Scarcity Irrigation & Flood Contingency (`Irrigation`):** Models 6-month crop evapotranspiration ($ET_c$) against seasonal rainfall anomalies and $P_{10}$–$P_{90}$ storm spread to rank five irrigation & drainage systems—highlighting **Rain Pipes (Perforated Micro-Spray, ~82% efficiency)** and **Drip / SDI (~92% efficiency)** over **Furrow flooding (~54%)**, paired with flood-drainage and lateral-coiling contingencies.
3. **Climate-Pathology Pest & Disease Strategy (`Pest & Disease`):** Combines live ENSO climate anomalies with the farm's active irrigation method to forecast monthly **Fungal & Oomycete**, **Insect & Mite Vector**, and **Soil / Collar Rot** risk—for instance, showing how dry, clear **El Niño** conditions reduce grape downy mildew while triggering **thrips, mealybug, and spider mite** surges, backed by an Integrated Pest Management (IPM) preparation checklist.

---

## Key Features

- **Live Space-to-Soil Grounding:** Automatically streams orbital climate normals, root-zone moisture, terrain slope, and multi-depth soil chemistry for any global coordinate or searched district.
- **Live NOAA ENSO & 6-Month Seasonal Stress-Testing:** Pulls live **NOAA CPC Oceanic Niño Index (ONI)** values and **51-member Open-Meteo seasonal ensembles** so growers can compare Live Outlook against **El Niño**, **La Niña**, and **Neutral** stress scenarios.
- **Cross-Synced Farm Workspace:** Changes to active crop, location, climate scenario, or irrigation method propagate instantaneously across **Overview**, **Climate & Soil**, **Irrigation**, **Pest & Disease**, **Alerts**, and **Farm Log**—all persisted per farm profile.
- **Offline-First Rural Resilience:** Uses **Workbox Service Workers**, locally bundled crop imagery, and an **IndexedDB** farm pack & mutation sync queue so plans, alerts, and IPM checklists operate reliably without connectivity and reconcile automatically upon reconnect.
- **Global Accessibility:** Supports **5 languages** (`EN`, `ES`, `HI`, `FR`, `PT`) and toggles cleanly between **Imperial** (default) and **Metric** units.

---

## How We Built It (System Architecture)

Cosmic Crisp uses a three-layer architecture engineered for scientific rigor on the server and instant responsiveness—even offline—in the browser:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                   1. External Earth Observation & Climate APIs             │
│  NASA POWER · NOAA CPC ONI · Open-Meteo (Forecast/Seasonal/DEM/Geocode)    │
│  ISRIC SoilGrids (REST + VRT) · Planetary Computer STAC · NASA Earthdata   │
│  USDA NASS CropScape · Google Gemini (@google/genai)                       │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 2. Node.js / Express + Python xarray Backend               │
│  • Telemetry Proxy & Normalizer (/api/farm-insights, /api/seasonal-outlook)│
│  • In-Memory Python Geospatial Pipeline (rioxarray + GDAL /vsicurl/)       │
│  • Input Validation, Multi-Farm JSON Store & Offline Sync Reconciliation   │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               3. React + TypeScript Offline-First PWA Client               │
│  • Deterministic Agronomic, Irrigation & IPM Pathology Engines             │
│  • Workbox Service Worker Runtime Caching + IndexedDB Mutation Queue       │
│  • Interactive SVG Charts, Farm Profile Switcher & Alert Push Engine       │
└────────────────────────────────────────────────────────────────────────────┘
```

1. **Telemetry Normalization & Caching Layer:** Express endpoints aggregate multi-source climate, soil, elevation, and seasonal ensemble data in parallel, caching upstream calls with automatic regional climatology fallbacks if any external service is unreachable.
2. **In-Memory Geospatial `xarray` Bridge:** For deeper raster diagnostics, Node invokes a Python `xarray` / `rioxarray` worker that streams Cloud-Optimized GeoTIFFs and virtual rasters (`/vsicurl/`) directly into memory, reprojects layers onto a unified `EPSG:4326` grid, and optionally feeds summary statistics to Gemini AI.
3. **Deterministic Decision Engines on Client & Server:** Yield rotation, 6-month monthly water balance, 5-method irrigation scoring, and regional pest-vs-fungal risk curves execute deterministically so interactive stress-testing works with zero latency both online and offline.
4. **Offline Persistence & Sync Queue:** Every farm setting update, harvest log, irrigation plan, and pest checklist change writes immediately to IndexedDB; when offline (`Field Offline Test` or real signal loss), changes queue locally and auto-sync when connectivity returns.

---

## Major External APIs & Data Endpoints Used

| Category | API / Service Name | Endpoint / Access Pattern | Role & Data Extracted |
| :--- | :--- | :--- | :--- |
| **NASA Agro-Climate** | **NASA POWER Temporal Monthly API** | `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,PRECTOTCORR,GWETROOT,RH2M,ALLSKY_SFC_SW_DWN&community=AG&longitude={lon}&latitude={lat}&start=2021&end=2025&format=JSON` | Pulls 5-year monthly air temperature (`T2M`), bias-corrected precipitation (`PRECTOTCORR`), root-zone soil wetness (`GWETROOT`), relative humidity (`RH2M`), and surface solar irradiance (`ALLSKY_SFC_SW_DWN`). |
| **NASA Earthdata Cloud** | **NASA CMR & Virtual Cloud Streams (`earthaccess`)** | Queried via `earthaccess.search_data(...)` across collections `SPL4SMGP` (SMAP L4), `GPM_3IMERGDF` / `GPM_3IMERGDL` (GPM IMERG), `VNP22Q2` / `MCD12Q2` (Phenology), and `NASADEM_HGT` | Streams surface/root-zone soil moisture, daily precipitation rate, phenology season length, and elevation into unified `xarray` parcel summaries. |
| **ENSO Climate Index** | **NOAA CPC Oceanic Niño Index (ONI)** | `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` | Parses live 3-month running ONI sea-surface temperature anomalies (`°C`) and trend deltas to classify active **El Niño**, **La Niña**, or **ENSO-Neutral** phase probabilities (6h server cache). |
| **6-Month Ensemble** | **Open-Meteo Seasonal Forecast API** | `https://seasonal-api.open-meteo.com/v1/seasonal?latitude={lat}&longitude={lon}&daily=temperature_2m_mean,precipitation_sum&forecast_days=185` | Pulls 51-member 185-day seasonal ensemble daily forecasts to compute monthly mean rainfall, $P_{10}$–$P_{90}$ storm/drought uncertainty bands, heavy-rain days, and $ET_0$ (3h server cache). |
| **Short-Term Weather** | **Open-Meteo 16-Day Weather API** | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=...&daily=...&forecast_days=16` | Supplies current temperature, humidity, wind, and 16-day frost/heat/heavy-rain hazard triggers for real-time farm alerts. |
| **Terrain & Slope** | **Open-Meteo Elevation API** | `https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}` | Samples a 5-point cardinal cross around the parcel center to calculate field elevation and slope gradient (`flat`, `gentle`, `steep`). |
| **Location Search** | **Open-Meteo Geocoding API** | `https://geocoding-api.open-meteo.com/v1/search?name={query}&count=6&language=en&format=json` | Converts worldwide city, county, and village queries into coordinates, region names, and country metadata. |
| **Soil Chemistry** | **ISRIC SoilGrids v2.0 REST API** | `https://rest.isric.org/soilgrids/v2.0/properties/query?lat={lat}&lon={lon}&property=phh2o&property=soc&property=nitrogen&property=clay&property=sand&property=silt&depth=0-5cm&depth=5-15cm&depth=15-30cm&depth=30-60cm&value=mean` | Retrieves multi-depth soil pH, soil organic carbon (SOC), nitrogen, and clay/sand/silt fractions for crop matching and soil available water capacity (AWC). |
| **Cloud Soil Rasters** | **ISRIC SoilGrids `/vsicurl/` VRTs** | `/vsicurl/https://files.isric.org/soilgrids/latest/data` | Streams spatial SoilGrids raster windows directly into `rioxarray` without full tile downloads. |
| **Planetary Geospatial** | **Microsoft Planetary Computer STAC API** | `https://planetarycomputer.microsoft.com/api/stac/v1` | Searches and streams `nasadem`, `modis-12Q2-061`, `modis-13Q1-061`, `era5-pds`, and `gpm-imerg-hhr` items via `pystac-client` and `planetary-computer`. |
| **US Cropping Baseline** | **USDA NASS CropScape CDL Service** | `https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLStat?year=2023&bbox={bbox}&format=json` | Pulls county/parcel historical Cropland Data Layer crop distributions for US farm coordinates. |
| **Agronomic AI Synthesis** | **Google Gemini API (`@google/genai`)** | Server-side SDK call using `GEMINI_API_KEY` | Generates structured agronomic synthesis and localized checklists from streamed `xarray` geospatial summaries. |

### Internal Backend API Routes (`/api/*`)

- `GET /api/health` — Server and farm JSON store health check
- `GET /api/geocode` — Worldwide parcel geocoding with local regional hub fallback
- `GET /api/weather` — Current conditions and 16-day forecast proxy
- `GET /api/farm-insights` — Unified NASA POWER + SoilGrids + DEM + 16-day forecast + CropScape parcel bundle
- `GET /api/seasonal-outlook` — Live NOAA CPC ONI + 6-month Open-Meteo 51-member seasonal outlook
- `GET / POST /api/farms`, `GET /api/farms/:farmId`, `PATCH /api/farms/:farmId/settings` — Multi-farm profile storage including crop, unit system, `irrigationPlan`, and `pestPlan`
- `GET / POST / DELETE /api/farms/:farmId/logs` — Harvest cycle history tracking
- `PUT /api/farms/:farmId/alerts/thresholds`, `POST /api/farms/:farmId/alerts/history` — Weather threshold and notification logs
- `POST /api/farms/:farmId/sync` — Batch offline IndexedDB mutation reconciliation
- `POST /api/predict`, `POST /api/geospatial/ingest`, `POST /api/ai/analyze` — Statistical crop prediction, Python `xarray` streaming, and Gemini synthesis

---

## Tech Stack & Project Structure

- **Frontend:** React `19.0`, TypeScript `7.0`, Vite `8.3`, Tailwind CSS `4.3`, Lucide Icons, Motion
- **Offline & PWA Layer:** `vite-plugin-pwa`, Workbox Service Worker caching, IndexedDB local farm store & mutation sync queue
- **Backend & Geospatial Tooling:** Node.js, Express, `tsx`, `@google/genai`, `dotenv`, plus Python 3 (`xarray`, `rioxarray`, `pystac-client`, `planetary-computer`, `earthaccess`)

```text
Cosmic_Crisp/
├── data/
│   └── cosmic-crisp-db.json          # Persisted multi-farm profiles, logs & plans
├── public/
│   ├── assets/aistudio/              # FAO EcoCrop database (EcoCrop_DB_4187e884.csv)
│   └── crop-images/                  # 88 unique offline-cached crop photographs
├── python_ingestion/
│   └── ingest.py                     # In-memory xarray Planetary Computer, Earthdata & SoilGrids streamer
├── server/
│   ├── db.ts                         # Atomic farm profile JSON DB & offline sync reconciler
│   ├── ensoSeasonal.ts               # Live NOAA ONI + Open-Meteo 6-month seasonal forecast engine
│   ├── geospatialBridge.ts           # Node-to-Python xarray ingestion bridge
│   ├── aiAnalysis.ts                 # Gemini structured agronomic synthesis client
│   └── validation.ts                 # Runtime API & farm settings schema validation
├── src/
│   ├── components/                   # Overview, Climate, Irrigation, Pest & Disease, Alerts & Log views
│   ├── data/                         # 88-crop FAO EcoCrop records, regional hubs & offline benchmarks
│   ├── i18n/                         # Multi-language localization (EN, ES, HI, FR, PT)
│   └── lib/                          # Rotation, Irrigation, Pest & Disease, Units, API & IndexedDB engines
├── server.ts                         # Express API & Vite SSR/dev entry point
├── package.json                      # Node dependencies & scripts
├── requirements.txt                  # Python geospatial dependencies
├── NASA_SPACE_APPS_PITCH_AND_DEMO.md # Timed 2-minute pitch & 5-step farmer walkthrough
└── NASA_SPACE_APPS_SLIDE_DECK.md     # Exportable Marp/Markdown presentation deck & speaker notes
```

---

## Running Locally

1. **Install Node dependencies:**
   ```bash
   npm install
   ```
2. **Optional — Install Python geospatial dependencies** (for `/api/geospatial/ingest` & xarray streaming):
   ```bash
   pip install -r requirements.txt
   ```
3. **Configure environment variables** (copy `.env.example` to `.env` if needed for `GEMINI_API_KEY` or `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`).
4. **Start the development server on port 3000:**
   ```bash
   npm run dev
   ```
5. **Typecheck & build for production:**
   ```bash
   npm run lint
   npm run build
   ```

---

## Disclaimer

### AI Assistance Disclosure

In accordance with NASA Space Apps Challenge guidelines:

- **Code Generation:** AI tools (**Google Gemini / Google AI Studio**) were used during development to assist with software engineering and code generation, including scaffolding the React/TypeScript Progressive Web App (PWA) components, structuring the Workbox/IndexedDB offline sync layer, and implementing the data-processing logic that integrates NASA, NOAA, Open-Meteo, and SoilGrids datasets.
- **Media & Branding:** Crop photographs are cached locally from verified Wikimedia sources, and UI icons use Lucide React. No NASA logos or official branding were altered or misused in any generated content.

### License

This project was created for the **2026 NASA Space Apps Challenge**. Please refer to the repository license file for usage and distribution terms.
