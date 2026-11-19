const SKEW_MS = 60_000;
let cached: { jwt: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;
// Every hop of a session must reuse its token. Never rely on HTTP caching.
// A session near the one-hour expiry must reconnect; binding a replacement
// token to an existing session is an extension for longer visits.
export async function fetchToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - SKEW_MS) return cached.jwt;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch("/api/reactor/token", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? `Token fetch failed: ${response.status}`);
      if (typeof body.jwt !== "string" || !Number.isFinite(body.expires_at))
        throw new Error("Invalid session token");
      cached = { jwt: body.jwt, expiresAt: body.expires_at * 1000 };
      return cached.jwt;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
