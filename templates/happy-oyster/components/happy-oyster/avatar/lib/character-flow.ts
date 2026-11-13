import type { HappyOysterActingCreateCharacterParams } from "@reactor-models/happy-oyster-acting/core";

import type { ActingApi, ActingView } from "./session-view";

type FlowClient = Pick<
  ActingApi,
  "attachCharacter" | "createCharacter" | "startPerformance"
> & {
  getSnapshot: () => ActingView;
  subscribe: (listener: () => void) => () => void;
};

type Selection =
  | { kind: "saved"; characterId: string }
  | {
      kind: "create";
      params: () => Promise<HappyOysterActingCreateCharacterParams>;
    };

function cancelled() {
  return new DOMException("Character setup cancelled.", "AbortError");
}

// Subscribe before invoking the command: a snapshot or refusal can arrive
// before its acknowledgement. Neither the ack nor an old ready snapshot is
// sufficient to start a performance.
function observe(
  client: FlowClient,
  signal: AbortSignal,
  check: (snapshot: ActingView) => boolean,
  command?: () => Promise<unknown>,
  timeoutMs = 10 * 60_000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let accepted = !command;
    let settled = false;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(cancelled());
    const inspect = () => {
      if (settled) return;
      try {
        const ready = check(client.getSnapshot());
        if (accepted && ready) finish();
      } catch (error) {
        finish(error);
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(
      () =>
        finish(
          new Error(
            "Character setup timed out. Check its state before trying again."
          )
        ),
      timeoutMs
    );
    unsubscribe = client.subscribe(inspect);
    if (signal.aborted) return abort();
    inspect();
    if (settled) return;
    if (command) {
      void Promise.resolve()
        .then(() => {
          if (signal.aborted || settled) throw cancelled();
          return command();
        })
        .then(() => {
          accepted = true;
          inspect();
        }, finish);
    }
  });
}

export async function startCharacter({
  client,
  connect,
  prepareToken,
  selection,
  signal,
  progress,
}: {
  client: FlowClient;
  connect: () => Promise<void>;
  prepareToken: () => Promise<unknown>;
  selection: Selection;
  signal: AbortSignal;
  progress: (message: string) => void;
}) {
  const guard = () => {
    if (signal.aborted) throw cancelled();
  };
  guard();
  const initialError = client.getSnapshot().lastError;
  if (client.getSnapshot().status === "disconnected") {
    progress("Connecting…");
    await prepareToken();
    guard();
    await connect();
  }
  guard();
  await observe(
    client,
    signal,
    (snapshot) => {
      guard();
      if (snapshot.lastError && snapshot.lastError !== initialError)
        throw snapshot.lastError;
      return (
        snapshot.status === "ready" &&
        !!snapshot.sessionId &&
        !!snapshot.sessionState
      );
    },
    undefined,
    30_000
  );
  const { sessionId, epoch } = client.getSnapshot();
  const sameSession = (snapshot: ActingView) => {
    guard();
    if (
      snapshot.status !== "ready" ||
      !sessionId ||
      snapshot.sessionId !== sessionId ||
      snapshot.epoch !== epoch
    )
      throw new Error("Connection changed. Start again when connected.");
  };

  const assertAvailable = () => {
    if (
      ["building", "starting", "live", "paused", "ending"].includes(
        client.getSnapshot().sessionState?.phase ?? ""
      )
    )
      throw new Error(
        "Wait for the current character or performance to finish."
      );
  };
  assertAvailable();

  progress(
    selection.kind === "saved" ? "Loading character…" : "Uploading image…"
  );
  const params = selection.kind === "create" ? await selection.params() : null;
  sameSession(client.getSnapshot());
  const before = client.getSnapshot();
  assertAvailable();
  progress(
    selection.kind === "saved" ? "Loading character…" : "Creating character…"
  );
  await observe(
    client,
    signal,
    (snapshot) => {
      sameSession(snapshot);
      const state = snapshot.sessionState;
      const refusal = snapshot.commandError;
      if (refusal && refusal !== before.commandError)
        throw new Error(`${refusal.code}: ${refusal.reason}`);
      if (snapshot.lastError && snapshot.lastError !== before.lastError)
        throw snapshot.lastError;
      if (state && state !== before.sessionState && state.phase === "failed")
        throw new Error(
          String(state.last_error?.reason ?? "Character setup failed.")
        );
      return (
        !!state &&
        state !== before.sessionState &&
        state.phase === "ready" &&
        state.character_status === "ready" &&
        !!state.character_id &&
        (selection.kind === "saved"
          ? state.character_id === selection.characterId
          : state.character_id !== before.sessionState?.character_id)
      );
    },
    () =>
      selection.kind === "saved"
        ? client.attachCharacter({ character_id: selection.characterId })
        : client.createCharacter(params!)
  );
  sameSession(client.getSnapshot());
  progress("Starting performance…");
  const beforeStart = client.getSnapshot();
  await observe(
    client,
    signal,
    (snapshot) => {
      sameSession(snapshot);
      if (
        snapshot.commandError &&
        snapshot.commandError !== beforeStart.commandError
      )
        throw new Error(
          `${snapshot.commandError.code}: ${snapshot.commandError.reason}`
        );
      if (snapshot.lastError && snapshot.lastError !== beforeStart.lastError)
        throw snapshot.lastError;
      const state = snapshot.sessionState;
      if (
        state &&
        state !== beforeStart.sessionState &&
        state.phase === "failed"
      )
        throw new Error(
          String(state.last_error?.reason ?? "Performance failed to start.")
        );
      return !!state && ["starting", "live", "paused"].includes(state.phase);
    },
    () => client.startPerformance()
  );
  // Starting is not proof of live media; the authoritative state drives the UI.
}
