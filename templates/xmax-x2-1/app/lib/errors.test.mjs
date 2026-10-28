import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnosticMessage,
  diagnosticReducer,
  INITIAL_DIAGNOSTICS,
} from "./errors.ts";

test("retains the primary error and last session after disconnect clears the SDK session", () => {
  let state = diagnosticReducer(INITIAL_DIAGNOSTICS, {
    type: "session",
    sessionId: "session-123",
  });
  state = diagnosticReducer(state, {
    type: "error",
    at: 10,
    error: {
      name: "ReactorError",
      code: "TRANSPORT_ERROR",
      operation: "publish",
      message: "Transport closed",
    },
  });
  state = diagnosticReducer(state, { type: "session", sessionId: undefined });
  state = diagnosticReducer(state, {
    type: "error",
    at: 11,
    error: {
      name: "ReactorError",
      code: "INVALID_STATE",
      message: "Session is disconnected",
    },
    operation: "set_reference_image",
  });
  assert.deepEqual(
    state.entries.map(({ code, sessionId }) => [code, sessionId]),
    [
      ["TRANSPORT_ERROR", "session-123"],
      ["INVALID_STATE", "session-123"],
    ]
  );
  assert.equal(state.entries[0].operation, "publish");
});

test("keeps the last five errors in arrival order, including equal timestamps", () => {
  let state = INITIAL_DIAGNOSTICS;
  for (let i = 0; i < 7; i++)
    state = diagnosticReducer(state, {
      type: "error",
      at: 20,
      error: { code: `ERROR_${i}` },
    });
  assert.deepEqual(
    state.entries.map(({ code }) => code),
    ["ERROR_2", "ERROR_3", "ERROR_4", "ERROR_5", "ERROR_6"]
  );
  assert.deepEqual(
    state.entries.map(({ id }) => id),
    [3, 4, 5, 6, 7]
  );
});

test("manual clear preserves session context for the next error", () => {
  let state = diagnosticReducer(INITIAL_DIAGNOSTICS, {
    type: "error",
    at: 1,
    sessionId: "session-123",
    error: new Error("Upload failed"),
    operation: "uploadFile",
  });
  state = diagnosticReducer(state, { type: "clear" });
  assert.equal(state.entries.length, 0);
  state = diagnosticReducer(state, {
    type: "error",
    at: 2,
    error: new Error("Again"),
    operation: "connect",
  });
  assert.equal(state.entries[0].sessionId, "session-123");
  assert.equal(state.entries[0].id, 2);
});

test("removes credentials, request URLs and stack lines from displayed descriptions", () => {
  const message = diagnosticMessage(
    new Error(
      'Upload https://example.test/file?secret=value Bearer abcdef rk_private api_key="private" jwt=eyJabc.def.ghi\n at secret-stack-line'
    )
  );
  for (const forbidden of [
    "example.test",
    "secret=value",
    "abcdef",
    "rk_private",
    '"private"',
    "eyJabc",
    "secret-stack-line",
  ])
    assert.equal(message.includes(forbidden), false);
  assert.ok(message.includes("Upload"));
  const state = diagnosticReducer(INITIAL_DIAGNOSTICS, {
    type: "error",
    at: 1,
    sessionId: "https://example.test/token",
    error: { code: "https://example.test/auth", operation: "Bearer secret" },
    operation: "uploadFile",
  });
  assert.equal(state.entries[0].code, "LOCAL_ERROR");
  assert.equal(state.entries[0].operation, "uploadFile");
  assert.equal(state.entries[0].sessionId, null);
});

test("retains sanitized native cause and optional HTTP/recoverability metadata", () => {
  const error = Object.assign(new Error("Cannot upload in this state"), {
    code: "INVALID_STATE",
    operation: "uploadFile",
    status: 409,
    recoverable: false,
    cause: new TypeError(
      "Failed to fetch https://example.test/upload?token=private\n at private-stack"
    ),
  });
  const state = diagnosticReducer(INITIAL_DIAGNOSTICS, {
    type: "error",
    at: 1,
    error,
  });
  assert.equal(state.entries[0].status, 409);
  assert.equal(state.entries[0].recoverable, false);
  assert.equal(state.entries[0].cause?.name, "TypeError");
  assert.equal(
    state.entries[0].cause?.message,
    "Failed to fetch [URL removed]"
  );
  const noMetadata = diagnosticReducer(INITIAL_DIAGNOSTICS, {
    type: "error",
    at: 2,
    error: new Error("Local failure"),
  });
  assert.equal(noMetadata.entries[0].status, undefined);
  assert.equal(noMetadata.entries[0].cause, undefined);
});
