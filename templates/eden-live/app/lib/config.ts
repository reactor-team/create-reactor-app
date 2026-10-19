// The Reactor API the SDK talks to. The browser-side provider and the
// server-side token mint (app/api/reactor/token) must both point at the same
// API - a token minted by one is not valid on another - so they read this
// single value. Override with NEXT_PUBLIC_REACTOR_API_URL.
export const REACTOR_API_URL =
  process.env.NEXT_PUBLIC_REACTOR_API_URL || "https://api.reactor.inc";
