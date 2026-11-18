// The token resolver handed to the model provider's `jwtToken` prop.
//
// The SDK calls the resolver before every request a session makes, and a
// session only accepts the token that created it. So the resolver returns the
// same token for its whole life and only mints a new one close to expiry.
// It is a module-level function on purpose: a new resolver identity would
// make the provider rebuild its connection.

const REFRESH_SKEW_MS = 60_000;

let cached: { jwt: string; expiresAtMs: number } | null = null;
let inflight: Promise<string> | null = null;

async function mint(): Promise<string> {
  const response = await fetch("/api/reactor/token", { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as {
    jwt?: string;
    expires_at?: number;
    error?: string;
  };
  if (!response.ok || !body.jwt || !body.expires_at) {
    throw new Error(body.error ?? `Token request failed (${response.status}).`);
  }
  cached = { jwt: body.jwt, expiresAtMs: body.expires_at * 1000 };
  return body.jwt;
}

export async function resolveToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAtMs - REFRESH_SKEW_MS) {
    return cached.jwt;
  }
  inflight ??= mint().finally(() => {
    inflight = null;
  });
  return inflight;
}
