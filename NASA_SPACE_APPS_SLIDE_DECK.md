---
marp: true
theme: default
paginate: true
backgroundColor: "#F8FAFC"
color: "#0F172A"
---

# Cosmic Crisp
### Space-to-Soil Crop, Water & Pest Resilience for Every Farm
**NASA Space Apps Challenge Presentation**

> **Visual Layout:** Clean off-white canvas (`#F8FAFC`), Cosmic Crisp logo top-left, subtle Earth-observation telemetry strip (NASA POWER · SMAP · NOAA ONI · SoilGrids), and a high-contrast portrait of a Maharashtra vineyard on the right.

**Speaker Notes (`0:00 – 0:15`):**  
Meet Rajesh, a wine-grape grower in Nashik, Maharashtra, India. Every season before the monsoon, he has to make two make-or-break bets: how to stretch shrinking well water across dry months, and which crop protections to stage before pests destroy his harvest.

---

# The Climate Blind Spot
### When El Niño Flips the Rules, Static Calendars Fail

- **Water Whiplash:** El Niño weakens South Asian monsoon rains (~`-24%` shift, `+1.4°C`), draining borewells—while extreme storm bursts still threaten low-lying rows.
- **Inverted Pest Pressure:** Clear, dry skies **reduce** fungal Downy Mildew—but trigger explosive **thrips, mealybug, and spider mite** attacks.
- **Last-Mile Gap:** Orbital forecasts sit in raw scientific portals, unusable offline in rural fields.

> **Visual Layout:** Two-column contrast graphic: Left side shows *Traditional Blind Spraying & Flood Furrows*; Right side shows *El Niño Dry Anomaly -> Low Mildew + High Insect Surge*.

**Speaker Notes (`0:15 – 0:35`):**  
When El Niño arrives, Maharashtra gets hotter and drier. Farmers using last year's calendar keep spraying for fungal rot that never comes—while missing the insect surge thriving in clear, dry canopies. Meanwhile, disconnected rural fields need tools that work without internet.

---

# Space-to-Soil Architecture
### Turning Live NASA & NOAA Telemetry into Parcel Decisions

- **NASA Climate & Hydrology:** NASA POWER 5-year normals, SMAP L4 root moisture, GPM rainfall, NASADEM terrain slope.
- **Seasonal Teleconnections:** Live **NOAA CPC Oceanic Niño Index (ONI)** + **51-member Open-Meteo 6-month ensemble** ($P_{10}$–$P_{90}$).
- **Soil & Crop Grounding:** **ISRIC SoilGrids** chemistry + **FAO EcoCrop (88 crops)** + **USDA CropScape**.

> **Visual Layout:** Three-tier horizontal pipeline diagram (`Orbital & Climate APIs` -> `Cosmic Crisp Hydro-Pathology Engine` -> `Offline-First Field PWA`).

**Speaker Notes (`0:35 – 0:55`):**  
Cosmic Crisp bridges orbital science to field execution. We combine NASA POWER, SMAP, GPM, and NASADEM terrain with ISRIC SoilGrids and live NOAA ONI seasonal ensembles across 88 FAO EcoCrop species—translating global anomalies into local 6-month parcel intelligence.

---

# Three Linked Field Decisions
### One Synced Farm Profile Across Rotation, Water & Protection

1. **Crop Rotation & Economics:** Ranks next-cycle crops by soil nitrogen, climate stability, machinery fit, and net margin ROI.
2. **Irrigation & Scarcity Defense:** Models 6-month water balance ($ET_c$ vs. rain) and recommends **Rain Pipes (`82%` efficiency)** over **Furrow (`54%`)**.
3. **Climate-Pathology IPM:** Links ENSO weather + irrigation method to forecast **Fungal vs. Insect** monthly risk.

> **Visual Layout:** Three clean white surface cards (`#FFFFFF`, `1px` `#E2E8F0` border) mirroring the Cosmic Crisp **Overview**, **Irrigation**, and **Pest & Disease** workspace tabs.

**Speaker Notes (`0:55 – 1:15`):**  
Instead of siloed charts, Cosmic Crisp links three decisions on one farm profile: profitable crop rotation, Rain Pipes micro-spray irrigation during severe water scarcity, and proactive IPM pest defense tuned to the farm's exact watering method.

---

# Measurable Impact for Farmers
### Proactive Preparation Before Losses Hit the Canopy

- **Water Conservation:** Shifts scarce parcels from `54%`-efficient furrow flooding to `82%` **Rain Pipes** or `92%` **Drip / SDI**, cutting evaporation waste.
- **Targeted IPM Savings:** Replaces reactive calendar fungicide sprays with pre-season blue sticky traps, *Beauveria* / Neem bio-controls, and threshold triggers.
- **Zero-Signal Resilience:** Built as a **PWA + IndexedDB** offline store so farm packs and checklists survive zero connectivity.

> **Visual Layout:** Bold 3-metric KPI strip (`82% Rain Pipe Efficiency` · `6-Month ENSO Horizon` · `88 Crop Species` · `100% Offline Sync`) using tabular numerals.

**Speaker Notes (`1:15 – 1:35`):**  
The result is measurable resilience: less groundwater wasted to evaporation, fewer unnecessary chemical passes, earlier protection against drought-driven insect spikes, and full offline continuity out in the field.

---

# Live Product Demo Flow
### Walking Through Rajesh's Nashik Vineyard (El Niño Season)

1. **Farm Setup (`Overview`):** Select **Nashik, Maharashtra** + **Wine Grapes** -> instant NASA/SoilGrids grounding.
2. **Water Scarcity (`Irrigation`):** Toggle **El Niño Stress** + **Severe Scarcity** -> 6-month deficit flags **Rain Pipes**.
3. **Insect Pivot (`Pest & Disease`):** See **Downy Mildew** drop while **Thrips & Mealybug** surge -> check off **IPM** prep.
4. **Offline Proof (`Toolbar`):** Enable **Field Offline Test** -> changes persist locally.

> **Visual Layout:** Numbered 4-step horizontal journey bar pointing toward a live browser screen share of Cosmic Crisp.

**Speaker Notes (`1:35 – 2:00`):**  
Let's see how Rajesh uses Cosmic Crisp in practice—starting on his Nashik vineyard, stress-testing an El Niño dry spell across Irrigation and Pest & Disease, and saving his plan completely offline.

---

# Offline-First Rural Engineering
### Built for Low-Bandwidth Farms Around the World

- **Service Worker + Workbox Cache:** Stores satellite climate bundles, crop photos, and seasonal outlooks on device.
- **IndexedDB Sync Queue:** Captures farm edits, harvest logs, and pest prep completions offline and auto-reconciles on reconnect.
- **Global Calibration:** Pre-validated across US Corn Belt, Pacific Northwest, California Central Valley, and South Asian monsoon belts.

> **Visual Layout:** Clean architecture diagram showing Browser PWA (IndexedDB + Workbox) syncing bidirectionally with Express API + NASA/NOAA/SoilGrids upstream sources.

**Speaker Notes *(Backup / Judge Reference)*:**  
Every engineering choice prioritizes field reliability. Workbox caches satellite insights and crop assets locally, while an IndexedDB mutation queue ensures zero data loss when growers leave cell coverage.

---

# Cosmic Crisp
### Turning Planetary Earth Science into Everyday Harvest Security

- **Live Telemetry:** NASA POWER · SMAP L4 · GPM · NASADEM · NOAA CPC ONI · ISRIC SoilGrids
- **Built for Farmers:** Imperial & Metric units · 5 languages (`EN`, `ES`, `HI`, `FR`, `PT`) · Zero-signal PWA

> **Visual Layout:** Minimal closing slide with Cosmic Crisp wordmark, clean summary of live Earthdata integrations, and presenter contact block.

**Speaker Notes *(Closing)*:**  
Cosmic Crisp transforms open NASA and NOAA Earth observations into clear, offline-ready water and pest decisions—helping farmers adapt before climate shocks reach their fields. Thank you.
