import type { useHappyOysterActing } from "@reactor-models/happy-oyster-acting/react";
import type {
  HappyOysterActingSessionStateMessage,
  HappyOysterActingCommandErrorMessage,
} from "@reactor-models/happy-oyster-acting/core";

export type ActingApi = ReturnType<typeof useHappyOysterActing>;
export type ActingView = Pick<
  ActingApi,
  "status" | "sessionId" | "lastError"
> & {
  epoch: number;
  sessionState: HappyOysterActingSessionStateMessage | null;
  commandError: HappyOysterActingCommandErrorMessage | null;
};

// Frontend view state only. The generated provider owns transport/lifecycle;
// model snapshots arrive through its handler hooks or an awaited getState.
export function createSessionView() {
  let state: ActingView = {
    status: "disconnected",
    sessionId: undefined,
    lastError: undefined,
    epoch: 0,
    sessionState: null,
    commandError: null,
  };
  let closing = false;
  let ignoredError: ActingApi["lastError"];
  const listeners = new Set<() => void>();
  const publish = (next: ActingView) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const reset = (status: ActingView["status"] = "disconnected") => {
    publish({
      status,
      sessionId: undefined,
      lastError: undefined,
      epoch: state.epoch + 1,
      sessionState: null,
      commandError: null,
    });
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    beginConnect() {
      ignoredError = state.lastError ?? ignoredError;
      closing = false;
      reset("connecting");
    },
    beginDisconnect() {
      ignoredError = state.lastError ?? ignoredError;
      closing = true;
      reset();
    },
    reset,
    connection(next: Pick<ActingView, "status" | "sessionId" | "lastError">) {
      if (closing && next.status !== "disconnected") return;
      if (next.status === "disconnected") closing = false;
      const changed =
        state.status !== next.status || state.sessionId !== next.sessionId;
      publish({
        ...state,
        ...next,
        lastError: next.lastError === ignoredError ? undefined : next.lastError,
        epoch: changed ? state.epoch + 1 : state.epoch,
        ...(changed || next.status !== "ready"
          ? { sessionState: null, commandError: null }
          : {}),
      });
    },
    sessionState(
      message: HappyOysterActingSessionStateMessage,
      epoch = state.epoch
    ) {
      if (state.status !== "ready" || closing || epoch !== state.epoch) return;
      if (
        message.last_error === null &&
        state.lastError?.operation === "sendCommand"
      )
        ignoredError = state.lastError;
      publish({
        ...state,
        sessionState: message,
        lastError:
          state.lastError === ignoredError ? undefined : state.lastError,
        commandError: message.last_error === null ? null : state.commandError,
      });
    },
    commandError(message: HappyOysterActingCommandErrorMessage) {
      if (state.status === "ready" && !closing)
        publish({ ...state, commandError: message });
    },
  };
}
