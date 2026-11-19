// Keep one token for every hop of a session, including uploads.
// Rotate only before connecting a new session; never silently orphan a live one.
let cached: { jwt: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

export async function fetchToken(): Promise<string> {
  if (cached) {
    if (Date.now() >= cached.expiresAt)
      throw new Error("Session token expired. Disconnect and connect again.");
    return cached.jwt;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch("/api/reactor/token", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          `Token request failed (${response.status}). Check server configuration and model access.`
        );
      const body = await response.json();
      if (
        typeof body.jwt !== "string" ||
        !Number.isFinite(body.expires_at) ||
        body.expires_at * 1000 <= Date.now()
      )
        throw new Error("Invalid token response.");
      cached = { jwt: body.jwt, expiresAt: body.expires_at * 1000 };
      return cached.jwt;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function prepareToken() {
  if (cached && cached.expiresAt - Date.now() < 60_000) cached = null;
  await fetchToken();
}
