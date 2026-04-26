

charge.ma

Technical Test Preparation Guide

Full-Stack Mobile Developer Position at Lumisphere

Abdelbari Messah  |  April 2026

# **Table of Contents**

Right-click and select Update Field to refresh page numbers

**Test Overview	3**

**Your Skills vs. Test Requirements	4**

What You Already Know	4

**Recommended Tech Stack	5**

**Step-by-Step Implementation	6**

Phase 1: Data Collection	6

Phase 2: Map and Markers	7

Phase 3: Routing and Corridor Filter	8

Phase 4: Reporting System	9

Phase 5: Driver UX	9

**Key Technical Concepts	10**

**Git Strategy and Deliverables	11**

**Time Management and Tips	12**

# **1\. Test Overview**

The charge.ma technical test is a 4-hour prototype assignment for a Full-Stack Mobile Developer position at Lumisphere, a Casablanca-based company specializing in professional lighting distribution and building their own ERP systems.

You are building a functional prototype of charge.ma, an EV charging station navigation app for Morocco. The app helps drivers find charging stations along their route, similar to Tesla Supercharger but for third-party networks (IRESEN, Shell Recharge, TotalEnergies, etc.).

## **Evaluation Criteria**

* Working interactive map with charging station markers

* Route planning with corridor filtering (stations within 5km of route)

* Code quality and architectural decisions

* Ability to deliver a functional prototype under time constraints

* Use of AI tools is encouraged and assumed

## **Time Budget**

| Step | Time | Description |
| :---- | :---- | :---- |
| Phase 1: Data | \~45 min | Collect charging station data for Morocco |
| Phase 2: Map | \~45 min | Interactive map with markers and popups |
| Phase 3: Routing | \~90 min | Route planning \+ 5km corridor filtering |
| Phase 4: Reports | \~45 min | Optional: broken station reporting |
| Phase 5: Driver UX | \~60 min | Optional: driving-optimized interface |

# **2\. Your Skills vs. Test Requirements**

Based on your resume, you have a strong foundation for this test. The key is leveraging what you know and avoiding unnecessary complexity.

## **What You Already Know**

* React / Next.js / TypeScript (frontend stack)

* Node.js, REST APIs, Express.js (backend concepts)

* React Native, Expo (mobile experience)

* PostgreSQL, MongoDB (data handling)

* Git, GitHub Actions (version control)

* AWS, GCP (cloud familiarity)

* Published apps on App Store and Play Store

## **What You Need to Learn/Review**

* Leaflet.js API (map library) — 15 minutes to review basics

* OSRM (Open Source Routing Machine) demo server — understand response format

* Haversine formula for distance calculation

* Polyline decoding (Google encoded polyline algorithm)

* Point-to-line-segment distance for corridor filtering

## **Important: No Flutter Required for the Test**

The job posting mentions Flutter, but the test explicitly requires a web-based prototype using Leaflet.js \+ OpenStreetMap. Build with Next.js \+ TypeScript, your strongest stack. Do not waste time learning Flutter for this test. The test is client-side only, no backend required.

# **3\. Recommended Tech Stack**

Stick to technologies you know well. The test evaluates the result, not the stack novelty.

| Layer | Technology | Why |
| :---- | :---- | :---- |
| Framework | Next.js \+ TypeScript | Your strongest stack |
| Map | Leaflet.js \+ OpenStreetMap | Free, no API key |
| Routing | OSRM demo server | Free, no API key |
| State | React useState/useEffect | No external state lib needed |
| Persistence | localStorage | For reports (optional) |
| Styling | Tailwind CSS or plain CSS | Quick, familiar |

Why this stack: You know React and TypeScript intimately. Leaflet.js is straightforward for React (react-leaflet). No backend means no database setup, no auth, no deployment. The entire app runs in the browser.

# **4\. Step-by-Step Implementation**

Follow this order. Do not skip ahead. The test explicitly says: make it work before making it pretty.

## **Phase 1: Data Collection (\~45 minutes)**

You need a dataset of EV charging stations in Morocco. This is part of the exercise, not a prerequisite.

### **Data Sources**

* OpenChargeMap API (free, global EV charging database)

* Operator websites: IRESEN, Shell Recharge, TotalEnergies

* Manual research for key locations along major routes

### **Minimum Viable Dataset**

For a prototype, you need \~15-20 stations along major Moroccan routes:

* Casablanca to Marrakech (via A3 highway)

* Rabat to Tangier (via A1 highway)

* Rabat to Casablanca (via A1 highway)

### **JSON Structure for Each Station**

{  id: string;  name: string;  operator: string;  latitude: number;  longitude: number;  power: number; // kW  connectorType: string;  status: "available" | "occupied" | "outOfOrder";}

## **Phase 2: Map and Markers (\~45 minutes)**

Set up the interactive map using Leaflet.js with OpenStreetMap tiles.

### **Implementation Steps**

* **Install dependencies:** npm install leaflet react-leaflet @types/leaflet

* **Create map component:** Initialize Leaflet map centered on Morocco (\~33N, \-7W)

* **Add marker layer:** Map over your station data and render a Marker for each station

* **Implement popup info:** Show name, operator, power, connector type, and status on click

* **Visual distinction:** Use different colors/icons for working vs broken stations

### **Key Leaflet Components**

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";\<MapContainer center={\[33.0, \-7.0\]} zoom={6}\>  \<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /\>  {stations.map(s \=\> (    \<Marker key={s.id} position={\[s.latitude, s.longitude\]}            icon={s.status \=== "outOfOrder" ? brokenIcon : normalIcon}\>      \<Popup\>{s.name} — {s.operator} — {s.power}kW\</Popup\>    \</Marker\>  ))}\</MapContainer\>

## **Phase 3: Routing and Corridor Filter (\~90 minutes)**

THIS IS THE MOST IMPORTANT STEP. The quality of your corridor filtering is the primary evaluation criterion.

### **Implementation Steps**

* **Input method:** Create start/end inputs. Use dropdown with predefined cities for reliability.

* **Call OSRM:** Fetch route from router.project-osrm.org (free, no API key)

* **Decode polyline:** OSRM returns an encoded polyline. Decode it to get route coordinates.

* **Filter stations:** Keep only stations within 5km of the route. Hide or gray out others.

* **Highlight corridor:** Visually distinguish corridor stations from others.

### **OSRM API Call**

const url \= \`https://router.project-osrm.org/route/v1/driving/  ${start.lng},${start.lat};${end.lng},${end.lat}?  overview=full\&geometries=polyline\`;const response \= await fetch(url);const data \= await response.json();const route \= data.routes\[0\];const encodedPolyline \= route.geometry;const decodedPoints \= decodePolyline(encodedPolyline);

### **Polyline Decoding**

Use a library like @mapbox/polyline or implement the Google polyline decoding algorithm. A TypeScript implementation takes \~20 lines.

### **Corridor Filtering Algorithm**

For each station, calculate its minimum distance to any segment of the route polyline. If distance \< 5km, keep it.

// Haversine distance (point to point)function haversine(lat1, lon1, lat2, lon2) {  const R \= 6371; // km  const dLat \= toRad(lat2 \- lat1);  const dLon \= toRad(lon2 \- lon1);  const a \= Math.sin(dLat/2)\*\*2 \+    Math.cos(toRad(lat1)) \* Math.cos(toRad(lat2)) \*    Math.sin(dLon/2)\*\*2;  return 2 \* R \* Math.atan2(Math.sqrt(a), Math.sqrt(1-a));}// Distance from point to line segmentfunction pointToSegmentDistance(px, py, x1, y1, x2, y2) {  // Project point onto segment, clamp to endpoints  // Return haversine distance to closest point}

Tip: Convert coordinates to a local Cartesian approximation for the projection math, then use Haversine for the final distance. Or use a spherical geometry library like Turf.js.

## **Phase 4: Reporting System (Optional, \~45 min)**

Let users report a station as broken. Persist reports across page reloads.

### **Implementation**

* **Add report button:** In each station popup, add a Report Broken button

* **Persist data:** Store reports in localStorage as JSON

* **Visual update:** Change marker appearance when station has active reports

* **Bonus: Counter:** Track number of reports and timestamps. Add Works button to counter a report.

const \[reports, setReports\] \= useState\<Report\[\]\>(() \=\> {  const saved \= localStorage.getItem("station-reports");  return saved ? JSON.parse(saved) : \[\];});useEffect(() \=\> {  localStorage.setItem("station-reports", JSON.stringify(reports));}, \[reports\]);

## **Phase 5: Driver UX (Optional, \~60 min)**

If you have time, adapt the UI for in-car usage: large buttons, high contrast, minimal text.

### **Required Features**

* Distance along route (not as-the-crow-flies) for each filtered station

* Estimated arrival time at each station

* Sort stations by order of appearance on the route

### **Distance Along Route**

Find the closest point on the route polyline for each station, then accumulate the route distance from start to that point. OSRM returns per-segment distances in the legs array.

# **5\. Key Technical Concepts**

Quick reference for the algorithms and APIs you will use.

## **Leaflet.js Quick Setup**

// Installnpm install leaflet react-leafletnpm install \-D @types/leaflet// Don't forget CSS in your \_app.tsx or layout.tsximport "leaflet/dist/leaflet.css";// Fix default marker icons in Next.jsimport L from "leaflet";const icon \= new L.Icon({  iconUrl: "/marker-icon.png",  iconSize: \[25, 41\],  iconAnchor: \[12, 41\]});

## **OSRM Response Structure**

{  routes: \[{    geometry: "encoded\_polyline\_string",    legs: \[{      steps: \[...\],      distance: 12345, // meters      duration: 1234   // seconds    }\],    distance: 12345,    duration: 1234  }\]}

## **Predefined Cities for Testing**

| City | Latitude | Longitude |
| :---- | :---- | :---- |
| Casablanca | 33.5731 | \-7.5898 |
| Rabat | 34.0209 | \-6.8416 |
| Marrakech | 31.6295 | \-7.9811 |
| Tangier | 35.7595 | \-5.8340 |
| Fes | 34.0181 | \-5.0078 |

# **6\. Git Strategy and Deliverables**

The deliverable is a Git repository plus README. No deployment required.

## **Repository Structure**

charge-ma-test/├── README.md├── package.json├── tsconfig.json├── next.config.js├── public/│   └── stations.json├── src/│   ├── components/│   │   ├── Map.tsx│   │   ├── StationMarker.tsx│   │   ├── RoutePlanner.tsx│   │   └── StationList.tsx│   ├── hooks/│   │   ├── useStations.ts│   │   └── useRoute.ts│   ├── utils/│   │   ├── polyline.ts│   │   └── distance.ts│   ├── types/│   │   └── station.ts│   └── pages/│       └── index.tsx

## **README Requirements**

* Project description (1-2 sentences)

* How to run: npm install && npm run dev

* Data source explanation

* List of implemented features

* Any known limitations

## **What NOT to Include**

* No backend server (test says client-side only is accepted)

* No authentication

* No unit tests

* No deployment scripts

* Do not commit node\_modules

# **7\. Time Management and Tips**

You have approximately 4 hours. Here is how to allocate them effectively.

| Time | Focus | Goal |
| :---- | :---- | :---- |
| 0:00-0:45 | Data \+ Project setup | JSON stations, Next.js scaffold |
| 0:45-1:30 | Map display | Working map with all markers |
| 1:30-3:00 | Routing \+ Filter | OSRM integration, 5km corridor |
| 3:00-3:30 | Polish \+ Reports | localStorage, visual fixes |
| 3:30-4:00 | Driver UX \+ README | Optional features, documentation |

## **Critical Tips**

* **Start with data:** Prepare your station JSON first. Everything else depends on it.

* **Hardcode cities:** Use a dropdown with predefined coordinates. No need for geocoding APIs.

* **Test with real routes:** Casablanca to Marrakech, Rabat to Tangier. These are your validation cases.

* **Use AI aggressively:** The company explicitly encourages Claude Code, Cursor, Copilot. Use them for boilerplate, polyline decoding functions, and distance calculations.

* **Make it work first:** A working corridor filter with basic UI beats a beautiful map with no routing.

* **Commit often:** git commit after each phase. Shows your work process.

## **Common Pitfalls to Avoid**

* Do NOT try to learn Flutter for this test. Use Next.js \+ React.

* Do NOT build a backend. The test says client-side only is accepted.

* Do NOT use Google Maps API (requires billing). Use OpenStreetMap \+ Leaflet (free).

* Do NOT forget to decode the OSRM polyline. It is encoded by default.

* Do NOT calculate straight-line distance for corridor filtering. Use point-to-segment distance along the actual route.

## **Final Checklist Before Submission**

* Map shows Morocco with charging station markers

* Markers show info popup on click

* Broken stations are visually distinct

* Route can be planned between two cities

* Only stations within 5km of route are highlighted

* Other stations are hidden or grayed out

* Code is in a Git repository with meaningful commits

* README explains how to run the project

**Good Luck**

Abdelbari Messah  |  abdelbari.amessah@gmail.com

linkedin.com/in/abdelbari-messah