import { NextResponse } from "next/server";
import { MODEL_NAME } from "@/app/lib/models";

// Mints a short-lived session token for the model with the server's API key.
// The key never leaves the server; the browser only ever holds the token.
//
// GET /api/reactor/token

const REACTOR_API_URL = process.env.REACTOR_API_URL ?? "https://api.reactor.inc";
// Sessions one token may ever create (closed sessions still count).
const MAX_SESSIONS = 10;
// One hour keeps a memoized token, and its session budget, from outliving a visit.
const TOKEN_LIFETIME_SECONDS = 60 * 60;

export async function GET() {
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REACTOR_API_KEY is not set on the server." },
      { status: 500 },
    );
  }

  const response = await fetch(`${REACTOR_API_URL}/tokens`, {
    method: "POST",
    headers: { "Reactor-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: TOKEN_LIFETIME_SECONDS,
      authorization_details: [
        {
          type: "session",
          resources: { models: { match: [MODEL_NAME] } },
          constraints: { max_sessions: MAX_SESSIONS },
        },
      ],
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json(
      {
        error: response
          ? `Reactor refused the token request (${response.status}). Check that your API key can use ${MODEL_NAME}.`
          : "Reactor could not be reached. Try again.",
      },
      { status: 502 },
    );
  }

  // A session can only be operated by the exact token that created it, so the
  // client memoizes the token itself (see lib/token.ts) and the browser's HTTP
  // cache stays out of it.
  const { jwt, expires_at } = (await response.json()) as {
    jwt: string;
    expires_at: number;
  };
  return NextResponse.json(
    { jwt, expires_at },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
