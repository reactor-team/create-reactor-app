import { NextResponse } from "next/server";
import { REACTOR_API_URL } from "@/app/lib/config";

// The model this app drives. The minted JWT is scoped to it: the token can
// create sessions for this model only, and can act only on the sessions it
// created — nothing else on the account.
const MODEL_NAME = "reactor/ltx2";

// Session budget for one token — how many sessions it may ever create
// (closed sessions still count). The client reuses one token for its whole
// lifetime, so leave room for a burst of reconnects.
const MAX_SESSIONS = 10;

// How long we ask Reactor to make the JWT valid for. The server caps
// this at its configured maximum (currently 6h), so asking for more
// is harmless — you just get the server max back.
const TOKEN_LIFETIME_SECONDS = 6 * 60 * 60;

// Mint a session-scoped Reactor JWT and return it together with its
// `expires_at`, so the client can memoize it for exactly its lifetime.
//
// Why `authorization_details`?
//   This is what downscopes the token. Without it the JWT carries the API
//   key's full user-level access; with it the browser only ever holds a
//   credential for MODEL_NAME sessions it started itself, so a leaked token
//   is a bounded loss instead of an account key.
//
// Why `no-store`?
//   The client owns the cache (see fetchToken in app/Ltx2App.tsx). Keeping
//   the token in the app rather than in the browser's HTTP cache makes its
//   lifetime observable, and keeps a cache miss from silently minting a
//   second token part-way through a session.
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

  const res = await fetch(`${REACTOR_API_URL}/tokens`, {
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
          resources: { models: { match: [MODEL_NAME] } },
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

  return NextResponse.json(
    { jwt, expires_at },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
