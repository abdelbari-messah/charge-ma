"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="max-w-2xl text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Charge.ma
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              EV Charging Stations Navigator
            </h1>
            <p className="text-lg leading-8 text-slate-300">
              Discover and navigate electric vehicle charging stations across
              Morocco with ease. Find available chargers, check power levels,
              and plan your journey.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-2xl font-bold text-cyan-400">157+</div>
              <div className="mt-1 text-sm text-slate-400">
                Charging stations across Morocco
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-2xl font-bold text-cyan-400">Real-time</div>
              <div className="mt-1 text-sm text-slate-400">
                Status updates and availability
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 pt-8">
            <Link
              href="/map"
              className="rounded-full bg-cyan-400 px-8 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              View Map
            </Link>
            <Link
              href="/data-collector"
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-8 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Data Collection
            </Link>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-8 mt-16">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">
                Data Collection Workflow
              </h2>
              <ol className="space-y-3 text-left text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950 flex-shrink-0">
                    1
                  </span>
                  <span>
                    Visit the{" "}
                    <Link
                      href="/data-collector"
                      className="text-cyan-400 hover:text-cyan-300 underline"
                    >
                      data collector
                    </Link>{" "}
                    page to fetch live data from OpenChargeMap API
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950 flex-shrink-0">
                    2
                  </span>
                  <span>
                    Inspect the raw API response with complete details
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950 flex-shrink-0">
                    3
                  </span>
                  <span>
                    Convert to slim format with only essential fields (id, name,
                    location, power, status)
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950 flex-shrink-0">
                    4
                  </span>
                  <span>
                    Download the optimized dataset for use in the map interface
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
