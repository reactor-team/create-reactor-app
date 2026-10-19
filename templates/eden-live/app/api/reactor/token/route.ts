import { NextResponse } from "next/server";
import { REACTOR_API_URL } from "@/app/lib/config";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: "Same-origin requests only" },
      { status: 403, headers }
    );
  }
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "REACTOR_API_KEY is not set" },
      { status: 503, headers }
    );
  try {
    const response = await fetch(`${REACTOR_API_URL}/tokens`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Reactor-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: 3600,
        authorization_details: [
          {
            type: "session",
            resources: { models: { match: ["reactor/eden-live"] } },
            constraints: { max_sessions: 10 },
          },
        ],
      }),
    });
    if (!response.ok)
      return NextResponse.json(
        { error: `Reactor token request failed (${response.status})` },
        { status: 502, headers }
      );
    const { jwt, expires_at } = await response.json();
    if (
      typeof jwt !== "string" ||
      !jwt ||
      !Number.isFinite(expires_at) ||
      expires_at * 1000 <= Date.now()
    ) {
      return NextResponse.json(
        { error: "Invalid token response" },
        { status: 502, headers }
      );
    }
    return NextResponse.json({ jwt, expires_at }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach Reactor token service" },
      { status: 502, headers }
    );
  }
}
