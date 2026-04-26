"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { getIconForStatus } from "@/app/lib/mapIcons";

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

type FocusLocation = {
  latitude: number;
  longitude: number;
};

const moroccoCenter: [number, number] = [31.7917, -7.0926];

function MapFocus({ location }: { location: FocusLocation | null }) {
  const map = useMap();

  useEffect(() => {
    if (!location) {
      return;
    }

    map.flyTo([location.latitude, location.longitude], 13, {
      animate: true,
      duration: 0.8,
    });
  }, [map, location]);

  return null;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  const map = useMap();
  const mapEvents = require("react-leaflet").useMapEvents({
    click(e: any) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapCanvas({
  stations,
  focusedLocation,
  selectedStationId,
  corridorStationIds,
  routePoints,
  onStationClick,
  startPlace,
  destinationPlace,
  onMapClick,
  onMarkerDragEnd,
  isPickingFromMap,
  step,
  reports,
}: {
  stations: Station[];
  focusedLocation: FocusLocation | null;
  selectedStationId: string | null;
  corridorStationIds: Set<string>;
  routePoints: [number, number][];
  onStationClick: (station: Station) => void;
  startPlace: { latitude: number; longitude: number } | null;
  destinationPlace: { latitude: number; longitude: number } | null;
  onMapClick: (lat: number, lon: number) => void;
  onMarkerDragEnd: (target: "start" | "destination", lat: number, lon: number) => void;
  isPickingFromMap: boolean;
  step: string;
  reports: { stationId: string; type: "broken" | "works"; timestamp: number }[];
}) {
  const hasCorridorFilter = corridorStationIds.size > 0;

  return (
    <div className={`h-full w-full ${isPickingFromMap ? "cursor-crosshair" : ""}`}>
      <MapContainer
        center={moroccoCenter}
        zoom={6}
        zoomControl={false}
        className="h-full w-full"
        style={{ background: "#07111f" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <MapFocus location={focusedLocation} />
        <MapEvents onMapClick={onMapClick} />

        {routePoints.length > 1 ? (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: "#38bdf8", weight: 4, opacity: 0.9 }}
          />
        ) : null}

        {startPlace && (
          <Marker
            draggable={step !== "routePlan"}
            position={[startPlace.latitude, startPlace.longitude]}
            icon={require("@/app/lib/mapIcons").startIcon}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onMarkerDragEnd("start", position.lat, position.lng);
              },
            }}
          />
        )}

        {destinationPlace && (
          <Marker
            draggable={step !== "routePlan"}
            position={[destinationPlace.latitude, destinationPlace.longitude]}
            icon={require("@/app/lib/mapIcons").destinationIcon}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onMarkerDragEnd("destination", position.lat, position.lng);
              },
            }}
          />
        )}

        {stations
          .filter(
            (station) => !hasCorridorFilter || corridorStationIds.has(station.id),
          )
          .map((station) => {
            const stationReports = reports.filter((r) => r.stationId === station.id);
            const hasActiveReport =
              stationReports.length > 0 &&
              stationReports[stationReports.length - 1].type === "broken";

            return (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={getIconForStatus(
                  station.status,
                  station.id === selectedStationId,
                  hasActiveReport,
                )}
                zIndexOffset={corridorStationIds.has(station.id) ? 600 : 0}
                eventHandlers={{
                  click: () => onStationClick(station),
                }}
              />
            );
          })}
      </MapContainer>
    </div>
  );
}
