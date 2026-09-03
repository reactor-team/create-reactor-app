import { NextResponse } from "next/server";

// The model this app drives. The minted JWT is scoped to it: the token
// can create sessions for this model only, and can act only on the
// sessions it created — nothing else on the account.
const MODEL_NAME = "reactor/visko-orbis-stable";

// Session budget for one token — how many sessions it may ever create
// (closed sessions still count). The client reuses one token for its whole
// lifetime, so leave room for a burst of reconnects.
const MAX_SESSIONS = 10;

// How long we ask Reactor to make the JWT valid for (the server caps
// this at 6h). One hour keeps a memoized token — and its remaining session
// budget — from outliving a normal visit.
const TOKEN_LIFETIME_SECONDS = 60 * 60;

// Mint a session-scoped Reactor JWT and return it together with its
// `expires_at`, so the client can memoize it for exactly its lifetime.
//
// ⚠️ Reuse is REQUIRED, not just an optimization. Reactor binds each session
// to the exact token that created it: a scoped token may only act on sessions
// it created ITSELF. If a fresh JWT is minted between the create call and a
// follow-up (GET session, ICE servers, DELETE), the new token did not
// "create" that session and is rejected:
//   403 "this token is session-scoped and is not authorized for this resource"
// So the resolver in the client MUST yield the SAME token across every hop of
// one session. It does that by memoizing in module scope — see fetchToken in
// ViskoOrbisStableApp — which is why this response is `no-store`. The browser
// HTTP cache cannot make that promise: it can drop an entry at any time
// (DevTools "Disable cache", eviction, a shared proxy), and a
// dropped-then-refetched token has no sessions bound to it.
//
// Why GET and not POST?
//   Nothing about the request varies, and a GET reads as the lookup it is.
//   The route handler still POSTs to Reactor internally.
//
// Why `private`?
//   Keeps shared caches (CDNs, corporate proxies) from storing a per-user JWT.
//
// Why `authorization_details`?
//   This is what downscopes the token. Without it the JWT carries the
//   API key's full user-level access; with it the browser only ever
//   holds a credential for MODEL_NAME sessions it started itself, so a
//   leaked token is a bounded loss instead of an account key.
export async function GET() {
  const apiKey = process.env.REACTOR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REACTOR_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  const res = await fetch("https://api.reactor.inc/tokens", {
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
