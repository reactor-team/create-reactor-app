import { NextResponse } from "next/server";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "REACTOR_API_KEY not set" },
      { status: 503, headers }
    );
  try {
    const response = await fetch("https://api.reactor.inc/tokens", {
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
            resources: { models: { match: ["reactor/genie-4"] } },
            constraints: { max_sessions: 10 },
          },
        ],
      }),
    });
    if (!response.ok)
      return NextResponse.json(
        { error: `Reactor returned ${response.status}` },
        { status: 502, headers }
      );
    const { jwt, expires_at } = await response.json();
    if (typeof jwt !== "string" || !Number.isFinite(expires_at))
      throw new Error("Invalid token response");
    return NextResponse.json({ jwt, expires_at }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Could not create a session token. Try connecting again." },
      { status: 502, headers }
    );
  }
}
