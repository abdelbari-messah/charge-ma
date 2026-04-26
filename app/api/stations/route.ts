import { NextRequest, NextResponse } from "next/server";

const API_KEY = "57a1fbaa-5efa-4f35-a68d-6781e9528a14";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Build the OpenChargeMap API URL with all parameters
  const params = new URLSearchParams();

  // Copy all search params from the client request
  searchParams.forEach((value, key) => {
    params.set(key, value);
  });

  // Set defaults and API key
  if (!params.get("countrycode")) {
    params.set("countrycode", "MA");
  }
  if (!params.get("maxresults")) {
    params.set("maxresults", "10000"); // Increased to get all stations
  }
  if (!params.get("output")) {
    params.set("output", "json");
  }

  // For MA queries, OpenChargeMap may return empty results with opendata=false.
  // Force open-data records to ensure dataset retrieval works consistently.
  params.set("opendata", "true");

  // Add API key
  params.set("key", API_KEY);

  const apiUrl = `https://api.openchargemap.io/v3/poi?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenChargeMap API returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
