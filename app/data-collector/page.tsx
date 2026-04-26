"use client";

import { useMemo, useState } from "react";

type FetchStatus = "idle" | "loading" | "success" | "error";

type RequestFormState = {
  apiKey: string;
  client: string;
  countryCode: string;
  maxResults: string;
  distanceKm: string;
  latitude: string;
  longitude: string;
  output: string;
  opendata: boolean;
  verbose: boolean;
};

type SlimStation = {
  id: string;
  name: string;
  operator: string;
  latitude: number;
  longitude: number;
  power: number;
  connectorType: string;
  status: "available" | "occupied" | "outOfOrder";
};

const defaultFormState: RequestFormState = {
  apiKey: "",
  client: "charge.ma phase 1 tester",
  countryCode: "MA",
  maxResults: "10000",
  distanceKm: "",
  latitude: "",
  longitude: "",
  output: "json",
  opendata: true,
  verbose: false,
};

function buildRequestUrl(formState: RequestFormState) {
  const url = new URL("https://api.openchargemap.io/v3/poi");

  if (formState.apiKey.trim()) {
    url.searchParams.set("key", formState.apiKey.trim());
  }

  if (formState.client.trim()) {
    url.searchParams.set("client", formState.client.trim());
  }

  url.searchParams.set(
    "countrycode",
    formState.countryCode.trim().toUpperCase(),
  );
  url.searchParams.set("maxresults", formState.maxResults.trim());
  url.searchParams.set("output", formState.output.trim().toLowerCase());
  url.searchParams.set("opendata", String(formState.opendata));
  url.searchParams.set("verbose", String(formState.verbose));

  if (formState.latitude.trim() && formState.longitude.trim()) {
    url.searchParams.set("latitude", formState.latitude.trim());
    url.searchParams.set("longitude", formState.longitude.trim());
  }

  if (formState.distanceKm.trim()) {
    url.searchParams.set("distance", formState.distanceKm.trim());
    url.searchParams.set("distanceunit", "KM");
  }

  return url;
}

function convertToSlimFormat(rawData: unknown): SlimStation[] {
  if (!Array.isArray(rawData)) {
    return [];
  }

  return rawData
    .map((item: any) => {
      // Skip items without required location data
      if (
        !item.AddressInfo ||
        typeof item.AddressInfo.Latitude !== "number" ||
        typeof item.AddressInfo.Longitude !== "number"
      ) {
        return null;
      }

      // Extract power (max from connections)
      let power = 0;
      if (Array.isArray(item.Connections)) {
        power = Math.max(
          ...item.Connections.filter(
            (c: any) => typeof c.PowerKW === "number",
          ).map((c: any) => c.PowerKW),
          0,
        );
      }

      // Extract connector types
      let connectorType = "Unknown";
      if (Array.isArray(item.Connections) && item.Connections.length > 0) {
        const types = Array.from(
          new Set(
            item.Connections.filter((c: any) => c.ConnectionType?.Title).map(
              (c: any) => c.ConnectionType.Title,
            ),
          ),
        );
        if (types.length > 0) {
          connectorType = types.join(", ");
        }
      }

      // Map status
      let status: "available" | "occupied" | "outOfOrder" = "available";
      const statusTitle = item.StatusType?.Title || "";
      const connectionStatus = item.Connections?.[0]?.StatusType?.Title || "";
      const combinedStatus = (
        statusTitle +
        " " +
        connectionStatus
      ).toLowerCase();

      if (
        combinedStatus.includes("occupied") ||
        combinedStatus.includes("in use") ||
        combinedStatus.includes("busy")
      ) {
        status = "occupied";
      } else if (
        combinedStatus.includes("not operational") ||
        combinedStatus.includes("out of order") ||
        combinedStatus.includes("unavailable") ||
        combinedStatus.includes("decommissioned") ||
        combinedStatus.includes("fault") ||
        combinedStatus.includes("removed")
      ) {
        status = "outOfOrder";
      }

      return {
        id: item.UUID || String(item.ID),
        name: item.AddressInfo?.Title || `Station ${item.ID}`,
        operator: item.OperatorInfo?.Title || "(Unknown Operator)",
        latitude: item.AddressInfo.Latitude,
        longitude: item.AddressInfo.Longitude,
        power,
        connectorType,
        status,
      };
    })
    .filter((item): item is SlimStation => item !== null);
}

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export default function DataCollector() {
  const [formState, setFormState] = useState(defaultFormState);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requestUrl, setRequestUrl] = useState("");
  const [rawPayload, setRawPayload] = useState<unknown>(null);
  const [slimPayload, setSlimPayload] = useState<SlimStation[]>([]);
  const [showConversion, setShowConversion] = useState(false);

  const stationCount = useMemo(() => {
    if (Array.isArray(rawPayload)) {
      return rawPayload.length;
    }
    return 0;
  }, [rawPayload]);

  const slimStationCount = useMemo(() => {
    return slimPayload.length;
  }, [slimPayload]);

  async function handleFetchStations() {
    setStatus("loading");
    setErrorMessage(null);
    setRawPayload(null);
    setSlimPayload([]);
    setShowConversion(false);

    try {
      const url = buildRequestUrl(formState);
      setRequestUrl(url.toString());

      const params = new URLSearchParams();
      params.set("client", formState.client.trim());
      params.set("countrycode", formState.countryCode.trim().toUpperCase());
      params.set("maxresults", formState.maxResults.trim());
      params.set("output", formState.output.trim().toLowerCase());
      params.set("opendata", String(formState.opendata));
      params.set("verbose", String(formState.verbose));
      if (formState.latitude.trim() && formState.longitude.trim()) {
        params.set("latitude", formState.latitude.trim());
        params.set("longitude", formState.longitude.trim());
      }
      if (formState.distanceKm.trim()) {
        params.set("distance", formState.distanceKm.trim());
        params.set("distanceunit", "KM");
      }
      if (formState.apiKey.trim()) {
        params.set("key", formState.apiKey.trim());
      }

      const response = await fetch(`/api/stations?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setRawPayload(data);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
    }
  }

  function handleConvert() {
    if (Array.isArray(rawPayload)) {
      const converted = convertToSlimFormat(rawPayload);
      setSlimPayload(converted);
      setShowConversion(true);
    }
  }

  function handleUseMoroccoPreset() {
    setFormState((current) => ({
      ...current,
      countryCode: "MA",
      latitude: "",
      longitude: "",
      maxResults: "10000",
      distanceKm: "",
      output: "json",
      opendata: true,
      verbose: false,
    }));
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(135deg,rgba(4,14,27,0.96),rgba(15,23,42,0.92))] shadow-2xl shadow-cyan-950/30">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Phase 1 data collector
              </div>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  OpenChargeMap data collection
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Fetch real OpenChargeMap data for Morocco, inspect the raw
                  response, convert it to a slim format for efficient storage,
                  and export as JSON.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Endpoint
                  </div>
                  <div className="mt-2 break-all text-sm text-white">
                    https://api.openchargemap.io/v3/poi
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Auth
                  </div>
                  <div className="mt-2 text-sm text-white">API Key</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Transform
                  </div>
                  <div className="mt-2 text-sm text-white">
                    Raw → Slim (optimized)
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-cyan-300/10 bg-slate-950/70 p-5 backdrop-blur">
              <div className="text-sm font-medium text-cyan-200">Workflow</div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <li>
                  1. Set parameters and fetch data from OpenChargeMap API.
                </li>
                <li>2. Inspect the raw response with full details.</li>
                <li>3. Convert to slim format with only essential fields.</li>
                <li>4. Download either format as JSON.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Request builder
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Tune the parameters before you fetch the data.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUseMoroccoPreset}
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20"
              >
                Morocco preset
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="API key"
                value={formState.apiKey}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, apiKey: value }))
                }
                placeholder="Optional, if you have one"
              />
              <Field
                label="Client name"
                value={formState.client}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, client: value }))
                }
              />
              <Field
                label="Country code"
                value={formState.countryCode}
                onChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    countryCode: value,
                  }))
                }
              />
              <Field
                label="Max results"
                value={formState.maxResults}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, maxResults: value }))
                }
                inputMode="numeric"
              />
              <Field
                label="Latitude"
                value={formState.latitude}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, latitude: value }))
                }
              />
              <Field
                label="Longitude"
                value={formState.longitude}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, longitude: value }))
                }
              />
              <Field
                label="Distance km"
                value={formState.distanceKm}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, distanceKm: value }))
                }
                placeholder="Optional search radius"
              />
              <Field
                label="Output"
                value={formState.output}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, output: value }))
                }
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ToggleField
                label="Open data only"
                checked={formState.opendata}
                onChange={(checked) =>
                  setFormState((current) => ({ ...current, opendata: checked }))
                }
              />
              <ToggleField
                label="Verbose response"
                checked={formState.verbose}
                onChange={(checked) =>
                  setFormState((current) => ({ ...current, verbose: checked }))
                }
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleFetchStations}
                disabled={status === "loading"}
                className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "loading" ? "Fetching..." : "Fetch stations"}
              </button>
              <button
                type="button"
                onClick={() =>
                  rawPayload &&
                  downloadJsonFile(
                    rawPayload,
                    `opencharge-map-morocco-raw-${new Date().toISOString().slice(0, 10)}.json`,
                  )
                }
                disabled={!rawPayload}
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Download Raw
              </button>
              <button
                type="button"
                onClick={handleConvert}
                disabled={!rawPayload || showConversion}
                className="rounded-full border border-purple-400/30 bg-purple-400/10 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Convert to Slim
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">
              <div className="font-medium text-white">Generated request</div>
              <div className="mt-2 break-all font-mono text-xs leading-6 text-cyan-200">
                {requestUrl || "Press fetch to generate the request URL."}
              </div>
            </div>

            {status === "error" ? (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}

            {status === "success" ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                Request completed successfully. You can now convert to slim
                format or download the raw response.
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Raw response
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Full OpenChargeMap API response.
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {stationCount ? `${stationCount} records` : "No data"}
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
                <pre className="max-h-96 overflow-auto p-4 text-xs leading-6 text-slate-200">
                  {rawPayload
                    ? JSON.stringify(rawPayload, null, 2).slice(0, 2000) +
                      (JSON.stringify(rawPayload, null, 2).length > 2000
                        ? "\n...(truncated for display)"
                        : "")
                    : "Fetch a response to see the raw JSON here."}
                </pre>
              </div>
            </div>

            {showConversion && slimPayload.length > 0 ? (
              <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Slim conversion
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Optimized format with essential fields only.
                    </p>
                  </div>
                  <div className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-purple-300">
                    {slimStationCount} records
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
                    <span className="font-medium text-white">Format:</span>
                    <pre className="mt-2 overflow-auto font-mono text-xs leading-5 text-purple-300">
                      {JSON.stringify(
                        {
                          id: "string (UUID)",
                          name: "string",
                          operator: "string",
                          latitude: "number",
                          longitude: "number",
                          power: "number (kW)",
                          connectorType: "string",
                          status: "available|occupied|outOfOrder",
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/50">
                    <pre className="max-h-96 overflow-auto p-4 text-xs leading-6 text-slate-200">
                      {JSON.stringify(slimPayload.slice(0, 3), null, 2)}
                      {slimPayload.length > 3
                        ? `\n...(${slimPayload.length - 3} more records)`
                        : ""}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      downloadJsonFile(
                        slimPayload,
                        `morocco-stations-slim-${new Date().toISOString().slice(0, 10)}.json`,
                      )
                    }
                    className="rounded-full border border-purple-400/30 bg-purple-400/10 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-purple-400/20"
                  >
                    Download Slim
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode = "text",
}: FieldProps) {
  return (
    <label className="space-y-2 text-sm text-slate-300">
      <span className="block font-medium text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:bg-white/7"
      />
    </label>
  );
}

type ToggleFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function ToggleField({ label, checked, onChange }: ToggleFieldProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-400"
      />
    </label>
  );
}
