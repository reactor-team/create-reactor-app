// One resolver is shared by every SDK request. Never persist browser tokens.
import type { JwtRequestContext } from "@reactor-team/js-sdk";
type Token = { jwt: string; expiresAt: number };
let cached: Token | null = null;
let inflight: Promise<string> | null = null;
// Reactor binds a session to the JWT that created it. Pin that token on the
// session's first hop, so a later refresh for a new connection cannot
// replace it.
const bySession = new Map<string, Token>();
export async function fetchToken(context?: JwtRequestContext): Promise<string> {
  const now = Date.now();
  if (context?.sessionId) {
    let token = bySession.get(context.sessionId);
    if (!token && cached) bySession.set(context.sessionId, (token = cached));
    if (token && now < token.expiresAt) return token.jwt;
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
