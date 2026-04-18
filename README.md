# Soundings Viewer

An interactive atmospheric soundings viewer featuring HRRR, GFS, RAP, and NAM model soundings with SHARPpy-style derived parameter analysis, powered by a MapLibre GL JS map interface.

## Features

- **Interactive Map**: MapLibre GL JS dark-themed map with ~50 US upper-air stations
- **Skew-T / Log-P Diagram**: Full SVG-based Skew-T with temperature, dewpoint, parcel trace, wind barbs, dry adiabats, moist adiabats, mixing ratio lines, and LCL marker
- **Hodograph**: Color-coded by height (0-1km, 1-3km, 3-6km, 6-9km, 9-12km) with Bunkers storm motion marker
- **SHARPpy-Style Parameters Panel**: Thermodynamic (CAPE, CIN, LCL, LFC, EL, LI), kinematic (bulk shear, SRH, storm motion), and composite indices (STP, SCP, SHIP)
- **Model Selection**: Switch between HRRR, GFS, RAP, and NAM models
- **Forecast Hours**: Navigate through available forecast hours per model
- **Animated Traces**: Smooth draw-on animations for temperature/dewpoint traces and hodograph segments
- **Data Table**: Raw sounding data in tabular format
- **Dark Theme**: Polished dark UI with glassmorphism effects

## Getting Started

```bash
npm install
npm run dev
```

## Tech Stack

- React 19 + TypeScript
- Vite
- MapLibre GL JS
- D3.js (SVG rendering)
- CSS (no framework, custom dark theme)

## Architecture

```
src/
├── components/       # React components
│   ├── MapView       # MapLibre map with station markers
│   ├── SkewT         # Skew-T Log-P diagram
│   ├── Hodograph     # Wind hodograph
│   ├── ParamsPanel   # SHARPpy derived parameters
│   ├── DataTable     # Raw data table
│   └── Toolbar       # Model/forecast controls
├── services/         # Data fetching
├── utils/            # Thermodynamic calculations
├── data/             # Station database
└── types/            # TypeScript types
```
