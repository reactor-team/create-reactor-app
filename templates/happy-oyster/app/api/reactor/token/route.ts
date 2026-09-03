import { NextResponse } from "next/server";
import { MODEL_NAMES } from "@reactor-models/happy-oyster";

// The models this app drives. A mode is fixed for the life of a session and
// picks which model the provider connects to, so the token has to be scoped
// to both. Reading `MODEL_NAMES` off the typed package rather than writing
// the names here keeps the scope from drifting from what the provider
// actually connects with — a scope that misses the connect name mints fine
// and then 403s on connect().
const SCOPED_MODELS = Object.values(MODEL_NAMES);

// Session budget for one token — how many sessions it may ever create
// (closed sessions still count). The client reuses one token for its whole
// lifetime, so leave room for a burst of reconnects.
const MAX_SESSIONS = 10;

// How long we ask Reactor to make the JWT valid for. The server caps
// this at its configured maximum (currently 6h), so asking for more
// is harmless, you just get the server max back.
const TOKEN_LIFETIME_SECONDS = 6 * 60 * 60;

// Mint a session-scoped Reactor JWT and return it together with its
// `expires_at`, so the client can memoize it for exactly its lifetime.
//
// Why `authorization_details`?
//   This is what downscopes the token. Without it the JWT carries the API
//   key's full user-level access; with it the browser only ever holds a
//   credential for these models' sessions it started itself, so a leaked
//   token is a bounded loss instead of an account key.
//
// Why `no-store`?
//   The client owns the cache (see fetchToken in
//   components/happy-oyster/ho-client.tsx). Keeping the token in the app
//   rather than in the browser's HTTP cache makes its lifetime observable,
//   and keeps a cache miss from silently minting a second token part-way
//   through a session.
//
// Why GET and not POST?
//   Nothing about the request varies, and a GET reads as the lookup it is.
//   The route handler still POSTs to Reactor internally.
export async function GET() {
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REACTOR_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_REACTOR_API_URL || "https://api.reactor.inc";

  const res = await fetch(`${baseUrl}/tokens`, {
    method: "POST",
    headers: {
      "Reactor-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: TOKEN_LIFETIME_SECONDS,
      authorization_details: [
        {
          type: "session",
          resources: { models: { match: SCOPED_MODELS } },
          constraints: { max_sessions: MAX_SESSIONS },
        },
      ],
    }),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Reactor /tokens returned ${res.status}` },
      { status: 502 },
    );
  }

  const { jwt, expires_at } = (await res.json()) as {
    jwt: string;
    expires_at: number;
  };

  // `expires_at` (unix seconds, decided by the server) lets the client
  // memoize the token for exactly its real lifetime.
  return NextResponse.json(
    { jwt, expires_at },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
