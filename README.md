# Charge.ma - Advanced EV Route Planner

Charge.ma is a premium Electric Vehicle (EV) route planning application specifically designed for the Moroccan landscape. It helps EV drivers plan long-distance journeys by finding charging stations along their route, estimating arrival times, and providing a driver-optimized interface for in-car usage.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [pnpm](https://pnpm.io/) (Recommended package manager)

### Installation
```bash
# Install dependencies
pnpm install
```

### Running the Application
```bash
# Start the development server
pnpm dev
```
Open [http://localhost:3000/map](http://localhost:3000/map) to see the application in action.

---

## 🛠 Technologies & Tools

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Client Components)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Mapping**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Routing Engine**: [OSRM (Open Source Routing Machine)](http://project-osrm.org/)
- **Geocoding**: [Nominatim (OpenStreetMap)](https://nominatim.org/)
- **Styling**: Vanilla CSS with Modern UI principles (Glassmorphism, Dark Mode)
- **Persistence**: Browser `localStorage` (for search history and user reports)

---

## 🗺 Development Phases

### Phase 1: Real-time Data & Corridor Filtering
- Integrated OSRM to calculate real road routes between any two points in Morocco.
- Implemented **Corridor Filtering**: The app automatically identifies charging stations within a 5km radius of the planned route.
- Added a real-time station search and filtering system.

### Phase 2: Interactive Map Controls
- **Draggable Markers**: Users can drag the Start (A) and Destination (B) markers anywhere on the map to instantly update the route.
- **Reverse Geocoding**: Dragging a marker automatically updates the location name in the UI using Nominatim.
- **Search History**: Persisted the last 10 searches for quick access.

### Phase 3: Interactive Pick-on-Map
- Added a "Pick on map" mode that changes the cursor to a crosshair, allowing users to select locations by clicking directly on the map.
- Implemented "Swap" and "Clear" functionality for easier route management.
- **Smart Filtering**: Non-corridor stations are completely hidden once a route is planned to keep the driver focused.

### Phase 4: Crowdsourced Reporting System
- **Broken/Works Reports**: Users can report the status of a charger directly from the station details card.
- **Visual Indicators**: Stations reported as "Broken" feature a dashed red ring and warning icons on the map.
- **Persistence**: Reports are saved locally, ensuring your contributions are remembered across sessions.
- **Decision Logic**: Limited each user to one active decision per station to prevent spamming.

### Phase 5: Driver UX (Navigation Mode)
- **Road-Distance Logic**: Calculated precise distances "along the road" rather than straight-line distances.
- **ETA Estimation**: Automatic arrival time calculation for every upcoming stop.
- **Chronological Sorting**: Stations are sorted by their appearance along your journey.
- **In-Car Optimized UI**: High-contrast, large-button interface designed for safe and easy interaction while driving.
- **Start Drive**: One-click export to Google Maps with all charging waypoints included.

---

## 🏗 Key Features

- **Dynamic Route Optimization**: Real-time adjustment of chargers based on the specific road path.
- **Premium Aesthetics**: Sleek dark mode, glassmorphism effects, and custom SVG map markers.
- **Zero Placeholder Data**: All distances, durations, and names are pulled from real-world APIs and datasets.
- **Driver-First Design**: Minimal text, large touch targets, and high-readability fonts.

---

## 📁 Project Structure

- `app/map/page.tsx`: Main application logic and state management.
- `app/map/MapCanvas.tsx`: Leaflet map integration and event handling.
- `app/lib/mapIcons.ts`: Custom SVG marker definitions for different station states.
- `public/stations-slim.json`: The charging station dataset for Morocco.
