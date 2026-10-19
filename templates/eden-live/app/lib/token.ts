// One resolver is shared by every SDK request. Never persist browser tokens.
import type { JwtRequestContext } from "@reactor-team/js-sdk";
let cached: { jwt: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;
export async function fetchToken(context?: JwtRequestContext): Promise<string> {
  const now = Date.now();
  // An existing session belongs to its original JWT. Never silently replace it.
  if (context?.sessionId) {
    if (cached && now < cached.expiresAt) return cached.jwt;
    throw new Error("Session token expired. Disconnect and connect again.");
  }
  if (cached && now < cached.expiresAt - 60_000) return cached.jwt;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch("/api/reactor/token", { cache: "no-store" });
      if (!response.ok)
        throw new Error(
          `Token request failed (${response.status}). Check server configuration and model access.`
        );
      const { jwt, expires_at } = await response.json();
      if (
        typeof jwt !== "string" ||
        !jwt ||
        typeof expires_at !== "number" ||
        expires_at * 1000 <= Date.now()
      ) {
        throw new Error("Token endpoint returned an invalid or expired token.");
      }
      cached = { jwt, expiresAt: expires_at * 1000 };
      return jwt;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
