import test from "node:test";
import assert from "node:assert/strict";
import { fetchToken } from "../app/lib/token.ts";

test("coalesces initial minting, preserves session token, refuses expired session refresh", async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = 10_000,
    requests = 0;
  Date.now = () => now;
  globalThis.fetch = async (_url, options) => {
    requests++;
    assert.equal(options?.cache, "no-store");
    return new Response(
      JSON.stringify({ jwt: `test-${requests}`, expires_at: now / 1000 + 3600 })
    );
  };
  try {
    const tokens = await Promise.all([
      fetchToken(),
      fetchToken(),
      fetchToken(),
    ]);
    assert.deepEqual(tokens, ["test-1", "test-1", "test-1"]);
    assert.equal(requests, 1);
    now += 3590_000;
    assert.equal(await fetchToken({ sessionId: "existing" }), "test-1");
    now += 11_000;
    await assert.rejects(fetchToken({ sessionId: "existing" }), /expired/);
    assert.equal(requests, 1);
    assert.equal(await fetchToken(), "test-2");
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("a refresh for a new connection does not replace a live session's token", async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = 100_000_000,
    requests = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    requests++;
    return new Response(
      JSON.stringify({ jwt: `pin-${requests}`, expires_at: now / 1000 + 3600 })
    );
  };
  try {
    const first = await fetchToken();
    assert.equal(await fetchToken({ sessionId: "live" }), first);
    now += 3550_000;
    const refreshed = await fetchToken();
    assert.notEqual(refreshed, first);
    assert.equal(await fetchToken({ sessionId: "live" }), first);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
