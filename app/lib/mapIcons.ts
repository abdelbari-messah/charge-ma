import L from "leaflet";

function createPin(color: string, selected = false) {
  const stroke = selected ? "#2563EB" : "#FFFFFF";
  const ring = selected
    ? `<circle cx="19" cy="18" r="13.5" fill="none" stroke="#93C5FD" stroke-width="2.6" />`
    : "";

  return `<svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 2C10.16 2 3 9.16 3 18c0 11.75 13.17 24.94 15.27 27.02a1 1 0 0 0 1.46 0C21.83 42.94 35 29.75 35 18 35 9.16 27.84 2 19 2Z" fill="${color}" stroke="${stroke}" stroke-width="2.6"/>
  ${ring}
  <circle cx="19" cy="18" r="10.1" fill="#2C2C2C"/>
  <path d="M20.8 10.4L15.8 18h4.15L18.9 25.7l5.3-8.2h-4.1l0.7-7.1Z" fill="#FFFFFF"/>
  </svg>`;
}

function pinIcon(color: string, selected = false, className = "pin-icon") {
  return L.divIcon({
    html: createPin(color, selected),
    iconSize: [38, 50],
    iconAnchor: [19, 46],
    popupAnchor: [0, -40],
    className,
  });
}

export const availableIcon = pinIcon("#F5F5F5");
export const occupiedIcon = pinIcon("#FFE8B3");
export const outOfOrderIcon = pinIcon("#FFD4D4");
export const availableSelectedIcon = pinIcon(
  "#F5F5F5",
  true,
  "available-icon-selected",
);
export const occupiedSelectedIcon = pinIcon(
  "#FFE8B3",
  true,
  "occupied-icon-selected",
);
export const outOfOrderSelectedIcon = pinIcon(
  "#FFD4D4",
  true,
  "broken-icon-selected",
);

function createReportedPin(color: string, selected = false) {
  const stroke = selected ? "#2563EB" : "#EF4444";
  const ring = selected
    ? `<circle cx="19" cy="18" r="13.5" fill="none" stroke="#93C5FD" stroke-width="2.6" />`
    : `<circle cx="19" cy="18" r="13.5" fill="none" stroke="#EF4444" stroke-width="2.6" stroke-dasharray="4 4" />`;

  return `<svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 2C10.16 2 3 9.16 3 18c0 11.75 13.17 24.94 15.27 27.02a1 1 0 0 0 1.46 0C21.83 42.94 35 29.75 35 18 35 9.16 27.84 2 19 2Z" fill="${color}" stroke="${stroke}" stroke-width="2.6"/>
  ${ring}
  <circle cx="19" cy="18" r="10.1" fill="#2C2C2C"/>
  <path d="M20.8 10.4L15.8 18h4.15L18.9 25.7l5.3-8.2h-4.1l0.7-7.1Z" fill="#FFFFFF"/>
  </svg>`;
}

function reportedPinIcon(color: string, selected = false, className = "pin-icon") {
  return L.divIcon({
    html: createReportedPin(color, selected),
    iconSize: [38, 50],
    iconAnchor: [19, 46],
    popupAnchor: [0, -40],
    className,
  });
}

export const availableReportedIcon = reportedPinIcon("#F5F5F5");
export const occupiedReportedIcon = reportedPinIcon("#FFE8B3");
export const outOfOrderReportedIcon = reportedPinIcon("#FFD4D4");
export const availableSelectedReportedIcon = reportedPinIcon("#F5F5F5", true, "available-icon-selected");
export const occupiedSelectedReportedIcon = reportedPinIcon("#FFE8B3", true, "occupied-icon-selected");
export const outOfOrderSelectedReportedIcon = reportedPinIcon("#FFD4D4", true, "broken-icon-selected");

export function getIconForStatus(
  status: "available" | "occupied" | "outOfOrder",
  selected = false,
  hasReport = false,
) {
  if (hasReport) {
    if (selected) {
      switch (status) {
        case "available":
          return availableSelectedReportedIcon;
        case "occupied":
          return occupiedSelectedReportedIcon;
        case "outOfOrder":
          return outOfOrderSelectedReportedIcon;
        default:
          return availableSelectedReportedIcon;
      }
    }
    switch (status) {
      case "available":
        return availableReportedIcon;
      case "occupied":
        return occupiedReportedIcon;
      case "outOfOrder":
        return outOfOrderReportedIcon;
      default:
        return availableReportedIcon;
    }
  }

  if (selected) {
    switch (status) {
      case "available":
        return availableSelectedIcon;
      case "occupied":
        return occupiedSelectedIcon;
      case "outOfOrder":
        return outOfOrderSelectedIcon;
      default:
        return availableSelectedIcon;
    }
  }

  switch (status) {
    case "available":
      return availableIcon;
    case "occupied":
      return occupiedIcon;
    case "outOfOrder":
      return outOfOrderIcon;
    default:
      return availableIcon;
  }
}

export function getColorForStatus(
  status: "available" | "occupied" | "outOfOrder",
) {
  switch (status) {
    case "available":
      return "#10b981";
    case "occupied":
      return "#f59e0b";
    case "outOfOrder":
      return "#ef4444";
    default:
      return "#10b981";
  }
}

// Start and End point icons
function createLocationPin(color: string, label: string) {
  return `<svg width="38" height="50" viewBox="0 0 38 50" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 2C10.16 2 3 9.16 3 18c0 11.75 13.17 24.94 15.27 27.02a1 1 0 0 0 1.46 0C21.83 42.94 35 29.75 35 18 35 9.16 27.84 2 19 2Z" fill="${color}" stroke="#FFFFFF" stroke-width="2.6"/>
  <circle cx="19" cy="18" r="10.1" fill="#FFFFFF"/>
  <text x="19" y="22" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="${color}">${label}</text>
  </svg>`;
}

export const startIcon = L.divIcon({
  html: createLocationPin("#10b981", "A"),
  iconSize: [38, 50],
  iconAnchor: [19, 46],
  className: "start-pin-icon",
});

export const destinationIcon = L.divIcon({
  html: createLocationPin("#ef4444", "B"),
  iconSize: [38, 50],
  iconAnchor: [19, 46],
  className: "destination-pin-icon",
});
