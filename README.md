# Cosmic Crisp

**Space-to-Soil Crop, Irrigation & Pest Resilience Advisor**  
*Built for the 2026 NASA Space Apps Challenge — "Field Shift: Adapting Farms with NASA Data"*

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline_First-5A0FC8)](https://web.dev/progressive-web-apps/)

---

## Overview

**Cosmic Crisp** (*Crop Optimization through Satellite Monitoring, Insights, and Climate Intelligence*) is an offline-first, 3-dimensional decision-support Progressive Web App (PWA) that translates planetary Earth observations into practical, farm-level guidance.

Farmers around the world make high-stakes planting and resource decisions using static almanacs or fragmented historical intuition that no longer align with shifting temperatures, unpredictable rainfall, and declining soil health. Cosmic Crisp closes the **Crop Rotation Information Gap** by linking three operational pillars on a single, synced farm profile:

1. **Crop Rotation & Economics:** Ranks next-cycle rotation options across **88 FAO EcoCrop species** by balancing soil nitrogen, terrain slope, climate stability, machinery fit, and net margin ROI.
2. **Water-Scarcity Irrigation:** Models 6-month crop evapotranspiration ($ET_c$) against seasonal rainfall forecasts to rank water-saving irrigation methods (such as **82%-efficient Rain Pipes** and **92%-efficient Drip/SDI** over **54%-efficient flood furrows**) with storm-burst contingencies.
3. **Climate-Pathology Pest Strategy (IPM):** Links ENSO weather anomalies and the farm's active irrigation method to forecast monthly **Fungal vs. Insect** risk—helping farmers stage pre-season biologicals and traps (e.g., blue sticky cards, *Beauveria bassiana*, Neem NSKE 5%) before outbreaks hit the canopy.

---

## Key Features

- **Live Space-to-Soil Grounding:** Automatically streams orbital climate normals, root-zone soil moisture, elevation slope, and soil chemistry the moment a parcel is selected.
- **ENSO & 6-Month Seasonal Stress-Testing:** Integrates live **NOAA CPC Oceanic Niño Index (ONI)** readings and 51-member seasonal ensembles ($P_{10}$–$P_{90}$) to simulate El Niño, La Niña, and Neutral scenarios.
- **Cross-Synced Farm Workspace:** Changes made to crop selection, climate scenarios, or irrigation methods automatically propagate across the **Overview**, **Irrigation**, and **Pest & Disease** tabs.
- **Offline-First Rural Resilience:** Built with **Workbox Service Workers** and an **IndexedDB** sync queue so cached satellite bundles, crop assets, and Integrated Pest Management (IPM) checklists work seamlessly in zero-signal fields and auto-reconcile upon reconnection.
- **Global Accessibility:** Supports **5 languages** (`EN`, `ES`, `HI`, `FR`, `PT`) and instant switching between **Imperial** and **Metric** units.

---

## Data Sources & Scientific Telemetry

Cosmic Crisp harmonizes open Earth observation and agronomic datasets into a unified decision engine:

| Source | Dataset / Mission | Role in Cosmic Crisp |
| :--- | :--- | :--- |
| **NASA** | **NASA POWER** | 5-year agro-climatology normals, solar radiation, temperature, and precipitation |
| **NASA** | **SMAP L4** | Surface and root-zone soil moisture anomalies for planting & irrigation timing |
| **NASA** | **GPM** | Global Precipitation Measurement rainfall data & extreme storm thresholds ($P_{90}$) |
| **NASA** | **NASADEM** | Digital elevation model for field slope, erosion risk, and drainage analysis |
| **NASA** | **Landsat / GRACE-FO** | Historical crop/tillage context and long-term groundwater storage trends |
| **NOAA CPC** | **Oceanic Niño Index (ONI)** | Live ENSO phase tracking and teleconnection anomaly adjustments |
| **ISRIC** | **SoilGrids** | Parcel-level soil pH, organic carbon, and clay/sand/silt texture |
| **FAO / USDA** | **EcoCrop & CropScape** | Agronomic thresholds for 88 crop species and regional cropping baselines |
| **Open-Meteo** | **51-Member Ensemble** | 6-month probabilistic temperature and precipitation outlook |

---

## Tech Stack & Architecture

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Motion
- **Offline & PWA Layer:** `vite-plugin-pwa`, Workbox Service Worker caching, IndexedDB local persistence & sync queue
- **Backend & Tooling:** Node.js, Express, `tsx`, `@google/genai`, `dotenv`

### Project Structure

```text
Cosmic_Crisp_v2/
├── data/
│   └── cosmic-crisp-db.json          # Local agronomic & calibration dataset
├── public/
│   ├── assets/aistudio/              # FAO EcoCrop database (EcoCrop_DB_4187e884.csv)
│   └── crop-images/                  # Offline-cached crop reference photography
├── src/                              # React + TypeScript PWA client & hydro-pathology engine
├── server.ts                         # Express API & telemetry proxy server
├── index.html                        # PWA entry point
├── package.json                      # Project dependencies & scripts
├── NASA_SPACE_APPS_PITCH_AND_DEMO.md # Timed 2-minute pitch & 5-step farmer walkthrough
└── NASA_SPACE_APPS_SLIDE_DECK.md     # Presentation deck & speaker notes
```

---

## Disclaimer

### AI Assistance Disclosure

In accordance with NASA Space Apps Challenge guidelines:

- **Code Generation:** AI tools (**Google Gemini / Google AI Studio**) were used during development to assist with software engineering and code generation, including scaffolding the React/TypeScript Progressive Web App (PWA) components, structuring the Workbox/IndexedDB offline sync layer, and implementing the data-processing logic that integrates NASA, NOAA, and SoilGrids datasets.
- **Media & Branding:** No AI-generated images, videos, or audio were used in this repository. No NASA logos or official branding were used or modified in any generated content.

### License

This project was created for the **2026 NASA Space Apps Challenge**. Please refer to the repository license file for usage and distribution terms.
