"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type Station = {
  id: string;
  name: string;
  operator: string;
  latitude: number;
  longitude: number;
  power: number;
  connectorType: string;
  status: "available" | "occupied" | "outOfOrder";
};

type Report = {
  stationId: string;
  type: "broken" | "works";
  timestamp: number;
};

type PlaceOption = {
  id: string;
  label: string;
  subLabel: string;
  latitude: number;
  longitude: number;
};

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type ModalStep = "home" | "placeSearch" | "destinations" | "routePlan";
type SearchTarget = "start" | "destination";
type RoutePoint = [number, number];

type CorridorStation = {
  id: string;
  distanceAlongRouteKm: number;
  durationToStationMin: number;
};

const moroccoPlaces: PlaceOption[] = [
  { id: "casablanca", label: "Casablanca", subLabel: "Casablanca-Settat, Morocco", latitude: 33.5731, longitude: -7.5898 },
  { id: "rabat", label: "Rabat", subLabel: "Rabat-Sale-Kenitra, Morocco", latitude: 34.0209, longitude: -6.8416 },
  { id: "mohammedia", label: "Mohammedia", subLabel: "Casablanca-Settat, Morocco", latitude: 33.6861, longitude: -7.3829 },
  { id: "marrakech", label: "Marrakech", subLabel: "Marrakech-Safi, Morocco", latitude: 31.6295, longitude: -7.9811 },
];

const CORRIDOR_KM = 5;

function decodePolyline(encoded: string): RoutePoint[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: RoutePoint[] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointToSegmentDistanceKm(
  pointLat: number,
  pointLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
) {
  const refLatRad = toRad((pointLat + startLat + endLat) / 3);
  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos(refLatRad);

  const px = pointLon * kmPerDegLon;
  const py = pointLat * kmPerDegLat;
  const x1 = startLon * kmPerDegLon;
  const y1 = startLat * kmPerDegLat;
  const x2 = endLon * kmPerDegLon;
  const y2 = endLat * kmPerDegLat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return haversineKm(pointLat, pointLon, startLat, startLon);
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / segmentLengthSquared),
  );

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const closestLon = closestX / kmPerDegLon;
  const closestLat = closestY / kmPerDegLat;

  return haversineKm(pointLat, pointLon, closestLat, closestLon);
}

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#07111f]">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-500" />
        <p className="text-slate-300">Loading map...</p>
      </div>
    </div>
  ),
});

export default function MapPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reports, setReports] = useState<Report[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("station-reports");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("station-reports", JSON.stringify(reports));
  }, [reports]);

  const handleReport = (stationId: string, type: "broken" | "works") => {
    setReports((prev) => {
      const filtered = prev.filter((r) => r.stationId !== stationId);
      return [...filtered, { stationId, type, timestamp: Date.now() }];
    });
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [stationSearchOpen, setStationSearchOpen] = useState(false);
  const [stationSearchQuery, setStationSearchQuery] = useState("");
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const [step, setStep] = useState<ModalStep>("home");
  const [searchTarget, setSearchTarget] = useState<SearchTarget>("destination");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceOption[]>(moroccoPlaces);
  const [startPlace, setStartPlace] = useState<PlaceOption | null>(moroccoPlaces[0]);
  const [destinationPlace, setDestinationPlace] = useState<PlaceOption | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [corridorStations, setCorridorStations] = useState<CorridorStation[]>([]);
  const corridorStationIds = useMemo(
    () => new Set(corridorStations.map((s) => s.id)),
    [corridorStations],
  );
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    duration: number;
    distance: number;
  } | null>(null);

  const [searchHistory, setSearchHistory] = useState<PlaceOption[]>([]);
  const [isPickingFromMap, setIsPickingFromMap] = useState<SearchTarget | null>(
    null,
  );

  useEffect(() => {
    const saved = localStorage.getItem("searchHistory");
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  const addToHistory = (place: PlaceOption) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((p) => p.id !== place.id);
      const next = [place, ...filtered].slice(0, 10);
      localStorage.setItem("searchHistory", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoading(true);
        const response = await fetch("/stations-slim.json");
        if (!response.ok) throw new Error("Failed to load stations");
        const data: Station[] = await response.json();
        setStations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    loadStations();
  }, []);

  useEffect(() => {
    const query = placeQuery.trim();
    if (!query) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setPlaceLoading(true);
        setPlaceError(null);

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ma&limit=8&q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Unable to search places");
        const data = (await response.json()) as NominatimItem[];
        const parsed: PlaceOption[] = data.map((item) => {
          const [label, ...rest] = item.display_name.split(",");
          return {
            id: `nominatim-${item.place_id}`,
            label: label.trim(),
            subLabel: rest.join(",").trim(),
            latitude: Number(item.lat),
            longitude: Number(item.lon),
          };
        });
        setPlaceResults(parsed);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPlaceError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!controller.signal.aborted) setPlaceLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [placeQuery]);

  const displayedPlaceResults = placeQuery.trim() ? placeResults : moroccoPlaces;
  const displayedPlaceLoading = placeQuery.trim() ? placeLoading : false;
  const displayedPlaceError = placeQuery.trim() ? placeError : null;

  const stationSearchResults = useMemo(() => {
    const normalized = stationSearchQuery.trim().toLowerCase();
    if (!normalized) return stations.slice(0, 40);
    return stations
      .filter((station) => {
        return (
          station.name.toLowerCase().includes(normalized) ||
          station.operator.toLowerCase().includes(normalized) ||
          station.connectorType.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 40);
  }, [stations, stationSearchQuery]);

  const focusLocation = selectedStation
    ? { latitude: selectedStation.latitude, longitude: selectedStation.longitude }
    : destinationPlace
      ? { latitude: destinationPlace.latitude, longitude: destinationPlace.longitude }
      : startPlace
        ? { latitude: startPlace.latitude, longitude: startPlace.longitude }
        : null;

  const openPlaceSearch = (target: SearchTarget) => {
    setSearchTarget(target);
    setStep("placeSearch");
    setPlaceQuery("");
    setSelectedStation(null);
  };

  const selectPlace = (place: PlaceOption) => {
    if (searchTarget === "start") {
      setStartPlace(place);
    } else {
      setDestinationPlace(place);
    }
    setRoutePoints([]);
    setCorridorStations([]);
    setRouteError(null);
    setRouteInfo(null);
    setStep("destinations");
    addToHistory(place);
  };

  const canPlan = Boolean(startPlace && destinationPlace);
  const startPlaceId = startPlace?.id ?? "";
  const destinationPlaceId = destinationPlace?.id ?? "";

  const setStartPlaceFromDropdown = (id: string) => {
    const match = moroccoPlaces.find((place) => place.id === id);
    if (match) {
      setStartPlace(match);
      setRoutePoints([]);
      setCorridorStations([]);
      setRouteError(null);
    }
  };

  const setDestinationPlaceFromDropdown = (id: string) => {
    const match = moroccoPlaces.find((place) => place.id === id);
    if (match) {
      setDestinationPlace(match);
      setRoutePoints([]);
      setCorridorStations([]);
      setRouteError(null);
    }
  };

  const corridorCount = corridorStationIds.size;

  const computeCorridor = async () => {
    if (!startPlace || !destinationPlace) {
      return;
    }

    try {
      setRouteLoading(true);
      setRouteError(null);
      const url = `https://router.project-osrm.org/route/v1/driving/${startPlace.longitude},${startPlace.latitude};${destinationPlace.longitude},${destinationPlace.latitude}?overview=full&geometries=polyline`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Routing service unavailable");
      }

      const data = (await response.json()) as {
        routes?: Array<{ geometry: string }>;
      };
      const encodedPolyline = data.routes?.[0]?.geometry;
      const duration = (data.routes?.[0] as any)?.duration || 0;
      const distance = (data.routes?.[0] as any)?.distance || 0;

      if (!encodedPolyline) {
        throw new Error("No route found");
      }

      setRouteInfo({ duration, distance });

      const decodedPoints = decodePolyline(encodedPolyline);
      setRoutePoints(decodedPoints);

      // Pre-calculate cumulative distances along the polyline
      const cumulativeDistances: number[] = [0];
      let totalDist = 0;
      for (let i = 0; i < decodedPoints.length - 1; i++) {
        totalDist += haversineKm(
          decodedPoints[i][0],
          decodedPoints[i][1],
          decodedPoints[i + 1][0],
          decodedPoints[i + 1][1],
        );
        cumulativeDistances.push(totalDist);
      }

      const corridor: CorridorStation[] = [];
      for (const station of stations) {
        let minDistanceToRoute = Number.POSITIVE_INFINITY;
        let bestDistanceAlongRoute = 0;

        for (let i = 0; i < decodedPoints.length - 1; i++) {
          const [segStartLat, segStartLon] = decodedPoints[i];
          const [segEndLat, segEndLon] = decodedPoints[i + 1];

          // Use Euclidean projection as approximation for short segments
          const p = { lat: station.latitude, lon: station.longitude };
          const a = { lat: segStartLat, lon: segStartLon };
          const b = { lat: segEndLat, lon: segEndLon };

          const l2 = (a.lat - b.lat) ** 2 + (a.lon - b.lon) ** 2;
          let t = 0;
          if (l2 !== 0) {
            t = ((p.lat - a.lat) * (b.lat - a.lat) + (p.lon - a.lon) * (b.lon - a.lon)) / l2;
            t = Math.max(0, Math.min(1, t));
          }
          const projection = {
            lat: a.lat + t * (b.lat - a.lat),
            lon: a.lon + t * (b.lon - a.lon),
          };

          const distToSegment = haversineKm(p.lat, p.lon, projection.lat, projection.lon);

          if (distToSegment < minDistanceToRoute) {
            minDistanceToRoute = distToSegment;
            const distInSegment = haversineKm(a.lat, a.lon, projection.lat, projection.lon);
            bestDistanceAlongRoute = cumulativeDistances[i] + distInSegment;
          }
        }

        if (minDistanceToRoute <= CORRIDOR_KM) {
          const durationRatio = bestDistanceAlongRoute / totalDist;
          corridor.push({
            id: station.id,
            distanceAlongRouteKm: bestDistanceAlongRoute,
            durationToStationMin: (duration / 60) * durationRatio,
          });
        }
      }

      // Sort by distance along route
      corridor.sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm);

      setCorridorStations(corridor);
      setStep("routePlan");
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : "Routing failed");
    } finally {
      setRouteLoading(false);
    }
  };

  const handleMapClick = async (lat: number, lon: number) => {
    if (!isPickingFromMap) return;

    const target = isPickingFromMap;
    setIsPickingFromMap(null);

    try {
      setPlaceLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      );
      if (!response.ok) throw new Error("Failed to reverse geocode");
      const data = await response.json();

      const [label, ...rest] = data.display_name.split(",");
      const place: PlaceOption = {
        id: `map-${Date.now()}`,
        label: label.trim(),
        subLabel: rest.join(",").trim(),
        latitude: lat,
        longitude: lon,
      };

      if (target === "start") {
        setStartPlace(place);
      } else {
        setDestinationPlace(place);
      }
      setRoutePoints([]);
      setCorridorStations([]);
      setRouteError(null);
      setRouteInfo(null);
      setStep("destinations");
      addToHistory(place);
    } catch (err) {
      console.error("Map click reverse geocode failed", err);
    } finally {
      setPlaceLoading(false);
    }
  };

  const handleMarkerDragEnd = async (
    target: "start" | "destination",
    lat: number,
    lon: number,
  ) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      );
      if (!response.ok) throw new Error("Failed to reverse geocode");
      const data = await response.json();

      const [label, ...rest] = data.display_name.split(",");
      const place: PlaceOption = {
        id: `drag-${Date.now()}`,
        label: label.trim(),
        subLabel: rest.join(",").trim(),
        latitude: lat,
        longitude: lon,
      };

      if (target === "start") {
        setStartPlace(place);
      } else {
        setDestinationPlace(place);
      }
      setRoutePoints([]);
      setCorridorStations([]);
      setRouteError(null);
      setRouteInfo(null);
    } catch (err) {
      console.error("Marker drag reverse geocode failed", err);
      // fallback to just updating coordinates if geocode fails
      const fallbackPlace = {
        id: `drag-${Date.now()}`,
        label: "Pinned Location",
        subLabel: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        latitude: lat,
        longitude: lon,
      };
      if (target === "start") setStartPlace(fallbackPlace);
      else setDestinationPlace(fallbackPlace);
    }
  };

  const swapPlaces = () => {
    const temp = startPlace;
    setStartPlace(destinationPlace);
    setDestinationPlace(temp);
    setRoutePoints([]);
    setCorridorStations([]);
    setRouteInfo(null);
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <div className="absolute inset-0">
        {loading ? (
          <div className="flex h-full items-center justify-center bg-[#07111f]">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-500" />
              <p className="text-slate-300">Loading stations...</p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div className="max-w-md rounded-3xl border border-rose-400/30 bg-rose-950/30 p-6">
              <p className="text-rose-200">Error: {error}</p>
            </div>
          </div>
        ) : null}

        {!loading && !error ? (
          <MapCanvas
            stations={stations}
            focusedLocation={focusLocation}
            selectedStationId={selectedStation?.id ?? null}
            corridorStationIds={corridorStationIds}
            routePoints={routePoints}
            startPlace={startPlace}
            destinationPlace={destinationPlace}
            onMapClick={handleMapClick}
            onMarkerDragEnd={handleMarkerDragEnd}
            isPickingFromMap={!!isPickingFromMap}
            step={step}
            reports={reports}
            onStationClick={(station) => {
              setSelectedStation(station);
              setMenuOpen(false);
              setStationSearchOpen(false);
            }}
          />
        ) : null}
      </div>

      <div className="absolute right-4 top-4 z-[1200] flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setStationSearchOpen((v) => !v);
            setMenuOpen(false);
          }}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-white/90 text-slate-700 shadow-lg shadow-black/15 backdrop-blur-xl transition hover:bg-white"
          aria-label="Search stations"
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setStationSearchOpen(false);
          }}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-white/90 text-slate-700 shadow-lg shadow-black/15 backdrop-blur-xl transition hover:bg-white"
          aria-label="Menu"
        >
          <TuneIcon />
        </button>
      </div>

      {stationSearchOpen ? (
        <div className="absolute right-4 top-[4.7rem] z-[1200] w-[360px] max-w-[calc(100vw-2rem)] rounded-[24px] border border-black/10 bg-white/95 p-4 text-slate-800 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Search stations
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2">
            <SearchIcon />
            <input
              value={stationSearchQuery}
              onChange={(e) => setStationSearchQuery(e.target.value)}
              placeholder="Station or operator"
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-500 outline-none"
            />
          </div>
          <div className="mt-3 max-h-[52vh] space-y-2 overflow-auto">
            {stationSearchResults.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => {
                  setSelectedStation(station);
                  setStationSearchOpen(false);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{station.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {station.operator} · {station.power} kW
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="absolute right-4 top-[4.7rem] z-[1200] w-[360px] max-w-[calc(100vw-2rem)] rounded-[24px] border border-black/10 bg-white/95 p-4 text-slate-800 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Station Overview
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCard label="Total" value={stations.length} />
            <StatCard
              label="Available"
              value={stations.filter((s) => s.status === "available").length}
            />
            <StatCard
              label="Occupied"
              value={stations.filter((s) => s.status === "occupied").length}
            />
            <StatCard
              label="Broken"
              value={stations.filter((s) => s.status === "outOfOrder").length}
            />
          </div>
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-[1200] w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] flex flex-col rounded-[24px] border border-white/10 bg-[#090909f0] p-4 text-white shadow-2xl shadow-black/40 backdrop-blur-xl overflow-hidden">
        {selectedStation ? (
          <StationDetailCard
            station={selectedStation}
            reports={reports.filter((r) => r.stationId === selectedStation.id)}
            onReport={(type) => handleReport(selectedStation.id, type)}
            onBack={() => setSelectedStation(null)}
          />
        ) : step === "routePlan" ? (
          <RoutePlanStep
            startPlace={startPlace}
            destinationPlace={destinationPlace}
            onBack={() => setStep("destinations")}
            corridorStations={corridorStations}
            allStations={stations}
            routeError={routeError}
            routeInfo={routeInfo}
            onStationClick={(s) => setSelectedStation(s)}
          />
        ) : step === "home" ? (
          <HomeStep onOpenDestination={() => openPlaceSearch("destination")} />
        ) : step === "placeSearch" ? (
          <PlaceSearchStep
            target={searchTarget}
            query={placeQuery}
            loading={displayedPlaceLoading}
            error={displayedPlaceError}
            results={displayedPlaceResults}
            history={searchHistory}
            onChangeQuery={setPlaceQuery}
            onPick={selectPlace}
            onPickFromMap={() => setIsPickingFromMap(searchTarget)}
            onBack={() => {
              if (startPlace || destinationPlace) setStep("destinations");
              else setStep("home");
            }}
          />
        ) : step === "destinations" ? (
          <DestinationsStep
            startPlace={startPlace}
            destinationPlace={destinationPlace}
            onEditStart={() => openPlaceSearch("start")}
            onEditDestination={() => openPlaceSearch("destination")}
            onSwap={swapPlaces}
            onClear={() => {
              setStartPlace(null);
              setDestinationPlace(null);
              setRoutePoints([]);
              setCorridorStations([]);
              setRouteInfo(null);
              setStep("home");
            }}
            onBack={() => setStep("home")}
            onPlan={computeCorridor}
            canPlan={canPlan}
            routeLoading={routeLoading}
          />
        ) : null}
      </div>
    </main>
  );
}

function HomeStep({ onOpenDestination }: { onOpenDestination: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-[28px] leading-tight font-semibold">A Better Routeplanner</h1>
      <button
        type="button"
        onClick={onOpenDestination}
        className="flex w-full items-center justify-between rounded-2xl bg-[#2a2a2a] px-3 py-3 text-left text-slate-300"
      >
        <div className="flex items-center gap-3">
          <SearchIcon />
          <span className="text-[14px]">Where do you want to go?</span>
        </div>
        <BoltBadge />
      </button>
      <CarCard />
      <div className="grid grid-cols-2 gap-3">
        <button className="rounded-2xl bg-[#515151] px-4 py-3 text-base">Options</button>
        <button className="rounded-2xl bg-[#e8e8e8] px-4 py-3 text-base text-black">Saved Plans</button>
      </div>
    </div>
  );
}

function PlaceSearchStep({
  target,
  query,
  loading,
  error,
  results,
  history,
  onChangeQuery,
  onPick,
  onPickFromMap,
  onBack,
}: {
  target: SearchTarget;
  query: string;
  loading: boolean;
  error: string | null;
  results: PlaceOption[];
  history: PlaceOption[];
  onChangeQuery: (value: string) => void;
  onPick: (place: PlaceOption) => void;
  onPickFromMap: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5">
          <BackIcon />
        </button>
        <h2 className="text-[22px] font-semibold">
          {target === "start" ? "Start Point" : "Destinations"}
        </h2>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-[#2a2a2a] px-4 py-3">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder={
            target === "start"
              ? "Search start city or place"
              : "Search destination city or place"
          }
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
        />
      </div>

      <div className="max-h-[48vh] space-y-2 overflow-auto">
        <button
          type="button"
          onClick={onPickFromMap}
          className="flex w-full items-center gap-3 rounded-2xl bg-[#2a2a2a] px-3 py-3 text-left transition hover:bg-[#3a3a3a]"
        >
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <TuneIcon />
          </div>
          <div className="text-base font-medium">Pick on map</div>
        </button>

        {loading ? <ListMessage text="Searching..." /> : null}
        {error ? <ListMessage text={error} danger /> : null}

        {results.length > 0 && query.trim() ? (
          <div className="pt-2">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Search Results
            </div>
            {results.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => onPick(place)}
                className="mb-2 w-full rounded-2xl bg-[#1f1f1f] px-3 py-3 text-left transition hover:bg-[#2a2a2a]"
              >
                <div className="text-base">{place.label}</div>
                <div className="text-sm text-slate-400">{place.subLabel}</div>
              </button>
            ))}
          </div>
        ) : null}

        {!query.trim() && history.length > 0 ? (
          <div className="pt-2">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Recent Searches
            </div>
            {history.map((place) => (
              <button
                key={`history-${place.id}`}
                type="button"
                onClick={() => onPick(place)}
                className="mb-2 w-full rounded-2xl bg-[#1f1f1f] px-3 py-3 text-left transition hover:bg-[#2a2a2a]"
              >
                <div className="text-base">{place.label}</div>
                <div className="text-sm text-slate-400">{place.subLabel}</div>
              </button>
            ))}
          </div>
        ) : null}

        {!query.trim() && history.length === 0 ? (
          <div className="pt-2">
            <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Popular Places
            </div>
            {moroccoPlaces.map((place) => (
              <button
                key={`popular-${place.id}`}
                type="button"
                onClick={() => onPick(place)}
                className="mb-2 w-full rounded-2xl bg-[#1f1f1f] px-3 py-3 text-left transition hover:bg-[#2a2a2a]"
              >
                <div className="text-base">{place.label}</div>
                <div className="text-sm text-slate-400">{place.subLabel}</div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DestinationsStep({
  startPlace,
  destinationPlace,
  onEditStart,
  onEditDestination,
  onSwap,
  onClear,
  onBack,
  onPlan,
  canPlan,
  routeLoading,
}: {
  startPlace: PlaceOption | null;
  destinationPlace: PlaceOption | null;
  onEditStart: () => void;
  onEditDestination: () => void;
  onSwap: () => void;
  onClear: () => void;
  onBack: () => void;
  onPlan: () => void;
  canPlan: boolean;
  routeLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/8"
          >
            <BackIcon />
          </button>
          <h2 className="text-[32px] leading-none font-semibold">Destinations</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-sm font-medium text-rose-400 hover:text-rose-300"
        >
          Clear
        </button>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <button
            type="button"
            onClick={onEditStart}
            className="flex w-full items-center gap-3 rounded-2xl bg-[#2a2a2a] px-4 py-4 text-left transition hover:bg-[#333]"
          >
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm text-slate-400">From</div>
              <div className="truncate text-base font-medium">
                {startPlace?.label || "Select start point"}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onSwap}
            className="absolute -bottom-3 right-8 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[#1a1a1a] text-slate-300 shadow-lg transition hover:bg-[#2a2a2a] active:scale-90"
          >
            <SwapIcon />
          </button>
        </div>

        <button
          type="button"
          onClick={onEditDestination}
          className="flex w-full items-center gap-3 rounded-2xl bg-[#2a2a2a] px-4 py-4 text-left transition hover:bg-[#333]"
        >
          <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          <div className="flex-1 overflow-hidden">
            <div className="truncate text-sm text-slate-400">To</div>
            <div className="truncate text-base font-medium">
              {destinationPlace?.label || "Select destination"}
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-sm text-slate-400">
        <button type="button" className="hover:text-white">+ Add Stop</button>
        <button type="button" className="hover:text-white">Options</button>
      </div>

      <CarCard small />

      <button
        type="button"
        onClick={onPlan}
        disabled={!canPlan || routeLoading}
        className="mt-2 w-full rounded-2xl bg-[#e8e8e8] py-4 text-[19px] font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
      >
        {routeLoading ? "Planning..." : "Calculate Route"}
      </button>
    </div>
  );
}

function SwapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4M7 4L3 8M7 4L11 8" />
      <path d="M17 8V20M17 20L21 16M17 20L13 16" />
    </svg>
  );
}

function formatETA(durationMin: number) {
  const now = new Date();
  const eta = new Date(now.getTime() + durationMin * 60 * 1000);
  return eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function RoutePlanStep({
  startPlace,
  destinationPlace,
  onBack,
  corridorStations,
  allStations,
  routeError,
  routeInfo,
  onStationClick,
}: {
  startPlace: PlaceOption | null;
  destinationPlace: PlaceOption | null;
  onBack: () => void;
  corridorStations: CorridorStation[];
  allStations: Station[];
  routeError: string | null;
  routeInfo: { duration: number; distance: number } | null;
  onStationClick: (s: Station) => void;
}) {
  const handleStartDrive = () => {
    if (!startPlace || !destinationPlace) return;

    const origin = `${startPlace.latitude},${startPlace.longitude}`;
    const destination = `${destinationPlace.latitude},${destinationPlace.longitude}`;

    // Add corridor stations as waypoints (limit to 8 for Google Maps API compatibility)
    const waypoints = corridorStations
      .slice(0, 8)
      .map((cs) => {
        const s = allStations.find((st) => st.id === cs.id);
        return s ? `${s.latitude},${s.longitude}` : "";
      })
      .filter(Boolean)
      .join("|");

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
    window.open(url, "_blank");
  };
  const durationText = routeInfo
    ? `${Math.round(routeInfo.duration / 60)} min`
    : "19 min";
  const distanceText = routeInfo
    ? `${(routeInfo.distance / 1000).toFixed(1)} km · ${Math.round((routeInfo.distance / 1000) * 0.2)} kWh`
    : "18 km · 2 kWh";

  return (
    <div className="flex flex-1 flex-col min-h-0 space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"
        >
          <BackIcon />
        </button>
        <div className="flex-1 overflow-hidden">
          <h2 className="truncate text-[24px] font-bold leading-tight">
            {destinationPlace?.label ?? "Route"}
          </h2>
          <div className="text-sm font-medium text-slate-400">
            {durationText} · {distanceText.split("·")[0]}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div className="mb-4 space-y-2">
          <h3 className="text-[17px] font-bold uppercase tracking-wider text-slate-500">
            Upcoming Chargers
          </h3>
          {corridorStations.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-4 text-center text-slate-400">
              No stations found along this route within {CORRIDOR_KM}km.
            </div>
          ) : (
            <div className="space-y-3">
              {corridorStations.map((cs) => {
                const station = allStations.find((s) => s.id === cs.id);
                if (!station) return null;

                return (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => onStationClick(station)}
                    className="flex w-full items-center gap-4 rounded-[24px] bg-[#222] p-4 text-left transition hover:bg-[#2a2a2a] active:scale-[0.98]"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black">
                      <BoltDarkIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="truncate text-[20px] font-bold">
                          {station.name}
                        </div>
                        <div className="text-[20px] font-bold text-emerald-400">
                          {Math.round(cs.distanceAlongRouteKm)} km
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium text-slate-400 mt-1">
                        <div>{station.power} kW · {station.connectorType}</div>
                        <div>ETA {formatETA(cs.durationToStationMin)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {routeError && (
          <div className="rounded-2xl bg-rose-500/20 p-4 text-[16px] font-medium text-rose-300">
            {routeError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button className="rounded-[22px] bg-[#333] py-4 text-[18px] font-bold transition hover:bg-[#444]">
          Options
        </button>
        <button
          type="button"
          onClick={handleStartDrive}
          className="rounded-[22px] bg-[#38bdf8] py-4 text-[18px] font-bold text-[#000] transition hover:bg-[#7dd3fc]"
        >
          Start Drive
        </button>
      </div>
    </div>
  );
}

function StationDetailCard({
  station,
  reports,
  onReport,
  onBack,
}: {
  station: Station;
  reports: Report[];
  onReport: (type: "broken" | "works") => void;
  onBack: () => void;
}) {
  const brokenCount = reports.filter((r) => r.type === "broken").length;
  const worksCount = reports.filter((r) => r.type === "works").length;
  const userDecision = reports.length > 0 ? reports[reports.length - 1].type : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"
          aria-label="Back"
        >
          <BackIcon />
        </button>
        <h2 className="text-lg font-semibold">Charger details</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"
            aria-label="Share"
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"
            aria-label="Favorite"
          >
            <HeartIcon />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-[#1f1f1f] p-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 grid h-10 w-10 place-items-center rounded-full bg-white text-black">
            <BoltDarkIcon />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold text-slate-100">
              {station.name}
            </div>
            <div className="truncate text-sm text-slate-400">{station.operator}</div>
            <div className="mt-2 inline-flex rounded-lg bg-white/15 px-2 py-1 text-xs font-medium text-slate-100">
              {statusLabel(station.status)}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold">User Reports</h3>
        <div className="rounded-2xl border border-white/20 bg-[#111111] p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-300">
              {brokenCount > 0 || worksCount > 0
                ? `${brokenCount} Broken, ${worksCount} Works`
                : "No reports yet"}
            </div>
            {reports.length > 0 && (
              <div className="text-xs text-slate-500">
                Last: {new Date(reports[reports.length - 1].timestamp).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onReport("broken")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                userDecision === "broken"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                  : "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
              }`}
            >
              Report Broken
            </button>
            <button
              type="button"
              onClick={() => onReport("works")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${
                userDecision === "works"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              }`}
            >
              Works
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold">Available plugs</h3>
        <div className="rounded-2xl border border-white/20 bg-[#111111] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-2xl font-semibold leading-none">{station.power} kW</div>
              <div className="mt-1 text-sm text-slate-300">{station.connectorType}</div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div className="text-lg leading-none text-slate-200">1</div>
              <div>stall</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold">Charger characteristics</h3>
        <div className="rounded-2xl bg-[#1f1f1f] p-3 text-sm text-slate-300">
          <InfoRow label="Status" value={statusLabel(station.status)} />
          <InfoRow label="Power" value={`${station.power} kW`} />
          <InfoRow label="Connector" value={station.connectorType} />
        </div>
      </div>
    </div>
  );
}

function CarCard({ small = false }: { small?: boolean }) {
  return (
    <div className={`rounded-[28px] bg-[#2a2a2a] p-4 ${small ? "pb-4" : "pb-6"}`}>
      <div className="flex items-start justify-between gap-2">
        <div
          className={`${small ? "max-w-[235px] text-[24px]" : "text-[24px]"} leading-tight font-semibold`}
        >
          Jeep Avenger Summit FWD 18&quot;
        </div>
        <TuneIcon />
      </div>
      <div className="mt-3 flex justify-end">
        <div
          className={`${small ? "h-[102px] w-[196px]" : "h-[110px] w-[220px]"} rounded-xl bg-[linear-gradient(135deg,#3a3a3a,#232323)]`}
        />
      </div>
      <div className={`${small ? "text-[56px]" : "text-[44px]"} font-semibold leading-none`}>
        93%
      </div>
      <div className="mt-3 h-3 rounded-full bg-[#505050]">
        <div className={`${small ? "w-[91%]" : "w-[92%]"} h-3 rounded-full bg-[#1cce18]`} />
      </div>
      {!small ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="rounded-2xl border border-white bg-black px-4 py-2 text-[18px]">Replace</button>
          <button className="rounded-2xl bg-[#e8e8e8] px-4 py-2 text-[18px] text-black">Save</button>
        </div>
      ) : null}
    </div>
  );
}

function ListMessage({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3 text-sm ${
        danger ? "bg-rose-500/20 text-rose-200" : "bg-[#1f1f1f] text-slate-400"
      }`}
    >
      {text}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-slate-400">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function statusLabel(status: Station["status"]) {
  if (status === "outOfOrder") return "Out of order";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="2" y1="14" x2="6" y2="14" />
      <line x1="10" y1="8" x2="14" y2="8" />
      <line x1="18" y1="16" x2="22" y2="16" />
    </svg>
  );
}

function BoltBadge() {
  return (
    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#cf1f1f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M13 2L6 13h5l-1 9 8-12h-5l0-8z" />
      </svg>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 16V3" />
      <path d="m7 8 5-5 5 5" />
      <rect x="4" y="14" width="16" height="7" rx="2" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1Z" />
    </svg>
  );
}

function BoltDarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L6 13h5l-1 9 8-12h-5l0-8z" />
    </svg>
  );
}
